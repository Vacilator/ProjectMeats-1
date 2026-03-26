/**
 * Widget Card Component
 * 
 * Base wrapper for all dashboard widgets with consistent styling.
 * 
 * Features:
 * - Consistent header with title and actions
 * - Loading and error states
 * - Refresh functionality
 * 
 * Theme Compliance:
 * - Uses CSS custom properties
 * - No hardcoded colors
 */
import React, { ReactNode } from 'react';
import styled from 'styled-components';
import { Pin, RefreshCw } from 'lucide-react';
import { useCockpitPinnedTools } from '../../contexts/CockpitPinnedToolsContext';
import { useWidgetInstance } from './WidgetInstanceContext';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface WidgetCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  actions?: ReactNode;
  className?: string;
  noPadding?: boolean;
  badge?: string | number;
  badgeVariant?: 'default' | 'danger' | 'warning' | 'success';
}

// ============================================================================
// Styled Components
// ============================================================================

const CardContainer = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const HeaderIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--color-primary));
`;

const HeaderTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const HeaderBadge = styled.span<{ $variant: 'default' | 'danger' | 'warning' | 'success' }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  background: ${props => {
    switch (props.$variant) {
      case 'danger': return 'rgb(239, 68, 68)';
      case 'warning': return 'rgb(234, 179, 8)';
      case 'success': return 'rgb(34, 197, 94)';
      default: return 'rgb(var(--color-primary))';
    }
  }};
  color: ${props => props.$variant === 'warning' ? 'black' : 'white'};
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  color: rgb(var(--color-text-tertiary));
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgb(var(--color-border));
    color: rgb(var(--color-text-primary));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const CardContent = styled.div<{ $noPadding: boolean }>`
  flex: 1;
  overflow: auto;
  padding: ${props => props.$noPadding ? '0' : '16px'};
`;

const LoadingOverlay = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 100px;
  color: rgb(var(--color-text-tertiary));
  font-size: 14px;
`;

const ErrorMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 100px;
  color: rgb(239, 68, 68);
  font-size: 14px;
  text-align: center;
  padding: 16px;
`;

const SpinningIcon = styled(RefreshCw)<{ $spinning: boolean }>`
  animation: ${props => props.$spinning ? 'spin 1s linear infinite' : 'none'};

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// ============================================================================
// Component
// ============================================================================

export const WidgetCard: React.FC<WidgetCardProps> = ({
  title,
  icon,
  children,
  loading = false,
  error = null,
  onRefresh,
  actions,
  className,
  noPadding = false,
  badge,
  badgeVariant = 'default',
}) => {
  const widgetInstance = useWidgetInstance();
  const pinnedTools = useCockpitPinnedTools();

  const isPinned = widgetInstance?.widget ? pinnedTools.isWidgetPinned(widgetInstance.widget.id) : false;

  return (
    <CardContainer className={className}>
      <CardHeader>
        <HeaderLeft>
          {icon && <HeaderIcon>{icon}</HeaderIcon>}
          <HeaderTitle>{title}</HeaderTitle>
          {badge && <HeaderBadge $variant={badgeVariant}>{badge}</HeaderBadge>}
        </HeaderLeft>
        <HeaderActions>
          {widgetInstance?.onPinWidget && widgetInstance.widget && (
            <IconButton
              onClick={() => widgetInstance.onPinWidget?.(widgetInstance.widget)}
              title={isPinned ? 'Pinned' : 'Pin to tools'}
              aria-label={isPinned ? 'Pinned' : 'Pin to tools'}
              disabled={isPinned}
            >
              <Pin size={14} />
            </IconButton>
          )}
          {actions}
          {onRefresh && (
            <IconButton onClick={onRefresh} disabled={loading} title="Refresh">
              <SpinningIcon size={14} $spinning={loading} />
            </IconButton>
          )}
        </HeaderActions>
      </CardHeader>
      <CardContent $noPadding={noPadding}>
        {loading ? (
          <LoadingOverlay>Loading...</LoadingOverlay>
        ) : error ? (
          <ErrorMessage>{error}</ErrorMessage>
        ) : (
          children
        )}
      </CardContent>
    </CardContainer>
  );
};

export default WidgetCard;
