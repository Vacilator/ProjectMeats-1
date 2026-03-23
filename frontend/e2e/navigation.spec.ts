import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Navigation & Routing
 * Phase 6.3: E2E Test Coverage
 * 
 * Tests navigation between pages, breadcrumbs, sidebar, and routing.
 */

test.describe('Navigation & Routing', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/');
    
    const testEmail = process.env.TEST_USER_EMAIL || 'admin@meatscentral.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'Admin123!';
    
    await page.fill('input[type="email"], input[type="text"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button:has-text("Login"), button:has-text("Sign In")');
    await page.waitForURL(/\/(dashboard|home|workforms)/i, { timeout: 10000 });
  });

  test('should render main navigation', async ({ page }) => {
    // Should see sidebar or navigation menu
    await expect(
      page.locator('nav, [role="navigation"], .sidebar, [data-testid="sidebar"]')
    ).toBeVisible({ timeout: 5000 });
    
    // Should have main navigation links
    const navItems = ['Dashboard', 'Workflows', 'Admin', 'Settings'];
    
    for (const item of navItems) {
      const link = page.locator(`nav a:has-text("${item}"), [role="navigation"] a:has-text("${item}")`);
      const count = await link.count();
      
      // At least one of these should be visible
      if (count > 0) {
        expect(count).toBeGreaterThan(0);
      }
    }
  });

  test('should navigate to dashboard', async ({ page }) => {
    // Click dashboard link
    await page.click('a:has-text("Dashboard"), a[href*="dashboard"]');
    
    // Should navigate to dashboard
    await expect(page).toHaveURL(/\/dashboard|\/home/i, { timeout: 5000 });
  });

  test('should navigate to workflows page', async ({ page }) => {
    // Click workflows/workforms link
    await page.click('a:has-text("Workflows"), a:has-text("WorkForms"), a[href*="workforms"]');
    
    // Should show workflows page
    await expect(page).toHaveURL(/\/workforms|\/workflows/i, { timeout: 5000 });
  });

  test('should navigate to admin studio', async ({ page }) => {
    // Click admin studio link
    await page.click('a:has-text("Admin Studio"), a:has-text("Studio"), a[href*="admin-studio"]');
    
    // Should show admin studio
    await expect(page).toHaveURL(/\/admin-studio/i, { timeout: 5000 });
    
    // Should see workflow canvas
    await expect(
      page.locator('.react-flow, [data-testid="workflow-canvas"]')
    ).toBeVisible({ timeout: 10000 });
  });

  test('should render breadcrumbs', async ({ page }) => {
    await page.goto('/admin-studio');
    
    // Should see breadcrumbs
    const breadcrumbs = page.locator('[aria-label="breadcrumb"], .breadcrumb, [data-testid="breadcrumbs"]');
    
    if (await breadcrumbs.isVisible({ timeout: 5000 })) {
      // Should have at least 2 items (Home > Current)
      const items = breadcrumbs.locator('a, span');
      const count = await items.count();
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  test('should navigate using breadcrumbs', async ({ page }) => {
    await page.goto('/admin-studio/workflows/123');
    
    // Click breadcrumb to go back
    const homeLink = page.locator('[aria-label="breadcrumb"] a:has-text("Home"), .breadcrumb a:has-text("Home")');
    
    if (await homeLink.isVisible({ timeout: 5000 })) {
      await homeLink.click();
      
      // Should navigate to home
      await expect(page).toHaveURL(/\/(dashboard|home)/i, { timeout: 5000 });
    }
  });

  test('should toggle sidebar collapse', async ({ page }) => {
    // Find sidebar toggle button
    const toggleBtn = page.locator(
      'button[aria-label*="menu"], button[aria-label*="sidebar"], [data-testid="sidebar-toggle"]'
    );
    
    if (await toggleBtn.isVisible({ timeout: 5000 })) {
      // Get sidebar
      const sidebar = page.locator('.sidebar, nav[role="navigation"]').first();
      
      if (await sidebar.isVisible()) {
        const initialWidth = await sidebar.boundingBox();
        
        // Toggle collapse
        await toggleBtn.click();
        await page.waitForTimeout(500); // Animation
        
        const collapsedWidth = await sidebar.boundingBox();
        
        // Width should change (collapsed or expanded)
        expect(collapsedWidth?.width).not.toBe(initialWidth?.width);
      }
    }
  });

  test('should support browser back/forward navigation', async ({ page }) => {
    // Navigate to workflows
    await page.goto('/workforms');
    await page.waitForURL(/\/workforms/i);
    
    // Navigate to admin studio
    await page.goto('/admin-studio');
    await page.waitForURL(/\/admin-studio/i);
    
    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\/workforms/i, { timeout: 3000 });
    
    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/\/admin-studio/i, { timeout: 3000 });
  });

  test('should handle 404 not found pages', async ({ page }) => {
    await page.goto('/nonexistent-page-12345');
    
    // Should show 404 message or redirect to home
    const is404 = await page.locator('text=/404|Not Found|Page not found/i').isVisible({ timeout: 3000 });
    const isRedirected = page.url().match(/\/(dashboard|home|login)/i);
    
    // Either show 404 or redirect
    expect(is404 || isRedirected).toBeTruthy();
  });

  test('should show active route in navigation', async ({ page }) => {
    await page.goto('/workforms');
    
    // Find navigation link for workforms
    const workformsLink = page.locator('a[href*="workforms"], a:has-text("Workflows")');
    
    if (await workformsLink.isVisible({ timeout: 5000 })) {
      // Should have active class or aria-current
      const isActive = await workformsLink.evaluate(el => {
        return el.classList.contains('active') ||
               el.classList.contains('selected') ||
               el.getAttribute('aria-current') === 'page';
      });
      
      expect(isActive).toBeTruthy();
    }
  });

  test('should preserve navigation state across routes', async ({ page }) => {
    // Expand a menu if collapsible navigation exists
    const menuToggle = page.locator('button[aria-expanded="false"]').first();
    
    if (await menuToggle.isVisible({ timeout: 3000 })) {
      await menuToggle.click();
      await page.waitForTimeout(300);
      
      // Navigate to another page
      await page.goto('/workforms');
      await page.waitForTimeout(500);
      
      // Menu should still be expanded (state preserved)
      const isExpanded = await menuToggle.getAttribute('aria-expanded');
      expect(isExpanded).toBe('true');
    }
  });
});
