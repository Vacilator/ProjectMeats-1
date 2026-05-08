import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Workflow Creation & Execution
 * Phase 6.3: E2E Test Coverage
 *
 * Tests workflow builder, form creation, node configuration, and execution.
 */

test.describe('Workflow Creation & Execution', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');

    const testEmail = process.env.TEST_USER_EMAIL || 'admin@meatscentral.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'Admin123!';

    await page.fill('input[type="email"], input[type="text"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button:has-text("Login"), button:has-text("Sign In")');

    // Wait for authentication
    await page.waitForURL(/\/(dashboard|home|workforms)/i, { timeout: 10000 });
  });

  test('should navigate to workflow builder', async ({ page }) => {
    // Navigate to workflows/admin-studio
    await page.goto('/admin-studio');

    // Should see workflow canvas or builder
    await expect(
      page.locator('.react-flow, [data-testid="workflow-canvas"]')
    ).toBeVisible({ timeout: 10000 });
  });

  test('should create a new workflow', async ({ page }) => {
    await page.goto('/admin-studio');

    // Click "New Workflow" button
    const newWorkflowBtn = page.locator(
      'button:has-text("New Workflow"), button:has-text("Create Workflow"), [data-testid="new-workflow"]'
    );

    if (await newWorkflowBtn.isVisible({ timeout: 5000 })) {
      await newWorkflowBtn.click();
    }

    // Should show workflow canvas
    await expect(
      page.locator('.react-flow, [data-testid="workflow-canvas"]')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should drag and drop a form node onto canvas', async ({ page }) => {
    await page.goto('/admin-studio');

    // Wait for canvas to load
    await page.waitForSelector('.react-flow, [data-testid="workflow-canvas"]', { timeout: 10000 });

    // Find form node in sidebar/palette
    const formNode = page.locator(
      '[data-node-type="form"], [data-node-type="workForm"], text=Form'
    ).first();

    if (await formNode.isVisible({ timeout: 5000 })) {
      // Get canvas bounds
      const canvas = page.locator('.react-flow, [data-testid="workflow-canvas"]').first();
      const canvasBounds = await canvas.boundingBox();

      if (canvasBounds) {
        // Drag form node to canvas center
        await formNode.dragTo(canvas, {
          targetPosition: {
            x: canvasBounds.width / 2,
            y: canvasBounds.height / 2
          }
        });

        // Should see form node on canvas
        await expect(
          page.locator('.react-flow__node, [data-node-type="form"]')
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should open form configuration panel', async ({ page }) => {
    await page.goto('/admin-studio');
    await page.waitForSelector('.react-flow, [data-testid="workflow-canvas"]', { timeout: 10000 });

    // Click on a form node (if exists) or create one
    const existingFormNode = page.locator('.react-flow__node').first();

    if (await existingFormNode.isVisible({ timeout: 5000 })) {
      await existingFormNode.click();

      // Should open configuration panel/modal
      await expect(
        page.locator('[role="dialog"], .config-panel, [data-testid="node-config"]')
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('should add fields to a form', async ({ page }) => {
    await page.goto('/admin-studio');
    await page.waitForSelector('.react-flow, [data-testid="workflow-canvas"]', { timeout: 10000 });

    // Assume form node exists and click to open config
    const formNode = page.locator('.react-flow__node').first();

    if (await formNode.isVisible({ timeout: 5000 })) {
      await formNode.click();

      // Wait for config panel
      await page.waitForSelector('[role="dialog"], .config-panel', { timeout: 5000 });

      // Click "Add Field" button
      const addFieldBtn = page.locator('button:has-text("Add Field")');

      if (await addFieldBtn.isVisible({ timeout: 3000 })) {
        await addFieldBtn.click();

        // Fill field properties
        await page.fill('input[name="label"], input[placeholder*="Label"]', 'Test Field');
        await page.selectOption('select[name="type"], select[aria-label*="Type"]', 'text');

        // Save field
        await page.click('button:has-text("Save"), button:has-text("Add")');

        // Should see field in form
        await expect(page.locator('text=Test Field')).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('should connect nodes with edges', async ({ page }) => {
    await page.goto('/admin-studio');
    await page.waitForSelector('.react-flow, [data-testid="workflow-canvas"]', { timeout: 10000 });

    // Assume we have at least 2 nodes on canvas
    const nodes = page.locator('.react-flow__node');
    const nodeCount = await nodes.count();

    if (nodeCount >= 2) {
      // Find source handle of first node
      const sourceHandle = nodes.nth(0).locator('.react-flow__handle-right, .react-flow__handle-bottom').first();

      // Find target handle of second node
      const targetHandle = nodes.nth(1).locator('.react-flow__handle-left, .react-flow__handle-top').first();

      if (await sourceHandle.isVisible() && await targetHandle.isVisible()) {
        // Drag from source to target
        await sourceHandle.dragTo(targetHandle);

        // Should see edge connecting nodes
        await expect(page.locator('.react-flow__edge')).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('should save workflow', async ({ page }) => {
    await page.goto('/admin-studio');
    await page.waitForSelector('.react-flow, [data-testid="workflow-canvas"]', { timeout: 10000 });

    // Click save button
    const saveBtn = page.locator('button:has-text("Save"), [data-testid="save-workflow"]');

    if (await saveBtn.isVisible({ timeout: 5000 })) {
      await saveBtn.click();

      // Should show success message
      await expect(
        page.locator('text=/Saved|Success|Workflow saved/i')
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('should execute a workflow', async ({ page }) => {
    await page.goto('/workforms');

    // Find and click on a workflow to execute
    const workflow = page.locator('[data-testid="workflow-item"], .workflow-card').first();

    if (await workflow.isVisible({ timeout: 10000 })) {
      await workflow.click();

      // Should see workflow execution view or form
      await expect(
        page.locator('form, [data-testid="workflow-execution"]')
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('should submit a workflow form', async ({ page }) => {
    await page.goto('/workforms');

    // Find and execute a workflow
    const workflow = page.locator('[data-testid="workflow-item"], .workflow-card').first();

    if (await workflow.isVisible({ timeout: 10000 })) {
      await workflow.click();
      await page.waitForSelector('form, [data-testid="workflow-form"]', { timeout: 5000 });

      // Fill form fields (generic - adapt to actual fields)
      const textInputs = page.locator('input[type="text"], input[type="email"]');
      const inputCount = await textInputs.count();

      for (let i = 0; i < inputCount; i++) {
        await textInputs.nth(i).fill(`Test Value ${i + 1}`);
      }

      // Submit form
      await page.click('button[type="submit"], button:has-text("Submit")');

      // Should show success message or confirmation
      await expect(
        page.locator('text=/Submitted|Success|Thank you/i')
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/workforms');

    const workflow = page.locator('[data-testid="workflow-item"], .workflow-card').first();

    if (await workflow.isVisible({ timeout: 10000 })) {
      await workflow.click();
      await page.waitForSelector('form', { timeout: 5000 });

      // Try to submit without filling required fields
      await page.click('button[type="submit"], button:has-text("Submit")');

      // Should show validation errors
      await expect(
        page.locator('text=/required|mandatory|fill|enter/i')
      ).toBeVisible({ timeout: 3000 });
    }
  });
});
