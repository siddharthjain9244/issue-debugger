import { logger } from '../utils/logger.js';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { findRelevantTables } from '../services/schema-vector-store.service.js';

/**
 * SQL Query Node
 * 
 * This node generates SQL queries to extract relevant data from the database.
 * 
 * RAG (Retrieval Augmented Generation) Approach:
 * 1. Use vector similarity search to find relevant tables (not all 90+ tables!)
 * 2. Retrieve only 5-10 most relevant table schemas
 * 3. Pass ONLY these schemas to the LLM
 * 4. LLM generates SQL using only the provided tables
 * 
 * Benefits:
 * - Reduces token usage by 90%
 * - Improves accuracy (focused context)
 * - Faster generation
 * - Scales to large databases
 * 
 * @param {Object} state - Current workflow state
 * @returns {Object} Updated state with SQL query
 */
export async function sqlQueryNode(state) {
  logger.info('💾 Executing sql_query_node');

  try {
    // Build the user query from issue details
    const userQuery = `${state.subject}\n${state.body}`;
    
    logger.info('📋 User query:', { query: userQuery });

    // Step 1: RETRIEVAL - Find relevant tables using vector similarity search
    // This is the key RAG step - we don't send all 90+ tables to the LLM
    logger.info('🔍 Step 1: Finding relevant tables via similarity search...');
    
    const relevantTables = await findRelevantTables(userQuery, 6);
    
    logger.info('✅ Retrieved relevant tables:', {
      count: relevantTables.length,
      tables: relevantTables.map(t => t.tableName)
    });

    // Step 2: Format the relevant schemas for the LLM prompt
    const schemasContext = relevantTables
      .map(table => table.fullSchema)
      .join('\n\n---\n\n');

    logger.info('📝 Step 2: Formatted schemas context');

    // Step 3: GENERATION - Use LLM to generate SQL query
    logger.info('🤖 Step 3: Generating SQL query with LLM...');

    const sqlGenerationPrompt = PromptTemplate.fromTemplate(`
You are an expert SQL query generator for a MySQL 8.0 database of a Digital Gold Wealth Management platform.

USER QUERY:
{userQuery}

ISSUE PRIORITY: {priority}
ISSUE CATEGORY: {category}

RELEVANT DATABASE TABLES:
Only use the tables and columns listed below. DO NOT invent or guess any other tables/columns.

{schemasContext}

YOUR TASK:
Generate a valid MySQL 8.0 SELECT query that will help diagnose and debug the issue described above.

RULES:
1. Use ONLY the tables and columns listed above
2. Generate ONLY SELECT queries (no INSERT, UPDATE, DELETE, DROP)
3. AVOID JOIN queries unless absolutely necessary - prefer querying single tables when possible
4. Use proper JOINs on customer_id, order_id ONLY when you need data from multiple tables
5. Add WHERE clauses to filter relevant data (e.g., customer_id, date ranges)
6. Include ORDER BY for chronological analysis (usually created_at DESC)
7. Add LIMIT clause to prevent overwhelming results (typically 50-100 rows)
8. Use table aliases for readability
9. If customer_id is mentioned in query, add it to WHERE clause
10. If time range is mentioned, add date filters
11. Return actual SQL query, not explanation

SPECIAL RULES FOR CUSTOMER_PORTFOLIO:
12. **CRITICAL**: If customer_id is mentioned in the query, ALWAYS include a query for customer_portfolio table
13. **CRITICAL**: For customer_portfolio queries, DO NOT add LIMIT clause - fetch ALL rows (portfolio data is small)
14. customer_portfolio shows gold balance: SELECT customer_id, merchant_id, gold_balance, weighted_average, created_at, updated_at FROM customer_portfolio WHERE customer_id = ?

Example when customer_id is present:
User query: "customer 1001656012 balance issue"
Response: {{
  "sql": [
    "SELECT * FROM customer_portfolio WHERE customer_id = 1001656012",
    "SELECT * FROM dg_buy_orders WHERE customer_id = 1001656012 ORDER BY created_at DESC LIMIT 50"
  ],
  "explanation": "Fetch complete portfolio and recent buy orders",
  "tables_used": ["customer_portfolio", "dg_buy_orders"]
}}

RESPONSE FORMAT:
Return ONLY a JSON object with this exact structure (no markdown, no extra text):
{{
  "sql": "SELECT ... FROM ... WHERE ... ORDER BY ... LIMIT ..." OR ["query1", "query2"] for multiple queries,
  "explanation": "Brief explanation of what this query will find",
  "tables_used": ["table1", "table2"]
}}

IMPORTANT: If you need to query multiple tables separately, return sql as an array of individual queries.
Example: {{"sql": ["SELECT * FROM table1 WHERE ...", "SELECT * FROM table2 WHERE ..."]}}
`);

    const llm = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.1, // Low temperature for precise SQL generation
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const chain = sqlGenerationPrompt.pipe(llm).pipe(new StringOutputParser());

    const result = await chain.invoke({
      userQuery,
      priority: state.priority || 'unknown',
      category: state.category || 'unknown',
      schemasContext
    });

    // Parse the JSON response
    const cleanedResult = result.trim()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '');
    
    const queryResult = JSON.parse(cleanedResult);

    // Handle SQL queries - can be string or array
    let sqlQueries = queryResult.sql;
    
    // If it's a string with multiple queries separated by semicolons, split them
    if (typeof sqlQueries === 'string') {
      // Split by semicolon and clean up
      const splitQueries = sqlQueries
        .split(';')
        .map(q => q.trim())
        .filter(q => q.length > 0); // Remove empty strings
      
      // If we found multiple queries, use array format
      sqlQueries = splitQueries.length > 1 ? splitQueries : splitQueries[0];
    }

    logger.info('✅ SQL query generated:', {
      tables: queryResult.tables_used,
      explanation: queryResult.explanation,
      queryCount: Array.isArray(sqlQueries) ? sqlQueries.length : 1
    });

    // Log the actual SQL (useful for debugging)
    if (Array.isArray(sqlQueries)) {
      logger.info('📄 Generated SQL queries:', { 
        count: sqlQueries.length,
        queries: sqlQueries 
      });
    } else {
      logger.info('📄 Generated SQL:', { sql: sqlQueries });
    }

    return {
      ...state,
      sqlQuery: sqlQueries, // Can be string or array
      sqlExplanation: queryResult.explanation,
      sqlTablesUsed: queryResult.tables_used,
      relevantTablesFound: relevantTables.map(t => t.tableName)
    };

  } catch (error) {
    logger.error('❌ Error in sql_query_node:', error);
    
    return {
      ...state,
      sqlQuery: null,
      error: `SQL generation failed: ${error.message}`
    };
  }
}

/**
 * Execute the generated SQL query against the database
 * (This will be implemented when we connect to actual database)
 * 
 * For now, this is a placeholder that shows how it would work
 * 
 * @param {string} sqlQuery - The SQL query to execute
 * @returns {Promise<Array>} Query results
 */
export async function executeSQLQuery(sqlQuery) {
  logger.info('🗄️  Executing SQL query:', { sql: sqlQuery });
  
  // TODO: Implement actual database connection
  // This would use the 'pg' package for PostgreSQL or 'mysql2' for MySQL
  
  // Example implementation (will be added later):
  // const connection = await mysql.createConnection({
  //   host: process.env.DB_HOST,
  //   user: process.env.DB_USER,
  //   password: process.env.DB_PASSWORD,
  //   database: process.env.DB_NAME
  // });
  // const [rows] = await connection.execute(sqlQuery);
  // await connection.end();
  // return rows;
  
  logger.warn('⚠️  SQL execution not yet implemented (placeholder)');
  return [];
}


