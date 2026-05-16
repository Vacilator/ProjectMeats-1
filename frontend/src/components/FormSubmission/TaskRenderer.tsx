/**
 * Task Renderer
 * 
 * Phase 4: Hybrid Task Renderer
 * Orchestrates rendering of different workflow node types.
 * 
 * Features:
 * - Routes nodes to appropriate renderer
 * - Handles form steps vs interaction cards
 * - Auto-executes automated nodes
 * - Integrates with workflow context
 * - Error boundaries per task
 * 
 * Usage:
 * ```typescript
 * <TaskRenderer
 *   node={currentNode}
 *   context={workflowContext}
 *   onComplete={(data) => advanceToNextNode(data)}
 * />
 * ```
 * 
 * Created: 2026-02-12 - Phase 4 Hybrid Task Renderer Implementation
 */

import React from 'react';
import styled from 'styled-components';
import { AlertCircle } from 'lucide-react';
import { WorkflowContext } from './hooks/useWorkflowContext';
import { detectCardType } from './InteractionCardRegistry';
import ExecutionFormStep from './ExecutionFormStep';
import { logger } from '@/utils/logger';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface TaskRendererProps {
  /** Current workflow node to render */
  node: { id: string; type?: string; data: Record<string, unknown>; [key: string]: unknown };
  
  /** Workflow context */
  context: WorkflowContext;
  
  /** Callback when task is completed */
  onComplete: (data: Record<string, unknown>) => void;
  
  /** Callback for wait states */
  onWait?: () => void;
  
  /** Read-only mode */
  readOnly?: boolean;
}

// ============================================================================
// Styled Components
// ============================================================================

const RendererContainer = styled.div`
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
`;

const ErrorContainer = styled.div`
  padding: 24px;
  background: rgb(var(--color-error) / 0.1);
  border: 1px solid rgb(var(--color-error) / 0.3);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: rgb(var(--color-error));
`;

const ErrorIcon = styled.div`
  flex-shrink: 0;
  
  svg {
    width: 20px;
    height: 20px;
  }
`;

const ErrorContent = styled.div`
  flex: 1;
`;

const ErrorTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
`;

const ErrorMessage = styled.div`
  font-size: 14px;
  line-height: 1.6;
`;

const UnsupportedNodeCard = styled.div`
  padding: 24px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  text-align: center;
`;

const UnsupportedTitle = styled.h3`
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const UnsupportedMessage = styled.p`
  margin: 0;
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
`;

const UnsupportedDetails = styled.div`
  margin-top: 16px;
  padding: 12px;
  background: rgb(var(--color-surface-hover));
  border-radius: var(--radius-md);
  font-size: 13px;
  font-family: monospace;
  color: rgb(var(--color-text-tertiary));
`;

// ============================================================================
// Error Boundary Component
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class TaskErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('[TaskRenderer] Error caught by boundary:', { metadata: { errorInfo: errorInfo.componentStack } }, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorContainer>
          <ErrorIcon>
            <AlertCircle />
          </ErrorIcon>
          <ErrorContent>
            <ErrorTitle>Task Rendering Error</ErrorTitle>
            <ErrorMessage>
              {this.state.error?.message || 'An unknown error occurred while rendering this task.'}
            </ErrorMessage>
          </ErrorContent>
        </ErrorContainer>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * TaskRenderer orchestrates rendering of workflow nodes.
 * 
 * Decision tree:
 * 1. If node.type === 'formStep' → Render FormStep
 * 2. If node has interactionType → Find and render InteractionCard
 * 3. If node.type matches card nodeType → Render InteractionCard
 * 4. If automated/action node → Auto-execute (future)
 * 5. Else → Show unsupported node message
 */
export const TaskRenderer: React.FC<TaskRendererProps> = ({
  node,
  context,
  onComplete,
  onWait,
  readOnly = false,
}) => {
  // Case 1: Form Step
  if (node.type === 'formStep') {
    const formStepNode = node as { id: string; type: string; data: Record<string, unknown> };
    return (
      <RendererContainer>
        <TaskErrorBoundary>
          <ExecutionFormStep
            node={formStepNode}
            context={context}
            onComplete={onComplete}
            readOnly={readOnly}
          />
        </TaskErrorBoundary>
      </RendererContainer>
    );
  }

  // Case 2 & 3: Interaction Card
  const cardDef = detectCardType(node.data);
  if (cardDef) {
    const CardComponent = cardDef.renderer;
    
    return (
      <RendererContainer>
        <TaskErrorBoundary>
          <CardComponent
            node={node}
            context={context}
            onComplete={onComplete}
            onWait={onWait}
            readOnly={readOnly}
          />
        </TaskErrorBoundary>
      </RendererContainer>
    );
  }

  // Case 4: Automated nodes — show informative status card
  if (isAutomatedNode(node.type)) {
    const automatedLabels: Record<string, { label: string; desc: string }> = {
      actionEmail: { label: 'Send Email', desc: 'Sends an email automatically based on configured template and recipients.' },
      actionSMS: { label: 'Send SMS', desc: 'Sends an SMS notification to the configured phone number.' },
      actionHTTP: { label: 'HTTP Request', desc: 'Makes an external API call to the configured endpoint.' },
      actionScript: { label: 'Run Script', desc: 'Executes a custom script or transformation logic.' },
      dataTransform: { label: 'Data Transform', desc: 'Transforms data between workflow steps using mapping rules.' },
    };
    const info = automatedLabels[node.type || ''] ?? { label: 'Automated Step', desc: 'This step executes automatically when the workflow runs.' };

    return (
      <RendererContainer>
        <UnsupportedNodeCard>
          <UnsupportedTitle>⚡ {info.label}</UnsupportedTitle>
          <UnsupportedMessage>
            {info.desc}
          </UnsupportedMessage>
          <UnsupportedDetails>
            Node type: {node.type || 'unknown'} • Runs server-side
          </UnsupportedDetails>
        </UnsupportedNodeCard>
      </RendererContainer>
    );
  }

  // Case 5: Unsupported node type
  return (
    <RendererContainer>
      <UnsupportedNodeCard>
        <UnsupportedTitle>Unsupported Node Type</UnsupportedTitle>
        <UnsupportedMessage>
          This node type cannot be rendered in the task view.
        </UnsupportedMessage>
        <UnsupportedDetails>
          Type: {node.type || 'unknown'}
          {typeof node.data?.interactionType === 'string' && ` | Interaction: ${node.data.interactionType}`}
        </UnsupportedDetails>
      </UnsupportedNodeCard>
    </RendererContainer>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if node is automated (executes without user interaction)
 */
function isAutomatedNode(nodeType: string | undefined): boolean {
  if (!nodeType) return false;
  
  const automatedTypes = [
    'actionEmail',
    'actionSMS',
    'actionHTTP',
    'actionScript',
    'actionCreateRecord',
    'actionUpdateRecord',
    'actionDeleteRecord',
    'dataTransform',
    'dataLookup',
    'dataMerge',
    'timerDelay',
    'timerSchedule',
  ];
  
  return automatedTypes.includes(nodeType);
}

export default TaskRenderer;
