import { logger } from '../utils/logger.js';

/**
 * Mandatory Details Node
 * 
 * This node validates that all required fields are present in the issue request.
 * It checks for mandatory information needed to proceed with debugging.
 * 
 * Required fields:
 * - subject: Issue title (min 5 characters)
 * - body: Issue description (min 20 characters)
 * 
 * @param {Object} state - Current state of the workflow
 * @returns {Object} Updated state with validation results
 */
export async function mandatoryDetailsNode(state) {
  logger.info('📋 Executing mandatory_details_node');
  
  const missingFields = [];
  
  // Check subject
  if (!state.subject || state.subject.trim().length < 5) {
    missingFields.push('subject (minimum 5 characters required)');
  }
  
  // Check body
  if (!state.body || state.body.trim().length < 20) {
    missingFields.push('body (minimum 20 characters required for proper analysis)');
  }
  
  // Check if metadata exists
  if (!state.metadata || typeof state.metadata !== 'object') {
    missingFields.push('metadata (source information required)');
  } else {
    // Check source in metadata
    if (!state.metadata.source) {
      missingFields.push('metadata.source (e.g., email, slack, chatbot, etc.)');
    }
  }
  
  const hasRequiredFields = missingFields.length === 0;
  
  if (hasRequiredFields) {
    logger.info('✅ All mandatory fields are present');
  } else {
    logger.warn('❌ Missing required fields:', missingFields);
  }
  
  return {
    ...state,
    hasRequiredFields,
    missingFields
  };
}

