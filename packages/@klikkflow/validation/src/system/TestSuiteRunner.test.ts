import { beforeEach, describe, expect, it } from 'vitest';
import { TestSuiteRunner } from './TestSuiteRunner.js';

describe('TestSuiteRunner', () => {
  let testRunner: TestSuiteRunner;
  const mockWorkspaceRoot = '/mock/workspace';

  beforeEach(() => {
    testRunner = new TestSuiteRunner(mockWorkspaceRoot);
  });

  describe('constructor', () => {
    it('should initialize with default workspace root', () => {
      const runner = new TestSuiteRunner();
      expect(runner).toBeInstanceOf(TestSuiteRunner);
    });

    it('should initialize with custom workspace root', () => {
      const runner = new TestSuiteRunner('/custom/path');
      expect(runner).toBeInstanceOf(TestSuiteRunner);
    });
  });

  describe('getTestHistory', () => {
    it('should return empty array initially', () => {
      const history = testRunner.getTestHistory();
      expect(history).toEqual([]);
    });
  });

  describe('runPackageTests', () => {
    it('should throw error for unknown package', async () => {
      await expect(testRunner.runPackageTests('unknown-package')).rejects.toThrow(
        'Unknown package: unknown-package'
      );
    });
  });

  describe('generateCoverageReport', () => {
    it('should return default coverage report when no coverage data available', async () => {
      const coverage = await testRunner.generateCoverageReport();

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
});
