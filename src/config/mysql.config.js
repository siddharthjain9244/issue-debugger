import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * MySQL Configuration
 * 
 * Manages MySQL cluster connection settings for different environments
 * Based on actual production configuration
 */

const MYSQL_CONFIG = {
  production: {
    MASTER: {
      host: 'prod-gold-redash.cc2bisep87zr.ap-south-1.rds.amazonaws.com',
      port: 3310,
      user: process.env.MYSQL_CLUSTER_MASTER_USER,
      password: process.env.MYSQL_CLUSTER_MASTER_PASSWORD,
      database: process.env.MYSQL_CLUSTER_MASTER_DATABASE,
      connectionLimit: 35,
      waitForConnections: true,
      queueLimit: 100,
      maxIdle: 10,
      acquireTimeout: 30000, // milliseconds
      idleTimeout: 60000,
      multipleStatements: false, // Security: disabled for read-only operations
      pool: {
        min: 5,
        max: 35,
        evictionRunInterval: 1000,
        idleTimeoutMillis: 30000,
        softIdleTimeoutMillis: 20000,
        testOnBorrow: true
      }
    },
    SLAVE: {
      host: 'prod-gold-redash.cc2bisep87zr.ap-south-1.rds.amazonaws.com',
      port: 3310,
      user: process.env.MYSQL_CLUSTER_SLAVE_USER,
      password: process.env.MYSQL_CLUSTER_SLAVE_PASSWORD,
      database: process.env.MYSQL_CLUSTER_SLAVE_DATABASE,
      connectionLimit: 35,
      waitForConnections: true,
      queueLimit: 100,
      maxIdle: 10,
      acquireTimeout: 30000,
      idleTimeout: 60000,
      multipleStatements: false,
      pool: {
        min: 5,
        max: 35,
        evictionRunInterval: 1000,
        idleTimeoutMillis: 30000,
        softIdleTimeoutMillis: 20000,
        testOnBorrow: true
      }
    },
    SLAVE_2: {
      host: 'prod-gold-redash.cc2bisep87zr.ap-south-1.rds.amazonaws.com',
      port: 3310,
      user: process.env.MYSQL_CLUSTER_SLAVE_2_USER,
      password: process.env.MYSQL_CLUSTER_SLAVE_2_PASSWORD,
      database: process.env.MYSQL_CLUSTER_SLAVE_2_DATABASE,
      connectionLimit: 35,
      waitForConnections: true,
      queueLimit: 100,
      maxIdle: 10,
      acquireTimeout: 30000,
      idleTimeout: 60000,
      multipleStatements: false,
      pool: {
        min: 5,
        max: 35,
        evictionRunInterval: 1000,
        idleTimeoutMillis: 30000,
        softIdleTimeoutMillis: 20000,
        testOnBorrow: true
      }
    }
  },
  
  staging: {
    MASTER: {
      host: '10.123.4.242',
      port: 3310,
      user: process.env.MYSQL_CLUSTER_MASTER_USER,
      password: process.env.MYSQL_CLUSTER_MASTER_PASSWORD,
      database: process.env.MYSQL_CLUSTER_MASTER_DATABASE,
      charset: 'utf8mb4',
      connectionLimit: 2,
      waitForConnections: true,
      queueLimit: 0,
      acquireTimeout: 120000,
      multipleStatements: false
    },
    SLAVE: {
      host: '10.123.4.242',
      port: 3310,
      user: process.env.MYSQL_CLUSTER_SLAVE_USER,
      password: process.env.MYSQL_CLUSTER_SLAVE_PASSWORD,
      database: process.env.MYSQL_CLUSTER_SLAVE_DATABASE,
      charset: 'utf8mb4',
      connectionLimit: 2,
      waitForConnections: true,
      queueLimit: 0,
      acquireTimeout: 120000,
      multipleStatements: false
    },
    SLAVE_2: {
      host: '10.123.4.242',
      port: 3310,
      user: process.env.MYSQL_CLUSTER_SLAVE_2_USER,
      password: process.env.MYSQL_CLUSTER_SLAVE_2_PASSWORD,
      database: process.env.MYSQL_CLUSTER_SLAVE_2_DATABASE,
      charset: 'utf8mb4',
      connectionLimit: 2,
      waitForConnections: true,
      queueLimit: 0,
      acquireTimeout: 120000,
      multipleStatements: false
    }
  },
  
  local: {
    MASTER: {
      host: 'localhost',
      user: process.env.MYSQL_CLUSTER_MASTER_USER,
      password: process.env.MYSQL_CLUSTER_MASTER_PASSWORD,
      database: process.env.MYSQL_CLUSTER_MASTER_DATABASE,
      charset: 'utf8mb4',
      connectionLimit: 2,
      waitForConnections: true,
      queueLimit: 0,
      acquireTimeout: 120000,
      multipleStatements: false
    },
    SLAVE: {
      host: 'localhost',
      user: process.env.MYSQL_CLUSTER_SLAVE_USER,
      password: process.env.MYSQL_CLUSTER_SLAVE_PASSWORD,
      database: process.env.MYSQL_CLUSTER_SLAVE_DATABASE,
      charset: 'utf8mb4',
      connectionLimit: 2,
      waitForConnections: true,
      queueLimit: 0,
      acquireTimeout: 120000,
      multipleStatements: false
    },
    SLAVE_2: {
      host: 'localhost',
      user: process.env.MYSQL_CLUSTER_SLAVE_2_USER,
      password: process.env.MYSQL_CLUSTER_SLAVE_2_PASSWORD,
      database: process.env.MYSQL_CLUSTER_SLAVE_2_DATABASE,
      charset: 'utf8mb4',
      connectionLimit: 2,
      waitForConnections: true,
      queueLimit: 0,
      acquireTimeout: 120000,
      multipleStatements: false
    }
  }
};

// For local and staging, SLAVE nodes point to MASTER (same as original config)
// This is already configured above, but keeping logic explicit
MYSQL_CONFIG.local.SLAVE = MYSQL_CONFIG.local.MASTER;
MYSQL_CONFIG.local.SLAVE_2 = MYSQL_CONFIG.local.MASTER;
MYSQL_CONFIG.staging.SLAVE = MYSQL_CONFIG.staging.MASTER;
MYSQL_CONFIG.staging.SLAVE_2 = MYSQL_CONFIG.staging.MASTER;

const MYSQL_SETTINGS = {
  production: {
    canRetry: true,
    restoreNodeTimeout: 3000,
    removeNodeErrorCount: 50000,
    queryTimeout: 60 * 1000 // 60 seconds
  },
  staging: {
    canRetry: true,
    restoreNodeTimeout: 3000,
    removeNodeErrorCount: 10000,
    queryTimeout: 60 * 1000
  },
  local: {
    canRetry: true,
    restoreNodeTimeout: 3000,
    removeNodeErrorCount: 10000,
    queryTimeout: 60 * 1000
  }
};

/**
 * Get MySQL configuration for current environment
 * For read operations, use SLAVE; for write operations, use MASTER
 * 
 * @param {string} nodeType - 'MASTER', 'SLAVE', or 'SLAVE_2'
 * @returns {Object} MySQL connection configuration
 */
export function getMySQLConfig(nodeType = 'SLAVE') {
  const env = process.env.NODE_ENV || 'local';
  const config = MYSQL_CONFIG[env] || MYSQL_CONFIG.local;
  
  // Debug: Log if credentials are missing (helps with troubleshooting)
  const selectedConfig = nodeType === 'MASTER' ? config.MASTER : 
                         nodeType === 'SLAVE_2' && config.SLAVE_2 ? config.SLAVE_2 : 
                         (config.SLAVE || config.MASTER);
  
  if (!selectedConfig.user || !selectedConfig.database) {
    console.warn(`⚠️  MySQL config warning for ${env}/${nodeType}:`);
    console.warn(`   - User: ${selectedConfig.user || 'MISSING'}`);
    console.warn(`   - Database: ${selectedConfig.database || 'MISSING'}`);
    console.warn(`   - Make sure environment variables are set in .env file`);
  }
  
  // For read operations (SELECT), prefer SLAVE nodes
  // Production has multiple SLAVE nodes for load balancing
  if (nodeType === 'MASTER') {
    return config.MASTER;
  }
  
  if (nodeType === 'SLAVE_2' && config.SLAVE_2) {
    return config.SLAVE_2;
  }
  
  // Default to SLAVE, fallback to MASTER if SLAVE not available
  return config.SLAVE || config.MASTER;
}

/**
 * Get MySQL settings for current environment
 */
export function getMySQLSettings() {
  const env = process.env.NODE_ENV || 'local';
  return MYSQL_SETTINGS[env] || MYSQL_SETTINGS.local;
}

export default {
  getMySQLConfig,
  getMySQLSettings
};

