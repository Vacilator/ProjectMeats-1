/**
 * NotificationPanel component - displays list of notifications with actions.
 *
 * Features:
 * - Grouped by time (Today, Yesterday, Earlier)
 * - Mark as read/dismiss
 * - Mark all as read
 * - Navigation to related entities
 * - Empty state
 */
import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Check, CheckCheck, X, Clock, AlertCircle,
  CheckCircle, MessageSquare, FileText, Workflow, Info,
  Filter
} from 'lucide-react';
import { useNotifications, Notification, NotificationType } from '../../contexts/NotificationsContext';
import { logger } from '@/utils/logger';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Panel = styled.div`
  width: min(380px, 92vw);
  max-height: min(500px, 70vh);
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(var(--color-overlay), 0.15);
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  padding: 16px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 8px;
`;

const UnreadBadge = styled.span`
  background: rgb(var(--color-primary));
  color: rgb(var(--color-text-inverse));
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 8px;
`;

const HeaderButton = styled.button`
  background: transparent;
  border: none;
  padding: 6px 10px;
  font-size: 12px;
  color: rgb(var(--color-primary));
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 4px;

  &:hover {
    background: rgb(var(--color-primary) / 0.1);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  padding: 4px;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgb(var(--color-surface-hover));
    color: rgb(var(--color-text-primary));
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
`;

const GroupHeader = styled.div`
  padding: 8px 16px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgb(var(--color-text-tertiary));
  background: rgb(var(--color-surface-secondary));
`;

const NotificationItem = styled.div<{ $isUnread: boolean; $priority: string }>`
  padding: 12px 16px;
  display: flex;
  gap: 12px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-left: 3px solid ${({ $priority }) =>
    $priority === 'urgent' ? 'rgb(var(--color-error))' :
    $priority === 'high' ? 'rgb(var(--color-warning))' :
    'transparent'
  };
  background-color: ${({ $isUnread }) =>
    $isUnread ? 'rgb(var(--color-primary) / 0.05)' : 'transparent'
  };

  &:hover {
    background-color: rgb(var(--color-surface-hover));
  }
`;

const IconContainer = styled.div<{ $type: NotificationType }>`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${({ $type }) => getIconBackground($type)};
  color: ${({ $type }) => getIconColor($type)};
`;

const NotificationContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const NotificationTitle = styled.div<{ $isUnread: boolean }>`
  font-size: 13px;
  font-weight: ${({ $isUnread }) => ($isUnread ? 600 : 400)};
  color: rgb(var(--color-text-primary));
  margin-bottom: 2px;
  line-height: 1.3;
`;

const NotificationMessage = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const NotificationMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
`;

const NotificationActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;

  ${NotificationItem}:hover & {
    opacity: 1;
  }
`;

const ActionButton = styled.button`
  background: transparent;
  border: none;
  padding: 4px;
  color: rgb(var(--color-text-tertiary));
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgb(var(--color-surface-hover));
    color: rgb(var(--color-text-primary));
  }
`;

const EmptyState = styled.div`
  padding: 40px 20px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
`;

const EmptyIcon = styled.div`
  margin-bottom: 12px;
  color: rgb(var(--color-text-tertiary));
`;

const EmptyTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  color: rgb(var(--color-text-primary));
`;

const EmptyMessage = styled.div`
  font-size: 12px;
`;

const LoadingState = styled.div`
  padding: 40px 20px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
`;

// ============================================================================
// HELPERS
// ============================================================================

/** Notification types that require user action */
const ACTION_REQUIRED_TYPES: Set<NotificationType> = new Set([
  'task_assigned',
  'task_due_soon',
  'task_overdue',
  'form_submitted',
  'form_rejected',
  'workflow_trigger',
]);

function isActionRequired(notification: Notification): boolean {
  return (
    ACTION_REQUIRED_TYPES.has(notification.notification_type) ||
    notification.priority === 'urgent' ||
    notification.priority === 'high'
  );
}

/**
 * Map a notification's action_url to the new Command Center route
 * when it pointed to old fragmented pages.
 */
export function resolveActionUrl(notification: Pick<Notification, 'action_url' | 'metadata'>): string {
  const url = notification.action_url;
  if (!url) return '';

  // Extract item ID from notification metadata (draft_id, inquiry_id, etc.)
  const payload = (notification.metadata || {}) as Record<string, unknown>;
  const itemId = (payload.draft_id || payload.review_id || payload.item_id || '') as string;

  // Redirect old process-cockpit / trader-cockpit links into Command Center
  if (url.startsWith('/process-cockpit') || url.includes('process-cockpit')) {
    const params = new URLSearchParams({ tab: 'action-required' });
    if (itemId) params.set('item', String(itemId));
    return `/command-center?${params.toString()}`;
  }
  if (url.startsWith('/trader-cockpit') || url.includes('trader-cockpit')) {
    return '/command-center?tab=pipeline';
  }
  if (url.startsWith('/ai-assistant') || url.includes('ai-assistant')) {
    const params = new URLSearchParams({ tab: 'action-required' });
    if (itemId) params.set('item', String(itemId));
    return `/command-center?${params.toString()}`;
  }
  if (url.startsWith('/activity') || url.includes('/activity')) {
    return '/command-center?tab=action-required';
  }

  return url;
}

const FilterToggle = styled.button<{ $active: boolean }>`
  background: ${({ $active }) =>
    $active ? 'rgb(var(--color-primary) / 0.1)' : 'transparent'};
  border: 1px solid ${({ $active }) =>
    $active ? 'rgb(var(--color-primary) / 0.3)' : 'transparent'};
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  color: ${({ $active }) =>
    $active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s ease;

  &:hover {
    background: rgb(var(--color-primary) / 0.08);
    color: rgb(var(--color-primary));
  }
`;

function getIconBackground(type: NotificationType): string {
  switch (type) {
    case 'task_assigned':
    case 'task_due_soon':
      return 'rgba(var(--color-info), 0.1)';
    case 'task_overdue':
      return 'rgba(var(--color-error), 0.1)';
    case 'task_completed':
    case 'form_approved':
      return 'rgba(var(--color-success), 0.1)';
    case 'form_rejected':
      return 'rgba(var(--color-error), 0.1)';
    case 'form_submitted':
      return 'rgba(var(--color-warning), 0.1)';
    case 'mention':
    case 'comment':
      return 'rgba(var(--color-primary), 0.1)';
    case 'status_change':
    case 'workflow_trigger':
      return 'rgba(var(--color-info), 0.1)';
    case 'system':
    default:
      return 'rgb(var(--color-text-tertiary) / 0.1)';
  }
}

function getIconColor(type: NotificationType): string {
  switch (type) {
    case 'task_assigned':
    case 'task_due_soon':
      return 'rgb(var(--color-info))';
    case 'task_overdue':
      return 'rgb(var(--color-error))';
    case 'task_completed':
    case 'form_approved':
      return 'rgb(var(--color-success))';
    case 'form_rejected':
      return 'rgb(var(--color-error))';
    case 'form_submitted':
      return 'rgb(var(--color-warning))';
    case 'mention':
    case 'comment':
      return 'rgb(var(--color-primary))';
    case 'status_change':
    case 'workflow_trigger':
      return 'rgb(var(--color-info))';
    case 'system':
    default:
      return 'rgb(var(--color-text-tertiary))';
  }
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'task_assigned':
    case 'task_due_soon':
      return Clock;
    case 'task_overdue':
      return AlertCircle;
    case 'task_completed':
    case 'form_approved':
      return CheckCircle;
    case 'form_rejected':
      return X;
    case 'form_submitted':
      return FileText;
    case 'mention':
    case 'comment':
      return MessageSquare;
    case 'status_change':
    case 'workflow_trigger':
      return Workflow;
    case 'system':
    default:
      return Info;
  }
}

function groupNotificationsByTime(notifications: Notification[]): Record<string, Notification[]> {
  const groups: Record<string, Notification[]> = {
    'Today': [],
    'Yesterday': [],
    'Earlier': [],
  };

  // Defensive check: ensure notifications is an array
  if (!Array.isArray(notifications)) {
    logger.warn('[NotificationPanel] Expected array, got:', typeof notifications);
    return groups;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  notifications.forEach(notification => {
    const date = new Date(notification.created_at);
    const notifDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (notifDate.getTime() === today.getTime()) {
      groups['Today'].push(notification);
    } else if (notifDate.getTime() === yesterday.getTime()) {
      groups['Yesterday'].push(notification);
    } else {
      groups['Earlier'].push(notification);
    }
  });

  return groups;
}

// ============================================================================
// COMPONENT
// ============================================================================

interface NotificationPanelProps {
  onClose: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [actionOnly, setActionOnly] = useState(true);
  const {
    notifications,
    unreadCount,
    loading,
    error: fetchError,
    markAsRead,
    markAllAsRead,
    dismissNotification
  } = useNotifications();

  const displayedNotifications = useMemo(() => {
    if (!actionOnly) return notifications;
    return notifications.filter(isActionRequired);
  }, [notifications, actionOnly]);

  const groupedNotifications = groupNotificationsByTime(displayedNotifications);
  const hasNotifications = displayedNotifications.length > 0;

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      try {
        await markAsRead(notification.id);
      } catch (err) {
        // Preserve navigation even if the read call fails.
        logger.debug('Failed to mark notification as read', { err, notificationId: notification.id });
      }
    }

    const url = resolveActionUrl(notification);
    if (url) {
      navigate(url);
      onClose();
    }
  };

  const handleMarkAsRead = (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    markAsRead(notification.id);
  };

  const handleDismiss = (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    dismissNotification(notification.id);
  };

  return (
    <Panel data-testid="notification-panel">
      <Header>
        <Title>
          <Bell size={18} />
          Notifications
          {unreadCount > 0 && <UnreadBadge>{unreadCount}</UnreadBadge>}
        </Title>
        <HeaderActions>
          <FilterToggle
            $active={actionOnly}
            onClick={() => setActionOnly((v) => !v)}
            title={actionOnly ? 'Showing action-required only' : 'Showing all notifications'}
          >
            <Filter size={12} />
            {actionOnly ? 'Action Only' : 'All'}
          </FilterToggle>
          {unreadCount > 0 && (
            <HeaderButton onClick={markAllAsRead}>
              <CheckCheck size={14} />
              Mark all read
            </HeaderButton>
          )}
          <CloseButton onClick={onClose} aria-label="Close notifications">
            <X size={16} />
          </CloseButton>
        </HeaderActions>
      </Header>

      <Content role="list" aria-label="Notifications" aria-live="polite">
        {loading ? (
          <LoadingState>Loading notifications...</LoadingState>
        ) : fetchError ? (
          <EmptyState>
            <EmptyIcon>
              <AlertCircle size={40} strokeWidth={1.5} />
            </EmptyIcon>
            <EmptyTitle>Failed to load</EmptyTitle>
            <EmptyMessage>{fetchError}</EmptyMessage>
          </EmptyState>
        ) : !hasNotifications ? (
          <EmptyState>
            <EmptyIcon>
              <Bell size={40} strokeWidth={1.5} />
            </EmptyIcon>
            <EmptyTitle>No notifications</EmptyTitle>
            <EmptyMessage>You're all caught up!</EmptyMessage>
          </EmptyState>
        ) : (
          Object.entries(groupedNotifications).map(([group, items]) =>
            items.length > 0 && (
              <React.Fragment key={group}>
                <GroupHeader>{group}</GroupHeader>
                {items.map(notification => {
                  const Icon = getNotificationIcon(notification.notification_type);
                  return (
                    <NotificationItem
                      key={notification.id}
                      data-testid={`notification-item-${notification.id}`}
                      $isUnread={!notification.is_read}
                      $priority={notification.priority}
                      role="listitem"
                      aria-label={`${notification.is_read ? '' : 'Unread: '}${notification.title}`}
                      onClick={() => void handleNotificationClick(notification)}
                    >
                      <IconContainer $type={notification.notification_type}>
                        <Icon size={18} />
                      </IconContainer>
                      <NotificationContent>
                        <NotificationTitle $isUnread={!notification.is_read}>
                          {notification.title}
                        </NotificationTitle>
                        <NotificationMessage>
                          {notification.message}
                        </NotificationMessage>
                        <NotificationMeta>
                          <span>{notification.time_ago}</span>
                          {notification.priority !== 'normal' && (
                            <span style={{ textTransform: 'capitalize' }}>
                              • {notification.priority}
                            </span>
                          )}
                        </NotificationMeta>
                      </NotificationContent>
                      <NotificationActions>
                        {!notification.is_read && (
                          <ActionButton
                            onClick={(e) => handleMarkAsRead(e, notification)}
                            title="Mark as read"
                          >
                            <Check size={14} />
                          </ActionButton>
                        )}
                        <ActionButton
                          onClick={(e) => handleDismiss(e, notification)}
                          title="Dismiss"
                        >
                          <X size={14} />
                        </ActionButton>
                      </NotificationActions>
                    </NotificationItem>
                  );
                })}
              </React.Fragment>
            )
          )
        )}
      </Content>
    </Panel>
  );
};

export default NotificationPanel;
