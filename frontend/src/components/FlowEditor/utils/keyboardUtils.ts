/**
 * Keyboard Utility Functions
 * 
 * Phase 4: Keyboard Shortcut Focus Trap Fix
 * Provides utilities to detect when user is typing in input fields
 * to prevent global keyboard shortcuts from interfering.
 * 
 * Usage:
 * ```typescript
 * if (isTypingInInput(event)) {
 *   return; // Skip global shortcut
 * }
 * ```
 * 
 * Created: 2026-02-12 - Phase 4 Keyboard Shortcuts Fix
 */

import type React from 'react';

/**
 * Check if user is currently typing in an input field or other text-entry context
 *
 * Bulletproof focus detection (Phase 7 UX hardening):
 * - Uses document.activeElement (more reliable than event.target for global listeners)
 * - Handles INPUT/TEXTAREA/SELECT, contentEditable, Monaco, AntD inputs/selects, and inline editors
 *
 * @param event - Keyboard event
 * @returns true if user is typing in an input context
 */
export function isTypingInInput(event: KeyboardEvent | React.KeyboardEvent): boolean {
  const activeElement = document.activeElement as HTMLElement | null;
  const fallbackTarget = (event.target as HTMLElement | null) ?? null;
  const el = activeElement ?? fallbackTarget;

  if (!el) return false;

  // 1) Direct input/textarea/select check (active element)
  const tagName = (el.tagName || '').toUpperCase();
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }

  // 2) ContentEditable check
  if (el.isContentEditable) {
    return true;
  }

  // 3) Monaco editor check (.monaco-editor on self or any parent)
  if (el.classList?.contains('monaco-editor') || el.closest?.('.monaco-editor')) {
    return true;
  }

  // 4) AntD / React Flow node / other inline editors
  if (el.closest?.('.ant-select, .ant-input, .react-flow__node')) {
    return true;
  }

  // Existing guards (keep for safety)
  if (el.closest?.('[data-config-panel]')) return true;
  if (el.closest?.('[data-modal]') || el.closest?.('[role="dialog"]')) return true;
  if (el.closest?.('form')) return true;

  return false;
}

/**
 * Check if shortcut should be prevented
 * 
 * Use this as a guard before executing global keyboard shortcuts:
 * ```typescript
 * if (shouldPreventShortcut(event)) return;
 * // Execute shortcut
 * ```
 * 
 * @param event - Keyboard event
 * @returns true if shortcut should be prevented
 */
export function shouldPreventShortcut(event: KeyboardEvent): boolean {
  return isTypingInInput(event);
}

/**
 * Safe keyboard shortcut handler wrapper
 * 
 * Wraps a keyboard shortcut handler to automatically check typing context:
 * ```typescript
 * const handleDelete = safeShortcut(() => {
 *   deleteSelectedNodes();
 * });
 * 
 * document.addEventListener('keydown', handleDelete);
 * ```
 * 
 * @param handler - Shortcut handler function
 * @returns Wrapped handler that checks typing context
 */
export function safeShortcut(
  handler: (event: KeyboardEvent) => void
): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent) => {
    if (shouldPreventShortcut(event)) {
      return; // User is typing, skip shortcut
    }
    handler(event);
  };
}

/**
 * Check if element is a focusable input
 * 
 * Useful for determining if element should receive keyboard focus:
 * ```typescript
 * if (isFocusableInput(element)) {
 *   element.focus();
 * }
 * ```
 * 
 * @param element - DOM element to check
 * @returns true if element is a focusable input
 */
export function isFocusableInput(element: HTMLElement | null): boolean {
  if (!element) return false;
  
  const tag = element.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  
  if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
    return true;
  }
  
  return false;
}
