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
 * Extract mobile/phone number from text using various patterns
 * @param {string} text - Text to search
 * @returns {string|null} Extracted phone number or null
 */
function extractPhoneNumber(text) {
  if (!text) return null;
  
  // Patterns to match phone numbers in various formats
  // Indian phone numbers: 10 digits, may have +91, spaces, dashes, etc.
  const patterns = [
    // With labels: mobile, phone, contact, etc.
    /(?:mobile|phone|contact|mob|tel)[\s:]+(?:\+91[\s-]?)?(\d{10})/i,
    /(?:mobile|phone|contact|mob|tel)[\s:]+(?:\+91[\s-]?)?(\d{3}[\s-]?\d{3}[\s-]?\d{4})/i,
    // Direct 10-digit numbers (with country code)
    /\+91[\s-]?(\d{10})/,
    /\+91[\s-]?(\d{3}[\s-]?\d{3}[\s-]?\d{4})/,
    // 10-digit numbers with separators
    /(\d{3}[\s-]?\d{3}[\s-]?\d{4})/,
    // Plain 10-digit numbers (be careful not to match orderId/customerId)
    // Only match if it's clearly a phone number context
    /(?:mobile|phone|contact|mob|tel|number)[\s:]+(\d{10})/i
  ];
  
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) {
      // Clean the extracted number (remove spaces and dashes)
      const cleaned = match[1].replaceAll(' ', '').replaceAll('-', '');
      // Validate it's 10 digits
      if (/^\d{10}$/.test(cleaned)) {
        return cleaned;
      }
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
 * - If mobile/phone number is provided → details are fine
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
  
  // Analyze body for orderId, customerId, and phone number
  const bodyText = state.body || '';
  const combinedText = `${state.subject || ''} ${bodyText}`;
  
  const orderId = extractOrderId(combinedText);
  const customerId = extractCustomerId(combinedText);
  const phoneNumber = extractPhoneNumber(combinedText);
  
  logger.info('🔍 Analyzing body for identifiers:', {
    hasOrderId: !!orderId,
    orderId: orderId || 'not found',
    hasCustomerId: !!customerId,
    customerId: customerId || 'not found',
    hasPhoneNumber: !!phoneNumber,
    phoneNumber: phoneNumber || 'not found'
  });
  
  // Validation logic:
  // 1. If orderId is provided → details are fine
  // 2. If orderId is NOT provided → customerId is mandatory
  // 3. If mobile/phone number is provided → details are fine
  
  if (!orderId && !customerId && !phoneNumber) {
    missingFields.push('orderId, customerId, or mobile/phone number (at least one identifier is required in the issue body)');
  } else if (orderId) {
    // This is fine - orderId is present
    logger.info('✅ OrderId found, details are sufficient');
  } else if (customerId) {
    // This is fine - customerId is present when orderId is not
    logger.info('✅ CustomerId found, orderId not required');
  } else if (phoneNumber) {
    // This is fine - phone number is present
    logger.info('✅ Phone number found, details are sufficient');
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
    extractedCustomerId: customerId,
    extractedPhoneNumber: phoneNumber
  };
}

