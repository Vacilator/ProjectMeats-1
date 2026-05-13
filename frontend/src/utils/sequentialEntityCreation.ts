/**
 * Sequential Entity Creation Service
 *
 * Creates entities in dependency order via backend CRUD APIs.
 * Used by AIDraftReviewModal "Approve All & Execute" to actually persist records.
 *
 * Dependency ordering:
 *   contact(1) → supplier/customer(2) → plant(3) → inquiry(4) → PO/SO(5) → carrier-pos(6) → invoice(7)
 *
 * After each entity is created, its ID is propagated as a foreign key to subsequent
 * dependent entities (e.g., a newly created contact ID becomes the contact_id on an inquiry).
 */

import { apiClient } from '@/services/apiService';
import { getErrorMessage } from '@/utils/errorHelpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EntityDraft = {
  entity_type: string;
  status: string;
  existing_id: string | null;
  proposed_data: Record<string, unknown>;
  confidence: number;
  source: string;
  originalIndex: number;
};

export type CreatedEntity = {
  index: number;
  entity_type: string;
  id: string | number;
  label: string;
  data: Record<string, unknown>;
};

export type EntityCreationError = {
  index: number;
  entity_type: string;
  error: string;
  proposed_data: Record<string, unknown>;
};

export type SequentialCreationResult = {
  created: CreatedEntity[];
  errors: EntityCreationError[];
  allSucceeded: boolean;
};

export type ProgressCallback = (step: {
  current: number;
  total: number;
  label: string;
  entity_type: string;
}) => void;

// ---------------------------------------------------------------------------
// Entity endpoint mapping
// ---------------------------------------------------------------------------

const ENTITY_ENDPOINTS: Record<string, string> = {
  contact: '/contacts/',
  supplier: '/suppliers/',
  customer: '/customers/',
  carrier: '/carriers/',
  plant: '/plants/',
  product: '/system/products/',
  inquiry: '/inquiries/',
  purchase_order: '/purchase-orders/',
  sales_order: '/sales-orders/',
  'carrier-pos': '/carrier-pos/',
  invoice: '/invoices/',
};

// ---------------------------------------------------------------------------
// FK propagation rules
// ---------------------------------------------------------------------------

/**
 * Maps entity types to the FK fields they populate on downstream entities.
 * When a 'contact' is created with id=42, any subsequent entity with a
 * 'contact' or 'contact_id' field in proposed_data gets it set to 42.
 */
const FK_PROPAGATION: Record<string, string[]> = {
  contact: ['contact', 'contact_id', 'supplier_contact', 'customer_contact'],
  supplier: ['supplier', 'supplier_id'],
  customer: ['customer', 'customer_id'],
  carrier: ['carrier', 'carrier_id'],
  plant: ['plant', 'plant_id', 'delivery_plant', 'pickup_plant'],
  product: ['product', 'product_id'],
  inquiry: ['inquiry', 'inquiry_id'],
  purchase_order: ['purchase_order', 'purchase_order_id', 'po', 'po_id'],
  sales_order: ['sales_order', 'sales_order_id', 'so', 'so_id'],
};

// ---------------------------------------------------------------------------
// Label extraction
// ---------------------------------------------------------------------------

function extractLabel(entityType: string, data: Record<string, unknown>): string {
  switch (entityType) {
    case 'contact':
      return [data.first_name, data.last_name].filter(Boolean).join(' ') || 'New Contact';
    case 'supplier':
      return String(data.name || data.company_name || 'New Supplier');
    case 'customer':
      return String(data.name || data.company_name || 'New Customer');
    case 'plant':
      return String(data.name || data.plant_name || 'New Plant');
    case 'product':
      return String(data.name || data.description || 'New Product');
    case 'inquiry':
      return String(data.inquiry_number || data.subject || 'New Inquiry');
    case 'purchase_order':
      return String(data.po_number || data.order_number || 'New PO');
    case 'sales_order':
      return String(data.so_number || data.order_number || 'New SO');
    case 'carrier-pos':
      return String(data.carrier_po_number || 'New Carrier PO');
    case 'invoice':
      return String(data.invoice_number || 'New Invoice');
    case 'carrier':
      return String(data.name || data.carrier_name || 'New Carrier');
    default:
      return `New ${entityType.replace(/_/g, ' ')}`;
  }
}

// ---------------------------------------------------------------------------
// Default field population (fills commonly-required fields with safe defaults)
// ---------------------------------------------------------------------------

function applyDefaults(entityType: string, data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };

  // Always set status to 'draft' or 'pending' if not provided
  if (!result.status) {
    switch (entityType) {
      case 'inquiry':
        result.status = 'draft';
        break;
      case 'purchase_order':
      case 'sales_order':
      case 'carrier-pos':
        result.status = 'pending';
        break;
      case 'contact':
      case 'supplier':
      case 'customer':
      case 'carrier':
      case 'plant':
        result.status = 'active';
        break;
      default:
        result.status = 'draft';
    }
  }

  // Ensure entity_type for inquiries
  if (entityType === 'inquiry' && !result.entity_type) {
    result.entity_type = 'general';
  }

  // Ensure order_date for POs and SOs
  if ((entityType === 'purchase_order' || entityType === 'sales_order') && !result.order_date) {
    result.order_date = new Date().toISOString().split('T')[0];
  }

  // Contact: ensure first_name and last_name (extract from full name if possible)
  if (entityType === 'contact') {
    if (!result.first_name && !result.last_name && result.name) {
      const parts = String(result.name).trim().split(/\s+/);
      result.first_name = parts[0] || 'Unknown';
      result.last_name = parts.slice(1).join(' ') || 'Contact';
    }
    if (!result.first_name) result.first_name = 'Unknown';
    if (!result.last_name) result.last_name = 'Contact';
  }

  // Supplier/Customer: ensure name field
  if ((entityType === 'supplier' || entityType === 'customer' || entityType === 'carrier') && !result.name) {
    result.name = String(result.company_name || result.company || `New ${entityType}`);
  }

  // Plant: ensure name field
  if (entityType === 'plant' && !result.name) {
    result.name = String(result.plant_name || result.location || 'New Plant');
  }

  return result;
}

// ---------------------------------------------------------------------------
// Core: Sequential creation
// ---------------------------------------------------------------------------

/**
 * Creates entities one-by-one in dependency order, propagating FKs from
 * earlier entities to later ones, and applying safe defaults for required fields.
 *
 * @param drafts - Ordered array of entity drafts (already sorted by dependency order)
 * @param onProgress - Optional progress callback for UI updates
 * @returns Result object with arrays of created entities and errors
 */
export async function createEntitiesSequentially(
  drafts: EntityDraft[],
  onProgress?: ProgressCallback,
): Promise<SequentialCreationResult> {
  const created: CreatedEntity[] = [];
  const errors: EntityCreationError[] = [];

  // Map of entity_type → created ID (for FK propagation)
  const createdIdsByType: Record<string, string | number> = {};

  const total = drafts.length;

  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    const { entity_type, proposed_data, originalIndex, existing_id } = draft;

    const typeLabel = entity_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    // Report progress
    onProgress?.({
      current: i + 1,
      total,
      label: `Creating ${typeLabel}...`,
      entity_type,
    });

    // Skip if the entity already exists
    if (draft.status === 'exists' && existing_id) {
      createdIdsByType[entity_type] = existing_id;
      created.push({
        index: originalIndex,
        entity_type,
        id: existing_id,
        label: `${typeLabel} (existing)`,
        data: proposed_data,
      });
      continue;
    }

    // Build the payload: apply defaults and propagate FKs from previously created entities
    let payload = applyDefaults(entity_type, proposed_data);
    payload = propagateForeignKeys(payload, createdIdsByType);

    // Determine the API endpoint
    const endpoint = ENTITY_ENDPOINTS[entity_type];
    if (!endpoint) {
      errors.push({
        index: originalIndex,
        entity_type,
        error: `No API endpoint configured for entity type: ${entity_type}`,
        proposed_data: payload,
      });
      continue;
    }

    try {
      const response = await apiClient.post(endpoint, payload);
      const responseData = (response.data ?? {}) as Record<string, unknown>;
      const createdId = responseData.id ?? responseData.pk ?? '';

      createdIdsByType[entity_type] = createdId as string | number;
      created.push({
        index: originalIndex,
        entity_type,
        id: createdId as string | number,
        label: extractLabel(entity_type, responseData),
        data: responseData,
      });
    } catch (error: unknown) {
      errors.push({
        index: originalIndex,
        entity_type,
        error: getErrorMessage(error, `Failed to create ${typeLabel}`),
        proposed_data: payload,
      });
      // Continue with remaining entities — partial success is acceptable
    }
  }

  return {
    created,
    errors,
    allSucceeded: errors.length === 0,
  };
}

// ---------------------------------------------------------------------------
// FK Propagation helper
// ---------------------------------------------------------------------------

function propagateForeignKeys(
  payload: Record<string, unknown>,
  createdIdsByType: Record<string, string | number>,
): Record<string, unknown> {
  const result = { ...payload };

  for (const [entityType, fkFields] of Object.entries(FK_PROPAGATION)) {
    const createdId = createdIdsByType[entityType];
    if (createdId == null) {
      continue;
    }

    for (const field of fkFields) {
      // Only propagate if the field is empty/null in the payload
      if (result[field] == null || result[field] === '' || result[field] === 0) {
        result[field] = createdId;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Route helper (for navigation to created entities)
// ---------------------------------------------------------------------------

export function getEntityRoute(entityType: string, id: string | number): string {
  switch (entityType) {
    case 'contact':
      return `/contacts/${id}`;
    case 'carrier':
      return `/carriers/${id}`;
    case 'supplier':
      return `/suppliers/${id}`;
    case 'customer':
      return `/customers/${id}`;
    case 'plant':
      return `/plants/${id}`;
    case 'product':
      return `/products/${id}`;
    case 'inquiry':
      return `/inquiries/${id}`;
    case 'purchase_order':
      return `/purchase-orders/${id}`;
    case 'sales_order':
      return `/sales-orders/${id}`;
    case 'carrier-pos':
      return `/purchase-orders/${id}`;
    case 'invoice':
      return `/invoices/${id}`;
    default:
      return `/${entityType.replace(/_/g, '-')}s/${id}`;
  }
}
