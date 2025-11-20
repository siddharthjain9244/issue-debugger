/**
 * Kibana Log Service
 * 
 * Queries Kibana for application logs using the console proxy API.
 * Supports time-based queries with IST timezone handling.
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { logger } from '../utils/logger.js';

/**
 * Make POST request to Kibana API
 * 
 * @param {string} urlStr - Full URL to query
 * @param {Object} payload - JSON payload
 * @param {Object} headers - Request headers
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Object>} Response JSON
 */
function postJson(urlStr, payload, headers = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const isHttps = u.protocol === 'https:';
    const body = Buffer.from(JSON.stringify(payload), 'utf-8');
    
    const options = {
      method: 'POST',
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: `${u.pathname}${u.search || ''}`,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
        ...headers,
      },
      timeout: timeoutMs,
    };
    
    const req = (isHttps ? https : http).request(options, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const text = buf.toString('utf-8');
        
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode} ${res.statusMessage}\n${text}`));
        }
        
        try {
          const json = JSON.parse(text);
          resolve(json);
        } catch (e) {
          reject(new Error(`Invalid JSON from Kibana\n${text}`));
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.write(body);
    req.end();
  });
}

/**
 * Build Elasticsearch query for Kibana
 * 
 * @param {Object} params - Query parameters
 * @returns {Object} Elasticsearch query body
 */
function buildEsQuery({ term, gte, lte, size = 200, from = 0, trackTotalHits = false, sortOrder = 'desc' }) {
  const filters = [];
  
  // Add search term filter
  if (term != null && String(term).trim().length > 0) {
    filters.push({
      multi_match: {
        type: 'best_fields',
        query: String(term),
        lenient: true,
      },
    });
  }
  
  // Add time range filter
  if (gte || lte) {
    const range = { '@timestamp': { format: 'strict_date_optional_time' } };
    if (gte) range['@timestamp'].gte = gte;
    if (lte) range['@timestamp'].lte = lte;
    filters.push({ range });
  }
  
  const body = {
    query: {
      bool: {
        must: [],
        filter: filters,
        should: [],
        must_not: [],
      },
    },
    sort: [{ '@timestamp': { order: sortOrder } }],
    size: Number(size) || 200,
    from: Math.max(0, Number(from) || 0),
    track_total_hits: Boolean(trackTotalHits),
  };
  
  return body;
}

/**
 * Extract minimal log data from Elasticsearch response
 * 
 * @param {Object} resp - Elasticsearch response
 * @returns {Array} Array of {ts, message} objects
 */
function minimalizeEsHits(resp) {
  const out = [];
  const hits = resp && resp.hits && resp.hits.hits;
  if (!Array.isArray(hits)) return out;
  
  for (const h of hits) {
    const src = h && h._source;
    if (!src || typeof src !== 'object') continue;
    
    const ts = src['@timestamp'] || '';
    let message = src.message;
    
    if (message == null) {
      const log = src.log && src.log.message;
      message = log != null ? log : '';
    }
    
    if (typeof message !== 'string') {
      try {
        message = JSON.stringify(message);
      } catch (_e) {
        message = String(message);
      }
    }
    
    out.push({ ts, message });
  }
  
  return out;
}

/**
 * Parse timing string to UTC milliseconds
 * Handles IST timezone if not specified
 * 
 * @param {string} timingStr - ISO timestamp (with or without timezone)
 * @returns {number|null} UTC milliseconds
 */
function parseTimingToUtcMs(timingStr) {
  if (!timingStr) return null;
  
  const hasTz = /[zZ]|[+\-]\d{2}:\d{2}$/.test(timingStr);
  let date;
  
  if (hasTz) {
    date = new Date(timingStr);
  } else {
    // Assume IST (+05:30) if no timezone
    date = new Date(`${timingStr}+05:30`);
  }
  
  if (isNaN(date.getTime())) return null;
  return date.getTime();
}

/**
 * Compute UTC time window around a center timestamp
 * 
 * @param {string} timingStr - Center timestamp
 * @param {number} windowMinutes - Window size in minutes (default: 10)
 * @returns {Object} {gte, lte} ISO timestamps
 */
function computeUtcWindowFromTiming(timingStr, windowMinutes = 10) {
  const centerMs = parseTimingToUtcMs(timingStr);
  
  if (centerMs == null) {
    throw new Error('Invalid timing; provide ISO with timezone or naive IST (YYYY-MM-DDTHH:mm:ss.SSS)');
  }
  
  const delta = Math.max(0, Number(windowMinutes) || 10) * 60 * 1000;
  const gte = new Date(centerMs - delta).toISOString();
  const lte = new Date(centerMs + delta).toISOString();
  
  return { gte, lte };
}

/**
 * Query Kibana for logs
 * 
 * @param {Object} opts - Query options
 * @returns {Promise<Object>} {logs, count, total, totalPages, page, records}
 */
export async function queryKibana(opts) {
  const {
    query,
    timing,
    windowMinutes,
    records,
    page,
    term,
    gte: gteIn,
    lte: lteIn,
    size: sizeIn,
    from: fromIn,
    baseUrl: baseUrlIn,
    index: indexIn,
    cookie: cookieIn,
    authorization: authorizationIn,
    timeoutMs = 15000,
  } = opts || {};

  const baseUrl = baseUrlIn || process.env.KIBANA_BASE_URL || 'https://gold-kibana.onus.paytmdgt.io';
  const index = indexIn || process.env.KIBANA_INDEX || 'digitalgold-backend*';
  const searchTerm = (term != null ? term : (query != null ? String(query) : ''));

  let gte = gteIn;
  let lte = lteIn;
  
  // Compute time window if timing provided
  const wm = windowMinutes != null ? Number(windowMinutes) : 30;
  if (timing && (!gte || !lte)) {
    const range = computeUtcWindowFromTiming(timing, wm);
    gte = range.gte;
    lte = range.lte;
  }
  
  if (!gte || !lte) {
    throw new Error('Provide timing (preferred) or gte and lte (ISO).');
  }

  const size = sizeIn != null ? Number(sizeIn) : (records != null ? Math.max(1, Number(records)) : 300);
  const from = fromIn != null ? Math.max(0, Number(fromIn)) : (() => {
    const p = page != null ? Number(page) : 1;
    return Math.max(0, (p - 1) * size);
  })();

  const pathParam = `/${index}/_search`;
  const proxyUrl = `${baseUrl.replace(/\/$/, '')}/api/console/proxy?path=${encodeURIComponent(pathParam)}&method=GET`;
  const body = buildEsQuery({ term: searchTerm, gte, lte, size, from, trackTotalHits: true, sortOrder: 'desc' });
  
  const headers = {
    'kbn-xsrf': 'kibana',
    'accept': 'application/json',
  };
  
  const cookie = cookieIn || process.env.KIBANA_COOKIE;
  const authorization = authorizationIn || process.env.KIBANA_AUTHORIZATION;
  if (cookie) headers['Cookie'] = cookie;
  if (authorization) headers['Authorization'] = authorization;
  
  try {
    const resp = await postJson(proxyUrl, body, headers, timeoutMs);
    const logs = minimalizeEsHits(resp);
    
    const hitsTotal = resp && resp.hits && resp.hits.total;
    let total = 0;
    if (typeof hitsTotal === 'number') total = hitsTotal;
    else if (hitsTotal && typeof hitsTotal.value === 'number') total = hitsTotal.value;
    
    const recordsOut = size;
    const pageOut = Math.max(1, Math.floor(from / Math.max(1, recordsOut)) + 1);
    const totalPages = Math.max(1, Math.ceil(total / Math.max(1, recordsOut)));
    
    return { logs, count: logs.length, total, totalPages, page: pageOut, records: recordsOut };
  } catch (error) {
    logger.error('Kibana query failed:', error.message);
    throw error;
  }
}

/**
 * Fetch Kibana logs with simplified interface
 * 
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Logs result
 */
export async function kibanaFetchLogs({
  query,
  gte,
  lte,
  size = 200,
  baseUrl,
  cookie,
  authorization,
}) {
  const base = baseUrl || process.env.KIBANA_BASE_URL || 'https://gold-kibana.onus.paytmdgt.io';
  const index = process.env.KIBANA_INDEX || 'digitalgold-backend*';
  
  return await queryKibana({
    baseUrl: base,
    index,
    term: query || '',
    gte,
    lte,
    size,
    cookie: cookie || process.env.KIBANA_COOKIE,
    authorization: authorization || process.env.KIBANA_AUTHORIZATION,
  });
}

export default {
  queryKibana,
  kibanaFetchLogs,
  computeUtcWindowFromTiming
};
