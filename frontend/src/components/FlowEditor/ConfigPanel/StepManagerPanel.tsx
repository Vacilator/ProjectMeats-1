/**
 * StepManagerPanel Component
 * 
 * Step management UI for Form Process containers.
 * Allows users to view, reorder, add, and configure child steps.
 * 
 * Features:
 * - List all child nodes in execution order
 * - Drag to reorder steps
 * - Quick add new step button
 * - Delete step with confirmation
 * - Edit step name inline
 * - Navigate to step configuration
 * - Visual step numbers and icons
 * 
 * Created: 2026-02-17 - Phase B.4: Step Management UI
 */

import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { 
  GripVertical, 
  Plus, 
  Trash2, 
  Edit2, 
  Settings, 
  CheckCircle,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { Node, Edge } from '@xyflow/react';
import { calculateStepOrder } from '../utils/stepOrderingUtils';
import { confirmDialog } from '@/utils/uiDialogs';
import {
  EmptyState,
  EmptyIcon,
  EmptyText,
  PrimaryButton,
  SecondaryButton,
} from './shared/StyledComponents';

// ============================================================================
// TypeScript Types
// ============================================================================

interface StepManagerPanelProps {
  /** Container node ID */
  containerId: string;
  /** All nodes in the flow */
  nodes: Node[];
  /** All edges in the flow */
  edges: Edge[];
  /** Callback to select a node */
  onSelectNode: (nodeId: string) => void;
  /** Callback to delete a node */
  onDeleteNode: (nodeId: string) => void;
  /** Callback to add a new step */
  onAddStep: () => void;
  /** Callback to update node data */
  onUpdateNode: (nodeId: string, data: Partial<Node['data']>) => void;
  /** Callback to reorder steps */
  onReorderSteps: (nodeIds: string[]) => void;
}

interface StepInfo {
  id: string;
  type: string;
  label: string;
  stepNumber: number | null;
  hasErrors: boolean;
  isConfigured: boolean;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: rgb(var(--color-surface));
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border));
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const Title = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const StepCount = styled.span`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  font-weight: normal;
`;



const StepList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgb(var(--color-background));
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgb(var(--color-border));
    border-radius: 3px;

    &:hover {
      background: rgb(var(--color-text-secondary));
    }
  }
`;

const StepItem = styled.div<{ $isDragging?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  cursor: move;
  transition: all 0.2s;
  opacity: ${props => props.$isDragging ? 0.5 : 1};

  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 2px 8px rgba(var(--color-primary), 0.1);
  }
`;

const DragHandle = styled.div`
  display: flex;
  align-items: center;
  color: rgb(var(--color-text-secondary));
  cursor: grab;

  &:active {
    cursor: grabbing;
  }

  svg {
    width: 20px;
    height: 20px;
  }
`;

const StepNumber = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: rgb(var(--color-primary));
  color: rgb(var(--color-text-inverse));
  border-radius: 50%;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
`;

const StepContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

const StepLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StepType = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const StepStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));

  svg {
    width: 14px;
    height: 14px;
  }

  &.configured {
    color: rgb(var(--color-success)); /* Success green */
  }

  &.error {
    color: rgb(var(--color-error)); /* Error red */
  }
`;

const StepActions = styled.div`
  display: flex;
  gap: 4px;
  flex-shrink: 0;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: 1px solid rgb(var(--color-border));
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  color: rgb(var(--color-text-secondary));

  &:hover {
    background: rgb(var(--color-surface));
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
  }

  &.delete:hover {
    border-color: rgb(var(--color-error));
    color: rgb(var(--color-error));
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;



// ============================================================================
// Component
// ============================================================================

export const StepManagerPanel: React.FC<StepManagerPanelProps> = ({
  containerId,
  nodes,
  edges,
  onSelectNode,
  onDeleteNode,
  onAddStep,
  onUpdateNode,
  onReorderSteps,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Get child nodes
  const childNodes = nodes.filter(n => n.parentId === containerId);

  // Calculate step order
  const stepOrder = calculateStepOrder(containerId, nodes, edges);

  // Build step info list
  const steps: StepInfo[] = childNodes.map(node => {
    const stepNumber = stepOrder.get(node.id) || null;
    const selectedFields = (node.data as any)?.selectedFields;
    const hasSelectedFields = Array.isArray(selectedFields) && selectedFields.length > 0;

    return {
      id: node.id,
      type: node.type || 'unknown',
      label: String((node.data as any)?.label ?? (node.data as any)?.name ?? `${node.type || 'Node'} ${node.id.slice(0, 8)}`),
      stepNumber,
      hasErrors: false, // TODO: Add validation logic
      isConfigured: Boolean((node.data as any)?.entityType) || hasSelectedFields,
    };
  }).sort((a, b) => {
    // Sort by step number (nulls at end)
    if (a.stepNumber === null && b.stepNumber === null) return 0;
    if (a.stepNumber === null) return 1;
    if (b.stepNumber === null) return -1;
    return a.stepNumber - b.stepNumber;
  });

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    // Reorder steps
    const newSteps = [...steps];
    const [removed] = newSteps.splice(draggedIndex, 1);
    newSteps.splice(targetIndex, 0, removed);

    // Call reorder callback with new order
    onReorderSteps(newSteps.map(s => s.id));
    setDraggedIndex(null);
  }, [draggedIndex, steps, onReorderSteps]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  // Handle delete with confirmation
  const handleDelete = useCallback((stepId: string, stepLabel: string) => {
    void (async () => {
      const confirmed = await confirmDialog({
        title: 'Delete step?',
        content: `Are you sure you want to delete "${stepLabel}"?\n\nThis will remove the step and all its connections.`,
        okText: 'Delete',
        cancelText: 'Cancel',
        danger: true,
      });

      if (confirmed) {
        onDeleteNode(stepId);
      }
    })();
  }, [onDeleteNode]);

  return (
    <Container>
      <Header>
        <Title>
          Steps <StepCount>({steps.length})</StepCount>
        </Title>
        <PrimaryButton onClick={onAddStep}>
          <Plus />
          Add Step
        </PrimaryButton>
      </Header>

      {steps.length === 0 ? (
        <EmptyState>
          <ArrowRight />
          <p>No steps yet</p>
          <p>Drag nodes from the palette into the container<br />or click "Add Step" to create one</p>
        </EmptyState>
      ) : (
        <StepList>
          {steps.map((step, index) => (
            <StepItem
              key={step.id}
              draggable
              $isDragging={draggedIndex === index}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              <DragHandle>
                <GripVertical />
              </DragHandle>

              {step.stepNumber !== null && (
                <StepNumber>{step.stepNumber}</StepNumber>
              )}

              <StepContent>
                <StepLabel>{step.label}</StepLabel>
                <StepType>{step.type}</StepType>
                {step.isConfigured && (
                  <StepStatus className="configured">
                    <CheckCircle />
                    Configured
                  </StepStatus>
                )}
                {step.hasErrors && (
                  <StepStatus className="error">
                    <AlertCircle />
                    Has errors
                  </StepStatus>
                )}
              </StepContent>

              <StepActions>
                <ActionButton
                  onClick={() => onSelectNode(step.id)}
                  title="Configure step"
                >
                  <Settings />
                </ActionButton>
                <ActionButton
                  className="delete"
                  onClick={() => handleDelete(step.id, step.label)}
                  title="Delete step"
                >
                  <Trash2 />
                </ActionButton>
              </StepActions>
            </StepItem>
          ))}
        </StepList>
      )}
    </Container>
  );
};
