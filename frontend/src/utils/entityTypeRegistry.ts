/**
 * Canonical entity-type normalization and display utilities.
 *
 * Every component that needs to normalise a raw entity-type string (from
 * schemas, API responses, URLs, etc.) MUST import from here instead of
 * defining its own local helper.
 */

const ALIASES: Record<string, string> = {
  inquiries: 'inquiry',
  inquiry: 'inquiry',
  customers: 'customer',
  customer: 'customer',
  suppliers: 'supplier',
  supplier: 'supplier',
  plants: 'plant',
  plant: 'plant',
  locations: 'location',
  location: 'location',
  contacts: 'contact',
  contact: 'contact',
  invoices: 'invoice',
  invoice: 'invoice',
  claims: 'claim',
  claim: 'claim',
  purchase_order: 'purchase_order',
  'purchase-orders': 'purchase_order',
  purchase_orders: 'purchase_order',
  sales_order: 'sales_order',
  'sales-orders': 'sales_order',
  sales_orders: 'sales_order',
  'carrier-pos': 'carrier-pos',
  carrier_po: 'carrier-pos',
  carrier_purchase_order: 'carrier-pos',
  'carrier-purchase-order': 'carrier-pos',
};

/**
 * Normalise a raw entity-type string to the canonical slug used throughout
 * the app (lowercase, singular, underscored).
 *
 * Unknown values are lower-cased and returned as-is so the function never
 * throws.
 */
export const normalizeEntityType = (raw: string): string => {
  const key = String(raw || '').trim().toLowerCase();
  return ALIASES[key] ?? key;
};

/** Alias kept for call-sites that used the schema-prefixed name. */
export const normalizeSchemaEntityType = normalizeEntityType;

const DISPLAY_NAMES: Record<string, string> = {
  inquiry: 'Inquiry',
  customer: 'Customer',
  supplier: 'Supplier',
  plant: 'Plant',
  location: 'Location',
  contact: 'Contact',
  invoice: 'Invoice',
  claim: 'Claim',
  purchase_order: 'Purchase Order',
  sales_order: 'Sales Order',
  'carrier-pos': 'Carrier PO',
};

/** Human-friendly label for an entity type. */
export const entityTypeDisplayName = (raw: string): string => {
  const key = normalizeEntityType(raw);
  return (
    DISPLAY_NAMES[key] ??
    key
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
};

/** Build the canonical record detail path for a given entity. */
export const entityRecordPath = (entityType: string, id: string): string =>
  `/records/${encodeURIComponent(normalizeEntityType(entityType))}/${encodeURIComponent(id)}`;

const LIST_PATHS: Record<string, string> = {
  inquiry: '/inquiries',
  supplier: '/suppliers',
  customer: '/customers',
  contact: '/contacts',
  plant: '/suppliers/plants',
  location: '/customers/locations',
  purchase_order: '/purchase-orders',
  supplier_purchase_order: '/purchase-orders',
  sales_order: '/sales-orders',
  'carrier-pos': '/purchase-orders',
  carrier_purchase_order: '/purchase-orders',
  invoice: '/accounting/receivables/invoices',
  claim: '/accounting/claims',
  carrier: '/carriers',
};

/**
 * Get the list/index page path for an entity type.
 * Returns null for unrecognized types.
 */
export const entityListPath = (raw: string): string | null => {
  const key = normalizeEntityType(raw);
  return LIST_PATHS[key] ?? LIST_PATHS[raw] ?? null;
};
