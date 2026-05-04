import { expect, test } from '@playwright/test';

test.describe('operational status replay smoke', () => {
  test('supports the offline queue rollout guard', async ({ browserName, page }) => {
    test.skip(
      browserName !== 'chromium',
      'This smoke relies on deterministic offline event handling from the Playwright browser context.',
    );

    await page.addInitScript(() => {
      window.localStorage.setItem('pm:disableOperationalOfflineQueue', '1');
    });

    await page.goto('/diagnostics/operational-status-replay-smoke');

    await expect(page.getByText('Offline queue enabled: no')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update Status' })).toBeEnabled();

    await page.evaluate(() => {
      if (window.__PM_OPERATIONAL_SMOKE__) {
        window.__PM_OPERATIONAL_SMOKE__.failNextTransition = true;
      }
      window.dispatchEvent(new Event('offline'));
    });

    await page.getByRole('button', { name: 'Update Status' }).click();

    await expect(page.getByText('Current status: processing')).toBeVisible();
    await expect(page.getByText('Queued transitions: 0')).toBeVisible();
    await expect(page.getByText(/Queued offline:/)).toHaveCount(0);
  });
});
