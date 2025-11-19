import { logger } from '../utils/logger.js';

/**
 * Controller for handling issue debugging requests
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function debugIssue(req, res) {
  try {
    const { subject, body, metadata } = req.body;

    // Basic validation
    if (!subject || !body) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Both "subject" and "body" fields are required'
      });
    }

    logger.info('Received debug issue request', {
      subject,
      bodyLength: body.length,
      metadata
    });

    // For now, just return a 200 response
    // We'll implement the LangGraph workflow in next steps
    res.status(200).json({
      status: 'success',
      message: 'Issue received successfully',
      data: {
        subject,
        body,
        metadata,
        receivedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error in debugIssue controller:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process issue'
    });
  }
}

