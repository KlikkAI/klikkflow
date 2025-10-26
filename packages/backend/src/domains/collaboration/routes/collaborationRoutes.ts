/**
 * Collaboration Routes
 * REST API routes for collaboration sessions and comments
 */

import { Router } from 'express';
import { authenticate } from '../../../middleware/auth';
import { relaxedRateLimit } from '../../../middleware/rate-limit.middleware';
import { CommentController } from '../controllers/CommentController';
import { SessionController } from '../controllers/SessionController';

const router: Router = Router();

// Initialize controllers
const sessionController = new SessionController();
const commentController = new CommentController();

// Apply authentication middleware to all collaboration routes
router.use(authenticate);

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
