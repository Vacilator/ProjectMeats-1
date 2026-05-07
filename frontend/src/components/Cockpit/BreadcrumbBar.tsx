/**
 * BreadcrumbBar Component
 * 
 * Displays navigation breadcrumbs for Cockpit entity exploration.
 * Allows users to quickly navigate back through their search path.
 * 
 * Created: 2026-02-23 - Cockpit Phase 2A Final
 */

import React from 'react';
import styled from 'styled-components';
import { ChevronRight, Home } from 'lucide-react';
import { useCockpitNavigation } from '../../contexts/CockpitNavigationContext';
import { resolveEntityDisplay } from '../../utils/entityDisplay';

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgb(var(--color-surface));
  border-bottom: 1px solid rgb(var(--color-border));
  overflow-x: auto;
  white-space: nowrap;
  
  &::-webkit-scrollbar {
    height: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgb(var(--color-border));
    border-radius: 2px;
  }
`;

const Crumb = styled.button<{ $isLast: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: ${props => props.$isLast ? 'rgb(var(--color-primary) / 0.1)' : 'transparent'};
  border: none;
  border-radius: var(--radius-sm);
  color: ${props => props.$isLast ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  font-size: 0.875rem;
  cursor: ${props => props.$isLast ? 'default' : 'pointer'};
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    background: rgb(var(--color-background));
    color: rgb(var(--color-text-primary));
  }
`;

const CrumbLabel = styled.span`
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Separator = styled(ChevronRight)`
  color: rgb(var(--color-text-tertiary));
  flex-shrink: 0;
`;

const HomeButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgb(var(--color-background));
    color: rgb(var(--color-primary));
  }
`;

// ============================================================================
// Component
// ============================================================================

type ExtraCrumb = {
  label: string;
};

const resolveCrumbLabel = (step: {
  id?: string;
  type?: string;
  label?: string;
  subtitle?: string;
}) =>
  resolveEntityDisplay(step, {
    entityType: String(step.type || 'record').split('.').pop(),
    preferredKeys: ['label', 'subtitle', 'title', 'name'],
    fallbackStyle: 'details',
  });

interface BreadcrumbBarProps {
  extraCrumbs?: ExtraCrumb[];
}

export const BreadcrumbBar: React.FC<BreadcrumbBarProps> = ({ extraCrumbs = [] }) => {
  const { path, goToStep, clearPath } = useCockpitNavigation();

  if (path.length === 0) {
    return null;
  }

  const fullPath = [...path, ...extraCrumbs.map((c, idx) => ({
    id: `extra:${idx}`,
    type: 'extra',
    label: c.label,
    timestamp: 0,
  }))];

  return (
    <Container>
      <HomeButton onClick={clearPath} title="Clear path">
        <Home size={16} />
      </HomeButton>

      {fullPath.map((step, index) => {
        const isLast = index === fullPath.length - 1;
        const isRealPathStep = index < path.length;
        const isClickable = isRealPathStep && index !== path.length - 1;
        const resolvedLabel = resolveCrumbLabel(step);

        return (
          <React.Fragment key={`${step.type}-${step.id}-${step.timestamp}-${index}`}>
            <Separator size={16} />
            <Crumb
               $isLast={isLast}
               onClick={() => isClickable && goToStep(index)}
               disabled={!isClickable}
               title={resolvedLabel.tooltip || resolvedLabel.text}
             >
              <CrumbLabel>{resolvedLabel.text}</CrumbLabel>
            </Crumb>
          </React.Fragment>
        );
      })}
    </Container>
  );
};

export default BreadcrumbBar;
