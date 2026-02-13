/**
 * Schema Service - Entity and field introspection
 * 
 * Phase 3: Intelligent Schema Bridge
 * Provides entity types and field metadata from Django backend.
 * 
 * Created: 2026-02-12
 */
import { useQuery } from '@tanstack/react-query';
import { adminClient } from './apiService';

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
  field_type: string;
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
  const response = await adminClient.get<{ count: number; results: EntityType[] }>(
    '/system/entities/'
  );
  return response.data.results;
};

/**
 * Get field definitions for a specific entity.
 * 
 * @param entityId - Entity identifier (e.g., 'suppliers.supplier')
 */
export const getEntityFields = async (entityId: string): Promise<EntityField[]> => {
  const response = await adminClient.get<EntityFieldsResponse>(
    `/system/entities/${entityId}/fields/`
  );
  return response.data.fields;
};

/**
 * Get display fields for entity lookups.
 * 
 * @param entityId - Entity identifier
 */
export const getEntityDisplayFields = async (entityId: string): Promise<string[]> => {
  const response = await adminClient.get<{ entity_id: string; display_fields: string[] }>(
    `/system/entities/${entityId}/display-fields/`
  );
  return response.data.display_fields;
};

/**
 * Hardcoded entity types for quick reference (until API loads).
 * This list should match the backend tenant_apps.
 */
export const COMMON_ENTITY_TYPES: EntityType[] = [
  { id: 'suppliers.supplier', app: 'suppliers', model: 'supplier', label: 'Supplier', label_plural: 'Suppliers', description: 'Supplier entity', field_count: 0 },
  { id: 'customers.customer', app: 'customers', model: 'customer', label: 'Customer', label_plural: 'Customers', description: 'Customer entity', field_count: 0 },
  { id: 'products.product', app: 'products', model: 'product', label: 'Product', label_plural: 'Products', description: 'Product entity', field_count: 0 },
  { id: 'sales_orders.salesorder', app: 'sales_orders', model: 'salesorder', label: 'Sales Order', label_plural: 'Sales Orders', description: 'Sales order entity', field_count: 0 },
  { id: 'purchase_orders.purchaseorder', app: 'purchase_orders', model: 'purchaseorder', label: 'Purchase Order', label_plural: 'Purchase Orders', description: 'Purchase order entity', field_count: 0 },
  { id: 'invoices.invoice', app: 'invoices', model: 'invoice', label: 'Invoice', label_plural: 'Invoices', description: 'Invoice entity', field_count: 0 },
  { id: 'carriers.carrier', app: 'carriers', model: 'carrier', label: 'Carrier', label_plural: 'Carriers', description: 'Carrier entity', field_count: 0 },
  { id: 'contacts.contact', app: 'contacts', model: 'contact', label: 'Contact', label_plural: 'Contacts', description: 'Contact entity', field_count: 0 },
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
 */
export const useEntityList = () => {
  return useQuery({
    queryKey: ['entities'],
    queryFn: getEntityTypes,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
};

/**
 * Hook to fetch fields for a specific entity.
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
