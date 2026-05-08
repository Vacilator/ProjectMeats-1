/**
 * Save Status Indicator Component
 * Phase 7.5: Incremental Auto-Save
 *
 * Displays the current save status of a workflow/form with visual feedback.
 *
 * Created: 2026-02-27
 */

import React from 'react';
import styled, { keyframes } from 'styled-components';
import { Check, Cloud, CloudOff, Loader, AlertCircle } from 'lucide-react';
import { SaveStatus } from '@/hooks/useAutoSave';

// ============================================================================
// Types
// ============================================================================

export interface SaveStatusIndicatorProps {
  /** Current save status */
  status: SaveStatus;
  /** Whether there are unsaved changes */
  isDirty?: boolean;
  /** Last save timestamp */
  lastSaved?: Date | null;
  /** Error message if status is 'error' */
  error?: Error | null;
  /** Compact mode (icon only) */
  compact?: boolean;
  /** Optional className for styling */
  className?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
`;

const Container = styled.div<{ $status: SaveStatus }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: var(--radius-md, 6px);
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;

  ${({ $status }) => {
    switch ($status) {
      case 'idle':
        return `
          color: rgb(var(--color-text-secondary, 107 114 128));
          background: transparent;
        `;
      case 'pending':
        return `
          color: rgb(var(--color-warning, 245 158 11));
          background: rgba(var(--color-warning, 245 158 11), 0.1);
          animation: ${pulse} 2s ease-in-out infinite;
        `;
      case 'saving':
        return `
          color: rgb(var(--color-info, 59 130 246));
          background: rgba(var(--color-info, 59 130 246), 0.1);
        `;
      case 'saved':
        return `
          color: rgb(var(--color-success, 34 197 94));
          background: rgba(var(--color-success, 34 197 94), 0.1);
        `;
      case 'error':
        return `
          color: rgb(var(--color-error, 239 68 68));
          background: rgba(var(--color-error, 239 68 68), 0.1);
        `;
      default:
        return '';
    }
  }}
`;

const IconWrapper = styled.div<{ $animate?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;

  ${({ $animate }) =>
    $animate &&
    `
    animation: ${spin} 1s linear infinite;
  `}
`;

const Text = styled.span`
  white-space: nowrap;
`;

const Timestamp = styled.span`
  font-size: 11px;
  opacity: 0.7;
  font-weight: 400;
`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format last saved timestamp as relative time
 */
function formatLastSaved(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * Displays the current save status with appropriate icon and text.
 *
 * @example
 * ```tsx
 * <SaveStatusIndicator
 *   status={status}
 *   isDirty={isDirty}
 *   lastSaved={lastSaved}
 *   error={error}
 * />
 * ```
 */
export const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({
  status,
  isDirty = false,
  lastSaved = null,
  error = null,
  compact = false,
  className,
}) => {
  const renderContent = () => {
    switch (status) {
      case 'idle':
        return (
          <>
            <IconWrapper>
              <Cloud size={16} />
            </IconWrapper>
            {!compact && <Text>Saved</Text>}
            {!compact && lastSaved && (
              <Timestamp>{formatLastSaved(lastSaved)}</Timestamp>
            )}
          </>
        );

      case 'pending':
        return (
          <>
            <IconWrapper>
              <CloudOff size={16} />
            </IconWrapper>
            {!compact && <Text>Unsaved changes</Text>}
          </>
        );

      case 'saving':
        return (
          <>
            <IconWrapper $animate>
              <Loader size={16} />
            </IconWrapper>
            {!compact && <Text>Saving...</Text>}
          </>
        );

      case 'saved':
        return (
          <>
            <IconWrapper>
              <Check size={16} />
            </IconWrapper>
            {!compact && <Text>Saved</Text>}
            {!compact && lastSaved && (
              <Timestamp>{formatLastSaved(lastSaved)}</Timestamp>
            )}
          </>
        );

      case 'error':
        return (
          <>
            <IconWrapper>
              <AlertCircle size={16} />
            </IconWrapper>
            {!compact && <Text>Save failed</Text>}
            {!compact && error && (
              <Timestamp title={error.message}>Retry pending</Timestamp>
            )}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Container $status={status} className={className}>
      {renderContent()}
    </Container>
  );
};
