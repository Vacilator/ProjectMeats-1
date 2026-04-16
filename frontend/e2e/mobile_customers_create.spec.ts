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

async function assertNoHorizontalOverflow(page: Page) {
  const ok = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth <= el.clientWidth + 1;
  });
  expect(ok).toBeTruthy();
}

async function assertTableContainerFitsViewport(page: Page) {
  const ok = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="customers-table-container"]') as HTMLElement | null;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.left >= -1 && r.right <= window.innerWidth + 1;
  });

  expect(ok).toBeTruthy();
}

async function mockCustomersApis(page: Page) {
  const now = new Date().toISOString();
  let created: any = null;

  // UniversalEntityForm schema for customer.
  await page.route(/\/api\/v1\/system\/forms\/schema\/?(\?.*)?$/, async (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fallback();

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'New Customer',
        description: 'E2E schema for mobile Customers create test',
        key_fields: ['name', 'email', 'phone'],
        fields: [
          { key: 'name', label: 'Name', type: 'text', required: true },
          { key: 'email', label: 'Email', type: 'email', required: false },
          { key: 'phone', label: 'Phone', type: 'text', required: false },
        ],
      }),
    });
  });

  // Customers list + create.
  await page.route(/\/api\/v1\/customers\/?(\?.*)?$/, async (route) => {
    const req = route.request();

    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: created ? [created] : [] }),
      });
    }

    if (req.method() === 'POST') {
      const payload = (req.postDataJSON?.() as any) ?? {};
      expect(payload).toMatchObject({ name: 'E2E Customer' });

      created = {
        id: 999,
        name: payload.name,
        contact_person: payload.contact_person ?? '',
        email: payload.email ?? 'e2e@example.com',
        phone: payload.phone ?? '',
        city: payload.city ?? '',
        state: payload.state ?? '',
        created_at: now,
        updated_at: now,
      };

      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
    }

    return route.fallback();
  });

  // Customers page loads products on mount.
  await page.route(/\/api\/v1\/system\/products\/?(\?.*)?$/, async (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fallback();

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [], count: 0 }),
    });
  });

  // Some schema-driven surfaces resolve config keys.
  await page.route(/\/api\/v1\/system\/config\/resolve\/?(\?.*)?$/, async (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fallback();

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ value: null, source: 'default' }),
    });
  });
}

test.describe('Mobile: Customers create is usable at 375px', () => {
  test.use({ viewport: VIEWPORT });

  test('can open create customer form and reach primary CTA (no horizontal overflow)', async ({ page }) => {
    await login(page);
    await mockCustomersApis(page);

    // Auto-open create modal via query param.
    await page.goto('/customers?action=create');

    await expect(page.getByRole('heading', { name: /^Customers$/i })).toBeVisible({ timeout: 15000 });

    const table = page.locator('[data-testid="customers-table-container"]');
    await expect(table).toBeVisible({ timeout: 15000 });

    await assertNoHorizontalOverflow(page);
    await assertTableContainerFitsViewport(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15000 });

    await expect(dialog.locator('input#name')).toBeVisible({ timeout: 15000 });

    await dialog.locator('input#name').fill('E2E Customer');
    await dialog.locator('input#email').fill('e2e@example.com');
    await dialog.locator('input#phone').fill('5551112222');

    const submit = dialog.getByRole('button', { name: /^Create$/ });
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeVisible();
    await expect(submit).toBeInViewport();

    await Promise.all([
      page.waitForResponse((resp) =>
        resp.request().method() === 'POST' &&
        /\/api\/v1\/customers\/?$/.test(new URL(resp.url()).pathname) &&
        resp.status() === 201
      ),
      submit.click(),
    ]);

    await expect(dialog).toBeHidden({ timeout: 10000 });
    await expect(table.getByText('E2E Customer', { exact: true })).toBeVisible({ timeout: 15000 });

    await assertNoHorizontalOverflow(page);
  });
});
