import { logger } from '../utils/logger.js';
import { executeWorkflow } from '../services/workflow.service.js';

/**
 * Controller for handling issue debugging requests
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function debugIssue(req, res) {
  try {
    const { subject, body, metadata } = req.body;

    logger.info('📥 Received debug issue request', {
      subject,
      bodyLength: body?.length || 0,
      metadata
    });

    // Execute the LangGraph workflow
    const result = await executeWorkflow(subject, body, metadata);

    // Check if validation failed
    if (!result.hasRequiredFields) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields',
        missingFields: result.missingFields,
        data: result
      });
    }

    // Return successful analysis
    res.status(200).json({
      status: 'success',
      message: 'Issue analyzed successfully',
      data: {
        subject: result.subject,
        body: result.body,
        metadata: result.metadata,
        classification: {
          priority: result.priority,
          category: result.category,
          reasoning: result.classificationReasoning
        },
        processedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('❌ Error in debugIssue controller:', error);
    res.status(500).json({
      status: 'error',
      error: 'Internal Server Error',
      message: error.message || 'Failed to process issue'
    });
  }
}

