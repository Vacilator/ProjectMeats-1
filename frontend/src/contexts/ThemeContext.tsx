/**
 * Theme Context Provider
 * 
 * NEW: Semantic Design System Implementation
 * - Injects tenant colors into CSS variables at runtime
 * - Manages theme state (light/dark/high-contrast) across the application
 * - Persists theme preference to localStorage and syncs with backend
 * - Fetches tenant-specific branding (logo, colors) from backend
 * - Integrates with AntD ConfigProvider for consistent component theming
 * 
 * Components now reference CSS variables (--color-primary) instead of hardcoded colors.
 * This allows the same component to look completely different for each tenant.
 */
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ConfigProvider } from 'antd';
import { Theme, themes, injectTenantColors } from '../config/theme';
import { getThemeConfig, applyCanvasTheme } from '../theme/themeConfig';
import { getRuntimeConfig } from '../config/runtime';
import { apiClient } from '../services/apiService';
import { getAuthHeader } from '../services/jwtService';
import { useAuth } from './AuthContext';

type ThemeName = 'light' | 'dark' | 'high-contrast';

interface TenantBranding {
  logoUrl: string | null;
  primaryColorLight: string;
  primaryColorDark: string;
  tenantName: string;
}

interface ThemeContextType {
  theme: Theme;
  themeName: ThemeName;
  toggleTheme: () => void;
  setTheme: (themeName: ThemeName) => void;
  tenantBranding: TenantBranding | null;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  // Initialize theme from localStorage or default to 'dark'
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark' || stored === 'high-contrast') {
      return stored;
    }
    
    // Check for high contrast preference
    const prefersHighContrast = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-contrast: more)').matches
      : false;
    if (prefersHighContrast) {
      return 'high-contrast';
    }
    
    // Check for dark mode preference
    const prefersDark = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true;
    return prefersDark ? 'dark' : 'light';
  });
  
  const [tenantBranding, setTenantBranding] = useState<TenantBranding | null>(null);

  const cssThemeMode: 'light' | 'dark' = themeName === 'dark' ? 'dark' : 'light';

  // CSS-variable theme object only supports light/dark
  const theme = themes[cssThemeMode];

  // Apply theme to document body (data-theme powers global CSS variables)
  useEffect(() => {
    document.body.setAttribute('data-theme', cssThemeMode);
    applyCanvasTheme(themeName);
  }, [cssThemeMode, themeName]);

  // Sync theme to backend when it changes
  useEffect(() => {
    const syncThemeToBackend = async () => {
      if (!getAuthHeader()) return;

      try {
        await apiClient.patch('/preferences/me/', { theme: themeName });
      } catch (error) {
        console.error('Failed to sync theme to backend:', error);
      }
    };

    syncThemeToBackend();
  }, [themeName]);

  const loadTenantBranding = useCallback(async (opts?: { bustLogoCache?: boolean }) => {
    if (!getAuthHeader()) return;

    try {
      const apiBaseUrl = getRuntimeConfig('API_BASE_URL', 'http://localhost:8000/api/v1');
      const response = await apiClient.get('/tenants/current_theme/');

      const branding = {
        logoUrl: response.data.logo_url,
        primaryColorLight: response.data.primary_color_light,
        primaryColorDark: response.data.primary_color_dark,
        tenantName: response.data.name,
      };

      if (branding.logoUrl && branding.logoUrl.startsWith('/')) {
        const baseUrl = apiBaseUrl.replace('/api/v1', '');
        branding.logoUrl = `${baseUrl}${branding.logoUrl}`;
      }

      if (opts?.bustLogoCache && branding.logoUrl) {
        const sep = branding.logoUrl.includes('?') ? '&' : '?';
        branding.logoUrl = `${branding.logoUrl}${sep}v=${Date.now()}`;
      }

      setTenantBranding(branding);
    } catch (error) {
      console.error('Failed to load tenant branding:', error);
    }
  }, []);

  // Load tenant branding when auth becomes available.
  useEffect(() => {
    if (!isAuthenticated) {
      setTenantBranding(null);
      return;
    }

    void loadTenantBranding();
  }, [isAuthenticated, loadTenantBranding]);

  // Listen for branding updates from Settings/Admin Profile pages
  useEffect(() => {
    const handleBrandingUpdate = () => {
      console.log('🔄 Tenant branding update event received, reloading...');
      void loadTenantBranding({ bustLogoCache: true });
    };

    window.addEventListener('tenant-branding-updated', handleBrandingUpdate);

    return () => {
      window.removeEventListener('tenant-branding-updated', handleBrandingUpdate);
    };
  }, [loadTenantBranding]);

  // NEW: Inject tenant colors into CSS variables when branding or theme changes
  useEffect(() => {
    if (tenantBranding) {
      console.log('🎨 Injecting tenant branding into CSS variables:', {
        tenant: tenantBranding.tenantName,
        theme: themeName,
        primaryLight: tenantBranding.primaryColorLight,
        primaryDark: tenantBranding.primaryColorDark,
      });

      // Inject colors into CSS variables (defined in config/theme.ts)
      injectTenantColors(
        tenantBranding.primaryColorLight,
        tenantBranding.primaryColorDark,
        cssThemeMode
      );
    }
  }, [cssThemeMode, themeName, tenantBranding]);

  // Load theme from backend when auth becomes available
  useEffect(() => {
    const loadThemeFromBackend = async () => {
      if (!getAuthHeader()) return;

      try {
        const response = await apiClient.get('/preferences/me/');

        const backendTheme = response.data.theme;
        if (backendTheme === 'light' || backendTheme === 'dark' || backendTheme === 'high-contrast') {
          setThemeName(backendTheme);
          localStorage.setItem('theme', backendTheme);
        }
      } catch (error) {
        console.error('Failed to load theme from backend:', error);
      }
    };

    if (isAuthenticated) {
      void loadThemeFromBackend();
    }
  }, [isAuthenticated]);

  const toggleTheme = () => {
    // Quick toggle between the two common modes.
    // High-contrast is opt-in via explicit selection (setTheme) or user preference.
    const newTheme: ThemeName = themeName === 'light' ? 'dark' : 'light';
    setThemeName(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const setTheme = (newTheme: ThemeName) => {
    setThemeName(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const value: ThemeContextType = {
    theme,
    themeName,
    toggleTheme,
    setTheme,
    tenantBranding,
  };

  // Get AntD theme configuration based on current theme mode
  const antdTheme = getThemeConfig(themeName);

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={antdTheme}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
