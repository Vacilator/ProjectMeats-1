/**
 * NodeConfigPanelWithShadow
 * 
 * Phase 2: Shadow State Sidebar
 * Wrapper around NodeConfigPanel that adds shadow state management.
 * 
 * Features:
 * - Non-destructive editing (changes staged in shadowConfig)
 * - Apply/Discard buttons
 * - Dirty indicator
 * - Confirmation on close with unsaved changes
 * - Only creates history entry on Apply (not every keystroke)
 * 
 * Created: 2026-02-12 - Phase 2 Shadow State Implementation
 */

import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { Node } from '@xyflow/react';
import { AlertCircle, X } from 'lucide-react';
import { NodeConfigPanel } from './NodeConfigPanel';
import { useNodeShadowState } from '../hooks/useNodeShadowState';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface NodeConfigPanelWithShadowProps {
  node: Node | null;
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  onClose: () => void;
  onUpdate: (nodeId: string, data: Record<string, any>) => void;
  onTest?: (nodeId: string) => void;
}

// ============================================================================
// Styled Components
// ============================================================================

const ShadowWrapper = styled.div`
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const DirtyIndicatorBanner = styled.div<{ $show: boolean }>`
  display: ${props => props.$show ? 'flex' : 'none'};
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgb(var(--color-warning) / 0.1);
  border-bottom: 1px solid rgb(var(--color-warning) / 0.3);
  color: rgb(var(--color-warning));
  font-size: 14px;
  font-weight: 500;
  
  svg {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
  }
`;

const ActionBar = styled.div<{ $show: boolean }>`
  display: ${props => props.$show ? 'flex' : 'none'};
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  
  ${props => {
    if (props.$variant === 'primary') {
      return `
        background: rgb(var(--color-primary));
        color: white;
        
        &:hover:not(:disabled) {
          background: rgb(var(--color-primary-dark));
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(var(--color-primary), 0.3);
        }
      `;
    } else if (props.$variant === 'danger') {
      return `
        background: rgb(var(--color-error));
        color: white;
        
        &:hover:not(:disabled) {
          background: rgb(var(--color-error-dark));
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(var(--color-error), 0.3);
        }
      `;
    } else {
      return `
        background: rgb(var(--color-surface-hover));
        color: rgb(var(--color-text-primary));
        border: 1px solid rgb(var(--color-border));
        
        &:hover:not(:disabled) {
          background: rgb(var(--color-surface-active));
          border-color: rgb(var(--color-primary));
        }
      `;
    }
  }}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &:active:not(:disabled) {
    transform: scale(0.98);
  }
`;

const ConfirmationModal = styled.div<{ $show: boolean }>`
  display: ${props => props.$show ? 'flex' : 'none'};
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.2s;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const ConfirmationDialog = styled.div`
  background: rgb(var(--color-surface));
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;

const DialogTitle = styled.h3`
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 8px;
  
  svg {
    color: rgb(var(--color-warning));
  }
`;

const DialogMessage = styled.p`
  margin: 0 0 24px 0;
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.5;
`;

const DialogActions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
`;

const PanelContent = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

// ============================================================================
// Component
// ============================================================================

export const NodeConfigPanelWithShadow: React.FC<NodeConfigPanelWithShadowProps> = ({
  node,
  nodes,
  setNodes,
  onClose,
  onUpdate,
  onTest,
}) => {
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  
  // Use shadow state hook
  const {
    shadowConfig,
    configStatus,
    isDirty,
    updateShadow,
    commitShadow,
    discardShadow,
  } = useNodeShadowState(node?.id || null, nodes, setNodes);

  // Create a virtual node with shadow config for the inner panel
  const virtualNode = node ? {
    ...node,
    data: shadowConfig,
  } : null;

  // Handle update from inner panel - write to shadow state
  const handleShadowUpdate = useCallback((nodeId: string, data: Record<string, any>) => {
    updateShadow(data);
  }, [updateShadow]);

  // Handle apply - commit shadow to real config
  const handleApply = useCallback(() => {
    if (!node) return;
    
    // Commit shadow state
    commitShadow();
    
    // Also call the original onUpdate to trigger history
    onUpdate(node.id, shadowConfig);
  }, [node, commitShadow, onUpdate, shadowConfig]);

  // Handle discard - revert to committed config
  const handleDiscard = useCallback(() => {
    discardShadow();
  }, [discardShadow]);

  // Handle close - show confirmation if dirty
  const handleClose = useCallback(() => {
    if (isDirty) {
      setShowCloseConfirmation(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  // Confirm close without saving
  const confirmCloseWithoutSaving = useCallback(() => {
    discardShadow();
    setShowCloseConfirmation(false);
    onClose();
  }, [discardShadow, onClose]);

  // Cancel close confirmation
  const cancelClose = useCallback(() => {
    setShowCloseConfirmation(false);
  }, []);

  // Reset confirmation dialog when node changes
  useEffect(() => {
    setShowCloseConfirmation(false);
  }, [node?.id]);

  return (
    <ShadowWrapper>
      {/* Dirty Indicator Banner */}
      <DirtyIndicatorBanner $show={isDirty}>
        <AlertCircle size={18} />
        <span>You have unsaved changes</span>
      </DirtyIndicatorBanner>

      {/* Inner Panel Content */}
      <PanelContent>
        <NodeConfigPanel
          node={virtualNode}
          onClose={handleClose}
          onUpdate={handleShadowUpdate}
          onTest={onTest}
        />
      </PanelContent>

      {/* Action Bar (Apply/Discard) */}
      <ActionBar $show={isDirty}>
        <ActionButton $variant="secondary" onClick={handleDiscard}>
          Discard Changes
        </ActionButton>
        <ActionButton $variant="primary" onClick={handleApply}>
          Apply Changes
        </ActionButton>
      </ActionBar>

      {/* Close Confirmation Modal */}
      <ConfirmationModal $show={showCloseConfirmation}>
        <ConfirmationDialog>
          <DialogTitle>
            <AlertCircle size={20} />
            Unsaved Changes
          </DialogTitle>
          <DialogMessage>
            You have unsaved changes. Are you sure you want to close without applying them?
          </DialogMessage>
          <DialogActions>
            <ActionButton $variant="secondary" onClick={cancelClose}>
              Cancel
            </ActionButton>
            <ActionButton $variant="danger" onClick={confirmCloseWithoutSaving}>
              Close Without Saving
            </ActionButton>
          </DialogActions>
        </ConfirmationDialog>
      </ConfirmationModal>
    </ShadowWrapper>
  );
};
