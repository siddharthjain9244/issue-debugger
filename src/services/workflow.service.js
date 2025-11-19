import { StateGraph, END } from '@langchain/langgraph';
import { logger } from '../utils/logger.js';
import { createInitialState } from '../types/state.js';
import { mandatoryDetailsNode } from '../nodes/mandatory_details_node.js';
import { classifyIssueNode } from '../nodes/classify_issue_node.js';

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
      sqlData: null,
      lokiData: null,
      esData: null,
      redisData: null,
      correlatedData: null,
      rootCause: null,
      evidence: null,
      recommendedActions: null,
      automatableCommands: null,
      error: null
    }
  });

  // Add nodes to the workflow
  workflow.addNode('mandatory_details', mandatoryDetailsNode);
  workflow.addNode('classify_issue', classifyIssueNode);
  
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
  
  // classify_issue -> END (for now, will add more nodes later)
  workflow.addEdge('classify_issue', END);
  
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

