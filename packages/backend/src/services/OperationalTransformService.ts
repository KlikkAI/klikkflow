/**
 * Operational Transform Service for Real-time Collaboration
 * Implements operational transformation algorithms for conflict resolution
 */

import type { IOperation } from '../models/Operation';

export interface TransformResult {
  transformedOperation: IOperation;
  conflicts: Array<{
    type: 'data_conflict' | 'position_conflict' | 'dependency_conflict';
    description: string;
    severity: 'low' | 'medium' | 'high';
    autoResolvable: boolean;
    resolutionStrategy?: string;
  }>;
  requiresManualResolution: boolean;
}

export interface OperationPair {
  operation1: IOperation;
  operation2: IOperation;
}

export class OperationalTransformService {
  private static instance: OperationalTransformService;

  private constructor() {}

  public static getInstance(): OperationalTransformService {
    if (!OperationalTransformService.instance) {
      OperationalTransformService.instance = new OperationalTransformService();
    }
    return OperationalTransformService.instance;
  }

  /**
   * Transform an operation against another operation
   * Implements core operational transform algorithm
   */
  public async transformOperation(
    operation: IOperation,
    againstOperation: IOperation,
    priority: 'client' | 'server' = 'server'
  ): Promise<TransformResult> {
    const conflicts: TransformResult['conflicts'] = [];
    let transformedOperation = { ...operation.toObject() };
    let requiresManualResolution = false;

    // Check for conflicts based on operation types
    const conflictType = this.detectConflictType(operation, againstOperation);

    switch (conflictType) {
      case 'no_conflict':
        // Operations don't conflict, apply as-is
        break;

      case 'same_target_update': {
        const updateResult = this.transformSameTargetUpdate(operation, againstOperation, priority);
        transformedOperation = updateResult.operation;
        conflicts.push(...updateResult.conflicts);
        requiresManualResolution = updateResult.requiresManualResolution;
        break;
      }

      case 'position_conflict': {
        const positionResult = this.transformPositionConflict(
          operation,
          againstOperation,
          priority
        );
        transformedOperation = positionResult.operation;
        conflicts.push(...positionResult.conflicts);
        break;
      }

      case 'dependency_conflict': {
        const dependencyResult = this.transformDependencyConflict(operation, againstOperation);
        transformedOperation = dependencyResult.operation;
        conflicts.push(...dependencyResult.conflicts);
        requiresManualResolution = dependencyResult.requiresManualResolution;
        break;
      }

      case 'delete_conflict': {
        const deleteResult = this.transformDeleteConflict(operation, againstOperation, priority);
        transformedOperation = deleteResult.operation;
        conflicts.push(...deleteResult.conflicts);
        requiresManualResolution = deleteResult.requiresManualResolution;
        break;
      }
    }

    // Update operation metadata
    transformedOperation.status = requiresManualResolution ? 'pending' : 'transformed';
    transformedOperation.conflicts = conflicts.map((c) => ({
      conflictingOperationId: againstOperation.operationId,
      resolutionStrategy: c.autoResolvable ? 'auto' : 'manual',
    }));

    transformedOperation.transformations.push({
      operationId: againstOperation.operationId,
      type: 'transformation',
      timestamp: new Date(),
    });

    return {
      transformedOperation: transformedOperation as IOperation,
      conflicts,
      requiresManualResolution,
    };
  }

  /**
   * Transform multiple operations in sequence
   */
  public async transformOperationSequence(
    operation: IOperation,
    againstOperations: IOperation[],
    priority: 'client' | 'server' = 'server'
  ): Promise<TransformResult> {
    let currentOperation = operation;
    const allConflicts: TransformResult['conflicts'] = [];
    let requiresManualResolution = false;

    for (const againstOp of againstOperations) {
      const result = await this.transformOperation(currentOperation, againstOp, priority);
      currentOperation = result.transformedOperation;
      allConflicts.push(...result.conflicts);
      requiresManualResolution = requiresManualResolution || result.requiresManualResolution;
    }

    return {
      transformedOperation: currentOperation,
      conflicts: allConflicts,
      requiresManualResolution,
    };
  }

  /**
   * Detect the type of conflict between two operations
   */
  private detectConflictType(op1: IOperation, op2: IOperation): string {
    // Same target operations
    if (op1.target.id === op2.target.id && op1.target.type === op2.target.type) {
      if (
        op1.type === 'node_delete' ||
        op2.type === 'node_delete' ||
        op1.type === 'edge_delete' ||
        op2.type === 'edge_delete'
      ) {
        return 'delete_conflict';
      }
      return 'same_target_update';
    }

    // Position conflicts for adjacent elements
    if (this.hasPositionConflict(op1, op2)) {
      return 'position_conflict';
    }

    // Dependency conflicts (e.g., deleting a node that an edge connects to)
    if (this.hasDependencyConflict(op1, op2)) {
      return 'dependency_conflict';
    }

    return 'no_conflict';
  }

  /**
   * Transform operations that update the same target
   */
  private transformSameTargetUpdate(
    op1: IOperation,
    op2: IOperation,
    priority: 'client' | 'server'
  ): { operation: any; conflicts: any[]; requiresManualResolution: boolean } {
    const conflicts = [];
    let requiresManualResolution = false;

    // For property updates, try to merge if possible
    if (op1.type === 'property_update' && op2.type === 'property_update') {
      const mergeResult = this.mergePropertyUpdates(op1, op2);
      if (mergeResult.success) {
        return {
          operation: { ...op1.toObject(), data: mergeResult.mergedData },
          conflicts: [],
          requiresManualResolution: false,
        };
      }
    }

    // Priority-based resolution
    if (priority === 'server') {
      // Server operation wins
      conflicts.push({
        type: 'data_conflict' as const,
        description: `Conflicting updates to ${op1.target.type} ${op1.target.id}. Server operation prioritized.`,
        severity: 'medium' as const,
        autoResolvable: true,
        resolutionStrategy: 'server_priority',
      });
    } else {
      // Client operation needs manual resolution
      conflicts.push({
        type: 'data_conflict' as const,
        description: `Conflicting updates to ${op1.target.type} ${op1.target.id}. Manual resolution required.`,
        severity: 'high' as const,
        autoResolvable: false,
      });
      requiresManualResolution = true;
    }

    return {
      operation: op1.toObject(),
      conflicts,
      requiresManualResolution,
    };
  }

  /**
   * Transform position conflicts between operations
   */
  private transformPositionConflict(
    op1: IOperation,
    op2: IOperation,
    priority: 'client' | 'server'
  ): { operation: any; conflicts: any[] } {
    const conflicts = [];
    const transformedOp = { ...op1.toObject() };

    // Adjust position based on the other operation
    if (op2.type === 'node_add' || op2.type === 'node_move') {
      // Shift position if necessary
      if (op1.position.x !== undefined && op2.position.x !== undefined) {
        const xDiff = Math.abs(op1.position.x - op2.position.x);
        const yDiff = Math.abs(op1.position.y! - op2.position.y!);

        if (xDiff < 100 && yDiff < 100) {
          // Nodes too close
          transformedOp.position.x += priority === 'server' ? 150 : -150;

          conflicts.push({
            type: 'position_conflict' as const,
            description: `Position conflict resolved by shifting ${op1.target.type}`,
            severity: 'low' as const,
            autoResolvable: true,
            resolutionStrategy: 'position_shift',
          });
        }
      }
    }

    return {
      operation: transformedOp,
      conflicts,
    };
  }

  /**
   * Transform dependency conflicts
   */
  private transformDependencyConflict(
    op1: IOperation,
    op2: IOperation
  ): { operation: any; conflicts: any[]; requiresManualResolution: boolean } {
    const conflicts = [];
    let requiresManualResolution = false;

    // Example: edge creation when node is being deleted
    if (op1.type === 'edge_add' && op2.type === 'node_delete') {
      const edge = op1.data.after;
      if (edge.source === op2.target.id || edge.target === op2.target.id) {
        conflicts.push({
          type: 'dependency_conflict' as const,
          description: `Cannot create edge because target node is being deleted`,
          severity: 'high' as const,
          autoResolvable: false,
        });
        requiresManualResolution = true;
      }
    }

    return {
      operation: op1.toObject(),
      conflicts,
      requiresManualResolution,
    };
  }

  /**
   * Transform delete conflicts
   */
  private transformDeleteConflict(
    op1: IOperation,
    op2: IOperation,
    priority: 'client' | 'server'
  ): { operation: any; conflicts: any[]; requiresManualResolution: boolean } {
    const conflicts = [];
    let requiresManualResolution = false;

    if (op1.type === 'node_delete' && op2.type === 'node_update') {
      conflicts.push({
        type: 'delete_conflict' as const,
        description: `Node is being deleted while being updated`,
        severity: 'high' as const,
        autoResolvable: priority === 'server',
        resolutionStrategy: priority === 'server' ? 'delete_wins' : undefined,
      });

      if (priority === 'client') {
        requiresManualResolution = true;
      }
    }

    return {
      operation: op1.toObject(),
      conflicts,
      requiresManualResolution,
    };
  }

  /**
   * Merge property updates if they don't conflict
   */
  private mergePropertyUpdates(
    op1: IOperation,
    op2: IOperation
  ): { success: boolean; mergedData?: any } {
    const data1 = op1.data.after || {};
    const data2 = op2.data.after || {};

    // Simple merge - in practice, this would be more sophisticated
    const paths1 = this.getPropertyPaths(data1);
    const paths2 = this.getPropertyPaths(data2);

    // Check for conflicting paths
    const conflictingPaths = paths1.filter((path) => paths2.includes(path));

    if (conflictingPaths.length > 0) {
      return { success: false };
    }

    // Merge non-conflicting properties
    const mergedData = { ...data1, ...data2 };

    return { success: true, mergedData };
  }

  /**
   * Get all property paths from an object
   */
  private getPropertyPaths(obj: any, prefix = ''): string[] {
    const paths: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      paths.push(path);

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        paths.push(...this.getPropertyPaths(value, path));
      }
    }

    return paths;
  }

  /**
   * Check if two operations have position conflicts
   */
  private hasPositionConflict(op1: IOperation, op2: IOperation): boolean {
    if (!(op1.position.x && op2.position.x)) {
      return false;
    }

    const distance = Math.sqrt(
      (op1.position.x - op2.position.x) ** 2 + ((op1.position.y || 0) - (op2.position.y || 0)) ** 2
    );

    return distance < 100; // Nodes within 100px are considered conflicting
  }

  /**
   * Check if operations have dependency conflicts
   */
  private hasDependencyConflict(op1: IOperation, op2: IOperation): boolean {
    // Check if op1 depends on something that op2 is deleting
    if (op2.type === 'node_delete' && op1.type === 'edge_add') {
      const edge = op1.data.after;
      return edge.source === op2.target.id || edge.target === op2.target.id;
    }

    if (op2.type === 'edge_delete' && op1.type === 'edge_update') {
      return op1.target.id === op2.target.id;
    }

    return false;
  }

  /**
   * Apply transformation to a workflow state
   */
  public async applyOperation(workflowState: any, operation: IOperation): Promise<any> {
    const newState = JSON.parse(JSON.stringify(workflowState));

    switch (operation.type) {
      case 'node_add':
        newState.nodes = newState.nodes || [];
        newState.nodes.push(operation.data.after);
        break;

      case 'node_delete':
        newState.nodes = newState.nodes.filter((node: any) => node.id !== operation.target.id);
        // Also remove connected edges
        newState.edges = newState.edges.filter(
          (edge: any) => edge.source !== operation.target.id && edge.target !== operation.target.id
        );
        break;

      case 'node_update': {
        const nodeIndex = newState.nodes.findIndex((node: any) => node.id === operation.target.id);
        if (nodeIndex >= 0) {
          newState.nodes[nodeIndex] = {
            ...newState.nodes[nodeIndex],
            ...operation.data.after,
          };
        }
        break;
      }

      case 'node_move': {
        const moveNodeIndex = newState.nodes.findIndex(
          (node: any) => node.id === operation.target.id
        );
        if (moveNodeIndex >= 0) {
          newState.nodes[moveNodeIndex].position = operation.position;
        }
        break;
      }

      case 'edge_add':
        newState.edges = newState.edges || [];
        newState.edges.push(operation.data.after);
        break;

      case 'edge_delete':
        newState.edges = newState.edges.filter((edge: any) => edge.id !== operation.target.id);
        break;

      case 'edge_update': {
        const edgeIndex = newState.edges.findIndex((edge: any) => edge.id === operation.target.id);
        if (edgeIndex >= 0) {
          newState.edges[edgeIndex] = {
            ...newState.edges[edgeIndex],
            ...operation.data.after,
          };
        }
        break;
      }

      case 'property_update':
        if (operation.target.path) {
          this.setNestedProperty(newState, operation.target.path, operation.data.after);
        }
        break;
    }

    return newState;
  }

  /**
   * Set nested property using dot notation path
   */
  private setNestedProperty(obj: any, path: string, value: any): void {
    const keys = path.split('.');

    // CodeQL fix: Validate keys to prevent prototype pollution (Alert #108)
    const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];
    for (const key of keys) {
      if (DANGEROUS_KEYS.includes(key)) {
        throw new Error(`Dangerous property key detected: ${key}`);
      }
    }

    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }
}
