/**
 * Knowledge Base Vector Store Service
 * 
 * Manages vector embeddings for business flow documentation.
 * Similar to schema-vector-store but for markdown documentation.
 * 
 * Documents include:
 * - Buy Flow
 * - Sell Flow
 * - SIP Create/Debit Flow
 * - KYC Flows
 * - Customer Portfolio
 * - Merchant Product Maintenance
 */

import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let knowledgeBaseVectorStore = null;

/**
 * Load all markdown files from knowledge base directory
 * 
 * @returns {Array} Array of document objects
 */
function loadKnowledgeBaseDocuments() {
  const knowledgeBasePath = join(__dirname, '../data/knowledge-base');
  
  logger.info('📚 Loading knowledge base documents...');
  
  try {
    const files = readdirSync(knowledgeBasePath).filter(file => file.endsWith('.md'));
    
    const documents = files.map(file => {
      const filePath = join(knowledgeBasePath, file);
      const content = readFileSync(filePath, 'utf-8');
      
      // Extract flow type from filename
      const flowType = file.replace('.md', '').replace(/^\d+_/, '').toLowerCase();
      
      logger.info(`   - Loaded: ${file} (${flowType})`);
      
      return {
        pageContent: content,
        metadata: {
          source: file,
          flowType: flowType,
          path: filePath
        }
      };
    });
    
    logger.info(`✅ Loaded ${documents.length} knowledge base documents`);
    return documents;
    
  } catch (error) {
    logger.error('❌ Failed to load knowledge base documents:', error);
    throw error;
  }
}

/**
 * Split documents into chunks for embedding
 * 
 * @param {Array} documents - Array of document objects
 * @returns {Promise<Array>} Array of split document chunks
 */
async function splitDocuments(documents) {
  logger.info('✂️  Splitting documents into chunks...');
  
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,        // Each chunk ~1000 characters
    chunkOverlap: 200,      // 200 char overlap for context
    separators: ['\n## ', '\n### ', '\n\n', '\n', ' ']  // Split on markdown headers first
  });
  
  const allChunks = [];
  
  for (const doc of documents) {
    const chunks = await textSplitter.createDocuments(
      [doc.pageContent],
      [doc.metadata]
    );
    allChunks.push(...chunks);
  }
  
  logger.info(`✅ Created ${allChunks.length} chunks from ${documents.length} documents`);
  return allChunks;
}

/**
 * Initialize knowledge base vector store
 * Loads markdown docs, splits them, creates embeddings, and stores in memory
 * 
 * @returns {Promise<MemoryVectorStore>} Initialized vector store
 */
export async function initializeKnowledgeBaseVectorStore() {
  // Return cached instance if already initialized
  if (knowledgeBaseVectorStore) {
    logger.debug('📚 Using cached knowledge base vector store');
    return knowledgeBaseVectorStore;
  }
  
  logger.info('🚀 Initializing knowledge base vector store...');
  
  try {
    // Load documents
    const documents = loadKnowledgeBaseDocuments();
    
    // Split into chunks
    const chunks = await splitDocuments(documents);
    
    // Create embeddings
    logger.info('🔢 Creating embeddings with OpenAI...');
    const embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-large',  // Same as schema embeddings
      openAIApiKey: process.env.OPENAI_API_KEY
    });
    
    // Create vector store
    logger.info('💾 Creating vector store from chunks...');
    knowledgeBaseVectorStore = await MemoryVectorStore.fromDocuments(
      chunks,
      embeddings
    );
    
    logger.info('✅ Knowledge base vector store initialized successfully');
    logger.info(`   - ${documents.length} documents`);
    logger.info(`   - ${chunks.length} chunks`);
    logger.info(`   - Ready for similarity search`);
    
    return knowledgeBaseVectorStore;
    
  } catch (error) {
    logger.error('❌ Failed to initialize knowledge base vector store:', error);
    throw error;
  }
}

/**
 * Search knowledge base for relevant context
 * 
 * @param {string} query - User's issue description
 * @param {string} flowType - Optional flow type to filter results
 * @param {number} k - Number of results to return (default: 3)
 * @returns {Promise<Array>} Array of relevant document chunks
 */
export async function searchKnowledgeBase(query, flowType = null, k = 3) {
  if (!knowledgeBaseVectorStore) {
    logger.warn('⚠️  Knowledge base vector store not initialized');
    return [];
  }
  
  try {
    logger.info(`🔍 Searching knowledge base for: "${query.substring(0, 50)}..."`);
    
    // Perform similarity search
    const results = await knowledgeBaseVectorStore.similaritySearch(query, k);
    
    // Filter by flow type if specified
    let filteredResults = results;
    if (flowType && flowType !== 'other') {
      filteredResults = results.filter(doc => 
        doc.metadata.flowType.includes(flowType.toLowerCase())
      );
      
      // If filtering removed all results, fall back to unfiltered
      if (filteredResults.length === 0) {
        logger.info(`   ℹ️  No results for flowType="${flowType}", using all results`);
        filteredResults = results;
      }
    }
    
    logger.info(`✅ Found ${filteredResults.length} relevant knowledge base chunks`);
    filteredResults.forEach((doc, idx) => {
      logger.debug(`   ${idx + 1}. ${doc.metadata.source} (${doc.pageContent.substring(0, 50)}...)`);
    });
    
    return filteredResults;
    
  } catch (error) {
    logger.error('❌ Knowledge base search failed:', error);
    return [];
  }
}

/**
 * Get knowledge base vector store instance
 * 
 * @returns {MemoryVectorStore|null} Vector store instance or null
 */
export function getKnowledgeBaseVectorStore() {
  return knowledgeBaseVectorStore;
}

export default {
  initializeKnowledgeBaseVectorStore,
  searchKnowledgeBase,
  getKnowledgeBaseVectorStore
};

