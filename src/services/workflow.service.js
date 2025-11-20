import { StateGraph, END } from '@langchain/langgraph';
import { logger } from '../utils/logger.js';
import { createInitialState } from '../types/state.js';
import { mandatoryDetailsNode } from '../nodes/mandatory_details_node.js';
import { classifyIssueNode } from '../nodes/classify_issue_node.js';
import { knowledgeRetrievalNode } from '../nodes/knowledge_retrieval_node.js';
// import { queryPlannerNode } from '../nodes/query_planner_node.js'; // TODO: Will use later
import { sqlQueryNode } from '../nodes/sql_query_node.js';
import { sqlExecutorNode } from '../nodes/sql_executor_node.js';
import { esQueryNode } from '../nodes/es_query_node.js';
import { esExecutorNode } from '../nodes/es_executor_node.js';
import { kibanaQueryNode } from '../nodes/kibana_query_node.js';
import { kibanaAnalysisNode } from '../nodes/kibana_analysis_node.js';
import { analysisNode } from '../nodes/analysis_node.js';

/**
 * Workflow Service
 * 
 * This service creates and manages the LangGraph workflow for issue debugging.
 * It orchestrates the flow between different nodes based on the state.
 */

/**
 * Creates the issue debugging workflow graph
 * 
 * @returns {CompiledGraph} Compiled LangGraph workflow
 */
export function createWorkflow() {
  logger.info('🔧 Creating LangGraph workflow');
  
  // Define the state graph
  const workflow = new StateGraph({
    channels: {
      subject: null,
      body: null,
      metadata: null,
      hasRequiredFields: null,
      missingFields: null,
      priority: null,
      category: null,
      classificationReasoning: null,
      dataSourcesToQuery: null,
      queryPlanReasoning: null,
      expectedFindings: null,
      sqlQuery: null,
      sqlExplanation: null,
      sqlTablesUsed: null,
      relevantTablesFound: null,
      sqlData: null,
      needsESQuery: null,
      esQuery: null,
      esReasoning: null,
      esData: null,
      lokiData: null,
      redisData: null,
      correlatedData: null,
      // Knowledge base context
      knowledgeBaseContext: null,
      knowledgeBaseSources: null,
      // Kibana logs
      kibanaLogs: null,
      kibanaLogCount: null,
      kibanaQueryDetails: null,
      kibanaSkipped: null,
      kibanaError: null,
      kibanaInsights: null,
      // AI-generated insights
      sqlInsights: null,
      esInsights: null,
      // Analysis results
      rootCause: null,
      evidence: null,
      explanation: null,
      confidence: null,
      dataGaps: null,
      nextSteps: null,
      affectedEntities: null,
      analysisCompletedAt: null,
      // Legacy
      recommendedActions: null,
      automatableCommands: null,
      error: null,
      flowTypeReasoning: null,
      issueTypeReasoning: null,
      flowType: null,
      issueType: null,
    }
  });

  // Add nodes to the workflow
  workflow.addNode('mandatory_details', mandatoryDetailsNode);
  workflow.addNode('classify_issue', classifyIssueNode);
  workflow.addNode('knowledge_retrieval', knowledgeRetrievalNode);
  // workflow.addNode('query_planner', queryPlannerNode); // TODO: Uncomment later
  workflow.addNode('sql_query', sqlQueryNode);
  workflow.addNode('sql_executor', sqlExecutorNode);
  workflow.addNode('es_query', esQueryNode);
  workflow.addNode('es_executor', esExecutorNode);
  workflow.addNode('kibana_query', kibanaQueryNode);
  workflow.addNode('kibana_analysis', kibanaAnalysisNode);
  workflow.addNode('analysis', analysisNode);
  
  // Define the workflow edges
  // Start -> mandatory_details
  workflow.addEdge('__start__', 'mandatory_details');
  
  // mandatory_details -> classify_issue (if fields are valid)
  // mandatory_details -> END (if fields are missing)
  workflow.addConditionalEdges(
    'mandatory_details',
    (state) => {
      if (state.hasRequiredFields) {
        return 'classify_issue';
      }
      return END;
    }
  );
  
  // classify_issue -> knowledge_retrieval (retrieve relevant documentation)
  workflow.addEdge('classify_issue', 'knowledge_retrieval');
  
  // knowledge_retrieval -> sql_query (proceed with data collection)
  workflow.addEdge('knowledge_retrieval', 'sql_query');
  
  // TODO: Later add query_planner between knowledge_retrieval and sql_query
  
  // COMMENTED OUT: query_planner flow (will use later)
  // workflow.addEdge('classify_issue', 'query_planner');
  // workflow.addConditionalEdges(
  //   'query_planner',
  //   (state) => {
  //     if (state.dataSourcesToQuery && state.dataSourcesToQuery.includes('sql')) {
  //       return 'sql_query';
  //     }
  //     return END;
  //   }
  // );
  
  // sql_query -> sql_executor (execute the SQL queries)
  workflow.addEdge('sql_query', 'sql_executor');
  
  // sql_executor -> es_query (use SQL data to inform ES query)
  workflow.addEdge('sql_executor', 'es_query');
  
  // es_query -> es_executor (if ES query needed) OR kibana_query (skip ES)
  workflow.addConditionalEdges(
    'es_query',
    (state) => {
      if (state.needsESQuery && state.esQuery) {
        return 'es_executor';
      }
      // Skip ES and go directly to Kibana
      return 'kibana_query';
    }
  );
  
  // es_executor -> kibana_query (fetch logs after ES data)
  workflow.addEdge('es_executor', 'kibana_query');
  
  // kibana_query -> kibana_analysis (analyze fetched logs with AI)
  workflow.addEdge('kibana_query', 'kibana_analysis');
  
  // kibana_analysis -> analysis (final analysis with all data + log insights)
  workflow.addEdge('kibana_analysis', 'analysis');
  
  // analysis -> END (final node)
  workflow.addEdge('analysis', END);
  
  // Set the entry point
  workflow.setEntryPoint('mandatory_details');
  
  // Compile the workflow
  const app = workflow.compile();
  
  logger.info('✅ Workflow created successfully');
  
  return app;
}

/**
 * Executes the issue debugging workflow
 * 
 * @param {string} subject - Issue subject
 * @param {string} body - Issue description
 * @param {Object} metadata - Issue metadata
 * @returns {Promise<Object>} Final state after workflow execution
 */
export async function executeWorkflow(subject, body, metadata) {
  logger.info('🚀 Starting workflow execution');
  
  try {
    // All services (MySQL, ES, Vector Store) are initialized on server startup
    // Just create the initial state and execute the workflow
    
    // Create initial state
    const initialState = createInitialState(subject, body, metadata);
    
    // Create and execute workflow
    const app = createWorkflow();
    
    // Run the workflow
    const finalState = await app.invoke(initialState);
    
    logger.info('✅ Workflow completed successfully');
    
    return finalState;
    
  } catch (error) {
    logger.error('❌ Workflow execution failed:', error);
    throw error;
  }
}

