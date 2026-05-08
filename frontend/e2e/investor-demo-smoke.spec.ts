import { test, expect } from '@playwright/test';

/**
 * Investor Demo Happy Path — E2E Smoke Test
 *
 * Validates the critical user journey shown during investor demos:
 * Login → Trader Command Center → Process Cockpit → Master Data
 *
 * This test runs against a live environment (dev by default).
 * Set PLAYWRIGHT_BASE_URL to target a different environment.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';

test.describe('Investor Demo Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    // Use the first visible text input for username (login forms vary)
    const usernameInput = page.locator('input[type="text"]:visible, input[name="username"]:visible, input[name="email"]:visible').first();
    await usernameInput.fill('admin_test_development_1');
    await page.locator('input[type="password"]:visible').first().fill('password123!');
    await page.locator('button[type="submit"]:visible').first().click();
    // Wait for auth redirect (any authenticated route)
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  });

  test('should load Trader Command Center with tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/trader-cockpit`);
    await page.waitForLoadState('domcontentloaded');

    // Page renders with heading content
    const heading = page.locator('h1, h2, [data-testid="page-title"]').first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Tab navigation is present (Segmented or ant-tabs)
    const tabOrSection = page.locator('[role="tab"], [role="tablist"], .ant-tabs, .ant-segmented');
    await expect(tabOrSection.first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Process Cockpit', async ({ page }) => {
    await page.goto(`${BASE_URL}/process-cockpit`);
    await page.waitForLoadState('domcontentloaded');

    // Main content area renders
    const content = page.locator('[role="tabpanel"], .ant-tabs-content, main');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Workforms Catalog', async ({ page }) => {
    await page.goto(`${BASE_URL}/workforms/catalog`);
    await page.waitForLoadState('domcontentloaded');

    const content = page.locator('main, [data-testid="catalog"], .catalog');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Suppliers master data', async ({ page }) => {
    await page.goto(`${BASE_URL}/suppliers`);
    await page.waitForLoadState('domcontentloaded');

    const tableOrList = page.locator('table, [role="grid"], .ant-table, [data-testid="entity-list"]');
    await expect(tableOrList.first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Customers master data', async ({ page }) => {
    await page.goto(`${BASE_URL}/customers`);
    await page.waitForLoadState('domcontentloaded');

    const tableOrList = page.locator('table, [role="grid"], .ant-table, [data-testid="entity-list"]');
    await expect(tableOrList.first()).toBeVisible({ timeout: 10000 });
  });

  test('should access AI Assistant page', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai-assistant`);
    await page.waitForLoadState('domcontentloaded');

    const content = page.locator('main, [data-testid="ai-assistant"]');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test('should not show error boundaries or 404 pages in demo flow', async ({ page }) => {
    const demoRoutes = [
      '/trader-cockpit',
      '/process-cockpit',
      '/workforms/catalog',
      '/suppliers',
      '/customers',
    ];

    for (const route of demoRoutes) {
      const response = await page.goto(`${BASE_URL}${route}`);
      await page.waitForLoadState('domcontentloaded');

      // HTTP response should be successful
      expect(response?.status(), `Route ${route} returned non-200`).toBeLessThan(400);

      // No React error boundary or explicit 404 page component
      const errorBoundary = page.locator('[data-testid="error-boundary"], [class*="error-boundary"]');
      await expect(errorBoundary).toHaveCount(0, { timeout: 3000 });
    }
  });
});
