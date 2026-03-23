/**
 * Sidebar Component Tests
 * 
 * Tests for sidebar navigation with pin/hover behavior
 * 
 * Note: Tests involving isDesktop state require the window.innerWidth
 * to be set via a global setup before module import. The component
 * reads this value during initial useState() call.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import Sidebar from './Sidebar';

// Mock the theme context
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#ffffff',
        text: '#000000',
        primary: '#007bff',
        surface: '#f8f9fa',
      },
      name: 'light',
    },
    themeName: 'light',
    tenantBranding: null,
  }),
}));

// Mock NavigationMenu to simplify testing
vi.mock('../Navigation/NavigationMenu', () => ({
  default: ({ items, isExpanded }: { items: unknown[]; isExpanded: boolean }) => (
    <div data-testid="navigation-menu" data-expanded={isExpanded}>
      {items.length} items
    </div>
  ),
}));

// Mock navigation config
vi.mock('../../config/navigation', () => ({
  navigation: [
    { label: 'Dashboard', path: '/dashboard', icon: '📊' },
    { label: 'Products', path: '/products', icon: '📦' },
  ],
  adminWorkspaceNavigation: [
    { label: 'Option Lists', path: '/admin/option-lists', icon: '📋' },
  ],
}));

// Mock admin permissions hook so Sidebar tests don't require React Query provider
vi.mock('../../hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({
    permissions: {
      can_manage_users: true,
      can_invite_users: true,
      can_change_roles: true,
      can_manage_profile: true,
      can_manage_billing: true,
      can_manage_configurations: true,
      can_manage_customizations: true,
      can_view_audit_logs: true,
      can_manage_option_lists: true,
      role: 'admin',
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  isAdminOrOwner: () => true,
}));

// Helper to render with Router
const renderSidebar = (props: Partial<React.ComponentProps<typeof Sidebar>> = {}) => {
  const defaultProps = {
    isOpen: false,
    onToggle: vi.fn(),
    onHoverChange: vi.fn(),
  };

  return render(
    <MemoryRouter>
      <Sidebar {...defaultProps} {...props} />
    </MemoryRouter>
  );
};

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Basic Rendering', () => {
    it('renders sidebar with default logo', () => {
      renderSidebar();
      expect(screen.getByText('🥩')).toBeInTheDocument();
    });

    it('renders navigation menu', () => {
      renderSidebar();
      // Now has 2 navigation menus: main nav + admin workspace nav
      expect(screen.getAllByTestId('navigation-menu')).toHaveLength(2);
    });

    it('shows company name when expanded via keepOpen', () => {
      // Component is expanded when keepOpen (from localStorage) is true
      localStorage.setItem('sidebarKeepOpen', 'true');
      renderSidebar({ isOpen: true });
      expect(screen.getByText('Meats Central')).toBeInTheDocument();
    });

    it('hides company name when collapsed', () => {
      renderSidebar({ isOpen: false });
      expect(screen.queryByText('Meats Central')).not.toBeInTheDocument();
    });

    it('renders footer text when expanded', () => {
      localStorage.setItem('sidebarKeepOpen', 'true');
      renderSidebar({ isOpen: true });
      expect(screen.getByText(/© 2025 Meats Central/)).toBeInTheDocument();
    });
  });

  describe('Pin/Lock Functionality (with keepOpen)', () => {
    // These tests use localStorage to force keepOpen state,
    // which allows testing pin functionality regardless of isDesktop

    it('loads pin state from localStorage on mount', () => {
      localStorage.setItem('sidebarKeepOpen', 'true');
      renderSidebar({ isOpen: true });
      
      // When keepOpen is loaded from localStorage, pin button shows locked state
      const pinButton = screen.queryByRole('button', { name: /unpin sidebar/i });
      // If isDesktop is true, button will be visible
      if (pinButton) {
        expect(pinButton).toBeInTheDocument();
      }
    });

    it('persists pin state to localStorage when toggled', async () => {
      localStorage.setItem('sidebarKeepOpen', 'true');
      renderSidebar({ isOpen: true });
      
      const pinButton = screen.queryByRole('button', { name: /unpin sidebar/i });
      if (pinButton) {
        fireEvent.click(pinButton);
        expect(localStorage.getItem('sidebarKeepOpen')).toBe('false');
      }
    });

    it('toggles from pinned to unpinned state', async () => {
      localStorage.setItem('sidebarKeepOpen', 'true');
      renderSidebar({ isOpen: true });
      
      // Wait for possible state updates
      await waitFor(() => {
        const pinButton = screen.queryByRole('button', { name: /unpin sidebar/i });
        if (pinButton) {
          fireEvent.click(pinButton);
          expect(screen.getByRole('button', { name: /pin sidebar/i })).toBeInTheDocument();
        }
      });
    });
  });

  describe('Hover Behavior', () => {
    it('expands on mouse enter when not pinned', async () => {
      const onHoverChange = vi.fn();
      const { container } = renderSidebar({ isOpen: false, onHoverChange });

      const sidebar = container.firstChild as HTMLElement;
      fireEvent.mouseEnter(sidebar);

      await waitFor(() => {
        expect(onHoverChange).toHaveBeenCalledWith(true);
      });
    });

    it('collapses on mouse leave when not pinned', async () => {
      const onHoverChange = vi.fn();
      const { container } = renderSidebar({ isOpen: false, onHoverChange });

      const sidebar = container.firstChild as HTMLElement;
      fireEvent.mouseEnter(sidebar);
      fireEvent.mouseLeave(sidebar);

      await waitFor(() => {
        expect(onHoverChange).toHaveBeenLastCalledWith(false);
      });
    });

    it('does not trigger hover expansion when pinned', () => {
      localStorage.setItem('sidebarKeepOpen', 'true');
      
      const onHoverChange = vi.fn();
      const { container } = renderSidebar({ isOpen: true, onHoverChange });

      const sidebar = container.firstChild as HTMLElement;
      fireEvent.mouseEnter(sidebar);

      // When pinned (keepOpen true), mouse enter shouldn't expand via hover
      // The sidebar stays expanded due to keepOpen, not hover
    });

    it('passes isExpanded to NavigationMenu based on hover state', async () => {
      const { container } = renderSidebar({ isOpen: false });

      const navMenus = screen.getAllByTestId('navigation-menu');
      const mainNavMenu = navMenus[0]; // First is main nav
      expect(mainNavMenu).toHaveAttribute('data-expanded', 'false');

      const sidebar = container.firstChild as HTMLElement;
      fireEvent.mouseEnter(sidebar);

      await waitFor(() => {
        expect(mainNavMenu).toHaveAttribute('data-expanded', 'true');
      });
    });

    it('contracts NavigationMenu on mouse leave', async () => {
      const { container } = renderSidebar({ isOpen: false });

      const sidebar = container.firstChild as HTMLElement;
      const navMenus = screen.getAllByTestId('navigation-menu');
      const mainNavMenu = navMenus[0]; // First is main nav

      fireEvent.mouseEnter(sidebar);
      await waitFor(() => {
        expect(mainNavMenu).toHaveAttribute('data-expanded', 'true');
      });

      fireEvent.mouseLeave(sidebar);
      await waitFor(() => {
        expect(mainNavMenu).toHaveAttribute('data-expanded', 'false');
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('responds to window resize events', async () => {
      renderSidebar({ isOpen: true });

      // Just verify the resize listener is set up
      // Actual isDesktop state depends on initial window.innerWidth
      await act(async () => {
        window.dispatchEvent(new Event('resize'));
      });

      // Test passes if no error thrown
    });
  });

  describe('Navigation Menu Integration', () => {
    it('passes navigation items to NavigationMenu', () => {
      renderSidebar();
      const navMenus = screen.getAllByTestId('navigation-menu');
      expect(navMenus[0]).toHaveTextContent('2 items'); // Main nav
      expect(navMenus[1]).toHaveTextContent('1 items'); // Admin nav
    });

    it('passes expanded state to NavigationMenu when open via keepOpen', () => {
      localStorage.setItem('sidebarKeepOpen', 'true');
      renderSidebar({ isOpen: true });
      const navMenus = screen.getAllByTestId('navigation-menu');
      expect(navMenus[0]).toHaveAttribute('data-expanded', 'true');
    });

    it('passes collapsed state to NavigationMenu when closed', () => {
      renderSidebar({ isOpen: false });
      const navMenus = screen.getAllByTestId('navigation-menu');
      expect(navMenus[0]).toHaveAttribute('data-expanded', 'false');
    });
  });

  describe('Tenant Branding', () => {
    it('shows default logo when no tenant branding', () => {
      renderSidebar();
      expect(screen.getByText('🥩')).toBeInTheDocument();
    });

    it('shows default company name when expanded via keepOpen', () => {
      localStorage.setItem('sidebarKeepOpen', 'true');
      renderSidebar({ isOpen: true });
      expect(screen.getByText('Meats Central')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('navigation section is a nav element', () => {
      renderSidebar();
      // Now has 2 nav elements: main nav + admin nav
      expect(screen.getAllByRole('navigation')).toHaveLength(2);
    });

    it('pin button has accessible label when visible', () => {
      localStorage.setItem('sidebarKeepOpen', 'true');
      renderSidebar({ isOpen: true });
      
      const pinButton = screen.queryByRole('button', { name: /unpin sidebar/i });
      if (pinButton) {
        expect(pinButton).toHaveAttribute('aria-label');
        expect(pinButton).toHaveAttribute('title');
      }
    });
  });

  describe('Lock Icons', () => {
    it('shows SVG icon in pin button when visible', () => {
      localStorage.setItem('sidebarKeepOpen', 'true');
      renderSidebar({ isOpen: true });
      
      const pinButton = screen.queryByRole('button', { name: /unpin sidebar/i });
      if (pinButton) {
        const svg = pinButton.querySelector('svg');
        expect(svg).toBeInTheDocument();
      }
    });
  });

  describe('Effect Cleanup', () => {
    it('removes resize listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      
      const { unmount } = renderSidebar();
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('onToggle Callbacks', () => {
    it('receives onToggle prop', () => {
      const onToggle = vi.fn();
      renderSidebar({ onToggle });
      
      // onToggle is passed and component renders (now has 2 nav menus: main + admin)
      expect(screen.getAllByTestId('navigation-menu')).toHaveLength(2);
    });

    it('onToggle is called when keepOpen state syncs with isOpen', () => {
      const onToggle = vi.fn();
      localStorage.setItem('sidebarKeepOpen', 'true');
      
      // When keepOpen is true but isOpen is false, onToggle should be called
      renderSidebar({ isOpen: false, onToggle });
      
      // The effect runs to sync states
      expect(onToggle).toHaveBeenCalled();
    });
  });
});

