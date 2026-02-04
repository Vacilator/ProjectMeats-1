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
import React from 'react';
import styled from 'styled-components';
import { Activity, Package, Users, FileText, DollarSign } from 'lucide-react';
import { WidgetCard } from './WidgetCard';
import { useCockpitStats } from '../../hooks/useCockpitStats';
import { formatDistanceToNow } from 'date-fns';

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

const ActivityItemCard = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid rgb(var(--color-border));
  transition: all 0.15s ease;

  &:hover {
    background: rgb(var(--color-background-hover));
    border-color: rgb(var(--color-primary));
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

const getIconForEntityType = (entityType: string) => {
  switch (entityType.toLowerCase()) {
    case 'purchaseorder':
    case 'salesorder':
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
  switch (entityType.toLowerCase()) {
    case 'purchaseorder':
      return 'rgb(59, 130, 246)';
    case 'salesorder':
      return 'rgb(168, 85, 247)';
    case 'customer':
      return 'rgb(34, 197, 94)';
    case 'supplier':
      return 'rgb(234, 179, 8)';
    case 'invoice':
      return 'rgb(239, 68, 68)';
    default:
      return 'rgb(107, 114, 128)';
  }
};

// ============================================================================
// Component
// ============================================================================

export const RecentActivityWidget: React.FC<RecentActivityWidgetProps> = () => {
  const { stats, isLoading, error, refetch } = useCockpitStats();

  return (
    <WidgetCard
      title="Recent Activity"
      icon={<Activity size={16} />}
      loading={isLoading}
      error={error || undefined}
      onRefresh={refetch}
    >
      {stats && stats.recent_activity.length > 0 ? (
        <ActivityList>
          {stats.recent_activity.map(activity => (
            <ActivityItemCard key={activity.id}>
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
            </ActivityItemCard>
          ))}
        </ActivityList>
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
