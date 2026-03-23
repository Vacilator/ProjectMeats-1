/**
 * Dry Run Debugger Panel (Phase 9.5)
 *
 * Fixed-position slide-in panel wrapper for the existing DryRunDebugger.
 *
 * Goal: make breakpoints + execution timeline + step-through debugging
 * discoverable and usable without disturbing the canvas layout.
 */

import React from 'react';
import styled from 'styled-components';
import { X, Bug } from 'lucide-react';
import type { Node } from '@xyflow/react';

import { DryRunDebugger } from '../components/DryRunDebugger';

export interface DryRunDebuggerPanelProps {
  isVisible: boolean;
  selectedNode: Node | null;
  onClose: () => void;
}

const PanelOverlay = styled.div<{ $isVisible: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: ${(props) => (props.$isVisible ? '520px' : '0')};
  background: rgb(var(--color-background));
  border-left: 1px solid rgb(var(--color-border));
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
  z-index: 120;
  transition: width 0.25s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
`;

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const CloseButton = styled.button`
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgb(var(--color-background));
    color: rgb(var(--color-text-primary));
  }
`;

const PanelBody = styled.div`
  flex: 1;
  overflow: auto;
`;

export const DryRunDebuggerPanel: React.FC<DryRunDebuggerPanelProps> = ({
  isVisible,
  selectedNode,
  onClose,
}) => {
  return (
    <PanelOverlay $isVisible={isVisible} aria-hidden={!isVisible}>
      <PanelHeader>
        <HeaderTitle>
          <Bug size={16} aria-hidden="true" />
          Debugger
        </HeaderTitle>
        <CloseButton onClick={onClose} aria-label="Close debugger">
          <X size={18} aria-hidden="true" />
        </CloseButton>
      </PanelHeader>

      <PanelBody>
        <DryRunDebugger selectedNode={selectedNode} onClose={onClose} />
      </PanelBody>
    </PanelOverlay>
  );
};
