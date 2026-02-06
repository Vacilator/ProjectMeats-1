/**
 * WorkForms API Service
 * 
 * Provides methods for interacting with WorkForms backend APIs:
 * - Entity registry and schema
 * - TenantForm CRUD operations
 * - TenantWorkForm CRUD operations
 * - Form merge/split operations
 * - Workflow clone/validate operations
 * 
 * Phase 2 of WF-ENH-2026-Q1
 * Created: 2026-02-06
 */

import apiService from './apiService';

// ============================================================================
// Types
// ============================================================================

export interface Entity {
  type: string;
  label: string;
  app_label: string;
  model_name: string;
  icon: string;
  category: string;
  has_schema: boolean;
  description: string;
}

export interface EntityField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  max_length?: number;
  help_text?: string;
  choices?: Array<{ value: string; label: string }>;
  reference_entity?: string;
  reference_model?: string;
  lookup_endpoint?: string;
  validation?: Record<string, any>;
}

export interface EntitySchema {
  entity_type: string;
  app_label: string;
  model_name: string;
  fields: EntityField[];
}

export interface LookupResult {
  value: string;
  label: string;
}

export interface LookupResponse {
  results: LookupResult[];
  count: number;
  next: string | null;
  previous: string | null;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TenantForm {
  id: string;
  tenant: string;
  name: string;
  description: string;
  type: 'single_step' | 'multi_step';
  form_definition: any;
  version: number;
  usage_count: number;
  entity_type: string;
  field_count: number;
  step_count: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  created_by_name?: string;
  updated_by?: string;
  updated_by_name?: string;
}

export interface TenantWorkForm {
  id: string;
  tenant: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
  workflow_definition: any;
  form_references: string[];
  version: number;
  parent_version?: string;
  execution_count: number;
  last_executed_at?: string;
  cloned_from?: string;
  clone_count: number;
  node_count: number;
  edge_count: number;
  node_types_summary: Record<string, number>;
  validation_status: {
    valid: boolean;
    missing_forms: string[];
    total_references: number;
  };
  created_at: string;
  updated_at: string;
  created_by?: string;
  created_by_name?: string;
  updated_by?: string;
  updated_by_name?: string;
}

// ============================================================================
// Entity APIs (Phase 1.1-1.3)
// ============================================================================

/**
 * Get list of all tenant entities with metadata
 */
export const getEntityRegistry = async (): Promise<Entity[]> => {
  const response = await apiService.get('/api/v1/entities/');
  return response.data.entities;
};

/**
 * Get field schema for a specific entity type
 */
export const getEntitySchema = async (entityType: string): Promise<EntitySchema> => {
  const response = await apiService.get(`/api/v1/entities/${entityType}/schema/`);
  return response.data;
};

/**
 * Get lookup data for entity (for dropdowns/selects)
 */
export const getEntityLookup = async (
  entityType: string,
  params?: {
    search?: string;
    page?: number;
    page_size?: number;
  }
): Promise<LookupResponse> => {
  const response = await apiService.get(`/api/v1/entities/${entityType}/lookup/`, { params });
  return response.data;
};

// ============================================================================
// TenantForm APIs (Phase 1.4)
// ============================================================================

/**
 * List all tenant forms with optional filters
 */
export const listTenantForms = async (params?: {
  type?: 'single_step' | 'multi_step';
  search?: string;
}): Promise<TenantForm[]> => {
  const response = await apiService.get('/api/v1/tenant-forms/', { params });
  return response.data;
};

/**
 * Get a specific tenant form by ID
 */
export const getTenantForm = async (formId: string): Promise<TenantForm> => {
  const response = await apiService.get(`/api/v1/tenant-forms/${formId}/`);
  return response.data;
};

/**
 * Create a new tenant form
 */
export const createTenantForm = async (data: {
  name: string;
  description?: string;
  type: 'single_step' | 'multi_step';
  form_definition: any;
}): Promise<TenantForm> => {
  const response = await apiService.post('/api/v1/tenant-forms/', data);
  return response.data;
};

/**
 * Update an existing tenant form
 */
export const updateTenantForm = async (
  formId: string,
  data: Partial<TenantForm>
): Promise<TenantForm> => {
  const response = await apiService.put(`/api/v1/tenant-forms/${formId}/`, data);
  return response.data;
};

/**
 * Delete a tenant form (only if usage_count === 0)
 */
export const deleteTenantForm = async (formId: string): Promise<void> => {
  await apiService.delete(`/api/v1/tenant-forms/${formId}/`);
};

// ============================================================================
// Form Merge/Split APIs (Phase 1.5)
// ============================================================================

/**
 * Merge multiple single-step forms into one multi-step form
 */
export const mergeForms = async (data: {
  container_name: string;
  description?: string;
  source_form_ids: string[];
}): Promise<{
  id: string;
  name: string;
  type: string;
  step_count: number;
  deleted_form_ids: string[];
  message: string;
}> => {
  const response = await apiService.post('/api/v1/tenant-forms/merge/', data);
  return response.data;
};

/**
 * Split one step from a multi-step form into a new single-step form
 */
export const splitForm = async (data: {
  source_form_id: string;
  step_index: number;
  new_form_name: string;
  new_form_description?: string;
}): Promise<{
  source_form_id: string;
  source_remaining_steps: number;
  source_type: string;
  created_form_id: string;
  created_form_name: string;
  message: string;
}> => {
  const response = await apiService.post('/api/v1/tenant-forms/split/', data);
  return response.data;
};

// ============================================================================
// TenantWorkForm APIs (Phase 1.6)
// ============================================================================

/**
 * List all tenant workflows with optional filters
 */
export const listTenantWorkForms = async (params?: {
  status?: 'draft' | 'active' | 'archived';
  search?: string;
}): Promise<TenantWorkForm[]> => {
  const response = await apiService.get('/api/v1/tenant-workforms/', { params });
  return response.data;
};

/**
 * Get a specific tenant workflow by ID
 */
export const getTenantWorkForm = async (workformId: string): Promise<TenantWorkForm> => {
  const response = await apiService.get(`/api/v1/tenant-workforms/${workformId}/`);
  return response.data;
};

/**
 * Create a new tenant workflow
 */
export const createTenantWorkForm = async (data: {
  name: string;
  description?: string;
  status?: 'draft' | 'active' | 'archived';
  workflow_definition: any;
}): Promise<TenantWorkForm> => {
  const response = await apiService.post('/api/v1/tenant-workforms/', data);
  return response.data;
};

/**
 * Update an existing tenant workflow
 */
export const updateTenantWorkForm = async (
  workformId: string,
  data: Partial<TenantWorkForm>
): Promise<TenantWorkForm> => {
  const response = await apiService.put(`/api/v1/tenant-workforms/${workformId}/`, data);
  return response.data;
};

/**
 * Delete a tenant workflow
 */
export const deleteTenantWorkForm = async (workformId: string): Promise<void> => {
  await apiService.delete(`/api/v1/tenant-workforms/${workformId}/`);
};

// ============================================================================
// Workflow Utility APIs (Phase 1.7)
// ============================================================================

/**
 * Clone a workflow
 */
export const cloneWorkForm = async (
  workformId: string,
  data: {
    new_name: string;
    new_description?: string;
    include_form_references?: boolean;
  }
): Promise<TenantWorkForm> => {
  const response = await apiService.post(`/api/v1/tenant-workforms/${workformId}/clone/`, data);
  return response.data;
};

/**
 * Get workflow usage information
 */
export const getWorkFormUsage = async (
  workformId: string
): Promise<{
  id: string;
  name: string;
  execution_count: number;
  last_executed_at?: string;
  clone_count: number;
  node_count: number;
  edge_count: number;
  form_references_count: number;
  created_at: string;
  updated_at: string;
}> => {
  const response = await apiService.get(`/api/v1/tenant-workforms/${workformId}/usage/`);
  return response.data;
};

/**
 * Validate workflow for broken references
 */
export const validateWorkForm = async (
  workformId: string
): Promise<{
  valid: boolean;
  missing_forms: string[];
  total_references: number;
}> => {
  const response = await apiService.post(`/api/v1/tenant-workforms/${workformId}/validate/`);
  return response.data;
};

// ============================================================================
// Export all
// ============================================================================

const workformsApi = {
  // Entity APIs
  getEntityRegistry,
  getEntitySchema,
  getEntityLookup,
  
  // TenantForm APIs
  listTenantForms,
  getTenantForm,
  createTenantForm,
  updateTenantForm,
  deleteTenantForm,
  
  // Form operations
  mergeForms,
  splitForm,
  
  // TenantWorkForm APIs
  listTenantWorkForms,
  getTenantWorkForm,
  createTenantWorkForm,
  updateTenantWorkForm,
  deleteTenantWorkForm,
  
  // Workflow utilities
  cloneWorkForm,
  getWorkFormUsage,
  validateWorkForm,
};

export default workformsApi;
