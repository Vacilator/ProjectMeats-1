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
  const ok = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth <= el.clientWidth + 1;
  });

  if (!ok) {
    const details = await page.evaluate(() => {
      const el = document.documentElement;
      return {
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
      };
    });

    const offenders = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      return Array.from(document.querySelectorAll<HTMLElement>('*'))
        .map((el) => {
          const r = el.getBoundingClientRect();
          const cs = window.getComputedStyle(el);
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) || undefined;

          return {
            tag: el.tagName.toLowerCase(),
            id: el.id || undefined,
            class: el.className || undefined,
            testid: el.getAttribute('data-testid') || undefined,
            position: cs.position,
            left: Math.round(r.left),
            right: Math.round(r.right),
            width: Math.round(r.width),
            text,
          };
        })
        .filter((x) => x.right > vw + 1 && x.width > 0)
        .sort((a, b) => b.right - a.right)
        .slice(0, 10);
    });

    throw new Error(
      `Page has horizontal overflow at 375px. ${JSON.stringify({ details, offenders }, null, 2)}`
    );
  }

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

  // Customers list (initial load + reload after create)
  await page.route(/\/api\/v1\/customers\/?(\?.*)?$/, async (route) => {
    const req = route.request();

    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: created ? [created] : [] }),
      });
    }

    return route.fallback();
  });

  // Quick-create (used by Customers ?action=create)
  await page.route(/\/api\/v1\/workflows\/quick-create\/customer\/?(\?.*)?$/, async (route) => {
    const req = route.request();

    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          entity_type: 'customer',
          entity_label: 'Customer',
          fields: [
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'email', label: 'Email', type: 'email', required: false },
            { key: 'phone', label: 'Phone', type: 'text', required: false },
          ],
        }),
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
        body: JSON.stringify({
          success: true,
          id: '999',
          value: '999',
          label: created.name,
          entity_type: 'customer',
        }),
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

}

test.describe('Mobile: Customers create is usable at 375px', () => {
  test.use({ viewport: VIEWPORT });

  test('can open create customer form and reach primary CTA (no horizontal overflow)', async ({ page }) => {
    await login(page);
    await mockCustomersApis(page);

    // Auto-open create modal via query param.
    await page.goto('/customers?action=create');

    const table = page.locator('[data-testid="customers-table-container"]');
    await expect(table).toBeVisible({ timeout: 15000 });

    // Usability: no horizontal overflow at page level.
    await assertNoPageHorizontalScroll(page);

    // Usability: customers table container should fit viewport.
    await assertTableContainerFitsViewport(page);

    const modalHeading = page.getByRole('heading', { name: /Create New Customer/i });
    await expect(modalHeading).toBeVisible({ timeout: 15000 });

    await expect(page.locator('input#quick-create-name')).toBeVisible({ timeout: 15000 });

    await page.locator('input#quick-create-name').fill('E2E Customer');
    await page.locator('input#quick-create-email').fill('e2e@example.com');
    await page.locator('input#quick-create-phone').fill('5551112222');

    const submit = page.getByRole('button', { name: /Create Customer/i });

    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeVisible();
    await expect(submit).toBeInViewport();

    await Promise.all([
      page.waitForResponse((resp) =>
        resp.request().method() === 'POST' &&
        /\/api\/v1\/workflows\/quick-create\/customer\/?$/.test(new URL(resp.url()).pathname) &&
        resp.status() === 201
      ),
      submit.click(),
    ]);

    await expect(modalHeading).toBeHidden({ timeout: 10000 });

    // Created row shows up.
    await expect(table.getByText('E2E Customer', { exact: true })).toBeVisible({ timeout: 15000 });

    await assertNoPageHorizontalScroll(page);
  });
});
