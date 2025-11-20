/**
 * State interface for the LangGraph workflow
 * This state object is passed between all nodes in the graph
 */

/**
 * @typedef {Object} IssueState
 * @property {string} subject - Issue subject/title
 * @property {string} body - Detailed issue description
 * @property {Object} metadata - Additional metadata about the issue
 * @property {string} metadata.source - Source of the issue (email, slack, etc)
 * @property {string} [metadata.priority] - Initial priority if provided
 * @property {boolean} hasRequiredFields - Whether all mandatory fields are present
 * @property {string[]} missingFields - List of missing required fields
 * @property {string} issueType - Type of issue (real_issue|normal_mail)
 * @property {string} issueTypeReasoning - Reasoning for issue type classification
 * @property {string} [flowType] - Business flow type (buy|sell|kyc|customer_portfolio|sip_create|sip_debit|merchant_product_maintenance|other)
 * @property {string} [flowTypeReasoning] - Reasoning for flow type classification
 * @property {string} priority - Classified priority (low|medium|high|critical)
 * @property {string} category - Issue category (database|api|frontend|backend|network|other)
 * @property {string[]} dataSourcesToQuery - List of data sources to query (sql|loki|es|redis)
 * @property {Object} sqlData - Data extracted from SQL database
 * @property {Object} lokiData - Data extracted from Loki logs
 * @property {Object} esData - Data extracted from Elasticsearch
 * @property {Object} redisData - Data extracted from Redis
 * @property {string} correlatedData - Combined and correlated data from all sources
 * @property {string} rootCause - AI-generated root cause analysis
 * @property {string} evidence - Supporting evidence for the analysis
 * @property {string[]} recommendedActions - List of recommended fixes
 * @property {string[]} automatableCommands - Commands that can be executed automatically
 * @property {string} error - Any error that occurred during processing
 */

export const createInitialState = (subject, body, metadata) => {
  return {
    subject: subject || '',
    body: body || '',
    metadata: metadata || {},
    hasRequiredFields: false,
    missingFields: [],
    issueType: '',
    issueTypeReasoning: '',
    flowType: null,
    flowTypeReasoning: '',
    priority: '',
    category: '',
    classificationReasoning: '',
    dataSourcesToQuery: [],
    sqlData: null,
    lokiData: null,
    esData: null,
    redisData: null,
    correlatedData: '',
    // Knowledge base context
    knowledgeBaseContext: null,
    knowledgeBaseSources: [],
    // AI-generated insights from data
    sqlInsights: '',
    esInsights: '',
    // Final analysis fields
    rootCause: '',
    evidence: [],
    explanation: '',
    confidence: '',
    dataGaps: [],
    nextSteps: [],
    affectedEntities: {},
    analysisCompletedAt: '',
    // Legacy fields (keeping for compatibility)
    recommendedActions: [],
    automatableCommands: [],
    error: ''
  };
};

