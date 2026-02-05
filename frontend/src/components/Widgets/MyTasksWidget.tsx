/**
 * My Tasks Widget
 * 
 * Displays the user's assigned tasks in a compact widget format.
 * Uses the NotificationsContext for action items.
 * 
 * Features:
 * - Task list with priority indicators
 * - Due date highlighting
 * - Quick actions (view, delegate)
 * - Link to full My Tasks page
 * 
 * Theme Compliance:
 * - Uses CSS custom properties
 */
import React from 'react';
import styled from 'styled-components';
import { CheckCircle, Clock, AlertTriangle, ChevronRight, ListTodo } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WidgetCard } from './WidgetCard';
import { useNotifications, ActionItem } from '../../contexts/NotificationsContext';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface MyTasksWidgetProps {
  maxItems?: number;
}

// ============================================================================
// Styled Components
// ============================================================================

const TaskList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TaskItem = styled.div<{ $isOverdue: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-md);
  background: rgb(var(--color-background));
  border: 1px solid ${props => props.$isOverdue ? 'rgb(239, 68, 68)' : 'rgb(var(--color-border))'};
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgb(var(--color-primary) / 0.02);
  }
`;

const TaskPriorityDot = styled.div<{ $priority: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
  background: ${props => {
    switch (props.$priority) {
      case 'urgent': return 'rgb(239, 68, 68)';
      case 'high': return 'rgb(234, 179, 8)';
      case 'normal': return 'rgb(59, 130, 246)';
      default: return 'rgb(var(--color-text-tertiary))';
    }
  }};
`;

const TaskContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const TaskTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TaskMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

const TaskDueDate = styled.span<{ $isOverdue: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  color: ${props => props.$isOverdue ? 'rgb(239, 68, 68)' : 'inherit'};
  font-weight: ${props => props.$isOverdue ? '500' : '400'};
`;

const TaskFormName = styled.span`
  color: rgb(var(--color-text-secondary));
`;

const TaskArrow = styled.div`
  display: flex;
  align-items: center;
  color: rgb(var(--color-text-tertiary));
  opacity: 0;
  transition: opacity 0.15s ease;

  ${TaskItem}:hover & {
    opacity: 1;
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
  color: rgb(var(--color-text-tertiary));
`;

const EmptyIcon = styled.div`
  margin-bottom: 12px;
  opacity: 0.5;
`;

const EmptyText = styled.div`
  font-size: 14px;
`;

const ViewAllLink = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: 12px;
  margin-top: 8px;
  border: none;
  border-radius: var(--radius-md);
  background: rgb(var(--color-primary) / 0.05);
  color: rgb(var(--color-primary));
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgb(var(--color-primary) / 0.1);
  }
`;

const TaskCount = styled.span`
  font-weight: 400;
  opacity: 0.8;
`;

// ============================================================================
// Helpers
// ============================================================================

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return 'No due date';
  
  const date = new Date(dueDate);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 7) return `Due in ${days}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================================
// Component
// ============================================================================

export const MyTasksWidget: React.FC<MyTasksWidgetProps> = ({
  maxItems = 5,
}) => {
  const navigate = useNavigate();
  const { actionItems, loading, fetchActionItems } = useNotifications();

  // Sort by due date (overdue first, then by date)
  const sortedTasks = [...actionItems]
    .sort((a, b) => {
      const aOverdue = isOverdue(a.due_date);
      const bOverdue = isOverdue(b.due_date);
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return 0;
    })
    .slice(0, maxItems);

  const handleTaskClick = (task: ActionItem) => {
    if (task.submission_id) {
      navigate(`/my-submissions/${task.submission_id}`);
    } else {
      navigate('/my-tasks');
    }
  };

  const overdueCount = actionItems.filter(t => isOverdue(t.due_date)).length;

  return (
    <WidgetCard
      title="My Tasks"
      icon={<ListTodo size={16} />}
      loading={loading}
      onRefresh={fetchActionItems}
      badge={overdueCount > 0 ? `${overdueCount} overdue` : undefined}
      badgeVariant={overdueCount > 0 ? 'danger' : 'default'}
    >
      {sortedTasks.length === 0 ? (
        <EmptyState>
          <EmptyIcon>
            <CheckCircle size={40} />
          </EmptyIcon>
          <EmptyText>All caught up! No pending tasks.</EmptyText>
        </EmptyState>
      ) : (
        <>
          <TaskList>
            {sortedTasks.map(task => {
              const overdue = isOverdue(task.due_date);
              return (
                <TaskItem 
                  key={task.id} 
                  $isOverdue={overdue}
                  onClick={() => handleTaskClick(task)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && handleTaskClick(task)}
                >
                  <TaskPriorityDot $priority={task.priority} />
                  <TaskContent>
                    <TaskTitle>{task.title}</TaskTitle>
                    <TaskMeta>
                      {task.form_name && (
                        <TaskFormName>{task.form_name}</TaskFormName>
                      )}
                      <TaskDueDate $isOverdue={overdue}>
                        {overdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
                        {formatDueDate(task.due_date)}
                      </TaskDueDate>
                    </TaskMeta>
                  </TaskContent>
                  <TaskArrow>
                    <ChevronRight size={16} />
                  </TaskArrow>
                </TaskItem>
              );
            })}
          </TaskList>
          
          {actionItems.length > maxItems && (
            <ViewAllLink onClick={() => navigate('/my-tasks')}>
              View all tasks
              <TaskCount>({actionItems.length})</TaskCount>
              <ChevronRight size={14} />
            </ViewAllLink>
          )}
        </>
      )}
    </WidgetCard>
  );
};

export default MyTasksWidget;
