import axios from 'axios';

import { apiClient } from './apiService';

const API_BASE = '/workflows';

const isNotFoundOrUnauthorized = (status?: number) => status === 401 || status === 404;

export const notificationsService = {
  async listNotifications(): Promise<unknown[]> {
    try {
      const response = await apiClient.get(`${API_BASE}/notifications/`);
      const data: any = response.data;
      return Array.isArray(data) ? data : (data?.results ?? []);
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (isNotFoundOrUnauthorized(status)) return [];
      throw err;
    }
  },

  async getUnreadCount(): Promise<number> {
    try {
      const response = await apiClient.get(`${API_BASE}/notifications/unread-count/`);
      const data: any = response.data;
      return Number(data?.count ?? 0);
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (isNotFoundOrUnauthorized(status)) return 0;
      throw err;
    }
  },

  async markAsRead(id: string): Promise<void> {
    await apiClient.post(`${API_BASE}/notifications/${id}/read/`);
  },

  async markAllRead(): Promise<number> {
    const response = await apiClient.post(`${API_BASE}/notifications/mark-all-read/`);
    const data: any = response.data;
    return Number(data?.count ?? 0);
  },

  async dismiss(id: string): Promise<void> {
    await apiClient.delete(`${API_BASE}/notifications/${id}/`);
  },

  async listActionItems(): Promise<unknown[]> {
    try {
      const response = await apiClient.get(`${API_BASE}/action-items/`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (isNotFoundOrUnauthorized(status)) return [];
      throw err;
    }
  },

  async getActionItemCounts(): Promise<any> {
    const empty = {
      total: 0,
      overdue: 0,
      due_today: 0,
      due_this_week: 0,
      by_priority: {},
      by_form: [],
    };

    try {
      const response = await apiClient.get(`${API_BASE}/action-items/counts/`);
      return response.data ?? empty;
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (isNotFoundOrUnauthorized(status)) return empty;
      throw err;
    }
  },

  async getPreferences(): Promise<any> {
    const defaults = {
      id: '',
      user: 0,
      notifications_enabled: true,
      email_enabled: true,
      sms_enabled: false,
      push_enabled: false,
      type_preferences: {},
      quiet_hours_enabled: false,
      quiet_hours_start: null,
      quiet_hours_end: null,
      daily_digest_enabled: false,
      weekly_digest_enabled: false,
    };

    try {
      const response = await apiClient.get(`${API_BASE}/notification-preferences/`);
      return response.data ?? defaults;
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (isNotFoundOrUnauthorized(status)) return defaults;
      throw err;
    }
  },

  async updatePreferences(prefs: Record<string, unknown>): Promise<any> {
    const response = await apiClient.put(`${API_BASE}/notification-preferences/`, prefs);
    return response.data;
  },
};
