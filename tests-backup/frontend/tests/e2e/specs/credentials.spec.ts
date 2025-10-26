import { expect, test } from '@playwright/test';
import { login } from '../helpers/test-utils';

test.describe('Credentials Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'test@example.com', 'testpassword123');
    await page.goto('/credentials');
  });

  test('should display credentials page', async ({ page }) => {
    await expect(page.locator('[data-testid="credentials-page"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText(/credentials/i);
  });

  test('should create new credential', async ({ page }) => {
    // Click create credential button
    await page.click('[data-testid="create-credential"]');

    // Select credential type
    await page.click('[data-credential-type="gmail"]');

    // Fill credential details
    await page.fill('input[name="name"]', `Test Gmail Credential ${Date.now()}`);
    await page.fill('input[name="clientId"]', 'test-client-id');
    await page.fill('input[name="clientSecret"]', 'test-client-secret');

    // Save credential
    await page.click('[data-testid="save-credential"]');

    // Should show success message
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();

    // Credential should appear in list
    await expect(page.locator('[data-credential-name*="Test Gmail Credential"]')).toBeVisible();
  });

  test('should edit existing credential', async ({ page }) => {
    // Find first credential
    const credential = page.locator('[data-testid="credential-item"]').first();
    await credential.click();

    // Click edit button
    await page.click('[data-testid="edit-credential"]');

    // Update name
    const newName = `Updated Credential ${Date.now()}`;
    await page.fill('input[name="name"]', newName);

    // Save
    await page.click('[data-testid="save-credential"]');

    // Should show updated name
    await expect(page.locator(`[data-credential-name="${newName}"]`)).toBeVisible();
  });

  test('should delete credential', async ({ page }) => {
    // Create a test credential first
    await page.click('[data-testid="create-credential"]');
    await page.click('[data-credential-type="http-auth"]');

    const credentialName = `Delete Test ${Date.now()}`;
    await page.fill('input[name="name"]', credentialName);
    await page.fill('input[name="token"]', 'test-token');
    await page.click('[data-testid="save-credential"]');

    // Find and delete the credential
    const credential = page.locator(`[data-credential-name="${credentialName}"]`);
    await credential.hover();
    await credential.locator('[data-testid="delete-credential"]').click();

    // Confirm deletion
    await page.click('[data-testid="confirm-delete"]');

    // Credential should be removed
    await expect(credential).not.toBeVisible();
  });

  test('should test credential connection', async ({ page }) => {
    // Select a credential
    const credential = page.locator('[data-testid="credential-item"]').first();
    await credential.click();

    // Click test button
    await page.click('[data-testid="test-credential"]');

    // Should show test result
    await expect(page.locator('[data-testid="test-result"]')).toBeVisible();

    // Result should be success or failure
    const result = page.locator('[data-testid="test-result"]');
    await expect(result).toContainText(/(success|connected|failed)/i);
  });

  test('should filter credentials by type', async ({ page }) => {
    // Select Gmail filter
    await page.click('[data-filter="gmail"]');

    // All visible credentials should be Gmail type
    const credentials = page.locator('[data-testid="credential-item"]');
    const count = await credentials.count();

    for (let i = 0; i < count; i++) {
      await expect(credentials.nth(i).locator('[data-testid="credential-type"]')).toContainText(
        'gmail'
      );
    }
  });

  test('should search for credentials', async ({ page }) => {
    // Use search
    await page.fill('[data-testid="credential-search"]', 'test');

    // Should filter credentials
    const credentials = page.locator('[data-testid="credential-item"]');
    const count = await credentials.count();

    for (let i = 0; i < count; i++) {
      await expect(credentials.nth(i)).toContainText(/test/i);
    }
  });

  test('should show credential usage information', async ({ page }) => {
    // Click on a credential
    const credential = page.locator('[data-testid="credential-item"]').first();
    await credential.click();

    // Should show usage stats
    await expect(page.locator('[data-testid="credential-usage"]')).toBeVisible();

    // Should show workflows using this credential
    await expect(page.locator('[data-testid="workflows-using-credential"]')).toBeVisible();
  });

  test('should handle OAuth flow for Gmail', async ({ page, context }) => {
    // Click create credential
    await page.click('[data-testid="create-credential"]');
    await page.click('[data-credential-type="gmail"]');

    // Fill basic info
    await page.fill('input[name="name"]', `OAuth Test ${Date.now()}`);

    // Click OAuth connect button
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.click('[data-testid="oauth-connect"]'),
    ]);

    // Popup should open to Google OAuth
    await expect(popup).toHaveURL(/accounts\.google\.com/);

    // Note: In real tests, you'd mock the OAuth flow
  });

  test('should revoke Gmail credential', async ({ page }) => {
    // Find a Gmail credential
    await page.click('[data-filter="gmail"]');
    const credential = page.locator('[data-testid="credential-item"]').first();

    if (await credential.isVisible()) {
      await credential.click();

      // Click revoke button
      await page.click('[data-testid="revoke-credential"]');

      // Confirm revocation
      await page.click('[data-testid="confirm-revoke"]');

      // Should show success message
      await expect(page.locator('[data-testid="revoke-success"]')).toBeVisible();
    }
  });

  test('should show credential statistics', async ({ page }) => {
    // Should show total credentials
    await expect(page.locator('[data-testid="total-credentials"]')).toBeVisible();

    // Should show verified credentials count
    await expect(page.locator('[data-testid="verified-credentials"]')).toBeVisible();

    // Should show credential types available
    await expect(page.locator('[data-testid="credential-types-count"]')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.click('[data-testid="create-credential"]');
    await page.click('[data-credential-type="http-auth"]');

    // Try to save without filling required fields
    await page.click('[data-testid="save-credential"]');

    // Should show validation errors
    await expect(page.locator('input[name="name"]:invalid')).toBeVisible();
  });

  test('should prevent duplicate credential names', async ({ page }) => {
    // Create first credential
    await page.click('[data-testid="create-credential"]');
    await page.click('[data-credential-type="http-auth"]');

    const duplicateName = `Duplicate Test ${Date.now()}`;
    await page.fill('input[name="name"]', duplicateName);
    await page.fill('input[name="token"]', 'test-token-1');
    await page.click('[data-testid="save-credential"]');

    // Try to create another with same name
    await page.click('[data-testid="create-credential"]');
    await page.click('[data-credential-type="http-auth"]');
    await page.fill('input[name="name"]', duplicateName);
    await page.fill('input[name="token"]', 'test-token-2');
    await page.click('[data-testid="save-credential"]');

    // Should show error
    await expect(page.locator('[data-testid="error-message"]')).toContainText(
      /already exists|duplicate/i
    );
  });
});
