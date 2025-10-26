import { expect, test } from '@playwright/test';
import {
  addNode,
  connectNodes,
  createWorkflow,
  executeWorkflow,
  login,
  saveWorkflow,
  waitForExecution,
} from '../helpers/test-utils';

test.describe('Workflow Execution', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'test@example.com', 'testpassword123');
  });

  test('should execute a simple workflow', async ({ page }) => {
    // Create workflow
    await createWorkflow(page, 'Simple Execution Test');

    // Build workflow: Trigger -> HTTP Request
    await addNode(page, 'manual-trigger');
    await addNode(page, 'http-request');

    // Configure HTTP request
    await page.click('[data-node-type="http-request"]');
    await page.click('[data-testid="configure-node"]');
    await page.fill('input[name="url"]', 'https://jsonplaceholder.typicode.com/todos/1');
    await page.selectOption('select[name="method"]', 'GET');
    await page.click('[data-testid="save-node-config"]');

    // Connect nodes
    await connectNodes(page, 'trigger-1', 'action-1');

    // Save workflow
    await saveWorkflow(page);

    // Execute workflow
    await executeWorkflow(page);

    // Wait for completion
    await waitForExecution(page);

    // Should show success status
    await expect(page.locator('[data-testid="execution-status"]')).toContainText('success');
  });

  test('should show execution progress', async ({ page }) => {
    await createWorkflow(page, 'Progress Test');

    // Create multi-step workflow
    await addNode(page, 'manual-trigger');
    await addNode(page, 'http-request');
    await addNode(page, 'http-request');

    // Configure and connect nodes
    // ... (connection logic)

    await saveWorkflow(page);

    // Execute
    await executeWorkflow(page);

    // Should show progress indicator
    await expect(page.locator('[data-testid="execution-progress"]')).toBeVisible();

    // Should update as nodes complete
    await expect(page.locator('[data-testid="completed-nodes"]')).toContainText(/\d+\/\d+/);
  });

  test('should handle execution errors gracefully', async ({ page }) => {
    await createWorkflow(page, 'Error Handling Test');

    // Create workflow with invalid HTTP request
    await addNode(page, 'manual-trigger');
    await addNode(page, 'http-request');

    // Configure with invalid URL
    await page.click('[data-node-type="http-request"]');
    await page.click('[data-testid="configure-node"]');
    await page.fill('input[name="url"]', 'invalid-url');
    await page.click('[data-testid="save-node-config"]');

    await connectNodes(page, 'trigger-1', 'action-1');
    await saveWorkflow(page);

    // Execute
    await executeWorkflow(page);
    await waitForExecution(page);

    // Should show error status
    await expect(page.locator('[data-testid="execution-status"]')).toContainText('error');

    // Should show error details
    await expect(page.locator('[data-testid="error-details"]')).toBeVisible();
  });

  test('should cancel running execution', async ({ page }) => {
    await createWorkflow(page, 'Cancel Execution Test');

    // Create workflow with delay
    await addNode(page, 'manual-trigger');
    await addNode(page, 'delay');

    // Configure delay
    await page.click('[data-node-type="delay"]');
    await page.click('[data-testid="configure-node"]');
    await page.fill('input[name="duration"]', '30'); // 30 seconds
    await page.click('[data-testid="save-node-config"]');

    await connectNodes(page, 'trigger-1', 'delay-1');
    await saveWorkflow(page);

    // Execute
    await executeWorkflow(page);

    // Wait for execution to start
    await expect(page.locator('[data-testid="execution-status"]')).toContainText('running');

    // Cancel execution
    await page.click('[data-testid="cancel-execution"]');

    // Should show cancelled status
    await expect(page.locator('[data-testid="execution-status"]')).toContainText('cancelled');
  });

  test('should show execution history', async ({ page }) => {
    await createWorkflow(page, 'Execution History Test');

    // Execute workflow multiple times
    // ... (setup and execute)

    // Navigate to executions page
    await page.goto('/executions');

    // Should show list of executions
    await expect(page.locator('[data-testid="execution-list"]')).toBeVisible();

    // Should show execution details
    const executions = page.locator('[data-testid="execution-item"]');
    await expect(executions.first()).toBeVisible();

    // Click on execution to see details
    await executions.first().click();

    // Should show execution details
    await expect(page.locator('[data-testid="execution-details"]')).toBeVisible();
  });

  test('should filter executions by status', async ({ page }) => {
    await page.goto('/executions');

    // Filter by success
    await page.click('[data-filter="success"]');

    // All visible executions should be successful
    const executions = page.locator('[data-testid="execution-item"]');
    const count = await executions.count();

    for (let i = 0; i < count; i++) {
      await expect(executions.nth(i).locator('[data-testid="execution-status"]')).toContainText(
        'success'
      );
    }
  });

  test('should show node-level execution results', async ({ page }) => {
    await createWorkflow(page, 'Node Results Test');

    // Create and execute workflow
    // ... (setup)

    await executeWorkflow(page);
    await waitForExecution(page);

    // Click on a node to see its results
    await page.click('[data-node-type="http-request"]');

    // Should show input/output data
    await expect(page.locator('[data-testid="node-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="node-output"]')).toBeVisible();

    // Should show execution time
    await expect(page.locator('[data-testid="node-duration"]')).toBeVisible();
  });

  test('should retry failed execution', async ({ page }) => {
    // Navigate to failed execution
    await page.goto('/executions');
    await page.click('[data-execution-status="error"]');

    // Click retry button
    await page.click('[data-testid="retry-execution"]');

    // Should start new execution
    await expect(page.locator('[data-testid="execution-status"]')).toContainText('running');
  });

  test('should test workflow without saving', async ({ page }) => {
    await createWorkflow(page, 'Test Mode Workflow');

    // Build workflow
    await addNode(page, 'manual-trigger');
    await addNode(page, 'http-request');

    // Configure and connect
    // ... (setup)

    // Click test button (instead of execute)
    await page.click('[data-testid="test-workflow"]');

    // Should execute in test mode
    await expect(page.locator('[data-testid="test-mode-indicator"]')).toBeVisible();

    // Wait for completion
    await waitForExecution(page);

    // Should show results but not save execution
    await expect(page.locator('[data-testid="test-results"]')).toBeVisible();
  });

  test('should handle conditional workflow branching', async ({ page }) => {
    await createWorkflow(page, 'Conditional Workflow Test');

    // Create workflow with condition
    await addNode(page, 'manual-trigger');
    await addNode(page, 'condition');
    await addNode(page, 'http-request'); // True branch
    await addNode(page, 'http-request'); // False branch

    // Configure condition
    await page.click('[data-node-type="condition"]');
    await page.click('[data-testid="configure-node"]');
    await page.fill('input[name="condition"]', '{{ $input.value > 10 }}');
    await page.click('[data-testid="save-node-config"]');

    // Connect nodes
    await connectNodes(page, 'trigger-1', 'condition-1');
    await connectNodes(page, 'condition-1', 'action-true', 'true');
    await connectNodes(page, 'condition-1', 'action-false', 'false');

    await saveWorkflow(page);
    await executeWorkflow(page);
    await waitForExecution(page);

    // Should show which branch was taken
    await expect(page.locator('[data-testid="execution-path"]')).toBeVisible();
  });
});
