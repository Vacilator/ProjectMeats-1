import { test, expect, type Page } from '@playwright/test';

const VIEWPORT = { width: 375, height: 667 }; // iPhone SE logical size

async function login(page: Page) {
  await page.goto('/');

  // If already authenticated (e.g. reuseExistingServer locally), skip.
  const password = page.locator('input[type="password"]');
  if ((await password.count()) === 0) return;

  const testEmail = process.env.TEST_USER_EMAIL || 'admin@meatscentral.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'Admin123!';

  await page.fill('input[type="email"], input[type="text"]', testEmail);
  await page.fill('input[type="password"]', testPassword);
  await page.click('button:has-text("Login"), button:has-text("Sign In")');

  await page.waitForURL(/\/(dashboard|home|workforms)/i, { timeout: 10000 });
}

async function assertNoPageHorizontalScroll(page: Page) {
  const metrics = await page.evaluate(() => {
    const el = document.documentElement;

    const before = window.scrollX;
    window.scrollTo(9999, window.scrollY);
    const after = window.scrollX;
    window.scrollTo(0, window.scrollY);

    return {
      before,
      after,
      innerWidth: window.innerWidth,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
    };
  });

  if (metrics.after !== 0) {
    const offenders = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      return Array.from(document.querySelectorAll<HTMLElement>('*'))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            id: el.id || undefined,
            class: el.className || undefined,
            right: Math.round(r.right),
            width: Math.round(r.width),
          };
        })
        .filter((x) => x.right > vw + 1 && x.width > 0)
        .sort((a, b) => b.right - a.right)
        .slice(0, 10);
    });

    throw new Error(
      `Page is horizontally scrollable at 375px. ${JSON.stringify({ metrics, offenders }, null, 2)}`
    );
  }

  expect(metrics.after).toBe(0);
}

async function assertTableContainerFitsViewport(page: Page) {
  const ok = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="sales-orders-table-container"]') as HTMLElement | null;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.left >= -1 && r.right <= window.innerWidth + 1;
  });

  expect(ok).toBeTruthy();
}

async function mockSalesOrdersApis(page: Page) {
  const now = new Date().toISOString();
  let created: any = null;

  await page.route(/\/api\/v1\/system\/forms\/schema\/?(\?.*)?$/, async (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fallback();

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'New Sales Order',
        description: 'E2E schema for mobile Sales Orders create test',
        key_fields: ['customer', 'status', 'order_date', 'total_amount'],
        fields: [
          {
            key: 'customer',
            label: 'Customer',
            type: 'select',
            required: true,
            choices: [{ value: '1', label: 'E2E Customer' }],
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            required: true,
            choices: [
              { value: 'draft', label: 'Draft' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'processing', label: 'Processing' },
              { value: 'shipped', label: 'Shipped' },
              { value: 'delivered', label: 'Delivered' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
          {
            key: 'order_date',
            label: 'Order Date',
            type: 'date',
            required: true,
          },
          {
            key: 'total_amount',
            label: 'Total Amount',
            type: 'number',
            required: true,
          },
          {
            key: 'notes',
            label: 'Notes',
            type: 'textarea',
            required: false,
          },
        ],
      }),
    });
  });

  await page.route(/\/api\/v1\/sales-orders\/?(\?.*)?$/, async (route) => {
    const req = route.request();

    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: created ? [created] : [], count: created ? 1 : 0 }),
      });
    }

    if (req.method() === 'POST') {
      const payload = (req.postDataJSON?.() as any) ?? {};

      expect(payload).toMatchObject({
        customer: '1',
        status: 'draft',
        order_date: '2030-01-01',
      });

      created = {
        id: 999,
        tenant: 't1',
        order_number: 'SO-000999',
        customer: 1,
        customer_name: 'E2E Customer',
        order_date: payload.order_date ?? '2030-01-01',
        delivery_date: null,
        status: payload.status ?? 'draft',
        total_amount: String(payload.total_amount ?? '1'),
        notes: String(payload.notes ?? ''),
        created_by: null,
        created_by_name: 'Admin',
        created_on: now,
        updated_on: now,
      };

      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
    }

    return route.fallback();
  });
}

test.describe('Mobile: Sales Orders create is usable at 375px', () => {
  test.use({ viewport: VIEWPORT });

  test('can open Sales Orders create form and reach primary CTA (no horizontal overflow)', async ({ page }) => {
    await login(page);
    await mockSalesOrdersApis(page);

    // Auto-open create modal via query param.
    await page.goto('/sales-orders?action=create');

    await expect(page.getByRole('heading', { name: /^Sales Orders$/ })).toBeVisible({ timeout: 15000 });

    // Usability: no horizontal overflow at page level.
    await assertNoPageHorizontalScroll(page);

    // Usability: table container should fit the viewport.
    await assertTableContainerFitsViewport(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15000 });

    // Wait for schema-driven fields to render.
    await expect(dialog.locator('#customer')).toBeVisible({ timeout: 15000 });

    // Fill required fields.
    await dialog.locator('#customer').click();
    await page.locator('.ant-select-dropdown:visible').last().getByText('E2E Customer', { exact: true }).click();

    await dialog.locator('#status').click();
    await page.locator('.ant-select-dropdown:visible').last().getByText('Draft', { exact: true }).click();

    await dialog.locator('input#order_date').fill('2030-01-01');
    await dialog.locator('input#total_amount').fill('1');

    const submit = dialog.getByRole('button', { name: /^Create$/ });

    // Primary CTA reachable on mobile.
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeVisible();
    await expect(submit).toBeInViewport();

    await Promise.all([
      page.waitForResponse((resp) =>
        resp.request().method() === 'POST' &&
        /\/api\/v1\/sales-orders\/?$/.test(new URL(resp.url()).pathname) &&
        resp.status() === 201
      ),
      submit.click(),
    ]);

    // Modal should close after successful submit.
    await expect(dialog).toBeHidden({ timeout: 10000 });

    // Still no horizontal overflow after closing.
    await assertNoPageHorizontalScroll(page);
  });
});
