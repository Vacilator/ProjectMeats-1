/**
 * WorkflowExecutionModal
 *
 * Phase 4 Integration: TaskRenderer + FormSubmissionModal Bridge
 *
 * This component orchestrates workflow execution by routing nodes to
 * the appropriate renderer:
 * - Form steps → FormStep component (via TaskRenderer)
 * - Interaction cards → Interaction card components (via TaskRenderer)
 * - Legacy form submissions → FormSubmissionModal (backward compatibility)
 *
 * Features:
 * - Automatic step progression
 * - Workflow context management
 * - Progress tracking
 * - Auto-save support
 * - Cancel/resume workflows
 *
 * Created: 2026-02-12 - TaskRenderer Integration
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { X, ChevronLeft, Save } from 'lucide-react';
import type { Edge, Node } from '@xyflow/react';
import { TaskRenderer } from './TaskRenderer';
import { useWorkflowContext } from './hooks/useWorkflowContext';
import { notify } from '../../utils/notify';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export type WorkflowNode = Node<any>;

export interface WorkflowExecutionProps {
  /** Workflow definition with nodes */
  workflow: {
    id: string;
    name: string;
    description?: string;
    nodes: WorkflowNode[];
    edges?: Edge<any>[];
  };

  /** Initial workflow execution data */
  execution?: {
    id: string;
    status: 'running' | 'paused' | 'completed' | 'failed';
    current_node_id?: string;
    data: Record<string, any>;
  };

  /** Modal open state */
  isOpen: boolean;

  /** Close handler */
  onClose: () => void;

  /** Execution complete handler */
  onComplete?: (data: Record<string, any>) => void;

  /** Auto-save handler */
  onAutoSave?: (data: Record<string, any>) => void;
}

// ============================================================================
// Styled Components
// ============================================================================

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(var(--color-overlay), 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
`;

const ModalContent = styled.div`
  background: rgb(var(--color-surface));
  border-radius: var(--radius-xl);
  box-shadow: 0 20px 60px rgba(var(--color-overlay), 0.3);
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface-hover));
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
`;

const WorkflowIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  background: rgb(var(--color-primary) / 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
`;

const HeaderTitle = styled.div`
  flex: 1;

  h2 {
    margin: 0 0 4px 0;
    font-size: 20px;
    font-weight: 600;
    color: rgb(var(--color-text-primary));
  }

  p {
    margin: 0;
    font-size: 14px;
    color: rgb(var(--color-text-secondary));
  }
`;

const CloseButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  border: none;
  background: transparent;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    background: rgb(var(--color-surface));
    color: rgb(var(--color-text-primary));
  }

  svg {
    width: 20px;
    height: 20px;
  }
`;

const ProgressBar = styled.div`
  height: 4px;
  background: rgb(var(--color-surface-hover));
  position: relative;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $percent: number }>`
  height: 100%;
  background: rgb(var(--color-primary));
  transition: width 0.3s ease;
  width: ${props => props.$percent}%;
`;

const ContentArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 32px;
`;

const NavigationBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 32px;
  border-top: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface-hover));
`;

const NavLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const NavRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const ProgressIndicator = styled.div`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  font-weight: 500;
`;

const AutoSaveIndicator = styled.div`
  font-size: 13px;
  color: rgb(var(--color-success));
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'ghost' }>`
  height: 40px;
  padding: 0 20px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  border: none;

  ${props => props.$variant === 'primary' && `
    background: rgb(var(--color-primary));
    color: rgb(var(--color-text-inverse));

    &:hover:not(:disabled) {
      background: rgb(var(--color-primary-hover));
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `}

  ${props => props.$variant === 'secondary' && `
    background: rgb(var(--color-surface));
    color: rgb(var(--color-text-primary));
    border: 1px solid rgb(var(--color-border));

    &:hover:not(:disabled) {
      background: rgb(var(--color-surface-hover));
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `}

  ${props => props.$variant === 'ghost' && `
    background: transparent;
    color: rgb(var(--color-text-secondary));

    &:hover:not(:disabled) {
      background: rgb(var(--color-surface));
      color: rgb(var(--color-text-primary));
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `}

  svg {
    width: 16px;
    height: 16px;
  }
`;

const EmptyState = styled.div`
  padding: 80px 32px;
  text-align: center;
  color: rgb(var(--color-text-secondary));

  .icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
    color: rgb(var(--color-text-primary));
  }

  p {
    margin: 0;
    font-size: 14px;
  }
`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build execution order from workflow nodes and edges
 */
function buildExecutionOrder(nodes: WorkflowNode[], edges?: Edge<any>[]): string[] {
  const validNodes = nodes.filter(
    node => node.type !== 'endSuccess' && node.type !== 'endError' && node.type !== 'endCancel'
  );
  if (!edges || edges.length === 0) {
    return validNodes.map(node => node.id);
  }

  const validIds = new Set(validNodes.map(n => n.id));
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const id of validIds) {
    adjacency.set(id, []);
    inDegree.set(id, 0);
  }
  for (const edge of edges) {
    if (validIds.has(edge.source) && validIds.has(edge.target)) {
      adjacency.get(edge.source)!.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
  }

  // Kahn's algorithm
  const queue = [...validIds].filter(id => (inDegree.get(id) || 0) === 0);
  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adjacency.get(current) || []) {
      const deg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }

  // If cycle detected, fall back to original order
  if (sorted.length < validIds.size) {
    return validNodes.map(node => node.id);
  }
  return sorted;
}

/**
 * Get next node ID based on current node
 */
function getNextNodeId(currentNodeId: string, order: string[]): string | null {
  const currentIndex = order.indexOf(currentNodeId);
  if (currentIndex === -1 || currentIndex === order.length - 1) {
    return null;
  }
  return order[currentIndex + 1];
}

/**
 * Get previous node ID based on current node
 */
function getPreviousNodeId(currentNodeId: string, order: string[]): string | null {
  const currentIndex = order.indexOf(currentNodeId);
  if (currentIndex <= 0) {
    return null;
  }
  return order[currentIndex - 1];
}

// ============================================================================
// Main Component
// ============================================================================

export const WorkflowExecutionModal: React.FC<WorkflowExecutionProps> = ({
  workflow,
  execution,
  isOpen,
  onClose,
  onComplete,
  onAutoSave,
}) => {
  // Build execution order from workflow
  const executionOrder = useMemo(() =>
    buildExecutionOrder(workflow.nodes, workflow.edges),
    [workflow.nodes, workflow.edges]
  );

  // Current node state
  const [currentNodeId, setCurrentNodeId] = useState<string>(
    execution?.current_node_id || executionOrder[0] || ''
  );

  const currentNodeIndex = executionOrder.indexOf(currentNodeId);
  const currentNode = workflow.nodes.find(n => n.id === currentNodeId);

  // Workflow context (Phase 5)
  const workflowContext = useWorkflowContext(workflow.nodes as Node[], currentNodeId);

  // Hydrate context from persisted execution data (resume)
  const didHydrateRef = useRef<string | null>(null);
  useEffect(() => {
    const execId = execution?.id || null;
    if (!execId || didHydrateRef.current === execId) return;
    didHydrateRef.current = execId;

    const data = execution?.data;
    if (!data || typeof data !== 'object') return;

    Object.entries(data as Record<string, any>).forEach(([nodeId, nodeData]) => {
      if (!nodeId || !nodeData || typeof nodeData !== 'object') return;
      workflowContext.setNodeData(nodeId, nodeData as Record<string, any>);
    });
  }, [execution?.id, execution?.data, workflowContext]);

  // Auto-save state
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save handler
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      if (onAutoSave) {
        onAutoSave(workflowContext.data);
        setLastSaved(new Date());
      }
    }, 1000);
  }, [onAutoSave, workflowContext.data]);

  // Trigger auto-save when data changes
  useEffect(() => {
    triggerAutoSave();
  }, [workflowContext.data, triggerAutoSave]);

  // Handle node completion
  const handleNodeComplete = useCallback((nodeData: Record<string, any>) => {
    // Store node data in workflow context
    workflowContext.setNodeData(currentNodeId, nodeData);

    // Get next node
    const nextNodeId = getNextNodeId(currentNodeId, executionOrder);

    if (nextNodeId) {
      // Move to next node
      setCurrentNodeId(nextNodeId);
      notify.success('Progress saved');
    } else {
      // Workflow complete
      if (onComplete) {
        onComplete(workflowContext.data);
      }
      notify.success('Workflow completed!');
      onClose();
    }
  }, [currentNodeId, executionOrder, workflowContext, onComplete, onClose]);

  // Handle previous button
  const handlePrevious = useCallback(() => {
    const prevNodeId = getPreviousNodeId(currentNodeId, executionOrder);
    if (prevNodeId) {
      setCurrentNodeId(prevNodeId);
    }
  }, [currentNodeId, executionOrder]);

  // Handle skip button (for optional nodes)
  const handleSkip = useCallback(() => {
    const nextNodeId = getNextNodeId(currentNodeId, executionOrder);
    if (nextNodeId) {
      setCurrentNodeId(nextNodeId);
      notify.info('Step skipped');
    }
  }, [currentNodeId, executionOrder]);

  // Calculate progress
  const progressPercent = executionOrder.length > 0
    ? ((currentNodeIndex + 1) / executionOrder.length) * 100
    : 0;

  if (!isOpen) return null;

  const modalContent = (
    <ModalOverlay onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <ModalContent onClick={e => e.stopPropagation()}>
        {/* Header */}
        <ModalHeader>
          <HeaderLeft>
            <WorkflowIcon>⚙️</WorkflowIcon>
            <HeaderTitle>
              <h2>{workflow.name}</h2>
              <p>{workflow.description || 'Workflow execution in progress'}</p>
            </HeaderTitle>
          </HeaderLeft>
          <CloseButton onClick={onClose} aria-label="Close workflow">
            <X />
          </CloseButton>
        </ModalHeader>

        {/* Progress Bar */}
        <ProgressBar>
          <ProgressFill $percent={progressPercent} />
        </ProgressBar>

        {/* Content */}
        <ContentArea>
          {!currentNode ? (
            <EmptyState>
              <div className="icon">🎉</div>
              <h3>Workflow Complete</h3>
              <p>All steps have been completed successfully.</p>
            </EmptyState>
          ) : (
            <TaskRenderer
              node={currentNode}
              context={workflowContext}
              onComplete={handleNodeComplete}
              readOnly={false}
            />
          )}
        </ContentArea>

        {/* Navigation */}
        <NavigationBar>
          <NavLeft>
            <ProgressIndicator>
              Step {currentNodeIndex + 1} of {executionOrder.length}
            </ProgressIndicator>
            {lastSaved && (
              <AutoSaveIndicator>
                <Save size={14} />
                Saved {lastSaved.toLocaleTimeString()}
              </AutoSaveIndicator>
            )}
          </NavLeft>
          <NavRight>
            <Button
              $variant="ghost"
              onClick={handlePrevious}
              disabled={currentNodeIndex === 0}
            >
              <ChevronLeft />
              Previous
            </Button>

            <Button
              $variant="secondary"
              onClick={handleSkip}
            >
              Skip
            </Button>
          </NavRight>
        </NavigationBar>
      </ModalContent>
    </ModalOverlay>
  );

  return createPortal(modalContent, document.body);
};

export default WorkflowExecutionModal;
