/**
 * usePanelState Hook
 * 
 * Phase E.1: Foundation - Step 2/4 (Shared Hooks)
 * 
 * Manages panel visibility, z-index stacking, and focus management.
 * Used by config panels, sidebars, and overlays.
 * 
 * Features:
 * - Panel open/close state
 * - Z-index management for stacking
 * - Focus trap management
 * - Escape key handling
 * - Outside click detection
 * 
 * @example
 * ```typescript
 * const { isOpen, open, close, zIndex } = usePanelState({
 *   closeOnEscape: true,
 *   closeOnOutsideClick: true,
 * });
 * ```
 * 
 * Created: 2026-02-17 - Phase E.1 FlowEditor Refactoring
 */
import { useState, useCallback, useEffect, useRef } from 'react';

export interface UsePanelStateOptions {
  /**
   * Initial open state
   * @default false
   */
  defaultOpen?: boolean;
  
  /**
   * Base z-index for panel
   * @default 1000
   */
  baseZIndex?: number;
  
  /**
   * Close panel on Escape key
   * @default true
   */
  closeOnEscape?: boolean;
  
  /**
   * Close panel on outside click
   * @default false
   */
  closeOnOutsideClick?: boolean;
  
  /**
   * Callback when panel opens
   */
  onOpen?: () => void;
  
  /**
   * Callback when panel closes
   */
  onClose?: () => void;
  
  /**
   * ID for managing z-index stack
   */
  id?: string;
}

export interface UsePanelStateReturn {
  /**
   * Whether panel is open
   */
  isOpen: boolean;
  
  /**
   * Current z-index of panel
   */
  zIndex: number;
  
  /**
   * Open the panel
   */
  open: () => void;
  
  /**
   * Close the panel
   */
  close: () => void;
  
  /**
   * Toggle panel open/close
   */
  toggle: () => void;
  
  /**
   * Ref to attach to panel container
   */
  panelRef: React.RefObject<HTMLDivElement | null>;
  
  /**
   * Bring panel to front (increase z-index)
   */
  bringToFront: () => void;
}

// Global z-index counter for stacking panels
let globalZIndexCounter = 1000;

/**
 * Hook for managing panel state with z-index and keyboard handling
 * 
 * @example
 * ```typescript
 * const ConfigPanel = () => {
 *   const { isOpen, open, close, zIndex, panelRef } = usePanelState({
 *     closeOnEscape: true,
 *     closeOnOutsideClick: true,
 *   });
 *   
 *   return (
 *     <>
 *       <Button onClick={open}>Open Panel</Button>
 *       {isOpen && (
 *         <Panel ref={panelRef} style={{ zIndex }}>
 *           <CloseButton onClick={close}>×</CloseButton>
 *           {/* Panel content *\/}
 *         </Panel>
 *       )}
 *     </>
 *   );
 * };
 * ```
 */
export function usePanelState(options: UsePanelStateOptions = {}): UsePanelStateReturn {
  const {
    defaultOpen = false,
    baseZIndex = 1000,
    closeOnEscape = true,
    closeOnOutsideClick = false,
    onOpen,
    onClose,
    id,
  } = options;
  
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [zIndex, setZIndex] = useState(baseZIndex);
  const panelRef = useRef<HTMLDivElement | null>(null);
  
  const open = useCallback(() => {
    setIsOpen(true);
    setZIndex(++globalZIndexCounter);
    onOpen?.();
  }, [onOpen]);
  
  const close = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);
  
  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);
  
  const bringToFront = useCallback(() => {
    setZIndex(++globalZIndexCounter);
  }, []);
  
  // Handle Escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    
    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [isOpen, closeOnEscape, close]);
  
  // Handle outside click
  useEffect(() => {
    if (!isOpen || !closeOnOutsideClick) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        close();
      }
    };
    
    // Add slight delay to avoid closing immediately on open click
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeOnOutsideClick, close]);
  
  // Focus management - focus panel when opened
  useEffect(() => {
    if (isOpen && panelRef.current) {
      // Focus the panel or first focusable element
      const firstFocusable = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        panelRef.current.focus();
      }
    }
  }, [isOpen]);
  
  return {
    isOpen,
    zIndex,
    open,
    close,
    toggle,
    panelRef,
    bringToFront,
  };
}
