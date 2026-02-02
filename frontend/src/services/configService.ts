/**
 * Config Service for ProjectMeats
 *
 * Provides access to the 3-tier configuration system:
 * - System Core (superuser) → System (system admin) → Tenant (tenant admin)
 *
 * Handles config resolution with cascading defaults.
 *
 * @module services/configService
 */
import { apiClient } from './apiService';

// =============================================================================
// Types
// =============================================================================

/**
 * Categories for tenant configuration
 */
export type ConfigCategory = 'UI' | 'BUSINESS' | 'FEATURES' | 'INTEGRATIONS' | 'OTHER';

/**
 * Tenant-specific configuration
 */
export interface TenantConfig {
  id: string;
  key: string;
  value: unknown;
  category: ConfigCategory;
  description?: string;
  key_parts?: string[];
  created_at: string;
  updated_at: string;
}

/**
 * System choice list (dropdown options)
 */
export interface SystemChoiceList {
  id: number;
  slug: string;
  name: string;
  description?: string;
  is_extensible: boolean;
  is_reorderable: boolean;
  items?: SystemChoiceItem[];
  created_at: string;
  updated_at: string;
}

/**
 * Individual choice item within a list
 */
export interface SystemChoiceItem {
  id: number;
  choice_list: number;
  value: string;
  label: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  metadata?: Record<string, unknown>;
}

/**
 * Field schema definition
 */
export interface SystemFieldSchema {
  id: number;
  entity_type: string;
  field_name: string;
  field_type: string;
  label: string;
  help_text?: string;
  is_required: boolean;
  is_visible: boolean;
  is_editable: boolean;
  default_value?: unknown;
  validation_rules?: Record<string, unknown>;
  choice_list?: number;
  sort_order: number;
  metadata?: Record<string, unknown>;
}

/**
 * Resolved config value with source information
 */
export interface ResolvedConfig<T = unknown> {
  key: string;
  value: T;
  source: 'system' | 'tenant' | 'default';
  metadata?: Record<string, unknown>;
}

/**
 * Config by category response
 */
export interface ConfigByCategory {
  UI: TenantConfig[];
  BUSINESS: TenantConfig[];
  FEATURES: TenantConfig[];
  INTEGRATIONS: TenantConfig[];
  OTHER: TenantConfig[];
}

// =============================================================================
// Cache Management
// =============================================================================

const CONFIG_CACHE_KEY = 'configService_cache';
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface ConfigCache {
  tenantConfigs?: CacheEntry<TenantConfig[]>;
  choiceLists?: CacheEntry<Record<string, SystemChoiceList>>;
  allChoiceLists?: CacheEntry<SystemChoiceList[]>;
  fieldSchemas?: CacheEntry<Record<string, SystemFieldSchema[]>>;
  resolvedConfigs?: CacheEntry<Record<string, ResolvedConfig>>;
}

let memoryCache: ConfigCache = {};

// Pending requests deduplication (prevent duplicate API calls)
const pendingRequests: Record<string, Promise<unknown>> = {};

/**
 * Check if cache entry is still valid
 */
function isCacheValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CONFIG_CACHE_TTL;
}

/**
 * Clear all config caches
 */
export function clearConfigCache(): void {
  memoryCache = {};
  try {
    localStorage.removeItem(CONFIG_CACHE_KEY);
  } catch {
    // localStorage might not be available
  }
}

// =============================================================================
// Tenant Config API
// =============================================================================

/**
 * Get all tenant configurations
 */
export async function getTenantConfigs(): Promise<TenantConfig[]> {
  if (isCacheValid(memoryCache.tenantConfigs)) {
    return memoryCache.tenantConfigs.data;
  }

  const response = await apiClient.get('/system/tenant-configs/');
  const configs = response.data.results || response.data;

  memoryCache.tenantConfigs = {
    data: configs,
    timestamp: Date.now(),
  };

  return configs;
}

/**
 * Get tenant configurations grouped by category
 */
export async function getTenantConfigsByCategory(): Promise<ConfigByCategory> {
  const response = await apiClient.get('/system/tenant-configs/by_category/');
  return response.data;
}

/**
 * Get a single tenant configuration
 */
export async function getTenantConfig(id: string): Promise<TenantConfig> {
  const response = await apiClient.get(`/system/tenant-configs/${id}/`);
  return response.data;
}

/**
 * Create a new tenant configuration
 */
export async function createTenantConfig(
  config: Omit<TenantConfig, 'id' | 'created_at' | 'updated_at' | 'key_parts'>
): Promise<TenantConfig> {
  const response = await apiClient.post('/system/tenant-configs/', config);
  clearConfigCache();
  return response.data;
}

/**
 * Update a tenant configuration
 */
export async function updateTenantConfig(
  id: string,
  config: Partial<TenantConfig>
): Promise<TenantConfig> {
  const response = await apiClient.patch(`/system/tenant-configs/${id}/`, config);
  clearConfigCache();
  return response.data;
}

/**
 * Delete a tenant configuration
 */
export async function deleteTenantConfig(id: string): Promise<void> {
  await apiClient.delete(`/system/tenant-configs/${id}/`);
  clearConfigCache();
}

// =============================================================================
// Config Resolution API
// =============================================================================

/**
 * Resolve a configuration value with cascading lookup
 *
 * Resolution order:
 * 1. Tenant-specific value (if exists)
 * 2. System default value (if exists)
 * 3. Provided default value
 *
 * @param key - Config key (e.g., "ui.theme.primary_color")
 * @param defaultValue - Default value if not found anywhere
 */
export async function resolveConfig<T = unknown>(
  key: string,
  defaultValue?: T
): Promise<ResolvedConfig<T>> {
  // Check cache first
  const cacheKey = `resolved_${key}`;
  if (
    isCacheValid(memoryCache.resolvedConfigs) &&
    memoryCache.resolvedConfigs.data[cacheKey]
  ) {
    return memoryCache.resolvedConfigs.data[cacheKey] as ResolvedConfig<T>;
  }

  try {
    const response = await apiClient.get('/system/config/resolve/', {
      params: { key },
    });

    const resolved: ResolvedConfig<T> = {
      key,
      value: response.data.value as T,
      source: response.data.source || 'system',
      metadata: response.data.metadata,
    };

    // Cache the resolved value
    if (!memoryCache.resolvedConfigs) {
      memoryCache.resolvedConfigs = {
        data: {},
        timestamp: Date.now(),
      };
    }
    memoryCache.resolvedConfigs.data[cacheKey] = resolved as ResolvedConfig;

    return resolved;
  } catch (error) {
    // If not found, return default
    return {
      key,
      value: defaultValue as T,
      source: 'default',
    };
  }
}

/**
 * Resolve multiple config values at once
 */
export async function resolveConfigs(
  keys: string[]
): Promise<Record<string, ResolvedConfig>> {
  const results: Record<string, ResolvedConfig> = {};

  // Batch resolve (could be optimized with a bulk endpoint)
  await Promise.all(
    keys.map(async (key) => {
      const resolved = await resolveConfig(key);
      results[key] = resolved;
    })
  );

  return results;
}

// =============================================================================
// Choice Lists API
// =============================================================================

/**
 * Get all choice lists
 */
export async function getChoiceLists(): Promise<SystemChoiceList[]> {
  // Check cache first
  if (isCacheValid(memoryCache.allChoiceLists)) {
    return memoryCache.allChoiceLists.data;
  }

  // Deduplicate concurrent requests
  const cacheKey = 'allChoiceLists';
  if (pendingRequests[cacheKey]) {
    return pendingRequests[cacheKey] as Promise<SystemChoiceList[]>;
  }

  pendingRequests[cacheKey] = (async () => {
    try {
      const response = await apiClient.get('/system/choice-lists/');
      const lists = response.data.results || response.data;
      
      // Cache the full list
      memoryCache.allChoiceLists = {
        data: lists,
        timestamp: Date.now(),
      };
      
      // Also populate individual choice list cache
      if (!memoryCache.choiceLists) {
        memoryCache.choiceLists = {
          data: {},
          timestamp: Date.now(),
        };
      }
      for (const list of lists) {
        memoryCache.choiceLists.data[list.slug] = list;
      }
      
      return lists;
    } finally {
      delete pendingRequests[cacheKey];
    }
  })();

  return pendingRequests[cacheKey] as Promise<SystemChoiceList[]>;
}

/**
 * Get a choice list by slug
 */
export async function getChoiceList(slug: string): Promise<SystemChoiceList> {
  // Check cache
  if (
    isCacheValid(memoryCache.choiceLists) &&
    memoryCache.choiceLists.data[slug]
  ) {
    return memoryCache.choiceLists.data[slug];
  }

  // Deduplicate concurrent requests for the same slug
  const cacheKey = `choiceList_${slug}`;
  if (pendingRequests[cacheKey]) {
    return pendingRequests[cacheKey] as Promise<SystemChoiceList>;
  }

  pendingRequests[cacheKey] = (async () => {
    try {
      const response = await apiClient.get(`/system/config/choices/${slug}/`);
      const choiceList = response.data;

      // Cache it
      if (!memoryCache.choiceLists) {
        memoryCache.choiceLists = {
          data: {},
          timestamp: Date.now(),
        };
      }
      memoryCache.choiceLists.data[slug] = choiceList;

      return choiceList;
    } finally {
      delete pendingRequests[cacheKey];
    }
  })();

  return pendingRequests[cacheKey] as Promise<SystemChoiceList>;
}

/**
 * Get choice items for a specific list
 */
export async function getChoiceItems(
  slug: string,
  activeOnly = true
): Promise<SystemChoiceItem[]> {
  const choiceList = await getChoiceList(slug);
  const items = choiceList.items || [];

  if (activeOnly) {
    return items.filter((item) => item.is_active);
  }

  return items;
}

/**
 * Get choice items as options for dropdowns/selects
 */
export async function getChoiceOptions(
  slug: string
): Promise<Array<{ value: string; label: string }>> {
  const items = await getChoiceItems(slug, true);
  return items
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      value: item.value,
      label: item.label,
    }));
}

// =============================================================================
// Field Schema API
// =============================================================================

/**
 * Get field schemas for an entity type
 */
export async function getFieldSchemas(
  entityType: string
): Promise<SystemFieldSchema[]> {
  // Check cache
  if (
    isCacheValid(memoryCache.fieldSchemas) &&
    memoryCache.fieldSchemas.data[entityType]
  ) {
    return memoryCache.fieldSchemas.data[entityType];
  }

  const response = await apiClient.get(
    `/system/config/field-schema/${entityType}/`
  );
  const schemas = response.data.results || response.data || [];

  // Cache it
  if (!memoryCache.fieldSchemas) {
    memoryCache.fieldSchemas = {
      data: {},
      timestamp: Date.now(),
    };
  }
  memoryCache.fieldSchemas.data[entityType] = schemas;

  return schemas;
}

/**
 * Get visible fields for an entity (respecting visibility settings)
 */
export async function getVisibleFields(
  entityType: string
): Promise<SystemFieldSchema[]> {
  const schemas = await getFieldSchemas(entityType);
  return schemas
    .filter((schema) => schema.is_visible)
    .sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Get required fields for an entity
 */
export async function getRequiredFields(
  entityType: string
): Promise<SystemFieldSchema[]> {
  const schemas = await getFieldSchemas(entityType);
  return schemas.filter((schema) => schema.is_required);
}

// =============================================================================
// Feature Flags
// =============================================================================

/**
 * Check if a feature is enabled
 *
 * @param featureKey - Feature key (e.g., "ai_assistant.enabled")
 */
export async function isFeatureEnabled(featureKey: string): Promise<boolean> {
  const configKey = `features.${featureKey}`;
  const resolved = await resolveConfig<boolean>(configKey, false);
  return resolved.value === true;
}

/**
 * Get all feature flags
 */
export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  try {
    const response = await apiClient.get('/core/feature-flags/');
    return response.data.flags || response.data;
  } catch {
    return {};
  }
}

// =============================================================================
// UI Config Helpers
// =============================================================================

/**
 * Get UI theme configuration
 */
export async function getThemeConfig(): Promise<{
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
}> {
  const [primaryColor, secondaryColor, logoUrl] = await Promise.all([
    resolveConfig<string>('ui.theme.primary_color', '#667eea'),
    resolveConfig<string>('ui.theme.secondary_color', '#764ba2'),
    resolveConfig<string | undefined>('ui.theme.logo_url'),
  ]);

  return {
    primaryColor: primaryColor.value,
    secondaryColor: secondaryColor.value,
    logoUrl: logoUrl.value,
  };
}

/**
 * Get business rules configuration
 */
export async function getBusinessRules(): Promise<{
  poAutoApproveThreshold: number;
  requirePOApproval: boolean;
  defaultCurrency: string;
}> {
  const [threshold, requireApproval, currency] = await Promise.all([
    resolveConfig<number>('business.po.auto_approve_threshold', 10000),
    resolveConfig<boolean>('business.po.require_approval', true),
    resolveConfig<string>('business.currency.default', 'USD'),
  ]);

  return {
    poAutoApproveThreshold: threshold.value,
    requirePOApproval: requireApproval.value,
    defaultCurrency: currency.value,
  };
}

// =============================================================================
// Preloading & Batch Operations
// =============================================================================

/**
 * Preload common configuration data for faster initial page loads.
 * Call this during app initialization or after login.
 */
export async function preloadConfig(): Promise<void> {
  await Promise.all([
    getChoiceLists(),
    getTenantConfigsByCategory(),
    getFeatureFlags(),
  ]);
}

/**
 * Batch fetch multiple choice lists by slug.
 * More efficient than individual getChoiceList calls.
 */
export async function getChoiceListsBatch(
  slugs: string[]
): Promise<Record<string, SystemChoiceList>> {
  const results: Record<string, SystemChoiceList> = {};
  const uncachedSlugs: string[] = [];

  // Check cache first
  for (const slug of slugs) {
    if (
      isCacheValid(memoryCache.choiceLists) &&
      memoryCache.choiceLists.data[slug]
    ) {
      results[slug] = memoryCache.choiceLists.data[slug];
    } else {
      uncachedSlugs.push(slug);
    }
  }

  // Fetch uncached in parallel
  if (uncachedSlugs.length > 0) {
    const fetched = await Promise.all(
      uncachedSlugs.map((slug) => getChoiceList(slug).catch(() => null))
    );
    
    uncachedSlugs.forEach((slug, index) => {
      const list = fetched[index];
      if (list) {
        results[slug] = list;
      }
    });
  }

  return results;
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(): {
  choiceListsCached: number;
  tenantConfigsCached: boolean;
  resolvedConfigsCached: number;
  cacheAge: number | null;
} {
  return {
    choiceListsCached: memoryCache.choiceLists
      ? Object.keys(memoryCache.choiceLists.data).length
      : 0,
    tenantConfigsCached: !!memoryCache.tenantConfigs,
    resolvedConfigsCached: memoryCache.resolvedConfigs
      ? Object.keys(memoryCache.resolvedConfigs.data).length
      : 0,
    cacheAge: memoryCache.choiceLists
      ? Date.now() - memoryCache.choiceLists.timestamp
      : null,
  };
}

// =============================================================================
// Service Export
// =============================================================================

export const configService = {
  // Tenant Config
  getTenantConfigs,
  getTenantConfigsByCategory,
  getTenantConfig,
  createTenantConfig,
  updateTenantConfig,
  deleteTenantConfig,

  // Config Resolution
  resolveConfig,
  resolveConfigs,

  // Choice Lists
  getChoiceLists,
  getChoiceList,
  getChoiceItems,
  getChoiceOptions,
  getChoiceListsBatch,

  // Field Schemas
  getFieldSchemas,
  getVisibleFields,
  getRequiredFields,

  // Feature Flags
  isFeatureEnabled,
  getFeatureFlags,

  // UI Helpers
  getThemeConfig,
  getBusinessRules,

  // Preloading & Cache
  preloadConfig,
  getCacheStats,
  clearCache: clearConfigCache,
};

export default configService;
