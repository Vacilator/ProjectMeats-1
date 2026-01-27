/**
 * Quick Actions Service
 *
 * Handles API calls for Quick Actions and Form Submissions.
 * Supports request cancellation via AbortController.
 */
import axios, { CancelTokenSource } from 'axios';
import { config } from '../config/runtime';

const API_BASE_URL = config.API_BASE_URL;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
});

// Request interceptor for authentication
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  const tenantId = localStorage.getItem('tenantId');
  if (tenantId) {
    config.headers['X-Tenant-ID'] = tenantId;
  }
  return config;
});

// Cancel token manager for request cancellation
class CancelTokenManager {
  private tokens: Map<string, CancelTokenSource> = new Map();

  create(key: string): CancelTokenSource {
    // Cancel existing request with same key
    this.cancel(key);
    
    const source = axios.CancelToken.source();
    this.tokens.set(key, source);
    return source;
  }

  cancel(key: string, message?: string): void {
    const source = this.tokens.get(key);
    if (source) {
      source.cancel(message || `Request ${key} cancelled`);
      this.tokens.delete(key);
    }
  }

  cancelAll(message?: string): void {
    this.tokens.forEach((source, key) => {
      source.cancel(message || `Request ${key} cancelled`);
    });
    this.tokens.clear();
  }

  remove(key: string): void {
    this.tokens.delete(key);
  }
}

export const cancelTokenManager = new CancelTokenManager();

// Types
export interface QuickActionItem {
  id: string;
  type: 'form' | 'workflow';
  form_id?: string;
  workflow_id?: string;
  label: string;
  icon: string;
  order: number;
}

export interface AvailableForm {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: string;
  is_default: boolean;
  is_quick_action_enabled: boolean;
  step_count: number;
}

export interface FormSubmission {
  id: string;
  tenant: string;
  form: string;
  form_name: string;
  form_description: string;
  form_icon: string;
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled';
  current_step: string | null;
  current_step_name: string | null;
  data: Record<string, Record<string, any>>;
  form_snapshot: any;
  step_submissions: StepSubmission[];
  progress: {
    completed: number;
    total: number;
    percent: number;
  };
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface StepSubmission {
  id: string;
  step: string;
  step_name: string;
  step_order: number;
  entity_type: string;
  status: 'not_started' | 'in_progress' | 'action_needed' | 'completed' | 'skipped';
  data: Record<string, any>;
  completed_at: string | null;
  completed_by: number | null;
  completed_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormSubmissionListItem {
  id: string;
  form: string;
  form_name: string;
  form_icon: string;
  status: string;
  created_by: number;
  created_by_name: string;
  progress: {
    completed: number;
    total: number;
    percent: number;
  };
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// Quick Actions API
export const quickActionsService = {
  /**
   * Get user's current quick actions
   * @param cancelKey - Optional key for cancellation tracking
   */
  async getQuickActions(cancelKey?: string): Promise<{ items: QuickActionItem[] }> {
    const config = cancelKey 
      ? { cancelToken: cancelTokenManager.create(cancelKey).token }
      : {};
    const response = await apiClient.get('/workflows/quick-actions/', config);
    if (cancelKey) cancelTokenManager.remove(cancelKey);
    return response.data;
  },

  /**
   * Update user's quick actions
   */
  async updateQuickActions(items: QuickActionItem[]): Promise<{ success: boolean; items: QuickActionItem[] }> {
    const response = await apiClient.put('/workflows/quick-actions/', { items });
    return response.data;
  },

  /**
   * Get forms available for Quick Actions
   * @param cancelKey - Optional key for cancellation tracking
   */
  async getAvailableForms(cancelKey?: string): Promise<AvailableForm[]> {
    const config = cancelKey 
      ? { cancelToken: cancelTokenManager.create(cancelKey).token }
      : {};
    const response = await apiClient.get('/workflows/available-forms/', config);
    if (cancelKey) cancelTokenManager.remove(cancelKey);
    return response.data;
  },
};

// Form Submissions API
export const formSubmissionService = {
  /**
   * List user's form submissions
   * @param cancelKey - Optional key for cancellation tracking
   */
  async list(params?: { status?: string; form?: string }, cancelKey?: string): Promise<FormSubmissionListItem[]> {
    const config = cancelKey 
      ? { params, cancelToken: cancelTokenManager.create(cancelKey).token }
      : { params };
    const response = await apiClient.get('/workflows/form-submissions/', config);
    if (cancelKey) cancelTokenManager.remove(cancelKey);
    return response.data;
  },

  /**
   * Create a new form submission
   */
  async create(formId: string): Promise<FormSubmission> {
    const response = await apiClient.post('/workflows/form-submissions/', { form: formId });
    return response.data;
  },

  /**
   * Get submission details
   * @param cancelKey - Optional key for cancellation tracking
   */
  async get(submissionId: string, cancelKey?: string): Promise<FormSubmission> {
    const config = cancelKey 
      ? { cancelToken: cancelTokenManager.create(cancelKey).token }
      : {};
    const response = await apiClient.get(`/workflows/form-submissions/${submissionId}/`, config);
    if (cancelKey) cancelTokenManager.remove(cancelKey);
    return response.data;
  },

  /**
   * Auto-save a field value
   * Uses cancel token keyed by submission+step+field to prevent duplicate saves
   */
  async autoSave(
    submissionId: string,
    stepId: string,
    fieldKey: string,
    value: any
  ): Promise<{ success: boolean; saved_at: string }> {
    // Cancel any pending save for this field
    const cancelKey = `autosave-${submissionId}-${stepId}-${fieldKey}`;
    const source = cancelTokenManager.create(cancelKey);
    
    try {
      const response = await apiClient.post(
        `/workflows/form-submissions/${submissionId}/auto-save/`, 
        { step_id: stepId, field_key: fieldKey, value },
        { cancelToken: source.token }
      );
      cancelTokenManager.remove(cancelKey);
      return response.data;
    } catch (err) {
      if (!axios.isCancel(err)) {
        cancelTokenManager.remove(cancelKey);
        throw err;
      }
      // If cancelled, return a cancelled result
      throw err;
    }
  },

  /**
   * Complete a step
   */
  async completeStep(
    submissionId: string,
    stepId: string
  ): Promise<{ success: boolean; step_status: string; next_step_id: string | null }> {
    const response = await apiClient.post(`/workflows/form-submissions/${submissionId}/complete-step/`, {
      step_id: stepId,
    });
    return response.data;
  },

  /**
   * Submit the form
   */
  async submit(
    submissionId: string,
    force?: boolean
  ): Promise<{ success: boolean; status: string; completed_at: string }> {
    const response = await apiClient.post(`/workflows/form-submissions/${submissionId}/submit/`, {
      force,
    });
    return response.data;
  },

  /**
   * Cancel a submission
   */
  async cancel(submissionId: string): Promise<{ success: boolean; status: string }> {
    const response = await apiClient.post(`/workflows/form-submissions/${submissionId}/cancel/`);
    return response.data;
  },

  /**
   * Delete a submission
   */
  async delete(submissionId: string): Promise<void> {
    await apiClient.delete(`/workflows/form-submissions/${submissionId}/`);
  },
};

// Utility to check if an error is a cancellation
export const isRequestCancelled = axios.isCancel;

export default { quickActionsService, formSubmissionService, cancelTokenManager, isRequestCancelled };
