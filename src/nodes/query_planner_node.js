import { logger } from '../utils/logger.js';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

/**
 * Query Planner Node
 * 
 * This node decides which data sources should be queried based on the issue.
 * 
 * Available data sources:
 * - SQL: User data, orders, transactions, portfolio balances
 * - LOKI: Application logs, error logs, system logs
 * - ELASTICSEARCH: Order events, search data, time-series events
 * - REDIS: Caches, locks, balances, session data
 * 
 * The LLM analyzes the issue and determines which sources are needed.
 * 
 * @param {Object} state - Current workflow state
 * @returns {Object} Updated state with data sources to query
 */
export async function queryPlannerNode(state) {
  logger.info('🗺️  Executing query_planner_node');

  try {
    // Create the query planning prompt
    const plannerPrompt = PromptTemplate.fromTemplate(`
You are a data source expert for a digital gold wealth management platform. 
Based on the issue description, determine which data sources should be queried to gather relevant information for debugging.

ISSUE DETAILS:
Subject: {subject}
Description: {body}
Priority: {priority}
Category: {category}

AVAILABLE DATA SOURCES:

1. SQL Database (wealthmgmt MySQL):
   - Customer information (customer, kyc, bank_accounts)
   - Portfolio balances (customer_portfolio, user_portfolio)
   - Transaction history (dg_buy_orders, dg_sell_orders, dg_goldback_orders)
   - Subscriptions/SIP (subscription, subscription_orders)
   - Transfers (dg_p2p_transfers, dg_p2m_transfers)
   - Pricing data (gold_rate, dg_daily_price)
   - Audit trail (ledger)
   Use for: Balance checks, transaction history, customer data, order status

2. LOKI (Log aggregation):
   - Application logs
   - Error logs and stack traces
   - API request/response logs
   - Service health logs
   Use for: Error messages, API failures, service crashes, debugging code issues

3. ELASTICSEARCH:
   - Order events (real-time event stream)
   - Search queries and results
   - Time-series analytics
   - User behavior events
   Use for: Event timelines, search issues, real-time tracking

4. REDIS:
   - Cached user balances
   - Session data
   - Rate limiting counters
   - Distributed locks
   - Real-time cache values
   Use for: Cache issues, session problems, lock contention, stale data

DECISION RULES:
- Balance/portfolio issues → SQL (always) + optionally REDIS (for cache comparison)
- Error messages/crashes → LOKI (always)
- Transaction/order issues → SQL (always) + LOKI (for errors) + ELASTICSEARCH (for events)
- Performance issues → LOKI (for slow logs) + REDIS (for cache) + SQL (for queries)
- API failures → LOKI (for logs) + SQL (for data validation)
- Customer data issues → SQL (always)

Respond ONLY in this exact JSON format (no extra text):
{{
  "dataSources": ["sql", "loki", "elasticsearch", "redis"],
  "reasoning": "Brief explanation of why each source is needed",
  "expectedFindings": "What we expect to find in each source"
}}

Only include data sources that are actually needed. Don't include all sources by default.
`);

    // Initialize LLM
    const llm = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      temperature: 0.2,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Create the chain
    const chain = plannerPrompt.pipe(llm).pipe(new StringOutputParser());

    // Execute planning
    logger.info('🤖 Calling LLM for query planning...');
    const result = await chain.invoke({
      subject: state.subject,
      body: state.body,
      priority: state.priority || 'unknown',
      category: state.category || 'unknown'
    });

    // Parse the JSON response
    const cleanedResult = result.trim()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '');
    
    const plan = JSON.parse(cleanedResult);

    logger.info('✅ Query plan created:', {
      dataSources: plan.dataSources,
      reasoning: plan.reasoning
    });

    return {
      ...state,
      dataSourcesToQuery: plan.dataSources,
      queryPlanReasoning: plan.reasoning,
      expectedFindings: plan.expectedFindings
    };

  } catch (error) {
    logger.error('❌ Error in query_planner_node:', error);
    
    // Fallback: Use rule-based planning
    logger.warn('⚠️  Falling back to rule-based query planning');
    const fallbackPlan = fallbackQueryPlan(state);
    
    return {
      ...state,
      ...fallbackPlan,
      error: `Query planning AI failed: ${error.message}. Used fallback.`
    };
  }
}

/**
 * Fallback query planning using simple rules
 * Used when AI planning fails
 * 
 * @param {Object} state - Current state
 * @returns {Object} Query plan
 */
function fallbackQueryPlan(state) {
  const text = `${state.subject} ${state.body}`.toLowerCase();
  const dataSources = ['sql']; // SQL is always useful
  
  // Check for error indicators
  if (text.includes('error') || text.includes('crash') || text.includes('fail')) {
    dataSources.push('loki');
  }
  
  // Check for cache/session issues
  if (text.includes('cache') || text.includes('session') || text.includes('lock')) {
    dataSources.push('redis');
  }
  
  // Check for event/tracking issues
  if (text.includes('event') || text.includes('track') || text.includes('timeline')) {
    dataSources.push('elasticsearch');
  }
  
  // For critical/high priority, check logs
  if (state.priority === 'critical' || state.priority === 'high') {
    if (!dataSources.includes('loki')) {
      dataSources.push('loki');
    }
  }
  
  return {
    dataSourcesToQuery: dataSources,
    queryPlanReasoning: 'Determined using fallback rule-based system',
    expectedFindings: 'Will check relevant data sources based on issue keywords'
  };
}


