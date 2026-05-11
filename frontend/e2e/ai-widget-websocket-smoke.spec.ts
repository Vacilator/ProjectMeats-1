import { expect, test } from '@playwright/test';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';

const isFatalWebsocketNoise = (message: string): boolean => {
  const normalized = message.toLowerCase();

  return (
    normalized.includes('websocket connection') ||
    normalized.includes('react error #185') ||
    normalized.includes('minified react error')
  );
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ tenantId }) => {
    const encodedPayload = btoa(
      JSON.stringify({
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
        defaultTenantId: tenantId,
      }),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    window.localStorage.setItem('accessToken', `eyJhbGciOiJub25lIn0.${encodedPayload}.`);
    window.localStorage.setItem('tenantId', tenantId);
    window.localStorage.setItem('tenantName', 'Playwright Tenant');
    window.localStorage.setItem('tenantSlug', 'playwright-tenant');
    window.localStorage.setItem(
      'user',
      JSON.stringify({
        id: 7,
        username: 'playwright-user',
        email: 'playwright@example.com',
        first_name: 'Play',
        last_name: 'Wright',
        is_active: true,
      }),
    );
    (window as typeof window & { ENV?: Record<string, string> }).ENV = {
      API_BASE_URL: 'http://127.0.0.1:3000/api/v1',
      ENVIRONMENT: 'development',
    };
  }, { tenantId: TENANT_ID });

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/tenants/current_theme/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          logo_url: null,
          primary_color_light: '#4f46e5',
          primary_color_dark: '#6366f1',
          name: 'Playwright Tenant',
          theme_version: '1',
        }),
      });
      return;
    }

    if (path.endsWith('/preferences/me/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ theme: 'dark' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  await page.route('**/ws/ai/inbox/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body>spa-fallback</body></html>',
    });
  });
});

test('does not emit raw websocket console failures when /ws falls back to HTML', async ({ page }) => {
  const fatalBrowserErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') {
      return;
    }

    const message = msg.text();
    if (isFatalWebsocketNoise(message)) {
      fatalBrowserErrors.push(`console.error: ${message}`);
    }
  });

  page.on('pageerror', (error) => {
    if (isFatalWebsocketNoise(error.message)) {
      fatalBrowserErrors.push(`pageerror: ${error.message}`);
    }
  });

  await page.goto('/diagnostics/ai-widget-websocket-smoke');

  await expect(page.getByTestId('ai-widget-smoke-title')).toBeVisible();
  await expect(page.getByRole('button', { name: 'AI chat widget' })).toBeVisible();

  await page.waitForTimeout(3000);

  expect(fatalBrowserErrors).toEqual([]);
});
