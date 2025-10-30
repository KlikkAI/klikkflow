/**
 * Instance Management Routes
 * Handles self-hosted instance activation, heartbeat, and tracking
 */

import express, { type Router } from 'express';
import { InstanceController } from '../controllers/InstanceController';
import { authenticate, optionalAuth } from '../middleware/auth';
import { enhancedCatchAsync } from '../middleware/enhancedErrorHandlers';
import { moderateRateLimit, relaxedRateLimit } from '../middleware/rate-limit.middleware';
import {
  activateInstanceValidation,
  cleanupValidation,
  heartbeatValidation,
  instanceIdValidation,
} from '../validators/instanceValidators';

const router: Router = express.Router();
const instanceController = new InstanceController();

/**
 * @route   POST /instances/activate
 * @desc    Activate a new self-hosted instance
 * @access  Public (API key in body)
 */
router.post(
  '/activate',
  moderateRateLimit,
  activateInstanceValidation,
  enhancedCatchAsync(instanceController.activateInstance)
);

/**
 * @route   POST /instances/heartbeat
 * @desc    Process heartbeat from self-hosted instance
 * @access  Public (instance ID in body)
 */
router.post(
  '/heartbeat',
  relaxedRateLimit,
  heartbeatValidation,
  enhancedCatchAsync(instanceController.processHeartbeat)
);

/**
 * @route   GET /instances/:instanceId/updates
 * @desc    Check for available updates
 * @access  Public (can use optionalAuth for future features)
 */
router.get(
  '/:instanceId/updates',
  relaxedRateLimit,
  optionalAuth,
  instanceIdValidation,
  enhancedCatchAsync(instanceController.checkForUpdates)
);

/**
 * @route   GET /instances/my-instances
 * @desc    Get all instances for authenticated user
 * @access  Private
 */
router.get(
  '/my-instances',
  relaxedRateLimit,
  authenticate,
  enhancedCatchAsync(instanceController.getUserInstances)
);

/**
 * @route   GET /instances/:instanceId
 * @desc    Get specific instance by ID
 * @access  Private
 */
router.get(
  '/:instanceId',
  relaxedRateLimit,
  authenticate,
  instanceIdValidation,
  enhancedCatchAsync(instanceController.getInstanceById)
);

/**
 * @route   DELETE /instances/:instanceId
 * @desc    Deactivate an instance
 * @access  Private
 */
router.delete(
  '/:instanceId',
  moderateRateLimit,
  authenticate,
  instanceIdValidation,
  enhancedCatchAsync(instanceController.deactivateInstance)
);

/**
 * @route   GET /instances/statistics
 * @desc    Get instance statistics (admin only)
 * @access  Private (Admin)
 */
router.get(
  '/statistics',
  relaxedRateLimit,
  authenticate,
  // TODO: Add admin middleware
  enhancedCatchAsync(instanceController.getInstanceStatistics)
);

/**
 * @route   POST /instances/cleanup
 * @desc    Cleanup stale instances (admin only)
 * @access  Private (Admin)
 */
router.post(
  '/cleanup',
  moderateRateLimit,
  authenticate,
  // TODO: Add admin middleware
  cleanupValidation,
  enhancedCatchAsync(instanceController.cleanupStaleInstances)
);

export default router;
