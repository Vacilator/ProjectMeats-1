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

import { apiClient } from './apiService';

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
  flow_data: any; // Backend uses flow_data, not form_definition
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

// ---------------------------------------------------------------------------
// System / TenantForm helpers (Phase 9: remove direct axios usage)
// ---------------------------------------------------------------------------

export interface TenantFormUsageInfo {
  form_id: string;
  usage_count: number;
  workflows: Array<{
    id: string;
    name: string;
    status: string;
  }>;
}

export const getTenantFormUsageInfo = async (formId: string): Promise<TenantFormUsageInfo> => {
  const response = await apiClient.get(`/system/tenant-forms/${formId}/usage/`);
  return response.data;
};

export const decrementTenantFormUsage = async (formId: string): Promise<void> => {
  await apiClient.post(`/system/tenant-forms/${formId}/decrement-usage/`);
};

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
  const response = await apiClient.get('/entities/');
  return response.data.entities;
};

/**
 * Get field schema for a specific entity type
 */
export const getEntitySchema = async (entityType: string): Promise<EntitySchema> => {
  const response = await apiClient.get(`/entities/${entityType}/schema/`);
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
  const response = await apiClient.get(`/entities/${entityType}/lookup/`, { params });
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
  const response = await apiClient.get('/workflows/forms/', { params });
  return response.data.results || response.data || [];
};

/**
 * Get a specific tenant form by ID
 */
export const getTenantForm = async (formId: string): Promise<TenantForm> => {
  const response = await apiClient.get(`/workflows/forms/${formId}/`);
  return response.data;
};

/**
 * Get fields from a tenant form's flow_data
 */
export const getFormFields = async (formId: string): Promise<EntityField[]> => {
  const form = await getTenantForm(formId);
  
  // Extract fields from flow_data structure
  // TenantForm.flow_data can have:
  // - fields: EntityField[] (single-step forms)
  // - steps: Array<{ fields: EntityField[] }> (multi-step forms)
  const fields: EntityField[] = [];
  
  if (form.flow_data?.fields && Array.isArray(form.flow_data.fields)) {
    // Single-step form
    fields.push(...form.flow_data.fields);
  } else if (form.flow_data?.steps && Array.isArray(form.flow_data.steps)) {
    // Multi-step form - aggregate all fields from all steps
    form.flow_data.steps.forEach((step: any) => {
      if (step.fields && Array.isArray(step.fields)) {
        fields.push(...step.fields);
      }
    });
  }
  
  return fields;
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
  const response = await apiClient.post('/workflows/forms/', data);
  return response.data;
};

/**
 * Update an existing tenant form
 */
export const updateTenantForm = async (
  formId: string,
  data: Partial<TenantForm>
): Promise<TenantForm> => {
  const response = await apiClient.put(`/workflows/forms/${formId}/`, data);
  return response.data;
};

/**
 * Delete a tenant form (only if usage_count === 0)
 */
export const deleteTenantForm = async (formId: string): Promise<void> => {
  await apiClient.delete(`/workflows/forms/${formId}/`);
};

/**
 * Decrement usage count for a form (Task 2: Ghost Node Deletion)
 * Called when a container node is removed from a workflow
 */
export const decrementFormUsage = async (
  formId: string
): Promise<{ form_id: string; usage_count: number; can_delete: boolean }> => {
  const response = await apiClient.post(`/workflows/forms/${formId}/decrement_usage/`);
  return response.data;
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
  const response = await apiClient.post('/workflows/forms/merge/', data);
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
  const response = await apiClient.post('/workflows/forms/split/', data);
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
  const response = await apiClient.get('/workflows/workflows/', { params });
  return response.data;
};

/**
 * Get a specific tenant workflow by ID
 */
export const getTenantWorkForm = async (workformId: string): Promise<TenantWorkForm> => {
  const response = await apiClient.get(`/workflows/workflows/${workformId}/`);
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
  const response = await apiClient.post('/workflows/workflows/', data);
  return response.data;
};

/**
 * Update an existing tenant workflow
 */
export const updateTenantWorkForm = async (
  workformId: string,
  data: Partial<TenantWorkForm>
): Promise<TenantWorkForm> => {
  const response = await apiClient.put(`/workflows/workflows/${workformId}/`, data);
  return response.data;
};

/**
 * Delete a tenant workflow
 */
export const deleteTenantWorkForm = async (workformId: string): Promise<void> => {
  await apiClient.delete(`/workflows/workflows/${workformId}/`);
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
  const response = await apiClient.post(`/workflows/workflows/${workformId}/clone/`, data);
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
  const response = await apiClient.get(`/workflows/workflows/${workformId}/usage/`);
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
  const response = await apiClient.post(`/workflows/workflows/${workformId}/validate/`);
  return response.data;
};

// ============================================================================
// Container APIs (Phase 4)
// ============================================================================

export interface ContainerSummary {
  id: string;
  name: string;
  node_count: number;
  node_types: Record<string, number>;
  form_references: string[];
}

export interface ContainerDetail {
  container_id: string;
  container_name: string;
  total_nodes: number;
  node_types: Record<string, number>;
  form_references: string[];
  nodes: any[];
}

/**
 * Get all containers in a workflow
 */
export const listWorkFormContainers = async (
  workformId: string
): Promise<{ containers: ContainerSummary[] }> => {
  const response = await apiClient.get(`/workflows/workflows/${workformId}/containers/`);
  return response.data;
};

/**
 * Get details of a specific container
 */
export const getContainerDetail = async (
  workformId: string,
  containerId: string
): Promise<ContainerDetail> => {
  const response = await apiClient.get(`/workflows/workflows/${workformId}/containers/${containerId}/`);
  return response.data;
};

/**
 * Add a node to a container
 */
export const addNodeToContainer = async (
  workformId: string,
  nodeId: string,
  containerId: string
): Promise<{ message: string; node_id: string; container_id: string }> => {
  const response = await apiClient.post(`/workflows/workflows/${workformId}/containers/add-node/`, {
    node_id: nodeId,
    container_id: containerId
  });
  return response.data;
};

/**
 * Remove a node from its container
 */
export const removeNodeFromContainer = async (
  workformId: string,
  nodeId: string
): Promise<{ message: string; node_id: string }> => {
  const response = await apiClient.post(`/workflows/workflows/${workformId}/containers/remove-node/`, {
    node_id: nodeId
  });
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
  getFormFields,
  createTenantForm,
  updateTenantForm,
  deleteTenantForm,
  decrementFormUsage, // Task 2: Ghost Node Deletion
  
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
  
  // Container utilities
  listWorkFormContainers,
  getContainerDetail,
  addNodeToContainer,
  removeNodeFromContainer,
};

export { workformsApi };
export default workformsApi;
