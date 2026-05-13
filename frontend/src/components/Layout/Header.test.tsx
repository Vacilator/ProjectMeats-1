/**
 * Header Component Tests
 *
 * Tests for main application header with search, quick actions, and user controls
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const onboardingMock = vi.hoisted(() => ({
  getTourStatus: vi.fn(() => ({
    status: 'not_started',
    last_event: null,
    last_event_at: null,
    started_at: null,
    completed_at: null,
    skipped_at: null,
    start_count: 0,
    complete_count: 0,
    skip_count: 0,
    resume_count: 0,
  })),
  hasCompletedTour: vi.fn(() => false),
  launchTour: vi.fn(),
}));

const connectivityMock = vi.hoisted(() => ({
  useConnectivity: vi.fn(() => ({
    status: 'online',
    isOnline: true,
    lastChangedAt: null,
  })),
}));

vi.mock('../Onboarding', () => ({
  useOnboarding: () => onboardingMock,
}));

vi.mock('../../contexts/ConnectivityContext', () => ({
  useConnectivity: connectivityMock.useConnectivity,
}));

import Header from './Header';

// Mock navigate function
const mockNavigate = vi.fn();

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock theme context
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#ffffff',
        headerBackground: '#f8f9fa',
        headerText: '#333',
        headerBorder: '#e5e5e5',
        textPrimary: '#333',
        textSecondary: '#666',
        surface: '#fff',
        surfaceHover: '#f0f0f0',
        border: '#ddd',
        primary: '#007bff',
        shadow: 'rgba(0,0,0,0.1)',
        shadowMedium: 'rgba(0,0,0,0.15)',
      },
      name: 'light',
    },
    themeName: 'light',
    toggleTheme: vi.fn(),
  }),
}));

// Mock QuickActions context
const mockOpenFormModal = vi.fn();
const mockOpenEditor = vi.fn();
const mockCloseEditor = vi.fn();

vi.mock('../../contexts/QuickActionsContext', () => ({
  useQuickActions: () => ({
    quickActions: [],
    isLoading: false,
    openFormModal: mockOpenFormModal,
    isEditorOpen: false,
    openEditor: mockOpenEditor,
    closeEditor: mockCloseEditor,
  }),
}));

// Mock authService
vi.mock('../../services/authService', () => ({
  authService: {
    getCurrentUser: () => ({ id: 1, username: 'testuser', is_superuser: false }),
  },
}));

// Mock ProfileDropdown
vi.mock('../ProfileDropdown', () => ({
  default: () => <div data-testid="profile-dropdown">Profile</div>,
}));

// Mock TenantSelector
vi.mock('./TenantSelector', () => ({
  default: ({ isSuperuser }: { isSuperuser: boolean }) => (
    <div data-testid="tenant-selector" data-superuser={isSuperuser}>
      Tenant Selector
    </div>
  ),
}));

// Mock QuickActionsEditor
vi.mock('../QuickActions/QuickActionsEditor', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div data-testid="quick-actions-editor">Editor</div> : null,
}));

// Mock Icon component
vi.mock('../ui', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

// Mock NotificationsContext to avoid NotificationsProvider requirement
vi.mock('../../contexts/NotificationsContext', () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
    fetchNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    dismissNotification: vi.fn(),
    actionItems: [],
    actionItemCounts: null,
    fetchActionItems: vi.fn(),
    preferences: null,
    updatePreferences: vi.fn(),
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
  }),
}));

// Mock NotificationBell component
vi.mock('../Notifications', () => ({
  NotificationBell: () => (
    <button title="Notifications" aria-label="Notifications" data-testid="notification-bell">
      🔔
    </button>
  ),
}));

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectivityMock.useConnectivity.mockReturnValue({
      status: 'online',
      isOnline: true,
      lastChangedAt: null,
    });
    onboardingMock.getTourStatus.mockImplementation(() => ({
      status: 'not_started',
      last_event: null,
      last_event_at: null,
      started_at: null,
      completed_at: null,
      skipped_at: null,
      start_count: 0,
      complete_count: 0,
      skip_count: 0,
      resume_count: 0,
    }));
    onboardingMock.hasCompletedTour.mockImplementation(() => false);
    localStorage.clear();
    localStorage.setItem('tenantName', 'Test Company');
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Basic Rendering', () => {
    it('renders header with tenant name', () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      expect(screen.getByText('Test Company')).toBeInTheDocument();
    });

    it('renders search input', () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      expect(screen.getByRole('textbox', { name: /global search/i })).toBeInTheDocument();
    });

    it('renders quick actions button', () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      expect(screen.getByRole('button', { name: /quick actions/i })).toBeInTheDocument();
    });

    it('renders onboarding help button', () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      expect(screen.getByRole('button', { name: /onboarding help/i })).toBeInTheDocument();
    });

    it('renders theme toggle button', () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
    });

    it('renders notifications button', () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });

    it('renders the offline status pill when disconnected', () => {
      connectivityMock.useConnectivity.mockReturnValue({
        status: 'offline',
        isOnline: false,
        lastChangedAt: Date.now(),
      });

      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      expect(screen.getByRole('status')).toHaveTextContent('Offline');
    });

    it('renders profile dropdown', () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      expect(screen.getByTestId('profile-dropdown')).toBeInTheDocument();
    });

    it('renders tenant selector', () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      expect(screen.getByTestId('tenant-selector')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('updates search query on input', () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      const searchInput = screen.getByRole('textbox', { name: /global search/i });
      fireEvent.change(searchInput, { target: { value: 'test query' } });

      expect(searchInput).toHaveValue('test query');
    });

    it('handles search form submission by opening command palette', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      const searchInput = screen.getByRole('textbox', { name: /global search/i });

      const form = searchInput.closest('form')!;
      fireEvent.submit(form);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pm:open-command-palette' }),
      );

      dispatchSpy.mockRestore();
    });

    it('opens command palette on empty search submit', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      const searchInput = screen.getByRole('textbox', { name: /global search/i });
      const form = searchInput.closest('form')!;
      fireEvent.submit(form);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pm:open-command-palette' }),
      );

      dispatchSpy.mockRestore();
    });

    it('search input has accessible label', () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      expect(screen.getByRole('textbox', { name: /global search/i })).toBeInTheDocument();
    });

    it('search input starts empty regardless of URL', () => {
      render(
        <MemoryRouter initialEntries={['/command-center?tab=pipeline&q=brisket']}>
          <Header />
        </MemoryRouter>
      );

      expect(screen.getByRole('textbox', { name: /global search/i })).toHaveValue('');
    });

    it('opens command palette on search submit from any page', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      render(
        <MemoryRouter initialEntries={['/command-center?tab=pipeline&item=review-123']}>
          <Header />
        </MemoryRouter>
      );

      const searchInput = screen.getByRole('textbox', { name: /global search/i });

      const form = searchInput.closest('form')!;
      fireEvent.submit(form);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pm:open-command-palette' }),
      );

      dispatchSpy.mockRestore();
    });
  });

  describe('Onboarding Help', () => {
    it('routes to cockpit tour launcher when opened outside cockpit', () => {
      onboardingMock.getTourStatus.mockImplementation((tourName: string) =>
        tourName === 'cockpit'
          ? {
              status: 'skipped',
              last_event: 'skipped',
              last_event_at: null,
              started_at: null,
              completed_at: null,
              skipped_at: null,
              start_count: 0,
              complete_count: 0,
              skip_count: 1,
              resume_count: 0,
            }
          : {
              status: 'not_started',
              last_event: null,
              last_event_at: null,
              started_at: null,
              completed_at: null,
              skipped_at: null,
              start_count: 0,
              complete_count: 0,
              skip_count: 0,
              resume_count: 0,
            }
      );

      render(
        <MemoryRouter initialEntries={['/sales-orders']}>
          <Header />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /onboarding help/i }));
      fireEvent.click(screen.getByText('Resume Workspace Tour'));

      expect(mockNavigate).toHaveBeenCalledWith('/cockpit/dashboard?tour=cockpit');
    });

    it('links the onboarding menu to the Cockpit workspace', () => {
      render(
        <MemoryRouter initialEntries={['/sales-orders']}>
          <Header />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /onboarding help/i }));
      fireEvent.click(screen.getByText('Open Workspace Dashboard'));

      expect(mockNavigate).toHaveBeenCalledWith('/cockpit/dashboard');
    });
  });

  describe('Quick Actions Menu', () => {
    it('shows dropdown on button click', async () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      const quickActionsBtn = screen.getByRole('button', { name: /quick actions/i });
      fireEvent.click(quickActionsBtn);

      await waitFor(() => {
        expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      });
    });

    it('shows default menu items when no custom actions', async () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      const quickActionsBtn = screen.getByRole('button', { name: /quick actions/i });
      fireEvent.click(quickActionsBtn);

      await waitFor(() => {
        expect(screen.getByText('New Supplier')).toBeInTheDocument();
        expect(screen.getByText('New Customer')).toBeInTheDocument();
        expect(screen.getByText('New Purchase Order')).toBeInTheDocument();
        expect(screen.getByText('Open Command Center')).toBeInTheDocument();
      });
    });

    it('navigates on menu item click', async () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      const quickActionsBtn = screen.getByRole('button', { name: /quick actions/i });
      fireEvent.click(quickActionsBtn);

      await waitFor(() => {
        expect(screen.getByText('New Supplier')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('New Supplier'));

      expect(mockNavigate).toHaveBeenCalledWith('/suppliers/new');
    });

    it('closes menu after navigation', async () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      const quickActionsBtn = screen.getByRole('button', { name: /quick actions/i });
      fireEvent.click(quickActionsBtn);

      await waitFor(() => {
        expect(screen.getByText('New Supplier')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('New Supplier'));

      // Menu should close after click
      await waitFor(() => {
        expect(screen.queryByText('Customize Quick Actions')).not.toBeInTheDocument();
      });
    });

    it('shows edit button in menu header', async () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      const quickActionsBtn = screen.getByRole('button', { name: /quick actions/i });
      fireEvent.click(quickActionsBtn);

      await waitFor(() => {
        expect(screen.getByTitle('Edit Quick Actions')).toBeInTheDocument();
      });
    });

    it('opens editor when edit button clicked', async () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      const quickActionsBtn = screen.getByRole('button', { name: /quick actions/i });
      fireEvent.click(quickActionsBtn);

      await waitFor(() => {
        expect(screen.getByTitle('Edit Quick Actions')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle('Edit Quick Actions'));

      expect(mockOpenEditor).toHaveBeenCalled();
    });

    it('shows customize link when no custom actions', async () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      const quickActionsBtn = screen.getByRole('button', { name: /quick actions/i });
      fireEvent.click(quickActionsBtn);

      await waitFor(() => {
        expect(screen.getByText('Customize Quick Actions')).toBeInTheDocument();
      });
    });

    it('toggles dropdown open/close', async () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      const quickActionsBtn = screen.getByRole('button', { name: /quick actions/i });

      // Open
      fireEvent.click(quickActionsBtn);
      await waitFor(() => {
        expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      });

      // Close
      fireEvent.click(quickActionsBtn);
      await waitFor(() => {
        // The menu header should disappear
        expect(screen.queryByText('Customize Quick Actions')).not.toBeInTheDocument();
      });
    });
  });

  describe('Theme Toggle', () => {
    it('has theme toggle button visible', () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      const themeToggle = screen.getByRole('button', { name: /switch to dark mode/i });
      expect(themeToggle).toBeInTheDocument();
    });

    it('shows moon icon in light mode', () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      const themeToggle = screen.getByRole('button', { name: /switch to dark mode/i });
      expect(themeToggle).toHaveTextContent('🌙');
    });

    it('theme toggle button is clickable', () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      const themeToggle = screen.getByRole('button', { name: /switch to dark mode/i });
      // Click should not throw
      expect(() => fireEvent.click(themeToggle)).not.toThrow();
    });
  });

  describe('Tenant Name Display', () => {
    it('shows tenant name from localStorage', () => {
      localStorage.setItem('tenantName', 'Custom Tenant');

      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      expect(screen.getByText('Custom Tenant')).toBeInTheDocument();
    });

    it('shows default name when localStorage is empty', () => {
      localStorage.removeItem('tenantName');

      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      expect(screen.getByText('Meats Central')).toBeInTheDocument();
    });
  });

  describe('Click Outside to Close', () => {
    it('closes quick menu on outside click', async () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      // Open menu
      const quickActionsBtn = screen.getByRole('button', { name: /quick actions/i });
      fireEvent.click(quickActionsBtn);

      await waitFor(() => {
        expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      });

      // Click outside
      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByText('Customize Quick Actions')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('header element is accessible', () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('all buttons have aria-labels', () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      expect(screen.getByRole('button', { name: /quick actions/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /switch to/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });

    it('buttons have title attributes', () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      expect(screen.getByTitle('Quick Actions')).toBeInTheDocument();
      expect(screen.getByTitle('Notifications')).toBeInTheDocument();
    });
  });

  describe('Superuser Features', () => {
    it('passes isSuperuser to TenantSelector', () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      const tenantSelector = screen.getByTestId('tenant-selector');
      expect(tenantSelector).toHaveAttribute('data-superuser', 'false');
    });
  });
});
