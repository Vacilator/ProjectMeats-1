import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/');

  const testEmail = process.env.TEST_USER_EMAIL || 'admin@meatscentral.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'Admin123!';

  await page.fill('input[type="email"], input[type="text"]', testEmail);
  await page.fill('input[type="password"]', testPassword);
  await page.click('button:has-text("Login"), button:has-text("Sign In")');

  await page.waitForURL(/\/(dashboard|home|workforms)/i, { timeout: 10000 });
}

test.describe('Entity Hierarchy: Suppliers → Plants → Contacts', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('drilldown works and Plant Contact Department options are present', async ({ page }) => {
    await page.goto('/suppliers');

    const firstSupplierRow = page.locator('[data-testid^="supplier-row-"]').first();
    await expect(firstSupplierRow).toBeVisible({ timeout: 15000 });
    await firstSupplierRow.click();

    // Plants panel should render
    await expect(page.getByText('Plants')).toBeVisible();

    // Verify the Plant create form renders
    await page.locator('[data-testid="supplier-create-plant"]').click();
    await expect(page.locator('[data-testid="plant-create-modal"]')).toBeVisible();
    await page.locator('[data-testid="plant-create-modal"]').locator('text=×').first().click();

    // Select first Plant and open Contact modal
    const firstPlantRow = page.locator('[data-testid^="plant-row-"]').first();
    await expect(firstPlantRow).toBeVisible({ timeout: 15000 });
    await firstPlantRow.click();

    await page.locator('[data-testid="plant-create-contact"]').click();
    await expect(page.locator('[data-testid="plant-contact-modal"]')).toBeVisible();

    // Open department dropdown and verify choices
    await page.locator('[aria-label="Department"]').click();
    await expect(page.getByText('Sales', { exact: true })).toBeVisible();
    await expect(page.getByText('Quality Assurance', { exact: true })).toBeVisible();
    await expect(page.getByText('Booking', { exact: true })).toBeVisible();
    await expect(page.getByText('Accounting', { exact: true })).toBeVisible();
  });
});
