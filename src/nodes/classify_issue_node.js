import { logger } from '../utils/logger.js';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

/**
 * Robustly extract and parse JSON from LLM response
 * Handles markdown code blocks, extra text, and malformed JSON
 * 
 * @param {string} text - Raw LLM response
 * @param {Object} fallback - Fallback value if parsing fails
 * @param {Array} validations - Array of {field, validValues} to validate
 * @returns {Object} Parsed JSON or fallback
 */
function extractJSON(text, fallback = {}, validations = []) {
  try {
    // Remove markdown code blocks and extra text
    let cleaned = text.trim()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/^[^{]*({.*})[^}]*$/s, '$1'); // Extract only JSON object
    
    const parsed = JSON.parse(cleaned);
    
    // Validate fields if specified
    for (const { field, validValues } of validations) {
      if (!parsed[field] || !validValues.includes(parsed[field])) {
        logger.warn(`Invalid value for ${field}: ${parsed[field]}, expected one of: ${validValues.join(', ')}`);
        return fallback;
      }
    }
    
    return parsed;
  } catch (error) {
    logger.error('JSON extraction failed:', error.message);
    logger.debug('Raw text:', text);
    return fallback;
  }
}

/**
 * Classify Issue Node
 * 
 * This node uses AI to classify the issue based on:
 * 1. Issue Type: real_issue or normal_mail (like happy birthday, promotional, etc.)
 * 2. Flow Type: buy, sell, kyc, customer_portfolio, sip_create, sip_debit, merchant_product_maintenance, other
 * 3. Priority: low, medium, high, critical
 * 4. Category: database, api, frontend, backend, network, infrastructure, other
 * 
 * Uses LLM to analyze the issue content and determine these classifications.
 * 
 * @param {Object} state - Current state of the workflow
 * @returns {Object} Updated state with issueType, flowType, priority and category
 */
export async function classifyIssueNode(state) {
  logger.info('🔍 Executing classify_issue_node');
  
  try {
    // Step 1: Determine if this is a real issue or normal mail
    const issueTypePrompt = PromptTemplate.fromTemplate(`
Classify this email.

Subject: {subject}
Body: {body}

Is this a TECHNICAL ISSUE or NORMAL MAIL?
- real_issue = Errors, failures, stuck processes, bugs, user complaints about broken features
- normal_mail = Greetings, marketing, newsletters, thank you messages, success confirmations

OUTPUT FORMAT (NO EXTRA TEXT, ONLY JSON):
{{"issueType": "real_issue", "reasoning": "one sentence"}}`);

    // Step 2: If real issue, determine flow type
    const flowTypePrompt = PromptTemplate.fromTemplate(`
Identify business flow type.

Subject: {subject}
Body: {body}

PICK ONE:
buy = Purchasing gold, buy orders, payment for purchase
sell = Selling gold, withdrawals, redemption
sip_create = Creating/setting up new SIP
sip_debit = SIP payment deduction, recurring debit
kyc = KYC/PAN/Aadhaar verification
customer_portfolio = Portfolio balance, holdings
merchant_product_maintenance = Merchant/product config
other = None of above

SIP RULES:
"create/setup SIP" → sip_create
"SIP debit/payment" → sip_debit
"SIP order" → buy

OUTPUT FORMAT (NO EXTRA TEXT, ONLY JSON):
{{"flowType": "buy", "reasoning": "one sentence"}}`);

    // Step 3: Determine priority and category
    const classificationPrompt = PromptTemplate.fromTemplate(`
Classify priority and category.

Subject: {subject}
Body: {body}

PRIORITY (pick ONE):
critical = System down, all users affected
high = Major feature broken, many users affected
medium = Partially working, some users affected
low = Minor issue, cosmetic

CATEGORY (pick ONE):
database = SQL errors, data issues
api = API failures, endpoint errors
backend = Server errors, processing issues
frontend = UI bugs, browser issues
network = Connectivity, timeouts
other = Doesn't fit above

OUTPUT FORMAT (NO EXTRA TEXT, ONLY JSON):
{{"priority": "high", "category": "backend", "reasoning": "one sentence"}}`);

    // Initialize the LLM with temperature 0 for deterministic classification
    const llm = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0, // Zero temperature = no randomness = no hallucination
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 2 // Retry on API failures
    });

    // Step 1: Check if it's a real issue
    logger.info('🤖 Step 1: Determining issue type (real_issue vs normal_mail)...');
    const issueTypeChain = issueTypePrompt.pipe(llm).pipe(new StringOutputParser());
    const issueTypeResult = await issueTypeChain.invoke({
      subject: state.subject,
      body: state.body
    });

    // Parse JSON with validation
    const issueTypeClassification = extractJSON(
      issueTypeResult,
      { issueType: 'real_issue', reasoning: 'Classification parsing failed, treating as real issue for safety' },
      [{ field: 'issueType', validValues: ['real_issue', 'normal_mail'] }]
    );

    logger.info('✅ Issue type determined:', {
      issueType: issueTypeClassification.issueType,
      reasoning: issueTypeClassification.reasoning
    });

    // If it's normal mail, return early without further classification
    if (issueTypeClassification.issueType === 'normal_mail') {
      logger.info('📧 Email identified as normal_mail, skipping technical classification');
      return {
        ...state,
        issueType: 'normal_mail',
        issueTypeReasoning: issueTypeClassification.reasoning,
        flowType: null,
        priority: null,
        category: null,
        classificationReasoning: 'Email identified as normal mail, not a technical issue'
      };
    }

    // Step 2: Determine flow type (only for real issues)
    logger.info('🤖 Step 2: Determining flow type...');
    const flowTypeChain = flowTypePrompt.pipe(llm).pipe(new StringOutputParser());
    const flowTypeResult = await flowTypeChain.invoke({
      subject: state.subject,
      body: state.body
    });

    // Parse JSON with validation
    const flowTypeClassification = extractJSON(
      flowTypeResult,
      { flowType: 'other', reasoning: 'Classification parsing failed, marked as other' },
      [{ field: 'flowType', validValues: ['buy', 'sell', 'kyc', 'customer_portfolio', 'sip_create', 'sip_debit', 'merchant_product_maintenance', 'other'] }]
    );

    logger.info('✅ Flow type determined:', {
      flowType: flowTypeClassification.flowType,
      reasoning: flowTypeClassification.reasoning
    });

    // Step 3: Determine priority and category
    logger.info('🤖 Step 3: Determining priority and category...');
    const classificationChain = classificationPrompt.pipe(llm).pipe(new StringOutputParser());
    const classificationResult = await classificationChain.invoke({
      subject: state.subject,
      body: state.body
    });

    // Parse JSON with validation
    const classification = extractJSON(
      classificationResult,
      { priority: 'medium', category: 'other', reasoning: 'Classification parsing failed, using default values' },
      [
        { field: 'priority', validValues: ['critical', 'high', 'medium', 'low'] },
        { field: 'category', validValues: ['database', 'api', 'backend', 'frontend', 'network', 'other'] }
      ]
    );

    logger.info('✅ Issue fully classified:', {
      issueType: issueTypeClassification.issueType,
      flowType: flowTypeClassification.flowType,
      priority: classification.priority,
      category: classification.category
    });

    return {
      ...state,
      issueType: issueTypeClassification.issueType,
      issueTypeReasoning: issueTypeClassification.reasoning,
      flowType: flowTypeClassification.flowType,
      flowTypeReasoning: flowTypeClassification.reasoning,
      priority: classification.priority,
      category: classification.category,
      classificationReasoning: classification.reasoning
    };

  } catch (error) {
    logger.error('❌ Error in classify_issue_node:', error);
    
    // Fallback to rule-based classification if AI fails
    logger.warn('⚠️  Falling back to rule-based classification');
    const fallbackClassification = fallbackClassify(state);
    
    return {
      ...state,
      ...fallbackClassification,
      error: `AI classification failed: ${error.message}. Used fallback classification.`
    };
  }
}

/**
 * Fallback classification using simple keyword matching
 * Used when AI classification fails
 * 
 * @param {Object} state - Current state
 * @returns {Object} Classification results
 */
function fallbackClassify(state) {
  const text = `${state.subject} ${state.body}`.toLowerCase();
  
  // Step 1: Determine if it's a real issue or normal mail
  const normalMailKeywords = [
    // Greetings
    'happy birthday', 'birthday', 'happy new year', 'merry christmas', 'happy diwali', 'happy holi',
    'congratulations', 'congrats', 'congratulation',
    'greeting', 'greetings', 'wishes', 'best wishes',
    'celebration', 'festival', 'holiday', 'seasonal',
    // Promotional/Marketing
    'promotional', 'promotion', 'offer', 'discount', 'special offer', 'limited time',
    'newsletter', 'news letter', 'monthly digest', 'product updates',
    'announcement', 'launch', 'new product', 'feature announcement',
    // Thank you messages
    'thank you', 'thanks', 'appreciation', 'appreciate', 'grateful',
    'valued customer', 'thank you for', 'we appreciate',
    // General communications
    'welcome', 'account created', 'registration successful', 'signup successful',
    'order successful', 'transaction successful', 'payment successful',
    'confirmation', 'order confirmed', 'payment confirmed',
    // Non-technical content
    'informational', 'update', 'reminder', 'notification',
    'marketing', 'advertisement', 'ad', 'campaign'
  ];
  
  // Technical issue indicators (if these are present, it's likely a real issue)
  const technicalIssueIndicators = [
    'error', 'failed', 'failure', 'not working', 'broken', 'issue', 'problem',
    'bug', 'exception', 'timeout', 'stuck', 'pending', 'not processing',
    'unable to', 'cannot', "can't", 'crash', 'down', 'outage',
    '500', '404', '403', '400', 'error code', 'exception', 'stack trace'
  ];
  
  // If technical indicators are present, it's definitely a real issue - skip normal mail check
  const hasTechnicalIndicators = technicalIssueIndicators.some(indicator => text.includes(indicator));
  
  // Check if it's normal mail (only if no technical indicators)
  if (!hasTechnicalIndicators && normalMailKeywords.some(keyword => text.includes(keyword))) {
    return {
      issueType: 'normal_mail',
      issueTypeReasoning: 'Classified as normal mail using keyword matching',
      flowType: null,
      priority: null,
      category: null,
      classificationReasoning: 'Email identified as normal mail, not a technical issue'
    };
  }
  
  // Step 2: Determine flow type (only for real issues)
  let flowType = 'other'; // default
  
  // SIP-related keywords - need special handling
  const sipCreateKeywords = ['sip create', 'sip setup', 'sip registration', 'create sip', 'sip creation', 'sip enrollment', 'setup sip', 'register sip'];
  const sipDebitKeywords = ['sip debit', 'sip deduction', 'sip payment', 'sip installment', 'sip auto-debit', 'sip recurring payment', 'sip deduction failed'];
  const sipOrderKeywords = ['sip order', 'sip buy', 'sip transaction', 'sip purchase', 'sip order failed', 'sip order payment', 'sip buy transaction'];
  
  // Check SIP-related flows first (priority order matters)
  if (sipCreateKeywords.some(keyword => text.includes(keyword))) {
    flowType = 'sip_create';
  } else if (sipDebitKeywords.some(keyword => text.includes(keyword))) {
    flowType = 'sip_debit';
  } else if (sipOrderKeywords.some(keyword => text.includes(keyword))) {
    // SIP orders are linked to buy orders
    flowType = 'buy';
  } else {
    // Other flow keywords
    const flowKeywords = {
      buy: ['buy', 'purchase', 'order', 'buying gold', 'purchase gold', 'buy transaction', 'buy order', 'purchase order'],
      sell: ['sell', 'selling', 'sell gold', 'sell transaction', 'fund transfer', 'withdrawal', 'redemption', 'sell order'],
      kyc: ['kyc', 'verification', 'pan', 'aadhaar', 'document', 'bank account verification', 'kyc verification', 'kyc status', 'kyc approval'],
      customer_portfolio: ['portfolio', 'balance', 'holdings', 'gold balance', 'portfolio balance', 'portfolio display', 'portfolio fetch'],
      merchant_product_maintenance: ['merchant', 'product maintenance', 'price update', 'merchant configuration', 'product config', 'merchant api', 'merchant price']
    };
    
    for (const [flow, keywords] of Object.entries(flowKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        flowType = flow;
        break;
      }
    }
  }
  
  // Step 3: Determine priority based on keywords
  let priority = 'medium'; // default
  const criticalKeywords = ['down', 'outage', 'critical', 'emergency', 'data loss', 'security breach'];
  const highKeywords = ['broken', 'error', 'failure', 'not working', 'crash'];
  const lowKeywords = ['request', 'enhancement', 'cosmetic', 'minor'];
  
  if (criticalKeywords.some(keyword => text.includes(keyword))) {
    priority = 'critical';
  } else if (highKeywords.some(keyword => text.includes(keyword))) {
    priority = 'high';
  } else if (lowKeywords.some(keyword => text.includes(keyword))) {
    priority = 'low';
  }
  
  // Step 4: Determine category based on keywords
  let category = 'other'; // default
  const categoryKeywords = {
    database: ['database', 'sql', 'query', 'table', 'db', 'postgres', 'mysql'],
    api: ['api', 'endpoint', 'rest', 'graphql', 'response', 'request'],
    frontend: ['ui', 'frontend', 'browser', 'react', 'vue', 'angular', 'display'],
    backend: ['backend', 'server', 'application', 'service', 'processing'],
    network: ['network', 'connection', 'timeout', 'dns', 'connectivity'],
    infrastructure: ['deployment', 'server', 'infrastructure', 'configuration', 'resources']
  };
  
  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      category = cat;
      break;
    }
  }
  
  return {
    issueType: 'real_issue',
    issueTypeReasoning: 'Classified as real issue using keyword matching',
    flowType,
    flowTypeReasoning: 'Flow type determined using keyword matching',
    priority,
    category,
    classificationReasoning: 'Classified using fallback rule-based system'
  };
}

