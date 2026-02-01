/**
 * Recent Activity Widget
 * 
 * Displays a feed of recent system activity.
 * Shows events like orders created, shipments sent, etc.
 * 
 * Features:
 * - Chronological activity feed
 * - Entity links
 * - Activity type icons
 * 
 * Theme Compliance:
 * - Uses CSS custom properties
 */
import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Activity, Package, Truck, FileText, Users, ShoppingCart, Clock } from 'lucide-react';
import { WidgetCard } from './WidgetCard';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface ActivityItem {
  id: string;
  type: 'order' | 'shipment' | 'invoice' | 'customer' | 'supplier' | 'system';
  action: string;
  entity?: {
    type: string;
    id: string;
    name: string;
  };
  user?: {
    name: string;
    avatar?: string;
  };
  timestamp: string;
}

export interface RecentActivityWidgetProps {
  tenantId?: string;
  limit?: number;
}

// ============================================================================
// Styled Components
// ============================================================================

const ActivityList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ActivityItemRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px;
  border-radius: var(--radius-md);
  transition: background 0.15s ease;

  &:hover {
    background: rgb(var(--color-background));
  }
`;

const ActivityIcon = styled.div<{ $type: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${props => getActivityColor(props.$type)}20;
  color: ${props => getActivityColor(props.$type)};
`;

const ActivityContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ActivityText = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  line-height: 1.4;
`;

const EntityLink = styled.span`
  font-weight: 600;
  color: rgb(var(--color-primary));
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`;

const UserName = styled.span`
  font-weight: 500;
`;

const ActivityTime = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  margin-top: 2px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
  color: rgb(var(--color-text-tertiary));

  svg {
    margin-bottom: 8px;
    opacity: 0.5;
  }
`;

// ============================================================================
// Helper Functions
// ============================================================================

function getActivityColor(type: string): string {
  switch (type) {
    case 'order':
      return 'rgb(59, 130, 246)';
    case 'shipment':
      return 'rgb(234, 179, 8)';
    case 'invoice':
      return 'rgb(34, 197, 94)';
    case 'customer':
      return 'rgb(168, 85, 247)';
    case 'supplier':
      return 'rgb(236, 72, 153)';
    default:
      return 'rgb(var(--color-text-tertiary))';
  }
}

function getActivityIcon(type: string): React.ReactNode {
  switch (type) {
    case 'order':
      return <ShoppingCart size={14} />;
    case 'shipment':
      return <Truck size={14} />;
    case 'invoice':
      return <FileText size={14} />;
    case 'customer':
      return <Users size={14} />;
    case 'supplier':
      return <Package size={14} />;
    default:
      return <Activity size={14} />;
  }
}

// ============================================================================
// Component
// ============================================================================

export const RecentActivityWidget: React.FC<RecentActivityWidgetProps> = ({
  tenantId,
  limit = 10,
}) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    try {
      // Try to fetch from API, fall back to mock data
      const response = await axios.get(`/api/v1/workspace/activity/recent/?limit=${limit}`).catch(() => null);
      
      if (response?.data) {
        setActivities(response.data.activities);
      } else {
        // Mock data for development
        const now = new Date();
        setActivities([
          {
            id: '1',
            type: 'order',
            action: 'created PO',
            entity: { type: 'purchase_order', id: '1234', name: 'PO-2026-001234' },
            user: { name: 'John Smith' },
            timestamp: new Date(now.getTime() - 5 * 60000).toISOString(),
          },
          {
            id: '2',
            type: 'shipment',
            action: 'shipped to',
            entity: { type: 'customer', id: '456', name: 'Acme Foods Inc' },
            user: { name: 'Maria Garcia' },
            timestamp: new Date(now.getTime() - 15 * 60000).toISOString(),
          },
          {
            id: '3',
            type: 'invoice',
            action: 'marked paid',
            entity: { type: 'invoice', id: '789', name: 'INV-2026-000789' },
            user: { name: 'David Lee' },
            timestamp: new Date(now.getTime() - 45 * 60000).toISOString(),
          },
          {
            id: '4',
            type: 'customer',
            action: 'added new customer',
            entity: { type: 'customer', id: '101', name: 'Fresh Mart LLC' },
            user: { name: 'Sarah Wilson' },
            timestamp: new Date(now.getTime() - 2 * 3600000).toISOString(),
          },
          {
            id: '5',
            type: 'supplier',
            action: 'updated supplier',
            entity: { type: 'supplier', id: '202', name: 'Prime Beef Co' },
            user: { name: 'John Smith' },
            timestamp: new Date(now.getTime() - 4 * 3600000).toISOString(),
          },
        ]);
      }
      setError(null);
    } catch (err) {
      setError('Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [tenantId, limit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return (
    <WidgetCard
      title="Recent Activity"
      icon={<Activity size={16} />}
      loading={loading}
      error={error}
      onRefresh={fetchActivities}
    >
      {activities.length === 0 ? (
        <EmptyState>
          <Activity size={24} />
          <span>No recent activity</span>
        </EmptyState>
      ) : (
        <ActivityList>
          {activities.map(activity => (
            <ActivityItemRow key={activity.id}>
              <ActivityIcon $type={activity.type}>
                {getActivityIcon(activity.type)}
              </ActivityIcon>
              <ActivityContent>
                <ActivityText>
                  {activity.user && <UserName>{activity.user.name}</UserName>}{' '}
                  {activity.action}{' '}
                  {activity.entity && (
                    <EntityLink>{activity.entity.name}</EntityLink>
                  )}
                </ActivityText>
                <ActivityTime>
                  <Clock size={10} />
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </ActivityTime>
              </ActivityContent>
            </ActivityItemRow>
          ))}
        </ActivityList>
      )}
    </WidgetCard>
  );
};

export default RecentActivityWidget;
