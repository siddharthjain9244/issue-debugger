import { logger } from '../utils/logger.js';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

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
You are an expert email classifier for a technical support system. Analyze the following email and determine if it's a real technical issue or just a normal email.

EMAIL SUBJECT: {subject}

EMAIL DESCRIPTION: {body}

Your task is to determine:
ISSUE_TYPE: Is this a real technical issue that needs investigation?
   - real_issue: Technical problems, errors, bugs, failures, system issues, user complaints about functionality, transaction issues, API errors, database errors, payment failures, verification problems, order processing issues
   - normal_mail: Greetings, promotional emails, newsletters, general communications, non-technical messages, marketing content, announcements without technical issues

Examples of normal_mail (NOT technical issues):
- "Happy Birthday!", "Happy New Year", "Merry Christmas"
- "Congratulations on your achievement", "Thank you for being a valued customer"
- "New product launch announcement", "Special offer", "Discount available"
- "Thank you for your feedback", "We appreciate your support"
- "Welcome to our platform", "Account created successfully"
- "Newsletter", "Monthly digest", "Product updates"
- "Festival greetings", "Holiday wishes", "Seasonal greetings"
- General marketing emails, promotional content, informational emails
- Confirmation emails without errors (e.g., "Your order was successful")
- General thank you messages, appreciation emails

Examples of real_issue (technical problems that need investigation):
- "Payment failed during buy transaction"
- "Error 500 when accessing portfolio"
- "KYC verification stuck", "KYC verification failed"
- "Order not processing", "Order stuck in pending"
- "SIP debit failed", "SIP payment not going through"
- "Portfolio balance showing incorrect", "Portfolio not loading"
- "API error", "Database connection failed"
- "Transaction timeout", "Payment gateway error"
- "Unable to create SIP", "SIP setup failed"
- Any error messages, stack traces, exception logs
- User complaints about functionality not working
- System failures, crashes, bugs

Key indicators of real_issue:
- Contains error codes, error messages, exception details
- Mentions technical failures (payment failed, API down, database error)
- User reporting functionality not working as expected
- Transaction/order/process stuck or failed
- System performance issues, timeouts, crashes

Key indicators of normal_mail:
- Pure greetings or congratulations
- Marketing/promotional content without technical problems
- General announcements or newsletters
- Thank you messages without error context
- Informational emails about features (not reporting issues)

Respond ONLY in this exact JSON format (no extra text):
{{"issueType": "real_issue|normal_mail", "reasoning": "brief explanation"}}
`);

    // Step 2: If real issue, determine flow type
    const flowTypePrompt = PromptTemplate.fromTemplate(`
You are an expert issue classifier for a Digital Gold platform. Analyze the following technical issue and determine which business flow it relates to.

ISSUE SUBJECT: {subject}

ISSUE DESCRIPTION: {body}

Your task is to determine:
FLOW_TYPE: Which business flow does this issue relate to?

IMPORTANT - SIP Classification Rules:
- sip_create: Issues related to SIP creation, SIP setup, SIP registration, creating a new SIP plan, SIP configuration, recurring investment setup, SIP enrollment
  Examples: "Unable to create SIP", "SIP setup failed", "Error while creating SIP", "SIP registration not working"
  
- sip_debit: Issues related to SIP debit execution, SIP payment processing, SIP auto-debit, recurring payment deduction, SIP installment processing, SIP debit failure
  Examples: "SIP debit failed", "SIP payment not deducted", "SIP auto-debit error", "SIP installment stuck"
  
- buy: Issues related to SIP orders being processed (SIP orders are linked to buy orders), buying gold through SIP, SIP order execution, SIP order payment, SIP order processing
  Examples: "SIP order failed", "SIP order payment issue", "SIP order not processing", "SIP buy transaction error"
  Note: When SIP is mentioned but the issue is about the actual order/payment execution (not setup or debit), it's a buy flow issue

Other Flow Types:
- buy: Issues related to buying gold, purchase transactions, order creation, payment for buying, one-time purchases
  Examples: "Buy transaction failed", "Payment failed during purchase", "Order creation error", "Buy order stuck"
  
- sell: Issues related to selling gold, sell transactions, fund transfers, selling portfolio, withdrawal, redemption
  Examples: "Sell transaction failed", "Fund transfer not received", "Sell order stuck", "Withdrawal error"
  
- kyc: Issues related to KYC verification, PAN verification, Aadhaar verification, document verification, bank account verification, KYC status, KYC approval
  Examples: "KYC verification stuck", "PAN verification failed", "Aadhaar verification error", "KYC document rejected"
  
- customer_portfolio: Issues related to portfolio balance, portfolio display, portfolio fetching, portfolio updates, holdings display, gold balance
  Examples: "Portfolio balance incorrect", "Portfolio not loading", "Holdings not showing", "Gold balance wrong"
  
- merchant_product_maintenance: Issues related to merchant management, product configuration, price updates, merchant settings, product maintenance, merchant API issues
  Examples: "Merchant price not updating", "Product configuration error", "Merchant API down"
  
- other: Doesn't fit any of the above categories

Classification Priority for SIP-related issues:
1. If issue mentions "SIP creation", "SIP setup", "create SIP", "SIP registration" → sip_create
2. If issue mentions "SIP debit", "SIP payment", "SIP deduction", "SIP installment" → sip_debit
3. If issue mentions "SIP order", "SIP buy", "SIP transaction", "SIP purchase" → buy (SIP orders are buy orders)
4. If SIP is mentioned but context is unclear, prioritize based on the action: setup/creation → sip_create, payment/deduction → sip_debit, order/transaction → buy

Respond ONLY in this exact JSON format (no extra text):
{{"flowType": "buy|sell|kyc|customer_portfolio|sip_create|sip_debit|merchant_product_maintenance|other", "reasoning": "brief explanation"}}
`);

    // Step 3: Determine priority and category (existing logic)
    const classificationPrompt = PromptTemplate.fromTemplate(`
You are an expert issue classifier for a technical support system. Analyze the following issue and classify it.

ISSUE SUBJECT: {subject}

ISSUE DESCRIPTION: {body}

Your task is to determine:
1. PRIORITY: How urgent is this issue?
   - critical: System down, data loss, security breach, affects all users
   - high: Major feature broken, affects many users, significant business impact
   - medium: Feature partially working, affects some users, workaround available
   - low: Minor issue, cosmetic problem, feature request

2. CATEGORY: What type of issue is this?
   - database: SQL errors, query performance, connection issues, data integrity
   - api: API failures, endpoint errors, integration problems
   - frontend: UI bugs, browser issues, rendering problems
   - backend: Server errors, application logic, processing issues
   - network: Connectivity, timeouts, DNS, firewall
   - infrastructure: Server resources, deployment, configuration
   - other: Doesn't fit above categories

Respond ONLY in this exact JSON format (no extra text):
{{"priority": "critical|high|medium|low", "category": "database|api|frontend|backend|network|infrastructure|other", "reasoning": "brief explanation"}}
`);

    // Initialize the LLM
    const llm = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      temperature: 0.1, // Low temperature for consistent classification
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Step 1: Check if it's a real issue
    logger.info('🤖 Step 1: Determining issue type (real_issue vs normal_mail)...');
    const issueTypeChain = issueTypePrompt.pipe(llm).pipe(new StringOutputParser());
    const issueTypeResult = await issueTypeChain.invoke({
      subject: state.subject,
      body: state.body
    });

    const cleanedIssueTypeResult = issueTypeResult.trim().replaceAll(/```json\n?/g, '').replaceAll(/```\n?/g, '');
    const issueTypeClassification = JSON.parse(cleanedIssueTypeResult);

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

    const cleanedFlowTypeResult = flowTypeResult.trim().replaceAll(/```json\n?/g, '').replaceAll(/```\n?/g, '');
    const flowTypeClassification = JSON.parse(cleanedFlowTypeResult);

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

    const cleanedClassificationResult = classificationResult.trim().replaceAll(/```json\n?/g, '').replaceAll(/```\n?/g, '');
    const classification = JSON.parse(cleanedClassificationResult);

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

