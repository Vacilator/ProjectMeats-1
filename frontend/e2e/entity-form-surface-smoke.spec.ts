import { expect, test } from '@playwright/test';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';

const isFatalReactRuntimeMessage = (message: string): boolean => {
  const normalized = message.toLowerCase();

  return (
    normalized.includes('minified react error') ||
    normalized.includes('maximum update depth exceeded') ||
    normalized.includes('react error #185') ||
    normalized.includes('error #185')
  );
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ tenantId }) => {
      window.localStorage.setItem('authToken', 'playwright-legacy-token');
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
        })
      );
      (window as typeof window & { ENV?: Record<string, string> }).ENV = {
        API_BASE_URL: 'http://127.0.0.1:3000/api/v1',
        ENVIRONMENT: 'development',
      };
    },
    { tenantId: TENANT_ID }
  );

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const key = url.searchParams.get('key');
    const method = request.method();
    const values: Record<string, unknown> = {
      'forms.show_required_indicator': true,
      'forms.show_help_text': true,
      'forms.validate_on_change': false,
      'forms.submit_button_text': 'Submit',
    };

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

    if (path.endsWith('/system/config/resolve/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          value: key ? values[key] : null,
          source: 'system',
          metadata: null,
        }),
      });
      return;
    }

    if (path.endsWith('/system/forms/schema/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'Plant',
          description: 'Plant schema',
          fields: [
            { key: 'name', label: 'Plant Name', type: 'text', required: true },
            {
              key: 'supplier',
              label: 'Supplier',
              type: 'foreign_key',
              related_entity: 'suppliers.Supplier',
            },
          ],
        }),
      });
      return;
    }

    if (path.endsWith('/plants/2769/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 2769,
          name: 'North Plant',
          supplier: '123',
        }),
      });
      return;
    }

    if (path.endsWith('/suppliers/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{ id: '123', name: 'Acme Foods' }],
        }),
      });
      return;
    }

    if (path.endsWith('/workflows/entity-options/supplier/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          entity_type: 'supplier',
          entity_label: 'Supplier',
          options: [{ value: '123', label: 'Acme Foods' }],
          count: 1,
          total_count: 1,
          has_more: false,
          can_create: true,
        }),
      });
      return;
    }

    await route.fulfill({
      status: method === 'DELETE' ? 204 : 200,
      contentType: 'application/json',
      body: method === 'DELETE' ? '' : JSON.stringify({}),
    });
  });
});

test('renders the plant edit form in production preview without hitting max update depth', async ({
  page,
}) => {
  const fatalBrowserErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') {
      return;
    }

    const message = msg.text();
    if (isFatalReactRuntimeMessage(message)) {
      fatalBrowserErrors.push(`console.error: ${message}`);
    }
  });

  page.on('pageerror', (error) => {
    if (isFatalReactRuntimeMessage(error.message)) {
      fatalBrowserErrors.push(`pageerror: ${error.message}`);
    }
  });

  await page.goto('/diagnostics/entity-form-surface-smoke');

  await expect(page.getByTestId('entity-form-smoke-title')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Plant' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Plant Name *' })).toHaveValue('North Plant');
  await expect(page.getByText('Supplier', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Acme Foods/ })).toBeVisible();
  await expect(page.getByTestId('entity-form-loading')).toHaveCount(0);

  await page.waitForTimeout(3000);

  expect(fatalBrowserErrors).toEqual([]);
});

test('renders the plant create form in production preview without hitting max update depth', async ({
  page,
}) => {
  const fatalBrowserErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') {
      return;
    }

    const message = msg.text();
    if (isFatalReactRuntimeMessage(message)) {
      fatalBrowserErrors.push(`console.error: ${message}`);
    }
  });

  page.on('pageerror', (error) => {
    if (isFatalReactRuntimeMessage(error.message)) {
      fatalBrowserErrors.push(`pageerror: ${error.message}`);
    }
  });

  await page.goto('/diagnostics/entity-form-surface-smoke?mode=create');

  await expect(page.getByTestId('entity-form-smoke-title')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Plant' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Plant Name *' })).toHaveValue('');
  await expect(page.getByText('Supplier', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Acme Foods/ })).toBeVisible();
  await expect(page.getByTestId('entity-form-loading')).toHaveCount(0);

  await page.waitForTimeout(3000);

  expect(fatalBrowserErrors).toEqual([]);
});

test('opens the supplier New Plant create surface in production preview without hitting max update depth', async ({
  page,
}) => {
  const fatalBrowserErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') {
      return;
    }

    const message = msg.text();
    if (isFatalReactRuntimeMessage(message)) {
      fatalBrowserErrors.push(`console.error: ${message}`);
    }
  });

  page.on('pageerror', (error) => {
    if (isFatalReactRuntimeMessage(error.message)) {
      fatalBrowserErrors.push(`pageerror: ${error.message}`);
    }
  });

  await page.goto('/diagnostics/entity-form-surface-smoke?scenario=supplier-child');

  await expect(page.getByTestId('entity-form-smoke-title')).toBeVisible();
  await page.getByTestId('supplier-child-open').click();
  await expect(page.getByRole('heading', { name: 'Plant' })).toBeVisible();
  await expect(page.getByText('Supplier', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Acme Foods/ })).toBeVisible();
  await expect(page.getByTestId('entity-form-loading')).toHaveCount(0);

  await page.waitForTimeout(3000);

  expect(fatalBrowserErrors).toEqual([]);
});
