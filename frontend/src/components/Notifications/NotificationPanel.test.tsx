import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const markAsReadMock = vi.fn(async () => undefined);
const markAllAsReadMock = vi.fn(async () => undefined);
const dismissNotificationMock = vi.fn(async () => undefined);

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const DEFAULT_NOTIFICATION = {
  id: 'notif-1',
  tenant: 'tenant-1',
  user: 1,
  notification_type: 'system' as const,
  notification_type_display: 'System',
  title: 'Potential BOL received',
  message: 'Draft ready for review',
  priority: 'high' as const,
  priority_display: 'High',
  entity_type: 'ai_feedback',
  entity_id: 'draft-1',
  action_url: '/my-tasks?tab=ai-review&draft=draft-1',
  is_read: false,
  read_at: null,
  is_dismissed: false,
  metadata: {},
  created_at: '2026-05-07T12:00:00Z',
  expires_at: null,
  time_ago: 'Just now',
};

function _setupNotificationsMock(notifications: Array<typeof DEFAULT_NOTIFICATION>) {
  vi.doMock('../../contexts/NotificationsContext', () => ({
    useNotifications: () => ({
      notifications,
      unreadCount: notifications.filter((n) => !n.is_read).length,
      loading: false,
      error: null,
      markAsRead: markAsReadMock,
      markAllAsRead: markAllAsReadMock,
      dismissNotification: dismissNotificationMock,
      fetchNotifications: vi.fn(),
      actionItems: [],
      actionItemCounts: null,
      fetchActionItems: vi.fn(),
      preferences: null,
      updatePreferences: vi.fn(),
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
    }),
  }));
}

vi.mock('../../contexts/NotificationsContext', () => ({
  useNotifications: () => ({
    notifications: [DEFAULT_NOTIFICATION],
    unreadCount: 1,
    loading: false,
    error: null,
    markAsRead: markAsReadMock,
    markAllAsRead: markAllAsReadMock,
    dismissNotification: dismissNotificationMock,
    fetchNotifications: vi.fn(),
    actionItems: [],
    actionItemCounts: null,
    fetchActionItems: vi.fn(),
    preferences: null,
    updatePreferences: vi.fn(),
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
  }),
}));

import NotificationPanel from './NotificationPanel';

describe('NotificationPanel', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    markAsReadMock.mockClear();
    markAllAsReadMock.mockClear();
    dismissNotificationMock.mockClear();
  });

  it('marks the notification as read before navigating to the AI inbox draft', async () => {
    render(
      <MemoryRouter>
        <NotificationPanel onClose={vi.fn()} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('notification-item-notif-1'));

    await waitFor(() => {
      expect(markAsReadMock).toHaveBeenCalledWith('notif-1');
    });
    expect(navigateMock).toHaveBeenCalledWith('/my-tasks?tab=ai-review&draft=draft-1');
  });
});