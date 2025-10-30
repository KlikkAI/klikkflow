/**
 * Admin Store
 * Manages state for admin instance management
 */

import { create } from 'zustand';
import { adminApiService } from '@/core/api/AdminApiService';
import type {
  CleanupResult,
  Instance,
  InstanceFilters,
  InstanceStatisticsSummary,
} from '@/core/types/admin';

interface AdminState {
  // Instance data
  instances: Instance[];
  selectedInstance: Instance | null;
  statistics: InstanceStatisticsSummary | null;

  // UI state
  isLoading: boolean;
  error: string | null;
  filters: InstanceFilters;

  // Actions
  fetchInstances: () => Promise<void>;
  fetchInstanceById: (instanceId: string) => Promise<void>;
  fetchStatistics: () => Promise<void>;
  deactivateInstance: (instanceId: string) => Promise<void>;
  cleanupStaleInstances: (days?: number) => Promise<CleanupResult>;
  setFilters: (filters: Partial<InstanceFilters>) => void;
  clearFilters: () => void;
  setSelectedInstance: (instance: Instance | null) => void;
  clearError: () => void;
}

/**
 * Filter instances based on active filters
 */
function filterInstances(instances: Instance[], filters: InstanceFilters): Instance[] {
  let filtered = [...instances];

  if (filters.status) {
    filtered = filtered.filter((i) => i.status === filters.status);
  }

  if (filters.platform) {
    filtered = filtered.filter((i) => i.platform === filters.platform);
  }

  if (filters.version) {
    filtered = filtered.filter((i) => i.version === filters.version);
  }

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.hostname.toLowerCase().includes(searchLower) ||
        i.instanceId.toLowerCase().includes(searchLower) ||
        i.version.toLowerCase().includes(searchLower)
    );
  }

  if (filters.dateFrom) {
    const dateFrom = new Date(filters.dateFrom);
    filtered = filtered.filter((i) => new Date(i.firstSeen) >= dateFrom);
  }

  if (filters.dateTo) {
    const dateTo = new Date(filters.dateTo);
    filtered = filtered.filter((i) => new Date(i.firstSeen) <= dateTo);
  }

  return filtered;
}

export const useAdminStore = create<AdminState>()((set) => ({
  // Initial state
  instances: [],
  selectedInstance: null,
  statistics: null,
  isLoading: false,
  error: null,
  filters: {},

  // Fetch all instances
  fetchInstances: async () => {
    set({ isLoading: true, error: null });
    try {
      const instances = await adminApiService.getAllInstances();
      set({ instances, isLoading: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch instances';
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  // Fetch specific instance
  fetchInstanceById: async (instanceId: string) => {
    set({ isLoading: true, error: null });
    try {
      const instance = await adminApiService.getInstanceById(instanceId);
      set({
        selectedInstance: instance,
        isLoading: false,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch instance';
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  // Fetch statistics
  fetchStatistics: async () => {
    set({ isLoading: true, error: null });
    try {
      const statistics = await adminApiService.getInstanceStatistics();
      set({ statistics, isLoading: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch statistics';
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  // Deactivate instance
  deactivateInstance: async (instanceId: string) => {
    set({ isLoading: true, error: null });
    try {
      await adminApiService.deactivateInstance(instanceId);

      // Remove from instances list
      set((state) => ({
        instances: state.instances.filter((i) => i.instanceId !== instanceId),
        selectedInstance:
          state.selectedInstance?.instanceId === instanceId ? null : state.selectedInstance,
        isLoading: false,
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to deactivate instance';
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  // Cleanup stale instances
  cleanupStaleInstances: async (days = 30) => {
    set({ isLoading: true, error: null });
    try {
      const result = await adminApiService.cleanupStaleInstances(days);

      // Remove cleaned instances from list
      set((state) => ({
        instances: state.instances.filter((i) => !result.instanceIds.includes(i.instanceId)),
        isLoading: false,
      }));

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cleanup instances';
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  // Set filters
  setFilters: (newFilters: Partial<InstanceFilters>) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },

  // Clear filters
  clearFilters: () => {
    set({ filters: {} });
  },

  // Set selected instance
  setSelectedInstance: (instance: Instance | null) => {
    set({ selectedInstance: instance });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));

/**
 * Get filtered instances
 */
export const useFilteredInstances = () => {
  const instances = useAdminStore((state) => state.instances);
  const filters = useAdminStore((state) => state.filters);
  return filterInstances(instances, filters);
};
