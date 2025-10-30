/**
 * Admin API Service
 * Handles API calls for admin instance management
 */

import type { ApiResponse } from '../schemas';
import type { CleanupResult, Instance, InstanceStatisticsSummary } from '../types/admin';
import { ApiClientError, apiClient } from './ApiClient';

/**
 * Backend response structure for instances
 */
interface BackendInstanceData {
  instance?: Instance;
  instances?: Instance[];
  statistics?: InstanceStatisticsSummary;
  cleaned?: number;
  instanceIds?: string[];
  errors?: Array<{ instanceId: string; error: string }>;
}

interface BackendInstanceResponse {
  success: boolean;
  data: BackendInstanceData;
}

/**
 * Admin API Service
 * Provides methods for managing self-hosted instances
 */
export class AdminApiService {
  private readonly basePath = '/api/instances';

  // ==========================================
  // INSTANCE MANAGEMENT
  // ==========================================

  /**
   * Get all instances (admin only)
   * @returns Array of all instances
   */
  async getAllInstances(): Promise<Instance[]> {
    try {
      const response = await apiClient.get<BackendInstanceResponse>(
        `${this.basePath}/my-instances`
      );
      return response.data.instances || [];
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw new Error(`Failed to fetch instances: ${error.message}`);
      }
      throw new Error('Failed to fetch instances');
    }
  }

  /**
   * Get specific instance by ID
   * @param instanceId - Instance UUID
   * @returns Instance details
   */
  async getInstanceById(instanceId: string): Promise<Instance> {
    try {
      const response = await apiClient.get<BackendInstanceResponse>(
        `${this.basePath}/${instanceId}`
      );
      if (!response.data.instance) {
        throw new Error('Instance not found');
      }
      return response.data.instance;
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw new Error(`Failed to fetch instance: ${error.message}`);
      }
      throw new Error('Failed to fetch instance');
    }
  }

  /**
   * Get instance statistics (admin only)
   * @returns Summary statistics for all instances
   */
  async getInstanceStatistics(): Promise<InstanceStatisticsSummary> {
    try {
      const response = await apiClient.get<BackendInstanceResponse>(`${this.basePath}/statistics`);
      if (!response.data.statistics) {
        throw new Error('Statistics not found');
      }
      return response.data.statistics;
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw new Error(`Failed to fetch statistics: ${error.message}`);
      }
      throw new Error('Failed to fetch statistics');
    }
  }

  /**
   * Deactivate an instance
   * @param instanceId - Instance UUID to deactivate
   * @returns Success response
   */
  async deactivateInstance(instanceId: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.delete<ApiResponse>(`${this.basePath}/${instanceId}`);
      return response.data;
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw new Error(`Failed to deactivate instance: ${error.message}`);
      }
      throw new Error('Failed to deactivate instance');
    }
  }

  /**
   * Cleanup stale instances (admin only)
   * @param days - Number of days of inactivity (default: 30)
   * @returns Cleanup results
   */
  async cleanupStaleInstances(days = 30): Promise<CleanupResult> {
    try {
      const response = await apiClient.post<BackendInstanceResponse>(`${this.basePath}/cleanup`, {
        days,
      });
      return {
        cleaned: response.data.cleaned || 0,
        instanceIds: response.data.instanceIds || [],
        errors: response.data.errors || [],
      };
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw new Error(`Failed to cleanup instances: ${error.message}`);
      }
      throw new Error('Failed to cleanup instances');
    }
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Check if instance is healthy (last seen < 2 days ago)
   * @param instance - Instance to check
   * @returns True if healthy
   */
  isInstanceHealthy(instance: Instance): boolean {
    const lastSeen = new Date(instance.lastSeen);
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    return lastSeen > twoDaysAgo && instance.status === 'active';
  }

  /**
   * Calculate instance uptime
   * @param instance - Instance to calculate uptime for
   * @returns Uptime percentage (0-100)
   */
  calculateUptime(instance: Instance): number {
    const firstSeen = new Date(instance.firstSeen);
    const lastSeen = new Date(instance.lastSeen);
    const totalTime = Date.now() - firstSeen.getTime();
    const activeTime = lastSeen.getTime() - firstSeen.getTime();
    return Math.min(100, Math.round((activeTime / totalTime) * 100));
  }

  /**
   * Format instance age
   * @param instance - Instance to format age for
   * @returns Human-readable age string
   */
  formatInstanceAge(instance: Instance): string {
    const firstSeen = new Date(instance.firstSeen);
    const now = new Date();
    const diffMs = now.getTime() - firstSeen.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    }
    if (diffDays === 1) {
      return 'Yesterday';
    }
    if (diffDays < 30) {
      return `${diffDays} days ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    }
    const years = Math.floor(diffDays / 365);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  }

  /**
   * Format last seen timestamp
   * @param instance - Instance to format timestamp for
   * @returns Human-readable relative time
   */
  formatLastSeen(instance: Instance): string {
    const lastSeen = new Date(instance.lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'Just now';
    }
    if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    }
    if (diffDays < 30) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }
    return lastSeen.toLocaleDateString();
  }
}

// Export singleton instance
export const adminApiService = new AdminApiService();
