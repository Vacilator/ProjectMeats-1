/**
 * Polish Utilities — Shared interaction, animation, and accessibility primitives.
 *
 * Provides:
 * - Consistent CSS transition tokens
 * - InlineLoader: Minimal loading indicator for embedded contexts
 * - QueryFallback: Graceful error/empty state for TanStack Query consumers
 * - focusRing: Accessible keyboard focus style mixin
 * - srOnly: Screen-reader-only visually hidden style
 *
 * Usage: Import and compose in any component for production-grade polish.
 */
import React from 'react';
import styled, { css, keyframes } from 'styled-components';
import { Button, Skeleton, Typography } from 'antd';
import { AlertCircle, RefreshCw } from 'lucide-react';

const { Text } = Typography;

// ============================================================================
// Animation Tokens
// ============================================================================

export const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const fadeInFast = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

export const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

// ============================================================================
// CSS Mixins
// ============================================================================

/** Accessible keyboard focus ring */
export const focusRing = css`
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary, 99 102 241));
    outline-offset: 2px;
    border-radius: 4px;
  }
`;

/** Screen-reader only (visually hidden) */
export const srOnly = css`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
`;

/** Smooth card interaction */
export const cardHover = css`
  transition: all 0.2s ease;
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  }
  &:active {
    transform: translateY(0);
  }
`;

// ============================================================================
// InlineLoader — Minimal loading skeleton for embedded panels
// ============================================================================

const LoaderWrapper = styled.div<{ $rows?: number }>`
  padding: 0.5rem 0;
  animation: ${fadeInFast} 0.15s ease-out;
`;

interface InlineLoaderProps {
  rows?: number;
  className?: string;
}

export const InlineLoader: React.FC<InlineLoaderProps> = ({ rows = 2, className }) => (
  <LoaderWrapper $rows={rows} className={className} aria-busy="true" aria-label="Loading content">
    <Skeleton active paragraph={{ rows }} title={false} />
  </LoaderWrapper>
);

// ============================================================================
// QueryFallback — Graceful error/retry for query failures
// ============================================================================

const FallbackWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem 1rem;
  text-align: center;
  animation: ${fadeIn} 0.25s ease-out;
`;

interface QueryFallbackProps {
  error?: Error | null;
  onRetry?: () => void;
  message?: string;
}

export const QueryFallback: React.FC<QueryFallbackProps> = ({
  error: _error,
  onRetry,
  message = 'Something went wrong loading this data.',
}) => (
  <FallbackWrapper role="alert" aria-live="polite">
    <AlertCircle size={24} style={{ color: 'rgb(var(--color-text-tertiary, 156 163 175))' }} />
    <Text type="secondary" style={{ fontSize: '0.82rem', maxWidth: 280 }}>
      {message}
    </Text>
    {onRetry && (
      <Button
        size="small"
        icon={<RefreshCw size={12} />}
        onClick={onRetry}
        style={{ borderRadius: 8 }}
      >
        Retry
      </Button>
    )}
  </FallbackWrapper>
);

// ============================================================================
// EmptyInline — Minimal empty state for inline panels
// ============================================================================

const EmptyWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1rem;
  animation: ${fadeInFast} 0.2s ease-out;
`;

interface EmptyInlineProps {
  message?: string;
  icon?: React.ReactNode;
}

export const EmptyInline: React.FC<EmptyInlineProps> = ({
  message = 'Nothing here yet.',
  icon,
}) => (
  <EmptyWrapper aria-label={message}>
    {icon && <span style={{ marginRight: 8, opacity: 0.5 }}>{icon}</span>}
    <Text type="secondary" style={{ fontSize: '0.8rem' }}>{message}</Text>
  </EmptyWrapper>
);

export default {
  InlineLoader,
  QueryFallback,
  EmptyInline,
};
