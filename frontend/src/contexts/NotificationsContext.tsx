/**
 * Notifications context for managing user notifications across the app.
 * 
 * Provides:
 * - Real-time notification state
 * - Unread count tracking
 * - Mark as read/dismiss functionality
 * - Polling for new notifications
 */
import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getAuthHeader } from '../services/jwtService';

// ============================================================================
// TYPES
// ============================================================================

export type NotificationType = 
  | 'task_assigned'
  | 'task_due_soon'
  | 'task_overdue'
  | 'task_completed'
  | 'form_submitted'
  | 'form_approved'
  | 'form_rejected'
  | 'mention'
  | 'comment'
  | 'status_change'
  | 'workflow_trigger'
  | 'system';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
  id: string;
  tenant: string;
  user: number;
  notification_type: NotificationType;
  notification_type_display: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  priority_display: string;
  entity_type: string;
  entity_id: string | null;
  action_url: string;
  is_read: boolean;
  read_at: string | null;
  is_dismissed: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  expires_at: string | null;
  time_ago: string;
}

export interface NotificationPreferences {
  id: string;
  user: number;
  notifications_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  type_preferences: Record<NotificationType, Array<'email' | 'push' | 'in_app'>>;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  daily_digest_enabled: boolean;
  weekly_digest_enabled: boolean;
}

export interface ActionItem {
  id: string;
  type: 'form_step' | 'workflow_task';
  title: string;
  description: string;
  form_name?: string;
  step_name?: string;
  submission_id?: string;
  priority: NotificationPriority;
  status: string;
  due_date: string | null;
  is_overdue: boolean;
  assigned_at: string;
  entity_type?: string;
  entity_id?: string;
  /**
   * Optional monetary context for smart prioritization (e.g., PO value).
   * Provided by the backend when available.
   */
  related_po_value?: number;
  related_po_currency?: string;
}

export interface ActionItemCounts {
  total: number;
  overdue: number;
  due_today: number;
  due_this_week: number;
  by_priority: Record<string, number>;
  by_form: Array<{ form_name: string; count: number }>;
}

interface NotificationsContextType {
  // Notifications
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  
  // Action Items
  actionItems: ActionItem[];
  actionItemCounts: ActionItemCounts | null;
  fetchActionItems: () => Promise<void>;
  
  // Preferences
  preferences: NotificationPreferences | null;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  
  // Polling control
  startPolling: () => void;
  stopPolling: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

// ============================================================================
// API FUNCTIONS
// ============================================================================

const API_BASE = '/api/v1/workflows';

const buildApiHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const authHeader = getAuthHeader();
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  const tenantId = localStorage.getItem('tenantId');
  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }

  return headers;
};

async function fetchNotificationsAPI(): Promise<Notification[]> {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) return []; // Silently return empty if not authenticated

    const response = await fetch(`${API_BASE}/notifications/`, {
      headers: buildApiHeaders(),
    });
    
    // Silently return empty array for 401/404 (feature not available)
    if (response.status === 401 || response.status === 404) return [];
    if (!response.ok) throw new Error('Failed to fetch notifications');
    
    const data = await response.json();
    // Handle both paginated response {results: []} and bare array
    return Array.isArray(data) ? data : (data.results || []);
  } catch (error) {
    console.warn('[NotificationsContext] Notifications API not available:', error);
    return []; // Graceful degradation
  }
}

async function fetchUnreadCountAPI(): Promise<number> {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) return 0; // Silently return 0 if not authenticated

    const response = await fetch(`${API_BASE}/notifications/unread-count/`, {
      headers: buildApiHeaders(),
    });
    
    // Silently return 0 for 401/404 (feature not available)
    if (response.status === 401 || response.status === 404) return 0;
    if (!response.ok) throw new Error('Failed to fetch unread count');
    
    const data = await response.json();
    return data.count;
  } catch (error) {
    console.warn('[NotificationsContext] Unread count API not available:', error);
    return 0; // Graceful degradation
  }
}

async function markAsReadAPI(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/notifications/${id}/read/`, {
    method: 'POST',
    headers: buildApiHeaders(),
  });
  if (!response.ok) throw new Error('Failed to mark notification as read');
}

async function markAllAsReadAPI(): Promise<number> {
  const response = await fetch(`${API_BASE}/notifications/mark-all-read/`, {
    method: 'POST',
    headers: buildApiHeaders(),
  });
  if (!response.ok) throw new Error('Failed to mark all as read');
  const data = await response.json();
  return data.count;
}

async function dismissNotificationAPI(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/notifications/${id}/`, {
    method: 'DELETE',
    headers: buildApiHeaders(),
  });
  if (!response.ok) throw new Error('Failed to dismiss notification');
}

async function fetchActionItemsAPI(): Promise<ActionItem[]> {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) return [];

    const response = await fetch(`${API_BASE}/action-items/`, {
      headers: buildApiHeaders(),
    });
    
    if (response.status === 401 || response.status === 404) return [];
    if (!response.ok) throw new Error('Failed to fetch action items');
    return response.json();
  } catch (error) {
    console.warn('[NotificationsContext] Action items API not available:', error);
    return [];
  }
}

async function fetchActionItemCountsAPI(): Promise<ActionItemCounts> {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      return {
        total: 0,
        overdue: 0,
        due_today: 0,
        due_this_week: 0,
        by_priority: {},
        by_form: [],
      };
    }

    const response = await fetch(`${API_BASE}/action-items/counts/`, {
      headers: buildApiHeaders(),
    });
    
    if (response.status === 401 || response.status === 404) {
      return {
        total: 0,
        overdue: 0,
        due_today: 0,
        due_this_week: 0,
        by_priority: {},
        by_form: [],
      };
    }
    if (!response.ok) throw new Error('Failed to fetch action item counts');
    return response.json();
  } catch (error) {
    console.warn('[NotificationsContext] Action item counts API not available:', error);
    return {
      total: 0,
      overdue: 0,
      due_today: 0,
      due_this_week: 0,
      by_priority: {},
      by_form: [],
    };
  }
}

async function fetchPreferencesAPI(): Promise<NotificationPreferences> {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      return {
        id: '',
        user: 0,
        notifications_enabled: true,
        email_enabled: true,
        sms_enabled: false,
        push_enabled: false,
        type_preferences: {} as Record<NotificationType, Array<'email' | 'push' | 'in_app'>>,
        quiet_hours_enabled: false,
        quiet_hours_start: null,
        quiet_hours_end: null,
        daily_digest_enabled: false,
        weekly_digest_enabled: false,
      };
    }

    const response = await fetch(`${API_BASE}/notification-preferences/`, {
      headers: buildApiHeaders(),
    });
    
    if (response.status === 401 || response.status === 404) {
      return {
        id: '',
        user: 0,
        notifications_enabled: true,
        email_enabled: true,
        sms_enabled: false,
        push_enabled: false,
        type_preferences: {} as Record<NotificationType, Array<'email' | 'push' | 'in_app'>>,
        quiet_hours_enabled: false,
        quiet_hours_start: null,
        quiet_hours_end: null,
        daily_digest_enabled: false,
        weekly_digest_enabled: false,
      };
    }
    if (!response.ok) throw new Error('Failed to fetch preferences');
    return response.json();
  } catch (error) {
    console.warn('[NotificationsContext] Preferences API not available:', error);
    return {
      id: '',
      user: 0,
      notifications_enabled: true,
      email_enabled: true,
      sms_enabled: false,
      push_enabled: false,
      type_preferences: {} as Record<NotificationType, Array<'email' | 'push' | 'in_app'>>,
      quiet_hours_enabled: false,
      quiet_hours_start: null,
      quiet_hours_end: null,
      daily_digest_enabled: false,
      weekly_digest_enabled: false,
    };
  }
}

async function updatePreferencesAPI(prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  const response = await fetch(`${API_BASE}/notification-preferences/`, {
    method: 'PUT',
    headers: buildApiHeaders(),
    body: JSON.stringify(prefs),
  });
  if (!response.ok) throw new Error('Failed to update preferences');
  return response.json();
}

// ============================================================================
// PROVIDER
// ============================================================================

interface NotificationsProviderProps {
  children: ReactNode;
  pollingInterval?: number; // ms, default 30 seconds
}

export const NotificationsProvider: React.FC<NotificationsProviderProps> = ({ 
  children, 
  pollingInterval = 30000 
}) => {
  const { isAuthenticated } = useAuth();
  
  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [actionItemCounts, setActionItemCounts] = useState<ActionItemCounts | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [pollingActive, setPollingActive] = useState(false);
  
  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [notifs, count] = await Promise.all([
        fetchNotificationsAPI(),
        fetchUnreadCountAPI(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);
  
  // Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      await markAsReadAPI(id);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as read');
    }
  }, []);
  
  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await markAllAsReadAPI();
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark all as read');
    }
  }, []);
  
  // Dismiss notification
  const dismissNotification = useCallback(async (id: string) => {
    try {
      await dismissNotificationAPI(id);
      const notification = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss notification');
    }
  }, [notifications]);
  
  // Fetch action items
  const fetchActionItems = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const [items, counts] = await Promise.all([
        fetchActionItemsAPI(),
        fetchActionItemCountsAPI(),
      ]);
      setActionItems(items);
      setActionItemCounts(counts);
    } catch (err) {
      // Silently fail - action items are optional feature
      console.warn('[NotificationsContext] Action items not available');
    }
  }, [isAuthenticated]);
  
  // Update preferences
  const updatePreferences = useCallback(async (prefs: Partial<NotificationPreferences>) => {
    try {
      const updated = await updatePreferencesAPI(prefs);
      setPreferences(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
      throw err;
    }
  }, []);
  
  // Polling control
  const startPolling = useCallback(() => setPollingActive(true), []);
  const stopPolling = useCallback(() => setPollingActive(false), []);
  
  // Initial fetch when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      fetchActionItems();
      fetchPreferencesAPI().then(setPreferences).catch(() => {
        // Silently fail - preferences are optional
        console.warn('[NotificationsContext] Preferences API not available');
      });
      setPollingActive(true);
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setActionItems([]);
      setActionItemCounts(null);
      setPreferences(null);
      setPollingActive(false);
    }
  }, [isAuthenticated, fetchNotifications, fetchActionItems]);
  
  // Polling effect
  useEffect(() => {
    if (!pollingActive || !isAuthenticated) return;
    
    const interval = setInterval(async () => {
      try {
        const count = await fetchUnreadCountAPI();
        if (count !== unreadCount) {
          // New notifications, fetch full list
          await fetchNotifications();
        }
      } catch (err) {
        // Silently fail polling - it's not critical
        // console.warn('[NotificationsContext] Polling failed');
      }
    }, pollingInterval);
    
    return () => clearInterval(interval);
  }, [pollingActive, isAuthenticated, pollingInterval, unreadCount, fetchNotifications]);
  
  const value: NotificationsContextType = {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    actionItems,
    actionItemCounts,
    fetchActionItems,
    preferences,
    updatePreferences,
    startPolling,
    stopPolling,
  };
  
  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================

export const useNotifications = (): NotificationsContextType => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};

export default NotificationsContext;
