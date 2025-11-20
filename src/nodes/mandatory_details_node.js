import { logger } from '../utils/logger.js';

/**
 * Extract orderId from text using various patterns
 * @param {string} text - Text to search
 * @returns {string|null} Extracted orderId or null
 */
function extractOrderId(text) {
  if (!text) return null;
  
  // Patterns to match orderId in various formats
  const patterns = [
    /order[_\s]?id[:\s=]+(\d+)/i,
    /order[_\s]?id[:\s=]+([\w-]+)/i,
    /order[:\s=]+(\d+)/i,
    /order[:\s=]+([\w-]+)/i,
    /order\s+(\d+)/i,
    /order\s+([\w-]+)/i,
    /oid[:\s=]+(\d+)/i,
    /oid[:\s=]+([\w-]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Extract customerId from text using various patterns
 * @param {string} text - Text to search
 * @returns {string|null} Extracted customerId or null
 */
function extractCustomerId(text) {
  if (!text) return null;
  
  // Patterns to match customerId in various formats
  const patterns = [
    /customer[_\s]?id[:\s=]+(\d+)/i,
    /customer[_\s]?id[:\s=]+([\w-]+)/i,
    /customer[:\s=]+(\d+)/i,
    /customer[:\s=]+([\w-]+)/i,
    /customer\s+(\d+)/i,
    /customer\s+([\w-]+)/i,
    /cid[:\s=]+(\d+)/i,
    /cid[:\s=]+([\w-]+)/i,
    /user[_\s]?id[:\s=]+(\d+)/i,
    /user[_\s]?id[:\s=]+([\w-]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Mandatory Details Node
 * 
 * This node validates that all required fields are present in the issue request.
 * It checks for mandatory information needed to proceed with debugging.
 * 
 * Required fields:
 * - subject: Issue title (min 5 characters)
 * - body: Issue description (min 20 characters)
 * - metadata.source: Source of the issue
 * 
 * Additional validation:
 * - If orderId is provided in body → details are fine
 * - If orderId is NOT provided → customerId is mandatory
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
  if (!state.body || state.body.trim().length < 10) {
    missingFields.push('body (minimum 10 characters required for proper analysis)');
  }
  
  // Check if metadata exists
  if (!state.metadata || typeof state.metadata !== 'object') {
    missingFields.push('metadata (source information required)');
  } else if (!state.metadata.source) {
    // Check source in metadata
    missingFields.push('metadata.source (e.g., email, slack, chatbot, etc.)');
  }
  
  // Analyze body for orderId and customerId
  const bodyText = state.body || '';
  const combinedText = `${state.subject || ''} ${bodyText}`;
  
  const orderId = extractOrderId(combinedText);
  const customerId = extractCustomerId(combinedText);
  
  logger.info('🔍 Analyzing body for identifiers:', {
    hasOrderId: !!orderId,
    orderId: orderId || 'not found',
    hasCustomerId: !!customerId,
    customerId: customerId || 'not found'
  });
  
  // Validation logic:
  // 1. If orderId is provided → details are fine
  // 2. If orderId is NOT provided → customerId is mandatory
  
  if (!orderId && !customerId) {
    missingFields.push('orderId or customerId (at least one identifier is required in the issue body)');
  } else if (!orderId && customerId) {
    // This is fine - customerId is present when orderId is not
    logger.info('✅ CustomerId found, orderId not required');
  } else if (orderId) {
    // This is fine - orderId is present
    logger.info('✅ OrderId found, details are sufficient');
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
    missingFields,
    extractedOrderId: orderId,
    extractedCustomerId: customerId
  };
}

