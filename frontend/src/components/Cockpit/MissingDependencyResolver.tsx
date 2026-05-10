/**
 * MissingDependencyResolver (RT-04.3)
 *
 * In-context quick-create flow for missing master data (Supplier, Customer,
 * Contact, Plant) detected during AI Inbox parsing or form node execution.
 *
 * Renders a compact alert-style panel showing which dependencies are missing,
 * with one-click "Create" buttons that open the QuickCreateModal inline.
 *
 * Theme Compliance: CSS custom properties only.
 * Service Layer: Uses businessApi for validation checks.
 */
import React, { useState, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import {
  AlertTriangle,
  Plus,
  Check,
  Building2,
  User,
  Factory,
  Users,
} from 'lucide-react';

import QuickCreateModal from '../FormSubmission/QuickCreateModal';

// ============================================================================
// Types
// ============================================================================

export interface MissingDependency {
  entityType: 'supplier' | 'customer' | 'contact' | 'plant';
  suggestedName?: string;
  suggestedEmail?: string;
  context?: Record<string, unknown>;
}

export interface MissingDependencyResolverProps {
  /** List of missing dependencies detected from parsed email/form data */
  missingDeps: MissingDependency[];
  /** Callback when a dependency is successfully created */
  onResolved?: (entityType: string, entity: { value: string; label: string }) => void;
  /** Compact mode for inline use in detail panels */
  compact?: boolean;
  className?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div<{ $compact?: boolean }>`
  border: 1px solid rgba(var(--color-warning), 0.3);
  background: rgba(var(--color-warning), 0.04);
  border-radius: var(--radius-md);
  padding: ${(p) => (p.$compact ? '10px 12px' : '14px 16px')};
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
`;

const HeaderText = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-warning));
`;

const DepList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const DepRow = styled.div<{ $resolved?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: ${(p) => (p.$resolved ? 'rgba(var(--color-success), 0.06)' : 'rgb(var(--color-surface))')};
  border: 1px solid ${(p) => (p.$resolved ? 'rgba(var(--color-success), 0.2)' : 'rgb(var(--color-border))')};
  transition: all 0.15s;
`;

const DepIcon = styled.div<{ $resolved?: boolean }>`
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(p) => (p.$resolved ? 'rgba(var(--color-success), 0.1)' : 'rgba(var(--color-info), 0.08)')};
  color: ${(p) => (p.$resolved ? 'rgb(var(--color-success))' : 'rgb(var(--color-info))')};
  flex-shrink: 0;
`;

const DepInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const DepLabel = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const DepHint = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  margin-top: 1px;
`;

const CreateBtn = styled.button<{ $resolved?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  border: none;
  cursor: ${(p) => (p.$resolved ? 'default' : 'pointer')};
  transition: all 0.1s;

  ${(p) =>
    p.$resolved
      ? `
    background: rgba(var(--color-success), 0.1);
    color: rgb(var(--color-success));
  `
      : `
    background: rgb(var(--color-info));
    color: rgb(var(--color-text-inverse));
    &:hover { background: rgb(var(--color-info)); opacity: 0.9; }
  `}
`;

// ============================================================================
// Helpers
// ============================================================================

const ENTITY_ICONS: Record<string, React.FC<{ size: number }>> = {
  supplier: Building2,
  customer: Users,
  contact: User,
  plant: Factory,
};

const ENTITY_LABELS: Record<string, string> = {
  supplier: 'Supplier',
  customer: 'Customer',
  contact: 'Contact',
  plant: 'Plant / Location',
};

// ============================================================================
// Component
// ============================================================================

export const MissingDependencyResolver: React.FC<MissingDependencyResolverProps> = ({
  missingDeps,
  onResolved,
  compact = false,
  className,
}) => {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<MissingDependency | null>(null);

  const handleCloseCreating = useCallback(() => setCreating(null), []);

  const handleCreated = useCallback(
    (entity: { value: string; label: string }) => {
      if (!creating) return;
      setResolved((prev) => new Set([...prev, creating.entityType]));
      setCreating(null);
      onResolved?.(creating.entityType, entity);
    },
    [creating, onResolved],
  );

  const unresolvedCount = useMemo(
    () => missingDeps.filter((d) => !resolved.has(d.entityType)).length,
    [missingDeps, resolved],
  );

  if (missingDeps.length === 0) return null;

  return (
    <Container $compact={compact} className={className}>
      <Header>
        <AlertTriangle size={14} color="rgb(var(--color-warning))" />
        <HeaderText>
          {unresolvedCount === 0
            ? 'All dependencies resolved ✓'
            : `${unresolvedCount} missing ${unresolvedCount === 1 ? 'dependency' : 'dependencies'}`}
        </HeaderText>
      </Header>

      <DepList>
        {missingDeps.map((dep) => {
          const isResolved = resolved.has(dep.entityType);
          const Icon = ENTITY_ICONS[dep.entityType] || Building2;

          return (
            <DepRow key={dep.entityType} $resolved={isResolved}>
              <DepIcon $resolved={isResolved}>
                {isResolved ? <Check size={14} /> : <Icon size={14} />}
              </DepIcon>
              <DepInfo>
                <DepLabel>{ENTITY_LABELS[dep.entityType] || dep.entityType}</DepLabel>
                {dep.suggestedName && (
                  <DepHint>
                    Suggested: {dep.suggestedName}
                    {dep.suggestedEmail && ` (${dep.suggestedEmail})`}
                  </DepHint>
                )}
              </DepInfo>
              <CreateBtn
                $resolved={isResolved}
                onClick={() => !isResolved && setCreating(dep)}
                disabled={isResolved}
              >
                {isResolved ? (
                  <>
                    <Check size={12} /> Created
                  </>
                ) : (
                  <>
                    <Plus size={12} /> Create
                  </>
                )}
              </CreateBtn>
            </DepRow>
          );
        })}
      </DepList>

      {creating && (
        <QuickCreateModal
          entityType={creating.entityType}
          isOpen={true}
          onClose={handleCloseCreating}
          onCreated={handleCreated}
          initialValues={{
            ...(creating.suggestedName ? { name: creating.suggestedName } : {}),
            ...(creating.suggestedEmail ? { email: creating.suggestedEmail } : {}),
            ...(creating.context || {}),
          }}
        />
      )}
    </Container>
  );
};

export default MissingDependencyResolver;
