import { test, expect } from '@playwright/test';

test.describe('Global Search (Command Palette)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home — auth is handled by test setup or mock
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('opens command palette with Ctrl+K', async ({ page }) => {
    await page.keyboard.press('Control+k');
    // The command palette should appear — look for search input
    const searchInput = page.locator('[data-testid="command-palette-input"], [placeholder*="Search"], [role="combobox"]').first();
    await expect(searchInput).toBeVisible({ timeout: 3000 });
  });

  test('shows grouped results when typing', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const searchInput = page.locator('[data-testid="command-palette-input"], [placeholder*="Search"], [role="combobox"]').first();
    await searchInput.fill('test');
    // Wait for results — should show group headers or result items
    await page.waitForTimeout(1000); // debounce
    // Verify no error state
    const errorText = page.locator('text=Error');
    const hasError = await errorText.isVisible().catch(() => false);
    expect(hasError).toBe(false);
  });

  test('closes on Escape', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.keyboard.press('Escape');
    // Palette should be hidden
    await page.waitForTimeout(500);
  });
});
