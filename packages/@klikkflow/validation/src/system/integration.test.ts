import { describe, expect, it } from 'vitest';
import { TestOrchestrator, TestResultAnalyzer, TestSuiteRunner } from './index.js';

describe('System Validation Integration', () => {
  describe('TestSuiteRunner Integration', () => {
    it('should create TestSuiteRunner instance', () => {
      const runner = new TestSuiteRunner();
      expect(runner).toBeInstanceOf(TestSuiteRunner);
      expect(runner.getTestHistory()).toEqual([]);
    });

    it('should handle generateCoverageReport gracefully', async () => {
      const runner = new TestSuiteRunner('/non-existent-path');
      const coverage = await runner.generateCoverageReport();

      expect(coverage).toEqual({
        overall: 0,
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
        packageCoverage: expect.any(Object),
      });
    });
  });

  describe('TestResultAnalyzer Integration', () => {
    it('should create TestResultAnalyzer instance', () => {
      const analyzer = new TestResultAnalyzer();
      expect(analyzer).toBeInstanceOf(TestResultAnalyzer);
    });

    it('should analyze test results correctly', () => {
      const analyzer = new TestResultAnalyzer();
      const mockResults = {
        overallStatus: 'success' as const,
        totalTests: 10,
        passedTests: 8,
        failedTests: 2,
        skippedTests: 0,
        coverage: {
          overall: 75,
          statements: 80,
          branches: 70,
          functions: 85,
          lines: 75,
          packageCoverage: { 'test-package': 75 },
        },
        packageResults: [
          {
            packageName: 'test-package',
            status: 'success' as const,
            testCount: 10,
            passedCount: 8,
            failedCount: 2,
            coverage: 75,
            duration: 5000,
          },
        ],
        duration: 10000,
      };

      const analysis = analyzer.analyzeTestResults(mockResults);

      expect(analysis.successRate).toBe(80);
      expect(analysis.coverageScore).toBe(77);
      expect(analysis.recommendations).toBeInstanceOf(Array);
      expect(analysis.riskAssessment).toHaveProperty('level');
    });
  });

  describe('TestOrchestrator Integration', () => {
    it('should create TestOrchestrator instance', () => {
      const orchestrator = new TestOrchestrator();
      expect(orchestrator).toBeInstanceOf(TestOrchestrator);
      expect(orchestrator.getTestHistory()).toEqual([]);
    });
  });

  describe('Cross-component Integration', () => {
    it('should work together for comprehensive test analysis', () => {
      const runner = new TestSuiteRunner();
      const analyzer = new TestResultAnalyzer();
      const orchestrator = new TestOrchestrator();

      // Verify all components can be instantiated together
      expect(runner).toBeInstanceOf(TestSuiteRunner);
      expect(analyzer).toBeInstanceOf(TestResultAnalyzer);
      expect(orchestrator).toBeInstanceOf(TestOrchestrator);
    });
  });
});
