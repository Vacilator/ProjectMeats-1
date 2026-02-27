/**
 * Unit Tests for Theme Configuration
 * 
 * Tests theme modes, configuration generation, and canvas theme application.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ThemeMode,
  getThemeConfig,
  applyCanvasTheme,
  lightTheme,
  darkTheme,
  highContrastTheme,
  canvasThemeVars,
} from './themeConfig';

describe('Theme Configuration', () => {
  describe('getThemeConfig', () => {
    it('returns light theme for light mode', () => {
      const config = getThemeConfig('light');
      expect(config).toEqual(lightTheme);
      expect(config.token?.colorPrimary).toBe('#667eea');
    });

    it('returns dark theme for dark mode', () => {
      const config = getThemeConfig('dark');
      expect(config).toEqual(darkTheme);
      expect(config.token?.colorPrimary).toBe('#818cf8');
    });

    it('returns high contrast theme for high-contrast mode', () => {
      const config = getThemeConfig('high-contrast');
      expect(config).toEqual(highContrastTheme);
      expect(config.token?.colorPrimary).toBe('#0000ff');
    });

    it('defaults to light theme for unknown mode', () => {
      const config = getThemeConfig('unknown' as ThemeMode);
      expect(config).toEqual(lightTheme);
    });
  });

  describe('Theme Token Values', () => {
    it('light theme has correct tokens', () => {
      expect(lightTheme.token).toMatchObject({
        colorPrimary: '#667eea',
        colorSuccess: '#22c55e',
        colorWarning: '#eab308',
        colorError: '#ef4444',
        colorInfo: '#3b82f6',
        fontSize: 14,
        borderRadius: 6,
      });
    });

    it('dark theme has correct tokens', () => {
      expect(darkTheme.token).toMatchObject({
        colorPrimary: '#818cf8',
        colorSuccess: '#4ade80',
        colorWarning: '#fbbf24',
        colorError: '#f87171',
        colorInfo: '#60a5fa',
        fontSize: 14,
        borderRadius: 6,
      });
    });

    it('high contrast theme has accessibility-focused tokens', () => {
      expect(highContrastTheme.token).toMatchObject({
        colorPrimary: '#0000ff',
        colorSuccess: '#008000',
        colorWarning: '#ffaa00',
        colorError: '#cc0000',
        fontSize: 16, // Larger for accessibility
        borderRadius: 2, // Sharper edges
        lineWidth: 2, // Thicker borders
      });
    });

    it('high contrast theme has larger touch targets', () => {
      expect(highContrastTheme.components?.Button?.controlHeight).toBe(44);
      expect(highContrastTheme.components?.Input?.controlHeight).toBe(44);
    });
  });

  describe('Canvas Theme Variables', () => {
    it('has variables for all three modes', () => {
      expect(canvasThemeVars.light).toBeDefined();
      expect(canvasThemeVars.dark).toBeDefined();
      expect(canvasThemeVars['high-contrast']).toBeDefined();
    });

    it('light theme has light colors', () => {
      expect(canvasThemeVars.light['--canvas-bg']).toBe('#f9fafb');
      expect(canvasThemeVars.light['--canvas-node-bg']).toBe('#ffffff');
    });

    it('dark theme has dark colors', () => {
      expect(canvasThemeVars.dark['--canvas-bg']).toBe('#0a0a0a');
      expect(canvasThemeVars.dark['--canvas-node-bg']).toBe('#1a1a1a');
    });

    it('high contrast theme has maximum contrast', () => {
      expect(canvasThemeVars['high-contrast']['--canvas-bg']).toBe('#ffffff');
      expect(canvasThemeVars['high-contrast']['--canvas-node-border']).toBe('#000000');
      expect(canvasThemeVars['high-contrast']['--canvas-node-shadow']).toBe('none');
    });
  });

  describe('applyCanvasTheme', () => {
    let mockRoot: HTMLElement;

    beforeEach(() => {
      mockRoot = document.documentElement;
      // Clear any existing custom properties
      mockRoot.style.cssText = '';
    });

    afterEach(() => {
      mockRoot.style.cssText = '';
    });

    it('applies light theme CSS variables to document', () => {
      applyCanvasTheme('light');
      
      expect(mockRoot.style.getPropertyValue('--canvas-bg')).toBe('#f9fafb');
      expect(mockRoot.style.getPropertyValue('--canvas-grid')).toBe('#e5e7eb');
      expect(mockRoot.style.getPropertyValue('--canvas-connection')).toBe('#667eea');
    });

    it('applies dark theme CSS variables to document', () => {
      applyCanvasTheme('dark');
      
      expect(mockRoot.style.getPropertyValue('--canvas-bg')).toBe('#0a0a0a');
      expect(mockRoot.style.getPropertyValue('--canvas-grid')).toBe('#333333');
      expect(mockRoot.style.getPropertyValue('--canvas-connection')).toBe('#818cf8');
    });

    it('applies high contrast theme CSS variables to document', () => {
      applyCanvasTheme('high-contrast');
      
      expect(mockRoot.style.getPropertyValue('--canvas-bg')).toBe('#ffffff');
      expect(mockRoot.style.getPropertyValue('--canvas-node-border')).toBe('#000000');
      expect(mockRoot.style.getPropertyValue('--canvas-node-shadow')).toBe('none');
    });

    it('applies all required CSS variables', () => {
      applyCanvasTheme('light');
      
      const requiredVars = [
        '--canvas-bg',
        '--canvas-grid',
        '--canvas-node-bg',
        '--canvas-node-border',
        '--canvas-node-shadow',
        '--canvas-connection',
        '--canvas-selection',
      ];

      requiredVars.forEach((varName) => {
        expect(mockRoot.style.getPropertyValue(varName)).not.toBe('');
      });
    });
  });
});
