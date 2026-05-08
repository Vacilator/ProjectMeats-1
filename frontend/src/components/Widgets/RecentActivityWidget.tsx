/**
 * Recent Activity Widget
 *
 * Displays a feed of recent system activity.
 * Shows events like orders created, customers updated, etc.
 *
 * Features:
 * - Chronological activity feed
 * - Entity links
 * - Activity type icons
 *
 * Updated: 2026-02-04 - Phase 1.3 - Connected to real API
 *
 * Theme Compliance:
 * - Uses CSS custom properties
 */
import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { Activity, Package, Users, FileText, DollarSign } from 'lucide-react';
import { WidgetCard } from './WidgetCard';
import { useCockpitStats, ActivityItem } from '../../hooks/useCockpitStats';
import { formatDistanceToNow } from 'date-fns';
import { EntityDetailModal } from '../Shared/EntityDetailModal';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface RecentActivityWidgetProps {
  // Props for potential future customization
}

// ============================================================================
// Styled Components
// ============================================================================

const ActivityList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
  padding: 4px;
`;

const ActivityItemButton = styled.button`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid rgb(var(--color-border));
  background: transparent;
  text-align: left;
  transition: all 0.15s ease;
  cursor: pointer;

  &:hover {
    background: rgb(var(--color-background-hover));
    border-color: rgb(var(--color-primary));
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

const ActivityIcon = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm, 4px);
  background: ${props => props.$color}20;
  color: ${props => props.$color};
  flex-shrink: 0;
`;

const ActivityContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ActivityTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
`;

const ActivityMeta = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
`;

// ============================================================================
// Helper Functions
// ============================================================================

const SUPPORTED_MODAL_ENTITY_TYPES = new Set([
  'supplier',
  'customer',
  'contact',
  'purchase_order',
  'sales_order',
  'product',
  'carrier',
  'plant',
  'invoice',
]);

const normalizeEntityTypeForModal = (raw: string): string | null => {
  const value = (raw ?? '').toString().trim().toLowerCase();
  if (!value) return null;

  // Support legacy/camel variants like "PurchaseOrder" or "purchaseorder"
  const compact = value.replace(/\s+/g, '').replace(/_/g, '');
  if (compact === 'purchaseorder') return 'purchase_order';
  if (compact === 'salesorder') return 'sales_order';

  // Prefer snake_case types coming from backend TextChoices
  const normalized = value.replace(/\s+/g, '_');
  return SUPPORTED_MODAL_ENTITY_TYPES.has(normalized) ? normalized : null;
};

const getIconForEntityType = (entityType: string) => {
  const normalized = normalizeEntityTypeForModal(entityType) ?? entityType.toLowerCase();
  switch (normalized) {
    case 'purchase_order':
    case 'sales_order':
      return <Package size={16} />;
    case 'customer':
      return <Users size={16} />;
    case 'supplier':
      return <Users size={16} />;
    case 'invoice':
      return <DollarSign size={16} />;
    default:
      return <FileText size={16} />;
  }
};

const getColorForEntityType = (entityType: string) => {
  const normalized = normalizeEntityTypeForModal(entityType) ?? entityType.toLowerCase();
  switch (normalized) {
    case 'purchase_order':
      return 'rgb(var(--color-info))';
    case 'sales_order':
      return 'rgb(168, 85, 247)';
    case 'customer':
      return 'rgb(var(--color-success))';
    case 'supplier':
      return 'rgb(var(--color-warning))';
    case 'invoice':
      return 'rgb(var(--color-error))';
    default:
      return 'rgb(var(--color-neutral))';
  }
};

// ============================================================================
// Component
// ============================================================================

export const RecentActivityWidget: React.FC<RecentActivityWidgetProps> = () => {
  const { stats, isLoading, error, refetch } = useCockpitStats();
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; id: number } | null>(null);

  const activities = useMemo(() => stats?.recent_activity ?? [], [stats]);

  const handleActivityClick = (activity: ActivityItem) => {
    const type = normalizeEntityTypeForModal(activity.entity_type);
    if (!type) return;
    setSelectedEntity({ type, id: activity.entity_id });
  };

  return (
    <WidgetCard
      title="Recent Activity"
      icon={<Activity size={16} />}
      loading={isLoading}
      error={error || undefined}
      onRefresh={refetch}
    >
      {activities.length > 0 ? (
        <>
          <ActivityList>
            {activities.map(activity => {
              const modalType = normalizeEntityTypeForModal(activity.entity_type);
              const isClickable = !!modalType;

              return (
                <ActivityItemButton
                  key={activity.id}
                  type="button"
                  onClick={() => handleActivityClick(activity)}
                  aria-label={isClickable ? `Open ${activity.entity_type} details` : undefined}
                  style={{ cursor: isClickable ? 'pointer' : 'default', opacity: isClickable ? 1 : 0.75 }}
                  disabled={!isClickable}
                >
                  <ActivityIcon $color={getColorForEntityType(activity.entity_type)}>
                    {getIconForEntityType(activity.entity_type)}
                  </ActivityIcon>
                  <ActivityContent>
                    <ActivityTitle>{activity.title}</ActivityTitle>
                    <ActivityMeta>
                      {activity.content} • {activity.created_by} •{' '}
                      {formatDistanceToNow(new Date(activity.created_on), { addSuffix: true })}
                    </ActivityMeta>
                  </ActivityContent>
                </ActivityItemButton>
              );
            })}
          </ActivityList>

          {selectedEntity && (
            <EntityDetailModal
              isOpen={!!selectedEntity}
              onClose={() => setSelectedEntity(null)}
              entityType={selectedEntity.type}
              entityId={selectedEntity.id}
            />
          )}
        </>
      ) : (
        <EmptyState>
          <Activity size={32} style={{ marginBottom: '8px', opacity: 0.3 }} />
          <div>No recent activity</div>
        </EmptyState>
      )}
    </WidgetCard>
  );
};

export default RecentActivityWidget;
