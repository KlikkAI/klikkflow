import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ValidationResults } from '../../types/index.js';
import { ContinuousValidationIntegration } from '../ContinuousValidationIntegration.js';

// Mock dependencies
vi.mock('node:fs');
vi.mock('../controller/ValidationController.js');

describe('ContinuousValidationIntegration', () => {
  let integration: ContinuousValidationIntegration;
  let mockWorkspaceRoot: string;

  beforeEach(() => {
    mockWorkspaceRoot = '/test/workspace';
    integration = new ContinuousValidationIntegration(mockWorkspaceRoot);

    // Mock file system operations
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue('{}');
    vi.mocked(writeFileSync).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default workspace root', () => {
      const defaultIntegration = new ContinuousValidationIntegration();
      expect(defaultIntegration).toBeInstanceOf(ContinuousValidationIntegration);
    });

    it('should initialize with custom workspace root', () => {
      expect(integration).toBeInstanceOf(ContinuousValidationIntegration);
    });

    it('should load default configuration when no config file exists', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const newIntegration = new ContinuousValidationIntegration(mockWorkspaceRoot);
      expect(newIntegration).toBeInstanceOf(ContinuousValidationIntegration);
    });

    it('should load custom configuration when config file exists', () => {
      const customConfig = {
        thresholds: {
          buildTimeRegression: 15,
          bundleSizeIncrease: 10,
          coverageDecrease: 5,
          criticalIssues: 1,
        },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(customConfig));

      const newIntegration = new ContinuousValidationIntegration(mockWorkspaceRoot);
      expect(newIntegration).toBeInstanceOf(ContinuousValidationIntegration);
    });
  });

  describe('executeForCI', () => {
    const mockValidationResults: ValidationResults = {
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
            statements: 85,
            branches: 80,
            functions: 90,
            lines: 85,
            packageCoverage: {},
          },
          packageResults: [],
          duration: 30000,
        },
        apiValidation: {
          totalEndpoints: 20,
          validatedEndpoints: 20,
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
          passedWorkflows: 10,
          failedWorkflows: [],
          crossPackageIntegration: {
            testedIntegrations: 5,
            passedIntegrations: 5,
            failedIntegrations: [],
          },
          status: 'success',
        },
        buildValidation: {
          overallStatus: 'success',
          packageBuilds: [],
          totalBuildTime: 120000,
          parallelEfficiency: 85,
          cacheHitRate: 70,
        },
      },
      performanceAnalysis: {
        buildMetrics: {
          totalBuildTime: 120000,
          packageBuildTimes: {},
          parallelEfficiency: 85,
          cacheHitRate: 70,
          improvementPercentage: 35,
          bottlenecks: [],
        },
        bundleMetrics: {
          totalSize: 2048000,
          packageSizes: {},
          reductionPercentage: 25,
          largestBundles: [],
        },
        memoryProfile: {
          development: {
            heapUsed: 100000000,
            heapTotal: 150000000,
            external: 10000000,
            rss: 200000000,
            peak: 180000000,
          },
          build: {
            heapUsed: 200000000,
            heapTotal: 250000000,
            external: 20000000,
            rss: 300000000,
            peak: 280000000,
          },
          runtime: {
            heapUsed: 80000000,
            heapTotal: 120000000,
            external: 8000000,
            rss: 150000000,
            peak: 140000000,
          },
          leaks: [],
          optimizations: [],
        },
        devExperienceMetrics: {
          typeScriptPerformance: {
            compilationTime: 5000,
            autocompleteSpeed: 100,
            typeResolutionAccuracy: 95,
            errorCount: 2,
          },
          idePerformance: {
            navigationSpeed: 50,
            intelliSenseResponseTime: 80,
            sourceMapAccuracy: 98,
            memoryUsage: 150000000,
          },
          importPathMetrics: {
            averagePathLength: 25,
            circularDependencies: 0,
            inconsistentPaths: 1,
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
            metrics: { totalNodes: 12, totalEdges: 25, maxDepth: 4, complexity: 15 },
          },
          healthScore: 95,
        },
        codeOrganization: {
          separationOfConcerns: { score: 90, violations: [], suggestions: [] },
          codeDuplication: {
            duplicatedLines: 50,
            duplicatedBlocks: 2,
            duplicatedFiles: [],
            overallPercentage: 1.2,
          },
          namingConsistency: { consistencyScore: 88, violations: [], suggestions: [] },
          overallScore: 89,
        },
        typeSafety: {
          crossPackageTypeConsistency: 92,
          interfaceCompatibility: {
            compatibleInterfaces: 45,
            incompatibleInterfaces: [],
            suggestions: [],
          },
          exportStructureValidation: {
            consistentExports: 38,
            inconsistentExports: [],
            suggestions: [],
          },
          overallScore: 92,
        },
      },
      recommendations: [],
      nextSteps: ['Ready to proceed to Phase B'],
    };

    it('should execute validation successfully for CI', async () => {
      // Mock the validation controller
      vi.mocked(integration as any).controller = {
        executeValidation: vi.fn().mockResolvedValue(mockValidationResults),
      };

      const result = await integration.executeForCI();

      expect(result.success).toBe(true);
      expect(result.results).toEqual(mockValidationResults);
      expect(result.exitCode).toBe(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.artifacts).toBeInstanceOf(Array);
      expect(result.notifications).toBeInstanceOf(Array);
    });

    it('should handle validation failures in CI', async () => {
      const mockError = new Error('Validation failed');

      vi.mocked(integration as any).controller = {
        executeValidation: vi.fn().mockRejectedValue(mockError),
      };

      const result = await integration.executeForCI();

      expect(result.success).toBe(false);
      expect(result.results).toBeNull();
      expect(result.exitCode).toBe(1);
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].type).toBe('failure');
      expect(result.notifications[0].severity).toBe('critical');
    });

    it('should analyze trends when previous results exist', async () => {
      const previousResults = { ...mockValidationResults };
      previousResults.performanceAnalysis.buildMetrics.totalBuildTime = 150000; // Slower than current

      vi.mocked(integration as any).loadPreviousResults = vi.fn().mockReturnValue(previousResults);
      vi.mocked(integration as any).controller = {
        executeValidation: vi.fn().mockResolvedValue(mockValidationResults),
      };

      const result = await integration.executeForCI();

      expect(result.analysis).toBeDefined();
      expect(result.analysis?.trends.buildTime).toBe('improving');
    });

    it('should detect regressions', async () => {
      const previousResults = { ...mockValidationResults };
      previousResults.performanceAnalysis.buildMetrics.totalBuildTime = 100000; // Faster than current

      vi.mocked(integration as any).loadPreviousResults = vi.fn().mockReturnValue(previousResults);
      vi.mocked(integration as any).controller = {
        executeValidation: vi.fn().mockResolvedValue(mockValidationResults),
      };

      const result = await integration.executeForCI();

      expect(result.analysis?.isRegression).toBe(true);
      expect(result.analysis?.trends.buildTime).toBe('degrading');
    });
  });

  describe('CI configuration generation', () => {
    it('should generate GitHub Actions workflow', () => {
      const workflow = integration.generateGitHubActionsWorkflow();

      expect(workflow).toContain('name: Phase A Validation');
      expect(workflow).toContain('on:');
      expect(workflow).toContain('push:');
      expect(workflow).toContain('pull_request:');
      expect(workflow).toContain('schedule:');
      expect(workflow).toContain('npx @klikkflow/validation run');
      expect(workflow).toContain('actions/upload-artifact@v4');
    });

    it('should generate GitLab CI configuration', () => {
      const config = integration.generateGitLabCIConfig();

      expect(config).toContain('stages:');
      expect(config).toContain('- validation');
      expect(config).toContain('phase-a-validation:');
      expect(config).toContain('image: node:18');
      expect(config).toContain('npx @klikkflow/validation run');
      expect(config).toContain('artifacts:');
    });

    it('should generate Jenkinsfile', () => {
      const jenkinsfile = integration.generateJenkinsfile();

      expect(jenkinsfile).toContain('pipeline {');
      expect(jenkinsfile).toContain('agent any');
      expect(jenkinsfile).toContain("nodejs '18'");
      expect(jenkinsfile).toContain('triggers {');
      expect(jenkinsfile).toContain("cron('H 2 * * *')");
      expect(jenkinsfile).toContain('npx @klikkflow/validation run');
      expect(jenkinsfile).toContain('archiveArtifacts');
    });
  });

  describe('notification generation', () => {
    it('should generate failure notifications', () => {
      const failureResults = { ...mockValidationResults, status: 'failure' as const };
      const notifications = (integration as any).generateNotifications(failureResults, null);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('failure');
      expect(notifications[0].title).toContain('Failed');
      expect(notifications[0].severity).toBe('critical');
    });

    it('should generate warning notifications', () => {
      const warningResults = { ...mockValidationResults, status: 'warning' as const };
      const notifications = (integration as any).generateNotifications(warningResults, null);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('warning');
      expect(notifications[0].title).toContain('Warnings');
      expect(notifications[0].severity).toBe('warning');
    });

    it('should generate success notifications when configured', () => {
      vi.mocked(integration as any).config = {
        notifications: { onSuccess: true },
      };

      const notifications = (integration as any).generateNotifications(mockValidationResults, null);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('success');
      expect(notifications[0].title).toContain('Successful');
      expect(notifications[0].severity).toBe('info');
    });

    it('should generate regression notifications', () => {
      const analysis = {
        isRegression: true,
        trends: { buildTime: 'degrading' },
      };

      vi.mocked(integration as any).config = {
        notifications: { onRegression: true },
      };

      const notifications = (integration as any).generateNotifications(
        mockValidationResults,
        analysis
      );

      expect(notifications.some((n) => n.type === 'regression')).toBe(true);
    });
  });

  describe('exit code determination', () => {
    it('should return 0 for successful validation', () => {
      const exitCode = (integration as any).determineExitCode(mockValidationResults, null);
      expect(exitCode).toBe(0);
    });

    it('should return 1 for failed validation', () => {
      const failureResults = { ...mockValidationResults, status: 'failure' as const };
      const exitCode = (integration as any).determineExitCode(failureResults, null);
      expect(exitCode).toBe(1);
    });

    it('should return 1 for critical issues when configured', () => {
      const resultsWithCritical = {
        ...mockValidationResults,
        recommendations: [
          {
            category: 'build',
            priority: 'critical' as const,
            title: 'Critical issue',
            description: 'This is critical',
            impact: 'High',
            effort: 'low',
            steps: [],
            affectedPackages: [],
          },
        ],
      };

      vi.mocked(integration as any).config = {
        failureConditions: { criticalIssues: true },
        thresholds: { criticalIssues: 0 },
      };

      const exitCode = (integration as any).determineExitCode(resultsWithCritical, null);
      expect(exitCode).toBe(1);
    });

    it('should return 1 for build time regression when configured', () => {
      const analysis = {
        trends: { buildTime: 'degrading' },
      };

      vi.mocked(integration as any).config = {
        failureConditions: { buildTimeRegression: true },
      };

      const exitCode = (integration as any).determineExitCode(mockValidationResults, analysis);
      expect(exitCode).toBe(1);
    });
  });

  describe('trend analysis', () => {
    it('should detect improving trends', () => {
      const analyzeTrend = (integration as any).analyzeTrend.bind(integration);

      const trend = analyzeTrend(100, 120, 10); // 16.7% improvement, threshold 10%
      expect(trend).toBe('improving');
    });

    it('should detect degrading trends', () => {
      const analyzeTrend = (integration as any).analyzeTrend.bind(integration);

      const trend = analyzeTrend(120, 100, 10); // 20% degradation, threshold 10%
      expect(trend).toBe('degrading');
    });

    it('should detect stable trends', () => {
      const analyzeTrend = (integration as any).analyzeTrend.bind(integration);

      const trend = analyzeTrend(105, 100, 10); // 5% change, threshold 10%
      expect(trend).toBe('stable');
    });
  });

  describe('artifact generation', () => {
    it('should generate artifacts for configured formats', async () => {
      vi.mocked(integration as any).config = {
        artifacts: { formats: ['json', 'html'] },
      };

      const artifacts = await (integration as any).generateArtifacts(mockValidationResults, {});

      expect(artifacts).toHaveLength(2);
      expect(artifacts.some((a: any) => a.type === 'json')).toBe(true);
      expect(artifacts.some((a: any) => a.type === 'html')).toBe(true);
    });
  });
});
