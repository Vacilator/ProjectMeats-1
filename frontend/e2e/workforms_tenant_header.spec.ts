import { test, expect } from '@playwright/test';

const loginViaUI = async (page: any) => {
  await page.goto('/');

  const testEmail = process.env.TEST_USER_EMAIL || 'admin@meatscentral.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'Admin123!';

  await page.fill('input[type="email"], input[type="text"]', testEmail);
  await page.fill('input[type="password"]', testPassword);
  await page.click('button:has-text("Login"), button:has-text("Sign In")');
  await page.waitForURL(/\/(dashboard|home|workforms)/i, { timeout: 10000 });
};

test.describe('WorkForms tenant header', () => {
  test('WorkForms catalog requests include X-Tenant-ID matching localStorage', async ({ page }) => {
    await loginViaUI(page);

    const tenantId = await page.evaluate(() => localStorage.getItem('tenantId'));
    expect(tenantId, 'tenantId must be present after login').toBeTruthy();

    const reqPromise = page.waitForRequest((req) => {
      return (
        req.method() === 'GET' &&
        req.url().includes('/api/v1/tenant-workforms/')
      );
    });

    await page.goto('/workforms/catalog');
    await expect(page.getByTestId('workforms-catalog-page')).toBeVisible();

    const req = await reqPromise;
    const headers = req.headers();

    // Playwright normalizes header names to lowercase.
    expect(headers['x-tenant-id']).toBe(String(tenantId));
    expect(headers['authorization'], 'Authorization header should be present').toBeTruthy();
  });
});
