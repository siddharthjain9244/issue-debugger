/**
 * Knowledge Retrieval Node
 * 
 * Retrieves relevant documentation from the knowledge base using RAG.
 * This node runs after classification to provide context-aware documentation.
 * 
 * Flow:
 * 1. Takes user's issue + classification
 * 2. Searches knowledge base vector store
 * 3. Returns relevant documentation chunks
 * 4. Used by analysis node for better diagnosis
 */

import { logger } from '../utils/logger.js';
import { searchKnowledgeBase } from '../services/knowledge-base-vector-store.service.js';

/**
 * LangGraph node for retrieving relevant knowledge base context
 * 
 * @param {Object} state - Current graph state
 * @returns {Promise<Object>} Updated state with knowledge base context
 */
export async function knowledgeRetrievalNode(state) {
  logger.info('📚 Retrieving relevant knowledge base context...');

  try {
    // Build search query from user's issue
    const searchQuery = `${state.subject}\n${state.body}`;
    
    // Determine flow type from classification if available
    const flowType = state.flowType || state.category;
    
    logger.info(`   - Issue Category: ${state.category}`);
    logger.info(`   - Issue Priority: ${state.priority}`);
    if (flowType) {
      logger.info(`   - Flow Type: ${flowType}`);
    }
    
    // Search knowledge base
    // Get top 3 most relevant chunks (can be adjusted)
    const relevantDocs = await searchKnowledgeBase(searchQuery, flowType, 3);
    
    if (relevantDocs.length === 0) {
      logger.warn('⚠️  No relevant knowledge base documentation found');
      return {
        ...state,
        knowledgeBaseContext: null,
        knowledgeBaseSources: []
      };
    }
    
    // Format knowledge base context
    const context = relevantDocs.map((doc, idx) => {
      return `
### Knowledge Base ${idx + 1} (${doc.metadata.source}):
${doc.pageContent}
`;
    }).join('\n---\n');
    
    // Extract sources for transparency
    const sources = relevantDocs.map(doc => ({
      source: doc.metadata.source,
      flowType: doc.metadata.flowType,
      snippet: doc.pageContent.substring(0, 150) + '...'
    }));
    
    logger.info(`✅ Retrieved ${relevantDocs.length} relevant knowledge base chunks`);
    sources.forEach((source, idx) => {
      logger.info(`   ${idx + 1}. ${source.source} (${source.flowType})`);
    });
    
    return {
      ...state,
      knowledgeBaseContext: context,
      knowledgeBaseSources: sources
    };
    
  } catch (error) {
    logger.error('❌ Knowledge retrieval failed:', error);
    
    return {
      ...state,
      knowledgeBaseContext: null,
      knowledgeBaseSources: [],
      error: `Knowledge retrieval failed: ${error.message}`
    };
  }
}

export default knowledgeRetrievalNode;

