import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';
import { getAllTableSchemas, formatTableSchema } from '../data/database-schema.js';
import { logger } from '../utils/logger.js';

/**
 * Schema Vector Store Service
 * 
 * This service manages the vector database containing embedded table schemas.
 * 
 * How it works:
 * 1. Takes each table schema from database-schema.js
 * 2. Formats it into a descriptive text document
 * 3. Embeds it using OpenAI's text-embedding-3-large model
 * 4. Stores in an in-memory vector database
 * 5. Provides similarity search to find relevant tables for a query
 * 
 * Why this approach:
 * - Reduces token usage (only send relevant schemas to LLM)
 * - Improves accuracy (LLM focuses on relevant tables only)
 * - Scales to large databases (can handle 100+ tables)
 * - Fast in-memory search (no external dependencies)
 */

let vectorStoreInstance = null;

/**
 * Initialize the vector store with table schema embeddings
 * 
 * Process:
 * 1. Load all table schemas from database-schema.js
 * 2. Format each table into a text document
 * 3. Create embedding model (text-embedding-3-large)
 * 4. Embed each table schema
 * 5. Store in MemoryVectorStore for fast retrieval
 * 
 * @returns {Promise<MemoryVectorStore>} Initialized vector store
 */
export async function initializeSchemaVectorStore() {
  if (vectorStoreInstance) {
    logger.info('📦 Vector store already initialized, returning existing instance');
    return vectorStoreInstance;
  }

  logger.info('🚀 Initializing schema vector store...');
  
  try {
    // Step 1: Get all table schemas
    const tableSchemas = getAllTableSchemas();
    logger.info(`📊 Loaded ${tableSchemas.length} table schemas`);

    // Step 2: Format each schema into a document
    // Document = { pageContent: "text to embed", metadata: {extra info} }
    const documents = tableSchemas.map(schema => {
      const formattedSchema = formatTableSchema(schema);
      
      return new Document({
        pageContent: formattedSchema, // This text will be embedded
        metadata: {
          tableName: schema.name,
          description: schema.description,
          purpose: schema.purpose
        }
      });
    });

    logger.info('📝 Formatted all schemas into documents');

    // Step 3: Create OpenAI embeddings
    // text-embedding-3-large: 3072 dimensions, best for semantic search
    const embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-large',
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    logger.info('🔢 Creating embeddings for all table schemas...');

    // Step 4: Create vector store from documents
    // This will:
    // - Call OpenAI API to embed each document
    // - Store embeddings + documents in memory
    // - Create index for fast similarity search
    vectorStoreInstance = await MemoryVectorStore.fromDocuments(
      documents,
      embeddings
    );

    logger.info(`✅ Vector store initialized with ${tableSchemas.length} table embeddings`);
    logger.info('💾 Vector store is stored IN MEMORY (no cloud, no external DB)');

    return vectorStoreInstance;

  } catch (error) {
    logger.error('❌ Failed to initialize schema vector store:', error);
    throw error;
  }
}

/**
 * Find relevant table schemas for a given query using similarity search
 * 
 * How it works:
 * 1. Takes the user's question (e.g., "why is customer 9876 balance wrong?")
 * 2. Embeds the question into a vector
 * 3. Compares question vector with all table schema vectors
 * 4. Returns the top K most similar tables (cosine similarity)
 * 
 * Example:
 * Query: "customer balance is wrong"
 * Returns: customer_portfolio, dg_buy_orders, dg_sell_orders, ledger
 * 
 * @param {string} query - The user's question about the database
 * @param {number} k - Number of relevant tables to return (default: 6)
 * @returns {Promise<Array>} Array of relevant table schemas with similarity scores
 */
export async function findRelevantTables(query, k = 6) {
  logger.info('🔍 Finding relevant tables for query:', { query, topK: k });

  try {
    // Ensure vector store is initialized
    if (!vectorStoreInstance) {
      logger.warn('⚠️  Vector store not initialized, initializing now...');
      await initializeSchemaVectorStore();
    }

    // Step 1: Embed the query and search for similar schemas
    // similaritySearch() does:
    // 1. Embeds the query string
    // 2. Calculates cosine similarity with all stored vectors
    // 3. Returns top K most similar documents
    const results = await vectorStoreInstance.similaritySearch(query, k);

    // Step 2: Extract relevant information
    const relevantTables = results.map((doc, index) => ({
      tableName: doc.metadata.tableName,
      description: doc.metadata.description,
      purpose: doc.metadata.purpose,
      fullSchema: doc.pageContent, // Complete formatted schema
      rank: index + 1 // Ranking by similarity
    }));
    
    logger.info('✅ Found relevant tables:', {
      query,
      tables: relevantTables.map(t => t.tableName)
    });

    return relevantTables;

  } catch (error) {
    logger.error('❌ Error finding relevant tables:', error);
    throw error;
  }
}

/**
 * Get the full schema for specific tables by name
 * Useful when you know exactly which tables you need
 * 
 * @param {Array<string>} tableNames - Array of table names
 * @returns {Array} Array of table schemas
 */
export async function getTablesByName(tableNames) {
  if (!vectorStoreInstance) {
    await initializeSchemaVectorStore();
  }

  const allSchemas = getAllTableSchemas();
  return allSchemas.filter(schema => 
    tableNames.includes(schema.name)
  ).map(schema => ({
    tableName: schema.name,
    description: schema.description,
    fullSchema: formatTableSchema(schema)
  }));
}

/**
 * Reset the vector store (useful for testing or reloading)
 */
export function resetVectorStore() {
  vectorStoreInstance = null;
  logger.info('🔄 Vector store reset');
}


