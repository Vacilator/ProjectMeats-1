/**
 * useModalState Hook
 * 
 * Phase E.1: Foundation - Step 2/4 (Shared Hooks)
 * 
 * Replaces 12+ duplicate modal state management patterns across config panels.
 * Provides consistent API for managing modal visibility and transitions.
 * 
 * Before:
 * ```typescript
 * const [isOpen, setIsOpen] = useState(false);
 * const [isClosing, setIsClosing] = useState(false);
 * 
 * const handleOpen = () => setIsOpen(true);
 * const handleClose = () => {
 *   setIsClosing(true);
 *   setTimeout(() => {
 *     setIsOpen(false);
 *     setIsClosing(false);
 *   }, 300);
 * };
 * ```
 * 
 * After:
 * ```typescript
 * const { isOpen, isClosing, open, close, toggle } = useModalState();
 * ```
 * 
 * Created: 2026-02-17 - Phase E.1 FlowEditor Refactoring
 */
import { useState, useCallback } from 'react';

export interface UseModalStateOptions {
  /**
   * Initial open state
   * @default false
   */
  defaultOpen?: boolean;
  
  /**
   * Animation duration in milliseconds
   * @default 300
   */
  animationDuration?: number;
  
  /**
   * Callback when modal opens
   */
  onOpen?: () => void;
  
  /**
   * Callback when modal closes
   */
  onClose?: () => void;
  
  /**
   * Callback when modal starts closing (animation begins)
   */
  onClosing?: () => void;
}

export interface UseModalStateReturn {
  /**
   * Whether modal is currently open
   */
  isOpen: boolean;
  
  /**
   * Whether modal is in closing animation
   */
  isClosing: boolean;
  
  /**
   * Open the modal
   */
  open: () => void;
  
  /**
   * Close the modal with animation
   */
  close: () => void;
  
  /**
   * Toggle modal open/close
   */
  toggle: () => void;
  
  /**
   * Close immediately without animation
   */
  closeImmediate: () => void;
}

/**
 * Hook for managing modal state with animation support
 * 
 * Handles:
 * - Open/close state
 * - Closing animation state
 * - Animation timing
 * - Callbacks
 * 
 * @example
 * ```typescript
 * const MyModal = () => {
 *   const { isOpen, isClosing, open, close } = useModalState({
 *     animationDuration: 300,
 *     onClose: () => logger.debug('Modal closed')
 *   });
 *   
 *   return (
 *     <>
 *       <Button onClick={open}>Open Modal</Button>
 *       {isOpen && (
 *         <ModalOverlay $isClosing={isClosing}>
 *           <ModalContent>
 *             <Button onClick={close}>Close</Button>
 *           </ModalContent>
 *         </ModalOverlay>
 *       )}
 *     </>
 *   );
 * };
 * ```
 */
export function useModalState(options: UseModalStateOptions = {}): UseModalStateReturn {
  const {
    defaultOpen = false,
    animationDuration = 300,
    onOpen,
    onClose,
    onClosing,
  } = options;
  
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isClosing, setIsClosing] = useState(false);
  
  const open = useCallback(() => {
    setIsOpen(true);
    setIsClosing(false);
    onOpen?.();
  }, [onOpen]);
  
  const close = useCallback(() => {
    setIsClosing(true);
    onClosing?.();
    
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      onClose?.();
    }, animationDuration);
  }, [animationDuration, onClose, onClosing]);
  
  const closeImmediate = useCallback(() => {
    setIsOpen(false);
    setIsClosing(false);
    onClose?.();
  }, [onClose]);
  
  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);
  
  return {
    isOpen,
    isClosing,
    open,
    close,
    toggle,
    closeImmediate,
  };
}
