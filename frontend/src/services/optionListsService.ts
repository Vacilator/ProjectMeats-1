/**
 * Service for managing Option Lists and Choice Overrides
 *
 * Provides API for:
 * - System-level option lists (FieldOptionList)
 * - Tenant-level custom lists (TenantList)
 * - Entity field choice overrides (TenantFieldChoiceOverride)
 */
import { apiClient } from './apiService';

// API paths (apiClient baseURL already includes /api/v1)
const SCHEMA_BUILDER_PATH = '/schema-builder';
const WORKFLOWS_PATH = '/workflows';

// Types
export interface OptionItem {
  value: string;
  label: string;
}

export interface FieldOptionList {
  id: string;
  name: string;
  description: string;
  options: OptionItem[];
  option_count: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantList {
  id: string;
  name: string;
  description: string;
  options: OptionItem[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type OverrideMode = 'replace' | 'append' | 'prepend' | 'filter';

export interface ChoiceOverride {
  id: string;
  tenant: string | null;
  tenant_name: string | null;
  entity_type: string;
  field_name: string;
  mode: OverrideMode;
  mode_display: string;
  options: OptionItem[];
  option_list: string | null;
  option_list_name: string | null;
  option_count: number;
  effective_options: OptionItem[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EffectiveChoices {
  entity_type: string;
  field_name: string;
  choices: OptionItem[];
  has_override: boolean;
  override_mode: OverrideMode | null;
  override_source: 'root' | 'tenant' | null;
}

export interface ChoiceField {
  name: string;
  label: string;
  type: 'select' | 'multiselect';
  default_choice_count: number;
}

export interface EntityChoiceFields {
  entity_type: string;
  choice_fields: ChoiceField[];
}

// =============================================================================
// SYSTEM OPTION LISTS (FieldOptionList)
// =============================================================================

export const getSystemOptionLists = async (): Promise<FieldOptionList[]> => {
  const response = await apiClient.get(`${SCHEMA_BUILDER_PATH}/option-lists/`);
  return response.data;
};

export const getSystemOptionList = async (id: string): Promise<FieldOptionList> => {
  const response = await apiClient.get(`${SCHEMA_BUILDER_PATH}/option-lists/${id}/`);
  return response.data;
};

export const createSystemOptionList = async (
  data: Partial<FieldOptionList>
): Promise<FieldOptionList> => {
  const response = await apiClient.post(`${SCHEMA_BUILDER_PATH}/option-lists/`, data);
  return response.data;
};

export const updateSystemOptionList = async (
  id: string,
  data: Partial<FieldOptionList>
): Promise<FieldOptionList> => {
  const response = await apiClient.patch(`${SCHEMA_BUILDER_PATH}/option-lists/${id}/`, data);
  return response.data;
};

export const deleteSystemOptionList = async (id: string): Promise<void> => {
  await apiClient.delete(`${SCHEMA_BUILDER_PATH}/option-lists/${id}/`);
};

// =============================================================================
// TENANT OPTION LISTS (TenantList)
// =============================================================================

export const getTenantLists = async (): Promise<TenantList[]> => {
  const response = await apiClient.get(`${WORKFLOWS_PATH}/lists/`);
  return response.data;
};

export const getTenantList = async (id: string): Promise<TenantList> => {
  const response = await apiClient.get(`${WORKFLOWS_PATH}/lists/${id}/`);
  return response.data;
};

export const createTenantList = async (data: Partial<TenantList>): Promise<TenantList> => {
  const response = await apiClient.post(`${WORKFLOWS_PATH}/lists/`, data);
  return response.data;
};

export const updateTenantList = async (
  id: string,
  data: Partial<TenantList>
): Promise<TenantList> => {
  const response = await apiClient.patch(`${WORKFLOWS_PATH}/lists/${id}/`, data);
  return response.data;
};

export const deleteTenantList = async (id: string): Promise<void> => {
  await apiClient.delete(`${WORKFLOWS_PATH}/lists/${id}/`);
};

// =============================================================================
// CHOICE OVERRIDES (TenantFieldChoiceOverride)
// =============================================================================

export const getChoiceOverrides = async (params?: {
  tenant?: string;
  entity_type?: string;
  field_name?: string;
  active_only?: boolean;
}): Promise<ChoiceOverride[]> => {
  const response = await apiClient.get(`${SCHEMA_BUILDER_PATH}/choice-overrides/`, { params });
  return response.data;
};

export const getChoiceOverride = async (id: string): Promise<ChoiceOverride> => {
  const response = await apiClient.get(`${SCHEMA_BUILDER_PATH}/choice-overrides/${id}/`);
  return response.data;
};

export const createChoiceOverride = async (
  data: Partial<ChoiceOverride>
): Promise<ChoiceOverride> => {
  const response = await apiClient.post(`${SCHEMA_BUILDER_PATH}/choice-overrides/`, data);
  return response.data;
};

export const updateChoiceOverride = async (
  id: string,
  data: Partial<ChoiceOverride>
): Promise<ChoiceOverride> => {
  const response = await apiClient.patch(`${SCHEMA_BUILDER_PATH}/choice-overrides/${id}/`, data);
  return response.data;
};

export const deleteChoiceOverride = async (id: string): Promise<void> => {
  await apiClient.delete(`${SCHEMA_BUILDER_PATH}/choice-overrides/${id}/`);
};

// =============================================================================
// EFFECTIVE CHOICES
// =============================================================================

export const getEffectiveChoices = async (
  entityType: string,
  fieldName: string
): Promise<EffectiveChoices> => {
  const response = await apiClient.get(
    `${SCHEMA_BUILDER_PATH}/choices/${entityType}/${fieldName}/effective/`
  );
  return response.data;
};

export const getEntityChoiceFields = async (): Promise<{
  entities: EntityChoiceFields[];
  total_fields: number;
}> => {
  const response = await apiClient.get(`${SCHEMA_BUILDER_PATH}/entity-choice-fields/`);
  return response.data;
};

// =============================================================================
// UNIFIED API - Get all option lists (system + tenant + overrides)
// =============================================================================

export interface UnifiedOptionList {
  id: string;
  name: string;
  description: string;
  options: OptionItem[];
  option_count: number;
  source: 'system' | 'tenant' | 'entity_override';
  is_active: boolean;
  entity_type?: string;
  field_name?: string;
  tenant_name?: string;
}

export const getAllOptionLists = async (): Promise<UnifiedOptionList[]> => {
  const [systemLists, tenantLists, overrides] = await Promise.all([
    getSystemOptionLists().catch(() => []),
    getTenantLists().catch(() => []),
    getChoiceOverrides({ active_only: true }).catch(() => []),
  ]);

  const unified: UnifiedOptionList[] = [];

  // Add system lists
  for (const list of systemLists) {
    unified.push({
      id: list.id,
      name: list.name,
      description: list.description,
      options: list.options,
      option_count: list.option_count,
      source: 'system',
      is_active: true,
    });
  }

  // Add tenant lists
  for (const list of tenantLists) {
    unified.push({
      id: list.id,
      name: list.name,
      description: list.description,
      options: list.options,
      option_count: list.options?.length || 0,
      source: 'tenant',
      is_active: list.is_active,
    });
  }

  // Add entity overrides
  for (const override of overrides) {
    unified.push({
      id: override.id,
      name: `${override.entity_type}.${override.field_name}`,
      description: `Override for ${override.entity_type} ${override.field_name} field`,
      options: override.effective_options,
      option_count: override.option_count,
      source: 'entity_override',
      is_active: override.is_active,
      entity_type: override.entity_type,
      field_name: override.field_name,
      tenant_name: override.tenant_name || 'System Default',
    });
  }

  return unified;
};

// =============================================================================
// AUDIT LOGS
// =============================================================================

export interface AuditLogEntry {
  id: string;
  override: string | null;
  tenant_id: string | null;
  tenant_name: string;
  entity_type: string;
  field_name: string;
  action: 'create' | 'update' | 'delete' | 'activate' | 'deactivate';
  action_display: string;
  previous_state: Record<string, any>;
  new_state: Record<string, any>;
  changes: Array<{ field: string; old: any; new: any }>;
  performed_by: number | null;
  performed_by_name: string | null;
  performed_at: string;
  ip_address: string | null;
  user_agent: string;
}

export const getAuditLogs = async (params?: {
  entity_type?: string;
  field_name?: string;
  action?: string;
  limit?: number;
}): Promise<AuditLogEntry[]> => {
  const response = await apiClient.get(`${SCHEMA_BUILDER_PATH}/choice-override-audit/`, { params });
  return response.data;
};

export const getOverrideAuditHistory = async (overrideId: string): Promise<AuditLogEntry[]> => {
  const response = await apiClient.get(`${SCHEMA_BUILDER_PATH}/choice-overrides/${overrideId}/audit_history/`);
  return response.data;
};

// =============================================================================
// TENANT LIST API (for tenant selector in Admin UI)
// =============================================================================

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
}

export const getTenants = async (): Promise<TenantInfo[]> => {
  // Fetch tenants from tenants API (already includes /api/v1 from apiClient baseURL)
  const response = await apiClient.get('/tenants/');
  return response.data.results || response.data;
};

export default {
  // System
  getSystemOptionLists,
  getSystemOptionList,
  createSystemOptionList,
  updateSystemOptionList,
  deleteSystemOptionList,
  // Tenant
  getTenantLists,
  getTenantList,
  createTenantList,
  updateTenantList,
  deleteTenantList,
  // Overrides
  getChoiceOverrides,
  getChoiceOverride,
  createChoiceOverride,
  updateChoiceOverride,
  deleteChoiceOverride,
  // Effective
  getEffectiveChoices,
  getEntityChoiceFields,
  // Unified
  getAllOptionLists,
  // Audit
  getAuditLogs,
  getOverrideAuditHistory,
  // Tenants
  getTenants,
};
