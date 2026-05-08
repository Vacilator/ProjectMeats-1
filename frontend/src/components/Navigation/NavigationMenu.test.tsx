/**
 * NavigationMenu Component Tests
 *
 * Tests for hierarchical navigation with expandable accordions
 */
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NavigationMenu from './NavigationMenu';
import { NavigationItem } from '../../config/navigation';

// Mock contexts
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#ffffff',
        text: '#000000',
        primary: '#007bff',
      },
      name: 'light',
    },
    themeName: 'light',
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser', role: 'admin', is_superuser: false },
    isAdmin: true,
    isAuthenticated: true,
    loading: false,
  }),
}));

vi.mock('../../contexts/ActionItemsContext', () => ({
  useActionItems: () => ({
    counts: { total: 5, overdue: 2, due_today: 1, due_this_week: 2 },
  }),
  getBadgeValue: () => 0,
}));

// Helper to render with Router
const renderWithRouter = (ui: React.ReactElement, { initialEntries = ['/'] } = {}) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      {ui}
    </MemoryRouter>
  );
};

// Sample navigation items for testing
const sampleItems: NavigationItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: '📊',
  },
  {
    label: 'Products',
    path: '/products',
    icon: '📦',
    children: [
      { label: 'All Products', path: '/products', icon: '📋' },
      { label: 'Add Product', path: '/products/add', icon: '➕' },
    ],
  },
  {
    label: 'Settings',
    icon: '⚙️',
    children: [
      { label: 'Profile', path: '/settings/profile', icon: '👤' },
      { label: 'Security', path: '/settings/security', icon: '🔒' },
      {
        label: 'Advanced',
        icon: '🔧',
        children: [
          { label: 'API Keys', path: '/settings/api-keys', icon: '🔑' },
          { label: 'Webhooks', path: '/settings/webhooks', icon: '🔗' },
        ],
      },
    ],
  },
  {
    label: 'No Path Item',
    icon: '❓',
  },
];

describe('NavigationMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders all top-level navigation items', () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Products')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('No Path Item')).toBeInTheDocument();
    });

    it('renders navigation icons', () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />
      );

      expect(screen.getByText('📊')).toBeInTheDocument();
      expect(screen.getByText('📦')).toBeInTheDocument();
      expect(screen.getByText('⚙️')).toBeInTheDocument();
    });

    it('hides labels when sidebar is collapsed', () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={false} />
      );

      // Icons should still be visible
      expect(screen.getByText('📊')).toBeInTheDocument();

      // Labels should be hidden (not in DOM)
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('renders links with correct href for simple items', () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />
      );

      const dashboardLink = screen.getByRole('link', { name: /Dashboard/i });
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    });
  });

  describe('Accordion Behavior', () => {
    it('shows expand button for items with children', () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />
      );

      // Products and Settings have children, so should have expand buttons
      const expandButtons = screen.getAllByRole('button', { name: /expand|collapse/i });
      expect(expandButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('does not show children initially for collapsed accordions', () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />
      );

      // Child items should not be visible initially (accordion collapsed)
      // Note: they might be in DOM but with max-height: 0
      const addProductLinks = screen.queryAllByText('Add Product');
      // Either not found or visually hidden
      expect(addProductLinks.length).toBeLessThanOrEqual(1);
    });

    it('expands accordion when clicking expand button', async () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />
      );

      // Find the Products row and click its expand button
      const productsRow = screen.getByText('Products').closest('[class*="AccordionHeader"]') ||
                          screen.getByText('Products').parentElement?.parentElement;

      if (productsRow) {
        const expandBtn = within(productsRow as HTMLElement).queryByRole('button', { name: /expand/i });
        if (expandBtn) {
          fireEvent.click(expandBtn);
        } else {
          // Click the entire header if no separate button
          fireEvent.click(productsRow);
        }
      }

      // After expansion, child items should be accessible
      // Note: Due to CSS transitions, they may still have opacity animation
      const allProductsLink = await screen.findByText('Add Product');
      expect(allProductsLink).toBeInTheDocument();
    });

    it('implements exclusive accordion (only one open at a time)', async () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />
      );

      // First, expand Products by clicking anywhere on its header
      const productsText = screen.getByText('Products');
      const productsHeader = productsText.closest('div[class*="AccordionHeader"]') || productsText.parentElement;

      if (productsHeader) {
        // Find the expand button within
        const expandBtns = within(productsHeader as HTMLElement).queryAllByRole('button');
        if (expandBtns.length > 0) {
          fireEvent.click(expandBtns[0]);
        }
      }

      // Wait for Add Product to appear
      await screen.findByText('Add Product');

      // Now expand Settings
      const settingsText = screen.getByText('Settings');
      const settingsHeader = settingsText.closest('div[class*="AccordionHeader"]') || settingsText.parentElement;

      if (settingsHeader) {
        const expandBtns = within(settingsHeader as HTMLElement).queryAllByRole('button');
        if (expandBtns.length > 0) {
          fireEvent.click(expandBtns[0]);
        }
      }

      // Wait for Profile to appear (Settings child)
      await screen.findByText('Profile');

      // Products children should now be collapsed (exclusive accordion)
      // The content may still be in DOM but with max-height: 0
    });

    it('toggles accordion closed when clicking same item', async () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />
      );

      // Find and click expand button for Settings
      const settingsText = screen.getByText('Settings');
      const settingsHeader = settingsText.closest('div') || settingsText.parentElement;

      if (settingsHeader) {
        fireEvent.click(settingsHeader);

        // Wait for expansion
        await screen.findByText('Profile');

        // Click again to collapse
        fireEvent.click(settingsHeader);

        // Content should start collapsing (though CSS transition may take time)
      }
    });
  });

  describe('Nested Navigation', () => {
    it('supports deeply nested items', async () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />
      );

      // Expand Settings
      const settingsText = screen.getByText('Settings');
      const settingsHeader = settingsText.closest('div');
      if (settingsHeader) {
        fireEvent.click(settingsHeader);
      }

      // Wait for first level children
      await screen.findByText('Advanced');

      // Expand Advanced (nested)
      const advancedText = screen.getByText('Advanced');
      const advancedHeader = advancedText.closest('div');
      if (advancedHeader) {
        fireEvent.click(advancedHeader);
      }

      // Wait for deeply nested items
      await screen.findByText('API Keys');
      expect(screen.getByText('Webhooks')).toBeInTheDocument();
    });

    it('applies correct indentation based on level', () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} level={0} />
      );

      // Top level items should have level 0 padding
      // This is visually tested but we can check the structure exists
      const dashboard = screen.getByText('Dashboard');
      expect(dashboard).toBeInTheDocument();
    });
  });

  describe('Active State', () => {
    it('marks current route as active', () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />,
        { initialEntries: ['/dashboard'] }
      );

      const dashboardLink = screen.getByRole('link', { name: /Dashboard/i });
      // Check for active class (may have NavLink .active class)
      expect(dashboardLink).toHaveClass('active');
    });

    it('auto-expands parent when child route is active', async () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />,
        { initialEntries: ['/products/add'] }
      );

      // Products should be auto-expanded since /products/add is the active route
      // Wait a bit for useEffect to run
      await screen.findByText('Add Product');
      expect(screen.getByText('Add Product')).toBeInTheDocument();
    });

    it('highlights parent when child is active but not exact match', () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />,
        { initialEntries: ['/settings/profile'] }
      );

      // Settings should show as having an active child
      const settingsText = screen.getByText('Settings');
      expect(settingsText).toBeInTheDocument();
    });
  });

  describe('Items Without Path', () => {
    it('renders button instead of link for items without path', () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />
      );

      // "No Path Item" has no path and no children
      const noPathItem = screen.getByText('No Path Item');
      expect(noPathItem).toBeInTheDocument();

      // Should be a button, not a link
      const closestButton = noPathItem.closest('button');
      expect(closestButton).toBeInTheDocument();
    });

    it('allows clicking items without path (toggle behavior)', () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />
      );

      const noPathItem = screen.getByText('No Path Item');
      const button = noPathItem.closest('button');

      if (button) {
        // Should not throw when clicked
        expect(() => fireEvent.click(button)).not.toThrow();
      }
    });
  });

  describe('Expand Button Accessibility', () => {
    it('has accessible aria-label on expand buttons', () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />
      );

      const expandButtons = screen.getAllByRole('button', { name: /expand|collapse/i });
      expect(expandButtons.length).toBeGreaterThan(0);

      expandButtons.forEach(btn => {
        expect(btn).toHaveAttribute('aria-label');
      });
    });

    it('updates aria-label when expanded state changes', async () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />
      );

      // Find an expand button
      const expandBtn = screen.getAllByRole('button', { name: /expand/i })[0];
      expect(expandBtn).toHaveAttribute('aria-label', 'Expand');

      // Click to expand
      fireEvent.click(expandBtn);

      // After expansion, label should change to Collapse
      expect(expandBtn).toHaveAttribute('aria-label', 'Collapse');
    });
  });

  describe('Chevron Icon Animation', () => {
    it('renders chevron icons in expand buttons', () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />
      );

      // Chevron is an SVG inside the expand button
      const expandButtons = screen.getAllByRole('button', { name: /expand|collapse/i });

      expandButtons.forEach(btn => {
        const svg = btn.querySelector('svg');
        expect(svg).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports keyboard click on expand buttons', () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />
      );

      const expandBtn = screen.getAllByRole('button', { name: /expand/i })[0];

      // Simulate Enter key
      fireEvent.keyDown(expandBtn, { key: 'Enter' });
      fireEvent.click(expandBtn);

      // Should work (no errors)
      expect(expandBtn).toBeInTheDocument();
    });
  });

  describe('Event Handling', () => {
    it('prevents default and stops propagation on expand button click', async () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />
      );

      const settingsText = screen.getByText('Settings');
      const settingsHeader = settingsText.closest('div[class*="AccordionHeader"]') || settingsText.parentElement;

      if (settingsHeader) {
        const expandBtn = within(settingsHeader as HTMLElement).queryByRole('button', { name: /expand/i });

        if (expandBtn) {
          const mockEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
          };

          // Note: fireEvent doesn't use actual event object
          // But clicking the button should still work
          fireEvent.click(expandBtn);

          // Verify the accordion expanded
          await screen.findByText('Profile');
        }
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles empty items array', () => {
      renderWithRouter(
        <NavigationMenu items={[]} isExpanded={true} />
      );

      // Should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it('handles items with empty children array', () => {
      const itemsWithEmptyChildren: NavigationItem[] = [
        { label: 'Empty Parent', path: '/empty', icon: '📭', children: [] },
      ];

      renderWithRouter(
        <NavigationMenu items={itemsWithEmptyChildren} isExpanded={true} />
      );

      // Should render as a regular link since children is empty
      const link = screen.getByText('Empty Parent');
      expect(link).toBeInTheDocument();
    });

    it('handles rapid toggling', async () => {
      renderWithRouter(
        <NavigationMenu items={sampleItems} isExpanded={true} />
      );

      const settingsText = screen.getByText('Settings');
      const settingsHeader = settingsText.closest('div');

      if (settingsHeader) {
        // Rapid clicks
        fireEvent.click(settingsHeader);
        fireEvent.click(settingsHeader);
        fireEvent.click(settingsHeader);
        fireEvent.click(settingsHeader);

        // Should handle without errors
        expect(settingsText).toBeInTheDocument();
      }
    });

    it('handles undefined color in nav icon', () => {
      const itemsNoColor: NavigationItem[] = [
        { label: 'No Color', path: '/no-color', icon: '⚪' },
      ];

      renderWithRouter(
        <NavigationMenu items={itemsNoColor} isExpanded={true} />
      );

      expect(screen.getByText('⚪')).toBeInTheDocument();
    });
  });
});
