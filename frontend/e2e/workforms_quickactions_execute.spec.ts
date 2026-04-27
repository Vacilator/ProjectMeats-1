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

test.describe('WorkForms Quick Actions', () => {
  test('execute a WorkForm from header Quick Actions menu (Published WorkForms)', async ({ page, request }) => {
    await loginViaUI(page);

    const headers = await getAuthHeadersFromBrowser(page);

    const runId = String(Date.now());
    const workformName = `E2E QuickActions WorkForm ${runId}`;

    // Create an ACTIVE WorkForm so it appears in available-forms published WorkForms.
    const createRes = await request.post('/api/v1/tenant-workforms/', {
      headers,
      data: {
        name: workformName,
        description: 'Playwright-created workform for header Quick Actions execution',
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
              id: 'node-end',
              type: 'endSuccess',
              position: { x: 100, y: 220 },
              data: { label: 'Done', config: {} },
            },
          ],
          edges: [{ id: 'e1', source: 'node-start', target: 'node-end' }],
        },
      },
    });

    expect(createRes.ok(), `WorkForm create failed: ${createRes.status()}`).toBeTruthy();
    const created: any = await createRes.json();
    const workformId = String(created?.id || '');
    expect(workformId).not.toEqual('');

    // Load a page with the header and open the Quick Actions menu.
    await page.goto('/dashboard');

    const quickActionsBtn = page.getByRole('button', { name: /quick actions menu/i });
    await expect(quickActionsBtn).toBeVisible();
    await quickActionsBtn.click();

    // Open the Forms & WorkForms submenu.
    await page.getByRole('button', { name: /forms\s*&\s*workforms/i }).click();

    // Click the created workform.
    await page.getByRole('button', { name: new RegExp(workformName) }).click();

    // Execute page should redirect to execution details.
    await page.waitForURL(/\/workforms\/(execute|executions)\//, { timeout: 15000 });

    if (/\/workforms\/execute\//.test(page.url())) {
      await page.waitForURL(/\/workforms\/executions\//, { timeout: 15000 });
    }

    const executionId = page.url().split('/').pop() || '';
    expect(executionId).not.toEqual('');

    await expect(page.getByTestId('workform-execution-details-page')).toBeVisible({ timeout: 15000 });

    // Deterministic: poll API to terminal state.
    const finalStatus = await expect.poll(
      async () => {
        const res = await request.get(`/api/v1/workflows/workform-executions/${executionId}/`, { headers });
        if (!res.ok()) return `http_${res.status()}`;
        const body: any = await res.json();
        return String(body?.status || 'unknown');
      },
      { timeout: 25000, intervals: [500, 1000, 2000] }
    );

    expect(['completed', 'failed', 'cancelled']).toContain(finalStatus);
  });
});
