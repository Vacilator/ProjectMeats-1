/**
 * DependencyWizard
 *
 * Step-by-step checklist showing required entities for a trade.
 * Green checkmarks for satisfied, amber alerts for missing.
 * "Create Now" buttons open EntityFormSurface inline.
 * Auto-advances to next step when a dependency is created.
 *
 * Theme Compliance: CSS custom properties only.
 * Service Layer: Uses traderService for dependency checks.
 */
import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Button, Space, Tag } from 'antd';
import {
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowRight,
  Building2,
  User,
  Factory,
  Truck,
  MapPin,
  Users,
} from 'lucide-react';

import type { DependencyItem } from '../../services/traderService';
import { EntityFormSurface } from '../Shared';

// ============================================================================
// Types
// ============================================================================

export interface DependencyWizardProps {
  checklist: DependencyItem[];
  allSatisfied: boolean;
  onStartTrade: () => void;
  onRefresh: () => void;
  loading?: boolean;
  className?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
`;

const Title = styled.h3`
  font-size: 0.9rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary, 17 24 39));
  margin: 0;
`;

const ProgressBadge = styled.span<{ $complete: boolean }>`
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  background: ${(p) => p.$complete
    ? 'rgba(var(--color-success), 0.1)'
    : 'rgba(var(--color-warning), 0.1)'};
  color: ${(p) => p.$complete
    ? 'rgb(var(--color-success))'
    : 'rgb(var(--color-warning))'};
`;

const ChecklistItem = styled.div<{ $satisfied: boolean; $required: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid ${(p) =>
    p.$satisfied
      ? 'rgba(var(--color-success), 0.2)'
      : p.$required
        ? 'rgba(var(--color-warning), 0.3)'
        : 'rgb(var(--color-border, 229 231 235))'};
  background: ${(p) =>
    p.$satisfied
      ? 'rgba(var(--color-success), 0.03)'
      : 'rgba(var(--color-bg-secondary, 249 250 251))'};
  transition: border-color 0.2s, background 0.2s;
`;

const IconWrapper = styled.div<{ $satisfied: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${(p) => p.$satisfied
    ? 'rgba(var(--color-success), 0.1)'
    : 'rgba(var(--color-warning), 0.1)'};
  color: ${(p) => p.$satisfied
    ? 'rgb(var(--color-success))'
    : 'rgb(var(--color-warning))'};
  flex-shrink: 0;
`;

const ItemContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ItemLabel = styled.div`
  font-size: 0.8rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary, 17 24 39));
`;

const ItemHint = styled.div`
  font-size: 0.7rem;
  color: rgb(var(--color-text-tertiary, 107 114 128));
  margin-top: 1px;
`;

const ItemEntity = styled.div`
  font-size: 0.7rem;
  color: rgb(var(--color-success));
  font-weight: 500;
  margin-top: 2px;
`;

const StartButton = styled(Button)`
  margin-top: 8px;
`;

// ============================================================================
// Icon Mapping
// ============================================================================

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  customer: <Building2 size={14} />,
  supplier: <Users size={14} />,
  plant: <Factory size={14} />,
  contact: <User size={14} />,
  carrier: <Truck size={14} />,
  location: <MapPin size={14} />,
};

// ============================================================================
// Component
// ============================================================================

export const DependencyWizard: React.FC<DependencyWizardProps> = ({
  checklist,
  allSatisfied,
  onStartTrade,
  onRefresh,
  loading = false,
  className,
}) => {
  const [createModalType, setCreateModalType] = useState<string | null>(null);

  const satisfiedCount = useMemo(
    () => checklist.filter((item) => item.satisfied).length,
    [checklist]
  );

  const handleCreateSuccess = useCallback(() => {
    setCreateModalType(null);
    onRefresh();
  }, [onRefresh]);

  return (
    <Container className={className}>
      <Header>
        <Title>Trade Dependencies</Title>
        <ProgressBadge $complete={allSatisfied}>
          {satisfiedCount}/{checklist.length} ready
        </ProgressBadge>
      </Header>

      {checklist.map((item) => (
        <ChecklistItem
          key={item.entity_type}
          $satisfied={item.satisfied}
          $required={item.required}
        >
          <IconWrapper $satisfied={item.satisfied}>
            {item.satisfied ? (
              <CheckCircle2 size={14} />
            ) : (
              ENTITY_ICONS[item.entity_type] || <AlertTriangle size={14} />
            )}
          </IconWrapper>

          <ItemContent>
            <ItemLabel>
              {item.label}
              {!item.required && (
                <Tag
                  color="default"
                  style={{ marginLeft: 6, fontSize: '0.6rem', lineHeight: 1.4 }}
                >
                  Optional
                </Tag>
              )}
            </ItemLabel>
            <ItemHint>{item.hint}</ItemHint>
            {item.satisfied && item.entity_name && (
              <ItemEntity>✓ {item.entity_name}</ItemEntity>
            )}
          </ItemContent>

          {!item.satisfied && item.required && (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<Plus size={12} />}
              onClick={() => setCreateModalType(item.entity_type)}
            >
              Create
            </Button>
          )}
          {!item.satisfied && !item.required && (
            <Button
              size="small"
              type="default"
              icon={<Plus size={12} />}
              onClick={() => setCreateModalType(item.entity_type)}
            >
              Add
            </Button>
          )}
        </ChecklistItem>
      ))}

      {allSatisfied && (
        <StartButton
          type="primary"
          size="large"
          icon={<ArrowRight size={16} />}
          onClick={onStartTrade}
          loading={loading}
          block
        >
          All Clear — Start Trade Pipeline
        </StartButton>
      )}

      {/* Quick-create modal for missing entities */}
      {createModalType && (
        <EntityFormSurface
          entityType={createModalType}
          mode="create"
          isOpen={true}
          onClose={() => setCreateModalType(null)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </Container>
  );
};

export default DependencyWizard;
