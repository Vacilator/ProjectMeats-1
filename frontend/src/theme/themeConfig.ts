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
    colorSuccess: 'rgb(34, 197, 94)',
    colorWarning: 'rgb(234, 179, 8)',
    colorError: 'rgb(239, 68, 68)',
    colorInfo: 'rgb(59, 130, 246)',
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
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    },
  },
};

/**
 * Dark Theme Configuration
 */
export const darkTheme: ThemeConfig = {
  token: {
    colorPrimary: 'rgb(var(--color-primary))',
    colorSuccess: 'rgb(34, 197, 94)',
    colorWarning: 'rgb(234, 179, 8)',
    colorError: 'rgb(239, 68, 68)',
    colorInfo: 'rgb(59, 130, 246)',
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
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.3)',
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
    colorSuccess: 'rgb(0, 128, 0)',
    colorWarning: 'rgb(255, 170, 0)',
    colorError: 'rgb(204, 0, 0)',
    colorInfo: 'rgb(0, 102, 204)',
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
    '--canvas-node-shadow': 'rgba(0, 0, 0, 0.1)',
    '--canvas-connection': 'rgb(var(--color-primary))',
    '--canvas-selection': 'rgb(var(--color-primary))',
  },
  dark: {
    '--canvas-bg': 'rgb(var(--color-background))',
    '--canvas-grid': 'rgb(var(--color-border))',
    '--canvas-node-bg': 'rgb(var(--color-surface))',
    '--canvas-node-border': 'rgb(var(--color-border))',
    '--canvas-node-shadow': 'rgba(0, 0, 0, 0.5)',
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
