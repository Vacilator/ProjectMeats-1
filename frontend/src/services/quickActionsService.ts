/**
 * Quick Actions Service
 *
 * Handles API calls for Quick Actions and Form Submissions.
 * Supports request cancellation via AbortController.
 */
import axios, { CancelTokenSource } from 'axios';
import { apiClient } from './apiService';
import { logger } from '@/utils/logger';

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
  type?: 'form' | 'workflow';
  name: string;
  description?: string;
  icon?: string;
  status?: string;
  is_default?: boolean;
  is_quick_action_enabled?: boolean;
  step_count?: number;
  node_count?: number | null;
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
    // Handle both paginated {results: []} and non-paginated [] responses
    const data = response.data;
    return Array.isArray(data) ? data : (data.results || []);
  },
};

// Form Submissions API
export const formSubmissionService = {
  /**
   * List user's form submissions
   * @param cancelKey - Optional key for cancellation tracking
   */
  async list(
    params?: { status?: string; form?: string; assigned_to?: string; page?: number; page_size?: number; search?: string },
    cancelKey?: string
  ): Promise<FormSubmissionListItem[]> {
    const config = cancelKey
      ? { params, cancelToken: cancelTokenManager.create(cancelKey).token }
      : { params };
    try {
      const response = await apiClient.get('/workflows/form-submissions/', config);
      if (cancelKey) cancelTokenManager.remove(cancelKey);

      const data = response.data;
      const results = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : [];

      return results;
    } catch (err) {
      if (cancelKey) cancelTokenManager.remove(cancelKey);
      throw err;
    }
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
    try {
      const response = await apiClient.get(`/workflows/form-submissions/${submissionId}/`, config);
      if (cancelKey) cancelTokenManager.remove(cancelKey);
      return response.data;
    } catch (err) {
      if (cancelKey) cancelTokenManager.remove(cancelKey);
      throw err;
    }
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
    // Cancel any pending save for this field (debounce)
    const cancelKey = `autosave-${submissionId}-${stepId}-${fieldKey}`;
    cancelTokenManager.cancel(cancelKey);  // Just cancel, don't create new yet
    
    // Create new cancel token
    const source = cancelTokenManager.create(cancelKey);
    
    try {
      logger.debug('[autoSave] Saving:', { submissionId, stepId, fieldKey, valueType: typeof value });
      const response = await apiClient.post(
        `/workflows/form-submissions/${submissionId}/auto_save/`, 
        { step_id: stepId, field_key: fieldKey, value },
        { cancelToken: source.token }
      );
      cancelTokenManager.remove(cancelKey);
      logger.debug('[autoSave] Success:', response.data);
      return response.data;
    } catch (err: any) {
      cancelTokenManager.remove(cancelKey);
      
      if (axios.isCancel(err)) {
        logger.debug('[autoSave] Cancelled:', { submissionId, stepId, fieldKey });
        // Mark error with __CANCEL__ for easier detection
        const cancelError = new Error('Request cancelled');
        (cancelError as any).__CANCEL__ = true;
        throw cancelError;
      }
      
      logger.error('[autoSave] Error:', {
        submissionId,
        stepId,
        fieldKey,
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
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

  /**
   * Upload a file to a submission
   */
  async uploadFile(
    submissionId: string,
    fieldKey: string,
    file: File
  ): Promise<{ id: string; name: string; url: string; size: number }> {
    const formData = new FormData();
    formData.append('field_key', fieldKey);
    formData.append('file', file);
    
    const response = await apiClient.post(
      `/workflows/form-submissions/${submissionId}/upload/`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  /**
   * Delete an uploaded file
   */
  async deleteFile(submissionId: string, fileId: string): Promise<void> {
    await apiClient.delete(`/workflows/form-submissions/${submissionId}/files/${fileId}/`);
  },
};

// Entity Options API (for dynamic select fields)
export interface EntityOption {
  value: string;
  label: string;
}

export interface EntityOptionsResponse {
  entity_type: string;
  options: EntityOption[];
  count: number;
  can_create: boolean;
  entity_label: string;
}

export interface QuickCreateField {
  key: string;
  label: string;
  type: string;
  required: boolean;
}

export interface QuickCreateFieldsResponse {
  entity_type: string;
  entity_label: string;
  fields: QuickCreateField[];
}

export interface QuickCreateResponse {
  success: boolean;
  id: string;
  value: string;
  label: string;
  entity_type: string;
}

export const entityOptionsService = {
  /**
   * Get options for an entity type (for select fields)
   * @param entityType - The entity type to fetch options for
   * @param search - Optional search query for filtering
   * @param limit - Optional limit for number of results
   */
  async getOptions(
    entityType: string, 
    search?: string, 
    limit?: number
  ): Promise<EntityOptionsResponse & { total_count: number; has_more: boolean }> {
    const params: Record<string, string> = {};
    if (search) params.q = search;
    if (limit) params.limit = String(limit);
    
    const response = await apiClient.get(`/workflows/entity-options/${entityType}/`, { params });
    return response.data;
  },

  /**
   * Search options with debounce-friendly API
   */
  async searchOptions(
    entityType: string,
    query: string,
    cancelKey?: string,
    filterParams?: Record<string, any>
  ): Promise<EntityOptionsResponse & { total_count: number; has_more: boolean }> {
    const params = { q: query, ...(filterParams ?? {}) };
    const config = cancelKey 
      ? { params, cancelToken: cancelTokenManager.create(cancelKey).token }
      : { params };
    
    try {
      const response = await apiClient.get(`/workflows/entity-options/${entityType}/`, config);
      if (cancelKey) cancelTokenManager.remove(cancelKey);
      return response.data;
    } catch (err) {
      if (cancelKey) cancelTokenManager.remove(cancelKey);
      throw err;
    }
  },

  /**
   * Get required fields for quick-creating an entity
   */
  async getQuickCreateFields(entityType: string): Promise<QuickCreateFieldsResponse> {
    const response = await apiClient.get(`/workflows/quick-create/${entityType}/`);
    return response.data;
  },

  /**
   * Quick-create an entity record
   */
  async quickCreate(entityType: string, data: Record<string, any>): Promise<QuickCreateResponse> {
    const response = await apiClient.post(`/workflows/quick-create/${entityType}/`, data);
    return response.data;
  },
};

// Utility to check if an error is a cancellation
export const isRequestCancelled = axios.isCancel;

export default { quickActionsService, formSubmissionService, entityOptionsService, cancelTokenManager, isRequestCancelled };
