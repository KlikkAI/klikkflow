/**
 * Instance Service
 * Handles self-hosted instance activation, heartbeat, and tracking
 */

import { randomUUID } from 'node:crypto';
import { ApiKeyService } from '../domains/auth/services/ApiKeyService';
import { AppError } from '../middleware/errorHandlers';
import { Instance, type IInstance } from '../models/Instance';
import { logger } from '../utils/logger';

interface ActivateInstanceData {
  apiKey: string; // API key for activation
  hostname: string;
  version: string;
  platform?: 'docker' | 'vps' | 'local' | 'kubernetes' | 'cloud';
  metadata?: {
    os?: string;
    osVersion?: string;
    nodeVersion?: string;
    architecture?: string;
    cpu?: number;
    memory?: number;
    diskSpace?: number;
    timezone?: string;
  };
  features?: {
    telemetryEnabled?: boolean;
    autoUpdate?: boolean;
    analyticsEnabled?: boolean;
  };
}

interface HeartbeatData {
  instanceId: string;
  version?: string;
  metadata?: {
    cpu?: number;
    memory?: number;
    diskSpace?: number;
  };
  statistics?: {
    workflowCount?: number;
    executionCount?: number;
    activeUsers?: number;
    lastExecutionAt?: Date;
  };
}

interface UpdateCheckResponse {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string;
  downloadUrl?: string;
  releaseDate?: Date;
  isCritical?: boolean; // Security or critical bug fix
}

export class InstanceService {
  private static instance: InstanceService;
  private apiKeyService: ApiKeyService;
  private static readonly CURRENT_VERSION = '1.0.0'; // Update this with each release
  private static readonly MAX_INSTANCES_FREE = 1; // Free tier limit
  private static readonly MAX_INSTANCES_PRO = 10; // Professional tier limit

  private constructor() {
    this.apiKeyService = ApiKeyService.getInstance();
  }

  public static getInstance(): InstanceService {
    if (!InstanceService.instance) {
      InstanceService.instance = new InstanceService();
    }
    return InstanceService.instance;
  }

  /**
   * Activate a new self-hosted instance
   */
  async activateInstance(data: ActivateInstanceData): Promise<IInstance> {
    try {
      // Validate API key
      const userId = await this.apiKeyService.validateApiKey(data.apiKey);
      if (!userId) {
        throw new AppError('Invalid or expired API key', 401);
      }

      // Find the API key to get its ID
      const apiKeys = await this.apiKeyService.getUserApiKeys(userId);
      const apiKey = apiKeys.find((key) => {
        // We need to validate the plain key matches
        // For now, we'll use the first active key for this user
        return key.isActive;
      });

      if (!apiKey) {
        throw new AppError('API key not found', 404);
      }

      // Check if user has reached instance limit
      await this.checkInstanceLimit(userId);

      // Check if instance with this hostname already exists for this user
      const existingInstance = await Instance.findOne({
        userId,
        hostname: data.hostname,
        status: 'active',
      });

      if (existingInstance) {
        // Return existing instance if already activated
        logger.info(`Instance already activated: ${existingInstance.instanceId}`);
        return existingInstance;
      }

      // Generate unique instance ID
      const instanceId = randomUUID();

      // Create new instance
      const instance = await Instance.create({
        apiKeyId: apiKey.id,
        userId,
        instanceId,
        hostname: data.hostname,
        version: data.version,
        platform: data.platform || 'docker',
        status: 'active',
        firstSeen: new Date(),
        lastSeen: new Date(),
        lastHeartbeatAt: new Date(),
        metadata: data.metadata || {},
        features: {
          telemetryEnabled: data.features?.telemetryEnabled ?? true,
          autoUpdate: data.features?.autoUpdate ?? false,
          analyticsEnabled: data.features?.analyticsEnabled ?? true,
        },
        statistics: {
          workflowCount: 0,
          executionCount: 0,
          activeUsers: 0,
        },
      });

      logger.info(`Instance activated: ${instanceId} for user ${userId}`);

      return instance;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Instance activation error:', error);
      throw new AppError('Failed to activate instance', 500);
    }
  }

  /**
   * Process heartbeat from self-hosted instance
   */
  async processHeartbeat(data: HeartbeatData): Promise<IInstance> {
    try {
      const instance = await Instance.findOne({ instanceId: data.instanceId });

      if (!instance) {
        throw new AppError('Instance not found', 404);
      }

      // Update heartbeat
      await instance.updateHeartbeat();

      // Update version if provided
      if (data.version && data.version !== instance.version) {
        instance.version = data.version;
      }

      // Update metadata if provided
      if (data.metadata) {
        instance.metadata = {
          ...instance.metadata,
          ...data.metadata,
        };
      }

      // Update statistics if provided
      if (data.statistics) {
        instance.statistics = {
          ...instance.statistics,
          ...data.statistics,
        };
      }

      await instance.save();

      logger.debug(`Heartbeat received from instance: ${instance.instanceId}`);

      return instance;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Heartbeat processing error:', error);
      throw new AppError('Failed to process heartbeat', 500);
    }
  }

  /**
   * Check for available updates
   */
  async checkForUpdates(instanceId: string): Promise<UpdateCheckResponse> {
    try {
      const instance = await Instance.findOne({ instanceId });

      if (!instance) {
        throw new AppError('Instance not found', 404);
      }

      const currentVersion = instance.version;
      const latestVersion = InstanceService.CURRENT_VERSION;

      // Simple version comparison (should use semver in production)
      const updateAvailable = this.isNewerVersion(latestVersion, currentVersion);

      return {
        updateAvailable,
        currentVersion,
        latestVersion,
        releaseNotes: updateAvailable
          ? 'Check GitHub releases for detailed release notes'
          : undefined,
        downloadUrl: updateAvailable
          ? 'https://github.com/yourusername/reporunner/releases/latest'
          : undefined,
        releaseDate: updateAvailable ? new Date() : undefined,
        isCritical: false, // Should be determined by release metadata
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Update check error:', error);
      throw new AppError('Failed to check for updates', 500);
    }
  }

  /**
   * Get all instances for a user
   */
  async getUserInstances(userId: string): Promise<IInstance[]> {
    try {
      const instances = await Instance.find({ userId }).sort({ lastSeen: -1 });
      return instances;
    } catch (error) {
      logger.error('Error fetching user instances:', error);
      throw new AppError('Failed to fetch instances', 500);
    }
  }

  /**
   * Get a specific instance by ID
   */
  async getInstanceById(instanceId: string, userId: string): Promise<IInstance | null> {
    try {
      const instance = await Instance.findOne({ instanceId, userId });
      return instance;
    } catch (error) {
      logger.error('Error fetching instance:', error);
      throw new AppError('Failed to fetch instance', 500);
    }
  }

  /**
   * Deactivate an instance
   */
  async deactivateInstance(instanceId: string, userId: string): Promise<boolean> {
    try {
      const instance = await Instance.findOne({ instanceId, userId });

      if (!instance) {
        throw new AppError('Instance not found', 404);
      }

      await instance.markInactive();

      logger.info(`Instance deactivated: ${instanceId} by user ${userId}`);

      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error deactivating instance:', error);
      throw new AppError('Failed to deactivate instance', 500);
    }
  }

  /**
   * Get instance statistics (admin only)
   */
  async getInstanceStatistics(): Promise<{
    totalInstances: number;
    activeInstances: number;
    inactiveInstances: number;
    platformBreakdown: Record<string, number>;
    versionBreakdown: Record<string, number>;
    averageWorkflows: number;
    averageExecutions: number;
  }> {
    try {
      const allInstances = await Instance.find({});
      const activeInstances = allInstances.filter((i) => i.isActive());

      const platformBreakdown: Record<string, number> = {};
      const versionBreakdown: Record<string, number> = {};
      let totalWorkflows = 0;
      let totalExecutions = 0;

      for (const instance of allInstances) {
        platformBreakdown[instance.platform] = (platformBreakdown[instance.platform] || 0) + 1;
        versionBreakdown[instance.version] = (versionBreakdown[instance.version] || 0) + 1;
        totalWorkflows += instance.statistics?.workflowCount || 0;
        totalExecutions += instance.statistics?.executionCount || 0;
      }

      return {
        totalInstances: allInstances.length,
        activeInstances: activeInstances.length,
        inactiveInstances: allInstances.length - activeInstances.length,
        platformBreakdown,
        versionBreakdown,
        averageWorkflows: allInstances.length > 0 ? totalWorkflows / allInstances.length : 0,
        averageExecutions: allInstances.length > 0 ? totalExecutions / allInstances.length : 0,
      };
    } catch (error) {
      logger.error('Error fetching instance statistics:', error);
      throw new AppError('Failed to fetch statistics', 500);
    }
  }

  /**
   * Clean up stale instances (scheduled job)
   */
  async cleanupStaleInstances(days: number = 30): Promise<number> {
    try {
      const staleInstances = await Instance.find({
        status: 'active',
        lastSeen: { $lt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
      });

      for (const instance of staleInstances) {
        await instance.markInactive();
      }

      const count = staleInstances.length;
      if (count > 0) {
        logger.info(`Cleaned up ${count} stale instances`);
      }

      return count;
    } catch (error) {
      logger.error('Error cleaning up stale instances:', error);
      return 0;
    }
  }

  /**
   * Check if user has reached instance limit
   */
  private async checkInstanceLimit(userId: string): Promise<void> {
    const activeInstances = await Instance.countDocuments({
      userId,
      status: 'active',
    });

    // TODO: Get user's plan/tier to determine limit
    // For now, using free tier limit
    const limit = InstanceService.MAX_INSTANCES_FREE;

    if (activeInstances >= limit) {
      throw new AppError(
        `Instance limit reached. You can have maximum ${limit} active instances. Please upgrade your plan or deactivate an existing instance.`,
        400
      );
    }
  }

  /**
   * Compare versions (simple implementation, should use semver library)
   */
  private isNewerVersion(newVersion: string, oldVersion: string): boolean {
    const newParts = newVersion.split('.').map(Number);
    const oldParts = oldVersion.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (newParts[i] > oldParts[i]) return true;
      if (newParts[i] < oldParts[i]) return false;
    }

    return false;
  }
}
