import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ITestSuiteRunner } from '../interfaces/index.js';
import type { CoverageReport, PackageTestResult, TestResults } from '../types/index.js';

/**
 * Comprehensive test suite runner using existing Vitest configuration
 * Requirements: 1.1, 1.2
 */
export class TestSuiteRunner implements ITestSuiteRunner {
  private testHistory: TestResults[] = [];
  private readonly workspaceRoot: string;
  private readonly packages: string[] = [
    'frontend',
    'backend',
    'shared',
    '@klikkflow/ai',
    '@klikkflow/api',
    '@klikkflow/auth',
    '@klikkflow/database',
    '@klikkflow/workflow-engine',
    '@klikkflow/core',
    '@klikkflow/design-system',
    '@klikkflow/validation',
  ];

  constructor(workspaceRoot = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Run all tests across all packages with coverage aggregation
   * Requirements: 1.1
   */
  async runAllTests(): Promise<TestResults> {
    const startTime = Date.now();

    try {
      // Run tests using Vitest workspace configuration
      const testResult = await this.executeVitestCommand(['run', '--coverage', '--reporter=json']);

      // Parse test results
      const results = await this.parseTestResults(testResult);

      // Generate coverage report
      const coverage = await this.generateCoverageReport();

      // Run package-specific tests to get detailed breakdown
      const packageResults = await this.runPackageTestsInParallel();

      const finalResults: TestResults = {
        overallStatus: results.failed === 0 ? 'success' : 'failure',
        totalTests: results.total,
        passedTests: results.passed,
        failedTests: results.failed,
        skippedTests: results.skipped,
        coverage,
        packageResults,
        duration: Date.now() - startTime,
      };

      // Store in history
      this.testHistory.push(finalResults);

      return finalResults;
    } catch (error) {
      throw new Error(
        `Failed to run all tests: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Run tests for a specific package
   * Requirements: 1.1
   */
  async runPackageTests(packageName: string): Promise<TestResults> {
    if (!this.packages.includes(packageName)) {
      throw new Error(`Unknown package: ${packageName}`);
    }

    const startTime = Date.now();

    try {
      // Run tests for specific package using workspace filter
      // CodeQL fix: Remove redundant string replacement (Alert #120)
      const testResult = await this.executeVitestCommand([
        'run',
        '--coverage',
        '--reporter=json',
        '--workspace',
        `packages/${packageName}`,
      ]);

      const results = await this.parseTestResults(testResult);
      const coverage = await this.generatePackageCoverageReport(packageName);

      const packageResult: PackageTestResult = {
        packageName,
        status: results.failed === 0 ? 'success' : 'failure',
        testCount: results.total,
        passedCount: results.passed,
        failedCount: results.failed,
        coverage: coverage.overall,
        duration: Date.now() - startTime,
        errors: results.failed > 0 ? ['Test failures detected'] : undefined,
      };

      return {
        overallStatus: packageResult.status,
        totalTests: packageResult.testCount,
        passedTests: packageResult.passedCount,
        failedTests: packageResult.failedCount,
        skippedTests: 0,
        coverage,
        packageResults: [packageResult],
        duration: packageResult.duration,
      };
    } catch (error) {
      throw new Error(
        `Failed to run tests for ${packageName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate comprehensive coverage report
   * Requirements: 1.1
   */
  async generateCoverageReport(): Promise<CoverageReport> {
    try {
      // Read coverage summary from Vitest output
      const coveragePath = join(this.workspaceRoot, 'coverage', 'coverage-summary.json');
      const coverageData = await this.readCoverageFile(coveragePath);

      if (!coverageData) {
        return this.getDefaultCoverageReport();
      }

      // Extract overall coverage metrics
      const total = coverageData.total || {};
      const packageCoverage: Record<string, number> = {};

      // Calculate package-specific coverage
      // CodeQL fix: Remove redundant string replacement (Alert #121)
      for (const packageName of this.packages) {
        const packagePath = `packages/${packageName}/`;
        const packageFiles = Object.keys(coverageData).filter((file) => file.includes(packagePath));

        if (packageFiles.length > 0) {
          const packageStats = packageFiles.reduce(
            (acc, file) => {
              const fileData = coverageData[file];
              if (fileData?.lines) {
                acc.covered += fileData.lines.covered || 0;
                acc.total += fileData.lines.total || 0;
              }
              return acc;
            },
            { covered: 0, total: 0 }
          );

          packageCoverage[packageName] =
            packageStats.total > 0
              ? Math.round((packageStats.covered / packageStats.total) * 100)
              : 0;
        } else {
          packageCoverage[packageName] = 0;
        }
      }

      return {
        overall: Math.round(total.lines?.pct || 0),
        statements: Math.round(total.statements?.pct || 0),
        branches: Math.round(total.branches?.pct || 0),
        functions: Math.round(total.functions?.pct || 0),
        lines: Math.round(total.lines?.pct || 0),
        packageCoverage,
      };
    } catch (_error) {
      return this.getDefaultCoverageReport();
    }
  }

  /**
   * Get test execution history
   */
  getTestHistory(): TestResults[] {
    return [...this.testHistory];
  }

  /**
   * Execute Vitest command and return results
   */
  private async executeVitestCommand(args: string[]): Promise<VitestOutput> {
    return new Promise((resolve, reject) => {
      const child = spawn('pnpm', ['vitest', ...args], {
        cwd: this.workspaceRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0 || code === 1) {
          try {
            const lines = stdout.split('\n');
            const jsonLine = lines.find(
              (line) => line.trim().startsWith('{') && line.includes('"testResults"')
            );

            if (jsonLine) {
              resolve(JSON.parse(jsonLine));
            } else {
              resolve({
                testResults: [],
                numTotalTests: 0,
                numPassedTests: 0,
                numFailedTests: 0,
                numPendingTests: 0,
              });
            }
          } catch (_parseError) {
            resolve({
              testResults: [],
              numTotalTests: 0,
              numPassedTests: 0,
              numFailedTests: code === 1 ? 1 : 0,
              numPendingTests: 0,
            });
          }
        } else {
          reject(new Error(`Vitest command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse test results from Vitest output
   */
  private async parseTestResults(vitestOutput: VitestOutput): Promise<{
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  }> {
    if (vitestOutput.numTotalTests !== undefined) {
      return {
        total: vitestOutput.numTotalTests || 0,
        passed: vitestOutput.numPassedTests || 0,
        failed: vitestOutput.numFailedTests || 0,
        skipped: vitestOutput.numPendingTests || 0,
      };
    }

    const testResults = vitestOutput.testResults || [];
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const result of testResults) {
      if (result.assertionResults) {
        for (const assertion of result.assertionResults) {
          total++;
          switch (assertion.status) {
            case 'passed':
              passed++;
              break;
            case 'failed':
              failed++;
              break;
            case 'pending':
            case 'skipped':
              skipped++;
              break;
          }
        }
      }
    }

    return { total, passed, failed, skipped };
  }

  /**
   * Run tests for all packages in parallel
   */
  private async runPackageTestsInParallel(): Promise<PackageTestResult[]> {
    const packagePromises = this.packages.map(async (packageName) => {
      try {
        const result = await this.runPackageTests(packageName);
        return result.packageResults[0];
      } catch (error) {
        return {
          packageName,
          status: 'failure' as const,
          testCount: 0,
          passedCount: 0,
          failedCount: 1,
          coverage: 0,
          duration: 0,
          errors: [
            `Failed to run tests: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ],
        };
      }
    });

    return Promise.all(packagePromises);
  }

  /**
   * Generate coverage report for a specific package
   */
  private async generatePackageCoverageReport(packageName: string): Promise<CoverageReport> {
    try {
      // CodeQL fix: Remove redundant string replacement (Alert #122)
      const coveragePath = join(this.workspaceRoot, 'coverage', 'coverage-summary.json');
      const coverageData = await this.readCoverageFile(coveragePath);

      if (!coverageData) {
        return this.getDefaultCoverageReport();
      }

      const packageFiles = Object.keys(coverageData).filter((file) =>
        file.includes(`packages/${packageName}/`)
      );

      if (packageFiles.length === 0) {
        return this.getDefaultCoverageReport();
      }

      const packageStats = packageFiles.reduce(
        (acc, file) => {
          const fileData = coverageData[file];
          if (fileData) {
            acc.statements.covered += fileData.statements?.covered || 0;
            acc.statements.total += fileData.statements?.total || 0;
            acc.branches.covered += fileData.branches?.covered || 0;
            acc.branches.total += fileData.branches?.total || 0;
            acc.functions.covered += fileData.functions?.covered || 0;
            acc.functions.total += fileData.functions?.total || 0;
            acc.lines.covered += fileData.lines?.covered || 0;
            acc.lines.total += fileData.lines?.total || 0;
          }
          return acc;
        },
        {
          statements: { covered: 0, total: 0 },
          branches: { covered: 0, total: 0 },
          functions: { covered: 0, total: 0 },
          lines: { covered: 0, total: 0 },
        }
      );

      const calculatePercentage = (covered: number, total: number) =>
        total > 0 ? Math.round((covered / total) * 100) : 0;

      const overall = calculatePercentage(packageStats.lines.covered, packageStats.lines.total);

      return {
        overall,
        statements: calculatePercentage(
          packageStats.statements.covered,
          packageStats.statements.total
        ),
        branches: calculatePercentage(packageStats.branches.covered, packageStats.branches.total),
        functions: calculatePercentage(
          packageStats.functions.covered,
          packageStats.functions.total
        ),
        lines: calculatePercentage(packageStats.lines.covered, packageStats.lines.total),
        packageCoverage: { [packageName]: overall },
      };
    } catch (_error) {
      return this.getDefaultCoverageReport();
    }
  }

  /**
   * Read coverage file and parse JSON
   */
  private async readCoverageFile(filePath: string): Promise<CoverageData | null> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (_error) {
      return null;
    }
  }

  /**
   * Get default coverage report when no coverage data is available
   */
  private getDefaultCoverageReport(): CoverageReport {
    const packageCoverage: Record<string, number> = {};
    for (const packageName of this.packages) {
      packageCoverage[packageName] = 0;
    }

    return {
      overall: 0,
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
      packageCoverage,
    };
  }
}

// Type definitions for Vitest output
interface VitestOutput {
  testResults?: TestResult[];
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
}

interface TestResult {
  assertionResults?: AssertionResult[];
}

interface AssertionResult {
  status: 'passed' | 'failed' | 'pending' | 'skipped';
}

interface CoverageData {
  total?: CoverageMetrics;
  [filePath: string]: CoverageMetrics | undefined;
}

interface CoverageMetrics {
  lines?: { pct: number; covered: number; total: number };
  statements?: { pct: number; covered: number; total: number };
  branches?: { pct: number; covered: number; total: number };
  functions?: { pct: number; covered: number; total: number };
}
