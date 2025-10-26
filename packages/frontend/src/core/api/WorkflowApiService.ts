import type {
  CreateWorkflowRequest,
  ExecuteWorkflowRequest,
  ExecutionFilter,
  ExecutionStats,
  PaginatedResponse,
  PaginationParams,
  UpdateWorkflowRequest,
  Workflow,
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowFilter,
} from '../schemas';
import { ApiClientError, apiClient } from './ApiClient';

/**
 * Type-safe Workflow API Service
 *
 * All methods are fully type-safe with runtime validation
 * Handles all workflow and execution operations
 */
export class WorkflowApiService {
  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  // ==========================================
  // WORKFLOW MANAGEMENT OPERATIONS
  // ==========================================

  /**
   * Get all workflows with optional filtering and pagination
   */
  async getWorkflows(
    filter?: WorkflowFilter & PaginationParams
  ): Promise<PaginatedResponse<Workflow>> {
    try {
      // Use raw API call since backend response structure differs from expected pagination format
      const response = await apiClient.raw({
        method: 'GET',
        url: '/workflows',
        params: filter,
      });

      // Backend returns: data.workflows[] and data.pagination
      // Frontend expects: items[] and pagination fields
      const responseData = response.data as any;

      // Check if the response indicates success
      if (!responseData.success) {
        throw new ApiClientError(
          responseData.message || 'Failed to fetch workflows',
          0,
          'API_ERROR',
          responseData
        );
      }

      const workflows = responseData.data?.workflows || [];
      const pagination = responseData.data?.pagination || {
        total: 0,
        page: 1,
        limit: 20,
        pages: 1,
      };

      // Workflows are already in the correct format
      const transformedWorkflows = workflows;

      // Return in expected PaginatedResponse format
      return {
        items: transformedWorkflows,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: pagination.total,
          pages: pagination.pages,
        },
      };
    } catch (error) {
      throw new ApiClientError('Failed to fetch workflows', 0, 'WORKFLOW_FETCH_ERROR', error);
    }
  }

  /**
   * Get a specific workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<Workflow> {
    try {
      const response: any = await apiClient.get(`/workflows/${workflowId}`);
      return response.workflow;
    } catch (error) {
      throw new ApiClientError(
        `Failed to fetch workflow ${workflowId}`,
        0,
        'WORKFLOW_FETCH_ERROR',
        error
      );
    }
  }

  /**
   * Create a new workflow
   */
  async createWorkflow(workflow: CreateWorkflowRequest): Promise<Workflow> {
    try {
      const response: any = await apiClient.post('/workflows', workflow);
      return response.workflow;
    } catch (error) {
      throw new ApiClientError('Failed to create workflow', 0, 'WORKFLOW_CREATE_ERROR', error);
    }
  }

  /**
   * Update an existing workflow
   */
  async updateWorkflow(
    workflowId: string,
    updates: Omit<UpdateWorkflowRequest, 'id'>
  ): Promise<Workflow> {
    try {
      const response: any = await apiClient.put(`/workflows/${workflowId}`, updates);
      return response.workflow;
    } catch (error) {
      throw new ApiClientError(
        `Failed to update workflow ${workflowId}`,
        0,
        'WORKFLOW_UPDATE_ERROR',
        error
      );
    }
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(workflowId: string): Promise<{ message: string }> {
    try {
      return await apiClient.delete(`/workflows/${workflowId}`);
    } catch (error) {
      throw new ApiClientError(
        `Failed to delete workflow ${workflowId}`,
        0,
        'WORKFLOW_DELETE_ERROR',
        error
      );
    }
  }

  /**
   * Toggle workflow active status
   */
  async toggleWorkflow(workflowId: string, isActive: boolean): Promise<Workflow> {
    try {
      const response: any = await apiClient.patch(`/workflows/${workflowId}`, { isActive });
      return response.workflow;
    } catch (error) {
      throw new ApiClientError(
        `Failed to toggle workflow ${workflowId}`,
        0,
        'WORKFLOW_TOGGLE_ERROR',
        error
      );
    }
  }

  /**
   * Duplicate a workflow
   */
  async duplicateWorkflow(workflowId: string, newName?: string): Promise<Workflow> {
    try {
      const response: any = await apiClient.post(`/workflows/${workflowId}/duplicate`, {
        name: newName,
      });
      return response.workflow;
    } catch (error) {
      throw new ApiClientError(
        `Failed to duplicate workflow ${workflowId}`,
        0,
        'WORKFLOW_DUPLICATE_ERROR',
        error
      );
    }
  }

  // ==========================================
  // WORKFLOW EXECUTION OPERATIONS
  // ==========================================

  /**
   * Execute a workflow (either by ID or direct definition)
   */
  async executeWorkflow(request: ExecuteWorkflowRequest): Promise<WorkflowExecution> {
    try {
      if (request.workflowId) {
        // Execute saved workflow
        return await apiClient.post(`/workflows/${request.workflowId}/execute`, {
          triggerData: request.triggerData,
          options: request.options,
        });
      } else if (request.workflow) {
        // Execute workflow definition directly
        return await apiClient.post('/workflows/execute', {
          workflow: request.workflow,
          triggerData: request.triggerData,
          options: request.options,
        });
      } else {
        throw new ApiClientError(
          'Either workflowId or workflow definition must be provided',
          400,
          'INVALID_REQUEST'
        );
      }
    } catch (error) {
      throw new ApiClientError('Failed to execute workflow', 0, 'WORKFLOW_EXECUTION_ERROR', error);
    }
  }

  /**
   * Test a workflow (dry run without actual execution)
   */
  async testWorkflow(workflow: WorkflowDefinition): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    estimatedDuration?: number | undefined;
  }> {
    try {
      return await apiClient.post('/workflows/test', { workflow, options: { dryRun: true } });
    } catch (error) {
      throw new ApiClientError('Failed to test workflow', 0, 'WORKFLOW_TEST_ERROR', error);
    }
  }

  /**
   * Stop a running workflow execution
   */
  async stopExecution(executionId: string): Promise<{ message: string }> {
    try {
      return await apiClient.post(`/workflows/executions/${executionId}/stop`, {});
    } catch (error) {
      throw new ApiClientError(
        `Failed to stop execution ${executionId}`,
        0,
        'EXECUTION_STOP_ERROR',
        error
      );
    }
  }

  /**
   * Get execution details
   */
  async getExecution(executionId: string): Promise<WorkflowExecution> {
    try {
      return await apiClient.get(`/workflows/executions/${executionId}`);
    } catch (error) {
      throw new ApiClientError(
        `Failed to fetch execution ${executionId}`,
        0,
        'EXECUTION_FETCH_ERROR',
        error
      );
    }
  }

  /**
   * Get executions with filtering and pagination
   */
  async getExecutions(
    filter?: ExecutionFilter & PaginationParams
  ): Promise<PaginatedResponse<WorkflowExecution>> {
    try {
      return await apiClient.getPaginated('/workflows/executions', filter);
    } catch (error) {
      throw new ApiClientError('Failed to fetch executions', 0, 'EXECUTIONS_FETCH_ERROR', error);
    }
  }

  /**
   * Get execution statistics
   */
  async getExecutionStats(workflowId?: string): Promise<ExecutionStats> {
    try {
      return await apiClient.get('/workflows/executions/stats', {
        params: workflowId ? { workflowId } : undefined,
      });
    } catch (error) {
      throw new ApiClientError(
        'Failed to fetch execution statistics',
        0,
        'EXECUTION_STATS_ERROR',
        error
      );
    }
  }

  /**
   * Get execution logs
   */
  async getExecutionLogs(
    executionId: string,
    nodeId?: string
  ): Promise<
    Array<{
      timestamp: string;
      level: 'info' | 'warn' | 'error' | 'debug';
      message: string;
      nodeId?: string | undefined;
      nodeName?: string | undefined;
      data?: unknown;
    }>
  > {
    try {
      return await apiClient.get(`/workflows/executions/${executionId}/logs`, {
        params: nodeId ? { nodeId } : undefined,
      });
    } catch (error) {
      throw new ApiClientError(
        `Failed to fetch execution logs for ${executionId}`,
        0,
        'EXECUTION_LOGS_ERROR',
        error
      );
    }
  }

  // ==========================================
  // WORKFLOW TEMPLATES AND UTILITIES
  // ==========================================

  /**
   * Get available workflow templates
   */
  async getTemplates(): Promise<
    Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      tags: string[];
      definition: WorkflowDefinition;
    }>
  > {
    try {
      return await apiClient.get('/workflows/templates');
    } catch (error) {
      throw new ApiClientError(
        'Failed to fetch workflow templates',
        0,
        'TEMPLATES_FETCH_ERROR',
        error
      );
    }
  }

  /**
   * Export workflow as JSON
   */
  async exportWorkflow(
    workflowId: string,
    format: 'json' | 'yaml' = 'json'
  ): Promise<{
    data: string;
    filename: string;
    contentType: string;
  }> {
    try {
      return await apiClient.get(`/workflows/${workflowId}/export`, { params: { format } });
    } catch (error) {
      throw new ApiClientError(
        `Failed to export workflow ${workflowId}`,
        0,
        'WORKFLOW_EXPORT_ERROR',
        error
      );
    }
  }

  /**
   * Import workflow from JSON/YAML
   */
  async importWorkflow(data: string, format: 'json' | 'yaml' = 'json'): Promise<Workflow> {
    try {
      const response: any = await apiClient.post('/workflows/import', { data, format });
      return response.workflow;
    } catch (error) {
      throw new ApiClientError('Failed to import workflow', 0, 'WORKFLOW_IMPORT_ERROR', error);
    }
  }
}

// Export singleton instance
export const workflowApiService = new WorkflowApiService();
