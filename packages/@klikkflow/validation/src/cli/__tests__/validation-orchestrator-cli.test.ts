import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ValidationResults } from '../../types/index.js';
import { ValidationOrchestratorCLI } from '../validation-orchestrator-cli.js';

// Mock dependencies
vi.mock('node:fs');
vi.mock('../controller/ValidationController.js');

describe('ValidationOrchestratorCLI', () => {
  let cli: ValidationOrchestratorCLI;
  let mockWorkspaceRoot: string;
  let mockOutputDir: string;

  beforeEach(() => {
    mockWorkspaceRoot = '/test/workspace';
    mockOutputDir = '/test/output';
    cli = new ValidationOrchestratorCLI(mockWorkspaceRoot, mockOutputDir);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default workspace root', () => {
      const defaultCLI = new ValidationOrchestratorCLI();
      expect(defaultCLI).toBeInstanceOf(ValidationOrchestratorCLI);
    });

    it('should initialize with custom workspace root and output directory', () => {
      expect(cli).toBeInstanceOf(ValidationOrchestratorCLI);
    });
  });

  describe('executeValidation', () => {
    it('should execute validation with default options', async () => {
      const mockResults: Partial<ValidationResults> = {
        phase: 'A',
        status: 'success',
        timestamp: new Date(),
        recommendations: [],
        nextSteps: ['Ready to proceed to Phase B'],
      };

      // Mock the controller's executeValidation method
      vi.mocked(cli as any).controller = {
        executeValidation: vi.fn().mockResolvedValue(mockResults),
        on: vi.fn(),
      };

      const results = await cli.executeValidation();

      expect(results).toEqual(mockResults);
    });

    it('should execute validation with custom options', async () => {
      const options = {
        output: '/custom/output',
        format: 'html' as const,
        verbose: true,
      };

      const mockResults: Partial<ValidationResults> = {
        phase: 'A',
        status: 'success',
        timestamp: new Date(),
        recommendations: [],
        nextSteps: [],
      };

      vi.mocked(cli as any).controller = {
        executeValidation: vi.fn().mockResolvedValue(mockResults),
        on: vi.fn(),
      };

      const results = await cli.executeValidation(options);

      expect(results).toEqual(mockResults);
    });

    it('should handle validation failures', async () => {
      const mockError = new Error('Validation failed');

      vi.mocked(cli as any).controller = {
        executeValidation: vi.fn().mockRejectedValue(mockError),
        on: vi.fn(),
      };

      // Mock process.exit to prevent actual exit
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      await expect(cli.executeValidation()).rejects.toThrow('Process exit called');
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
    });
  });

  describe('executePhases', () => {
    it('should execute specific phases', async () => {
      const phases = ['system-validation', 'performance-analysis'];
      const options = { verbose: true };

      const mockResults: Partial<ValidationResults> = {
        phase: 'A',
        status: 'success',
        timestamp: new Date(),
        recommendations: [],
        nextSteps: [],
      };

      vi.mocked(cli as any).controller = {
        executeValidation: vi.fn().mockResolvedValue(mockResults),
        on: vi.fn(),
      };

      await cli.executePhases(phases, options);

      // Should call executeValidation (for now, as partial execution isn't implemented)
      expect(vi.mocked(cli as any).controller.executeValidation).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should display current validation status', () => {
      const mockStatus = {
        isRunning: false,
        startTime: null,
        errors: [],
        currentPhase: undefined,
      };

      vi.mocked(cli as any).controller = {
        getValidationStatus: vi.fn().mockReturnValue(mockStatus),
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      cli.getStatus();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Validation Status'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Running: No'));

      consoleSpy.mockRestore();
    });

    it('should display running status with current phase', () => {
      const mockStatus = {
        isRunning: true,
        startTime: new Date(),
        errors: [],
        currentPhase: 'system-validation',
      };

      vi.mocked(cli as any).controller = {
        getValidationStatus: vi.fn().mockReturnValue(mockStatus),
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      cli.getStatus();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Running: Yes'));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Current Phase: System Validation')
      );

      consoleSpy.mockRestore();
    });

    it('should display errors when present', () => {
      const mockStatus = {
        isRunning: false,
        startTime: null,
        errors: [
          {
            type: 'test_failure',
            severity: 'critical',
            message: 'Test failed',
            context: {},
            suggestions: [],
            affectedPackages: [],
          },
        ],
        currentPhase: undefined,
      };

      vi.mocked(cli as any).controller = {
        getValidationStatus: vi.fn().mockReturnValue(mockStatus),
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      cli.getStatus();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Errors (1)'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('CRITICAL: Test failed'));

      consoleSpy.mockRestore();
    });
  });

  describe('result export', () => {
    const mockResults: ValidationResults = {
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
      recommendations: [
        {
          category: 'performance',
          priority: 'medium',
          title: 'Optimize bundle size',
          description: 'Consider code splitting for large bundles',
          impact: 'Reduce initial load time by 15%',
          effort: 'medium',
          steps: ['Analyze bundle composition', 'Implement code splitting'],
          affectedPackages: ['frontend'],
        },
      ],
      nextSteps: ['Ready to proceed to Phase B: Feature Development'],
    };

    it('should generate HTML report correctly', () => {
      const html = (cli as any).generateHTMLReport(mockResults);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Phase A Validation Report');
      expect(html).toContain('Status: SUCCESS');
      expect(html).toContain('Tests: 95/100');
      expect(html).toContain('Coverage: 85.0%');
      expect(html).toContain('Build Time Improvement: 35.0%');
      expect(html).toContain('Bundle Size Reduction: 25.0%');
    });

    it('should generate Markdown report correctly', () => {
      const markdown = (cli as any).generateMarkdownReport(mockResults);

      expect(markdown).toContain('# Phase A Validation Report');
      expect(markdown).toContain('**Status:** SUCCESS');
      expect(markdown).toContain('- **Tests:** 95/100 passed');
      expect(markdown).toContain('- **Coverage:** 85.0%');
      expect(markdown).toContain('- **Build Time Improvement:** 35.0%');
      expect(markdown).toContain('- **Bundle Size Reduction:** 25.0%');
      expect(markdown).toContain('## Recommendations');
      expect(markdown).toContain('### 1. Optimize bundle size (MEDIUM)');
    });
  });

  describe('event handling', () => {
    it('should setup event listeners for progress reporting', () => {
      const mockController = {
        on: vi.fn(),
        executeValidation: vi.fn(),
      };

      vi.mocked(cli as any).controller = mockController;

      // Verify event listeners are set up
      expect(mockController.on).toHaveBeenCalledWith('validation:started', expect.any(Function));
      expect(mockController.on).toHaveBeenCalledWith('phase:started', expect.any(Function));
      expect(mockController.on).toHaveBeenCalledWith('component:started', expect.any(Function));
      expect(mockController.on).toHaveBeenCalledWith('component:completed', expect.any(Function));
      expect(mockController.on).toHaveBeenCalledWith('component:failed', expect.any(Function));
      expect(mockController.on).toHaveBeenCalledWith('phase:completed', expect.any(Function));
      expect(mockController.on).toHaveBeenCalledWith('phase:failed', expect.any(Function));
      expect(mockController.on).toHaveBeenCalledWith('validation:completed', expect.any(Function));
      expect(mockController.on).toHaveBeenCalledWith('validation:failed', expect.any(Function));
    });
  });

  describe('formatting helpers', () => {
    it('should format phase names correctly', () => {
      const formatPhaseName = (cli as any).formatPhaseName.bind(cli);

      expect(formatPhaseName('system-validation')).toBe('System Validation');
      expect(formatPhaseName('performance-analysis')).toBe('Performance Analysis');
      expect(formatPhaseName('architecture-validation')).toBe('Architecture Validation');
    });

    it('should format component names correctly', () => {
      const formatComponentName = (cli as any).formatComponentName.bind(cli);

      expect(formatComponentName('test-suite')).toBe('Test Suite');
      expect(formatComponentName('api-validation')).toBe('Api Validation');
      expect(formatComponentName('build-analysis')).toBe('Build Analysis');
    });
  });
});
