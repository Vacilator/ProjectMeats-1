import { test, expect, type Page } from '@playwright/test';

const VIEWPORT = { width: 375, height: 667 }; // iPhone SE logical size

async function login(page: Page) {
  await page.goto('/');

  const password = page.locator('input[type="password"]');
  if ((await password.count()) === 0) return;

  const testEmail = process.env.TEST_USER_EMAIL || 'admin@meatscentral.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'Admin123!';

  await page.fill('input[type="email"], input[type="text"]', testEmail);
  await page.fill('input[type="password"]', testPassword);
  await page.click('button:has-text("Login"), button:has-text("Sign In")');

  await page.waitForURL(/\/(dashboard|home|workforms)/i, { timeout: 10000 });
}

async function mockInquiriesApis(page: Page) {
  const now = new Date().toISOString();

  // Choices: make required selects deterministic (create modal).
  await page.route(/\/choices\/?(\?.*)?$/, async (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fallback();

    const url = new URL(req.url());
    const choiceType = url.searchParams.get('choice_type');

    const optionsByType: Record<string, Array<{ value: string; label: string }>> = {
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

  // Entities: keep create modal dropdowns stable.
  await page.route(/\/api\/v1\/customers\/?(\?.*)?$/, async (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fallback();

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          {
            id: 1,
            name: 'E2E Customer',
            created_at: now,
            updated_at: now,
          },
        ],
      }),
    });
  });

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

  // Inquiries list.
  await page.route(/\/api\/v1\/inquiries\/?(\?.*)?$/, async (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fallback();

    const results = Array.from({ length: 20 }).map((_, i) => ({
      id: `inq-${i + 1}`,
      inquiry_number: `INQ-${String(i + 1).padStart(4, '0')}`,
      status: 'pending',
      product_count: 3,
      total_desired: 1234.56,
      total_actual: null,
      valid_until: '2030-12-31',
      created_on: '2030-01-01',
      customer_name: 'Acme Foods',
      supplier_name: null,
      contact_name: 'Pat',
      is_expired: false,
    }));

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results, count: 42 }),
    });
  });

  // Inquiry templates (to render the “From Template” action).
  await page.route(/\/api\/v1\/inquiry-templates\/?(\?.*)?$/, async (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fallback();

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [{ id: 'tpl-1', name: 'Weekly Staples', product_count: 12 }],
        count: 1,
      }),
    });
  });
}

async function assertNoPageHorizontalScroll(page: Page) {
  const metrics = await page.evaluate(() => {
    const el = document.documentElement;
    const body = document.body;

    const before = window.scrollX;
    window.scrollTo(9999, window.scrollY);
    const after = window.scrollX;
    window.scrollTo(0, window.scrollY);

    const headerEl = document.querySelector('header');
    const mainEl = document.querySelector('main');
    const mainAreaEl = headerEl?.parentElement;

    const mainAreaStyle = mainAreaEl ? window.getComputedStyle(mainAreaEl) : null;
    const headerStyle = headerEl ? window.getComputedStyle(headerEl) : null;
    const mainStyle = mainEl ? window.getComputedStyle(mainEl) : null;

    const widestBodyChild = Array.from(document.body.children)
      .map((child) => {
        const r = child.getBoundingClientRect();
        return {
          tag: child.tagName.toLowerCase(),
          id: child.id || null,
          class: (child as HTMLElement).className || null,
          width: Math.round(r.width),
        };
      })
      .sort((a, b) => b.width - a.width)[0] ?? null;

    return {
      before,
      after,
      innerWidth: window.innerWidth,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      bodyClientWidth: body.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      htmlOverflowX: window.getComputedStyle(el).overflowX,
      bodyOverflowX: window.getComputedStyle(body).overflowX,
      widestBodyChild,
      headerWidth: headerEl ? Math.round(headerEl.getBoundingClientRect().width) : null,
      headerMaxWidth: headerStyle?.maxWidth ?? null,
      mainWidth: mainEl ? Math.round(mainEl.getBoundingClientRect().width) : null,
      mainMaxWidth: mainStyle?.maxWidth ?? null,
      mainAreaWidth: mainAreaEl ? Math.round(mainAreaEl.getBoundingClientRect().width) : null,
      mainAreaMarginLeft: mainAreaStyle?.marginLeft ?? null,
      mainAreaTransform: mainAreaStyle?.transform ?? null,
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

async function assertTableWrapperFitsViewport(page: Page) {
  const ok = await page.evaluate(() => {
    const wrapper = document.querySelector('[data-testid="inquiries-table-wrapper"]') as HTMLElement | null;
    if (!wrapper) return false;

    const r = wrapper.getBoundingClientRect();
    return r.left >= -1 && r.right <= window.innerWidth + 1;
  });

  expect(ok).toBeTruthy();
}

test.describe('Mobile: Inquiries page usable at 375px', () => {
  test.use({ viewport: VIEWPORT });

  test('no horizontal overflow and create inquiry surface opens', async ({ page }) => {
    await login(page);
    await mockInquiriesApis(page);

    await page.goto('/inquiries');

    await expect(page.getByRole('heading', { name: /Inquiries/i })).toBeVisible({ timeout: 15000 });

    // Usability: page must not scroll horizontally at 375px.
    await assertNoPageHorizontalScroll(page);

    // Header actions should be usable even when templates are present.
    await expect(page.getByRole('button', { name: /From Template/i })).toBeVisible();

    // Table wrapper should fit within viewport at 375px.
    await assertTableWrapperFitsViewport(page);

    const newInquiry = page.getByRole('button', { name: /New Inquiry/i });
    await expect(newInquiry).toBeVisible();
    await expect(newInquiry).toBeInViewport();

    await newInquiry.click();

    // InquiryCreateModal uses a "New Inquiry" title.
    const modalTitle = page.getByRole('heading', { name: 'New Inquiry' });
    await expect(modalTitle).toBeVisible({ timeout: 15000 });

    await assertNoPageHorizontalScroll(page);
  });
});
