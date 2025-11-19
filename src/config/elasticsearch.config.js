import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Elasticsearch Configuration
 * 
 * Manages ES connection settings for different environments
 * ES stores order transaction data (buy, sell, redeem, goldback orders)
 */

const ES_CONFIG = {
  production: {
    nodes: [
      'http://prod-es-1-60.digitalgold.local:9200',
      'http://prod-es-1-61.digitalgold.local:9200',
      'http://prod-es-1-62.digitalgold.local:9200',
      'http://prod-es-node-1.digitalgold.local:9200',
      'http://prod-es-node-2.digitalgold.local:9200'
    ],
    requestTimeout: 30000,
    maxRetries: 3
  },
  
  staging: {
    nodes: ['http://10.123.4.242:9200'],
    requestTimeout: 30000,
    maxRetries: 3
  },
  
  local: {
    nodes: ['http://127.0.0.1:9200'],
    requestTimeout: 30000,
    maxRetries: 3,
    log: 'trace'
  }
};

const ES_INDEXES = {
  production: {
    TRANSACTIONS: 'digital-gold-transactions',
    GOLD_MARKUP_HISTORY: 'gold-markup-history'
  },
  staging: {
    TRANSACTIONS: 'digital-gold-transactions-new',
    GOLD_MARKUP_HISTORY: 'gold-markup-history'
  },
  local: {
    TRANSACTIONS: 'digital-gold-transactions-new',
    GOLD_MARKUP_HISTORY: 'gold-markup-history'
  }
};

const TXN_TYPES = ['buy', 'sell', 'redeem', 'goldback'];

/**
 * Get ES configuration for current environment
 */
export function getESConfig() {
  const env = process.env.NODE_ENV || 'local';
  return ES_CONFIG[env] || ES_CONFIG.local;
}

/**
 * Get ES indexes for current environment
 */
export function getESIndexes() {
  const env = process.env.NODE_ENV || 'local';
  return ES_INDEXES[env] || ES_INDEXES.local;
}

/**
 * Get transaction types
 */
export function getTxnTypes() {
  return TXN_TYPES;
}

export default {
  getESConfig,
  getESIndexes,
  getTxnTypes
};

