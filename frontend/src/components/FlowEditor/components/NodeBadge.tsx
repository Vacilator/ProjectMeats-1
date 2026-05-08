/**
 * Node Badge Component
 *
 * Status badges for workflow nodes (error, warning, success, processing).
 * Displays badges in the top-right corner of nodes with counts and animations.
 *
 * Sprint 1: Visual Excellence - Task 1.2
 * Created: 2026-02-17
 */
import React from 'react';
import styled, { keyframes } from 'styled-components';
import { AlertCircle, AlertTriangle, CheckCircle, Loader } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type NodeBadgeStatus = 'error' | 'warning' | 'success' | 'processing';

export interface NodeBadgeProps {
  status: NodeBadgeStatus;
  count?: number;
  message?: string;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

// ============================================================================
// Animations
// ============================================================================

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
`;

const celebrate = keyframes`
  0%, 100% {
    transform: scale(1) rotate(0deg);
    box-shadow: 0 2px 4px rgba(var(--color-overlay), 0.2);
  }
  50% {
    transform: scale(1.15) rotate(5deg);
    box-shadow: 0 4px 12px rgba(var(--color-success), 0.4);
  }
`;

// ============================================================================
// Styled Components
// ============================================================================

const BadgeContainer = styled.div<{
  $status: NodeBadgeStatus;
  $position: string;
}>`
  position: absolute;
  ${props => {
    const pos = props.$position;
    if (pos === 'top-right') return 'top: -8px; right: -8px;';
    if (pos === 'top-left') return 'top: -8px; left: -8px;';
    if (pos === 'bottom-right') return 'bottom: -8px; right: -8px;';
    if (pos === 'bottom-left') return 'bottom: -8px; left: -8px;';
    return 'top: -8px; right: -8px;'; // Default
  }}

  display: flex;
  align-items: center;
  gap: 4px;

  background: ${props => {
    switch (props.$status) {
      case 'error': return 'rgb(var(--color-danger))';
      case 'warning': return 'rgb(var(--color-warning))';
      case 'success': return 'rgb(var(--color-success))';
      case 'processing': return 'rgb(var(--color-info))';
      default: return 'rgb(var(--color-text-tertiary))';
    }
  }};

  border: 2px solid rgb(var(--color-surface));
  border-radius: 12px;
  padding: 4px 8px;
  min-width: 24px;
  height: 24px;

  color: rgb(var(--color-primary-foreground));
  font-size: 11px;
  font-weight: 700;

  box-shadow: 0 2px 6px rgba(var(--color-overlay), 0.2);
  pointer-events: all;
  cursor: ${props => props.title ? 'help' : 'default'};
  z-index: 10;

  animation: ${props => {
    switch (props.$status) {
      case 'error': return shake;
      case 'warning': return pulse;
      case 'success': return celebrate;
      case 'processing': return 'none';
      default: return 'none';
    }
  }} ${props => {
    switch (props.$status) {
      case 'error': return '0.5s ease-in-out infinite';
      case 'warning': return '2s ease-in-out infinite';
      case 'success': return '2s ease-in-out infinite';
      default: return '0s';
    }
  }};

  transition: all 0.2s ease;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(var(--color-overlay), 0.3);
  }
`;

const BadgeIcon = styled.div<{ $status: NodeBadgeStatus }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;

  svg {
    width: 14px;
    height: 14px;
    animation: ${props => props.$status === 'processing' ? spin : 'none'}
               ${props => props.$status === 'processing' ? '1s linear infinite' : '0s'};
  }
`;

const BadgeCount = styled.span`
  line-height: 1;
  margin-left: 2px;
`;

// ============================================================================
// Component
// ============================================================================

export const NodeBadge: React.FC<NodeBadgeProps> = ({
  status,
  count,
  message,
  position = 'top-right',
}) => {
  // Get icon based on status
  const getIcon = () => {
    switch (status) {
      case 'error':
        return <AlertCircle />;
      case 'warning':
        return <AlertTriangle />;
      case 'success':
        return <CheckCircle />;
      case 'processing':
        return <Loader />;
      default:
        return null;
    }
  };

  // Get default message if not provided
  const getDefaultMessage = () => {
    switch (status) {
      case 'error':
        return count ? `${count} error${count !== 1 ? 's' : ''}` : 'Error occurred';
      case 'warning':
        return count ? `${count} warning${count !== 1 ? 's' : ''}` : 'Warning';
      case 'success':
        return count ? `${count} successful execution${count !== 1 ? 's' : ''}` : 'Success';
      case 'processing':
        return 'Processing...';
      default:
        return '';
    }
  };

  const tooltipMessage = message || getDefaultMessage();

  return (
    <BadgeContainer
      $status={status}
      $position={position}
      title={tooltipMessage}
      role="status"
      aria-label={tooltipMessage}
    >
      <BadgeIcon $status={status}>
        {getIcon()}
      </BadgeIcon>
      {count !== undefined && count > 0 && (
        <BadgeCount>{count}</BadgeCount>
      )}
    </BadgeContainer>
  );
};

export default NodeBadge;
