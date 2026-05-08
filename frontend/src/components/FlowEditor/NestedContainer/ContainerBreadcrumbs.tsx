/**
 * Container Breadcrumbs Component
 *
 * Navigation breadcrumb trail showing current container hierarchy.
 * Allows clicking to navigate back to parent containers or main canvas.
 *
 * Created: 2026-02-07
 */
import React from 'react';
import styled from 'styled-components';
import { ChevronRight, Home } from 'lucide-react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface Breadcrumb {
  id: string | null;
  name: string;
}

interface ContainerBreadcrumbsProps {
  breadcrumbs: Breadcrumb[];
  onNavigate: (breadcrumbId: string | null) => void;
}

// ============================================================================
// Styled Components
// ============================================================================

const BreadcrumbContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(var(--color-surface), 0.6);
  border-bottom: 1px solid rgba(var(--color-border), 0.5);
  font-size: 13px;
  overflow-x: auto;
  white-space: nowrap;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(var(--color-border), 0.1);
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(var(--color-border), 0.3);
    border-radius: 2px;
  }
`;

const BreadcrumbItem = styled.button<{ $isLast: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: ${props => props.$isLast
    ? 'rgba(var(--color-primary), 0.15)'
    : 'transparent'};
  color: ${props => props.$isLast
    ? 'rgb(var(--color-primary))'
    : 'rgb(var(--color-text-secondary))'};
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: ${props => props.$isLast ? '600' : '500'};
  cursor: ${props => props.$isLast ? 'default' : 'pointer'};
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: rgba(var(--color-primary), 0.1);
    color: rgb(var(--color-primary));
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

const Separator = styled.div`
  display: flex;
  align-items: center;
  color: rgba(var(--color-text-secondary), 0.5);

  svg {
    width: 14px;
    height: 14px;
  }
`;

// ============================================================================
// Component
// ============================================================================

export const ContainerBreadcrumbs: React.FC<ContainerBreadcrumbsProps> = ({
  breadcrumbs,
  onNavigate,
}) => {
  if (breadcrumbs.length <= 1) {
    // Don't show breadcrumbs if only on main canvas
    return null;
  }

  return (
    <BreadcrumbContainer>
      {breadcrumbs.map((breadcrumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const isFirst = index === 0;

        return (
          <React.Fragment key={breadcrumb.id || 'main'}>
            <BreadcrumbItem
              $isLast={isLast}
              onClick={() => !isLast && onNavigate(breadcrumb.id)}
              disabled={isLast}
            >
              {isFirst && <Home size={14} />}
              {breadcrumb.name}
            </BreadcrumbItem>

            {!isLast && (
              <Separator>
                <ChevronRight />
              </Separator>
            )}
          </React.Fragment>
        );
      })}
    </BreadcrumbContainer>
  );
};

export default ContainerBreadcrumbs;
