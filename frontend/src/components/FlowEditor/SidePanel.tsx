/**
 * Side Panel Wrapper
 * 
 * Portal-based wrapper for slide-in configuration panels.
 * Renders panel content outside the editor DOM hierarchy to avoid z-index and overflow issues.
 * 
 * Features:
 * - Uses React Portal for proper rendering
 * - Fixed positioning relative to viewport
 * - Backdrop with click-to-close
 * - Escape key support
 * - Slide-in animation
 * 
 * Created: 2026-02-05 - Fix for form node modals not rendering
 */
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const SidePanel: React.FC<SidePanelProps> = ({ isOpen, onClose, children }) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return ReactDOM.createPortal(
    <Backdrop onClick={handleBackdropClick}>
      <PanelContent onClick={(e) => e.stopPropagation()}>
        {children}
      </PanelContent>
    </Backdrop>,
    document.body
  );
};

const Backdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  justify-content: flex-end;
  align-items: stretch;
`;

const PanelContent = styled.div`
  position: relative;
  width: 450px;
  max-width: 90vw;
  background: rgb(var(--color-surface));
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
  animation: slideIn 0.25s ease-out;
  overflow-y: auto;

  @keyframes slideIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgb(var(--color-background));
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgb(var(--color-border));
    border-radius: 4px;
  }
`;

export default SidePanel;
