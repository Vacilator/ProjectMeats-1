/**
 * @fileoverview Custom hook for managing screen reader announcements
 * @module FlowEditor/hooks/useScreenReaderAnnouncements
 * 
 * Provides polite and assertive announcements for screen readers.
 * Implements ARIA live regions for dynamic content updates.
 * 
 * @see Phase 7.6: Accessibility & i18n
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Priority level for announcements
 * - 'polite': Wait for user to finish current action
 * - 'assertive': Interrupt immediately (use sparingly)
 */
export type AnnouncementPriority = 'polite' | 'assertive';

/**
 * Hook for managing screen reader announcements
 * 
 * Creates ARIA live regions and provides announce function.
 * Handles announcement queue and timing to prevent overwhelming users.
 * 
 * @example
 * ```typescript
 * const { announce } = useScreenReaderAnnouncements();
 * 
 * // Polite announcement (default)
 * announce('Node added to workflow');
 * 
 * // Assertive announcement (urgent)
 * announce('Error: Failed to save workflow', 'assertive');
 * ```
 */
export function useScreenReaderAnnouncements() {
  const politeRegionRef = useRef<HTMLDivElement | null>(null);
  const assertiveRegionRef = useRef<HTMLDivElement | null>(null);
  const announcementQueue = useRef<Array<{ message: string; priority: AnnouncementPriority }>>([]);
  const isProcessing = useRef(false);

  // Create live regions on mount
  useEffect(() => {
    // Create polite region
    const politeRegion = document.createElement('div');
    politeRegion.setAttribute('role', 'status');
    politeRegion.setAttribute('aria-live', 'polite');
    politeRegion.setAttribute('aria-atomic', 'true');
    politeRegion.className = 'sr-only'; // Visually hidden
    politeRegion.style.cssText = `
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;
    document.body.appendChild(politeRegion);
    politeRegionRef.current = politeRegion;

    // Create assertive region
    const assertiveRegion = document.createElement('div');
    assertiveRegion.setAttribute('role', 'alert');
    assertiveRegion.setAttribute('aria-live', 'assertive');
    assertiveRegion.setAttribute('aria-atomic', 'true');
    assertiveRegion.className = 'sr-only'; // Visually hidden
    assertiveRegion.style.cssText = `
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;
    document.body.appendChild(assertiveRegion);
    assertiveRegionRef.current = assertiveRegion;

    // Cleanup on unmount
    return () => {
      if (politeRegionRef.current) {
        document.body.removeChild(politeRegionRef.current);
      }
      if (assertiveRegionRef.current) {
        document.body.removeChild(assertiveRegionRef.current);
      }
    };
  }, []);

  // Process announcement queue
  const processQueue = useCallback(() => {
    if (isProcessing.current || announcementQueue.current.length === 0) {
      return;
    }

    isProcessing.current = true;
    const { message, priority } = announcementQueue.current.shift()!;

    const region =
      priority === 'assertive'
        ? assertiveRegionRef.current
        : politeRegionRef.current;

    if (!region) {
      isProcessing.current = false;
      return;
    }

    // Clear previous announcement
    region.textContent = '';

    // Brief delay ensures screen readers detect the change
    setTimeout(() => {
      region.textContent = message;

      // Clear after announcement (prevents re-reading on focus)
      setTimeout(() => {
        region.textContent = '';
        isProcessing.current = false;
        processQueue(); // Process next in queue
      }, 1000);
    }, 100);
  }, []);

  // Announce function
  const announce = useCallback(
    (message: string, priority: AnnouncementPriority = 'polite') => {
      if (!message.trim()) return;

      announcementQueue.current.push({ message, priority });
      processQueue();
    },
    [processQueue]
  );

  return { announce };
}

/**
 * Hook for focus management
 * 
 * Provides utilities for managing focus in complex UI:
 * - Focus trapping in modals
 * - Focus restoration after dismissal
 * - Skip links for navigation
 * 
 * @example
 * ```typescript
 * const { trapFocus, restoreFocus } = useFocusManagement();
 * 
 * const handleOpenModal = () => {
 *   trapFocus(modalRef.current);
 * };
 * 
 * const handleCloseModal = () => {
 *   restoreFocus();
 * };
 * ```
 */
export function useFocusManagement() {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const focusTrapRef = useRef<HTMLElement | null>(null);

  /**
   * Trap focus within container (for modals, dialogs)
   */
  const trapFocus = useCallback((container: HTMLElement | null) => {
    if (!container) return;

    // Save current focus
    previousFocusRef.current = document.activeElement as HTMLElement;
    focusTrapRef.current = container;

    // Get focusable elements
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = Array.from(
      container.querySelectorAll<HTMLElement>(focusableSelector)
    );

    if (focusableElements.length === 0) return;

    // Focus first element
    focusableElements[0].focus();

    // Handle Tab key
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: If on first, wrap to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: If on last, wrap to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTab);

    return () => {
      container.removeEventListener('keydown', handleTab);
    };
  }, []);

  /**
   * Restore focus to previous element
   */
  const restoreFocus = useCallback(() => {
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
    focusTrapRef.current = null;
  }, []);

  /**
   * Move focus to specific element with optional delay
   */
  const moveFocus = useCallback((element: HTMLElement | null, delay = 0) => {
    if (!element) return;

    if (delay > 0) {
      setTimeout(() => element.focus(), delay);
    } else {
      element.focus();
    }
  }, []);

  return {
    trapFocus,
    restoreFocus,
    moveFocus,
  };
}

/**
 * Hook for reduced motion preference
 * 
 * Detects user's motion preference and provides flag for conditional animations.
 * 
 * @example
 * ```typescript
 * const prefersReducedMotion = useReducedMotion();
 * 
 * <animated.div
 *   style={{
 *     transition: prefersReducedMotion ? 'none' : 'all 0.3s ease',
 *   }}
 * />
 * ```
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

/**
 * Hook for high contrast mode detection
 * 
 * Detects Windows High Contrast mode or forced-colors media query.
 * 
 * @example
 * ```typescript
 * const isHighContrast = useHighContrastMode();
 * 
 * // Adjust UI for high contrast
 * <div className={isHighContrast ? 'high-contrast' : 'normal'}>
 * ```
 */
export function useHighContrastMode(): boolean {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(forced-colors: active)');
    setIsHighContrast(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsHighContrast(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return isHighContrast;
}
