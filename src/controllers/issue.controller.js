import { logger } from '../utils/logger.js';
import { executeWorkflow } from '../services/workflow.service.js';

/**
 * Controller for handling issue debugging requests
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function debugIssue(req, res) {
  try {
    const { subject, body, metadata,messageId,threadId } = req.body;

    logger.info('📥 Received debug issue request', {
      subject,
      bodyLength: body?.length || 0,
      metadata
    });

    // Execute the LangGraph workflow
    const result = await executeWorkflow(subject, body, metadata);

    // Check if AI identifier extraction failed (no identifiers found)
    if (!result.hasAnyIdentifier) {
      return res.status(400).json({
        status: 'error',
        message: 'No identifiers found in the query',
        detail: 'At least one identifier required: order_id, customer_id, phone_number, imps_track_id, digio_txn_id, account_number, mmtc_order_id, predebit_reference_id, or subscription_id',
        extractedIdentifiers: result.aiExtractedIdentifiers,
        aiExtractionError: result.aiExtractionError,
        data: result,
        messageId,
        threadId
      });
    }

    // Return successful analysis
    res.status(200).json({
      status: 'success',
      message: 'Issue analyzed successfully',
      data: {
        subject: result.subject,
        body: result.body,
        metadata: result.metadata,
        messageId,
        threadId,
        extractedIdentifiers: {
          identifiers: result.aiExtractedIdentifiers || {},
          foundCount: result.foundIdentifiersCount || 0,
          found: result.foundIdentifiers || []
        },
        classification: {
          issueType: result.issueType,
          issueTypeReasoning: result.issueTypeReasoning,
          flowType: result.flowType,
          flowTypeReasoning: result.flowTypeReasoning,
          priority: result.priority,
          category: result.category,
          reasoning: result.classificationReasoning
        },
        knowledgeBase: {
          retrieved: result.knowledgeBaseSources?.length > 0 || false,
          sources: result.knowledgeBaseSources || [],
          contextAvailable: !!result.knowledgeBaseContext
        },
        // queryPlan: {
        //   dataSources: result.dataSourcesToQuery || [],
        //   reasoning: result.queryPlanReasoning,
        //   expectedFindings: result.expectedFindings
        // },
        sqlAnalysis: result.sqlQuery ? {
          queries: Array.isArray(result.sqlQuery) ? result.sqlQuery : [result.sqlQuery],
          queryCount: Array.isArray(result.sqlQuery) ? result.sqlQuery.length : 1,
          explanation: result.sqlExplanation,
          tablesUsed: result.sqlTablesUsed,
          relevantTablesFound: result.relevantTablesFound,
          // Include execution results
          executed: result.sqlData?.success || false,
          rowCount: result.sqlData?.rowCount || result.sqlData?.totalRows || 0,
          tablesQueried: result.sqlData?.tablesQueried || [],
          // Show preview of data (first 3 rows overall)
          // dataPreview: result.sqlData?.rows?.slice(0, 3).map(row => {
          //   const { _sourceTable, ...data } = row;
          //   return { ...data, _from: _sourceTable };
          // }) || [],
          // Show data grouped by table (first 2 rows per table)
          // dataByTable: result.sqlData?.rowsByTable ? 
          //   Object.entries(result.sqlData.rowsByTable).reduce((acc, [table, rows]) => {
          //     acc[table] = rows.slice(0, 2).map(row => {
          //       const { _sourceTable, ...data } = row;
          //       return data;
          //     });
          //     return acc;
          //   }, {}) : {}
        } : null,
        esAnalysis: result.esQuery ? {
          queries: Array.isArray(result.esQuery) ? result.esQuery : [result.esQuery],
          queryCount: Array.isArray(result.esQuery) ? result.esQuery.length : 1,
          explanation: result.esExplanation,
          executed: result.esData?.success || false,
          total: result.esData?.total || 0,
          documentsFound: result.esData?.documentsFound || 0,
          documents: result.esData?.documents?.slice(0, 5) || [], // Preview first 5 docs
          skipped: result.esData?.skipped || false,
          error: result.esData?.error || null
        } : null,
        kibanaLogs: result.kibanaLogs ? {
          logCount: result.kibanaLogCount || 0,
          queryStrategies: result.kibanaQueryDetails || [],
          skipped: result.kibanaSkipped || false,
          error: result.kibanaError || null,
          // Show preview of first 5 logs
          logsPreview: result.kibanaLogs.slice(0, 5),
          insights: result.kibanaInsights
        } : {
          skipped: true,
          reason: result.kibanaError || 'Kibana not configured'
        },
        analysis: {
          // AI-generated insights from each data source
          sqlInsights: result.sqlInsights || 'No SQL insights generated',
          esInsights: result.esInsights || 'No ES insights generated',
          kibanaInsights: result.kibanaInsights || 'No log insights generated',
          // Final analysis
          rootCause: result.rootCause || 'Analysis not completed',
          evidence: result.evidence || [],
          explanation: result.explanation || '',
          confidence: result.confidence || 'unknown',
          dataGaps: result.dataGaps || [],
          nextSteps: result.nextSteps || [],
          affectedEntities: result.affectedEntities || {},
          // Token usage tracking
          // tokenUsage: result.tokenUsage || {
          //   sqlAnalysis: 0,
          //   esAnalysis: 0,
          //   finalAnalysis: 0,
          //   total: 0
          // },
          completedAt: result.analysisCompletedAt || new Date().toISOString()
        },
        processedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('❌ Error in debugIssue controller:', error);
    res.status(500).json({
      status: 'error',
      error: 'Internal Server Error',
      message: error.message || 'Failed to process issue'
    });
  }
}

