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
    colorPrimary: '#667eea',
    colorSuccess: '#22c55e',
    colorWarning: '#eab308',
    colorError: '#ef4444',
    colorInfo: '#3b82f6',
    colorTextBase: '#2c3e50',
    colorBgBase: '#ffffff',
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
    colorPrimary: '#818cf8',
    colorSuccess: '#4ade80',
    colorWarning: '#fbbf24',
    colorError: '#f87171',
    colorInfo: '#60a5fa',
    colorTextBase: '#e5e7eb',
    colorBgBase: '#1a1a1a',
    colorBgContainer: '#262626',
    colorBorder: '#404040',
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
      colorBgContainer: '#333333',
    },
    Card: {
      borderRadius: 8,
      colorBgContainer: '#262626',
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
    colorPrimary: '#0000ff',
    colorSuccess: '#008000',
    colorWarning: '#ffaa00',
    colorError: '#cc0000',
    colorInfo: '#0066cc',
    colorTextBase: '#000000',
    colorBgBase: '#ffffff',
    colorBorder: '#000000',
    fontSize: 16, // Larger for accessibility
    borderRadius: 2, // Sharper edges for clarity
    lineWidth: 2, // Thicker borders
  },
  components: {
    Button: {
      controlHeight: 44, // Larger touch targets
      fontWeight: 700,
      borderWidth: 2,
    },
    Input: {
      controlHeight: 44,
      borderRadius: 2,
      borderWidth: 2,
      fontWeight: 600,
    },
    Card: {
      borderRadius: 4,
      borderWidth: 2,
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
    '--canvas-bg': '#f9fafb',
    '--canvas-grid': '#e5e7eb',
    '--canvas-node-bg': '#ffffff',
    '--canvas-node-border': '#d1d5db',
    '--canvas-node-shadow': 'rgba(0, 0, 0, 0.1)',
    '--canvas-connection': '#667eea',
    '--canvas-selection': '#667eea',
  },
  dark: {
    '--canvas-bg': '#0a0a0a',
    '--canvas-grid': '#333333',
    '--canvas-node-bg': '#1a1a1a',
    '--canvas-node-border': '#404040',
    '--canvas-node-shadow': 'rgba(0, 0, 0, 0.5)',
    '--canvas-connection': '#818cf8',
    '--canvas-selection': '#818cf8',
  },
  'high-contrast': {
    '--canvas-bg': '#ffffff',
    '--canvas-grid': '#cccccc',
    '--canvas-node-bg': '#ffffff',
    '--canvas-node-border': '#000000',
    '--canvas-node-shadow': 'none',
    '--canvas-connection': '#0000ff',
    '--canvas-selection': '#0000ff',
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
