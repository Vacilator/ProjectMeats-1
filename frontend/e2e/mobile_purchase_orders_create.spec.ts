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

async function mockPurchaseOrdersApis(page: Page) {
  const now = new Date().toISOString();

  // Choices: make required selects deterministic.
  await page.route(/\/choices\/?(\?.*)?$/, async (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fallback();

    const url = new URL(req.url());
    const choiceType = url.searchParams.get('choice_type');

    const optionsByType: Record<string, Array<{ value: string; label: string }>> = {
      fresh_or_frozen: [
        { value: 'fresh', label: 'Fresh' },
        { value: 'frozen', label: 'Frozen' },
      ],
      package_type: [
        { value: 'bags', label: 'Bags' },
        { value: 'boxes', label: 'Boxes' },
      ],
      weight_unit: [
        { value: 'LBS', label: 'LBS' },
        { value: 'KG', label: 'KG' },
      ],
    };

    const options = (choiceType && optionsByType[choiceType]) || [];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choice_type: choiceType,
        options,
        count: options.length,
      }),
    });
  });

  // Suppliers: ensure required <select name="supplier"> has an option.
  await page.route(/\/api\/v1\/suppliers\/?(\?.*)?$/, async (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fallback();

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          {
            id: 1,
            name: 'E2E Supplier',
            created_at: now,
            updated_at: now,
          },
        ],
      }),
    });
  });

  // Purchase Orders list (initial load + reload after create)
  await page.route(/\/api\/v1\/purchase-orders\/?(\?.*)?$/, async (route) => {
    const req = route.request();

    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [] }),
      });
    }

    if (req.method() === 'POST') {
      const payload = (req.postDataJSON?.() as any) ?? {};

      // Minimal contract assertions: we submitted a real-ish PO payload.
      expect(payload).toMatchObject({
        supplier: 1,
        status: 'pending',
        logistics_scenario: 'supplier_delivery',
      });
      expect(typeof payload.total_amount).toBe('number');

      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 999,
          order_number: '2YY001',
          supplier: 1,
          total_amount: payload.total_amount ?? 1.25,
          status: payload.status ?? 'pending',
          order_date: payload.order_date ?? '2026-01-01',
          created_at: now,
          updated_at: now,
        }),
      });
    }

    return route.fallback();
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const ok = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth <= el.clientWidth + 1;
  });
  expect(ok).toBeTruthy();
}

test.describe('Mobile: Purchase Orders create is usable at 375px', () => {
  test.use({ viewport: VIEWPORT });

  test('can open create PO form and reach primary CTA (no horizontal overflow)', async ({ page }) => {
    await login(page);

    // Mock only the PO-related APIs to keep the test deterministic and non-destructive.
    await mockPurchaseOrdersApis(page);

    // Exercise auto-open create flow via query param.
    await page.goto('/purchase-orders?action=create');

    const modalHeading = page.getByRole('heading', { name: /Add New Purchase Order/i });
    await expect(modalHeading).toBeVisible({ timeout: 15000 });

    // Usability: no horizontal overflow at page level.
    await expectNoHorizontalOverflow(page);

    // Usability: modal/form should not extend beyond viewport horizontally.
    const form = page.locator('form').filter({ hasText: 'Type of Pick Up' }).first();
    await expect(form).toBeVisible();

    const formFitsViewport = await form.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.left >= -1 && r.right <= window.innerWidth + 1;
    });
    expect(formFitsViewport).toBeTruthy();

    // Fill required fields (avoid optional autocomplete inputs).
    await page.selectOption('select[name="supplier"]', { value: '1' });

    await page.selectOption('select[name="fresh_or_frozen"]', { value: 'fresh' });
    await page.selectOption('select[name="package_type"]', { value: 'bags' });

    await page.fill('input[name="quantity"]', '1');
    await page.fill('input[name="price_per_unit"]', '1.25');
    await page.fill('input[name="total_amount"]', '1.25');
    await page.fill('input[name="order_date"]', '2026-01-01');

    const submit = page.getByRole('button', { name: /Create Purchase Order/i });

    // Primary CTA reachable on mobile.
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeVisible();
    await expect(submit).toBeInViewport();

    await Promise.all([
      page.waitForResponse((resp) =>
        resp.request().method() === 'POST' &&
        /\/api\/v1\/purchase-orders\/?$/.test(new URL(resp.url()).pathname) &&
        resp.status() === 201
      ),
      submit.click(),
    ]);

    // Modal should close after successful submit.
    await expect(modalHeading).toBeHidden({ timeout: 10000 });

    // Still no horizontal overflow after closing.
    await expectNoHorizontalOverflow(page);
  });
});
