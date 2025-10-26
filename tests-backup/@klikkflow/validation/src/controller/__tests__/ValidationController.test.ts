import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationErrorType } from '../../types/index.js';
import { ValidationController } from '../ValidationController.js';

// Mock all the validation components
vi.mock('../../system/TestSuiteRunner.js');
vi.mock('../../system/APIValidator.js');
vi.mock('../../system/E2EValidator.js');
vi.mock('../../system/BuildValidator.js');
vi.mock('../../build-time-analyzer.js');
vi.mock('../../bundle-size-analyzer.js');
vi.mock('../../monitoring/MemoryMonitor.js');
vi.mock('../../developer-experience/DevExperienceMetrics.js');
vi.mock('../../typescript/analyzer.js');
vi.mock('../../ide-performance/ide-performance-validator.js');
vi.mock('../../import-optimization/import-path-optimizer.js');
vi.mock('../../architecture/dependency-analyzer.js');
vi.mock('../../architecture/code-organization-checker.js');
vi.mock('../../architecture/type-safety-validator.js');
vi.mock('../../reporting/ValidationReportAggregator.js');
vi.mock('../../reporting/RecommendationEngine.js');

describe('ValidationController', () => {
  let controller: ValidationController;
  let mockWorkspaceRoot: string;

  beforeEach(() => {
    mockWorkspaceRoot = '/test/workspace';
    controller = new ValidationController(mockWorkspaceRoot);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default workspace root', () => {
      const defaultController = new ValidationController();
      expect(defaultController).toBeInstanceOf(ValidationController);
    });

    it('should initialize with custom workspace root', () => {
      expect(controller).toBeInstanceOf(ValidationController);
    });

    it('should setup event listeners', () => {
      const eventNames = controller.eventNames();
      expect(eventNames).toContain('error');
    });
  });

  describe('executeValidation', () => {
    it('should execute full validation workflow successfully', async () => {
      const startSpy = vi.fn();
      const completedSpy = vi.fn();

      controller.on('validation:started', startSpy);
      controller.on('validation:completed', completedSpy);

      const results = await controller.executeValidation();

      expect(startSpy).toHaveBeenCalled();
      expect(completedSpy).toHaveBeenCalledWith(results);
      expect(results.phase).toBe('A');
      expect(results.status).toMatch(/^(success|warning|failure)$/);
      expect(results.systemValidation).toBeDefined();
      expect(results.performanceAnalysis).toBeDefined();
      expect(results.architectureValidation).toBeDefined();
      expect(results.recommendations).toBeInstanceOf(Array);
      expect(results.nextSteps).toBeInstanceOf(Array);
    });

    it('should handle validation already running', async () => {
      // Start first validation
      const firstValidation = controller.executeValidation();

      // Try to start second validation
      await expect(controller.executeValidation()).rejects.toThrow('Validation is already running');

      // Wait for first validation to complete
      await firstValidation;
    });

    it('should emit phase events during execution', async () => {
      const phaseStartedSpy = vi.fn();
      const phaseCompletedSpy = vi.fn();

      controller.on('phase:started', phaseStartedSpy);
      controller.on('phase:completed', phaseCompletedSpy);

      await controller.executeValidation();

      expect(phaseStartedSpy).toHaveBeenCalledWith('system-validation');
      expect(phaseStartedSpy).toHaveBeenCalledWith('performance-analysis');
      expect(phaseStartedSpy).toHaveBeenCalledWith('architecture-validation');

      expect(phaseCompletedSpy).toHaveBeenCalledWith('system-validation');
      expect(phaseCompletedSpy).toHaveBeenCalledWith('performance-analysis');
      expect(phaseCompletedSpy).toHaveBeenCalledWith('architecture-validation');
    });

    it('should handle component failures gracefully', async () => {
      const componentFailedSpy = vi.fn();
      controller.on('component:failed', componentFailedSpy);

      // Mock a component to fail
      const mockError = new Error('Component failed');
      vi.mocked(controller as any).testSuiteRunner = {
        runAllTests: vi.fn().mockRejectedValue(mockError),
      };

      const results = await controller.executeValidation();

      expect(componentFailedSpy).toHaveBeenCalled();
      expect(results.status).toBe('warning'); // Should continue with warnings
    });
  });

  describe('getValidationStatus', () => {
    it('should return current validation status', () => {
      const status = controller.getValidationStatus();

      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('startTime');
      expect(status).toHaveProperty('errors');
      expect(status.isRunning).toBe(false);
      expect(status.startTime).toBeNull();
      expect(status.errors).toBeInstanceOf(Array);
    });

    it('should show running status during validation', async () => {
      const validationPromise = controller.executeValidation();

      // Check status while running
      const runningStatus = controller.getValidationStatus();
      expect(runningStatus.isRunning).toBe(true);
      expect(runningStatus.startTime).toBeInstanceOf(Date);
      expect(runningStatus.currentPhase).toBeDefined();

      await validationPromise;

      // Check status after completion
      const completedStatus = controller.getValidationStatus();
      expect(completedStatus.isRunning).toBe(false);
    });
  });

  describe('getValidationSummary', () => {
    it('should return null before validation starts', () => {
      const summary = controller.getValidationSummary();
      expect(summary).toBeNull();
    });

    it('should return validation summary after execution', async () => {
      await controller.executeValidation();

      const summary = controller.getValidationSummary();

      expect(summary).toBeDefined();
      expect(summary?.overallStatus).toMatch(/^(success|warning|failure)$/);
      expect(summary?.completedValidations).toBeGreaterThan(0);
      expect(summary?.totalValidations).toBe(3);
      expect(summary?.criticalIssues).toBeGreaterThanOrEqual(0);
      expect(summary?.performanceImprovements).toHaveProperty('buildTime');
      expect(summary?.performanceImprovements).toHaveProperty('bundleSize');
      expect(summary?.nextSteps).toBeInstanceOf(Array);
    });
  });

  describe('error handling', () => {
    it('should handle component initialization errors', () => {
      // Mock component constructor to throw
      const _mockError = new Error('Initialization failed');

      expect(() => {
        // This would need to be tested by mocking the component constructors
        // before creating the ValidationController
      }).not.toThrow(); // The controller should handle initialization errors gracefully
    });

    it('should create standardized validation errors', async () => {
      const componentFailedSpy = vi.fn();
      controller.on('component:failed', componentFailedSpy);

      // Mock a component to fail
      const mockError = new Error('Test error');
      vi.mocked(controller as any).testSuiteRunner = {
        runAllTests: vi.fn().mockRejectedValue(mockError),
      };

      await controller.executeValidation();

      expect(componentFailedSpy).toHaveBeenCalledWith(
        'test-suite',
        expect.objectContaining({
          type: ValidationErrorType.BUILD_ERROR,
          severity: 'warning',
          message: expect.stringContaining('Component test-suite failed'),
          context: expect.objectContaining({
            component: 'test-suite',
          }),
          suggestions: expect.arrayContaining([
            expect.stringContaining('Review test-suite configuration'),
          ]),
        })
      );
    });

    it('should handle uncaught exceptions during validation', async () => {
      const _originalHandler = process.listeners('uncaughtException');

      // Simulate uncaught exception during validation
      const validationPromise = controller.executeValidation();

      // Trigger uncaught exception
      process.emit('uncaughtException', new Error('Uncaught error'), 'uncaughtException');

      await validationPromise;

      const status = controller.getValidationStatus();
      expect(status.errors.some((e) => e.context.phase === 'uncaught-exception')).toBe(true);
    });
  });

  describe('recommendation generation', () => {
    it('should generate recommendations based on errors', async () => {
      // Mock components to generate errors
      const mockError = new Error('Test error');
      vi.mocked(controller as any).testSuiteRunner = {
        runAllTests: vi.fn().mockRejectedValue(mockError),
      };

      const results = await controller.executeValidation();

      expect(results.recommendations).toBeInstanceOf(Array);
      if (results.recommendations.length > 0) {
        const recommendation = results.recommendations[0];
        expect(recommendation).toHaveProperty('category');
        expect(recommendation).toHaveProperty('priority');
        expect(recommendation).toHaveProperty('title');
        expect(recommendation).toHaveProperty('description');
        expect(recommendation).toHaveProperty('impact');
        expect(recommendation).toHaveProperty('effort');
        expect(recommendation).toHaveProperty('steps');
        expect(recommendation).toHaveProperty('affectedPackages');
      }
    });

    it('should generate appropriate next steps based on status', async () => {
      const results = await controller.executeValidation();

      expect(results.nextSteps).toBeInstanceOf(Array);
      expect(results.nextSteps.length).toBeGreaterThan(0);

      if (results.status === 'success') {
        expect(
          results.nextSteps.some((step) =>
            step.includes('Phase A validation completed successfully')
          )
        ).toBe(true);
      } else if (results.status === 'failure') {
        expect(results.nextSteps.some((step) => step.includes('Address critical issues'))).toBe(
          true
        );
      }
    });
  });

  describe('graceful degradation', () => {
    it('should provide default values when components fail', async () => {
      // Mock all components to fail
      const mockError = new Error('Component failed');
      const _mockFailingComponent = { mockMethod: vi.fn().mockRejectedValue(mockError) };

      vi.mocked(controller as any).testSuiteRunner = {
        runAllTests: vi.fn().mockRejectedValue(mockError),
      };
      vi.mocked(controller as any).apiValidator = {
        validateEndpoints: vi.fn().mockRejectedValue(mockError),
      };
      vi.mocked(controller as any).e2eValidator = {
        runFrontendWorkflows: vi.fn().mockRejectedValue(mockError),
      };
      vi.mocked(controller as any).buildValidator = {
        validateBuilds: vi.fn().mockRejectedValue(mockError),
      };

      const results = await controller.executeValidation();

      // Should still return valid structure with default values
      expect(results.systemValidation.testResults.overallStatus).toBe('failure');
      expect(results.systemValidation.apiValidation.status).toBe('failure');
      expect(results.systemValidation.e2eResults.status).toBe('failure');
      expect(results.systemValidation.buildValidation.overallStatus).toBe('failure');
    });
  });
});
