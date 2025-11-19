import mysql from 'mysql2/promise';
import { logger } from '../utils/logger.js';
import { getMySQLConfig, getMySQLSettings } from '../config/mysql.config.js';

/**
 * MySQL Service
 * 
 * Provides connection pooling and query execution for MySQL database.
 * Uses SLAVE nodes for read operations (SELECT queries).
 */

let connectionPool = null;

/**
 * Initialize MySQL connection pool
 * 
 * @param {string} nodeType - 'MASTER' or 'SLAVE' (default: SLAVE for reads)
 * @returns {Promise<Pool>} MySQL connection pool
 */
export async function initMySQLPool(nodeType = 'SLAVE') {
  if (connectionPool) {
    return connectionPool;
  }

  try {
    const config = getMySQLConfig(nodeType);
    
    connectionPool = mysql.createPool(config);

    // Test connection
    const connection = await connectionPool.getConnection();
    logger.info('✅ MySQL connection pool initialized successfully');
    connection.release();

    return connectionPool;

  } catch (error) {
    logger.error('❌ Failed to initialize MySQL connection pool:', error);
    throw error;
  }
}

/**
 * Execute a single SQL query
 * 
 * @param {string} query - SQL query to execute
 * @param {Array} params - Query parameters (for prepared statements)
 * @returns {Promise<Object>} Query results
 */
export async function executeQuery(query, params = []) {
  try {
    // Ensure pool is initialized
    if (!connectionPool) {
      await initMySQLPool('SLAVE'); // Use SLAVE for read operations
    }

    const settings = getMySQLSettings();
    const startTime = Date.now();

    logger.info('🗄️  Executing SQL query');
    logger.debug('SQL:', { query, params });

    // Execute query with timeout
    const [rows, fields] = await connectionPool.query({
      sql: query,
      timeout: settings.queryTimeout,
      values: params
    });

    const executionTime = Date.now() - startTime;
    logger.info(`✅ SQL query executed successfully in ${executionTime}ms, rows: ${rows.length}`);

    return {
      success: true,
      rows: rows,
      rowCount: rows.length,
      fields: fields,
      executionTime: executionTime
    };

  } catch (error) {
    logger.error('❌ SQL query execution failed:', error);
    logger.error('Failed query:', query);
    
    return {
      success: false,
      error: error.message,
      code: error.code,
      rows: []
    };
  }
}

/**
 * Execute multiple SQL queries sequentially
 * 
 * @param {Array<string>} queries - Array of SQL queries
 * @returns {Promise<Object>} Combined results from all queries
 */
export async function executeMultipleQueries(queries) {
  try {
    logger.info(`🗄️  Executing ${queries.length} SQL queries`);

    const results = [];
    
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      logger.info(`Executing query ${i + 1}/${queries.length}`);
      
      const result = await executeQuery(query);
      results.push({
        queryIndex: i,
        query: query,
        ...result
      });
    }

    const totalRows = results.reduce((sum, r) => sum + (r.rowCount || 0), 0);
    logger.info(`✅ All queries executed: ${totalRows} total rows`);

    return {
      success: true,
      results: results,
      totalQueries: queries.length,
      totalRows: totalRows
    };

  } catch (error) {
    logger.error('❌ Multiple query execution failed:', error);
    
    return {
      success: false,
      error: error.message,
      results: []
    };
  }
}

/**
 * Extract specific fields from SQL results
 * Useful for getting order IDs, customer IDs, etc.
 * 
 * @param {Array} rows - SQL result rows
 * @param {string} fieldName - Field name to extract
 * @returns {Array} Array of field values
 */
export function extractField(rows, fieldName) {
  if (!rows || rows.length === 0) {
    return [];
  }
  
  return rows
    .map(row => row[fieldName])
    .filter(val => val !== null && val !== undefined);
}

/**
 * Close MySQL connection pool
 */
export async function closeMySQLPool() {
  if (connectionPool) {
    await connectionPool.end();
    connectionPool = null;
    logger.info('🔌 MySQL connection pool closed');
  }
}

