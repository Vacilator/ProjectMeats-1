/**
 * Loop Iteration Indicator (PI-05 / editor-loop-indicators)
 *
 * Displays loop iteration count, condition expression, and runtime progress
 * visually on ForEach and DoUntil nodes in the FlowEditor.
 *
 * Theme Compliance: CSS custom properties only.
 */
import React from 'react';
import styled, { keyframes } from 'styled-components';
import { Repeat, Clock, CheckCircle2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type LoopStatus = 'idle' | 'running' | 'completed' | 'error';

export interface LoopIterationIndicatorProps {
  /** Type of loop */
  loopType: 'for_each' | 'do_until' | 'while';
  /** Data source or condition expression */
  expression?: string;
  /** Current iteration (runtime) */
  currentIteration?: number;
  /** Total iterations known (for for_each) */
  totalIterations?: number;
  /** Maximum iterations safety limit */
  maxIterations?: number;
  /** Runtime status */
  status?: LoopStatus;
  /** Compact display */
  compact?: boolean;
}

// ============================================================================
// Styled Components
// ============================================================================

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

const Container = styled.div<{ $status: LoopStatus }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  background: ${({ $status }) => {
    switch ($status) {
      case 'running':
        return 'rgba(var(--color-info), 0.1)';
      case 'completed':
        return 'rgba(var(--color-success), 0.1)';
      case 'error':
        return 'rgba(var(--color-error), 0.1)';
      default:
        return 'rgba(var(--color-border), 0.3)';
    }
  }};
  color: ${({ $status }) => {
    switch ($status) {
      case 'running':
        return 'rgb(var(--color-info))';
      case 'completed':
        return 'rgb(var(--color-success))';
      case 'error':
        return 'rgb(var(--color-error))';
      default:
        return 'rgb(var(--color-text-secondary))';
    }
  }};
  animation: ${({ $status }) => ($status === 'running' ? pulse : 'none')} 1.5s ease infinite;
`;

const ProgressBar = styled.div<{ $percent: number }>`
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: rgba(var(--color-border), 0.5);
  overflow: hidden;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: ${(p) => p.$percent}%;
    background: rgb(var(--color-primary));
    border-radius: 2px;
    transition: width 0.3s ease;
  }
`;

const ExpressionChip = styled.span`
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(var(--color-border), 0.4);
  color: rgb(var(--color-text-secondary));
  font-size: 10px;
  font-family: monospace;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// ============================================================================
// Component
// ============================================================================

export const LoopIterationIndicator: React.FC<LoopIterationIndicatorProps> = ({
  loopType,
  expression,
  currentIteration = 0,
  totalIterations,
  maxIterations,
  status = 'idle',
  compact = false,
}) => {
  const percent =
    totalIterations && totalIterations > 0
      ? Math.min(100, (currentIteration / totalIterations) * 100)
      : 0;

  const loopLabel =
    loopType === 'for_each'
      ? 'ForEach'
      : loopType === 'do_until'
      ? 'DoUntil'
      : 'While';

  const StatusIcon =
    status === 'completed' ? CheckCircle2 : status === 'running' ? Clock : Repeat;

  return (
    <Container $status={status}>
      <StatusIcon size={12} />
      <span>{loopLabel}</span>
      {!compact && currentIteration > 0 && (
        <span>
          {currentIteration}
          {totalIterations ? `/${totalIterations}` : ''}
          {maxIterations && !totalIterations ? ` (max ${maxIterations})` : ''}
        </span>
      )}
      {!compact && totalIterations && status === 'running' && (
        <ProgressBar $percent={percent} />
      )}
      {!compact && expression && <ExpressionChip title={expression}>{expression}</ExpressionChip>}
    </Container>
  );
};

export default LoopIterationIndicator;
