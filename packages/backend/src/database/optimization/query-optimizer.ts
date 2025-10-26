import { Logger } from '@klikkflow/core';
import { z } from 'zod';

export interface QueryPlan {
  id: string;
  query: string;
  estimatedCost: number;
  estimatedRows: number;
  executionTime?: number;
  indexes: string[];
  operations: QueryOperation[];
  recommendations: QueryRecommendation[];
}

export interface QueryOperation {
  type: 'scan' | 'index_scan' | 'join' | 'sort' | 'filter' | 'aggregate';
  table: string;
  cost: number;
  rows: number;
  condition?: string;
  index?: string;
}

export interface QueryRecommendation {
  type: 'index' | 'rewrite' | 'partition' | 'cache' | 'denormalize';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  implementation: string;
  estimatedImprovement: number; // percentage
}

export interface QueryStats {
  queryId: string;
  query: string;
  executionCount: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  lastExecuted: Date;
  errorCount: number;
  cacheHitRate?: number;
}

export interface OptimizationReport {
  generatedAt: Date;
  timeRange: { start: Date; end: Date };
  totalQueries: number;
  slowQueries: QueryStats[];
  recommendations: QueryRecommendation[];
  indexSuggestions: IndexSuggestion[];
  performanceMetrics: {
    averageQueryTime: number;
    queryThroughput: number;
    cacheHitRate: number;
    indexUsageRate: number;
  };
}

export interface IndexSuggestion {
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist' | 'partial';
  reason: string;
  estimatedImprovement: number;
  createStatement: string;
}

const _QueryStatsSchema = z.object({
  queryId: z.string(),
  query: z.string(),
  executionCount: z.number().min(0),
  totalExecutionTime: z.number().min(0),
  averageExecutionTime: z.number().min(0),
  minExecutionTime: z.number().min(0),
  maxExecutionTime: z.number().min(0),
  lastExecuted: z.date(),
  errorCount: z.number().min(0),
  cacheHitRate: z.number().min(0).max(1).optional(),
});

export class QueryOptimizer {
  private logger: Logger;
  private queryStats = new Map<string, QueryStats>();
  private queryPlans = new Map<string, QueryPlan>();
  private slowQueryThreshold: number;
  private enableProfiling: boolean;

  constructor(
    options: {
      slowQueryThreshold?: number; // milliseconds
      enableProfiling?: boolean;
    } = {}
  ) {
    this.logger = new Logger('QueryOptimizer');
    this.slowQueryThreshold = options.slowQueryThreshold || 1000; // 1 second
    this.enableProfiling = true;
  }

  /**
   * Analyze and optimize a query
   */
  async analyzeQuery(query: string, parameters?: any[]): Promise<QueryPlan> {
    try {
      const queryId = this.generateQueryId(query);

      // Check if we already have a plan for this query
      const existingPlan = this.queryPlans.get(queryId);
      if (existingPlan) {
        return existingPlan;
      }

      // Generate execution plan
      const plan = await this.generateExecutionPlan(query, parameters);

      // Analyze the plan and generate recommendations
      plan.recommendations = this.generateRecommendations(plan);

      // Cache the plan
      this.queryPlans.set(queryId, plan);

      this.logger.debug('Query analyzed', {
        queryId,
        estimatedCost: plan.estimatedCost,
        recommendationCount: plan.recommendations.length,
      });

      return plan;
    } catch (error) {
      this.logger.error('Failed to analyze query', { error, query });
      throw error;
    }
  }

  /**
   * Record query execution statistics
   */
  recordExecution(
    query: string,
    executionTime: number,
    success: boolean = true,
    cacheHit: boolean = false
  ): void {
    try {
      const queryId = this.generateQueryId(query);
      const now = new Date();

      let stats = this.queryStats.get(queryId);
      if (!stats) {
        stats = {
          queryId,
          query,
          executionCount: 0,
          totalExecutionTime: 0,
          averageExecutionTime: 0,
          minExecutionTime: Number.POSITIVE_INFINITY,
          maxExecutionTime: 0,
          lastExecuted: now,
          errorCount: 0,
          cacheHitRate: 0,
        };
      }

      // Update statistics
      stats.executionCount++;
      stats.lastExecuted = now;

      if (success) {
        stats.totalExecutionTime += executionTime;
        stats.averageExecutionTime = stats.totalExecutionTime / stats.executionCount;
        stats.minExecutionTime = Math.min(stats.minExecutionTime, executionTime);
        stats.maxExecutionTime = Math.max(stats.maxExecutionTime, executionTime);

        // Update cache hit rate
        if (stats.cacheHitRate !== undefined) {
          const totalHits = stats.cacheHitRate * (stats.executionCount - 1) + (cacheHit ? 1 : 0);
          stats.cacheHitRate = totalHits / stats.executionCount;
        }
      } else {
        stats.errorCount++;
      }

      this.queryStats.set(queryId, stats);

      // Log slow queries
      if (success && executionTime > this.slowQueryThreshold) {
        this.logger.warn('Slow query detected', {
          queryId,
          executionTime,
          query: `${query.substring(0, 100)}...`,
        });
      }
    } catch (error) {
      this.logger.error('Failed to record query execution', { error, query });
    }
  }

  /**
   * Get slow queries
   */
  getSlowQueries(limit: number = 10): QueryStats[] {
    return Array.from(this.queryStats.values())
      .filter((stats) => stats.averageExecutionTime > this.slowQueryThreshold)
      .sort((a, b) => b.averageExecutionTime - a.averageExecutionTime)
      .slice(0, limit);
  }

  /**
   * Get most frequent queries
   */
  getFrequentQueries(limit: number = 10): QueryStats[] {
    return Array.from(this.queryStats.values())
      .sort((a, b) => b.executionCount - a.executionCount)
      .slice(0, limit);
  }

  /**
   * Generate optimization report
   */
  async generateOptimizationReport(timeRange: {
    start: Date;
    end: Date;
  }): Promise<OptimizationReport> {
    try {
      // Filter queries by time range
      const relevantQueries = Array.from(this.queryStats.values()).filter(
        (stats) => stats.lastExecuted >= timeRange.start && stats.lastExecuted <= timeRange.end
      );

      // Get slow queries
      const slowQueries = relevantQueries
        .filter((stats) => stats.averageExecutionTime > this.slowQueryThreshold)
        .sort((a, b) => b.averageExecutionTime - a.averageExecutionTime)
        .slice(0, 20);

      // Generate recommendations
      const recommendations = await this.generateGlobalRecommendations(relevantQueries);

      // Generate index suggestions
      const indexSuggestions = await this.generateIndexSuggestions(slowQueries);

      // Calculate performance metrics
      const performanceMetrics = this.calculatePerformanceMetrics(relevantQueries);

      const report: OptimizationReport = {
        generatedAt: new Date(),
        timeRange,
        totalQueries: relevantQueries.length,
        slowQueries,
        recommendations,
        indexSuggestions,
        performanceMetrics,
      };

      this.logger.info('Optimization report generated', {
        totalQueries: relevantQueries.length,
        slowQueries: slowQueries.length,
        recommendations: recommendations.length,
        indexSuggestions: indexSuggestions.length,
      });

      return report;
    } catch (error) {
      this.logger.error('Failed to generate optimization report', { error });
      throw error;
    }
  }

  /**
   * Suggest indexes for better performance
   */
  async suggestIndexes(table: string, queries: string[]): Promise<IndexSuggestion[]> {
    try {
      const suggestions: IndexSuggestion[] = [];
      const columnUsage = new Map<string, number>();
      const whereConditions = new Map<string, number>();

      // Analyze queries to find commonly used columns
      for (const query of queries) {
        const analysis = this.analyzeQueryStructure(query);

        // Count column usage in WHERE clauses
        analysis.whereColumns.forEach((column) => {
          whereConditions.set(column, (whereConditions.get(column) || 0) + 1);
        });

        // Count column usage in ORDER BY clauses
        analysis.orderByColumns.forEach((column) => {
          columnUsage.set(column, (columnUsage.get(column) || 0) + 1);
        });

        // Count column usage in JOIN conditions
        analysis.joinColumns.forEach((column) => {
          columnUsage.set(column, (columnUsage.get(column) || 0) + 1);
        });
      }

      // Generate single-column index suggestions
      for (const [column, usage] of whereConditions.entries()) {
        if (usage >= 2) {
          // Column used in at least 2 queries
          suggestions.push({
            table,
            columns: [column],
            type: 'btree',
            reason: `Column '${column}' is frequently used in WHERE clauses (${usage} times)`,
            estimatedImprovement: Math.min(80, usage * 10),
            createStatement: `CREATE INDEX idx_${table}_${column} ON ${table} (${column});`,
          });
        }
      }

      // Generate composite index suggestions
      const frequentCombinations = this.findFrequentColumnCombinations(queries);
      for (const combination of frequentCombinations) {
        if (combination.columns.length > 1) {
          suggestions.push({
            table,
            columns: combination.columns,
            type: 'btree',
            reason: `Column combination frequently used together (${combination.frequency} times)`,
            estimatedImprovement: Math.min(90, combination.frequency * 15),
            createStatement: `CREATE INDEX idx_${table}_${combination.columns.join('_')} ON ${table} (${combination.columns.join(', ')});`,
          });
        }
      }

      // Sort by estimated improvement
      suggestions.sort((a, b) => b.estimatedImprovement - a.estimatedImprovement);

      return suggestions.slice(0, 10); // Return top 10 suggestions
    } catch (error) {
      this.logger.error('Failed to suggest indexes', { error, table });
      return [];
    }
  }

  /**
   * Optimize query by rewriting
   */
  optimizeQuery(query: string): { optimizedQuery: string; improvements: string[] } {
    try {
      let optimizedQuery = query;
      const improvements: string[] = [];

      // Remove unnecessary DISTINCT
      if (this.hasUnnecessaryDistinct(query)) {
        optimizedQuery = this.removeUnnecessaryDistinct(optimizedQuery);
        improvements.push('Removed unnecessary DISTINCT clause');
      }

      // Optimize WHERE clauses
      const whereOptimization = this.optimizeWhereClause(optimizedQuery);
      if (whereOptimization.changed) {
        optimizedQuery = whereOptimization.query;
        improvements.push('Optimized WHERE clause conditions');
      }

      // Optimize JOINs
      const joinOptimization = this.optimizeJoins(optimizedQuery);
      if (joinOptimization.changed) {
        optimizedQuery = joinOptimization.query;
        improvements.push('Optimized JOIN operations');
      }

      // Add LIMIT if missing for potentially large result sets
      if (this.shouldAddLimit(optimizedQuery)) {
        optimizedQuery = this.addReasonableLimit(optimizedQuery);
        improvements.push('Added LIMIT clause to prevent large result sets');
      }

      return { optimizedQuery, improvements };
    } catch (error) {
      this.logger.error('Failed to optimize query', { error, query });
      return { optimizedQuery: query, improvements: [] };
    }
  }

  private async generateExecutionPlan(query: string, _parameters?: any[]): Promise<QueryPlan> {
    // In a real implementation, this would use EXPLAIN ANALYZE
    // For now, we'll create a mock plan based on query analysis

    const queryId = this.generateQueryId(query);
    const analysis = this.analyzeQueryStructure(query);

    const operations: QueryOperation[] = [];
    let estimatedCost = 100; // Base cost
    let estimatedRows = 1000; // Base estimate

    // Analyze tables and operations
    analysis.tables.forEach((table) => {
      if (analysis.whereColumns.length > 0) {
        operations.push({
          type: 'index_scan',
          table,
          cost: 50,
          rows: 500,
          condition: 'WHERE clause filter',
        });
        estimatedCost += 50;
        estimatedRows = Math.floor(estimatedRows * 0.5);
      } else {
        operations.push({
          type: 'scan',
          table,
          cost: 200,
          rows: 2000,
        });
        estimatedCost += 200;
        estimatedRows += 2000;
      }
    });

    // Add JOIN costs
    if (analysis.joinColumns.length > 0) {
      operations.push({
        type: 'join',
        table: 'multiple',
        cost: analysis.joinColumns.length * 100,
        rows: estimatedRows,
      });
      estimatedCost += analysis.joinColumns.length * 100;
    }

    // Add ORDER BY costs
    if (analysis.orderByColumns.length > 0) {
      operations.push({
        type: 'sort',
        table: 'result',
        cost: estimatedRows * 0.1,
        rows: estimatedRows,
      });
      estimatedCost += estimatedRows * 0.1;
    }

    return {
      id: queryId,
      query,
      estimatedCost,
      estimatedRows,
      indexes: [], // Would be populated from actual database
      operations,
      recommendations: [], // Will be populated by generateRecommendations
    };
  }

  private generateRecommendations(plan: QueryPlan): QueryRecommendation[] {
    const recommendations: QueryRecommendation[] = [];

    // High cost operations
    if (plan.estimatedCost > 1000) {
      recommendations.push({
        type: 'index',
        priority: 'high',
        description: 'Query has high estimated cost, consider adding indexes',
        implementation: 'Analyze WHERE and JOIN conditions for index opportunities',
        estimatedImprovement: 60,
      });
    }

    // Large result sets
    if (plan.estimatedRows > 10000) {
      recommendations.push({
        type: 'rewrite',
        priority: 'medium',
        description: 'Query returns large result set, consider adding LIMIT or pagination',
        implementation: 'Add LIMIT clause or implement cursor-based pagination',
        estimatedImprovement: 40,
      });
    }

    // Full table scans
    const hasFullScan = plan.operations.some((op) => op.type === 'scan');
    if (hasFullScan) {
      recommendations.push({
        type: 'index',
        priority: 'high',
        description: 'Query performs full table scan',
        implementation: 'Add indexes on columns used in WHERE clauses',
        estimatedImprovement: 80,
      });
    }

    // Expensive sorts
    const sortOperations = plan.operations.filter((op) => op.type === 'sort');
    if (sortOperations.some((op) => op.cost > 500)) {
      recommendations.push({
        type: 'index',
        priority: 'medium',
        description: 'Expensive sort operation detected',
        implementation: 'Add index on ORDER BY columns',
        estimatedImprovement: 50,
      });
    }

    return recommendations;
  }

  private async generateGlobalRecommendations(
    queries: QueryStats[]
  ): Promise<QueryRecommendation[]> {
    const recommendations: QueryRecommendation[] = [];

    // Analyze overall patterns
    const totalQueries = queries.length;
    const slowQueries = queries.filter((q) => q.averageExecutionTime > this.slowQueryThreshold);
    const errorQueries = queries.filter((q) => q.errorCount > 0);

    if (slowQueries.length > totalQueries * 0.1) {
      recommendations.push({
        type: 'index',
        priority: 'critical',
        description: `${slowQueries.length} slow queries detected (${Math.round((slowQueries.length / totalQueries) * 100)}% of total)`,
        implementation: 'Review and optimize slow queries, add appropriate indexes',
        estimatedImprovement: 70,
      });
    }

    if (errorQueries.length > 0) {
      recommendations.push({
        type: 'rewrite',
        priority: 'high',
        description: `${errorQueries.length} queries have errors`,
        implementation: 'Review and fix failing queries',
        estimatedImprovement: 100,
      });
    }

    // Check cache hit rates
    const cacheMissQueries = queries.filter(
      (q) => q.cacheHitRate !== undefined && q.cacheHitRate < 0.5
    );
    if (cacheMissQueries.length > totalQueries * 0.2) {
      recommendations.push({
        type: 'cache',
        priority: 'medium',
        description: 'Low cache hit rate detected',
        implementation: 'Implement query result caching for frequently executed queries',
        estimatedImprovement: 60,
      });
    }

    return recommendations;
  }

  private async generateIndexSuggestions(slowQueries: QueryStats[]): Promise<IndexSuggestion[]> {
    const suggestions: IndexSuggestion[] = [];
    const tableQueries = new Map<string, string[]>();

    // Group queries by table
    for (const queryStats of slowQueries) {
      const analysis = this.analyzeQueryStructure(queryStats.query);
      for (const table of analysis.tables) {
        if (!tableQueries.has(table)) {
          tableQueries.set(table, []);
        }
        tableQueries.get(table)?.push(queryStats.query);
      }
    }

    // Generate suggestions for each table
    for (const [table, queries] of tableQueries.entries()) {
      const tableSuggestions = await this.suggestIndexes(table, queries);
      suggestions.push(...tableSuggestions);
    }

    return suggestions;
  }

  private calculatePerformanceMetrics(queries: QueryStats[]) {
    if (queries.length === 0) {
      return {
        averageQueryTime: 0,
        queryThroughput: 0,
        cacheHitRate: 0,
        indexUsageRate: 0,
      };
    }

    const totalExecutionTime = queries.reduce((sum, q) => sum + q.totalExecutionTime, 0);
    const totalExecutions = queries.reduce((sum, q) => sum + q.executionCount, 0);
    const averageQueryTime = totalExecutions > 0 ? totalExecutionTime / totalExecutions : 0;

    // Calculate throughput (queries per second)
    const timeSpan =
      Math.max(...queries.map((q) => q.lastExecuted.getTime())) -
      Math.min(...queries.map((q) => q.lastExecuted.getTime()));
    const queryThroughput = timeSpan > 0 ? totalExecutions / (timeSpan / 1000) : 0;

    // Calculate cache hit rate
    const queriesWithCache = queries.filter((q) => q.cacheHitRate !== undefined);
    const cacheHitRate =
      queriesWithCache.length > 0
        ? queriesWithCache.reduce((sum, q) => sum + (q.cacheHitRate || 0), 0) /
          queriesWithCache.length
        : 0;

    // Estimate index usage rate (simplified)
    const indexUsageRate = 0.7; // Would be calculated from actual database stats

    return {
      averageQueryTime,
      queryThroughput,
      cacheHitRate,
      indexUsageRate,
    };
  }

  private generateQueryId(query: string): string {
    // Normalize query for consistent ID generation
    const normalized = query
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\d+/g, '?') // Replace numbers with placeholders
      .replace(/'[^']*'/g, '?') // Replace string literals
      .trim();

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return `query_${Math.abs(hash).toString(36)}`;
  }

  private analyzeQueryStructure(query: string) {
    const lowerQuery = query.toLowerCase();

    // Extract tables (simplified)
    const fromMatch = lowerQuery.match(/from\s+(\w+)/g);
    const joinMatch = lowerQuery.match(/join\s+(\w+)/g);
    const tables = [
      ...(fromMatch || []).map((m) => m.replace('from ', '')),
      ...(joinMatch || []).map((m) => m.replace('join ', '')),
    ];

    // Extract WHERE columns (simplified)
    const whereMatch = lowerQuery.match(/where\s+.*?(?=\s+(?:group|order|limit|$))/);
    const whereColumns: string[] = [];
    if (whereMatch) {
      const whereClause = whereMatch[0];
      const columnMatches = whereClause.match(/\b\w+\s*[=<>!]/g);
      if (columnMatches) {
        whereColumns.push(...columnMatches.map((m) => m.replace(/\s*[=<>!].*/, '')));
      }
    }

    // Extract ORDER BY columns (simplified)
    const orderByMatch = lowerQuery.match(/order\s+by\s+([\w\s,]+)/);
    const orderByColumns: string[] = [];
    if (orderByMatch) {
      orderByColumns.push(...orderByMatch[1].split(',').map((c) => c.trim().split(' ')[0]));
    }

    // Extract JOIN columns (simplified)
    const joinColumns: string[] = [];
    const joinConditions = lowerQuery.match(/on\s+\w+\.\w+\s*=\s*\w+\.\w+/g);
    if (joinConditions) {
      joinConditions.forEach((condition) => {
        const columns = condition.match(/\w+\.\w+/g);
        if (columns) {
          joinColumns.push(...columns);
        }
      });
    }

    return {
      tables,
      whereColumns,
      orderByColumns,
      joinColumns,
    };
  }

  private findFrequentColumnCombinations(
    queries: string[]
  ): Array<{ columns: string[]; frequency: number }> {
    const combinations = new Map<string, number>();

    queries.forEach((query) => {
      const analysis = this.analyzeQueryStructure(query);
      const allColumns = [...analysis.whereColumns, ...analysis.orderByColumns];

      // Generate combinations of 2-3 columns
      for (let i = 0; i < allColumns.length; i++) {
        for (let j = i + 1; j < allColumns.length; j++) {
          const combo = [allColumns[i], allColumns[j]].sort().join(',');
          combinations.set(combo, (combinations.get(combo) || 0) + 1);

          // Three-column combinations
          for (let k = j + 1; k < allColumns.length; k++) {
            const combo3 = [allColumns[i], allColumns[j], allColumns[k]].sort().join(',');
            combinations.set(combo3, (combinations.get(combo3) || 0) + 1);
          }
        }
      }
    });

    return Array.from(combinations.entries())
      .filter(([, frequency]) => frequency >= 2)
      .map(([combo, frequency]) => ({
        columns: combo.split(','),
        frequency,
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  private hasUnnecessaryDistinct(query: string): boolean {
    // Simplified check for unnecessary DISTINCT
    return query.toLowerCase().includes('distinct') && !query.toLowerCase().includes('group by');
  }

  private removeUnnecessaryDistinct(query: string): string {
    return query.replace(/\bDISTINCT\b/gi, '');
  }

  private optimizeWhereClause(query: string): { query: string; changed: boolean } {
    // Simplified WHERE clause optimization
    const optimized = query;
    const changed = false;

    // Move more selective conditions first (simplified heuristic)
    const whereMatch = query.match(/(WHERE\s+.*?)(?=\s+(?:GROUP|ORDER|LIMIT|$))/i);
    if (whereMatch) {
      const _whereClause = whereMatch[1];
      // This is a simplified optimization - in reality, you'd need query statistics
      // to determine selectivity
    }

    return { query: optimized, changed };
  }

  private optimizeJoins(query: string): { query: string; changed: boolean } {
    // Simplified JOIN optimization
    return { query, changed: false };
  }

  private shouldAddLimit(query: string): boolean {
    return (
      !query.toLowerCase().includes('limit') &&
      query.toLowerCase().includes('select') &&
      !query.toLowerCase().includes('count(')
    );
  }

  private addReasonableLimit(query: string): string {
    return `${query} LIMIT 1000`;
  }
}

export default QueryOptimizer;
