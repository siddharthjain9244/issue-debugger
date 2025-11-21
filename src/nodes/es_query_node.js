import { logger } from '../utils/logger.js';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getESIndexes } from '../config/elasticsearch.config.js';

/**
 * Elasticsearch Query Node
 * 
 * This node decides if ES query is needed and generates the Elasticsearch query.
 * 
 * ES Context:
 * - ES only stores ORDER TRANSACTION DATA
 * - Available transaction types: buy, sell, redeem, goldback
 * - Index (environment-based):
 *   - production: digital-gold-transactions
 *   - staging: digital-gold-transactions-new
 *   - local: digital-gold-transactions-new
 * - Contains order details from dg_buy_orders and dg_sell_orders tables
 * 
 * @param {Object} state - Current workflow state
 * @returns {Object} Updated state with ES query (or null if not needed)
 */
export async function esQueryNode(state) {
  logger.info('📊 Executing es_query_node');

  try {
    // Get environment-based ES index
    const env = process.env.NODE_ENV || 'local';
    const esIndexes = getESIndexes(env);
    const transactionsIndex = esIndexes.TRANSACTIONS;
    
    logger.info(`   🌍 Environment: ${env}`);
    logger.info(`   📦 ES Index: ${transactionsIndex}`);
    
    const userQuery = `${state.subject}\n${state.body}`;
    
    // Extract SQL data if available
    const sqlData = state.sqlData || {};
    const hasOrderIds = sqlData.orderIds && sqlData.orderIds.length > 0;
    const hasCustomerIds = sqlData.customerIds && sqlData.customerIds.length > 0;
    const hasSQLData = hasOrderIds || hasCustomerIds;
    
    logger.info('📋 Checking if ES query is needed', {
      hasOrderIds: hasOrderIds,
      orderIdsCount: sqlData.orderIds?.length || 0,
      hasCustomerIds: hasCustomerIds,
      customerIdsCount: sqlData.customerIds?.length || 0
    });

    // Step 1: Decide if ES query is needed and generate it
    const esQueryPrompt = PromptTemplate.fromTemplate(`
You are an Elasticsearch expert for a Digital Gold Wealth Management platform.

USER QUERY:
{userQuery}

ISSUE PRIORITY: {priority}
ISSUE CATEGORY: {category}

SQL DATA AVAILABLE: {hasSQLData}
{sqlContext}

ELASTICSEARCH CONTEXT:
Elasticsearch stores ONLY order transaction data with these details:

AVAILABLE DATA IN ES:
- Transaction types: buy, sell, redeem, goldback
- Order fields: order_id, customer_id, amount, gram_weight, status, merchant_id, product_id
- Timestamps: created_at, updated_at
- Additional: price_per_gram, display_weight, quote_id, merchant_order_id

Index: {esIndex}

WHEN TO QUERY ES:
✅ Query ES when user asks about:
- Order history or transaction history
- Specific orders by order_id
- Order status, timeline, or events
- Transaction amounts or quantities
- Order failures or issues
- Recent orders or transaction patterns

❌ DO NOT query ES when user asks about:
- Customer personal info (use SQL: customer table)
- Portfolio balances (use SQL: customer_portfolio table)
- Bank account details (use SQL: bank_accounts table)
- Subscription/SIP details (use SQL: subscription table)
- Any non-order data

YOUR TASK:
1. Determine if ES query is needed for this issue
2. If YES: Generate a valid Elasticsearch query
3. If NO: Return null for the query

RULES FOR ES QUERY:
1. If SQL has order_ids → Use "terms" query: {{"terms": {{"order_id": [id1, id2, ...]}}}}
2. If SQL has customer_ids → Use "terms" or "match" query: {{"terms": {{"customer_id": [...]}}}}
3. Prefer order_ids over customer_ids if both available (more specific)
4. Always sort by created_at DESC for chronological view
5. Set size to match number of IDs (or max 100)
6. Use bool queries only if combining multiple conditions
7. IMPORTANT: ES only has ORDER transaction data, nothing else

RESPONSE FORMAT (JSON only, no markdown):
{{
  "needsESQuery": true/false,
  "reasoning": "Why ES query is/isn't needed",
  "esQuery": {{
    "index": "digital-gold-transactions",
    "body": {{
      "query": {{ "match": {{ "customer_id": "123" }} }},
      "sort": [{{ "created_at": {{ "order": "desc" }} }}],
      "size": 50
    }}
  }} OR null if not needed
}}

Example 1 - NEEDS ES:
Input: "Show order history for customer 9876"
Output: {{"needsESQuery": true, "reasoning": "Need order transaction data", "esQuery": {{"index": "digital-gold-transactions", "body": {{"query": {{"match": {{"customer_id": "9876"}}}}, "sort": [{{"created_at": {{"order": "desc"}}}}], "size": 50}}}}}}

Example 2 - NO ES NEEDED:
Input: "What is customer 9876 email address?"
Output: {{"needsESQuery": false, "reasoning": "Customer email is in SQL customer table, not in ES", "esQuery": null}}

Example 3 - USE SQL ORDER IDS:
Input: "Show order details" + SQL returned order_ids: [123, 456, 789]
Output: {{"needsESQuery": true, "reasoning": "Fetch transaction details for specific order IDs from ES", "esQuery": {{"index": "digital-gold-transactions", "body": {{"query": {{"terms": {{"order_id": [123, 456, 789]}}}}, "sort": [{{"created_at": {{"order": "desc"}}}}], "size": 3}}}}}}

Example 4 - USE SQL CUSTOMER IDS (no order_ids):
Input: "Show transactions" + SQL returned customer_ids: [100, 200]
Output: {{"needsESQuery": true, "reasoning": "Fetch transactions for customer IDs from ES", "esQuery": {{"index": "digital-gold-transactions", "body": {{"query": {{"terms": {{"customer_id": [100, 200]}}}}, "sort": [{{"created_at": {{"order": "desc"}}}}], "size": 50}}}}}}
`);

    const llm = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const chain = esQueryPrompt.pipe(llm).pipe(new StringOutputParser());

    // Build SQL context for the prompt
    let sqlContext = 'No SQL data with order_ids or customer_ids available.';
    
    if (hasSQLData) {
      const parts = [];
      
      if (hasOrderIds) {
        const orderIds = sqlData.orderIds;
        const preview = orderIds.length <= 10 ? orderIds.join(', ') : 
                       `${orderIds.slice(0, 10).join(', ')}... (${orderIds.length} total)`;
        parts.push(`- Order IDs: ${orderIds.length} found [${preview}]`);
      }
      
      if (hasCustomerIds) {
        const customerIds = sqlData.customerIds;
        const preview = customerIds.length <= 5 ? customerIds.join(', ') : 
                       `${customerIds.slice(0, 5).join(', ')}... (${customerIds.length} total)`;
        parts.push(`- Customer IDs: ${customerIds.length} found [${preview}]`);
      }
      
      sqlContext = `SQL Query Results Available:
${parts.join('\n')}

Generate ES query to fetch transaction details for these orders/customers from Elasticsearch.
Use "terms" query for multiple IDs, "match" query for single ID.`;
    }

    logger.info('🤖 Calling LLM to determine ES query need...');
    
    const result = await chain.invoke({
      userQuery,
      priority: state.priority || 'unknown',
      category: state.category || 'unknown',
      hasSQLData: hasSQLData ? 'YES' : 'NO',
      sqlContext: sqlContext,
      esIndex: transactionsIndex,
    });

    // Parse the JSON response
    const cleanedResult = result.trim()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '');
    
    const queryDecision = JSON.parse(cleanedResult);

    if (!queryDecision.needsESQuery) {
      logger.info('ℹ️  ES query not needed:', queryDecision.reasoning);
      
      return {
        ...state,
        needsESQuery: false,
        esQuery: null,
        esReasoning: queryDecision.reasoning
      };
    }

    // Add the environment-specific index to the ES query
    const esQueryWithIndex = {
      index: transactionsIndex,
      ...queryDecision.esQuery
    };
    
    logger.info('✅ ES query generated:', {
      reasoning: queryDecision.reasoning,
      index: transactionsIndex
    });

    logger.info('📄 Generated ES query:', esQueryWithIndex);

    return {
      ...state,
      needsESQuery: true,
      esQuery: esQueryWithIndex,
      esReasoning: queryDecision.reasoning
    };

  } catch (error) {
    logger.error('❌ Error in es_query_node:', error);
    
    return {
      ...state,
      needsESQuery: false,
      esQuery: null,
      error: `ES query generation failed: ${error.message}`
    };
  }
}

