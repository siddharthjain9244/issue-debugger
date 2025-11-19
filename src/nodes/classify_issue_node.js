import { logger } from '../utils/logger.js';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

/**
 * Classify Issue Node
 * 
 * This node uses AI to classify the issue based on:
 * 1. Priority: low, medium, high, critical
 * 2. Category: database, api, frontend, backend, network, infrastructure, other
 * 
 * Uses LLM to analyze the issue content and determine these classifications.
 * 
 * @param {Object} state - Current state of the workflow
 * @returns {Object} Updated state with priority and category
 */
export async function classifyIssueNode(state) {
  logger.info('🔍 Executing classify_issue_node');
  
  try {
    // Create the classification prompt
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

    // Initialize the LLM (using OpenAI, but can be swapped with Bedrock later)
    const llm = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      temperature: 0.1, // Low temperature for consistent classification
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Create the chain
    const chain = classificationPrompt.pipe(llm).pipe(new StringOutputParser());

    // Execute the classification
    logger.info('🤖 Calling LLM for issue classification...');
    const result = await chain.invoke({
      subject: state.subject,
      body: state.body
    });

    // Parse the JSON response
    const cleanedResult = result.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const classification = JSON.parse(cleanedResult);

    logger.info('✅ Issue classified:', {
      priority: classification.priority,
      category: classification.category,
      reasoning: classification.reasoning
    });

    return {
      ...state,
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
  
  // Determine priority based on keywords
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
  
  // Determine category based on keywords
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
    priority,
    category,
    classificationReasoning: 'Classified using fallback rule-based system'
  };
}

