/**
 * Kibana Query Node (Simple & Deterministic)
 * 
 * Simple rules:
 * 1. If order_id + timestamp in DB → Query order_id with ±30 min window
 * 2. If order_id but no timestamp → Query order_id directly (no time filter)
 * 3. If no order_id but customer_id → Query customer_id with ±60 min window
 * 
 * Features:
 * - Paginates through ALL available logs
 * - Max logs: 1000
 * - UTC to IST conversion for timestamps
 */

import { logger } from '../utils/logger.js';
import { queryKibana } from '../services/kibana.service.js';

/**
 * Convert UTC timestamp to IST string format
 * 
 * @param {Date} utcDate - UTC Date object
 * @returns {string} ISO string with IST time and +05:30 offset (e.g., 2025-11-20T12:18:11.000+05:30)
 */
function convertUTCtoIST(utcDate) {
  // Get UTC components
  const year = utcDate.getUTCFullYear();
  const month = utcDate.getUTCMonth();
  const day = utcDate.getUTCDate();
  const hours = utcDate.getUTCHours();
  const minutes = utcDate.getUTCMinutes();
  const seconds = utcDate.getUTCSeconds();
  const ms = utcDate.getUTCMilliseconds();
  
  // Add IST offset (5 hours 30 minutes)
  let istHours = hours + 5;
  let istMinutes = minutes + 30;
  let istDay = day;
  let istMonth = month;
  let istYear = year;
  
  // Handle minute overflow
  if (istMinutes >= 60) {
    istMinutes -= 60;
    istHours += 1;
  }
  
  // Handle hour overflow
  if (istHours >= 24) {
    istHours -= 24;
    istDay += 1;
    
    // Handle day overflow (simplified - just increment, Date object handles month boundaries)
    const tempDate = new Date(Date.UTC(istYear, istMonth, istDay));
    istYear = tempDate.getUTCFullYear();
    istMonth = tempDate.getUTCMonth();
    istDay = tempDate.getUTCDate();
  }
  
  // Format as ISO string with +05:30 offset
  const monthStr = String(istMonth + 1).padStart(2, '0');
  const dayStr = String(istDay).padStart(2, '0');
  const hoursStr = String(istHours).padStart(2, '0');
  const minutesStr = String(istMinutes).padStart(2, '0');
  const secondsStr = String(seconds).padStart(2, '0');
  const msStr = String(ms).padStart(3, '0');
  
  return `${istYear}-${monthStr}-${dayStr}T${hoursStr}:${minutesStr}:${secondsStr}.${msStr}+05:30`;
}

/**
 * Generate simple, deterministic Kibana queries
 * 
 * Rules:
 * 1. If order_id + timestamp → query order_id with ±30 min window
 * 2. If order_id without timestamp → query order_id directly
 * 3. If no order_id but customer_id → query customer_id with ±60 min window
 * 
 * @param {Object} state - Current workflow state
 * @returns {Array} Array of query parameter objects
 */
function generateSimpleKibanaQueries(state) {
  const queries = [];
  const orderIds = state.sqlData?.orderIds || [];
  const customerIds = state.sqlData?.customerIds || [];
  const sqlTimestamp = extractTimestampFromSqlData(state.sqlData);

  // Get current time in IST if needed
  const getCurrentTimeIST = () => {
    const now = new Date(); // Current time (system will give local time, but we treat as UTC)
    return convertUTCtoIST(now);
  };

  // RULE 1 & 2: Query by order_id (with or without timestamp)
  if (orderIds.length > 0) {
    // Take first 2 order_ids max
    orderIds.slice(0, 2).forEach(orderId => {
      if (sqlTimestamp) {
        // Has timestamp from DB → use with time window
        queries.push({
          query: String(orderId),
          timing: sqlTimestamp,
          windowMinutes: 30, // ±30 minutes
          records: 500,
          strategy: 'order_id_with_timestamp'
        });
        logger.info(`   📋 Query: order_id=${orderId} with timestamp window (±30 min)`);
      } else {
        // No timestamp → query directly without time filter
        queries.push({
          query: String(orderId),
          windowMinutes: 60, // Wider window since no reference point
          records: 500,
          strategy: 'order_id_no_timestamp'
        });
        logger.info(`   📋 Query: order_id=${orderId} without timestamp (±60 min from now)`);
      }
    });
  }
  
  // RULE 3: Query by customer_id (if no order_id)
  else if (customerIds.length > 0) {
    const customerId = customerIds[0]; // Use first customer_id
    
    queries.push({
      query: String(customerId),
      timing: getCurrentTimeIST(), // Use current time
      windowMinutes: 60, // Bigger time frame (±60 minutes)
      records: 500,
      strategy: 'customer_id_wider_window'
    });
    logger.info(`   📋 Query: customer_id=${customerId} with wider window (±60 min)`);
  }

  return queries;
}


/**
 * Extract timestamp from SQL data and convert UTC to IST
 * 
 * Database format: "2025-11-20 06:48:11" (UTC, space-separated)
 * Kibana format:   "2025-11-20T12:18:11.000+05:30" (IST with offset)
 * 
 * IST = UTC + 5:30
 * 
 * @param {Object} sqlData - SQL execution results
 * @returns {string|null} ISO timestamp in IST format or null
 */
function extractTimestampFromSqlData(sqlData) {
  if (!sqlData || !sqlData.rows || sqlData.rows.length === 0) return null;
  
  // Look for created_at or updated_at fields
  const row = sqlData.rows[0];
  const timestamp = row.created_at || row.updated_at || row.createdAt || row.updatedAt;
  const date = new Date(timestamp);
  const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
  return istDate.toString();
  
  if (timestamp) {
    try {
      // Database format: "2025-11-20 06:48:11" (UTC)
      // Replace space with 'T' to make it ISO-compatible, then add 'Z' for UTC
      let dateString = String(timestamp).trim();
      
      // If it's already in ISO format (has 'T'), use as-is
      // Otherwise, convert "YYYY-MM-DD HH:mm:ss" to "YYYY-MM-DDTHH:mm:ssZ"
      if (!dateString.includes('T')) {
        dateString = dateString.replace(' ', 'T') + 'Z';
      } else if (!dateString.endsWith('Z') && !dateString.includes('+')) {
        dateString += 'Z'; // Add Z if no timezone indicator
      }
      
      // Parse as UTC
      const utcDate = new Date(dateString);
      
      if (isNaN(utcDate.getTime())) {
        logger.warn('Invalid timestamp from SQL data:', timestamp);
        return null;
      }
      
      // Convert UTC to IST format string
      const istString = convertUTCtoIST(utcDate);
      
      logger.info(`   📅 Timestamp: DB="${timestamp}" → UTC="${utcDate.toISOString()}" → IST="${istString}"`);
      
      return istString;
    } catch (e) {
      logger.warn('Failed to parse/convert timestamp from SQL data:', timestamp, e.message);
    }
  }
  
  return null;
}

/**
 * Fetch ALL logs for a single query with pagination
 * 
 * @param {Object} queryParams - Kibana query parameters
 * @param {number} maxLogs - Maximum logs to fetch
 * @returns {Promise<Array>} Array of all fetched logs
 */
async function fetchAllLogsForQuery(queryParams, maxLogs = 1000) {
  const allLogs = [];
  let page = 1;
  let hasMore = true;

  logger.info(`🔄 Fetching logs for query: "${queryParams.query}" (paginating until exhausted)`);

  while (hasMore && allLogs.length < maxLogs) {
    try {
      const result = await queryKibana({
        ...queryParams,
        page: page,
        records: Math.min(200, maxLogs - allLogs.length) // Fetch 200 per page or remaining
      });

      if (result.logs && result.logs.length > 0) {
        allLogs.push(...result.logs);
        logger.info(`   📄 Page ${page}: Found ${result.logs.length} logs (total so far: ${allLogs.length})`);
        
        // Check if there are more pages
        if (page >= result.totalPages || allLogs.length >= result.total) {
          hasMore = false;
          logger.info(`   ✅ Reached end: ${result.total} total logs available`);
        } else {
          page++;
        }
      } else {
        hasMore = false;
        logger.info(`   ✅ No more logs found`);
      }

      // Safety: Stop if we've fetched enough
      if (allLogs.length >= maxLogs) {
        hasMore = false;
        logger.info(`   ⚠️  Reached max limit of ${maxLogs} logs`);
      }

    } catch (error) {
      logger.error(`   ❌ Error fetching page ${page}:`, error.message);
      hasMore = false; // Stop on error
    }
  }

  logger.info(`✅ Completed fetching: ${allLogs.length} total logs for "${queryParams.query}"`);
  return allLogs;
}

/**
 * Remove duplicate logs (by timestamp + message signature)
 * 
 * @param {Array} logs - Array of log objects
 * @returns {Array} Deduplicated logs
 */
function deduplicateLogs(logs) {
  const seen = new Set();
  const unique = [];

  for (const log of logs) {
    const signature = `${log.ts}_${log.message.substring(0, 100)}`;
    if (!seen.has(signature)) {
      seen.add(signature);
      unique.push(log);
    }
  }

  if (logs.length !== unique.length) {
    logger.info(`   🔄 Removed ${logs.length - unique.length} duplicate logs`);
  }

  return unique;
}

/**
 * Kibana Query Node (AI-Driven with Full Pagination)
 * 
 * Uses AI to generate intelligent queries and fetches ALL available logs
 * 
 * @param {Object} state - Current workflow state
 * @returns {Promise<Object>} Updated state with Kibana logs
 */
export async function kibanaQueryNode(state) {
  logger.info('📋 Executing kibana_query_node (AI-driven with pagination)');
  
  // CRITICAL: Check if we have at least one customer_id or order_id
  const orderIds = state.sqlData?.orderIds || [];
  const customerIds = state.sqlData?.customerIds || [];
  
  if (orderIds.length === 0 && customerIds.length === 0) {
    logger.error('❌ CANNOT query Kibana - no customer_id or order_id found in SQL data');
    logger.error('   This is REQUIRED for targeted log searches');
    return {
      ...state,
      kibanaLogs: [],
      kibanaLogCount: 0,
      kibanaSkipped: true,
      kibanaError: 'No customer_id or order_id available for Kibana queries (REQUIRED)'
    };
  }
  
  logger.info(`✅ Pre-check passed: ${orderIds.length} order_ids, ${customerIds.length} customer_ids available`);
  
  // Check if Kibana credentials are available (graceful skip if not)
//   if (!process.env.KIBANA_COOKIE && !process.env.KIBANA_AUTHORIZATION) {
//     logger.warn('⚠️  Kibana credentials not configured, skipping log fetching');
//     return {
//       ...state,
//       kibanaLogs: [],
//       kibanaLogCount: 0,
//       kibanaSkipped: true,
//       kibanaError: 'Kibana credentials not configured'
//     };
//   }
  
  try {
    // Extract timestamp early for logging
    const sqlTimestamp = extractTimestampFromSqlData(state.sqlData);
    if (sqlTimestamp) {
      logger.info(`⏰ Reference timestamp from SQL (IST): ${sqlTimestamp}`);
    } else {
      logger.info('⏰ No timestamp in SQL data, will use wider time window');
    }
    
    logger.info('🔍 Step 1: Generating simple Kibana queries...');
    
    // Generate queries using simple deterministic rules
    const queries = generateSimpleKibanaQueries(state);
    
    if (!queries || queries.length === 0) {
      logger.warn('⚠️  No queries generated, skipping');
      return {
        ...state,
        kibanaLogs: [],
        kibanaLogCount: 0,
        kibanaSkipped: true,
        kibanaError: 'No queries could be generated'
      };
    }

    logger.info(`🔍 Step 2: Executing ${queries.length} queries with full pagination...`);
    
    const allLogs = [];
    const queryDetails = [];
    
    // Execute each query with full pagination
    for (let i = 0; i < queries.length; i++) {
      const queryParams = queries[i];
      logger.info(`\n🔍 Query ${i + 1}/${queries.length}: "${queryParams.query}"`);
      logger.info(`   Strategy: ${queryParams.strategy}`);
      if (queryParams.timing) {
        logger.info(`   Timing (IST): ${queryParams.timing}`);
      }
      logger.info(`   Window: ±${queryParams.windowMinutes} minutes`);
      
      try {
        // Fetch ALL logs for this query (with pagination)
        const logs = await fetchAllLogsForQuery(queryParams, 1000);
        
        if (logs.length > 0) {
          allLogs.push(...logs);
          queryDetails.push({
            query: queryParams.query,
            logsFound: logs.length,
            strategy: queryParams.strategy,
            windowMinutes: queryParams.windowMinutes,
            timing: queryParams.timing || 'N/A',
            success: true
          });
        } else {
          queryDetails.push({
            query: queryParams.query,
            logsFound: 0,
            strategy: queryParams.strategy,
            success: true,
            note: 'No logs found for this query'
          });
        }
        
      } catch (error) {
        logger.error(`❌ Query failed for "${queryParams.query}":`, error.message);
        queryDetails.push({
          query: queryParams.query,
          strategy: queryParams.strategy,
          success: false,
          error: error.message
        });
      }
      
      // Stop if we've collected enough logs
      if (allLogs.length >= 1000) {
        logger.info(`⚠️  Reached 1000 log limit, stopping further queries`);
        break;
      }
    }
    
    logger.info(`\n📊 Step 3: Deduplicating and finalizing logs...`);
    
    // Remove duplicates
    // const uniqueLogs = deduplicateLogs(allLogs);
    
    // Limit to 1000 logs max
    const finalLogs = allLogs.slice(0, 1000);
    
    if (finalLogs.length === 0) {
      logger.warn('⚠️  No logs found for any query');
      return {
        ...state,
        kibanaLogs: [],
        kibanaLogCount: 0,
        kibanaQueryDetails: queryDetails,
        kibanaSkipped: false,
        kibanaError: 'No logs found'
      };
    }
    
    logger.info(`✅ Kibana query completed successfully!`);
    logger.info(`   Total logs fetched: ${allLogs.length}`);
    logger.info(`   After deduplication: ${allLogs.length}`);
    logger.info(`   Final logs: ${finalLogs.length} (max 1000)`);
    logger.info(`   Queries executed: ${queryDetails.length}`);
    logger.info(`   Successful queries: ${queryDetails.filter(q => q.success).length}`);
    
    return {
      ...state,
      kibanaLogs: finalLogs,
      kibanaLogCount: finalLogs.length,
      kibanaQueryDetails: queryDetails,
      kibanaSkipped: false,
      kibanaError: null
    };
    
  } catch (error) {
    logger.error('❌ Error in kibana_query_node:', error);
    
    return {
      ...state,
      kibanaLogs: [],
      kibanaLogCount: 0,
      kibanaQueryDetails: [],
      kibanaSkipped: false,
      kibanaError: error.message
    };
  }
}

export default kibanaQueryNode;

