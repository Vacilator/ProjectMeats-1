import { test, expect } from '@playwright/test';

const loginViaUI = async (page: any) => {
  await page.goto('/');

  const testEmail = process.env.TEST_USER_EMAIL || 'admin@meatscentral.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'Admin123!';

  await page.fill('input[type="email"], input[type="text"]', testEmail);
  await page.fill('input[type="password"]', testPassword);
  await page.click('button:has-text("Login"), button:has-text("Sign In")');
  await page.waitForURL(/\/(dashboard|home|workforms)/i, { timeout: 10000 });
};

const getAuthHeadersFromBrowser = async (page: any) => {
  const { token, scheme, tenantId } = await page.evaluate(() => {
    const accessToken = localStorage.getItem('accessToken');
    const legacyToken = localStorage.getItem('authToken');
    const tenantId = localStorage.getItem('tenantId');

    if (accessToken) {
      return { token: accessToken, scheme: 'Bearer', tenantId };
    }

    return { token: legacyToken, scheme: 'Token', tenantId };
  });

  expect(tenantId, 'tenantId must be present after login').toBeTruthy();
  expect(token, 'auth token must be present after login').toBeTruthy();

  return {
    Authorization: `${scheme} ${token}`,
    'X-Tenant-ID': tenantId,
  } as Record<string, string>;
};

test.describe('WorkForms E2E smoke', () => {
  test('execute WorkForm and create notification', async ({ page, request }) => {
    await loginViaUI(page);

    const headers = await getAuthHeadersFromBrowser(page);

    // Baseline notifications state (best-effort)
    await request.post('/api/v1/workflows/notifications/mark-all-read/', { headers });

    const runId = String(Date.now());
    const workformName = `E2E Smoke WorkForm ${runId}`;
    const notificationTitle = `E2E Smoke Notification ${runId}`;

    const createRes = await request.post('/api/v1/tenant-workforms/', {
      headers,
      data: {
        name: workformName,
        description: 'Playwright-created smoke workform',
        status: 'active',
        workflow_definition: {
          nodes: [
            {
              id: 'node-start',
              type: 'triggerManual',
              position: { x: 100, y: 100 },
              data: { label: 'Manual Trigger', config: {} },
            },
            {
              id: 'node-notify',
              type: 'actionNotify',
              position: { x: 100, y: 220 },
              data: {
                label: 'Notify',
                config: {
                  title: notificationTitle,
                  message: 'Smoke test notification from Playwright',
                },
              },
            },
            {
              id: 'node-end',
              type: 'endSuccess',
              position: { x: 100, y: 340 },
              data: { label: 'Done', config: {} },
            },
          ],
          edges: [
            { id: 'e1', source: 'node-start', target: 'node-notify' },
            { id: 'e2', source: 'node-notify', target: 'node-end' },
          ],
        },
      },
    });

    expect(createRes.ok(), `WorkForm create failed: ${createRes.status()}`).toBeTruthy();
    const createdWorkform = await createRes.json();
    const workformId = String(createdWorkform?.id || '');
    expect(workformId).not.toEqual('');

    // Prove Catalog renders and the workform is discoverable
    await page.goto('/workforms/catalog');
    await expect(page.getByTestId('workforms-catalog-page')).toBeVisible();

    await page.getByTestId('workforms-catalog-search').fill(runId);

    const item = page.locator(`[data-testid="workforms-catalog-item"][data-item-id="${workformId}"]`);
    await expect(item).toBeVisible({ timeout: 10000 });

    await item.getByTestId('workforms-catalog-item-execute').click();

    await page.waitForURL(/\/workforms\/executions\//, { timeout: 15000 });
    const executionId = page.url().split('/').pop() || '';
    expect(executionId).not.toEqual('');

    await expect(page.getByTestId('workform-execution-details-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('workform-execution-current-step')).toBeVisible();

    // Poll execution to terminal via API for determinism
    const finalStatus = await expect.poll(
      async () => {
        const res = await request.get(`/api/v1/workflows/workform-executions/${executionId}/`, { headers });
        if (!res.ok()) return `http_${res.status()}`;
        const body: any = await res.json();
        return String(body?.status || 'unknown');
      },
      {
        timeout: 25000,
        intervals: [500, 1000, 2000],
      }
    );

    expect(['completed', 'failed', 'cancelled']).toContain(finalStatus);

    // UI should reflect terminal state (query polling should get it without reload, but reload is safe)
    await page.reload();
    await expect(page.getByTestId('workform-execution-status')).toHaveText(new RegExp(finalStatus, 'i'));

    // Verify notification side-effect exists (API deterministic)
    const hasNotification = await expect.poll(
      async () => {
        const res = await request.get('/api/v1/workflows/notifications/', { headers });
        if (!res.ok()) return false;
        const body: any = await res.json();
        const rows = Array.isArray(body) ? body : Array.isArray(body?.results) ? body.results : [];
        return rows.some((n: any) => String(n?.title || '') === notificationTitle);
      },
      { timeout: 15000, intervals: [500, 1000, 2000] }
    );

    expect(hasNotification).toBeTruthy();

    // Optional UI proof: open notifications panel and find the title
    await page.getByTestId('notification-bell-button').click();
    const panel = page.getByTestId('notification-panel');
    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(panel.getByText(notificationTitle)).toBeVisible({ timeout: 10000 });
  });
});
