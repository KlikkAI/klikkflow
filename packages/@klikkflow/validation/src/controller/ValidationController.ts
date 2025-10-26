import { EventEmitter } from 'node:events';
import { CodeOrganizationChecker } from '../architecture/code-organization-checker.js';
import { DependencyAnalyzer } from '../architecture/dependency-analyzer.js';
import { TypeSafetyValidator } from '../architecture/type-safety-validator.js';
import { BuildTimeAnalyzer } from '../build-time-analyzer.js';
import { BundleSizeAnalyzer } from '../bundle-size-analyzer.js';
import { DevExperienceMetrics } from '../developer-experience/DevExperienceMetrics.js';
import { IDEPerformanceValidator } from '../ide-performance/ide-performance-validator.js';
import { ImportPathOptimizer } from '../import-optimization/import-path-optimizer.js';
import { MemoryMonitor } from '../monitoring/MemoryMonitor.js';
import { RecommendationEngine } from '../reporting/RecommendationEngine.js';
import { ValidationReportAggregator } from '../reporting/ValidationReportAggregator.js';
import { APIValidator } from '../system/APIValidator.js';
import { BuildValidator } from '../system/BuildValidator.js';
import { E2EValidator } from '../system/E2EValidator.js';
// Import validation components
import { TestSuiteRunner } from '../system/TestSuiteRunner.js';
import type {
  OptimizationRecommendation,
  ValidationError,
  ValidationResults,
  ValidationSummary,
} from '../types/index.js';
import { ValidationErrorType } from '../types/index.js';
import { TypeScriptAnalyzer } from '../typescript/analyzer.js';

/**
 * Main validation controller that orchestrates all validation phases
 * Requirements: 1.1, 1.5, 2.1, 2.4
 */
export class ValidationController extends EventEmitter {
  private validationResults: Partial<ValidationResults> = {};
  private errors: ValidationError[] = [];
  private startTime: Date | null = null;
  private isRunning = false;
  private currentPhase: string | null = null;

  // Validation components
  private testSuiteRunner!: TestSuiteRunner;
  private apiValidator!: APIValidator;
  private e2eValidator!: E2EValidator;
  private buildValidator!: BuildValidator;
  private buildTimeAnalyzer!: BuildTimeAnalyzer;
  private bundleSizeAnalyzer!: BundleSizeAnalyzer;
  private memoryMonitor!: MemoryMonitor;
  private devExperienceMetrics!: DevExperienceMetrics;
  private dependencyAnalyzer!: DependencyAnalyzer;
  private codeOrganizationChecker!: CodeOrganizationChecker;
  private typeSafetyValidator!: TypeSafetyValidator;
  private typeScriptAnalyzer!: TypeScriptAnalyzer;
  private idePerformanceValidator!: IDEPerformanceValidator;
  private importPathOptimizer!: ImportPathOptimizer;
  private reportAggregator!: ValidationReportAggregator;
  private recommendationEngine!: RecommendationEngine;

  constructor(workspaceRoot: string = process.cwd()) {
    super();
    this.setupErrorHandling();
    this.initializeComponents(workspaceRoot);
  }

  /**
   * Initialize all validation components
   */
  private initializeComponents(workspaceRoot: string): void {
    try {
      this.testSuiteRunner = new TestSuiteRunner(workspaceRoot);
      this.apiValidator = new APIValidator({
        baseUrl: process.env.API_URL || 'http://localhost:3000',
        timeout: 30000,
        retryAttempts: 3,
        endpoints: [],
      });
      this.e2eValidator = new E2EValidator({
        baseUrl: process.env.E2E_BASE_URL || 'http://localhost:3000',
        headless: true,
        timeout: 60000,
        workflows: [],
      });
      this.buildValidator = new BuildValidator({
        workspaceRoot,
        buildCommand: 'pnpm build',
        packages: [],
        timeout: 300000,
        parallelBuilds: true,
        validateArtifacts: true,
        artifactPaths: ['dist'],
      });
      this.buildTimeAnalyzer = new BuildTimeAnalyzer();
      this.bundleSizeAnalyzer = new BundleSizeAnalyzer(workspaceRoot);
      this.memoryMonitor = new MemoryMonitor();
      this.devExperienceMetrics = new DevExperienceMetrics(workspaceRoot);
      this.typeScriptAnalyzer = new TypeScriptAnalyzer(workspaceRoot);
      this.idePerformanceValidator = new IDEPerformanceValidator(workspaceRoot);
      this.importPathOptimizer = new ImportPathOptimizer(workspaceRoot);
      this.dependencyAnalyzer = new DependencyAnalyzer(workspaceRoot);
      this.codeOrganizationChecker = new CodeOrganizationChecker(workspaceRoot);
      this.typeSafetyValidator = new TypeSafetyValidator(workspaceRoot);
      this.reportAggregator = new ValidationReportAggregator();
      this.recommendationEngine = new RecommendationEngine();
    } catch (error) {
      const validationError = this.createValidationError(
        ValidationErrorType.BUILD_ERROR,
        'critical',
        `Failed to initialize validation components: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { stackTrace: error instanceof Error ? error.stack : undefined }
      );
      this.errors.push(validationError);
      throw error;
    }
  }

  /**
   * Execute the complete Phase A validation workflow
   */
  async executeValidation(): Promise<ValidationResults> {
    if (this.isRunning) {
      throw new Error('Validation is already running');
    }

    this.isRunning = true;
    this.startTime = new Date();
    this.emit('validation:started');

    try {
      // Initialize validation results structure
      this.initializeValidationResults();

      // Execute validation phases in sequence
      await this.executeSystemValidation();
      await this.executePerformanceAnalysis();
      await this.executeArchitectureValidation();

      // Generate final results and recommendations
      const finalResults = await this.generateFinalResults();

      this.emit('validation:completed', finalResults);
      return finalResults;
    } catch (error) {
      const validationError = this.createValidationError(
        ValidationErrorType.BUILD_ERROR,
        'critical',
        `Validation execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { stackTrace: error instanceof Error ? error.stack : undefined }
      );

      this.errors.push(validationError);
      this.emit('validation:failed', validationError);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Execute system validation phase
   * Requirements: 1.1, 1.5
   */
  private async executeSystemValidation(): Promise<void> {
    this.currentPhase = 'system-validation';
    this.emit('phase:started', 'system-validation');

    try {
      // Execute test suite validation
      this.emit('component:started', 'test-suite');
      const testResults = await this.executeWithRecovery(
        () => this.testSuiteRunner.runAllTests(),
        'test-suite'
      );

      // Execute API validation
      this.emit('component:started', 'api-validation');
      const apiValidation = await this.executeWithRecovery(
        () => this.apiValidator.validateEndpoints(),
        'api-validation'
      );

      // Execute E2E validation
      this.emit('component:started', 'e2e-validation');
      const e2eResults = await this.executeWithRecovery(
        () => this.e2eValidator.runFrontendWorkflows(),
        'e2e-validation'
      );

      // Execute build validation
      this.emit('component:started', 'build-validation');
      const buildValidation = await this.executeWithRecovery(
        () => this.buildValidator.validateBuildProcess(),
        'build-validation'
      );

      this.validationResults.systemValidation = {
        testResults: testResults || this.getDefaultTestResults(),
        apiValidation: apiValidation || this.getDefaultApiResults(),
        e2eResults: e2eResults || this.getDefaultE2EResults(),
        buildValidation: buildValidation || this.getDefaultBuildResults(),
      };

      this.emit('phase:completed', 'system-validation');
    } catch (error) {
      this.handlePhaseError('system-validation', error);
      throw error;
    }
  }

  /**
   * Execute performance analysis phase
   * Requirements: 2.1, 2.4
   */
  private async executePerformanceAnalysis(): Promise<void> {
    this.currentPhase = 'performance-analysis';
    this.emit('phase:started', 'performance-analysis');

    try {
      // Execute build time analysis
      this.emit('component:started', 'build-analysis');
      const buildMetrics = await this.executeWithRecovery(
        () => this.buildTimeAnalyzer.measureBuildTimes(),
        'build-analysis'
      );

      // Execute bundle size analysis
      this.emit('component:started', 'bundle-analysis');
      const bundleMetrics = await this.executeWithRecovery(
        () => this.bundleSizeAnalyzer.analyzeBundleSizes(),
        'bundle-analysis'
      );

      // Execute memory profiling
      this.emit('component:started', 'memory-analysis');
      const memoryProfile = await this.executeWithRecovery(
        () => this.memoryMonitor.profileMemoryUsage(),
        'memory-analysis'
      );

      // Execute developer experience metrics
      this.emit('component:started', 'dev-experience');
      const devExperienceMetrics = await this.executeWithRecovery(
        () => this.collectDevExperienceMetrics(),
        'dev-experience'
      );

      this.validationResults.performanceAnalysis = {
        buildMetrics: (buildMetrics || this.getDefaultBuildMetrics()) as any,
        bundleMetrics: (bundleMetrics || this.getDefaultBundleMetrics()) as any,
        memoryProfile: memoryProfile || this.getDefaultMemoryProfile(),
        devExperienceMetrics: (devExperienceMetrics ||
          this.getDefaultDevExperienceMetrics()) as any,
      };

      this.emit('phase:completed', 'performance-analysis');
    } catch (error) {
      this.handlePhaseError('performance-analysis', error);
      throw error;
    }
  }

  /**
   * Execute architecture validation phase
   * Requirements: 4.1, 4.4
   */
  private async executeArchitectureValidation(): Promise<void> {
    this.currentPhase = 'architecture-validation';
    this.emit('phase:started', 'architecture-validation');

    try {
      // Execute dependency analysis
      this.emit('component:started', 'dependency-analysis');
      const dependencyAnalysis = await this.executeWithRecovery(
        () => this.validateDependencies(),
        'dependency-analysis'
      );

      // Execute code organization validation
      this.emit('component:started', 'code-organization');
      const codeOrganization = await this.executeWithRecovery(
        () => this.codeOrganizationChecker.validateCodeOrganization(),
        'code-organization'
      );

      // Execute type safety validation
      this.emit('component:started', 'type-safety');
      const typeSafety = await this.executeWithRecovery(
        () => this.typeSafetyValidator.validateTypeSafety(),
        'type-safety'
      );

      this.validationResults.architectureValidation = {
        dependencyAnalysis: (dependencyAnalysis || this.getDefaultDependencyAnalysis()) as any,
        codeOrganization: (codeOrganization || this.getDefaultCodeOrganization()) as any,
        typeSafety: (typeSafety || this.getDefaultTypeSafety()) as any,
      };

      this.emit('phase:completed', 'architecture-validation');
    } catch (error) {
      this.handlePhaseError('architecture-validation', error);
      throw error;
    }
  }

  /**
   * Generate final validation results with recommendations
   */
  private async generateFinalResults(): Promise<ValidationResults> {
    const endTime = new Date();

    // Determine overall status
    const status = this.determineOverallStatus();

    // Generate recommendations based on results
    const recommendations = await this.generateRecommendations();

    // Generate next steps
    const nextSteps = this.generateNextSteps(status, recommendations);

    const finalResults: ValidationResults = {
      timestamp: endTime,
      phase: 'A',
      status,
      systemValidation: this.validationResults.systemValidation!,
      performanceAnalysis: this.validationResults.performanceAnalysis!,
      architectureValidation: this.validationResults.architectureValidation!,
      recommendations,
      nextSteps,
    };

    return finalResults;
  }

  /**
   * Initialize validation results structure
   */
  private initializeValidationResults(): void {
    this.validationResults = {};
    this.errors = [];
  }

  /**
   * Determine overall validation status
   */
  private determineOverallStatus(): 'success' | 'warning' | 'failure' {
    const criticalErrors = this.errors.filter((e) => e.severity === 'critical');
    const warnings = this.errors.filter((e) => e.severity === 'warning');

    if (criticalErrors.length > 0) {
      return 'failure';
    }
    if (warnings.length > 0) {
      return 'warning';
    }
    return 'success';
  }

  /**
   * Generate optimization recommendations based on validation results
   */
  private async generateRecommendations(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Add recommendations based on errors and validation results
    for (const error of this.errors) {
      if (error.suggestions.length > 0) {
        recommendations.push({
          category: this.mapErrorTypeToCategory(error.type),
          priority:
            error.severity === 'critical'
              ? 'critical'
              : error.severity === 'warning'
                ? 'medium'
                : 'low',
          title: `Resolve ${error.type.replace('_', ' ')}`,
          description: error.message,
          impact: `Affects ${error.affectedPackages.join(', ')}`,
          effort: 'medium',
          steps: error.suggestions,
          affectedPackages: error.affectedPackages,
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate next steps based on validation status and recommendations
   */
  private generateNextSteps(
    status: 'success' | 'warning' | 'failure',
    recommendations: OptimizationRecommendation[]
  ): string[] {
    const nextSteps: string[] = [];

    if (status === 'failure') {
      nextSteps.push('Address critical issues before proceeding to Phase B');
      const criticalRecs = recommendations.filter((r) => r.priority === 'critical');
      if (criticalRecs.length > 0) {
        nextSteps.push(`Focus on ${criticalRecs.length} critical recommendations`);
      }
    } else if (status === 'warning') {
      nextSteps.push('Review and address warnings for optimal performance');
      nextSteps.push('Consider implementing high-priority optimizations');
    } else {
      nextSteps.push('Phase A validation completed successfully');
      nextSteps.push('Ready to proceed to Phase B: Feature Development');
    }

    if (recommendations.length > 0) {
      nextSteps.push(`Review ${recommendations.length} optimization recommendations`);
    }

    return nextSteps;
  }

  /**
   * Handle errors that occur during validation phases
   */
  private handlePhaseError(phase: string, error: unknown): void {
    const validationError = this.createValidationError(
      ValidationErrorType.BUILD_ERROR,
      'critical',
      `Error in ${phase}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      {
        phase,
        stackTrace: error instanceof Error ? error.stack : undefined,
      }
    );

    this.errors.push(validationError);
    this.emit('phase:failed', phase, validationError);
  }

  /**
   * Create a standardized validation error
   */
  private createValidationError(
    type: ValidationErrorType,
    severity: 'critical' | 'warning' | 'info',
    message: string,
    context: Record<string, any> = {},
    suggestions: string[] = [],
    affectedPackages: string[] = []
  ): ValidationError {
    return {
      type,
      severity,
      message,
      context,
      suggestions,
      affectedPackages,
    };
  }

  /**
   * Map error types to recommendation categories
   */
  private mapErrorTypeToCategory(
    errorType: ValidationErrorType
  ): OptimizationRecommendation['category'] {
    switch (errorType) {
      case ValidationErrorType.BUILD_ERROR:
        return 'build';
      case ValidationErrorType.PERFORMANCE_REGRESSION:
        return 'performance';
      case ValidationErrorType.ARCHITECTURE_VIOLATION:
        return 'architecture';
      case ValidationErrorType.TYPE_ERROR:
        return 'developer-experience';
      default:
        return 'build';
    }
  }

  /**
   * Setup error handling for the validation controller
   */
  private setupErrorHandling(): void {
    this.on('error', (_error) => {});

    // Handle uncaught exceptions during validation
    process.on('uncaughtException', (error) => {
      if (this.isRunning) {
        this.handlePhaseError('uncaught-exception', error);
      }
    });

    process.on('unhandledRejection', (reason) => {
      if (this.isRunning) {
        this.handlePhaseError('unhandled-rejection', reason);
      }
    });
  }

  /**
   * Execute a validation component with error recovery
   */
  private async executeWithRecovery<T>(
    operation: () => Promise<T>,
    componentName: string
  ): Promise<T | null> {
    try {
      const result = await operation();
      this.emit('component:completed', componentName);
      return result;
    } catch (error) {
      const validationError = this.createValidationError(
        ValidationErrorType.BUILD_ERROR,
        'warning',
        `Component ${componentName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          component: componentName,
          stackTrace: error instanceof Error ? error.stack : undefined,
        },
        [`Review ${componentName} configuration`, `Check component dependencies`],
        []
      );

      this.errors.push(validationError);
      this.emit('component:failed', componentName, validationError);
      return null;
    }
  }

  /**
   * Validate dependencies by combining multiple analysis methods
   */
  private async validateDependencies() {
    await this.dependencyAnalyzer.initialize();

    const [circularDepReport, packageBoundaries, depGraph] = await Promise.all([
      this.dependencyAnalyzer.checkCircularDependencies(),
      this.dependencyAnalyzer.validatePackageBoundaries(),
      this.dependencyAnalyzer.generateDependencyGraph(),
    ]);

    // Calculate health score based on violations
    const healthScore = Math.max(
      0,
      100 -
        circularDepReport.circularDependencies.length * 10 -
        packageBoundaries.violations.filter((v) => v.severity === 'error').length * 5
    );

    return {
      circularDependencies: circularDepReport.circularDependencies,
      packageBoundaryViolations: packageBoundaries.violations,
      dependencyGraph: depGraph,
      healthScore,
    };
  }

  /**
   * Collect developer experience metrics from multiple components
   */
  private async collectDevExperienceMetrics() {
    // Collect metrics internally via DevExperienceMetrics
    return this.devExperienceMetrics.generateReport();
  }

  /**
   * Get current validation status
   */
  getValidationStatus(): {
    isRunning: boolean;
    startTime: Date | null;
    errors: ValidationError[];
    currentPhase?: string;
  } {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      errors: [...this.errors],
      currentPhase: this.currentPhase || undefined,
    };
  }

  /**
   * Get validation summary
   */
  getValidationSummary(): ValidationSummary | null {
    if (!this.validationResults.systemValidation) {
      return null;
    }

    const criticalIssues = this.errors.filter((e) => e.severity === 'critical').length;

    return {
      overallStatus: this.determineOverallStatus(),
      completedValidations: Object.keys(this.validationResults).length,
      totalValidations: 3, // system, performance, architecture
      criticalIssues,
      performanceImprovements: {
        buildTime:
          this.validationResults.performanceAnalysis?.buildMetrics.improvementPercentage || 0,
        bundleSize:
          this.validationResults.performanceAnalysis?.bundleMetrics.reductionPercentage || 0,
      },
      nextSteps: this.generateNextSteps(this.determineOverallStatus(), []),
    };
  }

  // Default value methods for graceful degradation
  private getDefaultTestResults() {
    return {
      overallStatus: 'failure' as const,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      coverage: {
        overall: 0,
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
        packageCoverage: {},
      },
      packageResults: [],
      duration: 0,
    };
  }

  private getDefaultApiResults() {
    return {
      totalEndpoints: 0,
      validatedEndpoints: 0,
      failedEndpoints: [],
      responseTimeMetrics: {
        average: 0,
        median: 0,
        p95: 0,
        p99: 0,
        slowestEndpoints: [],
      },
      status: 'failure' as const,
    };
  }

  private getDefaultE2EResults() {
    return {
      totalWorkflows: 0,
      passedWorkflows: 0,
      failedWorkflows: [],
      crossPackageIntegration: {
        testedIntegrations: 0,
        passedIntegrations: 0,
        failedIntegrations: [],
      },
      status: 'failure' as const,
    };
  }

  private getDefaultBuildResults() {
    return {
      overallStatus: 'failure' as const,
      packageBuilds: [],
      totalBuildTime: 0,
      parallelEfficiency: 0,
      cacheHitRate: 0,
    };
  }

  private getDefaultBuildMetrics() {
    return {
      totalBuildTime: 0,
      packageBuildTimes: {},
      parallelEfficiency: 0,
      cacheHitRate: 0,
      improvementPercentage: 0,
      bottlenecks: [],
    };
  }

  private getDefaultBundleMetrics() {
    return {
      totalSize: 0,
      packageSizes: {},
      reductionPercentage: 0,
      largestBundles: [],
    };
  }

  private getDefaultMemoryProfile() {
    return {
      development: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0,
        peak: 0,
      },
      build: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0,
        peak: 0,
      },
      runtime: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0,
        peak: 0,
      },
      leaks: [],
      optimizations: [],
    };
  }

  private getDefaultDevExperienceMetrics() {
    return {
      typeScriptPerformance: {
        compilationTime: 0,
        autocompleteSpeed: 0,
        typeResolutionAccuracy: 0,
        errorCount: 0,
      },
      idePerformance: {
        navigationSpeed: 0,
        intelliSenseResponseTime: 0,
        sourceMapAccuracy: 0,
        memoryUsage: 0,
      },
      importPathMetrics: {
        averagePathLength: 0,
        circularDependencies: 0,
        inconsistentPaths: 0,
        optimizationOpportunities: [],
      },
      debuggingMetrics: {
        sourceMapAccuracy: 0,
        stackTraceClarity: 0,
        breakpointReliability: 0,
      },
    };
  }

  private getDefaultDependencyAnalysis() {
    return {
      circularDependencies: [],
      packageBoundaryViolations: [],
      dependencyGraph: {
        nodes: [],
        edges: [],
        metrics: {
          totalNodes: 0,
          totalEdges: 0,
          maxDepth: 0,
          complexity: 0,
        },
      },
      healthScore: 0,
    };
  }

  private getDefaultCodeOrganization() {
    return {
      separationOfConcerns: {
        score: 0,
        violations: [],
        suggestions: [],
      },
      codeDuplication: {
        duplicatedLines: 0,
        duplicatedBlocks: 0,
        duplicatedFiles: [],
        overallPercentage: 0,
      },
      namingConsistency: {
        consistencyScore: 0,
        violations: [],
        suggestions: [],
      },
      overallScore: 0,
    };
  }

  private getDefaultTypeSafety() {
    return {
      crossPackageTypeConsistency: 0,
      interfaceCompatibility: {
        compatibleInterfaces: 0,
        incompatibleInterfaces: [],
        suggestions: [],
      },
      exportStructureValidation: {
        consistentExports: 0,
        inconsistentExports: [],
        suggestions: [],
      },
      overallScore: 0,
    };
  }
}
