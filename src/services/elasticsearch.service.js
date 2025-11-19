/**
 * Elasticsearch Service
 * Uses elasticsearch v13 client (compatible with port forwarding)
 */

import elasticsearch from 'elasticsearch';
import { logger } from '../utils/logger.js';
import { getESConfig } from '../config/elasticsearch.config.js';

let esClient = null;

/**
 * Initialize Elasticsearch client (v13)
 * 
 * @returns {Promise<Client|null>} Initialized ES client or null if unavailable
 */
export async function initESClient() {
  if (esClient) {
    return esClient;
  }

  try {
    const config = getESConfig();
    
    // Create client with v13 API
    esClient = new elasticsearch.Client({
      hosts: config.nodes,
      requestTimeout: config.requestTimeout,
      maxRetries: config.maxRetries,
      // v13 is more lenient with port forwarding
      log: 'error' // Only log errors
    });

    // Test connection with ping
    await new Promise((resolve, reject) => {
      esClient.ping({
        requestTimeout: 5000
      }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(true);
        }
      });
    });

    logger.info('✅ Elasticsearch client initialized successfully');
    return esClient;

  } catch (error) {
    logger.warn('⚠️  Elasticsearch not available:', error.message);
    
    // Provide helpful debugging info
    if (error.message.includes('ECONNREFUSED')) {
      logger.warn('⚠️  ES connection refused. Is Elasticsearch running?');
      logger.warn(`    Check: curl http://127.0.0.1:9200`);
    } else if (error.message.includes('timeout')) {
      logger.warn('⚠️  ES connection timeout. Check if port forwarding is active');
    }
    
    logger.warn('⚠️  ES queries will be skipped. This is OK for local development.');
    esClient = null; // Mark as unavailable
    return null;
  }
}

/**
 * Get the ES client instance
 * 
 * @returns {Client|null} ES client or null
 */
export function getESClient() {
  return esClient;
}

/**
 * Search documents in Elasticsearch
 * 
 * @param {Object} searchParams - ES search parameters
 * @returns {Promise<Object>} Search results
 */
export async function searchDocuments(searchParams) {
  if (!esClient) {
    throw new Error('ES client not initialized');
  }

  try {
    // Use callback-based API and promisify it
    const result = await new Promise((resolve, reject) => {
      esClient.search(searchParams, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });

    // Parse v13 response format
    return {
      total: result.hits.total,
      hits: result.hits.hits.map(hit => ({
        _id: hit._id,
        _index: hit._index,
        _type: hit._type,
        _source: hit._source
      })),
      aggregations: result.aggregations || {}
    };

  } catch (error) {
    logger.error('❌ ES search failed:', error.message);
    throw error;
  }
}

/**
 * Execute custom ES query
 * This is the main function used by the workflow
 * 
 * @param {Object} esQueryBody - Complete ES query body with index
 * @returns {Promise<Object>} Query results
 */
export async function executeESQuery(esQueryBody) {
  try {
    logger.info('📊 Executing ES query');
    
    // Ensure client is initialized
    if (!esClient) {
      const client = await initESClient();
      if (!client) {
        // ES not available
        logger.warn('⚠️  Elasticsearch not available, skipping query');
        return {
          success: false,
          error: 'Elasticsearch not available (OK for local dev)',
          documents: [],
          skipped: true
        };
      }
    }

    // Extract index and body
    const { index, body } = esQueryBody;
    
    if (!index) {
      throw new Error('ES query must include "index" field');
    }

    logger.debug('ES Query:', JSON.stringify({ index, body }, null, 2));

    // Execute search
    const result = await searchDocuments({
      index: index,
      body: body
    });
    
    logger.info(`✅ ES query executed: ${result.total} documents found`);

    return {
      success: true,
      total: result.total,
      documentsFound: result.hits.length,
      documents: result.hits,
      aggregations: result.aggregations
    };

  } catch (error) {
    logger.error('❌ ES query execution failed:', error.message);
    return {
      success: false,
      error: error.message,
      documents: [],
      skipped: false
    };
  }
}

/**
 * Check if an index exists
 * 
 * @param {string} indexName - Index name
 * @returns {Promise<boolean>} True if exists
 */
export async function indexExists(indexName) {
  if (!esClient) {
    return false;
  }

  try {
    const result = await new Promise((resolve, reject) => {
      esClient.indices.exists({ index: indexName }, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
    
    return result === true;
  } catch (error) {
    logger.error(`❌ Failed to check if index "${indexName}" exists:`, error.message);
    return false;
  }
}

/**
 * Get document count for an index
 * 
 * @param {string} indexName - Index name
 * @returns {Promise<number>} Document count
 */
export async function getDocumentCount(indexName) {
  if (!esClient) {
    return 0;
  }

  try {
    const result = await new Promise((resolve, reject) => {
      esClient.count({ index: indexName }, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
    
    return result.count || 0;
  } catch (error) {
    logger.error(`❌ Failed to get count for index "${indexName}":`, error.message);
    return 0;
  }
}

export default {
  initESClient,
  getESClient,
  searchDocuments,
  executeESQuery,
  indexExists,
  getDocumentCount
};
