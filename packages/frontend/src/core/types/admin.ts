/**
 * Admin Types
 * Type definitions for admin instance management
 */

/**
 * Instance platform types
 */
export type InstancePlatform = 'docker' | 'vps' | 'local' | 'kubernetes' | 'cloud';

/**
 * Instance status types
 */
export type InstanceStatus = 'active' | 'inactive' | 'suspended';

/**
 * Instance metadata
 */
export interface InstanceMetadata {
  os?: string;
  osVersion?: string;
  nodeVersion?: string;
  architecture?: string;
  cpu?: number;
  memory?: number;
  diskSpace?: number;
  timezone?: string;
  country?: string;
}

/**
 * Instance statistics
 */
export interface InstanceStatistics {
  workflowCount?: number;
  executionCount?: number;
  activeUsers?: number;
  lastExecutionAt?: string;
}

/**
 * Instance features
 */
export interface InstanceFeatures {
  telemetryEnabled?: boolean;
  autoUpdate?: boolean;
  analyticsEnabled?: boolean;
}

/**
 * Self-hosted instance
 */
export interface Instance {
  id: string;
  instanceId: string;
  apiKeyId: string;
  userId: string;
  hostname: string;
  version: string;
  platform: InstancePlatform;
  status: InstanceStatus;
  firstSeen: string;
  lastSeen: string;
  metadata?: InstanceMetadata;
  statistics?: InstanceStatistics;
  features?: InstanceFeatures;
  createdAt: string;
  updatedAt: string;
}

/**
 * Instance statistics summary for dashboard
 */
export interface InstanceStatisticsSummary {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  byPlatform: Record<InstancePlatform, number>;
  byVersion: Record<string, number>;
  recentActivity: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
  totalWorkflows: number;
  totalExecutions: number;
  totalUsers: number;
}

/**
 * Instance activity log
 */
export interface InstanceActivity {
  instanceId: string;
  timestamp: string;
  type: 'activated' | 'heartbeat' | 'updated' | 'suspended' | 'deactivated';
  version?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Cleanup result
 */
export interface CleanupResult {
  cleaned: number;
  instanceIds: string[];
  errors: Array<{
    instanceId: string;
    error: string;
  }>;
}

/**
 * Filters for instance list
 */
export interface InstanceFilters {
  status?: InstanceStatus;
  platform?: InstancePlatform;
  version?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Platform distribution data for charts
 */
export interface PlatformDistribution {
  platform: InstancePlatform;
  count: number;
  percentage: number;
}

/**
 * Version distribution data for charts
 */
export interface VersionDistribution {
  version: string;
  count: number;
  percentage: number;
  isLatest: boolean;
}
