import { expect, test } from '@playwright/test';
import { addNode, createWorkflow, login, saveWorkflow } from '../helpers/test-utils';

test.describe('Workflow Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page, 'test@example.com', 'testpassword123');
    await page.goto('/dashboard');
  });

  test('should create a new workflow', async ({ page }) => {
    const workflowName = `Test Workflow ${Date.now()}`;

    // Click create workflow button
    await page.click('[data-testid="create-workflow-button"]');

    // Fill workflow details
    await page.fill('input[name="name"]', workflowName);
    await page.fill('textarea[name="description"]', 'This is a test workflow');

    await page.click('button[type="submit"]');

    // Should navigate to workflow editor
    await expect(page).toHaveURL(/\/workflow\/[a-zA-Z0-9-]+/);

    // Should show workflow name in header
    await expect(page.locator('[data-testid="workflow-name"]')).toContainText(workflowName);
  });

  test('should add nodes to workflow canvas', async ({ page }) => {
    await createWorkflow(page, 'Node Test Workflow');

    // Add a trigger node
    await page.click('[data-testid="node-panel-toggle"]');
    await page.fill('[data-testid="node-search"]', 'manual trigger');
    await page.click('[data-node-type="manual-trigger"]');

    // Verify node appears on canvas
    await expect(page.locator('[data-node-type="manual-trigger"]')).toBeVisible();

    // Add an action node
    await page.fill('[data-testid="node-search"]', 'http request');
    await page.click('[data-node-type="http-request"]');

    // Verify action node appears
    await expect(page.locator('[data-node-type="http-request"]')).toBeVisible();
  });

  test('should save workflow', async ({ page }) => {
    await createWorkflow(page, 'Save Test Workflow');

    // Make some changes
    await addNode(page, 'manual-trigger');

    // Save workflow
    await saveWorkflow(page);

    // Should show success message
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
  });

  test('should edit workflow properties', async ({ page }) => {
    await createWorkflow(page, 'Edit Properties Workflow');

    // Click workflow settings
    await page.click('[data-testid="workflow-settings"]');

    // Edit name and description
    const newName = `Updated Workflow ${Date.now()}`;
    await page.fill('input[name="name"]', newName);
    await page.fill('textarea[name="description"]', 'Updated description');

    await page.click('[data-testid="save-settings"]');

    // Verify changes
    await expect(page.locator('[data-testid="workflow-name"]')).toContainText(newName);
  });

  test('should delete node from canvas', async ({ page }) => {
    await createWorkflow(page, 'Delete Node Workflow');

    // Add a node
    await addNode(page, 'manual-trigger');

    // Select node
    await page.click('[data-node-type="manual-trigger"]');

    // Delete node (using Delete key or delete button)
    await page.keyboard.press('Delete');

    // Node should be removed
    await expect(page.locator('[data-node-type="manual-trigger"]')).not.toBeVisible();
  });

  test('should connect nodes with edges', async ({ page }) => {
    await createWorkflow(page, 'Connect Nodes Workflow');

    // Add two nodes
    await addNode(page, 'manual-trigger');
    await addNode(page, 'http-request');

    // Connect nodes by dragging from handle
    const sourceHandle = page.locator('[data-node-type="manual-trigger"] [data-handlepos="right"]');
    const targetHandle = page.locator('[data-node-type="http-request"] [data-handlepos="left"]');

    await sourceHandle.hover();
    await page.mouse.down();

    const targetBox = await targetHandle.boundingBox();
    if (targetBox) {
      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
      await page.mouse.up();
    }

    // Verify edge exists
    await expect(page.locator('.react-flow__edge')).toBeVisible();
  });

  test('should duplicate workflow', async ({ page }) => {
    // Create and save a workflow
    await createWorkflow(page, 'Original Workflow');
    await addNode(page, 'manual-trigger');
    await saveWorkflow(page);

    // Go back to dashboard
    await page.goto('/dashboard');

    // Find workflow and duplicate it
    await page.click('[data-workflow-name="Original Workflow"] [data-testid="workflow-menu"]');
    await page.click('[data-testid="duplicate-workflow"]');

    // Should create a copy
    await expect(page.locator('[data-workflow-name*="Original Workflow (Copy)"]')).toBeVisible();
  });

  test('should validate workflow before execution', async ({ page }) => {
    await createWorkflow(page, 'Validation Test Workflow');

    // Add just a trigger without connecting to anything
    await addNode(page, 'manual-trigger');

    // Try to execute
    await page.click('[data-testid="execute-workflow"]');

    // Should show validation error
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="validation-error"]')).toContainText(
      /incomplete|invalid/i
    );
  });

  test('should show node configuration panel', async ({ page }) => {
    await createWorkflow(page, 'Node Config Workflow');

    // Add a node that requires configuration
    await addNode(page, 'http-request');

    // Click on node
    await page.click('[data-node-type="http-request"]');

    // Click configure button
    await page.click('[data-testid="configure-node"]');

    // Configuration panel should appear
    await expect(page.locator('[data-testid="node-config-panel"]')).toBeVisible();

    // Should have configuration fields
    await expect(page.locator('input[name="url"]')).toBeVisible();
    await expect(page.locator('select[name="method"]')).toBeVisible();
  });

  test('should search for workflows in dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Use search
    await page.fill('[data-testid="workflow-search"]', 'test');

    // Should filter workflows
    const workflows = page.locator('[data-testid="workflow-card"]');
    const count = await workflows.count();

    // All visible workflows should contain "test" in name
    for (let i = 0; i < count; i++) {
      await expect(workflows.nth(i)).toContainText(/test/i);
    }
  });

  test('should filter workflows by status', async ({ page }) => {
    await page.goto('/dashboard');

    // Click on "Active" filter
    await page.click('[data-filter="active"]');

    // Should show only active workflows
    const workflows = page.locator('[data-testid="workflow-card"]');
    const count = await workflows.count();

    for (let i = 0; i < count; i++) {
      await expect(workflows.nth(i).locator('[data-testid="workflow-status"]')).toContainText(
        'active'
      );
    }
  });
});
