import { beforeEach, describe, expect, it } from 'vitest';
import type { ValidationResults } from '../../types/index.js';
import { RecommendationEngine } from '../RecommendationEngine.js';

describe('RecommendationEngine', () => {
  let engine: RecommendationEngine;
  let mockValidationResults: ValidationResults;

  beforeEach(() => {
    engine = new RecommendationEngine();

    mockValidationResults = {
      timestamp: new Date(),
      phase: 'A',
      status: 'warning',
      systemValidation: {
        testResults: {
          overallStatus: 'failure',
          totalTests: 100,
          passedTests: 85,
          failedTests: 15,
          skippedTests: 0,
          coverage: {
            overall: 65, // Below good threshold
            statements: 67,
            branches: 62,
            functions: 70,
            lines: 65,
            packageCoverage: {
              'package-a': 70,
              'package-b': 60,
            },
          },
          packageResults: [
            {
              packageName: 'package-a',
              status: 'failure',
              testCount: 50,
              passedCount: 40,
              failedCount: 10,
              coverage: 70,
              duration: 5000,
              errors: ['Test timeout', 'Assertion failed'],
            },
          ],
          duration: 9000,
        },
        apiValidation: {
          totalEndpoints: 20,
          validatedEndpoints: 15,
          failedEndpoints: [
            {
              endpoint: '/api/test',
              method: 'GET',
              error: 'Timeout',
              statusCode: 500,
              responseTime: 5000,
            },
            {
              endpoint: '/api/slow',
              method: 'POST',
              error: 'Slow response',
              statusCode: 200,
              responseTime: 3000,
            },
          ],
          responseTimeMetrics: {
            average: 1500,
            median: 1200,
            p95: 2500, // Above threshold
            p99: 5000,
            slowestEndpoints: [
              {
                endpoint: '/api/slow',
                method: 'POST',
                responseTime: 5000,
              },
            ],
          },
          status: 'failure',
        },
        e2eResults: {
          totalWorkflows: 10,
          passedWorkflows: 7,
          failedWorkflows: [
            {
              workflowName: 'user-login',
              error: 'Element not found',
              screenshot: 'screenshot.png',
            },
            {
              workflowName: 'checkout-process',
              error: 'Payment gateway timeout',
            },
          ],
          crossPackageIntegration: {
            testedIntegrations: 5,
            passedIntegrations: 3,
            failedIntegrations: [
              {
                fromPackage: 'frontend',
                toPackage: 'backend',
                error: 'API connection failed',
                component: 'auth-service',
              },
            ],
          },
          status: 'failure',
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
          totalBuildTime: 150000, // 150 seconds - above poor threshold
          packageBuildTimes: {
            'package-a': 60000,
            'package-b': 45000,
            'package-c': 45000,
          },
          parallelEfficiency: 45, // Below threshold
          cacheHitRate: 55, // Below poor threshold
          improvementPercentage: 15, // Below 30% target
          bottlenecks: [
            {
              packageName: 'package-a',
              buildTime: 60000,
              suggestions: ['Enable incremental compilation', 'Optimize dependencies'],
            },
            {
              packageName: 'package-b',
              buildTime: 45000,
              suggestions: ['Reduce bundle size', 'Optimize imports'],
            },
          ],
        },
        bundleMetrics: {
          totalSize: 25165824, // 24MB - above poor threshold
          packageSizes: {
            'package-a': 10485760, // 10MB
            'package-b': 8388608, // 8MB
            'package-c': 6291456, // 6MB
          },
          reductionPercentage: 8, // Below 20% target
          largestBundles: [
            {
              packageName: 'package-a',
              size: 10485760,
              suggestions: ['Implement code splitting', 'Remove unused dependencies'],
            },
            {
              packageName: 'package-b',
              size: 8388608,
              suggestions: ['Optimize images', 'Use dynamic imports'],
            },
          ],
        },
        memoryProfile: {
          development: {
            heapUsed: 536870912, // 512MB
            heapTotal: 1073741824, // 1GB
            external: 67108864, // 64MB
            rss: 1610612736, // 1.5GB
            peak: 2147483648, // 2GB - above poor threshold
          },
          build: {
            heapUsed: 2684354560, // 2.5GB - above poor threshold
            heapTotal: 3221225472, // 3GB
            external: 134217728, // 128MB
            rss: 4294967296, // 4GB
            peak: 5368709120, // 5GB
          },
          runtime: {
            heapUsed: 134217728, // 128MB
            heapTotal: 268435456, // 256MB
            external: 16777216, // 16MB
            rss: 402653184, // 384MB
            peak: 536870912, // 512MB
          },
          leaks: [
            {
              location: 'package-a/memory-leak.ts',
              severity: 'high',
              description: 'Critical memory leak in event handlers',
              suggestion: 'Fix event listener cleanup',
            },
            {
              location: 'package-b/cache.ts',
              severity: 'medium',
              description: 'Cache not being cleared properly',
              suggestion: 'Implement proper cache cleanup',
            },
          ],
          optimizations: [
            {
              area: 'build-cache',
              currentUsage: 1073741824, // 1GB
              potentialSavings: 536870912, // 512MB - above 100MB threshold
              recommendation: 'Optimize cache storage strategy',
            },
          ],
        },
        devExperienceMetrics: {
          typeScriptPerformance: {
            compilationTime: 15000,
            autocompleteSpeed: 1500, // Above 1000ms threshold
            typeResolutionAccuracy: 85,
            errorCount: 10,
          },
          idePerformance: {
            navigationSpeed: 800, // Above 500ms threshold
            intelliSenseResponseTime: 300,
            sourceMapAccuracy: 92,
            memoryUsage: 134217728, // 128MB
          },
          importPathMetrics: {
            averagePathLength: 65,
            circularDependencies: 3, // Above 0
            inconsistentPaths: 12, // Above 5
            optimizationOpportunities: [
              'Use TypeScript path mapping',
              'Standardize import conventions',
            ],
          },
          debuggingMetrics: {
            sourceMapAccuracy: 88,
            stackTraceClarity: 85,
            breakpointReliability: 90,
          },
        },
      },
      architectureValidation: {
        dependencyAnalysis: {
          circularDependencies: [
            {
              packages: ['package-a', 'package-b', 'package-c'],
              severity: 'high',
              suggestion: 'Break circular dependency by extracting shared interface',
            },
            {
              packages: ['package-d', 'package-e'],
              severity: 'medium',
              suggestion: 'Refactor to use dependency injection',
            },
          ],
          packageBoundaryViolations: [
            {
              fromPackage: 'package-a',
              toPackage: 'package-b',
              violationType: 'unauthorized_access',
              suggestion: 'Use proper API boundaries',
            },
            {
              fromPackage: 'package-c',
              toPackage: 'package-d',
              violationType: 'layer_violation',
              suggestion: 'Respect architectural layers',
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
              totalNodes: 5,
              totalEdges: 8,
              maxDepth: 3,
              complexity: 2.5,
            },
          },
          healthScore: 45, // Below 70 threshold
        },
        codeOrganization: {
          separationOfConcerns: {
            score: 65, // Below 70 threshold
            violations: [
              {
                packageName: 'package-a',
                violationType: 'mixed_concerns',
                description: 'Business logic mixed with UI components',
                severity: 'high',
              },
            ],
            suggestions: ['Separate business logic from UI components'],
          },
          codeDuplication: {
            duplicatedLines: 500,
            duplicatedBlocks: 15,
            duplicatedFiles: [
              {
                files: ['package-a/utils.ts', 'package-b/utils.ts'],
                similarity: 95,
                lines: 100,
                suggestion: 'Extract to shared utility package',
              },
            ],
            overallPercentage: 15, // Above 10% threshold
          },
          namingConsistency: {
            consistencyScore: 75, // Below 80 threshold
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
          overallScore: 70,
        },
        typeSafety: {
          crossPackageTypeConsistency: 85, // Below 90 threshold
          interfaceCompatibility: {
            compatibleInterfaces: 15,
            incompatibleInterfaces: [
              {
                interface: 'UserInterface',
                packages: ['package-a', 'package-b'],
                issue: 'Property type mismatch',
                severity: 'high',
              },
              {
                interface: 'ConfigInterface',
                packages: ['package-c', 'package-d'],
                issue: 'Missing required property',
                severity: 'medium',
              },
            ],
            suggestions: ['Standardize interface definitions'],
          },
          exportStructureValidation: {
            consistentExports: 12,
            inconsistentExports: [
              {
                packageName: 'package-a',
                issue: 'Missing default export',
                suggestion: 'Add default export for main module',
              },
            ],
            suggestions: ['Standardize export patterns'],
          },
          overallScore: 82,
        },
      },
      recommendations: [],
      nextSteps: [],
    };
  });

  describe('generateRecommendations', () => {
    it('should generate comprehensive recommendations', () => {
      const recommendations = engine.generateRecommendations(mockValidationResults);

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should prioritize recommendations correctly', () => {
      const recommendations = engine.generateRecommendations(mockValidationResults);

      // Should have critical recommendations first
      const criticalRecs = recommendations.filter((r) => r.priority === 'critical');
      const highRecs = recommendations.filter((r) => r.priority === 'high');

      expect(criticalRecs.length).toBeGreaterThan(0);
      expect(highRecs.length).toBeGreaterThan(0);

      // Critical should come before high priority
      const firstCriticalIndex = recommendations.findIndex((r) => r.priority === 'critical');
      const firstHighIndex = recommendations.findIndex((r) => r.priority === 'high');

      if (firstCriticalIndex !== -1 && firstHighIndex !== -1) {
        expect(firstCriticalIndex).toBeLessThan(firstHighIndex);
      }
    });

    it('should generate build performance recommendations', () => {
      const recommendations = engine.generateRecommendations(mockValidationResults);

      const buildRec = recommendations.find(
        (r) => r.category === 'performance' && r.title.includes('Build Performance')
      );

      expect(buildRec).toBeDefined();
      expect(buildRec?.priority).toBe('critical'); // 150s > 120s threshold
      expect(buildRec?.steps).toContain('Enable Turbo build caching across all packages');
    });

    it('should generate cache efficiency recommendations', () => {
      const recommendations = engine.generateRecommendations(mockValidationResults);

      const cacheRec = recommendations.find(
        (r) => r.category === 'build' && r.title.includes('Cache Efficiency')
      );

      expect(cacheRec).toBeDefined();
      expect(cacheRec?.priority).toBe('high'); // 55% < 60% threshold
    });

    it('should generate bundle size recommendations', () => {
      const recommendations = engine.generateRecommendations(mockValidationResults);

      const bundleRec = recommendations.find(
        (r) => r.category === 'performance' && r.title.includes('Bundle Size')
      );

      expect(bundleRec).toBeDefined();
      expect(bundleRec?.priority).toBe('high'); // 24MB > 20MB threshold
    });

    it('should generate memory leak recommendations', () => {
      const recommendations = engine.generateRecommendations(mockValidationResults);

      const memoryRec = recommendations.find(
        (r) => r.category === 'performance' && r.title.includes('Memory Leaks')
      );

      expect(memoryRec).toBeDefined();
      expect(memoryRec?.priority).toBe('critical'); // Has high severity leaks
      expect(memoryRec?.steps).toContain(
        'Fix memory leak in package-a/memory-leak.ts: Fix event listener cleanup'
      );
    });

    it('should generate test coverage recommendations', () => {
      const recommendations = engine.generateRecommendations(mockValidationResults);

      const testRec = recommendations.find(
        (r) => r.category === 'build' && r.title.includes('Test Coverage')
      );

      expect(testRec).toBeDefined();
      expect(testRec?.priority).toBe('medium'); // 65% between 60-80% thresholds
    });

    it('should generate failing tests recommendations', () => {
      const recommendations = engine.generateRecommendations(mockValidationResults);

      const failingTestsRec = recommendations.find(
        (r) => r.category === 'build' && r.title.includes('Failing Tests')
      );

      expect(failingTestsRec).toBeDefined();
      expect(failingTestsRec?.priority).toBe('critical'); // Has failing tests
    });

    it('should generate API endpoint recommendations', () => {
      const recommendations = engine.generateRecommendations(mockValidationResults);

      const apiRec = recommendations.find(
        (r) => r.category === 'build' && r.title.includes('API Endpoint')
      );

      expect(apiRec).toBeDefined();
      expect(apiRec?.priority).toBe('critical'); // Has failed endpoints
    });

    it('should generate circular dependency recommendations', () => {
      const recommendations = engine.generateRecommendations(mockValidationResults);

      const circularRec = recommendations.find(
        (r) => r.category === 'architecture' && r.title.includes('Circular Dependencies')
      );

      expect(circularRec).toBeDefined();
      expect(circularRec?.priority).toBe('critical'); // Has high severity circular deps
    });

    it('should generate architecture health recommendations', () => {
      const recommendations = engine.generateRecommendations(mockValidationResults);

      const healthRec = recommendations.find(
        (r) => r.category === 'architecture' && r.title.includes('Architecture Health')
      );

      expect(healthRec).toBeDefined();
      expect(healthRec?.priority).toBe('critical'); // 45 < 50 threshold
    });

    it('should generate developer experience recommendations', () => {
      const recommendations = engine.generateRecommendations(mockValidationResults);

      const dxRecs = recommendations.filter((r) => r.category === 'developer-experience');

      expect(dxRecs.length).toBeGreaterThan(0);

      const autocompleteRec = dxRecs.find((r) => r.title.includes('Autocomplete'));
      expect(autocompleteRec).toBeDefined();
      expect(autocompleteRec?.priority).toBe('medium'); // 1500ms > 1000ms threshold
    });
  });

  describe('filterByCategory', () => {
    it('should filter recommendations by category', () => {
      const recommendations = engine.generateRecommendations(mockValidationResults);

      const performanceRecs = engine.filterByCategory(recommendations, 'performance');
      const architectureRecs = engine.filterByCategory(recommendations, 'architecture');

      expect(performanceRecs.every((r) => r.category === 'performance')).toBe(true);
      expect(architectureRecs.every((r) => r.category === 'architecture')).toBe(true);
    });
  });

  describe('filterByPriority', () => {
    it('should filter recommendations by priority', () => {
      const recommendations = engine.generateRecommendations(mockValidationResults);

      const criticalRecs = engine.filterByPriority(recommendations, 'critical');
      const highRecs = engine.filterByPriority(recommendations, 'high');

      expect(criticalRecs.every((r) => r.priority === 'critical')).toBe(true);
      expect(highRecs.every((r) => r.priority === 'high')).toBe(true);
    });
  });

  describe('getPackageRecommendations', () => {
    it('should get recommendations for specific packages', () => {
      const recommendations = engine.generateRecommendations(mockValidationResults);

      const packageARecs = engine.getPackageRecommendations(recommendations, 'package-a');

      expect(packageARecs.length).toBeGreaterThan(0);
      expect(packageARecs.every((r) => r.affectedPackages.includes('package-a'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle validation results with missing sections', () => {
      const partialResults: ValidationResults = {
        ...mockValidationResults,
        performanceAnalysis: undefined as any,
        architectureValidation: undefined as any,
      };

      const recommendations = engine.generateRecommendations(partialResults);

      expect(recommendations).toBeDefined();
      // Should still generate system validation recommendations
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should handle perfect validation results', () => {
      const perfectResults: ValidationResults = {
        ...mockValidationResults,
        status: 'success',
        systemValidation: {
          ...mockValidationResults.systemValidation,
          testResults: {
            ...mockValidationResults.systemValidation.testResults,
            overallStatus: 'success',
            failedTests: 0,
            coverage: {
              ...mockValidationResults.systemValidation.testResults.coverage,
              overall: 95,
            },
          },
          apiValidation: {
            ...mockValidationResults.systemValidation.apiValidation,
            failedEndpoints: [],
            status: 'success',
          },
          e2eResults: {
            ...mockValidationResults.systemValidation.e2eResults,
            failedWorkflows: [],
            crossPackageIntegration: {
              ...mockValidationResults.systemValidation.e2eResults.crossPackageIntegration,
              failedIntegrations: [],
            },
            status: 'success',
          },
        },
        performanceAnalysis: {
          ...mockValidationResults.performanceAnalysis,
          buildMetrics: {
            ...mockValidationResults.performanceAnalysis.buildMetrics,
            totalBuildTime: 25000, // 25s - good
            cacheHitRate: 95, // excellent
            improvementPercentage: 40, // above target
            bottlenecks: [],
          },
          bundleMetrics: {
            ...mockValidationResults.performanceAnalysis.bundleMetrics,
            totalSize: 3145728, // 3MB - good
            reductionPercentage: 30, // above target
            largestBundles: [],
          },
          memoryProfile: {
            ...mockValidationResults.performanceAnalysis.memoryProfile,
            leaks: [],
            optimizations: [],
          },
        },
        architectureValidation: {
          ...mockValidationResults.architectureValidation,
          dependencyAnalysis: {
            ...mockValidationResults.architectureValidation.dependencyAnalysis,
            circularDependencies: [],
            packageBoundaryViolations: [],
            healthScore: 95,
          },
        },
      };

      const recommendations = engine.generateRecommendations(perfectResults);

      // Should have very few or no recommendations for perfect results
      const criticalRecs = recommendations.filter((r) => r.priority === 'critical');
      expect(criticalRecs.length).toBe(0);
    });
  });
});
