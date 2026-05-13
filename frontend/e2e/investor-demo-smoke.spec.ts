import { test, expect } from '@playwright/test';

/**
 * Investor Demo Happy Path — E2E Smoke Test
 *
 * Validates the critical user journey shown during investor demos:
 * Login → Home → Master Data lists → WorkForms → AI Settings
 *
 * This test runs against a live environment (dev by default).
 * Set PLAYWRIGHT_BASE_URL to target a different environment.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';

test.describe('Investor Demo Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const usernameInput = page.locator('input[type="text"]:visible, input[name="username"]:visible, input[name="email"]:visible').first();
    await usernameInput.fill('admin_test_development_1');
    await page.locator('input[type="password"]:visible').first().fill('password123!');
    await page.locator('button[type="submit"]:visible').first().click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  });

  test('should load Home page with workspace content', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('domcontentloaded');

    const content = page.locator('main, [data-testid="workspace"], [class*="Dashboard"]').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Suppliers list', async ({ page }) => {
    await page.goto(`${BASE_URL}/suppliers`);
    await page.waitForLoadState('domcontentloaded');

    const tableOrList = page.locator('table, [role="grid"], .ant-table, [data-testid="entity-list"]');
    await expect(tableOrList.first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Customers list', async ({ page }) => {
    await page.goto(`${BASE_URL}/customers`);
    await page.waitForLoadState('domcontentloaded');

    const tableOrList = page.locator('table, [role="grid"], .ant-table, [data-testid="entity-list"]');
    await expect(tableOrList.first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Purchase Orders list', async ({ page }) => {
    await page.goto(`${BASE_URL}/purchase-orders`);
    await page.waitForLoadState('domcontentloaded');

    const tableOrList = page.locator('table, [role="grid"], .ant-table, [data-testid="entity-list"]');
    await expect(tableOrList.first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Sales Orders list', async ({ page }) => {
    await page.goto(`${BASE_URL}/sales-orders`);
    await page.waitForLoadState('domcontentloaded');

    const tableOrList = page.locator('table, [role="grid"], .ant-table, [data-testid="entity-list"]');
    await expect(tableOrList.first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Inquiries list', async ({ page }) => {
    await page.goto(`${BASE_URL}/inquiries`);
    await page.waitForLoadState('domcontentloaded');

    const tableOrList = page.locator('table, [role="grid"], .ant-table, [data-testid="entity-list"]');
    await expect(tableOrList.first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Workforms Catalog', async ({ page }) => {
    await page.goto(`${BASE_URL}/workforms/catalog`);
    await page.waitForLoadState('domcontentloaded');

    const content = page.locator('main, [data-testid="catalog"], .catalog');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to AI Settings', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/ai`);
    await page.waitForLoadState('domcontentloaded');

    const content = page.locator('main, [data-testid="ai-settings"], form, [class*="Settings"]').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test('should not show error boundaries or 404 pages on demo routes', async ({ page }) => {
    const demoRoutes = [
      '/',
      '/suppliers',
      '/customers',
      '/purchase-orders',
      '/sales-orders',
      '/inquiries',
      '/workforms/catalog',
      '/settings/ai',
    ];

    for (const route of demoRoutes) {
      const response = await page.goto(`${BASE_URL}${route}`);
      await page.waitForLoadState('domcontentloaded');

      expect(response?.status(), `Route ${route} returned non-200`).toBeLessThan(400);

      const errorBoundary = page.locator('[data-testid="error-boundary"], [class*="error-boundary"]');
      await expect(errorBoundary).toHaveCount(0, { timeout: 3000 });
    }
  });
});
