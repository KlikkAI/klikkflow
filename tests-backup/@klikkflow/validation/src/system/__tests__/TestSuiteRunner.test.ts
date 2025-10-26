import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestSuiteRunner } from '../TestSuiteRunner.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

describe('TestSuiteRunner', () => {
  let testSuiteRunner: TestSuiteRunner;
  const mockWorkspaceRoot = '/test/workspace';

  beforeEach(() => {
    testSuiteRunner = new TestSuiteRunner(mockWorkspaceRoot);
    vi.clearAllMocks();
  });

  describe('runAllTests', () => {
    it('should run all tests and return results', async () => {
      // Mock spawn to simulate successful test run
      const mockSpawn = await import('node:child_process');
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(
                '{"numTotalTests": 10, "numPassedTests": 8, "numFailedTests": 2, "numPendingTests": 0}'
              );
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      vi.mocked(mockSpawn.spawn).mockReturnValue(mockChild as any);

      // Mock readFile for coverage
      const mockReadFile = await import('node:fs/promises');
      vi.mocked(mockReadFile.readFile).mockResolvedValue(
        JSON.stringify({
          total: {
            lines: { pct: 75 },
            statements: { pct: 80 },
            branches: { pct: 70 },
            functions: { pct: 85 },
          },
        })
      );

      const result = await testSuiteRunner.runAllTests();

      expect(result).toMatchObject({
        overallStatus: 'failure', // Because there are failed tests
        totalTests: 10,
        passedTests: 8,
        failedTests: 2,
        skippedTests: 0,
      });

      expect(result.coverage).toBeDefined();
      expect(result.packageResults).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle test execution errors', async () => {
      const mockSpawn = await import('node:child_process');
      const mockChild = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(2); // Non-zero exit code
          }
        }),
      };

      vi.mocked(mockSpawn.spawn).mockReturnValue(mockChild as any);

      await expect(testSuiteRunner.runAllTests()).rejects.toThrow('Vitest command failed');
    });
  });

  describe('runPackageTests', () => {
    it('should run tests for a specific package', async () => {
      const mockSpawn = await import('node:child_process');
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(
                '{"numTotalTests": 5, "numPassedTests": 5, "numFailedTests": 0, "numPendingTests": 0}'
              );
            }
          }),
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      vi.mocked(mockSpawn.spawn).mockReturnValue(mockChild as any);

      // Mock coverage file
      const mockReadFile = await import('node:fs/promises');
      vi.mocked(mockReadFile.readFile).mockResolvedValue(
        JSON.stringify({
          total: { lines: { pct: 90 } },
        })
      );

      const result = await testSuiteRunner.runPackageTests('frontend');

      expect(result.overallStatus).toBe('success');
      expect(result.totalTests).toBe(5);
      expect(result.passedTests).toBe(5);
      expect(result.failedTests).toBe(0);
      expect(result.packageResults).toHaveLength(1);
      expect(result.packageResults[0].packageName).toBe('frontend');
    });

    it('should throw error for unknown package', async () => {
      await expect(testSuiteRunner.runPackageTests('unknown-package')).rejects.toThrow(
        'Unknown package'
      );
    });
  });

  describe('generateCoverageReport', () => {
    it('should generate coverage report from coverage file', async () => {
      const mockReadFile = await import('node:fs/promises');
      const mockCoverageData = {
        total: {
          lines: { pct: 75 },
          statements: { pct: 80 },
          branches: { pct: 70 },
          functions: { pct: 85 },
        },
        'packages/frontend/src/app.ts': {
          lines: { covered: 10, total: 15 },
        },
        'packages/backend/src/server.ts': {
          lines: { covered: 20, total: 25 },
        },
      };

      vi.mocked(mockReadFile.readFile).mockResolvedValue(JSON.stringify(mockCoverageData));

      const coverage = await testSuiteRunner.generateCoverageReport();

      expect(coverage.overall).toBe(75);
      expect(coverage.statements).toBe(80);
      expect(coverage.branches).toBe(70);
      expect(coverage.functions).toBe(85);
      expect(coverage.lines).toBe(75);
      expect(coverage.packageCoverage).toBeDefined();
    });

    it('should return default coverage when file is not available', async () => {
      const mockReadFile = await import('node:fs/promises');
      vi.mocked(mockReadFile.readFile).mockRejectedValue(new Error('File not found'));

      const coverage = await testSuiteRunner.generateCoverageReport();

      expect(coverage.overall).toBe(0);
      expect(coverage.statements).toBe(0);
      expect(coverage.branches).toBe(0);
      expect(coverage.functions).toBe(0);
      expect(coverage.lines).toBe(0);
      expect(coverage.packageCoverage).toBeDefined();
    });
  });

  describe('getTestHistory', () => {
    it('should return empty history initially', () => {
      const history = testSuiteRunner.getTestHistory();
      expect(history).toEqual([]);
    });

    it('should store test results in history', async () => {
      // Mock successful test run
      const mockSpawn = await import('node:child_process');
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(
                '{"numTotalTests": 1, "numPassedTests": 1, "numFailedTests": 0, "numPendingTests": 0}'
              );
            }
          }),
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      vi.mocked(mockSpawn.spawn).mockReturnValue(mockChild as any);

      const mockReadFile = await import('node:fs/promises');
      vi.mocked(mockReadFile.readFile).mockResolvedValue(
        JSON.stringify({
          total: { lines: { pct: 100 } },
        })
      );

      await testSuiteRunner.runAllTests();

      const history = testSuiteRunner.getTestHistory();
      expect(history).toHaveLength(1);
      expect(history[0].overallStatus).toBe('success');
    });
  });
});
