import express, { type Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '../../../middleware/auth';
import { catchAsync } from '../../../middleware/errorHandlers';
import { moderateRateLimit, relaxedRateLimit } from '../../../middleware/rate-limit.middleware';
import { WorkflowController } from '../controllers/WorkflowController';

const router: Router = express.Router();
const workflowController = new WorkflowController();

/**
 * @route   GET /workflows
 * @desc    Get all workflows for user
 * @access  Private
 */
router.get(
  '/',
  relaxedRateLimit,
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().trim(),
    query('tags').optional(),
    query('isActive').optional().isBoolean().toBoolean(),
  ],
  catchAsync(workflowController.getWorkflows)
);

/**
 * @route   GET /workflows/:id
 * @desc    Get workflow by ID
 * @access  Private
 */
router.get(
  '/:id',
  relaxedRateLimit,
  authenticate,
  [param('id').isMongoId()],
  catchAsync(workflowController.getWorkflowById)
);

/**
 * @route   POST /workflows
 * @desc    Create new workflow
 * @access  Private
 */
router.post(
  '/',
  moderateRateLimit,
  authenticate,
  [
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('nodes').isArray(),
    body('edges').isArray(),
    body('tags').optional().isArray(),
    body('isPublic').optional().isBoolean(),
    body('settings').optional().isObject(),
  ],
  catchAsync(workflowController.createWorkflow)
);

/**
 * @route   PUT /workflows/:id
 * @desc    Update workflow
 * @access  Private
 */
router.put(
  '/:id',
  moderateRateLimit,
  authenticate,
  [
    param('id').isMongoId(),
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('nodes').optional().isArray(),
    body('edges').optional().isArray(),
    body('tags').optional().isArray(),
    body('isPublic').optional().isBoolean(),
    body('isActive').optional().isBoolean(),
    body('settings').optional().isObject(),
  ],
  catchAsync(workflowController.updateWorkflow)
);

/**
 * @route   DELETE /workflows/:id
 * @desc    Delete workflow
 * @access  Private
 */
router.delete(
  '/:id',
  moderateRateLimit,
  authenticate,
  [param('id').isMongoId()],
  catchAsync(workflowController.deleteWorkflow)
);

/**
 * @route   POST /workflows/:id/duplicate
 * @desc    Duplicate workflow
 * @access  Private
 */
router.post(
  '/:id/duplicate',
  moderateRateLimit,
  authenticate,
  [param('id').isMongoId()],
  catchAsync(workflowController.duplicateWorkflow)
);

/**
 * @route   POST /workflows/:id/execute
 * @desc    Execute workflow
 * @access  Private
 */
router.post(
  '/:id/execute',
  moderateRateLimit,
  authenticate,
  [param('id').isMongoId(), body('triggerData').optional().isObject()],
  catchAsync(workflowController.executeWorkflow)
);

/**
 * @route   POST /workflows/:id/test
 * @desc    Test workflow (dry run)
 * @access  Private
 */
router.post(
  '/:id/test',
  moderateRateLimit,
  authenticate,
  [param('id').isMongoId()],
  catchAsync(workflowController.testWorkflow)
);

/**
 * @route   GET /workflows/:id/statistics
 * @desc    Get workflow statistics
 * @access  Private
 */
router.get(
  '/:id/statistics',
  relaxedRateLimit,
  authenticate,
  [param('id').isMongoId(), query('days').optional().isInt({ min: 1, max: 365 }).toInt()],
  catchAsync(workflowController.getWorkflowStatistics)
);

/**
 * @route   GET /workflows/executions
 * @desc    Get all executions
 * @access  Private
 */
router.get(
  '/executions',
  relaxedRateLimit,
  authenticate,
  [
    query('workflowId').optional().isMongoId(),
    query('status').optional().isIn(['pending', 'running', 'success', 'error', 'cancelled']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  catchAsync(workflowController.getExecutions)
);

/**
 * @route   GET /workflows/executions/stats
 * @desc    Get execution statistics
 * @access  Private
 */
router.get(
  '/executions/stats',
  relaxedRateLimit,
  authenticate,
  [query('workflowId').optional().isMongoId()],
  catchAsync(workflowController.getExecutionStatistics)
);

/**
 * @route   GET /workflows/executions/:id
 * @desc    Get execution by ID
 * @access  Private
 */
router.get(
  '/executions/:id',
  relaxedRateLimit,
  authenticate,
  [param('id').isMongoId()],
  catchAsync(workflowController.getExecutionById)
);

/**
 * @route   POST /workflows/executions/:id/stop
 * @desc    Stop execution
 * @access  Private
 */
router.post(
  '/executions/:id/stop',
  moderateRateLimit,
  authenticate,
  [param('id').isMongoId()],
  catchAsync(workflowController.stopExecution)
);

/**
 * @route   POST /workflows/test
 * @desc    Test workflow (dry run) from body
 * @access  Private
 */
router.post(
  '/test',
  moderateRateLimit,
  authenticate,
  [body('workflow').isObject()],
  catchAsync(workflowController.testWorkflowFromBody)
);

export default router;
