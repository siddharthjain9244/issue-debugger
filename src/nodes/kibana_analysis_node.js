/**
 * Kibana Analysis Node
 * 
 * Uses AI to analyze Kibana logs and extract insights:
 * - Error patterns and exceptions
 * - Request/response flows
 * - Timing issues and timeouts
 * - API failures
 * - Database query issues
 * - Payment gateway errors
 * 
 * Max logs analyzed: 1000 (chunked if necessary)
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
 * Format logs for AI analysis
 * 
 * @param {Array} logs - Array of {ts, message} objects
 * @returns {string} Formatted log string
 */
function formatLogsForAnalysis(logs) {
  return logs.map((log, idx) => {
    // Try to parse JSON message for better formatting
    try {
      const parsed = JSON.parse(log.message);
      const relevant = {
        time: log.ts,
        level: parsed.log_level || 'info',
        message: parsed.message || '',
        request_id: parsed.request_id,
        user_id: parsed.user_id,
        status_code: parsed.status_code,
        error: parsed.error || parsed.errorMessage
      };
      return `[${idx + 1}] ${JSON.stringify(relevant)}`;
    } catch (e) {
      // Not JSON, use as is
      return `[${idx + 1}] ${log.ts} | ${log.message.substring(0, 500)}`;
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
You are an expert backend engineer analyzing application logs to diagnose an issue.

USER ISSUE:
{userQuery}

KNOWLEDGE BASE CONTEXT (Expected Behavior):
{knowledgeBaseContext}

APPLICATION LOGS ({logCount} logs):
{logs}

YOUR TASK:
Analyze these logs and identify:
1. **Errors & Exceptions**: Any error messages, stack traces, or exceptions
2. **Request Flow**: Track request_id through the logs, identify where it fails
3. **Timing Issues**: Timeouts, slow queries, delays
4. **API Failures**: External API calls that failed (payment, merchant, etc.)
5. **Database Issues**: SQL errors, connection issues, query failures
6. **Status Codes**: HTTP error codes (4xx, 5xx)
7. **Patterns**: Repeated errors, cascading failures

Focus on logs RELEVANT to the user's issue. Ignore normal INFO logs unless they provide context.

<strong>FORMATTING INSTRUCTION</strong>: In your response, use HTML tags for emphasis (e.g., <strong>bold</strong>, <em>italic</em>, <code>code</code>). DO NOT use markdown syntax like **bold** or *italic*. The formatter understands HTML, not markdown.

OUTPUT FORMAT:
Provide a concise analysis (5-10 bullet points max):
- What errors occurred?
- Which request_id(s) failed?
- What was the sequence of events?
- Where did the process fail?
- Any timeouts or external API issues?
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
You are synthesizing multiple log analysis results into a single coherent diagnosis.

USER ISSUE:
{userQuery}

LOG ANALYSES (from {chunkCount} chunks):
{analyses}

YOUR TASK:
Combine these analyses into a single, coherent summary:
1. Remove duplicates
2. Identify the main error/failure pattern
3. Trace the sequence of events across chunks
4. Highlight the root cause
5. List key request_ids involved

<strong>FORMATTING INSTRUCTION</strong>: In your response, use HTML tags for emphasis (e.g., <strong>bold</strong>, <em>italic</em>). DO NOT use markdown syntax like **bold** or *italic*. The formatter understands HTML, not markdown.

OUTPUT FORMAT:
Concise summary (7-10 bullet points):
- Main error/failure identified
- Request IDs involved
- Sequence of events
- Root cause
- Key evidence from logs
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
    
    logger.info(`📊 Analyzing ${logs.length} logs...`);

    // Chunk logs if more than 200
    if (logs.length > 200) {
      logger.info(`   Splitting into chunks (max 200 logs per chunk)...`);
      
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

      logger.info('✅ Log analysis completed (single-chunk)');
      
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

