import { existsSync, rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ValidationResults } from '../../types/index.js';
import { PerformanceTracker } from '../PerformanceTracker.js';

describe('PerformanceTracker', () => {
  let tracker: PerformanceTracker;
  let testDataDir: string;
  let mockValidationResults: ValidationResults;

  beforeEach(() => {
    testDataDir = './test-performance-data';
    tracker = new PerformanceTracker(testDataDir, 100);

    mockValidationResults = {
      timestamp: new Date('2024-01-01T10:00:00Z'),
      phase: 'A',
      status: 'success',
      systemValidation: {
        testResults: {
          overallStatus: 'success',
          totalTests: 100,
          passedTests: 95,
          failedTests: 5,
          skippedTests: 0,
          coverage: {
            overall: 85,
            statements: 87,
            branches: 82,
            functions: 90,
            lines: 85,
            packageCoverage: {},
          },
          packageResults: [],
          duration: 9000,
        },
        apiValidation: {
          totalEndpoints: 20,
          validatedEndpoints: 18,
          failedEndpoints: [],
          responseTimeMetrics: {
            average: 150,
            median: 120,
            p95: 300,
            p99: 500,
            slowestEndpoints: [],
          },
          status: 'success',
        },
        e2eResults: {
          totalWorkflows: 10,
          passedWorkflows: 9,
          failedWorkflows: [],
          crossPackageIntegration: {
            testedIntegrations: 5,
            passedIntegrations: 4,
            failedIntegrations: [],
          },
          status: 'success',
        },
        buildValidation: {
          overallStatus: 'success',
          packageBuilds: [],
          totalBuildTime: 18000,
          parallelEfficiency: 75,
          cacheHitRate: 80,
        },
      },
      performanceAnalysis: {
        buildMetrics: {
          totalBuildTime: 45000, // 45 seconds
          packageBuildTimes: {},
          parallelEfficiency: 75,
          cacheHitRate: 85,
          improvementPercentage: 35,
          bottlenecks: [],
        },
        bundleMetrics: {
          totalSize: 5242880, // 5MB
          packageSizes: {},
          reductionPercentage: 25,
          largestBundles: [],
        },
        memoryProfile: {
          development: {
            heapUsed: 134217728, // 128MB
            heapTotal: 268435456,
            external: 16777216,
            rss: 402653184,
            peak: 536870912,
          },
          build: {
            heapUsed: 268435456, // 256MB
            heapTotal: 536870912,
            external: 33554432,
            rss: 805306368,
            peak: 1073741824,
          },
          runtime: {
            heapUsed: 67108864,
            heapTotal: 134217728,
            external: 8388608,
            rss: 201326592,
            peak: 268435456,
          },
          leaks: [],
          optimizations: [],
        },
        devExperienceMetrics: {
          typeScriptPerformance: {
            compilationTime: 8000, // 8 seconds
            autocompleteSpeed: 150,
            typeResolutionAccuracy: 95,
            errorCount: 2,
          },
          idePerformance: {
            navigationSpeed: 200,
            intelliSenseResponseTime: 100,
            sourceMapAccuracy: 98,
            memoryUsage: 67108864,
          },
          importPathMetrics: {
            averagePathLength: 45,
            circularDependencies: 1,
            inconsistentPaths: 3,
            optimizationOpportunities: [],
          },
          debuggingMetrics: {
            sourceMapAccuracy: 98,
            stackTraceClarity: 90,
            breakpointReliability: 95,
          },
        },
      },
      architectureValidation: {
        dependencyAnalysis: {
          circularDependencies: [],
          packageBoundaryViolations: [],
          dependencyGraph: {
            nodes: [],
            edges: [],
            metrics: {
              totalNodes: 2,
              totalEdges: 1,
              maxDepth: 2,
              complexity: 1.5,
            },
          },
          healthScore: 85,
        },
        codeOrganization: {
          separationOfConcerns: {
            score: 80,
            violations: [],
            suggestions: [],
          },
          codeDuplication: {
            duplicatedLines: 150,
            duplicatedBlocks: 5,
            duplicatedFiles: [],
            overallPercentage: 8,
          },
          namingConsistency: {
            consistencyScore: 90,
            violations: [],
            suggestions: [],
          },
          overallScore: 85,
        },
        typeSafety: {
          crossPackageTypeConsistency: 92,
          interfaceCompatibility: {
            compatibleInterfaces: 18,
            incompatibleInterfaces: [],
            suggestions: [],
          },
          exportStructureValidation: {
            consistentExports: 15,
            inconsistentExports: [],
            suggestions: [],
          },
          overallScore: 88,
        },
      },
      recommendations: [],
      nextSteps: [],
    };
  });

  afterEach(() => {
    // Clean up test data
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('storePerformanceData', () => {
    it('should store performance data from validation results', async () => {
      await tracker.storePerformanceData(mockValidationResults, {
        gitCommit: 'abc123',
        branch: 'main',
      });

      const historicalData = tracker.getHistoricalData();
      expect(historicalData).toHaveLength(1);

      const dataPoint = historicalData[0];
      expect(dataPoint.buildTime).toBe(45); // 45000ms -> 45s
      expect(dataPoint.bundleSize).toBe(5); // 5MB
      expect(dataPoint.testCoverage).toBe(85);
      expect(dataPoint.memoryUsage).toBe(256); // 256MB
      expect(dataPoint.cacheHitRate).toBe(85);
      expect(dataPoint.parallelEfficiency).toBe(75);
      expect(dataPoint.architectureHealthScore).toBe(85);
      expect(dataPoint.typeScriptCompilationTime).toBe(8); // 8000ms -> 8s
      expect(dataPoint.autocompleteSpeed).toBe(150);
      expect(dataPoint.metadata.gitCommit).toBe('abc123');
      expect(dataPoint.metadata.branch).toBe('main');
    });

    it('should handle multiple data points', async () => {
      await tracker.storePerformanceData(mockValidationResults);

      const secondResults = {
        ...mockValidationResults,
        timestamp: new Date('2024-01-02T10:00:00Z'),
      };
      await tracker.storePerformanceData(secondResults);

      const historicalData = tracker.getHistoricalData();
      expect(historicalData).toHaveLength(2);
    });

    it('should limit data points to maxDataPoints', async () => {
      const smallTracker = new PerformanceTracker(`${testDataDir}-small`, 2);

      // Add 3 data points
      for (let i = 0; i < 3; i++) {
        const results = {
          ...mockValidationResults,
          timestamp: new Date(`2024-01-0${i + 1}T10:00:00Z`),
        };
        await smallTracker.storePerformanceData(results);
      }

      const historicalData = smallTracker.getHistoricalData();
      expect(historicalData).toHaveLength(2); // Should keep only the last 2
    });
  });

  describe('analyzeTrends', () => {
    beforeEach(async () => {
      // Add multiple data points with trends
      const baseTime = new Date('2024-01-01T10:00:00Z').getTime();

      for (let i = 0; i < 10; i++) {
        const results = {
          ...mockValidationResults,
          timestamp: new Date(baseTime + i * 24 * 60 * 60 * 1000), // Daily intervals
          performanceAnalysis: {
            ...mockValidationResults.performanceAnalysis,
            buildMetrics: {
              ...mockValidationResults.performanceAnalysis.buildMetrics,
              totalBuildTime: 45000 - i * 1000, // Improving build time
            },
            bundleMetrics: {
              ...mockValidationResults.performanceAnalysis.bundleMetrics,
              totalSize: 5242880 + i * 100000, // Degrading bundle size
            },
          },
          systemValidation: {
            ...mockValidationResults.systemValidation,
            testResults: {
              ...mockValidationResults.systemValidation.testResults,
              coverage: {
                ...mockValidationResults.systemValidation.testResults.coverage,
                overall: 85, // Stable test coverage
              },
            },
          },
        };

        await tracker.storePerformanceData(results);
      }
    });

    it('should analyze performance trends', async () => {
      const trends = await tracker.analyzeTrends(30);

      expect(trends.length).toBeGreaterThan(0);

      // Find build time trend (should be improving)
      const buildTimeTrend = trends.find((t) => t.metric === 'Build Time');
      expect(buildTimeTrend).toBeDefined();
      expect(buildTimeTrend?.direction).toBe('improving');
      expect(buildTimeTrend?.changeRate).toBeLessThan(0); // Negative change rate for improving

      // Find bundle size trend (should be degrading)
      const bundleSizeTrend = trends.find((t) => t.metric === 'Bundle Size');
      expect(bundleSizeTrend).toBeDefined();
      expect(bundleSizeTrend?.direction).toBe('degrading');
      expect(bundleSizeTrend?.changeRate).toBeGreaterThan(0); // Positive change rate for degrading

      // Find test coverage trend (should be stable)
      const testCoverageTrend = trends.find((t) => t.metric === 'Test Coverage');
      expect(testCoverageTrend).toBeDefined();
      expect(testCoverageTrend?.direction).toBe('stable');
    });

    it('should return empty array for insufficient data', async () => {
      const emptyTracker = new PerformanceTracker(`${testDataDir}-empty`);
      const trends = await emptyTracker.analyzeTrends();

      expect(trends).toEqual([]);
    });

    it('should filter data by timeframe', async () => {
      const trends = await tracker.analyzeTrends(5); // Only last 5 days

      expect(trends.length).toBeGreaterThan(0);

      const buildTimeTrend = trends.find((t) => t.metric === 'Build Time');
      expect(buildTimeTrend?.dataPoints).toBeLessThanOrEqual(6); // Should have fewer data points
    });
  });

  describe('detectRegressions', () => {
    beforeEach(async () => {
      // Add baseline data (good performance)
      const baseTime = new Date('2024-01-01T10:00:00Z').getTime();

      for (let i = 0; i < 5; i++) {
        const results = {
          ...mockValidationResults,
          timestamp: new Date(baseTime + i * 24 * 60 * 60 * 1000),
          performanceAnalysis: {
            ...mockValidationResults.performanceAnalysis,
            buildMetrics: {
              ...mockValidationResults.performanceAnalysis.buildMetrics,
              totalBuildTime: 30000, // Good build time
            },
          },
        };

        await tracker.storePerformanceData(results);
      }

      // Add recent data with regression
      const recentResults = {
        ...mockValidationResults,
        timestamp: new Date(baseTime + 10 * 24 * 60 * 60 * 1000),
        performanceAnalysis: {
          ...mockValidationResults.performanceAnalysis,
          buildMetrics: {
            ...mockValidationResults.performanceAnalysis.buildMetrics,
            totalBuildTime: 60000, // Regressed build time (100% increase)
          },
        },
      };

      await tracker.storePerformanceData(recentResults);
    });

    it('should detect performance regressions', async () => {
      const regressions = await tracker.detectRegressions(7, 1);

      expect(regressions.length).toBeGreaterThan(0);

      const buildTimeRegression = regressions.find((r) => r.metric === 'Build Time');
      expect(buildTimeRegression).toBeDefined();
      expect(buildTimeRegression?.severity).toBe('critical'); // 100% increase should be critical
      expect(buildTimeRegression?.regressionPercentage).toBeGreaterThan(50);
      expect(buildTimeRegression?.possibleCauses.length).toBeGreaterThan(0);
      expect(buildTimeRegression?.recommendations.length).toBeGreaterThan(0);
    });

    it('should return empty array for no regressions', async () => {
      const goodTracker = new PerformanceTracker(`${testDataDir}-good`);

      // Add only good data
      for (let i = 0; i < 3; i++) {
        const results = {
          ...mockValidationResults,
          timestamp: new Date(`2024-01-0${i + 1}T10:00:00Z`),
        };
        await goodTracker.storePerformanceData(results);
      }

      const regressions = await goodTracker.detectRegressions();
      expect(regressions).toEqual([]);
    });

    it('should sort regressions by severity', async () => {
      // Add multiple regressions with different severities
      const baseTime = new Date('2024-01-01T10:00:00Z').getTime();

      // Add baseline
      for (let i = 0; i < 3; i++) {
        const results = {
          ...mockValidationResults,
          timestamp: new Date(baseTime + i * 24 * 60 * 60 * 1000),
        };
        await tracker.storePerformanceData(results);
      }

      // Add recent data with multiple regressions
      const recentResults = {
        ...mockValidationResults,
        timestamp: new Date(baseTime + 10 * 24 * 60 * 60 * 1000),
        performanceAnalysis: {
          ...mockValidationResults.performanceAnalysis,
          buildMetrics: {
            ...mockValidationResults.performanceAnalysis.buildMetrics,
            totalBuildTime: 90000, // Major regression
            cacheHitRate: 70, // Minor regression
          },
        },
      };

      await tracker.storePerformanceData(recentResults);

      const regressions = await tracker.detectRegressions(7, 1);

      if (regressions.length > 1) {
        // Should be sorted by severity (critical first)
        const severityOrder = { critical: 3, major: 2, minor: 1 };
        for (let i = 0; i < regressions.length - 1; i++) {
          expect(severityOrder[regressions[i].severity]).toBeGreaterThanOrEqual(
            severityOrder[regressions[i + 1].severity]
          );
        }
      }
    });
  });

  describe('generateComparisons', () => {
    beforeEach(async () => {
      // Add historical data
      const baseTime = new Date('2024-01-01T10:00:00Z').getTime();

      for (let i = 0; i < 5; i++) {
        const results = {
          ...mockValidationResults,
          timestamp: new Date(baseTime + i * 24 * 60 * 60 * 1000),
          performanceAnalysis: {
            ...mockValidationResults.performanceAnalysis,
            buildMetrics: {
              ...mockValidationResults.performanceAnalysis.buildMetrics,
              totalBuildTime: 50000 - i * 2000, // Gradual improvement
            },
          },
        };

        await tracker.storePerformanceData(results);
      }
    });

    it('should generate performance comparisons', async () => {
      const comparisons = await tracker.generateComparisons();

      expect(comparisons.length).toBeGreaterThan(0);

      const buildTimeComparison = comparisons.find((c) => c.metric === 'Build Time');
      expect(buildTimeComparison).toBeDefined();
      expect(buildTimeComparison?.current).toBeDefined();
      expect(buildTimeComparison?.previous).toBeDefined();
      expect(buildTimeComparison?.baseline).toBeDefined();
      expect(buildTimeComparison?.target).toBeDefined();
      expect(buildTimeComparison?.status).toMatch(/improved|degraded|stable/);
    });

    it('should calculate correct change percentages', async () => {
      const comparisons = await tracker.generateComparisons();

      const buildTimeComparison = comparisons.find((c) => c.metric === 'Build Time');
      expect(buildTimeComparison).toBeDefined();

      // Should show improvement from previous (negative change for build time is good)
      expect(buildTimeComparison?.changeFromPrevious).toBeLessThan(0);
      expect(buildTimeComparison?.status).toBe('improved');
    });

    it('should return empty array for insufficient data', async () => {
      const emptyTracker = new PerformanceTracker(`${testDataDir}-empty`);
      const comparisons = await emptyTracker.generateComparisons();

      expect(comparisons).toEqual([]);
    });
  });

  describe('getMetricStatistics', () => {
    beforeEach(async () => {
      // Add data with known statistics
      const values = [10, 20, 30, 40, 50]; // Build times in seconds

      for (let i = 0; i < values.length; i++) {
        const results = {
          ...mockValidationResults,
          timestamp: new Date(`2024-01-0${i + 1}T10:00:00Z`),
          performanceAnalysis: {
            ...mockValidationResults.performanceAnalysis,
            buildMetrics: {
              ...mockValidationResults.performanceAnalysis.buildMetrics,
              totalBuildTime: values[i] * 1000, // Convert to milliseconds
            },
          },
        };

        await tracker.storePerformanceData(results);
      }
    });

    it('should calculate correct statistics', () => {
      const stats = tracker.getMetricStatistics('buildTime');

      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
      expect(stats.average).toBe(30);
      expect(stats.median).toBe(30);
      expect(stats.dataPoints).toBe(5);
      expect(stats.standardDeviation).toBeCloseTo(14.14, 1); // sqrt(200)
    });

    it('should filter by timeframe', () => {
      const stats = tracker.getMetricStatistics('buildTime', 2); // Last 2 days

      expect(stats.dataPoints).toBeLessThanOrEqual(2);
    });

    it('should handle empty data', () => {
      const emptyTracker = new PerformanceTracker(`${testDataDir}-empty`);
      const stats = emptyTracker.getMetricStatistics('buildTime');

      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.average).toBe(0);
      expect(stats.median).toBe(0);
      expect(stats.standardDeviation).toBe(0);
      expect(stats.dataPoints).toBe(0);
    });
  });

  describe('exportToCSV', () => {
    beforeEach(async () => {
      await tracker.storePerformanceData(mockValidationResults, {
        gitCommit: 'abc123',
        branch: 'main',
        version: '1.0.0',
      });
    });

    it('should export data to CSV format', () => {
      const csvPath = tracker.exportToCSV();

      expect(existsSync(csvPath)).toBe(true);

      const fs = require('node:fs');
      const csvContent = fs.readFileSync(csvPath, 'utf-8');

      expect(csvContent).toContain('timestamp,buildTime,bundleSize');
      expect(csvContent).toContain('2024-01-01T10:00:00.000Z');
      expect(csvContent).toContain('abc123');
      expect(csvContent).toContain('main');
    });

    it('should handle empty data', () => {
      const emptyTracker = new PerformanceTracker(`${testDataDir}-empty`);
      const csvPath = emptyTracker.exportToCSV();

      expect(csvPath).toBeDefined();
    });
  });

  describe('clearHistoricalData', () => {
    it('should clear all historical data', async () => {
      await tracker.storePerformanceData(mockValidationResults);
      expect(tracker.getHistoricalData()).toHaveLength(1);

      tracker.clearHistoricalData();

      expect(tracker.getHistoricalData()).toHaveLength(0);
    });
  });

  describe('getHistoricalData', () => {
    beforeEach(async () => {
      // Add data across multiple days
      for (let i = 0; i < 5; i++) {
        const results = {
          ...mockValidationResults,
          timestamp: new Date(`2024-01-0${i + 1}T10:00:00Z`),
        };
        await tracker.storePerformanceData(results);
      }
    });

    it('should return all data when no date range specified', () => {
      const data = tracker.getHistoricalData();
      expect(data).toHaveLength(5);
    });

    it('should filter by start date', () => {
      const startDate = new Date('2024-01-03T00:00:00Z');
      const data = tracker.getHistoricalData(startDate);

      expect(data.length).toBeLessThan(5);
      expect(data.every((point) => new Date(point.timestamp) >= startDate)).toBe(true);
    });

    it('should filter by end date', () => {
      const endDate = new Date('2024-01-03T23:59:59Z');
      const data = tracker.getHistoricalData(undefined, endDate);

      expect(data.length).toBeLessThan(5);
      expect(data.every((point) => new Date(point.timestamp) <= endDate)).toBe(true);
    });

    it('should filter by date range', () => {
      const startDate = new Date('2024-01-02T00:00:00Z');
      const endDate = new Date('2024-01-04T23:59:59Z');
      const data = tracker.getHistoricalData(startDate, endDate);

      expect(data.length).toBeLessThanOrEqual(3);
      expect(
        data.every((point) => {
          const pointDate = new Date(point.timestamp);
          return pointDate >= startDate && pointDate <= endDate;
        })
      ).toBe(true);
    });
  });
});
