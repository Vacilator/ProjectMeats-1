/**
 * Accessibility Utilities for ProjectMeats
 * 
 * Provides utilities for ensuring WCAG 2.1 AA compliance across the application.
 * Use these utilities to verify accessibility in components and pages.
 */

/**
 * Minimum contrast ratio for WCAG AA compliance
 * - Normal text (< 18pt): 4.5:1
 * - Large text (>= 18pt or >= 14pt bold): 3:1
 */
export const WCAG_AA_CONTRAST = {
  normalText: 4.5,
  largeText: 3.0,
} as const;

/**
 * Minimum touch target size (WCAG 2.5.5 Target Size)
 * - Minimum 44x44 CSS pixels
 */
export const MIN_TOUCH_TARGET = 44;

/**
 * Calculate relative luminance for a color
 * @see https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * @see https://www.w3.org/WAI/GL/wiki/Contrast_ratio
 */
export function getContrastRatio(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number }
): number {
  const l1 = getLuminance(color1.r, color1.g, color1.b);
  const l2 = getLuminance(color2.r, color2.g, color2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parse a CSS color string to RGB values
 */
export function parseColor(color: string): { r: number; g: number; b: number } | null {
  // Handle hex colors
  const hexMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16),
    };
  }

  // Handle rgb/rgba
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }

  return null;
}

/**
 * Check if a contrast ratio meets WCAG AA requirements
 */
export function meetsContrastRequirements(
  ratio: number,
  isLargeText = false
): boolean {
  return ratio >= (isLargeText ? WCAG_AA_CONTRAST.largeText : WCAG_AA_CONTRAST.normalText);
}

/**
 * Accessibility audit result for a single element
 */
export interface A11yAuditIssue {
  element: string;
  issue: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  wcagCriteria: string;
  recommendation: string;
}

/**
 * Check for common accessibility issues in the DOM
 * This is a lightweight alternative to axe-core for quick checks
 */
export function quickA11yAudit(container: HTMLElement): A11yAuditIssue[] {
  const issues: A11yAuditIssue[] = [];

  // Check for images without alt text
  const images = container.querySelectorAll('img');
  images.forEach((img) => {
    if (!img.hasAttribute('alt')) {
      issues.push({
        element: `<img src="${img.src.substring(0, 50)}...">`,
        issue: 'Image missing alt attribute',
        severity: 'critical',
        wcagCriteria: '1.1.1 Non-text Content',
        recommendation: 'Add descriptive alt text or alt="" for decorative images',
      });
    }
  });

  // Check for form inputs without labels
  const inputs = container.querySelectorAll('input, select, textarea');
  inputs.forEach((input) => {
    const id = input.id;
    const hasLabel = id && container.querySelector(`label[for="${id}"]`);
    const hasAriaLabel = input.hasAttribute('aria-label');
    const hasAriaLabelledBy = input.hasAttribute('aria-labelledby');
    const isHidden = input.getAttribute('type') === 'hidden';

    if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy && !isHidden) {
      issues.push({
        element: `<${input.tagName.toLowerCase()} id="${id || 'none'}">`,
        issue: 'Form input missing accessible label',
        severity: 'critical',
        wcagCriteria: '1.3.1 Info and Relationships',
        recommendation: 'Add a <label for="..."> or aria-label/aria-labelledby',
      });
    }
  });

  // Check for buttons without accessible names
  const buttons = container.querySelectorAll('button, [role="button"]');
  buttons.forEach((btn) => {
    const hasText = btn.textContent?.trim();
    const hasAriaLabel = btn.hasAttribute('aria-label');
    const hasAriaLabelledBy = btn.hasAttribute('aria-labelledby');
    const hasTitle = btn.hasAttribute('title');

    if (!hasText && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
      issues.push({
        element: `<button>`,
        issue: 'Button missing accessible name',
        severity: 'serious',
        wcagCriteria: '4.1.2 Name, Role, Value',
        recommendation: 'Add text content, aria-label, or aria-labelledby',
      });
    }
  });

  // Check for links without href or accessible names
  const links = container.querySelectorAll('a');
  links.forEach((link) => {
    if (!link.hasAttribute('href') && link.getAttribute('role') !== 'button') {
      issues.push({
        element: `<a>${link.textContent?.substring(0, 20)}...</a>`,
        issue: 'Link missing href attribute',
        severity: 'serious',
        wcagCriteria: '2.1.1 Keyboard',
        recommendation: 'Add href or use role="button" for non-navigational actions',
      });
    }
  });

  // Check for missing heading structure
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
  let lastLevel = 0;
  headings.forEach((heading) => {
    const level = parseInt(heading.tagName[1], 10);
    if (level - lastLevel > 1 && lastLevel !== 0) {
      issues.push({
        element: `<${heading.tagName.toLowerCase()}>`,
        issue: `Heading level skipped (h${lastLevel} to h${level})`,
        severity: 'moderate',
        wcagCriteria: '1.3.1 Info and Relationships',
        recommendation: `Use h${lastLevel + 1} instead of h${level}`,
      });
    }
    lastLevel = level;
  });

  // Check for missing language attribute on root
  if (!document.documentElement.hasAttribute('lang')) {
    issues.push({
      element: '<html>',
      issue: 'Page missing lang attribute',
      severity: 'serious',
      wcagCriteria: '3.1.1 Language of Page',
      recommendation: 'Add lang="en" (or appropriate language) to <html>',
    });
  }

  // Check for focus visibility (tabindex > 0 is problematic)
  const focusableWithTabindex = container.querySelectorAll('[tabindex]');
  focusableWithTabindex.forEach((el) => {
    const tabindex = parseInt(el.getAttribute('tabindex') || '0', 10);
    if (tabindex > 0) {
      issues.push({
        element: `<${el.tagName.toLowerCase()} tabindex="${tabindex}">`,
        issue: 'Positive tabindex disrupts natural focus order',
        severity: 'moderate',
        wcagCriteria: '2.4.3 Focus Order',
        recommendation: 'Use tabindex="0" or "-1" instead of positive values',
      });
    }
  });

  return issues;
}

/**
 * Generate an accessibility report in HTML format
 */
export function generateA11yReport(issues: A11yAuditIssue[]): string {
  if (issues.length === 0) {
    return '<div class="a11y-report success">✓ No accessibility issues found</div>';
  }

  const bySeverity = {
    critical: issues.filter((i) => i.severity === 'critical'),
    serious: issues.filter((i) => i.severity === 'serious'),
    moderate: issues.filter((i) => i.severity === 'moderate'),
    minor: issues.filter((i) => i.severity === 'minor'),
  };

  let html = '<div class="a11y-report">';
  html += `<h2>Accessibility Audit: ${issues.length} issue(s) found</h2>`;

  for (const [severity, items] of Object.entries(bySeverity)) {
    if (items.length > 0) {
      html += `<h3>${severity.toUpperCase()} (${items.length})</h3>`;
      html += '<ul>';
      items.forEach((issue) => {
        html += `<li>
          <strong>${issue.issue}</strong><br>
          Element: <code>${issue.element}</code><br>
          WCAG: ${issue.wcagCriteria}<br>
          Fix: ${issue.recommendation}
        </li>`;
      });
      html += '</ul>';
    }
  }

  html += '</div>';
  return html;
}

/**
 * Hook to run accessibility audit after component mount (dev only)
 */
export function useA11yAudit(containerRef: React.RefObject<HTMLElement>): A11yAuditIssue[] {
  const [issues, setIssues] = React.useState<A11yAuditIssue[]>([]);

  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development' && containerRef.current) {
      const auditIssues = quickA11yAudit(containerRef.current);
      setIssues(auditIssues);
      
      if (auditIssues.length > 0) {
        console.group('🔍 Accessibility Issues');
        auditIssues.forEach((issue) => {
          console.warn(`[${issue.severity.toUpperCase()}] ${issue.issue}`, {
            element: issue.element,
            wcag: issue.wcagCriteria,
            fix: issue.recommendation,
          });
        });
        console.groupEnd();
      }
    }
  }, [containerRef]);

  return issues;
}

// Import React for the hook
import React from 'react';
