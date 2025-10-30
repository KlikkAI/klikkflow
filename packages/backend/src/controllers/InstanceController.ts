/**
 * Instance Controller
 * Handles self-hosted instance activation, heartbeat, and management
 */

import type { Response } from 'express';
import { BaseController } from '../base/BaseController';
import type { AuthenticatedRequest } from '../domains/auth/controllers/AuthController';
import { AppError } from '../middleware/errorHandlers';
import { InstanceService } from '../services/InstanceService';
import { logger } from '../utils/logger';

export class InstanceController extends BaseController {
  private instanceService: InstanceService;

  constructor() {
    super();
    this.instanceService = InstanceService.getInstance();
  }

  /**
   * Activate a new self-hosted instance
   * POST /api/instances/activate
   * Public endpoint (authenticated via API key in body)
   */
  activateInstance = async (req: AuthenticatedRequest, res: Response) => {
    this.validateRequest(req);

    const { apiKey, hostname, version, platform, metadata, features } = req.body;

    const instance = await this.instanceService.activateInstance({
      apiKey,
      hostname,
      version,
      platform,
      metadata,
      features,
    });

    logger.info(`Instance activated: ${instance.instanceId}`);

    this.sendCreated(
      res,
      {
        instanceId: instance.instanceId,
        hostname: instance.hostname,
        version: instance.version,
        platform: instance.platform,
        status: instance.status,
        message: 'Instance activated successfully',
      },
      'Instance activated successfully'
    );
  };

  /**
   * Process heartbeat from self-hosted instance
   * POST /api/instances/heartbeat
   * Authenticated via API key or instance ID
   */
  processHeartbeat = async (req: AuthenticatedRequest, res: Response) => {
    this.validateRequest(req);

    const { instanceId, version, metadata, statistics } = req.body;

    const instance = await this.instanceService.processHeartbeat({
      instanceId,
      version,
      metadata,
      statistics,
    });

    this.sendSuccess(
      res,
      {
        instanceId: instance.instanceId,
        lastSeen: instance.lastSeen,
        status: instance.status,
      },
      'Heartbeat processed successfully'
    );
  };

  /**
   * Check for available updates
   * GET /api/instances/:instanceId/updates
   */
  checkForUpdates = async (req: AuthenticatedRequest, res: Response) => {
    const { instanceId } = req.params;

    const updateInfo = await this.instanceService.checkForUpdates(instanceId);

    this.sendSuccess(res, updateInfo, 'Update check completed');
  };

  /**
   * Get all instances for authenticated user
   * GET /api/instances/my-instances
   */
  getUserInstances = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    const instances = await this.instanceService.getUserInstances(userId);

    this.sendSuccess(res, { instances }, 'Instances retrieved successfully');
  };

  /**
   * Get specific instance by ID
   * GET /api/instances/:instanceId
   */
  getInstanceById = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    const { instanceId } = req.params;

    const instance = await this.instanceService.getInstanceById(instanceId, userId);

    if (!instance) {
      throw new AppError('Instance not found', 404);
    }

    this.sendSuccess(res, { instance }, 'Instance retrieved successfully');
  };

  /**
   * Deactivate an instance
   * DELETE /api/instances/:instanceId
   */
  deactivateInstance = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    const { instanceId } = req.params;

    await this.instanceService.deactivateInstance(instanceId, userId);

    logger.info(`Instance deactivated: ${instanceId} by user ${userId}`);

    this.sendSuccess(res, null, 'Instance deactivated successfully');
  };

  /**
   * Get instance statistics (admin only)
   * GET /api/instances/statistics
   */
  getInstanceStatistics = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    // TODO: Add admin role check
    // For now, allowing all authenticated users
    // if (req.user?.role !== 'super_admin') {
    //   throw new AppError('Admin access required', 403);
    // }

    const statistics = await this.instanceService.getInstanceStatistics();

    this.sendSuccess(res, statistics, 'Statistics retrieved successfully');
  };

  /**
   * Cleanup stale instances (admin only)
   * POST /api/instances/cleanup
   */
  cleanupStaleInstances = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    // TODO: Add admin role check

    const { days = 30 } = req.body;

    const count = await this.instanceService.cleanupStaleInstances(days);

    logger.info(`Cleaned up ${count} stale instances`);

    this.sendSuccess(res, { count }, `Cleaned up ${count} stale instances`);
  };
}
