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
        // UniversalEntityForm intentionally prioritizes HQ key fields for customers/suppliers.
        // Keep this mock aligned with that UX (email is not part of the HQ key-field surface).
        key_fields: ['name', 'phone_office', 'address', 'city', 'state', 'zip_code', 'country'],
        fields: [
          { key: 'name', label: 'Name', type: 'text', required: true },
          { key: 'phone_office', label: 'Phone', type: 'phone', required: false },
          { key: 'address', label: 'Address', type: 'text', required: false },
          { key: 'city', label: 'City', type: 'text', required: false },
          { key: 'state', label: 'State', type: 'text', required: false },
          { key: 'zip_code', label: 'Zip Code', type: 'text', required: false },
          { key: 'country', label: 'Country', type: 'text', required: false },
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
        // Email is optional and not part of the HQ key-field surface.
        email: payload.email ?? '',
        phone_office: payload.phone_office ?? '',
        phone: payload.phone ?? '',
        address: payload.address ?? '',
        city: payload.city ?? '',
        state: payload.state ?? '',
        zip_code: payload.zip_code ?? '',
        country: payload.country ?? '',
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
    await expect(dialog.locator('input#phone_office')).toBeVisible({ timeout: 15000 });

    await dialog.locator('input#name').fill('E2E Customer');

    // UniversalEntityForm customer create intentionally uses HQ key fields.
    // `phone_office` is the most stable customer HQ phone key across environments.
    await dialog.locator('input#phone_office').fill('5551112222');

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
