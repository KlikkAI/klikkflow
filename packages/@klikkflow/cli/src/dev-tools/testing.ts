export interface TestCase {
  id: string;
  name: string;
  description?: string;
  input: unknown;
  expectedOutput?: unknown;
  expectedError?: string;
  timeout?: number;
}

export interface TestSuite {
  id: string;
  name: string;
  testCases: TestCase[];
}

export interface TestResult {
  testCaseId: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  actualOutput?: unknown;
  error?: string;
  assertion?: string;
}

export class WorkflowTester {
  async runTestSuite(workflowId: string, suite: TestSuite): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const testCase of suite.testCases) {
      const result = await this.runTestCase(workflowId, testCase);
      results.push(result);
    }

    return results;
  }

  async runTestCase(workflowId: string, testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Mock workflow execution
      const actualOutput = await this.executeWorkflow(workflowId, testCase.input);
      const duration = Date.now() - startTime;

      if (testCase.expectedOutput) {
        const isMatch = JSON.stringify(actualOutput) === JSON.stringify(testCase.expectedOutput);

        if (!isMatch) {
          return {
            testCaseId: testCase.id,
            status: 'failed',
            duration,
            actualOutput,
            assertion: 'Output does not match expected',
          };
        }
      }

      return {
        testCaseId: testCase.id,
        status: 'passed',
        duration,
        actualOutput,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (testCase.expectedError && errorMessage.includes(testCase.expectedError)) {
        return {
          testCaseId: testCase.id,
          status: 'passed',
          duration,
          error: errorMessage,
        };
      }

      return {
        testCaseId: testCase.id,
        status: 'failed',
        duration,
        error: errorMessage,
      };
    }
  }

  private async executeWorkflow(workflowId: string, input: unknown): Promise<unknown> {
    // Mock workflow execution
    // In production, this would call the actual workflow engine

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Type-safe handling of unknown input
    const inputData = typeof input === 'object' && input !== null ? input : {};

    return {
      ...(inputData as Record<string, unknown>),
      workflowId,
      executedAt: new Date().toISOString(),
      status: 'completed',
    };
  }

  generateTestReport(results: TestResult[]): string {
    const total = results.length;
    const passed = results.filter((r) => r.status === 'passed').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    const report = [];
    report.push('='.repeat(50));
    report.push('Test Report');
    report.push('='.repeat(50));
    report.push(`Total: ${total}`);
    report.push(`Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
    report.push(`Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)`);
    report.push(`Skipped: ${skipped} (${((skipped / total) * 100).toFixed(1)}%)`);
    report.push(`Total Duration: ${totalDuration}ms`);
    report.push('');

    if (failed > 0) {
      report.push('Failed Tests:');
      report.push('-'.repeat(50));
      results
        .filter((r) => r.status === 'failed')
        .forEach((r) => {
          report.push(`  ❌ ${r.testCaseId}`);
          if (r.error) {
            report.push(`     Error: ${r.error}`);
          }
          if (r.assertion) {
            report.push(`     Assertion: ${r.assertion}`);
          }
        });
    }

    return report.join('\n');
  }
}

export class NodeTester {
  async testNode(
    nodeClass: new (config: { id: string }) => { execute: (context: unknown) => Promise<unknown> },
    testCases: TestCase[]
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const testCase of testCases) {
      const result = await this.runNodeTest(nodeClass, testCase);
      results.push(result);
    }

    return results;
  }

  private async runNodeTest(
    nodeClass: new (config: { id: string }) => { execute: (context: unknown) => Promise<unknown> },
    testCase: TestCase
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const node = new nodeClass({ id: 'test-node' });
      const context = {
        data: testCase.input,
        workflow: { id: 'test-workflow' },
        execution: { id: 'test-execution' },
      };

      const actualOutput = await node.execute(context);
      const duration = Date.now() - startTime;

      if (testCase.expectedOutput) {
        const isMatch = JSON.stringify(actualOutput) === JSON.stringify(testCase.expectedOutput);

        if (!isMatch) {
          return {
            testCaseId: testCase.id,
            status: 'failed',
            duration,
            actualOutput,
            assertion: 'Output does not match expected',
          };
        }
      }

      return {
        testCaseId: testCase.id,
        status: 'passed',
        duration,
        actualOutput,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        testCaseId: testCase.id,
        status: 'failed',
        duration,
        error: errorMessage,
      };
    }
  }
}
