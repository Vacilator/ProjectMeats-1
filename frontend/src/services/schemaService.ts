/**
 * Schema Service - Entity and field introspection
 * 
 * Phase 3: Intelligent Schema Bridge
 * Provides entity types and field metadata from Django backend.
 * 
 * Created: 2026-02-12
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from './apiService';

export interface EntityType {
  id: string;
  app: string;
  model: string;
  label: string;
  label_plural: string;
  description: string;
  field_count: number;
}

export interface EntityField {
  name: string;
  label: string;
  type: string;  // Mapped from field_type
  field_type: string;
  required: boolean;  // Mapped from is_required
  is_required: boolean;
  help_text: string;
  max_length?: number;
  max_digits?: number;
  decimal_places?: number;
  related_entity?: string;
  related_label?: string;
  choices?: Array<{ value: any; label: string }>;
}

export interface EntityFieldsResponse {
  entity_id: string;
  field_count: number;
  fields: EntityField[];
}

/**
 * Get all available entity types.
 * Cached with React Query for 5 minutes.
 */
export const getEntityTypes = async (): Promise<EntityType[]> => {
  try {
    const response = await apiClient.get<{ count: number; results: EntityType[] }>(
      'system/entities/'
    );
    return response.data.results;
  } catch (error) {
    console.warn('[SchemaService] API call failed, using hardcoded entities:', error);
    // Return hardcoded entities as fallback
    return COMMON_ENTITY_TYPES;
  }
};

/**
 * Get field definitions for a specific entity.
 * 
 * @param entityId - Entity identifier (e.g., 'tenant_apps.suppliers.supplier')
 */
export const getEntityFields = async (entityId: string): Promise<EntityField[]> => {
  console.log('[SchemaService] Fetching fields for entity:', entityId);
  
  try {
    // CRITICAL FIX: Encode entity ID for URL (handles tenant_apps.* dots correctly)
    const encodedEntityId = encodeURIComponent(entityId);
    const url = `system/entities/${encodedEntityId}/fields/`;
    
    console.log('[SchemaService] Fetch URL:', url);
    
    const response = await apiClient.get<EntityFieldsResponse>(url);
    
    // Normalize field data (backend uses field_type/is_required, frontend uses type/required)
    const normalizedFields = (response.data.fields || []).map(field => ({
      ...field,
      type: field.field_type || field.type,
      required: field.is_required ?? field.required ?? false,
    }));
    
    console.log('[SchemaService] Fields received:', {
      entityId,
      fieldCount: normalizedFields.length,
      fields: normalizedFields.map(f => ({ name: f.name, type: f.type, required: f.required })),
    });
    
    return normalizedFields;
  } catch (error) {
    console.error('[SchemaService] Failed to fetch fields for entity:', entityId, error);
    // Return empty array instead of throwing to prevent UI crashes
    return [];
  }
};

/**
 * Get display fields for entity lookups.
 * 
 * @param entityId - Entity identifier
 */
export const getEntityDisplayFields = async (entityId: string): Promise<string[]> => {
  const response = await apiClient.get<{ entity_id: string; display_fields: string[] }>(
    `system/entities/${entityId}/display-fields/`
  );
  return response.data.display_fields;
};

/**
 * Hardcoded entity types for quick reference (until API loads).
 * This list should match the backend tenant_apps.
 * 
 * NOTE: Entity IDs use tenant_apps.* namespace (hotfix #3033)
 */
export const COMMON_ENTITY_TYPES: EntityType[] = [
  { id: 'tenant_apps.suppliers.supplier', app: 'tenant_apps.suppliers', model: 'supplier', label: 'Supplier', label_plural: 'Suppliers', description: 'Supplier entity', field_count: 0 },
  { id: 'tenant_apps.customers.customer', app: 'tenant_apps.customers', model: 'customer', label: 'Customer', label_plural: 'Customers', description: 'Customer entity', field_count: 0 },
  { id: 'tenant_apps.products.product', app: 'tenant_apps.products', model: 'product', label: 'Product', label_plural: 'Products', description: 'Product entity', field_count: 0 },
  { id: 'tenant_apps.sales_orders.salesorder', app: 'tenant_apps.sales_orders', model: 'salesorder', label: 'Sales Order', label_plural: 'Sales Orders', description: 'Sales order entity', field_count: 0 },
  { id: 'tenant_apps.purchase_orders.purchaseorder', app: 'tenant_apps.purchase_orders', model: 'purchaseorder', label: 'Purchase Order', label_plural: 'Purchase Orders', description: 'Purchase order entity', field_count: 0 },
  { id: 'tenant_apps.invoices.invoice', app: 'tenant_apps.invoices', model: 'invoice', label: 'Invoice', label_plural: 'Invoices', description: 'Invoice entity', field_count: 0 },
  { id: 'tenant_apps.carriers.carrier', app: 'tenant_apps.carriers', model: 'carrier', label: 'Carrier', label_plural: 'Carriers', description: 'Carrier entity', field_count: 0 },
  { id: 'tenant_apps.contacts.contact', app: 'tenant_apps.contacts', model: 'contact', label: 'Contact', label_plural: 'Contacts', description: 'Contact entity', field_count: 0 },
];

/**
 * Get icon for field type.
 */
export const getFieldTypeIcon = (fieldType: string): string => {
  const icons: Record<string, string> = {
    text: '📝',
    textarea: '📄',
    email: '📧',
    url: '🔗',
    number: '🔢',
    decimal: '💲',
    boolean: '✓',
    date: '📅',
    datetime: '🕐',
    time: '⏰',
    foreign_key: '🔗',
    many_to_many: '🔗',
    json: '{}',
    file: '📎',
    image: '🖼️',
  };
  
  return icons[fieldType] || '📝';
};

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook to fetch entity list with React Query caching.
 * 
 * Phase A Enhancement: Added error handling and fallback to hardcoded entities.
 * Phase E Fix (2026-02-19): Improved fallback handling for empty dropdowns
 * Phase E Fix 2 (2026-02-19): Always use fallback if API returns empty (401 auth issues)
 */
export const useEntityList = () => {
  const query = useQuery({
    queryKey: ['entities'],
    queryFn: getEntityTypes,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    // Always show hardcoded entities immediately while loading
    placeholderData: COMMON_ENTITY_TYPES,
    // Retry failed requests
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // CRITICAL FIX: If API returns empty (e.g., 401 auth failure), use fallback
  // React Query's placeholderData only shows during loading, not when query "succeeds" with []
  const data = query.data && query.data.length > 0 ? query.data : COMMON_ENTITY_TYPES;

  console.log('[useEntityList] Hook result:', {
    apiReturned: query.data?.length ?? 0,
    usingFallback: data === COMMON_ENTITY_TYPES,
    finalEntityCount: data.length,
    isLoading: query.isLoading,
    isError: query.isError,
  });

  return {
    ...query,
    data,
  };
};

/**
 * Hook to fetch fields for a specific entity.
 * 
 * Phase A Enhancement: Added error handling and retry logic.
 */
export const useEntityFields = (
  entityId: string | null | undefined,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: ['entity-fields', entityId],
    queryFn: () => getEntityFields(entityId!),
    enabled: !!entityId && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2, // Retry failed requests
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error(`Failed to fetch fields for entity "${entityId}":`, error);
    },
    select: (fields) => ({
      entity_id: entityId!,
      field_count: fields.length,
      fields,
    }),
  });
};

/**
 * Hook to fetch display fields for entity lookups.
 */
export const useEntityDisplayFields = (
  entityId: string | null | undefined,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: ['entity-display-fields', entityId],
    queryFn: () => getEntityDisplayFields(entityId!),
    enabled: !!entityId && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
