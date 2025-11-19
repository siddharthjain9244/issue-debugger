/**
 * Final Analysis Node (3-Stage AI Analysis)
 * 
 * Stage 1: AI analyzes SQL data → SQL insights
 * Stage 2: AI analyzes ES data → ES insights
 * Stage 3: AI combines all insights → Final root cause analysis
 * 
 * This approach provides better analysis by:
 * - Breaking down complex data into manageable chunks
 * - Extracting key insights from each data source
 * - Combining insights for comprehensive diagnosis
 */

import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { logger } from '../utils/logger.js';

/**
 * Stage 1: Analyze SQL data with AI
 * 
 * @param {Object} sqlData - SQL execution results
 * @param {string} userQuery - User's issue description
 * @returns {Promise<string>} AI-generated SQL insights
 */
async function analyzeSQLData(sqlData, userQuery) {
  if (!sqlData || !sqlData.success || !sqlData.rows || sqlData.rows.length === 0) {
    return 'No SQL data available for analysis.';
  }

  logger.info('📊 Stage 1: Analyzing SQL data with AI...');

  const sqlAnalysisPrompt = PromptTemplate.fromTemplate(`
You are a database expert analyzing SQL query results for a user-reported issue in a Digital Gold platform.

### USER ISSUE:
{userQuery}

### SQL DATA:
- Total rows returned: {rowCount}
- Order IDs found: {orderIds}
- Customer IDs found: {customerIds}

### ACTUAL DATA (grouped by source table):
{dataRows}

Note: Data is organized by source table for better analysis. Pay attention to which table each row comes from.

### CRITICAL NOTE - GOLD QUANTITY FIELDS:
⚠️  **IMPORTANT**: The "gold_balance" field is ALWAYS NULL/unreliable - DO NOT use it!
✅  **USE THESE INSTEAD** for gold quantity calculations:
   - "quantity" field (in grams) - found in portfolio/orders
   - "gram_weight" field (in grams) - found in buy/sell orders
   - "amount" field is in INR (money), NOT grams

### ORDER STATUS CODES:
- **status = 7**: SUCCESS (order completed successfully)
- **status = 0**: CANCELLED (order was cancelled)
- **status = 13**: PENDING (order is being processed)
- **status = 15**: PENDING DISBURSEMENT (payment pending)

Only orders with status = 7 should be counted for gold balance calculations.

### YOUR TASK:
Analyze this SQL data and extract key insights relevant to the user's issue.

Focus on:
1. What does the data reveal about the issue?
2. Calculate gold quantities using "quantity" or "gram_weight" fields (NOT gold_balance)
3. Any anomalies or patterns in the data?
4. Specific evidence from the data (IDs, values, timestamps)
5. What's missing or needs verification?

Provide a concise analysis (3-5 bullet points).`);

  const model = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.3,
  });

  const chain = sqlAnalysisPrompt.pipe(model);

  try {
    const allRows = sqlData.rows || sqlData.allRows || [];
    const rowsByTable = sqlData.rowsByTable || {};
    const tablesQueried = sqlData.tablesQueried || [];
    
    // Format data with table grouping for better analysis
    let dataRows = '';
    
    if (Object.keys(rowsByTable).length > 0) {
      // Show data grouped by table
      Object.entries(rowsByTable).forEach(([tableName, rows]) => {
        dataRows += `\n### FROM ${tableName.toUpperCase()} (${rows.length} rows):\n`;
        rows.slice(0, 10).forEach((row, idx) => {
          // Remove _sourceTable from display
          const { _sourceTable, ...displayRow } = row;
          dataRows += `${idx + 1}. ${JSON.stringify(displayRow)}\n`;
        });
        if (rows.length > 10) {
          dataRows += `... and ${rows.length - 10} more rows from ${tableName}\n`;
        }
      });
    } else {
      // Fallback to flat list if no grouping
      dataRows = allRows.slice(0, 20).map((row, idx) => {
        const { _sourceTable, ...displayRow } = row;
        return `${idx + 1}. ${JSON.stringify(displayRow)}`;
      }).join('\n');
    }

    const result = await chain.invoke({
      userQuery: userQuery,
      rowCount: sqlData.rowCount || sqlData.totalRows || 0,
      orderIds: (sqlData.orderIds || []).slice(0, 20).join(', ') || 'None',
      customerIds: (sqlData.customerIds || []).slice(0, 20).join(', ') || 'None',
      dataRows: dataRows
    });

    logger.info('✅ SQL data analysis completed');
    return result.content || result;
  } catch (error) {
    logger.error('❌ SQL data analysis failed:', error);
    return 'SQL data analysis failed: ' + error.message;
  }
}

/**
 * Stage 2: Analyze ES data with AI
 * 
 * @param {Object} esData - ES execution results
 * @param {string} userQuery - User's issue description
 * @returns {Promise<string>} AI-generated ES insights
 */
async function analyzeESData(esData, userQuery) {
  if (!esData || esData.skipped || !esData.documents || esData.documents.length === 0) {
    return 'No Elasticsearch data available for analysis.';
  }

  logger.info('📊 Stage 2: Analyzing ES data with AI...');

  const esAnalysisPrompt = PromptTemplate.fromTemplate(`
You are an Elasticsearch expert analyzing transaction data for a user-reported issue in a Digital Gold platform.

### USER ISSUE:
{userQuery}

### ELASTICSEARCH DATA:
- Total documents: {total}
- Documents retrieved: {documentsFound}

### TRANSACTION DETAILS (first 10):
{transactions}

### CRITICAL NOTE - GOLD QUANTITY FIELDS:
⚠️  **IMPORTANT**: DO NOT rely on "gold_balance" field (it's unreliable/null)
✅  **USE THESE INSTEAD** for gold quantity:
   - "gram_weight" field - gold quantity in grams
   - "quantity" field - gold quantity in grams  
   - "amount" field is in INR (money), NOT grams

### ORDER STATUS CODES:
- **status = 7**: SUCCESS (transaction completed successfully)
- **status = 0**: CANCELLED (transaction was cancelled)
- **status = 13**: PENDING (transaction is being processed)
- **status = 15**: PENDING DISBURSEMENT (payment pending)

Only transactions with status = 7 should be counted for gold balance calculations.

### YOUR TASK:
Analyze this transaction data and extract key insights relevant to the user's issue.

Focus on:
1. Transaction statuses and their implications
2. Calculate gold quantities using "gram_weight" or "quantity" fields
3. Any failed or pending transactions
4. Timeline of events (created_at, updated_at)
5. Amount discrepancies or anomalies
6. Correlation with the reported issue

Provide a concise analysis (3-5 bullet points).`);

  const model = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.3,
  });

  const chain = esAnalysisPrompt.pipe(model);

  try {
    const transactions = esData.documents.slice(0, 10).map((doc, idx) => {
      const source = doc._source || doc;
      return `Transaction ${idx + 1}:
  - Order ID: ${source.order_id || 'N/A'}
  - Customer ID: ${source.customer_id || 'N/A'}
  - Type: ${source.txn_type || source._type || 'N/A'}
  - Amount: ${source.amount || 'N/A'}
  - Status: ${source.status || 'N/A'}
  - Created: ${source.created_at || 'N/A'}`;
    }).join('\n\n');

    const result = await chain.invoke({
      userQuery: userQuery,
      total: esData.total || 0,
      documentsFound: esData.documentsFound || esData.documents.length,
      transactions: transactions
    });

    logger.info('✅ ES data analysis completed');
    return result.content || result;
  } catch (error) {
    logger.error('❌ ES data analysis failed:', error);
    return 'ES data analysis failed: ' + error.message;
  }
}

/**
 * LangGraph node for final issue analysis (3-stage)
 * 
 * @param {Object} state - Current graph state
 * @returns {Promise<Object>} Updated state with analysis results
 */
export async function analysisNode(state) {
  logger.info('🔍 Performing 3-stage AI analysis...');

  try {
    // Stage 1: Analyze SQL data with AI
    const sqlInsights = await analyzeSQLData(
      state.sqlData, 
      `${state.subject}\n${state.body}`
    );

    // Stage 2: Analyze ES data with AI
    const esInsights = await analyzeESData(
      state.esData,
      `${state.subject}\n${state.body}`
    );
    
    // Stage 3: Combine all insights for final analysis
    logger.info('🔍 Stage 3: Combining insights for final root cause analysis...');
    
    const analysisPrompt = PromptTemplate.fromTemplate(`
You are an expert backend engineer providing final root cause analysis for a user-reported issue in a Digital Gold Wealth Management platform.

You have been provided with AI-analyzed insights from SQL database and Elasticsearch transaction data.

### USER ISSUE:
Subject: {subject}
Description: {body}

### ISSUE CLASSIFICATION:
Priority: {priority}
Category: {category}
Reasoning: {classificationReasoning}

### SQL DATA INSIGHTS (AI-Analyzed):
{sqlInsights}

### ELASTICSEARCH DATA INSIGHTS (AI-Analyzed):
{esInsights}

### CRITICAL REMINDER - GOLD QUANTITY FIELDS:
⚠️  **NEVER use "gold_balance" field** - it's always NULL/unreliable
✅  **ALWAYS use these fields** for gold quantity calculations:
   - "quantity" field (in grams)
   - "gram_weight" field (in grams)
   - Calculate totals: sum of buy gram_weight - sum of sell gram_weight = net gold holdings

### ORDER STATUS CODES:
- **status = 7**: SUCCESS (order/transaction completed successfully)
- **status = 0**: CANCELLED (order/transaction was cancelled)
- **status = 13**: PENDING (order/transaction is being processed)
- **status = 15**: PENDING DISBURSEMENT (payment pending)

**IMPORTANT**: Only count orders/transactions with status = 7 (SUCCESS) for gold balance calculations.
Pending (13, 15) or cancelled (0) orders should NOT be included in balance.

### YOUR TASK:
Synthesize the SQL and ES insights to provide a comprehensive root cause analysis.

IMPORTANT RULES:
- Combine insights from both data sources
- Calculate gold quantities using "quantity" or "gram_weight" fields ONLY
- Provide a clear, definitive root cause
- Support with specific evidence from the insights
- If data is insufficient, explicitly state what's missing
- Be honest about confidence level
- Provide actionable next steps

Respond in valid JSON format:
{{
  "rootCause": "Clear, definitive explanation of what caused the issue",
  "evidence": [
    "Specific evidence point 1 (from SQL or ES)",
    "Specific evidence point 2 (from SQL or ES)",
    "Additional supporting evidence"
  ],
  "explanation": "Detailed technical explanation connecting all insights",
  "confidence": "high|medium|low",
  "dataGaps": [
    "What data is missing (if any)"
  ],
  "nextSteps": [
    "Actionable step 1",
    "Actionable step 2"
  ],
  "affectedEntities": {{
    "customers": [],
    "orders": [],
    "other": []
  }}
}}`);

    // Initialize LLM
    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.3, // Lower temperature for more factual analysis
    });

    // Create chain with JSON output parser
    const parser = new JsonOutputParser();
    const chain = analysisPrompt.pipe(model).pipe(parser);

    // Execute final analysis
    logger.debug('Invoking final analysis LLM...');
    const result = await chain.invoke({
      subject: state.subject,
      body: state.body,
      priority: state.priority || 'unknown',
      category: state.category || 'unknown',
      classificationReasoning: state.classificationReasoning || 'Not classified',
      sqlInsights: sqlInsights,
      esInsights: esInsights
    });

    logger.info('✅ 3-stage analysis completed successfully');
    logger.debug('Analysis result:', JSON.stringify(result, null, 2));

    // Update state with analysis results and insights
    return {
      ...state,
      // AI insights from each stage
      sqlInsights: sqlInsights,
      esInsights: esInsights,
      // Final analysis results
      rootCause: result.rootCause || 'Unable to determine root cause',
      evidence: result.evidence || [],
      explanation: result.explanation || '',
      confidence: result.confidence || 'low',
      dataGaps: result.dataGaps || [],
      nextSteps: result.nextSteps || [],
      affectedEntities: result.affectedEntities || {},
      analysisCompletedAt: new Date().toISOString()
    };

  } catch (error) {
    logger.error('❌ 3-stage analysis failed:', error);
    
    return {
      ...state,
      error: `3-stage analysis failed: ${error.message}`,
      rootCause: 'Analysis failed due to technical error',
      confidence: 'low',
      nextSteps: ['Retry analysis', 'Check logs for details'],
      sqlInsights: 'Analysis failed',
      esInsights: 'Analysis failed'
    };
  }
}

export default analysisNode;

