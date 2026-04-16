import { test, expect } from '@playwright/test';

/**
 * E2E: Mobile/Tablet viewport smoke
 *
 * Purpose: catch responsive regressions early without requiring auth credentials.
 */

type ViewportCase = {
  name: string;
  width: number;
  height: number;
};

const VIEWPORTS: ViewportCase[] = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
];

for (const vp of VIEWPORTS) {
  test.describe(`Viewport smoke: ${vp.name}`, () => {
    test(`login page is usable at ${vp.width}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      // Guard: page should not overflow horizontally (common mobile regression).
      const ok = await page.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth <= el.clientWidth + 1;
      });
      expect(ok).toBeTruthy();

      // This environment may land on the login screen OR an already-authenticated shell.
      const password = page.locator('input[type="password"]');
      if (await password.count()) {
        // Login form should be usable.
        await expect(password.first()).toBeVisible({ timeout: 5000 });
        await expect(page.locator('button:has-text("Login"), button:has-text("Sign In")').first()).toBeVisible({
          timeout: 5000,
        });
      } else {
        // Authenticated shell: ensure a stable navigation/search affordance renders.
        const globalSearch = page.getByRole('textbox', { name: /global search/i });
        if (await globalSearch.count()) {
          await expect(globalSearch.first()).toBeVisible({ timeout: 5000 });
        } else {
          await expect(page.locator('nav, [role="navigation"], [data-testid="sidebar"]').first()).toBeVisible({
            timeout: 5000,
          });
        }
      }
    });
  });
}
