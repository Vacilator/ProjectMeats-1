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

type Rect = { top: number; left: number; right: number; bottom: number };

function rectsOverlap(a: Rect, b: Rect, padding = 2) {
  return !(
    a.right - padding < b.left + padding ||
    a.left + padding > b.right - padding ||
    a.bottom - padding < b.top + padding ||
    a.top + padding > b.bottom - padding
  );
}

test.describe('Workforms Editor: Layout stability', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('auto-layout prevents overlaps after adding Trigger + Form Process', async ({ page }) => {
    await page.goto('/admin-studio');

    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 15000 });

    // Ensure we have at least one Trigger on the canvas
    const addTriggerBtn = page.getByRole('button', { name: /\+ Add Manual Trigger/i });
    if (await addTriggerBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addTriggerBtn.click();
    }

    // Open the node palette (Tab toggles it)
    const searchInput = page.locator('input[placeholder*="Search nodes"]');
    if (!(await searchInput.isVisible().catch(() => false))) {
      await page.keyboard.press('Tab');
    }
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    await searchInput.fill('Form Process');

    // Click the palette item
    const formProcessItem = page.locator('.node-palette').getByText('Form Process').first();
    await expect(formProcessItem).toBeVisible({ timeout: 5000 });
    await formProcessItem.click();

    // Apply auto-layout
    await page.locator('button:has-text("Layout")').click();
    await page.waitForTimeout(800);

    // Only validate overlap for top-level nodes we intentionally added.
    // (Container nodes will naturally overlap their children in the DOM bounds.)
    const nodes = page.locator(
      '.react-flow__node[data-type="triggerManual"], .react-flow__node[data-type="formProcess"]'
    );
    const nodeCount = await nodes.count();
    expect(nodeCount).toBeGreaterThanOrEqual(2);

    const rects: Rect[] = await nodes.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
      })
    );

    // Verify no overlaps between those nodes
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(rectsOverlap(rects[i], rects[j])).toBeFalsy();
      }
    }
  });
});
