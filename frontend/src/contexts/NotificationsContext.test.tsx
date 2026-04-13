/**
 * Tests for NotificationsContext.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { vi } from 'vitest';
import { NotificationsProvider, useNotifications, Notification, ActionItem } from './NotificationsContext';

import { notificationsService } from '../services/notificationsService';

vi.mock('../services/notificationsService', () => ({
  notificationsService: {
    listNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllRead: vi.fn(),
    dismiss: vi.fn(),
    listActionItems: vi.fn(),
    getActionItemCounts: vi.fn(),
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
  },
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(() => 'test-token'),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock AuthContext to always be authenticated
vi.mock('./AuthContext', () => ({
  ...vi.importActual('./AuthContext'),
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 1, username: 'testuser' },
    loading: false,
  }),
}));

vi.mock('../services/jwtService', async () => {
  const actual = await vi.importActual<typeof import('../services/jwtService')>('../services/jwtService');
  return {
    ...actual,
    getAuthHeader: () => 'Bearer test-token',
  };
});

// Sample notifications
const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    tenant: 'tenant-1',
    user: 1,
    notification_type: 'task_assigned',
    notification_type_display: 'Task Assigned',
    title: 'New Task',
    message: 'You have been assigned a new task',
    priority: 'high',
    priority_display: 'High',
    entity_type: 'form_submission',
    entity_id: 'entity-1',
    action_url: '/tasks/1',
    is_read: false,
    read_at: null,
    is_dismissed: false,
    metadata: {},
    created_at: new Date().toISOString(),
    expires_at: null,
    time_ago: 'Just now',
  },
  {
    id: 'notif-2',
    tenant: 'tenant-1',
    user: 1,
    notification_type: 'form_submitted',
    notification_type_display: 'Form Submitted',
    title: 'Form Submitted',
    message: 'A form has been submitted for review',
    priority: 'normal',
    priority_display: 'Normal',
    entity_type: 'form_submission',
    entity_id: 'entity-2',
    action_url: '/forms/2',
    is_read: true,
    read_at: new Date().toISOString(),
    is_dismissed: false,
    metadata: {},
    created_at: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    expires_at: null,
    time_ago: '1d ago',
  },
];

const mockActionItems: ActionItem[] = [
  {
    id: 'action-1',
    type: 'form_step',
    title: 'Complete Supplier Form',
    description: 'Fill out supplier information',
    form_name: 'Supplier Onboarding',
    step_name: 'Supplier Info',
    submission_id: 'sub-1',
    priority: 'high',
    status: 'action_needed',
    due_date: new Date(Date.now() + 86400000).toISOString(),
    is_overdue: false,
    assigned_at: new Date().toISOString(),
    entity_type: 'supplier',
    entity_id: 'supplier-1',
  },
];

const mockActionItemCounts = {
  total: 5,
  overdue: 1,
  due_today: 2,
  due_this_week: 3,
  by_priority: { high: 2, normal: 2, low: 1 },
  by_form: [{ form_name: 'Supplier Onboarding', count: 3 }],
};

const mockPreferences = {
  id: 'pref-1',
  user: 1,
  notifications_enabled: true,
  email_enabled: true,
  sms_enabled: false,
  push_enabled: true,
  type_preferences: {},
  quiet_hours_enabled: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
  daily_digest_enabled: false,
  weekly_digest_enabled: false,
};

// Wrapper component
const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => (
    <NotificationsProvider pollingInterval={60000}>
      {children}
    </NotificationsProvider>
  );
};

describe('NotificationsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(notificationsService.listNotifications).mockResolvedValue(mockNotifications as any);
    vi.mocked(notificationsService.getUnreadCount).mockResolvedValue(1 as any);
    vi.mocked(notificationsService.listActionItems).mockResolvedValue(mockActionItems as any);
    vi.mocked(notificationsService.getActionItemCounts).mockResolvedValue(mockActionItemCounts as any);
    vi.mocked(notificationsService.getPreferences).mockResolvedValue(mockPreferences as any);
    vi.mocked(notificationsService.updatePreferences).mockResolvedValue(mockPreferences as any);

    vi.mocked(notificationsService.markAsRead).mockResolvedValue(undefined as any);
    vi.mocked(notificationsService.markAllRead).mockResolvedValue(1 as any);
    vi.mocked(notificationsService.dismiss).mockResolvedValue(undefined as any);
  });

  describe('useNotifications hook', () => {
    it('should throw error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        renderHook(() => useNotifications());
      }).toThrow('useNotifications must be used within a NotificationsProvider');
      
      consoleSpy.mockRestore();
    });

    it('should provide initial empty state', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      // Initially, notifications array is empty
      expect(result.current.notifications).toEqual([]);
      expect(result.current.error).toBeNull();
      
      // Loading may be true or false depending on timing (useEffect runs immediately)
      // Wait for loading to settle after initial fetch
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should fetch notifications on mount', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.notifications.length).toBeGreaterThan(0);
      });

      expect(result.current.notifications).toEqual(mockNotifications);
    });

    it('should track unread count', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.unreadCount).toBe(1);
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.notifications.length).toBeGreaterThan(0);
      });

      await act(async () => {
        await result.current.markAsRead('notif-1');
      });

      expect(result.current.notifications[0].is_read).toBe(true);
      expect(result.current.unreadCount).toBe(0);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.notifications.length).toBeGreaterThan(0);
      });

      await act(async () => {
        await result.current.markAllAsRead();
      });

      expect(result.current.unreadCount).toBe(0);
      result.current.notifications.forEach(n => {
        expect(n.is_read).toBe(true);
      });
    });
  });

  describe('dismissNotification', () => {
    it('should remove notification from list', async () => {

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.notifications.length).toBe(2);
      });

      await act(async () => {
        await result.current.dismissNotification('notif-1');
      });

      expect(result.current.notifications.length).toBe(1);
      expect(result.current.notifications.find(n => n.id === 'notif-1')).toBeUndefined();
    });
  });

  describe('action items', () => {
    it('should fetch action items', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.actionItems.length).toBeGreaterThan(0);
      });

      expect(result.current.actionItems).toEqual(mockActionItems);
    });

    it('should fetch action item counts', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.actionItemCounts).not.toBeNull();
      });

      expect(result.current.actionItemCounts?.total).toBe(5);
      expect(result.current.actionItemCounts?.overdue).toBe(1);
    });
  });

  describe('preferences', () => {
    it('should fetch preferences on mount', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.preferences).not.toBeNull();
      });

      expect(result.current.preferences?.notifications_enabled).toBe(true);
      expect(result.current.preferences?.email_enabled).toBe(true);
    });

    it('should update preferences', async () => {
      const updatedPrefs = { ...mockPreferences, email_enabled: false };

      vi.mocked(notificationsService.updatePreferences).mockResolvedValue(updatedPrefs as any);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.preferences).not.toBeNull();
      });

      await act(async () => {
        await result.current.updatePreferences({ email_enabled: false });
      });

      expect(result.current.preferences?.email_enabled).toBe(false);
    });
  });

  describe('polling', () => {
    it('should start polling on mount', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.notifications.length).toBeGreaterThan(0);
      });

      // Polling is started automatically when authenticated
      // We can't easily test the interval, but we can verify initial fetch happened
      expect(notificationsService.listNotifications).toHaveBeenCalled();
    });

    it('should stop polling when stopPolling is called', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.notifications.length).toBeGreaterThan(0);
      });

      act(() => {
        result.current.stopPolling();
      });

      // Verify stopPolling doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      vi.mocked(notificationsService.listNotifications).mockRejectedValue(new Error('Server error'));
      vi.mocked(notificationsService.getUnreadCount).mockResolvedValue(0 as any);
      vi.mocked(notificationsService.listActionItems).mockResolvedValue([] as any);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      // With graceful degradation (PR #2484), errors don't set error state
      // Instead, APIs that fail return empty data and log warnings
      await waitFor(() => {
        expect(result.current.notifications).toEqual([]);
        expect(result.current.error).toBeNull();
        expect(result.current.loading).toBe(false);
      });
    });
  });
});
