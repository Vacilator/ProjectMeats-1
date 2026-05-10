/**
 * Action Items Widget
 * 
 * Displays pending tasks and action items assigned to the current user.
 * Provides quick access to task management and completion tracking.
 * 
 * Features:
 * - Task list with priority indicators
 * - Due date warnings
 * - Quick task completion
 * - Task categorization
 * 
 * Theme Compliance:
 * - Uses CSS custom properties
 */
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { 
  CheckSquare, Clock, ChevronRight 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WidgetCard } from './WidgetCard';
import { apiClient } from '../../services/apiService';
import { logger } from '@/utils/logger';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface ActionItem {
  id: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  category: string;
  assignedTo: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface ActionItemsWidgetProps {
  limit?: number;
}

// ============================================================================
// Styled Components
// ============================================================================

const ItemsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Item = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-surface));
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.03);
    box-shadow: 0 2px 8px rgba(var(--color-overlay), 0.05);
  }
`;

const PriorityIndicator = styled.div<{ $priority: string }>`
  width: 4px;
  height: 32px;
  border-radius: 2px;
  background: ${props => {
    switch (props.$priority) {
      case 'high': return 'rgb(var(--color-error))';
      case 'medium': return 'rgb(var(--color-warning))';
      case 'low': return 'rgb(var(--color-success))';
      default: return 'rgb(var(--color-border))';
    }
  }};
  flex-shrink: 0;
`;

const ItemContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ItemTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
`;

const ItemMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
`;

const MetaBadge = styled.div<{ $warning?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  background: ${props => props.$warning 
    ? 'rgba(var(--color-error), 0.1)' 
    : 'rgba(var(--color-primary), 0.1)'};
  color: ${props => props.$warning 
    ? 'rgb(var(--color-error))' 
    : 'rgb(var(--color-primary))'};
`;

const ItemAction = styled.div`
  display: flex;
  align-items: center;
  color: rgb(var(--color-text-tertiary));
  flex-shrink: 0;
`;

const EmptyState = styled.div`
  padding: 32px 16px;
  text-align: center;
  color: rgb(var(--color-text-tertiary));
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 8px;
  opacity: 0.3;
`;

const EmptyText = styled.div`
  font-size: 13px;
`;

// ============================================================================
// Helper Functions
// ============================================================================

const formatDueDate = (dueDate: string): string => {
  const date = new Date(dueDate);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays} days`;
};

const isDueSoon = (dueDate: string): boolean => {
  const date = new Date(dueDate);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 2;
};

// ============================================================================
// Component
// ============================================================================

export const ActionItemsWidget: React.FC<ActionItemsWidgetProps> = ({
  limit = 5,
}) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActionItems = async () => {
      try {
        const response = await apiClient.get('/workflows/action-items/', {
          params: { status: 'pending,in_progress', limit }
        });
        setItems(response.data.results || []);
      } catch (error) {
        logger.error('[ActionItemsWidget] Failed to fetch action items:', error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchActionItems();
  }, [limit]);

  const handleItemClick = (item: ActionItem) => {
    navigate(`/workflows/tasks/${item.id}`);
  };

  if (loading) {
    return (
      <WidgetCard
        title="Action Items"
        icon={<CheckSquare size={16} />}
      >
        <EmptyState>
          <EmptyText>Loading...</EmptyText>
        </EmptyState>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title="Action Items"
      icon={<CheckSquare size={16} />}
      badge={items.length > 0 ? items.length : undefined}
    >
      {items.length === 0 ? (
        <EmptyState>
          <EmptyIcon>✓</EmptyIcon>
          <EmptyText>All caught up! No pending action items.</EmptyText>
        </EmptyState>
      ) : (
        <ItemsList>
          {items.map(item => (
            <Item key={item.id} onClick={() => handleItemClick(item)}>
              <PriorityIndicator $priority={item.priority} />
              <ItemContent>
                <ItemTitle>{item.title}</ItemTitle>
                <ItemMeta>
                  <MetaBadge>
                    {item.category}
                  </MetaBadge>
                  {item.dueDate && (
                    <MetaBadge $warning={isDueSoon(item.dueDate)}>
                      <Clock size={10} />
                      {formatDueDate(item.dueDate)}
                    </MetaBadge>
                  )}
                </ItemMeta>
              </ItemContent>
              <ItemAction>
                <ChevronRight size={16} />
              </ItemAction>
            </Item>
          ))}
        </ItemsList>
      )}
    </WidgetCard>
  );
};

export default ActionItemsWidget;
