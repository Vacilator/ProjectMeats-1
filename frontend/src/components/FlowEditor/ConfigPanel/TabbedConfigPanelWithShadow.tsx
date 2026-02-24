/**
 * TabbedConfigPanelWithShadow
 * 
 * Wrapper around TabbedConfigPanel that adds shadow state management.
 * 
 * Features:
 * - Non-destructive editing (changes staged in shadowConfig)
 * - Apply/Discard buttons
 * - Dirty indicator
 * - Confirmation on close with unsaved changes
 * - Tabbed interface (General, Advanced, Preview)
 * - Animated transitions
 * 
 * Created: 2026-02-24 - Phase D.3 Tabbed Config Enhancement
 */

import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { Node, Edge } from '@xyflow/react';
import { AlertCircle } from 'lucide-react';
import { TabbedConfigPanel } from './TabbedConfigPanel';
import { useNodeShadowState } from '../hooks/useNodeShadowState';
import {
  PrimaryButton,
  SecondaryButton,
  DangerButton,
} from './shared/StyledComponents';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface TabbedConfigPanelWithShadowProps {
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onClose: () => void;
  onUpdate: (nodeId: string, data: Record<string, any>) => void;
  onTest?: (nodeId: string) => void;
  onSelectNode?: (nodeId: string) => void;
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

const DialogBox = styled.div`
  background: rgb(var(--color-surface));
  border-radius: var(--radius-lg);
  padding: 24px;
  min-width: 400px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
`;

const DialogHeader = styled.h3`
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
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

export const TabbedConfigPanelWithShadow: React.FC<TabbedConfigPanelWithShadowProps> = ({
  node,
  nodes,
  edges,
  setNodes,
  setEdges,
  onClose,
  onUpdate,
  onTest,
  onSelectNode,
}) => {
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  
  // Use shadow state hook
  const {
    shadowConfig,
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
    
    console.log('[Shadow State] Applied changes to node:', node.id);
  }, [node, commitShadow, onUpdate, shadowConfig]);

  // Handle discard
  const handleDiscard = useCallback(() => {
    discardShadow();
    console.log('[Shadow State] Discarded changes');
  }, [discardShadow]);

  // Handle close with confirmation if dirty
  const handleClose = useCallback(() => {
    if (isDirty) {
      setShowCloseConfirmation(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  // Confirm close without saving
  const confirmClose = useCallback(() => {
    discardShadow();
    setShowCloseConfirmation(false);
    onClose();
  }, [discardShadow, onClose]);

  if (!node) return null;

  return (
    <>
      <ShadowWrapper>
        {/* Dirty Indicator Banner */}
        <DirtyIndicatorBanner $show={isDirty}>
          <AlertCircle size={18} />
          <span>You have unsaved changes</span>
        </DirtyIndicatorBanner>

        {/* Main Panel Content */}
        <PanelContent>
          <TabbedConfigPanel
            node={virtualNode}
            nodes={nodes}
            edges={edges}
            onUpdateNode={handleShadowUpdate}
            onClose={handleClose}
            onApply={handleApply}
            onDiscard={handleDiscard}
          />
        </PanelContent>

        {/* Action Bar (Apply/Discard) */}
        <ActionBar $show={isDirty}>
          <SecondaryButton onClick={handleDiscard}>
            Discard Changes
          </SecondaryButton>
          <PrimaryButton onClick={handleApply}>
            Apply Changes
          </PrimaryButton>
        </ActionBar>
      </ShadowWrapper>

      {/* Confirmation Modal */}
      <ConfirmationModal $show={showCloseConfirmation}>
        <DialogBox>
          <DialogHeader>Unsaved Changes</DialogHeader>
          <DialogMessage>
            You have unsaved changes. Do you want to discard them and close the panel?
          </DialogMessage>
          <DialogActions>
            <SecondaryButton onClick={() => setShowCloseConfirmation(false)}>
              Cancel
            </SecondaryButton>
            <DangerButton onClick={confirmClose}>
              Discard & Close
            </DangerButton>
          </DialogActions>
        </DialogBox>
      </ConfirmationModal>
    </>
  );
};
