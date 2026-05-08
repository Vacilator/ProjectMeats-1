import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Authentication Flow
 * Phase 6.3: E2E Test Coverage
 *
 * Tests login, logout, session management, and protected routes.
 */

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page for unauthenticated users', async ({ page }) => {
    await expect(page).toHaveTitle(/ProjectMeats|MeatsCentral/i);

    // Should redirect to login or show login form
    await expect(
      page.locator('input[type="email"], input[type="text"][name*="user"]')
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.locator('input[type="password"]')
    ).toBeVisible();

    await expect(
      page.locator('button:has-text("Login"), button:has-text("Sign In")')
    ).toBeVisible();
  });

  test('should show validation errors for invalid credentials', async ({ page }) => {
    // Enter invalid credentials
    await page.fill('input[type="email"], input[type="text"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');

    // Submit form
    await page.click('button:has-text("Login"), button:has-text("Sign In")');

    // Wait for error message
    await expect(
      page.locator('text=/Invalid credentials|Login failed|Authentication failed/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Use test credentials (should match backend test user)
    const testEmail = process.env.TEST_USER_EMAIL || 'admin@meatscentral.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'Admin123!';

    // Fill login form
    await page.fill('input[type="email"], input[type="text"]', testEmail);
    await page.fill('input[type="password"]', testPassword);

    // Submit
    await page.click('button:has-text("Login"), button:has-text("Sign In")');

    // Should redirect to dashboard/home after successful login
    await expect(page).toHaveURL(/\/(dashboard|home|workforms)/i, { timeout: 10000 });

    // Should show user menu or profile
    await expect(
      page.locator('[data-testid="user-menu"], .user-menu, [aria-label*="user"]')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should persist session after page reload', async ({ page, context }) => {
    // Login first
    const testEmail = process.env.TEST_USER_EMAIL || 'admin@meatscentral.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'Admin123!';

    await page.fill('input[type="email"], input[type="text"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button:has-text("Login"), button:has-text("Sign In")');

    // Wait for authentication
    await page.waitForURL(/\/(dashboard|home|workforms)/i, { timeout: 10000 });

    // Save session cookies
    const cookies = await context.cookies();
    expect(cookies.length).toBeGreaterThan(0);

    // Reload page
    await page.reload();

    // Should still be authenticated (not redirected to login)
    await expect(page).not.toHaveURL(/\/login/i);
    await expect(
      page.locator('[data-testid="user-menu"], .user-menu')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should successfully logout', async ({ page }) => {
    // Login first
    const testEmail = process.env.TEST_USER_EMAIL || 'admin@meatscentral.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'Admin123!';

    await page.fill('input[type="email"], input[type="text"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button:has-text("Login"), button:has-text("Sign In")');
    await page.waitForURL(/\/(dashboard|home|workforms)/i, { timeout: 10000 });

    // Click logout
    await page.click('[data-testid="user-menu"], .user-menu, [aria-label*="user"]');
    await page.click('text=/Logout|Sign Out/i');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/i, { timeout: 5000 });

    // Should show login form again
    await expect(page.locator('input[type="email"], input[type="text"]')).toBeVisible();
  });

  test('should protect routes requiring authentication', async ({ page }) => {
    // Try to access protected route directly
    await page.goto('/workforms');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/i, { timeout: 5000 });

    // Try another protected route
    await page.goto('/admin-studio');
    await expect(page).toHaveURL(/\/login/i, { timeout: 5000 });
  });

  test('should handle session expiration gracefully', async ({ page, context }) => {
    // Login first
    const testEmail = process.env.TEST_USER_EMAIL || 'admin@meatscentral.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'Admin123!';

    await page.fill('input[type="email"], input[type="text"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button:has-text("Login"), button:has-text("Sign In")');
    await page.waitForURL(/\/(dashboard|home|workforms)/i, { timeout: 10000 });

    // Clear session cookies to simulate expiration
    await context.clearCookies();

    // Try to navigate to protected route
    await page.goto('/workforms');

    // Should redirect to login (session expired)
    await expect(page).toHaveURL(/\/login/i, { timeout: 5000 });
  });
});
