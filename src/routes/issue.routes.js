import express from 'express';
import { debugIssue } from '../controllers/issue.controller.js';

const router = express.Router();

/**
 * POST /api/v1/issues/debug
 * 
 * Request body:
 * {
 *   "subject": "Issue subject/title",
 *   "body": "Detailed description of the issue",
 *   "metadata": {
 *     "source": "email|chatbot|slack|jira|api",
 *     "priority": "low|medium|high|critical" (optional, will be classified)
 *   }
 * }
 */
router.post('/debug', debugIssue);

export default router;

