import express from 'express';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
import issueRouter from './routes/issue.routes.js';
import { initESClient } from './services/elasticsearch.service.js';
import { initMySQLPool } from './services/mysql.service.js';
import { initializeSchemaVectorStore } from './services/schema-vector-store.service.js';
import { initializeKnowledgeBaseVectorStore } from './services/knowledge-base-vector-store.service.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    body: req.body,
    query: req.query
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'langchain-issue-debugger'
  });
});

// API routes
app.use('/api/v1/issues', issueRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Initialize services and start server
async function startServer() {
  try {
    logger.info('🔧 Initializing services...');
    logger.info('');
    
    // Initialize schema vector store
    try {
      await initializeSchemaVectorStore();
      logger.info('✅ Schema vector store initialized (table embeddings ready)');
    } catch (error) {
      logger.error('❌ Vector store initialization failed:', error.message);
      throw error; // Critical - cannot proceed without schema embeddings
    }
    
    // Initialize knowledge base vector store
    try {
      await initializeKnowledgeBaseVectorStore();
      logger.info('✅ Knowledge base vector store initialized (flow documentation ready)');
    } catch (error) {
      logger.error('❌ Knowledge base initialization failed:', error.message);
      throw error; // Critical - cannot proceed without knowledge base
    }
    
    // Check MySQL connectivity
    try {
      await initMySQLPool('SLAVE');
      logger.info('✅ MySQL connection pool initialized and ready');
    } catch (error) {
      logger.error('❌ MySQL connection failed:', error.message);
      logger.warn('⚠️  Server will start but SQL queries will fail');
    }
    
    // Check Elasticsearch connectivity
    try {
      const esClient = await initESClient();
      if (esClient) {
        logger.info('✅ Elasticsearch client initialized and ready');
      } else {
        logger.warn('⚠️  Elasticsearch not available - ES queries will be skipped');
      }
    } catch (error) {
      logger.warn('⚠️  Elasticsearch connection failed:', error.message);
      logger.warn('⚠️  ES queries will be skipped (OK for local development)');
    }
    
    // Start server
    app.listen(PORT, () => {
      logger.info('');
      logger.info('='.repeat(60));
      logger.info(`🚀 Server is running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🐛 Debug API: http://localhost:${PORT}/api/v1/issues/debug`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'local'}`);
      logger.info('='.repeat(60));
      logger.info('');
    });
    
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

