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

/**
 * Check if user is currently typing in an input field or other text-entry context
 * 
 * This prevents global keyboard shortcuts (like Delete, Backspace, Space, /, etc.)
 * from triggering when user is typing in:
 * - Text inputs
 * - Textareas
 * - ContentEditable elements
 * - Monaco editor instances
 * - Config panels (marked with data-config-panel)
 * - Modals (marked with data-modal or role="dialog")
 * 
 * @param event - Keyboard event
 * @returns true if user is typing in an input context
 */
export function isTypingInInput(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement;
  
  // Direct input/textarea/select check
  if (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  ) {
    return true;
  }
  
  // ContentEditable check
  if (
    target.isContentEditable ||
    target.getAttribute('contenteditable') === 'true'
  ) {
    return true;
  }
  
  // Monaco editor check (look for Monaco-specific classes)
  if (
    target.classList.contains('monaco-editor') ||
    target.closest('.monaco-editor') !== null
  ) {
    return true;
  }
  
  // Config panel check (any element with data-config-panel attribute)
  if (target.closest('[data-config-panel]') !== null) {
    return true;
  }
  
  // Modal check (any element with data-modal or role="dialog")
  if (
    target.closest('[data-modal]') !== null ||
    target.closest('[role="dialog"]') !== null
  ) {
    return true;
  }
  
  // Check if element is inside a form
  if (target.closest('form') !== null) {
    return true;
  }
  
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
