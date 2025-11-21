import { logger } from '../utils/logger.js';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

/**
 * Mandatory Details Node (AI-Powered)
 * 
 * Uses AI to intelligently extract identifiers from user queries.
 * More flexible than regex patterns - handles naming variations and context.
 * 
 * Required: At least ONE of these identifiers must be present:
 * - order_id (or orderId, order-id, Order ID, etc.)
 * - customer_id (or customerId, customer-id, Customer ID, cust_id, etc.)
 * - phone_number (or phoneNumber, mobile, phone, contact, etc.)
 * - imps_track_id (or impsTrackId, IMPS Track ID, imps-track-id, etc.)
 * - digio_txn_id (or digioTxnId, digio-txn-id, Digio Transaction ID, etc.)
 * - account_number (or accountNumber, account-number, Account Number, bank account, etc.)
 * - mmtc_order_id (or mmtcOrderId, MMTC Order ID, mmtc-order-id, etc.)
 * - predebit_reference_id (or predebitReferenceId, predebit-reference-id, etc.)
 * - subscription_id (or subscriptionId, subscription-id, Subscription ID, SIP ID, etc.)
 * 
 * @param {Object} state - Current state of the workflow
 * @returns {Promise<Object>} Updated state with AI-extracted identifiers
 */
export async function mandatoryDetailsNodeUsingAi(state) {
  logger.info('🤖 Executing mandatory_details_node_ai (AI-powered)');

  try {
    // Build combined text from subject and body
    const combinedText = `${state.subject || ''}\n${state.body || ''}`;

    if (!combinedText.trim()) {
      logger.error('❌ No text content to analyze');
      return {
        ...state,
        aiExtractedIdentifiers: {},
        hasAnyIdentifier: false,
        aiExtractionError: 'No text content available for analysis'
      };
    }

    // AI prompt for identifier extraction
    const extractionPrompt = PromptTemplate.fromTemplate(`
You are an expert at extracting identifiers from technical support queries.

USER QUERY:
{userQuery}

YOUR TASK:
Extract ALL identifiers present in the text above. Look for these types of identifiers (be flexible with naming):

1. **order_id**: Order ID, orderId, order-id, Order Number, order #, OID
2. **customer_id**: Customer ID, customerId, customer-id, cust_id, custId, user_id, userId, CID
3. **phone_number**: Phone, Mobile, Contact Number, phone number, mobile number (10 digits, may have +91)
4. **imps_track_id**: IMPS Track ID, impsTrackId, imps-track-id, IMPS reference
5. **digio_txn_id**: Digio Transaction ID, digioTxnId, digio-txn-id, Digio TXN
6. **account_number**: Account Number, accountNumber, account-number, Bank Account, A/C Number
7. **mmtc_order_id**: MMTC Order ID, mmtcOrderId, mmtc-order-id, MMTC Order Number
8. **predebit_reference_id**: Predebit Reference ID, predebitReferenceId, predebit-reference-id, Pre-debit Ref
9. **subscription_id**: Subscription ID, subscriptionId, subscription-id, SIP ID, sipId, sip-id

RULES:
- Be flexible with naming (camelCase, snake_case, kebab-case, spaces, etc.)
- Extract the VALUE(S), not just detect presence
- If a type of identifier is NOT found, set it to null
- **IMPORTANT**: If MULTIPLE IDs of the same type are found, return them as an array (e.g., ["123", "456"])
- If only ONE ID is found, return it as a string (e.g., "123")
- Look in both subject and body
- Be intelligent about context (e.g., "customer 1234567" means customer_id = 1234567)
- Phone numbers: 10 digits (with or without +91)

OUTPUT FORMAT (JSON only, NO extra text):
{{
  "order_id": "value" or ["value1", "value2"] or null,
  "customer_id": "value" or ["value1", "value2"] or null,
  "phone_number": "value" or ["value1", "value2"] or null,
  "imps_track_id": "value" or null,
  "digio_txn_id": "value" or null,
  "account_number": "value" or null,
  "mmtc_order_id": "value" or null,
  "predebit_reference_id": "value" or null,
  "subscription_id": "value" or ["value1", "value2"] or null
}}

EXAMPLES:

Example 1:
Input: "Order 26239393423 is stuck in pending"
Output: {{"order_id": "26239393423", "customer_id": null, "phone_number": null, "imps_track_id": null, "digio_txn_id": null, "account_number": null, "mmtc_order_id": null, "predebit_reference_id": null, "subscription_id": null}}

Example 2:
Input: "Customer ID 1001656012 balance is wrong"
Output: {{"order_id": null, "customer_id": "1001656012", "phone_number": null, "imps_track_id": null, "digio_txn_id": null, "account_number": null, "mmtc_order_id": null, "predebit_reference_id": null, "subscription_id": null}}

Example 3:
Input: "User with mobile 9876543210 cannot create SIP"
Output: {{"order_id": null, "customer_id": null, "phone_number": "9876543210", "imps_track_id": null, "digio_txn_id": null, "account_number": null, "mmtc_order_id": null, "predebit_reference_id": null, "subscription_id": null}}

Example 4:
Input: "IMPS track ID HDFC123456 payment failed"
Output: {{"order_id": null, "customer_id": null, "phone_number": null, "imps_track_id": "HDFC123456", "digio_txn_id": null, "account_number": null, "mmtc_order_id": null, "predebit_reference_id": null, "subscription_id": null}}

Example 5:
Input: "subscriptionId abc123 debit failed for customer 100200"
Output: {{"order_id": null, "customer_id": "100200", "phone_number": null, "imps_track_id": null, "digio_txn_id": null, "account_number": null, "mmtc_order_id": null, "predebit_reference_id": null, "subscription_id": "abc123"}}

Example 6:
Input: "Order 123 for customer 456 with mobile 9988776655 failed"
Output: {{"order_id": "123", "customer_id": "456", "phone_number": "9988776655", "imps_track_id": null, "digio_txn_id": null, "account_number": null, "mmtc_order_id": null, "predebit_reference_id": null, "subscription_id": null}}

Example 7 (Multiple order IDs):
Input: "Orders 26239393423, 26239393424, and 26239393425 are stuck"
Output: {{"order_id": ["26239393423", "26239393424", "26239393425"], "customer_id": null, "phone_number": null, "imps_track_id": null, "digio_txn_id": null, "account_number": null, "mmtc_order_id": null, "predebit_reference_id": null, "subscription_id": null}}

Example 8 (Multiple customer IDs):
Input: "Check balance for customers 1001656012 and 1001656013"
Output: {{"order_id": null, "customer_id": ["1001656012", "1001656013"], "phone_number": null, "imps_track_id": null, "digio_txn_id": null, "account_number": null, "mmtc_order_id": null, "predebit_reference_id": null, "subscription_id": null}}
`);

    const llm = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0, // Zero temperature for deterministic extraction
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 2
    });

    const chain = extractionPrompt.pipe(llm).pipe(new StringOutputParser());

    logger.info('🤖 Calling AI to extract identifiers...');

    const result = await chain.invoke({
      userQuery: combinedText
    });

    // Parse JSON response
    const cleaned = result.trim()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/^[^{]*({.*})[^}]*$/s, '$1');

    const extractedIdentifiers = JSON.parse(cleaned);

    // Count how many identifiers were found (arrays count as 1 identifier type)
    const foundIdentifiers = Object.entries(extractedIdentifiers)
      .filter(([key, value]) => {
        if (value === null || value === undefined || value === '') return false;
        if (Array.isArray(value)) return value.length > 0; // Array must have items
        return true;
      })
      .map(([key, value]) => ({ type: key, value }));

    const hasAnyIdentifier = foundIdentifiers.length > 0;

    if (hasAnyIdentifier) {
      logger.info(`✅ AI extracted ${foundIdentifiers.length} identifier type(s):`);
      foundIdentifiers.forEach(id => {
        if (Array.isArray(id.value)) {
          logger.info(`   - ${id.type}: [${id.value.join(', ')}] (${id.value.length} values)`);
        } else {
          logger.info(`   - ${id.type}: ${id.value}`);
        }
      });
    } else {
      logger.warn('❌ No identifiers found in the query');
      logger.warn('   At least ONE identifier required: order_id, customer_id, phone_number, imps_track_id, digio_txn_id, account_number, mmtc_order_id, predebit_reference_id, or subscription_id');
    }

    return {
      ...state,
      aiExtractedIdentifiers: extractedIdentifiers,
      hasAnyIdentifier: hasAnyIdentifier,
      foundIdentifiersCount: foundIdentifiers.length,
      foundIdentifiers: foundIdentifiers,
      aiExtractionError: null
    };

  } catch (error) {
    logger.error('❌ Error in AI identifier extraction:', error.message);
    
    return {
      ...state,
      aiExtractedIdentifiers: {},
      hasAnyIdentifier: false,
      aiExtractionError: error.message
    };
  }
}

export default mandatoryDetailsNodeUsingAi;

