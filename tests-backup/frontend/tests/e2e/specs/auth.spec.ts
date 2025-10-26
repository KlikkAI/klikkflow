import { expect, test } from '@playwright/test';
import { login, logout, waitForApp } from '../helpers/test-utils';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should redirect to login page when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Should show user menu
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/invalid|incorrect/i);

    // Should remain on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/login');

    // Try to submit without filling fields
    await page.click('button[type="submit"]');

    // Should show validation errors
    await expect(page.locator('input[name="email"]:invalid')).toBeVisible();
    await expect(page.locator('input[name="password"]:invalid')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await login(page, 'test@example.com', 'testpassword123');

    // Logout
    await logout(page);

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);

    // Try to access protected route
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should remember login state across page reloads', async ({ page }) => {
    // Login
    await login(page, 'test@example.com', 'testpassword123');

    // Reload page
    await page.reload();
    await waitForApp(page);

    // Should still be authenticated
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should navigate to registration page', async ({ page }) => {
    await page.goto('/login');

    await page.click('[data-testid="register-link"]');

    await expect(page).toHaveURL(/\/register/);
  });

  test('should register new user', async ({ page }) => {
    await page.goto('/register');

    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'testpassword123');
    await page.fill('input[name="confirmPassword"]', 'testpassword123');

    await page.click('button[type="submit"]');

    // Should redirect to dashboard or login
    await expect(page).toHaveURL(/\/(dashboard|login)/, { timeout: 10000 });
  });

  test('should show error when passwords do not match', async ({ page }) => {
    await page.goto('/register');

    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.fill('input[name="confirmPassword"]', 'differentpassword');

    await page.click('button[type="submit"]');

    // Should show error
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/password.*match/i);
  });
});
