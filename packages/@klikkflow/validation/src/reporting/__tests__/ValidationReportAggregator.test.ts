import { beforeEach, describe, expect, it } from 'vitest';
import type { ValidationResults } from '../../types/index.js';
import { ValidationReportAggregator } from '../ValidationReportAggregator.js';

describe('ValidationReportAggregator', () => {
  let aggregator: ValidationReportAggregator;
  let mockValidationResults: ValidationResults;

  beforeEach(() => {
    aggregator = new ValidationReportAggregator();

    mockValidationResults = {
      timestamp: new Date(),
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
            packageCoverage: {
              'package-a': 90,
              'package-b': 80,
            },
          },
          packageResults: [
            {
              packageName: 'package-a',
              status: 'success',
              testCount: 50,
              passedCount: 48,
              failedCount: 2,
              coverage: 90,
              duration: 5000,
            },
            {
              packageName: 'package-b',
              status: 'success',
              testCount: 50,
              passedCount: 47,
              failedCount: 3,
              coverage: 80,
              duration: 4000,
            },
          ],
          duration: 9000,
        },
        apiValidation: {
          totalEndpoints: 20,
          validatedEndpoints: 18,
          failedEndpoints: [
            {
              endpoint: '/api/test',
              method: 'GET',
              error: 'Timeout',
              statusCode: 500,
              responseTime: 5000,
            },
          ],
          responseTimeMetrics: {
            average: 150,
            median: 120,
            p95: 300,
            p99: 500,
            slowestEndpoints: [
              {
                endpoint: '/api/slow',
                method: 'POST',
                responseTime: 500,
              },
            ],
          },
          status: 'success',
        },
        e2eResults: {
          totalWorkflows: 10,
          passedWorkflows: 9,
          failedWorkflows: [
            {
              workflowName: 'user-login',
              error: 'Element not found',
              screenshot: 'screenshot.png',
            },
          ],
          crossPackageIntegration: {
            testedIntegrations: 5,
            passedIntegrations: 4,
            failedIntegrations: [
              {
                fromPackage: 'frontend',
                toPackage: 'backend',
                error: 'API connection failed',
                component: 'auth-service',
              },
            ],
          },
          status: 'success',
        },
        buildValidation: {
          overallStatus: 'success',
          packageBuilds: [
            {
              packageName: 'package-a',
              status: 'success',
              buildTime: 10000,
              cacheHit: true,
            },
            {
              packageName: 'package-b',
              status: 'success',
              buildTime: 8000,
              cacheHit: false,
            },
          ],
          totalBuildTime: 18000,
          parallelEfficiency: 75,
          cacheHitRate: 80,
        },
      },
      performanceAnalysis: {
        buildMetrics: {
          totalBuildTime: 45000,
          packageBuildTimes: {
            'package-a': 20000,
            'package-b': 15000,
            'package-c': 10000,
          },
          parallelEfficiency: 75,
          cacheHitRate: 85,
          improvementPercentage: 35,
          bottlenecks: [
            {
              packageName: 'package-a',
              buildTime: 20000,
              suggestions: ['Enable incremental compilation', 'Optimize dependencies'],
            },
          ],
        },
        bundleMetrics: {
          totalSize: 5242880, // 5MB
          packageSizes: {
            'package-a': 2097152, // 2MB
            'package-b': 1572864, // 1.5MB
            'package-c': 1572864, // 1.5MB
          },
          reductionPercentage: 25,
          largestBundles: [
            {
              packageName: 'package-a',
              size: 2097152,
              suggestions: ['Implement code splitting', 'Remove unused dependencies'],
            },
          ],
        },
        memoryProfile: {
          development: {
            heapUsed: 134217728, // 128MB
            heapTotal: 268435456, // 256MB
            external: 16777216, // 16MB
            rss: 402653184, // 384MB
            peak: 536870912, // 512MB
          },
          build: {
            heapUsed: 268435456, // 256MB
            heapTotal: 536870912, // 512MB
            external: 33554432, // 32MB
            rss: 805306368, // 768MB
            peak: 1073741824, // 1GB
          },
          runtime: {
            heapUsed: 67108864, // 64MB
            heapTotal: 134217728, // 128MB
            external: 8388608, // 8MB
            rss: 201326592, // 192MB
            peak: 268435456, // 256MB
          },
          leaks: [
            {
              location: 'package-a/memory-leak.ts',
              severity: 'medium',
              description: 'Event listeners not properly cleaned up',
              suggestion: 'Add cleanup in component unmount',
            },
          ],
          optimizations: [
            {
              area: 'build-cache',
              currentUsage: 104857600, // 100MB
              potentialSavings: 52428800, // 50MB
              recommendation: 'Optimize cache storage strategy',
            },
          ],
        },
        devExperienceMetrics: {
          typeScriptPerformance: {
            compilationTime: 8000,
            autocompleteSpeed: 150,
            typeResolutionAccuracy: 95,
            errorCount: 2,
          },
          idePerformance: {
            navigationSpeed: 200,
            intelliSenseResponseTime: 100,
            sourceMapAccuracy: 98,
            memoryUsage: 67108864, // 64MB
          },
          importPathMetrics: {
            averagePathLength: 45,
            circularDependencies: 1,
            inconsistentPaths: 3,
            optimizationOpportunities: [
              'Use TypeScript path mapping',
              'Standardize import conventions',
            ],
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
          circularDependencies: [
            {
              packages: ['package-a', 'package-b'],
              severity: 'medium',
              suggestion: 'Extract shared interface',
            },
          ],
          packageBoundaryViolations: [
            {
              fromPackage: 'package-a',
              toPackage: 'package-b',
              violationType: 'unauthorized_access',
              suggestion: 'Use proper API boundaries',
            },
          ],
          dependencyGraph: {
            nodes: [
              {
                id: 'package-a',
                packageName: 'package-a',
                type: 'main',
                size: 1024,
              },
              {
                id: 'package-b',
                packageName: 'package-b',
                type: 'specialized',
                size: 512,
              },
            ],
            edges: [
              {
                from: 'package-a',
                to: 'package-b',
                type: 'dependency',
                weight: 1,
              },
            ],
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
            violations: [
              {
                packageName: 'package-a',
                violationType: 'mixed_concerns',
                description: 'Business logic mixed with UI components',
                severity: 'medium',
              },
            ],
            suggestions: ['Separate business logic from UI components'],
          },
          codeDuplication: {
            duplicatedLines: 150,
            duplicatedBlocks: 5,
            duplicatedFiles: [
              {
                files: ['package-a/utils.ts', 'package-b/utils.ts'],
                similarity: 85,
                lines: 30,
                suggestion: 'Extract to shared utility package',
              },
            ],
            overallPercentage: 8,
          },
          namingConsistency: {
            consistencyScore: 90,
            violations: [
              {
                file: 'package-a/component.ts',
                violationType: 'inconsistent_naming',
                current: 'myComponent',
                suggested: 'MyComponent',
              },
            ],
            suggestions: ['Use PascalCase for component names'],
          },
          overallScore: 85,
        },
        typeSafety: {
          crossPackageTypeConsistency: 92,
          interfaceCompatibility: {
            compatibleInterfaces: 18,
            incompatibleInterfaces: [
              {
                interface: 'UserInterface',
                packages: ['package-a', 'package-b'],
                issue: 'Property type mismatch',
                severity: 'medium',
              },
            ],
            suggestions: ['Standardize interface definitions'],
          },
          exportStructureValidation: {
            consistentExports: 15,
            inconsistentExports: [
              {
                packageName: 'package-a',
                issue: 'Missing default export',
                suggestion: 'Add default export for main module',
              },
            ],
            suggestions: ['Standardize export patterns'],
          },
          overallScore: 88,
        },
      },
      recommendations: [
        {
          category: 'performance',
          priority: 'high',
          title: 'Optimize Build Performance',
          description: 'Build time can be improved by 15%',
          impact: 'Faster development cycles',
          effort: 'medium',
          steps: ['Enable build caching', 'Optimize dependencies'],
          affectedPackages: ['package-a'],
        },
        {
          category: 'architecture',
          priority: 'medium',
          title: 'Fix Circular Dependencies',
          description: 'One circular dependency found',
          impact: 'Better code organization',
          effort: 'low',
          steps: ['Extract shared interface'],
          affectedPackages: ['package-a', 'package-b'],
        },
      ],
      nextSteps: [
        'Address high priority recommendations',
        'Monitor performance improvements',
        'Update documentation',
      ],
    };
  });

  describe('addValidationResults', () => {
    it('should add validation results to the aggregator', () => {
      expect(aggregator.getResultsCount()).toBe(0);

      aggregator.addValidationResults(mockValidationResults);

      expect(aggregator.getResultsCount()).toBe(1);
    });

    it('should handle multiple validation results', () => {
      aggregator.addValidationResults(mockValidationResults);
      aggregator.addValidationResults({ ...mockValidationResults, timestamp: new Date() });

      expect(aggregator.getResultsCount()).toBe(2);
    });
  });

  describe('addHistoricalData', () => {
    it('should add historical data for trend analysis', () => {
      const historicalData = [mockValidationResults];

      aggregator.addHistoricalData(historicalData);

      expect(aggregator.getHistoricalDataCount()).toBe(1);
    });
  });

  describe('generateComprehensiveReport', () => {
    it('should generate a comprehensive validation report', async () => {
      aggregator.addValidationResults(mockValidationResults);

      const report = await aggregator.generateComprehensiveReport();

      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.detailedResults).toBe(mockValidationResults);
      expect(report.performanceDashboard).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.documentation).toBeDefined();
    });

    it('should throw error when no validation results available', async () => {
      await expect(aggregator.generateComprehensiveReport()).rejects.toThrow(
        'No validation results available for report generation'
      );
    });

    it('should generate correct validation summary', async () => {
      aggregator.addValidationResults(mockValidationResults);

      const report = await aggregator.generateComprehensiveReport();

      expect(report.summary.overallStatus).toBe('success');
      expect(report.summary.completedValidations).toBe(3);
      expect(report.summary.totalValidations).toBe(3);
      expect(report.summary.criticalIssues).toBe(0);
      expect(report.summary.performanceImprovements.buildTime).toBe(35);
      expect(report.summary.performanceImprovements.bundleSize).toBe(25);
    });

    it('should generate performance dashboard with charts', async () => {
      aggregator.addValidationResults(mockValidationResults);

      const report = await aggregator.generateComprehensiveReport();

      expect(report.performanceDashboard.charts).toBeDefined();
      expect(report.performanceDashboard.charts.length).toBeGreaterThan(0);
      expect(report.performanceDashboard.metrics).toBeDefined();
      expect(report.performanceDashboard.trends).toBeDefined();
      expect(report.performanceDashboard.comparisons).toBeDefined();
    });

    it('should generate metric cards with correct status', async () => {
      aggregator.addValidationResults(mockValidationResults);

      const report = await aggregator.generateComprehensiveReport();

      const buildTimeMetric = report.performanceDashboard.metrics.find(
        (m) => m.id === 'build-time-improvement'
      );
      expect(buildTimeMetric).toBeDefined();
      expect(buildTimeMetric?.status).toBe('success'); // 35% > 30% threshold

      const bundleSizeMetric = report.performanceDashboard.metrics.find(
        (m) => m.id === 'bundle-size-reduction'
      );
      expect(bundleSizeMetric).toBeDefined();
      expect(bundleSizeMetric?.status).toBe('success'); // 25% > 20% threshold
    });

    it('should generate trend analysis', async () => {
      aggregator.addValidationResults(mockValidationResults);

      const report = await aggregator.generateComprehensiveReport();

      expect(report.performanceDashboard.trends.length).toBeGreaterThan(0);

      const buildTimeTrend = report.performanceDashboard.trends.find(
        (t) => t.metric === 'Build Time'
      );
      expect(buildTimeTrend).toBeDefined();
      expect(buildTimeTrend?.direction).toBe('improving');
    });

    it('should generate comparison data', async () => {
      aggregator.addValidationResults(mockValidationResults);

      const report = await aggregator.generateComprehensiveReport();

      expect(report.performanceDashboard.comparisons.length).toBeGreaterThan(0);

      const buildTimeComparison = report.performanceDashboard.comparisons.find(
        (c) => c.metric === 'Build Time'
      );
      expect(buildTimeComparison).toBeDefined();
      expect(buildTimeComparison?.current).toBeDefined();
      expect(buildTimeComparison?.baseline).toBeDefined();
      expect(buildTimeComparison?.target).toBeDefined();
    });

    it('should organize recommendations by priority', async () => {
      aggregator.addValidationResults(mockValidationResults);

      const report = await aggregator.generateComprehensiveReport();

      expect(report.recommendations.critical).toBeDefined();
      expect(report.recommendations.high).toBeDefined();
      expect(report.recommendations.medium).toBeDefined();
      expect(report.recommendations.low).toBeDefined();

      expect(report.recommendations.high.length).toBe(1);
      expect(report.recommendations.medium.length).toBe(1);
    });

    it('should generate documentation updates', async () => {
      aggregator.addValidationResults(mockValidationResults);

      const report = await aggregator.generateComprehensiveReport();

      expect(report.documentation.length).toBeGreaterThan(0);

      const archDoc = report.documentation.find(
        (d) => d.file === 'docs/architecture/package-structure.md'
      );
      expect(archDoc).toBeDefined();
      expect(archDoc?.type).toBe('update');
      expect(archDoc?.content).toContain('Architecture Health Score: 85/100');
    });
  });

  describe('clearResults', () => {
    it('should clear all aggregated results', () => {
      aggregator.addValidationResults(mockValidationResults);
      expect(aggregator.getResultsCount()).toBe(1);

      aggregator.clearResults();

      expect(aggregator.getResultsCount()).toBe(0);
    });
  });
});
