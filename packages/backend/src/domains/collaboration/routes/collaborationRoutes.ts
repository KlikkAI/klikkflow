/**
 * Collaboration Routes
 * REST API routes for collaboration sessions and comments
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../../middleware/auth';
import { relaxedRateLimit } from '../../../middleware/rate-limit.middleware';
import { CommentController } from '../controllers/CommentController';
import { SessionController } from '../controllers/SessionController';

const router: Router = Router();

// Initialize controllers
const sessionController = new SessionController();
const commentController = new CommentController();

// CodeQL fix: Fully inline rateLimit() call with NO variable assignment (Alert #140, #123, #47)
// CodeQL requires seeing rateLimit() API call DIRECTLY in router.use() - no intermediate variables
// Apply authentication and rate limiting to all collaboration routes
// Security guarantee: ALL routes below have rate limiting applied (100 req/15min per IP)
router.use(
  authenticate,
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window per IP
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true, // Return rate limit info in RateLimit-* headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
  })
);

// Session Management Routes
// GET /collaboration/sessions/:workflowId - Get active session for workflow
router.get('/sessions/:workflowId', relaxedRateLimit, sessionController.getSession);

// TODO: Implement remaining session controller methods
// POST /collaboration/sessions/:workflowId/join - Join or create session
// router.post('/sessions/:workflowId/join', sessionController.joinSession);

// GET /collaboration/sessions/user/:userId - Get user's sessions
// router.get('/sessions/user/:userId', sessionController.getUserSessions);

// GET /collaboration/sessions/:sessionId/operations - Get session operations
// router.get('/sessions/:sessionId/operations', sessionController.getSessionOperations);

// PATCH /collaboration/sessions/:sessionId/config - Update session config
// router.patch('/sessions/:sessionId/config', sessionController.updateSessionConfig);

// POST /collaboration/sessions/:sessionId/end - End session
// router.post('/sessions/:sessionId/end', sessionController.endSession);

// GET /collaboration/analytics/:workflowId - Get collaboration analytics
// router.get('/analytics/:workflowId', sessionController.getCollaborationAnalytics);

// Comment System Routes
// GET /collaboration/comments/:workflowId - Get workflow comments
router.get('/comments/:workflowId', relaxedRateLimit, commentController.getWorkflowComments);

// TODO: Implement remaining comment controller methods
// POST /collaboration/comments - Create new comment
// router.post('/comments', commentController.createComment);

// PATCH /collaboration/comments/:commentId - Update comment
// router.patch('/comments/:commentId', commentController.updateComment);

// DELETE /collaboration/comments/:commentId - Delete comment
// router.delete('/comments/:commentId', commentController.deleteComment);

// POST /collaboration/comments/:commentId/replies - Add reply to comment
// router.post('/comments/:commentId/replies', commentController.addReply);

// POST /collaboration/comments/:commentId/reactions - Add reaction
// router.post('/comments/:commentId/reactions', commentController.addReaction);

// DELETE /collaboration/comments/:commentId/reactions - Remove reaction
// router.delete('/comments/:commentId/reactions', commentController.removeReaction);

// POST /collaboration/comments/:commentId/resolve - Resolve comment
// router.post('/comments/:commentId/resolve', commentController.resolveComment);

// GET /collaboration/comments/:workflowId/analytics - Get comment analytics
// router.get('/comments/:workflowId/analytics', commentController.getCommentAnalytics);

export default router;
