/**
 * Kibana Analysis Node (Enhanced with Chronological & API Analysis)
 * 
 * Uses AI to analyze Kibana logs with detailed step-by-step breakdown:
 * - CHRONOLOGICAL TIMELINE: Analyzes logs timestamp-wise to trace event sequence
 * - API CALL TRACKING: Identifies all API calls (internal/external) and their outcomes
 * - ERROR DETECTION: Finds all errors, exceptions, and failure points
 * - REQUEST FLOW: Tracks request_id through entire journey
 * - KNOWLEDGE BASE COMPARISON: Compares actual behavior vs expected business flow
 * - ROOT CAUSE ANALYSIS: Identifies where exactly the process broke
 * 
 * Features:
 * - Logs are sorted chronologically for accurate timeline analysis
 * - API endpoints, status codes, and response times are preserved
 * - Errors and external API failures are highlighted
 * - Database queries and timing issues are tracked
 * - Payment gateway interactions are analyzed
 * 
 * Max logs analyzed: 1000 (chunked into 200-log batches if necessary)
 */

import { PromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { logger } from '../utils/logger.js';

/**
 * Chunk logs into smaller batches for AI analysis
 * 
 * @param {Array} logs - Array of log objects
 * @param {number} chunkSize - Max logs per chunk
 * @returns {Array<Array>} Array of log chunks
 */
function chunkLogs(logs, chunkSize = 200) {
  const chunks = [];
  for (let i = 0; i < logs.length; i += chunkSize) {
    chunks.push(logs.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Format logs for AI analysis (preserves timestamp, API details, errors)
 * 
 * @param {Array} logs - Array of {ts, message} objects
 * @returns {string} Formatted log string with chronological order and API details
 */
function formatLogsForAnalysis(logs) {
  // Sort logs by timestamp for chronological analysis
  const sortedLogs = [...logs].sort((a, b) => {
    const timeA = new Date(a.ts).getTime();
    const timeB = new Date(b.ts).getTime();
    return timeA - timeB;
  });

  return sortedLogs.map((log, idx) => {
    // Try to parse JSON message for better formatting
    try {
      const parsed = JSON.parse(log.message);
      
      // Extract comprehensive details
      const relevant = {
        timestamp: log.ts,
        log_level: parsed.log_level || parsed.level || 'info',
        message: parsed.message || parsed.msg || '',
        request_id: parsed.request_id || parsed.requestId,
        user_id: parsed.user_id || parsed.userId || parsed.customer_id,
        api_endpoint: parsed.url || parsed.endpoint || parsed.path,
        method: parsed.method,
        status_code: parsed.status_code || parsed.statusCode,
        response_time: parsed.response_time || parsed.responseTime,
        error: parsed.error || parsed.errorMessage || parsed.err,
        error_code: parsed.error_code || parsed.errorCode,
        external_api: parsed.external_api || parsed.externalApi,
        db_query: parsed.query || parsed.sql
      };
      
      // Remove undefined/null values for cleaner output
      Object.keys(relevant).forEach(key => {
        if (relevant[key] === undefined || relevant[key] === null) {
          delete relevant[key];
        }
      });
      
      return `[${idx + 1}] ${JSON.stringify(relevant)}`;
    } catch (e) {
      // Not JSON, preserve as is with timestamp
      return `[${idx + 1}] ${log.ts} | ${log.message.substring(0, 600)}`;
    }
  }).join('\n');
}

/**
 * Analyze a chunk of logs with AI
 * 
 * @param {Array} logs - Log chunk
 * @param {string} userQuery - User's issue description
 * @param {string} knowledgeBaseContext - KB context
 * @returns {Promise<string>} AI analysis
 */
async function analyzeLogChunk(logs, userQuery, knowledgeBaseContext) {
  const analysisPrompt = PromptTemplate.fromTemplate(`
You are an expert backend engineer analyzing application logs to diagnose an issue in a Digital Gold platform.

USER ISSUE:
{userQuery}

KNOWLEDGE BASE CONTEXT (Expected Business Flow & Behavior):
{knowledgeBaseContext}

Use this knowledge base to understand what SHOULD happen and identify where actual behavior deviates.

APPLICATION LOGS ({logCount} logs):
{logs}

YOUR TASK:
Analyze these logs chronologically (timestamp-wise) and provide a detailed step-by-step breakdown of what actually happened.

ANALYSIS STEPS:
1. <strong>Chronological Timeline</strong>: Sort events by timestamp and trace the flow
2. <strong>API Call Tracking</strong>: Identify all API calls made (internal/external)
   - Which APIs were called?
   - What were the request/response payloads?
   - Which APIs failed and why?
3. <strong>Request Flow Tracing</strong>: Follow request_id through the entire journey
4. <strong>Error Detection</strong>: Identify all errors, exceptions, and failure points
5. <strong>Expected vs Actual Behavior</strong>: Compare logs against knowledge base expectations
6. <strong>Root Cause Identification</strong>: Where exactly did the process break?

SPECIFIC THINGS TO LOOK FOR:
- <strong>Errors & Exceptions</strong>: Any error messages, stack traces, or exceptions
- <strong>API Failures</strong>: External API calls that failed (payment gateway, merchant API, etc.)
- <strong>Database Issues</strong>: SQL errors, connection issues, query failures
- <strong>Status Codes</strong>: HTTP error codes (4xx for client errors, 5xx for server errors)
- <strong>Timing Issues</strong>: Timeouts, slow queries, delays
- <strong>Business Logic Errors</strong>: Failed validations, incorrect state transitions
- <strong>Payment Issues</strong>: Payment collection failures, gateway errors
- <strong>Order Status Changes</strong>: Track status transitions (pending → success/failed)

<strong>FORMATTING INSTRUCTION</strong>: In your response, use HTML tags for emphasis (e.g., <strong>bold</strong>, <em>italic</em>, <code>code</code>). DO NOT use markdown syntax like **bold** or *italic*. The formatter understands HTML, not markdown.

OUTPUT FORMAT:
Provide a detailed step-by-step analysis:

<strong>1. Chronological Flow (What Actually Happened):</strong>
- [Timestamp 1] First event: ...
- [Timestamp 2] API call to X: ...
- [Timestamp 3] Response received: ...
- [Timestamp 4] Error occurred: ...
(Continue chronologically through the entire flow)

<strong>2. API Calls Made:</strong>
- API 1: [endpoint] - Status: [success/failed] - Details: ...
- API 2: [endpoint] - Status: [success/failed] - Details: ...

<strong>3. Errors & Failures:</strong>
- Error 1: [description] at [timestamp]
- Error 2: [description] at [timestamp]

<strong>4. Request IDs Involved:</strong>
- request_id: [id] - Status: [success/failed]

<strong>5. Comparison with Expected Behavior:</strong>
- Expected (from KB): ...
- Actual (from logs): ...
- Deviation: ...

<strong>6. Root Cause:</strong>
- Primary issue: ...
- Evidence: ...
`);

  const model = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.2, // Low temperature for factual analysis
    apiKey: process.env.OPENAI_API_KEY
  });

  const chain = analysisPrompt.pipe(model).pipe(new StringOutputParser());

  try {
    const formattedLogs = formatLogsForAnalysis(logs);
    
    const result = await chain.invoke({
      userQuery: userQuery,
      knowledgeBaseContext: knowledgeBaseContext || 'No knowledge base context available.',
      logCount: logs.length,
      logs: formattedLogs
    });

    return result;
  } catch (error) {
    logger.error('Log chunk analysis failed:', error.message);
    return `Error analyzing logs: ${error.message}`;
  }
}

/**
 * Synthesize insights from multiple chunk analyses
 * 
 * @param {Array<string>} chunkAnalyses - Analyses from each chunk
 * @param {string} userQuery - User's issue description
 * @returns {Promise<string>} Synthesized insights
 */
async function synthesizeLogInsights(chunkAnalyses, userQuery) {
  if (chunkAnalyses.length === 1) {
    return chunkAnalyses[0]; // No synthesis needed for single chunk
  }

  const synthesisPrompt = PromptTemplate.fromTemplate(`
You are synthesizing multiple log analysis results into a single coherent, chronological diagnosis.

USER ISSUE:
{userQuery}

LOG ANALYSES (from {chunkCount} chunks):
{analyses}

YOUR TASK:
Combine these chunk analyses into a single, comprehensive step-by-step breakdown:

1. <strong>Merge Chronological Timeline</strong>: Combine events from all chunks in timestamp order
2. <strong>Consolidate API Calls</strong>: List all unique API calls made across chunks
3. <strong>Deduplicate Errors</strong>: Remove duplicate error reports, keep unique failures
4. <strong>Trace Complete Request Flow</strong>: Follow request_ids across all chunks
5. <strong>Identify Root Cause</strong>: Synthesize the main failure point from all evidence

<strong>FORMATTING INSTRUCTION</strong>: In your response, use HTML tags for emphasis (e.g., <strong>bold</strong>, <em>italic</em>, <code>code</code>). DO NOT use markdown syntax like **bold** or *italic*. The formatter understands HTML, not markdown.

OUTPUT FORMAT:
Provide a comprehensive step-by-step analysis:

<strong>1. Complete Chronological Flow (Merged from all chunks):</strong>
- [Timestamp] Event 1: ...
- [Timestamp] Event 2: ...
- [Timestamp] Event 3: ...
(Complete timeline across all log chunks)

<strong>2. All API Calls Made:</strong>
- API 1: [endpoint] - Status: [success/failed] - Details: ...
- API 2: [endpoint] - Status: [success/failed] - Details: ...

<strong>3. All Errors & Failures Detected:</strong>
- Error 1: [description] at [timestamp]
- Error 2: [description] at [timestamp]

<strong>4. Request IDs Tracked:</strong>
- request_id: [id] - Journey: ... - Final Status: ...

<strong>5. Root Cause Analysis:</strong>
- Primary failure: ...
- Supporting evidence: ...
- Where process broke: ...

<strong>6. Key Findings:</strong>
- Finding 1: ...
- Finding 2: ...
`);

  const model = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.1,
    apiKey: process.env.OPENAI_API_KEY
  });

  const chain = synthesisPrompt.pipe(model).pipe(new StringOutputParser());

  try {
    const result = await chain.invoke({
      userQuery: userQuery,
      chunkCount: chunkAnalyses.length,
      analyses: chunkAnalyses.map((analysis, idx) => 
        `### Chunk ${idx + 1} Analysis:\n${analysis}`
      ).join('\n\n---\n\n')
    });

    return result;
  } catch (error) {
    logger.error('Log synthesis failed:', error.message);
    return `Error synthesizing logs: ${error.message}\n\n${chunkAnalyses.join('\n\n---\n\n')}`;
  }
}

/**
 * Kibana Analysis Node
 * 
 * Analyzes Kibana logs with AI to extract insights
 * 
 * @param {Object} state - Current workflow state
 * @returns {Promise<Object>} Updated state with log insights
 */
export async function kibanaAnalysisNode(state) {
  logger.info('🔬 Executing kibana_analysis_node');

  // Skip if no logs fetched
  if (!state.kibanaLogs || state.kibanaLogs.length === 0) {
    logger.info('ℹ️  No Kibana logs to analyze, skipping');
    return {
      ...state,
      kibanaInsights: 'No logs available for analysis.'
    };
  }

  try {
    const userQuery = `${state.subject}\n${state.body}`;
    const logs = state.kibanaLogs;
    
    logger.info(`📊 Analyzing ${logs.length} logs (chronologically & API-wise)...`);
    logger.info('   - Tracing timeline of events');
    logger.info('   - Tracking API calls and responses');
    logger.info('   - Comparing with knowledge base expectations');
    logger.info('   - Identifying root cause step-by-step');

    // Chunk logs if more than 200
    if (logs.length > 200) {
      logger.info(`   Splitting into chunks (max 200 logs per chunk for detailed analysis)...`);
      
      const chunks = chunkLogs(logs, 200);
      logger.info(`   Created ${chunks.length} chunks`);

      // Analyze each chunk
      const chunkAnalyses = [];
      for (let i = 0; i < chunks.length; i++) {
        logger.info(`   Analyzing chunk ${i + 1}/${chunks.length}...`);
        
        const analysis = await analyzeLogChunk(
          chunks[i],
          userQuery,
          state.knowledgeBaseContext
        );
        
        chunkAnalyses.push(analysis);
      }

      // Synthesize all chunk analyses
      logger.info('   Synthesizing insights from all chunks...');
      const synthesizedInsights = await synthesizeLogInsights(chunkAnalyses, userQuery);

      logger.info('✅ Log analysis completed (multi-chunk)');
      
      return {
        ...state,
        kibanaInsights: synthesizedInsights
      };
    } else {
      // Single chunk analysis
      logger.info('   Analyzing logs in single batch...');
      
      const insights = await analyzeLogChunk(
        logs,
        userQuery,
        state.knowledgeBaseContext
      );

      logger.info('✅ Log analysis completed (single-chunk)', { insights });
      
      return {
        ...state,
        kibanaInsights: insights
      };
    }

  } catch (error) {
    logger.error('❌ Error in kibana_analysis_node:', error);

    return {
      ...state,
      kibanaInsights: `Log analysis failed: ${error.message}`
    };
  }
}

export default kibanaAnalysisNode;

