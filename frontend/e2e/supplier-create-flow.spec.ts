import { test, expect } from '@playwright/test';

test.describe('Supplier Create Flow', () => {
  test('navigates to suppliers and opens create form', async ({ page }) => {
    await page.goto('/suppliers');
    await page.waitForLoadState('networkidle');

    // Find "New Supplier" or "+ Add" button
    const newButton = page.locator('button:has-text("New"), button:has-text("Add"), a:has-text("New Supplier")').first();
    await expect(newButton).toBeVisible({ timeout: 5000 });
    await newButton.click();

    // Modal or form should appear
    await page.waitForTimeout(1000);

    // Verify form fields are present (not a crash/error page)
    const formContent = page.locator('form, [class*="Form"], [class*="Modal"], [role="dialog"]').first();
    await expect(formContent).toBeVisible({ timeout: 5000 });

    // Verify no React error boundary or crash message
    const errorBoundary = page.locator('text=Something went wrong');
    const hasError = await errorBoundary.isVisible().catch(() => false);
    expect(hasError).toBe(false);
  });
});
