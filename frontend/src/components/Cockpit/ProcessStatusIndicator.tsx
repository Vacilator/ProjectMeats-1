/**
 * Process Status Indicator (PI-03)
 *
 * Replaces "forever-running" spinner states with clear failure messages,
 * retry actions, and time-elapsed context. Provides a unified status
 * display for all process cockpit items.
 *
 * Theme Compliance: CSS custom properties only.
 */
import React, { useCallback, useMemo } from 'react';
import styled from 'styled-components';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  Pause,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type ProcessStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'paused'
  | 'awaiting_input';

interface ProcessStatusIndicatorProps {
  status: ProcessStatus;
  startedAt?: string | null;
  failureMessage?: string | null;
  timeoutMinutes?: number;
  onRetry?: () => void;
  onDismiss?: () => void;
  compact?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG: Record<ProcessStatus, {
  icon: React.ElementType;
  label: string;
  color: string;
  bgColor: string;
}> = {
  pending: {
    icon: Clock,
    label: 'Queued',
    color: 'rgb(var(--color-text-secondary, 107 114 128))',
    bgColor: 'rgba(107, 114, 128, 0.08)',
  },
  running: {
    icon: Loader2,
    label: 'Running',
    color: 'rgb(var(--color-primary, 59 130 246))',
    bgColor: 'rgba(59, 130, 246, 0.08)',
  },
  completed: {
    icon: CheckCircle2,
    label: 'Completed',
    color: 'rgb(var(--color-success, 34 197 94))',
    bgColor: 'rgba(34, 197, 94, 0.08)',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    color: 'rgb(var(--color-error, 239 68 68))',
    bgColor: 'rgba(239, 68, 68, 0.08)',
  },
  timeout: {
    icon: AlertTriangle,
    label: 'Timed Out',
    color: 'rgb(var(--color-warning, 234 179 8))',
    bgColor: 'rgba(234, 179, 8, 0.08)',
  },
  paused: {
    icon: Pause,
    label: 'Paused',
    color: 'rgb(var(--color-text-secondary, 107 114 128))',
    bgColor: 'rgba(107, 114, 128, 0.08)',
  },
  awaiting_input: {
    icon: AlertTriangle,
    label: 'Action Required',
    color: 'rgb(var(--color-warning, 234 179 8))',
    bgColor: 'rgba(234, 179, 8, 0.08)',
  },
};

const DEFAULT_TIMEOUT_MINUTES = 30;

// ============================================================================
// Helpers
// ============================================================================

function getElapsedTime(startedAt: string | null | undefined): string {
  if (!startedAt) return '';
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diffMs = now - start;

  if (diffMs < 60000) return 'just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
  return `${Math.floor(diffMs / 86400000)}d ago`;
}

function isLikelyStuck(
  status: ProcessStatus,
  startedAt: string | null | undefined,
  timeoutMinutes: number
): boolean {
  if (status !== 'running' || !startedAt) return false;
  const elapsed = Date.now() - new Date(startedAt).getTime();
  return elapsed > timeoutMinutes * 60 * 1000;
}

// ============================================================================
// Component
// ============================================================================

export const ProcessStatusIndicator: React.FC<ProcessStatusIndicatorProps> = React.memo(
  ({ status, startedAt, failureMessage, timeoutMinutes, onRetry, onDismiss, compact }) => {
    const timeout = timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES;
    const stuck = isLikelyStuck(status, startedAt, timeout);

    const effectiveStatus: ProcessStatus = stuck ? 'timeout' : status;
    const config = STATUS_CONFIG[effectiveStatus];
    const Icon = config.icon;
    const elapsed = getElapsedTime(startedAt);

    const effectiveMessage = useMemo(() => {
      if (failureMessage) return failureMessage;
      if (stuck) return `Process appears stuck (running > ${timeout}min). You may retry or investigate.`;
      return null;
    }, [failureMessage, stuck, timeout]);

    const handleRetry = useCallback(() => {
      onRetry?.();
    }, [onRetry]);

    if (compact) {
      return (
        <CompactBadge style={{ color: config.color, backgroundColor: config.bgColor }}>
          <Icon size={14} className={effectiveStatus === 'running' ? 'spin' : ''} />
          <span>{config.label}</span>
          {elapsed && <ElapsedText>{elapsed}</ElapsedText>}
        </CompactBadge>
      );
    }

    return (
      <StatusContainer>
        <StatusBadge style={{ color: config.color, backgroundColor: config.bgColor }}>
          <Icon size={16} className={effectiveStatus === 'running' ? 'spin' : ''} />
          <StatusLabel>{config.label}</StatusLabel>
          {elapsed && <ElapsedText>{elapsed}</ElapsedText>}
        </StatusBadge>

        {effectiveMessage && (
          <MessageRow>
            <MessageText>{effectiveMessage}</MessageText>
            {onRetry && (effectiveStatus === 'failed' || effectiveStatus === 'timeout') && (
              <RetryButton onClick={handleRetry} aria-label="Retry process">
                <RefreshCw size={14} />
                Retry
              </RetryButton>
            )}
            {onDismiss && (
              <DismissButton onClick={onDismiss} aria-label="Dismiss">
                Dismiss
              </DismissButton>
            )}
          </MessageRow>
        )}
      </StatusContainer>
    );
  }
);

ProcessStatusIndicator.displayName = 'ProcessStatusIndicator';

// ============================================================================
// Styled Components
// ============================================================================

const StatusContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const StatusBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  width: fit-content;

  .spin {
    animation: spin 1.2s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const CompactBadge = styled(StatusBadge)`
  padding: 2px 8px;
  font-size: 12px;
  gap: 4px;
`;

const StatusLabel = styled.span``;

const ElapsedText = styled.span`
  font-size: 11px;
  opacity: 0.7;
  margin-left: 2px;
`;

const MessageRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const MessageText = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-secondary, 107 114 128));
  flex: 1;
  min-width: 0;
`;

const RetryButton = styled.button.attrs({ type: 'button' })`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid rgb(var(--color-primary, 59 130 246));
  border-radius: 4px;
  background: transparent;
  color: rgb(var(--color-primary, 59 130 246));
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(59, 130, 246, 0.08);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary, 59 130 246));
    outline-offset: 2px;
  }
`;

const DismissButton = styled.button.attrs({ type: 'button' })`
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: rgb(var(--color-text-secondary, 107 114 128));
  font-size: 12px;
  cursor: pointer;

  &:hover {
    color: rgb(var(--color-text-primary, 17 24 39));
  }
`;

export default ProcessStatusIndicator;
