/**
 * Centralized Theme Configuration for ProjectMeats
 * 
 * Provides three theme modes:
 * - light: Standard light mode
 * - dark: Dark mode with reduced eye strain
 * - high-contrast: WCAG AAA compliant high contrast mode
 * 
 * Authority: docs/DESIGN_SYSTEM.md
 */

import { ThemeConfig } from 'antd';

export type ThemeMode = 'light' | 'dark' | 'high-contrast';

/**
 * Light Theme Configuration
 */
export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: 'rgb(var(--color-primary))',
    colorSuccess: 'rgb(var(--color-success))',
    colorWarning: 'rgb(var(--color-warning))',
    colorError: 'rgb(var(--color-error))',
    colorInfo: 'rgb(var(--color-info))',
    colorTextBase: 'rgb(var(--color-text-primary))',
    colorBgBase: 'rgb(var(--color-background))',
    fontSize: 14,
    borderRadius: 6,
  },
  components: {
    Button: {
      controlHeight: 36,
      fontWeight: 500,
    },
    Input: {
      controlHeight: 36,
      borderRadius: 6,
    },
    Card: {
      borderRadius: 8,
      boxShadow: 'var(--shadow-sm)',
    },
  },
};

/**
 * Dark Theme Configuration
 */
export const darkTheme: ThemeConfig = {
  token: {
    colorPrimary: 'rgb(var(--color-primary))',
    colorSuccess: 'rgb(var(--color-success))',
    colorWarning: 'rgb(var(--color-warning))',
    colorError: 'rgb(var(--color-error))',
    colorInfo: 'rgb(var(--color-info))',
    colorTextBase: 'rgb(var(--color-text-primary))',
    colorBgBase: 'rgb(var(--color-background))',
    colorBgContainer: 'rgb(var(--color-surface))',
    colorBorder: 'rgb(var(--color-border))',
    fontSize: 14,
    borderRadius: 6,
  },
  components: {
    Button: {
      controlHeight: 36,
      fontWeight: 500,
    },
    Input: {
      controlHeight: 36,
      borderRadius: 6,
      colorBgContainer: 'rgb(var(--color-surface))',
    },
    Card: {
      borderRadius: 8,
      colorBgContainer: 'rgb(var(--color-surface))',
      boxShadow: 'var(--shadow-md)',
    },
  },
};

/**
 * High Contrast Theme Configuration
 * WCAG AAA compliant (7:1 contrast ratio minimum)
 */
export const highContrastTheme: ThemeConfig = {
  token: {
    colorPrimary: 'rgb(var(--color-primary))',
    colorSuccess: 'rgb(var(--color-success))',
    colorWarning: 'rgb(var(--color-warning))',
    colorError: 'rgb(var(--color-error))',
    colorInfo: 'rgb(var(--color-info))',
    colorTextBase: 'rgb(var(--color-text-primary))',
    colorBgBase: 'rgb(var(--color-background))',
    colorBorder: 'rgb(var(--color-border))',
    fontSize: 16, // Larger for accessibility
    borderRadius: 2, // Sharper edges for clarity
    lineWidth: 2, // Thicker borders
  },
  components: {
    Button: {
      controlHeight: 44, // Larger touch targets
      fontWeight: 700,
    },
    Input: {
      controlHeight: 44,
      borderRadius: 2,
    },
    Card: {
      borderRadius: 4,
      boxShadow: 'none', // Remove shadows for clarity
    },
  },
};

/**
 * Get theme configuration by mode
 */
export function getThemeConfig(mode: ThemeMode): ThemeConfig {
  switch (mode) {
    case 'light':
      return lightTheme;
    case 'dark':
      return darkTheme;
    case 'high-contrast':
      return highContrastTheme;
    default:
      return lightTheme;
  }
}

/**
 * Theme-specific CSS custom properties for FlowEditor canvas
 */
export const canvasThemeVars = {
  light: {
    '--canvas-bg': 'rgb(var(--color-surface))',
    '--canvas-grid': 'rgb(var(--color-border))',
    '--canvas-node-bg': 'rgb(var(--color-surface))',
    '--canvas-node-border': 'rgb(var(--color-border))',
    '--canvas-node-shadow': 'rgba(var(--color-overlay), 0.1)',
    '--canvas-connection': 'rgb(var(--color-primary))',
    '--canvas-selection': 'rgb(var(--color-primary))',
  },
  dark: {
    '--canvas-bg': 'rgb(var(--color-background))',
    '--canvas-grid': 'rgb(var(--color-border))',
    '--canvas-node-bg': 'rgb(var(--color-surface))',
    '--canvas-node-border': 'rgb(var(--color-border))',
    '--canvas-node-shadow': 'rgba(var(--color-overlay), 0.5)',
    '--canvas-connection': 'rgb(var(--color-primary))',
    '--canvas-selection': 'rgb(var(--color-primary))',
  },
  'high-contrast': {
    '--canvas-bg': 'rgb(var(--color-surface))',
    '--canvas-grid': 'rgb(var(--color-border))',
    '--canvas-node-bg': 'rgb(var(--color-surface))',
    '--canvas-node-border': 'rgb(var(--color-text-primary))',
    '--canvas-node-shadow': 'none',
    '--canvas-connection': 'rgb(var(--color-primary))',
    '--canvas-selection': 'rgb(var(--color-primary))',
  },
};

/**
 * Apply canvas theme CSS variables to document
 */
export function applyCanvasTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  const vars = canvasThemeVars[mode];
  
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}
