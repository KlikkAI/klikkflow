// Analytics service for tracking user interactions and performance metrics
import { Logger } from '@klikkflow/core';

const logger = new Logger('AnalyticsService');

export interface AnalyticsEvent {
  name: string;
  // biome-ignore lint/suspicious/noExplicitAny: Event properties are dynamic and application-specific
  properties?: Record<string, any>;
  timestamp?: Date;
  userId?: string;
  sessionId?: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface WorkflowAnalytics {
  events: AnalyticsEvent[];
  metrics: PerformanceMetric[];
  sessionId: string;
  workflowId?: string;
  nodePerformance?: Record<string, NodePerformanceStats>;
}

export interface NodePerformanceStats {
  nodeId: string;
  nodeType: string;
  avgExecutionTime: number;
  executionCount: number;
  errorCount: number;
  lastExecuted?: Date;
  averageDuration?: number;
  failureRate?: number;
}

export interface ExecutionMetrics {
  executionId: string;
  totalDuration: number;
  nodeMetrics: NodePerformanceStats[];
  status: 'success' | 'error' | 'cancelled';
  timestamp: Date;
}

export interface NodeMetrics {
  nodeId: string;
  totalExecutions: number;
  averageTime: number;
  errorRate: number;
  lastError?: string;
}

export interface BottleneckAnalysis {
  nodeId: string;
  impact: 'low' | 'medium' | 'high';
  suggestions: string[];
  metrics: NodePerformanceStats;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  recommendation?: string;
  type?: string;
  estimatedImprovement?: number;
}

export interface PredictiveInsight {
  type: 'performance' | 'reliability' | 'cost';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  // biome-ignore lint/suspicious/noExplicitAny: Prediction data structure varies by insight type
  prediction: any;
  confidence: number;
  description?: string;
  predictedImpact?: string;
  timeframe?: string;
  recommendedActions?: string[];
  basedOn?: string;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface CostOptimization {
  currentCost: number;
  optimizedCost: number;
  savings: number;
  recommendations: Array<{
    description: string;
    estimatedSavings: number;
    implementation: string;
    impact: 'low' | 'medium' | 'high';
  }>;
  description?: string;
  estimatedSavings?: string;
  implementation?: string;
  impact?: 'low' | 'medium' | 'high';
}

export class AnalyticsService {
  private events: AnalyticsEvent[] = [];
  private metrics: PerformanceMetric[] = [];
  private sessionId: string;
  private subscribers: Set<(analytics: WorkflowAnalytics) => void> = new Set();

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  // Event tracking
  // biome-ignore lint/suspicious/noExplicitAny: Event properties are dynamic and application-specific
  track(eventName: string, properties?: Record<string, any>): void {
    const event: AnalyticsEvent = {
      name: eventName,
      properties,
      timestamp: new Date(),
      sessionId: this.sessionId,
    };

    this.events.push(event);

    // In development, log event
    if (import.meta.env.DEV) {
      logger.debug('Analytics Event', event);
    }

    // Notify subscribers of analytics update
    this.notifySubscribers({
      events: [...this.events],
      metrics: [...this.metrics],
      sessionId: this.sessionId,
    });

    // TODO: Send to actual analytics service
  }

  // Performance metric tracking
  recordMetric(name: string, value: number, unit = 'ms', tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
    };

    this.metrics.push(metric);

    if (import.meta.env.DEV) {
      logger.debug('Performance Metric', metric);
    }

    // Notify subscribers of analytics update
    this.notifySubscribers({
      events: [...this.events],
      metrics: [...this.metrics],
      sessionId: this.sessionId,
    });

    // TODO: Send to actual metrics service
  }

  // Workflow-specific events
  trackWorkflowEvent(action: string, workflowId?: string, nodeType?: string): void {
    this.track('workflow_action', {
      action,
      workflowId,
      nodeType,
      timestamp: Date.now(),
    });
  }

  // Node interaction events
  trackNodeEvent(action: string, nodeType: string, nodeId?: string): void {
    this.track('node_interaction', {
      action,
      nodeType,
      nodeId,
      timestamp: Date.now(),
    });
  }

  // Performance timing
  startTiming(name: string): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, 'ms');
    };
  }

  // Get stored events for debugging
  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  // Clear stored data
  clear(): void {
    this.events = [];
    this.metrics = [];
  }

  /**
   * Subscribe to analytics updates
   * Returns an unsubscribe function
   */
  subscribeToAnalytics(callback: (analytics: WorkflowAnalytics) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers with new analytics data
   */
  private notifySubscribers(analytics: WorkflowAnalytics): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(analytics);
      } catch (error) {
        logger.error(
          'Error in analytics subscriber',
          error instanceof Error ? error : new Error(String(error))
        );
      }
    });
  }

  private generateSessionId(): string {
    // CodeQL fix: Use cryptographically secure random (Alert #91)
    return `session_${Date.now()}_${crypto.randomUUID()}`;
  }

  // Stub methods for advanced analytics features
  async generateWorkflowAnalytics(_workflowId: string): Promise<WorkflowAnalytics> {
    return {
      events: this.events,
      metrics: this.metrics,
      sessionId: this.sessionId,
    };
  }

  // biome-ignore lint/suspicious/noExplicitAny: Pre-existing stub method will be typed when implemented
  async recordExecutionMetrics(_executionId: string, _metrics: any): Promise<void> {
    // Stub implementation
  }

  // biome-ignore lint/suspicious/noExplicitAny: Pre-existing stub method will be typed when implemented
  async updateNodeMetrics(_nodeId: string, _metrics: any): Promise<void> {
    // Stub implementation
  }

  // biome-ignore lint/suspicious/noExplicitAny: Pre-existing stub method will be typed when implemented
  async detectBottlenecks(_workflowId: string): Promise<any[]> {
    return [];
  }

  // biome-ignore lint/suspicious/noExplicitAny: Pre-existing stub method will be typed when implemented
  async generatePredictiveInsights(_workflowId: string): Promise<any> {
    return null;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Pre-existing stub method will be typed when implemented
  async generateCostOptimization(_workflowId: string): Promise<any> {
    return null;
  }
}

export const analyticsService = new AnalyticsService();
