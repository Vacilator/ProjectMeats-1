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
import dayjs from 'dayjs';
import styled from 'styled-components';
import { CheckCircle, Clock, AlertTriangle, ChevronRight, ListTodo } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WidgetCard } from './WidgetCard';
import { useNotifications, ActionItem } from '../../contexts/NotificationsContext';
import { StatusActionCell } from '@/components/Workflow';
import { compareTasksSmart, isAtRiskTask, isTaskOverdue } from '../../utils/taskPrioritization';

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
  border: 1px solid ${props => props.$isOverdue ? 'rgb(var(--color-error))' : 'rgb(var(--color-border))'};
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
      case 'urgent': return 'rgb(var(--color-error))';
      case 'high': return 'rgb(var(--color-warning))';
      case 'normal': return 'rgb(var(--color-info))';
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
  color: ${props => props.$isOverdue ? 'rgb(var(--color-error))' : 'inherit'};
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
  return dayjs(date).format('MMM D');
}

// ============================================================================
// Component
// ============================================================================

export const MyTasksWidget: React.FC<MyTasksWidgetProps> = ({
  maxItems = 5,
}) => {
  const navigate = useNavigate();
  const { actionItems, loading, fetchActionItems } = useNotifications();

  // Smart sort: urgency × value (with stable tie-breakers)
  const sortedTasks = [...actionItems]
    .sort(compareTasksSmart)
    .slice(0, maxItems);

  const handleTaskClick = (task: ActionItem) => {
    if (task.submission_id) {
      navigate(`/workflows/run/${task.submission_id}`);
    } else {
      navigate('/workforms/tasks');
    }
  };

  const overdueCount = actionItems.filter(t => isTaskOverdue(t)).length;

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
              const overdue = isTaskOverdue(task);
              const atRisk = isAtRiskTask(task);
              const showAlert = overdue || atRisk;

              return (
                <TaskItem 
                  key={task.id} 
                  $isOverdue={showAlert}
                  onClick={() => handleTaskClick(task)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && handleTaskClick(task)}
                >
                  <TaskPriorityDot $priority={task.priority} />
                  <TaskContent>
                    <TaskTitle>{task.title}</TaskTitle>
                    <TaskMeta>
                      {task.entity_type && task.entity_id && task.status && (
                        <div onClick={e => e.stopPropagation()} style={{ marginRight: 4 }}>
                          <StatusActionCell
                            entityType={task.entity_type}
                            entityId={task.entity_id}
                            status={task.status}
                            compact
                            onTransitioned={fetchActionItems}
                          />
                        </div>
                      )}
                      {task.form_name && (
                        <TaskFormName>{task.form_name}</TaskFormName>
                      )}
                      <TaskDueDate $isOverdue={showAlert}>
                        {showAlert ? <AlertTriangle size={12} /> : <Clock size={12} />}
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
            <ViewAllLink onClick={() => navigate('/workforms/tasks')}>
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
