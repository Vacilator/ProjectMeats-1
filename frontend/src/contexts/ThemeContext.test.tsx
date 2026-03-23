/**
 * ThemeContext Tests
 * 
 * Tests for theme context provider including:
 * - Theme initialization from localStorage
 * - Theme toggle and set functions
 * - Data-theme attribute on document body
 * - Tenant branding loading and injection
 * - Backend sync (mocked)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './ThemeContext';
import { apiClient } from '../services/apiService';

// ThemeProvider is mounted under AuthProvider in the app. Mock useAuth for unit tests.
vi.mock('./AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock('../services/apiService', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockedApiClient = vi.mocked(apiClient, true);

// Mock theme config
vi.mock('../config/theme', () => ({
  themes: {
    light: { name: 'light', colors: { primary: '#fff' } },
    dark: { name: 'dark', colors: { primary: '#000' } },
  },
  lightTheme: { name: 'light', colors: { primary: '#fff' } },
  darkTheme: { name: 'dark', colors: { primary: '#000' } },
  injectTenantColors: vi.fn(),
}));

// Mock runtime config (partial)
vi.mock('../config/runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config/runtime')>();
  return {
    ...actual,
    getRuntimeConfig: vi.fn(() => 'http://localhost:8000/api/v1'),
    config: {
      ...actual.config,
      API_BASE_URL: 'http://localhost:8000/api/v1',
      ENVIRONMENT: 'development',
    },
  };
});

// Test component to access context
const TestConsumer: React.FC = () => {
  const { theme, themeName, toggleTheme, setTheme, tenantBranding } = useTheme();
  
  return (
    <div>
      <div data-testid="theme-name">{themeName}</div>
      <div data-testid="theme-object">{JSON.stringify(theme)}</div>
      <div data-testid="branding">{tenantBranding ? tenantBranding.tenantName : 'none'}</div>
      <div data-testid="logo">{tenantBranding?.logoUrl || 'no-logo'}</div>
      <button onClick={toggleTheme}>Toggle</button>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
    </div>
  );
};

describe('ThemeContext', () => {
  let originalMatchMedia: typeof window.matchMedia | undefined;
  let localStorageMock: { [key: string]: string };

  beforeEach(() => {
    // Clear mocks
    vi.clearAllMocks();

    // Ensure matchMedia exists for theme preference checks
    originalMatchMedia = window.matchMedia;
    // Default: no special preferences
    window.matchMedia = ((query: string) => ({
      // Default test environment prefers dark, but not high-contrast/reduced-motion
      matches: query.includes('(prefers-color-scheme: dark)'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as any;
    
    // Mock localStorage
    localStorageMock = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => localStorageMock[key] || null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      localStorageMock[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete localStorageMock[key];
    });
    
    // Mock API responses (no auth token by default)
    mockedApiClient.get.mockRejectedValue(new Error('No token'));
    mockedApiClient.patch.mockRejectedValue(new Error('No token'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia;
    }
    document.body.removeAttribute('data-theme');
  });

  describe('Provider Setup', () => {
    it('should render children', () => {
      render(
        <ThemeProvider>
          <div>Child Content</div>
        </ThemeProvider>
      );
      
      expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    it('should throw error when useTheme is used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => render(<TestConsumer />)).toThrow('useTheme must be used within a ThemeProvider');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Theme Initialization', () => {
    it('should default to dark theme when no localStorage value', () => {
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      expect(screen.getByTestId('theme-name')).toHaveTextContent('dark');
    });

    it('should initialize from localStorage when set to light', () => {
      localStorageMock['theme'] = 'light';
      
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      expect(screen.getByTestId('theme-name')).toHaveTextContent('light');
    });

    it('should initialize from localStorage when set to dark', () => {
      localStorageMock['theme'] = 'dark';
      
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      expect(screen.getByTestId('theme-name')).toHaveTextContent('dark');
    });

    it('should default to dark for invalid localStorage value', () => {
      localStorageMock['theme'] = 'invalid';
      
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      expect(screen.getByTestId('theme-name')).toHaveTextContent('dark');
    });

    it('should set data-theme attribute on document body', async () => {
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      await waitFor(() => {
        expect(document.body.getAttribute('data-theme')).toBe('dark');
      });
    });
  });

  describe('Theme Toggle', () => {
    it('should toggle from dark to light', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      expect(screen.getByTestId('theme-name')).toHaveTextContent('dark');
      
      await user.click(screen.getByText('Toggle'));
      
      expect(screen.getByTestId('theme-name')).toHaveTextContent('light');
    });

    it('should toggle from light to dark', async () => {
      const user = userEvent.setup();
      localStorageMock['theme'] = 'light';
      
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      expect(screen.getByTestId('theme-name')).toHaveTextContent('light');
      
      await user.click(screen.getByText('Toggle'));
      
      expect(screen.getByTestId('theme-name')).toHaveTextContent('dark');
    });

    it('should persist theme to localStorage on toggle', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      await user.click(screen.getByText('Toggle'));
      
      expect(localStorageMock['theme']).toBe('light');
    });

    it('should update data-theme attribute on toggle', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      await waitFor(() => {
        expect(document.body.getAttribute('data-theme')).toBe('dark');
      });
      
      await user.click(screen.getByText('Toggle'));
      
      await waitFor(() => {
        expect(document.body.getAttribute('data-theme')).toBe('light');
      });
    });
  });

  describe('Set Theme', () => {
    it('should set theme to light', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      await user.click(screen.getByText('Set Light'));
      
      expect(screen.getByTestId('theme-name')).toHaveTextContent('light');
      expect(localStorageMock['theme']).toBe('light');
    });

    it('should set theme to dark', async () => {
      const user = userEvent.setup();
      localStorageMock['theme'] = 'light';
      
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      await user.click(screen.getByText('Set Dark'));
      
      expect(screen.getByTestId('theme-name')).toHaveTextContent('dark');
      expect(localStorageMock['theme']).toBe('dark');
    });
  });

  describe('Backend Theme Sync', () => {
    it('should load theme from backend when authenticated', async () => {
      localStorageMock['authToken'] = 'test-token';
      
      mockedApiClient.get.mockImplementation((url: string) => {
        if (url.includes('/preferences/me/')) {
          return Promise.resolve({ data: { theme: 'light' } });
        }
        if (url.includes('/tenants/current_theme/')) {
          return Promise.resolve({
            data: {
              name: 'Test Tenant',
              logo_url: null,
              primary_color_light: '#fff',
              primary_color_dark: '#000',
            },
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });
      
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('theme-name')).toHaveTextContent('light');
      });
    });

    it('should sync theme to backend on change', async () => {
      const user = userEvent.setup();
      localStorageMock['authToken'] = 'test-token';
      
      mockedApiClient.patch.mockResolvedValue({ data: { theme: 'light' } });
      mockedApiClient.get.mockRejectedValue(new Error('Not found'));
      
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      await user.click(screen.getByText('Toggle'));
      
      await waitFor(() => {
        expect(mockedApiClient.patch).toHaveBeenCalledWith(
          expect.stringContaining('/preferences/me/'),
          { theme: 'light' }
        );
      });
    });

    it('should handle backend sync failure gracefully', async () => {
      const user = userEvent.setup();
      localStorageMock['authToken'] = 'test-token';
      
      mockedApiClient.patch.mockRejectedValue(new Error('Network error'));
      mockedApiClient.get.mockRejectedValue(new Error('Network error'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      // Toggle should still work locally
      await user.click(screen.getByText('Toggle'));
      
      expect(screen.getByTestId('theme-name')).toHaveTextContent('light');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Tenant Branding', () => {
    it('should load tenant branding when authenticated', async () => {
      localStorageMock['authToken'] = 'test-token';
      
      mockedApiClient.get.mockImplementation((url: string) => {
        if (url.includes('/tenants/current_theme/')) {
          return Promise.resolve({
            data: {
              name: 'Acme Corp',
              logo_url: '/media/logos/acme.png',
              primary_color_light: '#3498db',
              primary_color_dark: '#2980b9',
            },
          });
        }
        if (url.includes('/preferences/me/')) {
          return Promise.resolve({ data: { theme: 'dark' } });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });
      
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('branding')).toHaveTextContent('Acme Corp');
      });
    });

    it('should fix relative logo URLs', async () => {
      localStorageMock['authToken'] = 'test-token';
      
      mockedApiClient.get.mockImplementation((url: string) => {
        if (url.includes('/tenants/current_theme/')) {
          return Promise.resolve({
            data: {
              name: 'Test',
              logo_url: '/media/logo.png',
              primary_color_light: '#fff',
              primary_color_dark: '#000',
            },
          });
        }
        if (url.includes('/preferences/me/')) {
          return Promise.resolve({ data: { theme: 'dark' } });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });
      
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('logo')).toHaveTextContent('http://localhost:8000/media/logo.png');
      });
    });

    it('should handle null branding state initially', () => {
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      expect(screen.getByTestId('branding')).toHaveTextContent('none');
    });

    it('should handle branding load failure gracefully', async () => {
      localStorageMock['authToken'] = 'test-token';
      
      mockedApiClient.get.mockRejectedValue(new Error('Network error'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      // Should still render without crashing
      await waitFor(() => {
        expect(screen.getByTestId('branding')).toHaveTextContent('none');
      });
      
      consoleSpy.mockRestore();
    });

    it('should listen for tenant-branding-updated events', async () => {
      localStorageMock['authToken'] = 'test-token';
      
      let callCount = 0;
      mockedApiClient.get.mockImplementation((url: string) => {
        if (url.includes('/tenants/current_theme/')) {
          callCount++;
          return Promise.resolve({
            data: {
              name: callCount === 1 ? 'Initial' : 'Updated',
              logo_url: null,
              primary_color_light: '#fff',
              primary_color_dark: '#000',
            },
          });
        }
        if (url.includes('/preferences/me/')) {
          return Promise.resolve({ data: { theme: 'dark' } });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });
      
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('branding')).toHaveTextContent('Initial');
      });
      
      // Dispatch branding update event
      await act(async () => {
        window.dispatchEvent(new Event('tenant-branding-updated'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('branding')).toHaveTextContent('Updated');
      });
    });
  });

  describe('Theme Object', () => {
    it('should provide theme object from themes config', () => {
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      const themeObject = JSON.parse(screen.getByTestId('theme-object').textContent || '{}');
      expect(themeObject).toHaveProperty('name', 'dark');
    });

    it('should update theme object when theme changes', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );
      
      await user.click(screen.getByText('Toggle'));
      
      const themeObject = JSON.parse(screen.getByTestId('theme-object').textContent || '{}');
      expect(themeObject).toHaveProperty('name', 'light');
    });
  });
});
