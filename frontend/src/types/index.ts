/**
 * TypeScript type definitions for ProjectMeats frontend.
 */

// Chat Types
export interface ChatSession {
  id: string;
  title?: string;
  session_status: 'active' | 'completed' | 'archived';
  context_data?: Record<string, unknown>;
  last_activity: string;
  created_on: string;
  modified_on: string;
  message_count: number;
}

export interface ChatMessage {
  id: string;
  session: string;
  message_type: 'user' | 'assistant' | 'system' | 'document';
  content: string;
  metadata?: Record<string, unknown>;
  is_processed: boolean;
  created_on: string;
  modified_on: string;
}

// User Types
export interface UserTenant {
  tenant__id: string;
  tenant__name: string;
  tenant__slug: string;
  role: string;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  /**
   * Optional user role string.
   * Some API responses include a global role; others provide per-tenant roles via `tenants`.
   */
  role?: string;
  tenants?: UserTenant[];
}

// API Response Types
export interface APIError {
  error: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Component Props Types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

// File Upload Types
export interface FileUploadProps {
  onFileUpload: (file: File) => Promise<UploadedDocument>;
  disabled?: boolean;
  acceptedFileTypes?: string[];
  maxFileSize?: number;
}

// Document Processing Types
export interface UploadedDocument {
  id: string;
  original_filename: string;
  file_size: number;
  file_type: string;
  document_type: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  extracted_text?: string;
  extracted_data?: Record<string, unknown>;
  created_on: string;
}

// ============================================================================
// Business Domain Types (Updated for Chunk 1-5)
// ============================================================================

/**
 * Location entity for tracking pickup and delivery addresses.
 * Added in Chunk 1: Locations App with RLS
 */
export interface Location {
  id: string;
  name: string;
  location_type: 'plant' | 'warehouse' | 'distribution_center';
  address: string;
  city: string;
  state_province: string;
  zip_postal_code: string;
  country: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  how_make_appointment?: string;
  plant_est_number?: string;
  supplier?: string;
  customer?: string;
  tenant: string;
  created_on: string;
  modified_on: string;
}

/**
 * Lightweight location reference for nested serializers.
 */
export interface LocationListItem {
  id: string;
  name: string;
  location_type: string;
  city: string;
  state_province: string;
}

/**
 * Supplier entity.
 * Updated in Chunk 2: Added departments_array, locations
 */
export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  plant?: string;
  proteins?: string[];
  edible_inedible?: string;
  type_of_plant?: string;
  type_of_certificate?: string;
  tested_product?: boolean;
  origin?: string;
  country_origin?: string;
  contacts?: string[];
  shipping_offered?: string;
  how_to_book_pickup?: string;
  offer_contracts?: boolean;
  offers_export_documents?: boolean;
  accounting_payment_terms?: string;
  credit_limits?: string;
  account_line_of_credit?: string;
  fresh_or_frozen?: string;
  package_type?: string;
  net_or_catch?: string;
  departments?: string; // Legacy comma-separated
  departments_array?: string[]; // NEW: Multi-select array
  locations?: LocationListItem[]; // NEW: Nested locations (read-only)
  accounting_terms?: string;
  accounting_line_of_credit?: string;
  credit_app_sent?: boolean;
  credit_app_set_up?: boolean;
  created_on: string;
  modified_on: string;
}

/**
 * Customer entity.
 * Updated in Chunk 2: Added industry_array, preferred_protein_types, locations
 */
export interface Customer {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  plant?: string;
  proteins?: string[];
  edible_inedible?: string;
  type_of_plant?: string;
  type_of_certificate?: string;
  purchasing_preference_origin?: string;
  industry?: string; // Legacy single value
  industry_array?: string[]; // NEW: Multi-select array
  preferred_protein_types?: string[]; // NEW: Multi-select array
  contacts?: string[];
  will_pickup_load?: boolean;
  locations?: LocationListItem[]; // NEW: Nested locations (read-only)
  accounting_payment_terms?: string;
  credit_limits?: string;
  account_line_of_credit?: string;
  buyer_contact_name?: string;
  buyer_contact_phone?: string;
  buyer_contact_email?: string;
  contact_title?: string;
  product_exportable?: boolean;
  accounting_terms?: string;
  accounting_line_of_credit?: string;
  created_on: string;
  modified_on: string;
}

/**
 * Carrier entity.
 * Updated in Chunk 3: Added departments_array
 */
export interface Carrier {
  id: string;
  name: string;
  code: string;
  carrier_type?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  mc_number?: string;
  dot_number?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_expiry?: string;
  is_active?: boolean;
  notes?: string;
  my_customer_num_from_carrier?: string;
  accounting_payable_contact_name?: string;
  accounting_payable_contact_phone?: string;
  accounting_payable_contact_email?: string;
  sales_contact_name?: string;
  sales_contact_phone?: string;
  sales_contact_email?: string;
  accounting_payment_terms?: string;
  credit_limits?: string;
  account_line_of_credit?: string;
  departments?: string; // Legacy comma-separated
  departments_array?: string[]; // NEW: Multi-select array
  how_carrier_make_appointment?: string;
  contacts?: string[];
  created_at: string;
  updated_at: string;
  created_by?: string;
  created_by_name?: string;
}

/**
 * Product entity.
 * No changes needed (already uses type_of_protein correctly)
 */
export interface Product {
  id: string;
  product_code: string;
  description_of_product_item: string;
  type_of_protein?: string;
  /** Legacy field name used by some endpoints/exports */
  protein_type?: string;
  /** Optional display fields used by search/autocomplete results */
  name?: string;
  description?: string;
  avg_price?: number;
  fresh_or_frozen?: string;
  package_type?: string;
  net_or_catch?: string;
  edible_or_inedible?: string;
  tested_product?: boolean;
  supplier?: string;
  supplier_item_number?: string;
  plants_available?: string;
  origin?: string;
  carton_type?: string;
  pcs_per_carton?: string;
  uom?: string;
  namp?: string;
  usda?: string;
  ub?: string;
  unit_weight?: number;
  is_active?: boolean;
  created_on: string;
  modified_on: string;
}

/**
 * Purchase Order entity.
 * Updated in Chunk 3: Added pick_up_location, delivery_location, carrier_release_format
 */
export interface PurchaseOrder {
  id: string;
  order_number: string;
  supplier: string;
  product?: string;
  total_amount: number;
  status: string;
  order_date: string;
  delivery_date?: string;
  pick_up_date?: string;
  logistics_scenario?: string;
  pick_up_location?: string; // NEW: Location FK
  pick_up_location_details?: LocationListItem; // NEW: Nested (read-only)
  delivery_location?: string; // NEW: Location FK
  delivery_location_details?: LocationListItem; // NEW: Nested (read-only)
  plant?: string;
  carrier?: string;
  carrier_release_format?: string; // NEW: Choice field
  payment_terms?: string;
  notes?: string;
  created_on: string;
  modified_on: string;
}

/**
 * Sales Order entity.
 * Updated in Chunk 3: Added pick_up_location, delivery_location, carrier_release_format, plant_est_number
 */
export interface SalesOrder {
  id: string;
  tenant: string;
  our_sales_order_num: string;
  date_time_stamp: string;
  supplier: string;
  supplier_name?: string;
  customer: string;
  customer_name?: string;
  carrier?: string;
  carrier_name?: string;
  product?: string;
  product_code?: string;
  plant?: string;
  pick_up_location?: string; // NEW: Location FK
  pick_up_location_details?: LocationListItem; // NEW: Nested (read-only)
  delivery_location?: string; // NEW: Location FK
  delivery_location_details?: LocationListItem; // NEW: Nested (read-only)
  contact?: string;
  pick_up_date?: string;
  delivery_date?: string;
  delivery_po_num?: string;
  carrier_release_num?: string;
  carrier_release_format?: string; // NEW: Choice field
  plant_est_number?: string; // NEW: Plant establishment number
  quantity?: number;
  total_weight?: number;
  weight_unit?: string;
  status?: string;
  total_amount?: number;
  notes?: string;
  created_on: string;
  modified_on: string;
}

/**
 * Invoice entity.
 * Updated in Chunk 3: Added payment_terms (uses proper choices now)
 */
export interface Invoice {
  id: string;
  invoice_number: string;
  date_time_stamp: string;
  customer: string;
  sales_order?: string;
  product?: string;
  pick_up_date?: string;
  delivery_date?: string;
  due_date?: string;
  our_sales_order_num?: string;
  delivery_po_num?: string;
  payment_terms?: string; // Updated to use AccountingPaymentTermsChoices
  accounting_payable_contact_name?: string;
  accounting_payable_contact_phone?: string;
  accounting_payable_contact_email?: string;
  type_of_protein?: string; // Updated to use ProteinTypeChoices
  description_of_product_item?: string;
  quantity?: number;
  total_weight?: number;
  weight_unit?: string;
  edible_or_inedible?: string;
  tested_product?: boolean;
  unit_price?: number;
  total_amount: number;
  tax_amount?: number;
  status?: string;
  notes?: string;
  created_on: string;
  modified_on: string;
}

// ============================================================================
// Inquiry & Fulfillment Types (Phase 2-3)
// ============================================================================

/**
 * Inquiry status choices
 */
export type InquiryStatus = 'draft' | 'pending' | 'quoted' | 'accepted' | 'rejected' | 'expired' | 'fulfilled';

/**
 * Inquiry entity type choices
 */
export type InquiryEntityType = 'supplier' | 'customer';

/**
 * Inquiry source choices
 */
export type InquirySource = 'scheduled_call' | 'inbound_call' | 'email' | 'website' | 'referral' | 'trade_show' | 'other';

/**
 * InquiryProduct - line items with desired vs actual values
 */
export interface InquiryProduct {
  id: string;
  inquiry: string;
  product: string;
  product_code?: string;
  product_description?: string;
  quantity: number;
  // Desired values (customer request)
  desired_total?: number;
  desired_price_per_unit?: number;
  desired_uom?: string;
  desired_uom_value?: number;
  desired_processed_date?: string;
  desired_expiration_date?: string;
  desired_available_date?: string;
  desired_shipping_date?: string;
  desired_delivery_date?: string;
  // Actual values (quoted/confirmed)
  actual_total?: number;
  actual_price_per_unit?: number;
  actual_uom?: string;
  actual_uom_value?: number;
  actual_processed_date?: string;
  actual_expiration_date?: string;
  actual_available_date?: string;
  actual_shipping_date?: string;
  actual_delivery_date?: string;
  // Calculated fields
  margin?: number;
  margin_percent?: number;
  notes?: string;
  created_on: string;
  modified_on: string;
}

/**
 * Inquiry entity - tracks product interest from calls
 */
export type ShippingType = 'tenant' | 'customer_pickup' | 'supplier_delivering';

export interface Inquiry {
  id: string;
  tenant: string;
  inquiry_number: string;
  status: InquiryStatus;
  entity_type: InquiryEntityType;
  shipping_type?: ShippingType;
  supplier?: string;
  supplier_name?: string;
  customer?: string;
  customer_name?: string;
  contact?: string;
  contact_name?: string;
  // Contact snapshot (preserved at inquiry time)
  contact_snapshot_name?: string;
  contact_snapshot_email?: string;
  contact_snapshot_phone?: string;
  contact_snapshot_company?: string;
  contact_snapshot_position?: string;
  // Source tracking
  source: InquirySource;
  scheduled_call?: string;
  // Products (through InquiryProduct)
  products: InquiryProduct[];
  // Quote details
  valid_until?: string;
  is_expired?: boolean;
  // Competitor tracking
  competitor_names?: string;
  competitor_pricing_notes?: string;
  win_loss_reason?: string;
  // Aggregates
  total_desired?: number;
  total_actual?: number;
  total_margin?: number;
  total_margin_percent?: number;
  // Metadata
  notes?: string;
  created_by?: string;
  created_by_name?: string;
  created_on: string;
  modified_on: string;
}

/**
 * Fulfillment status choices
 */
export type FulfillmentStatus = 'pending' | 'in_progress' | 'shipped' | 'delivered' | 'completed' | 'cancelled';

/**
 * FulfillmentProduct - tracks quantity fulfilled per line
 */
export interface FulfillmentProduct {
  id: string;
  fulfillment: string;
  inquiry_product: string;
  product?: string;
  product_code?: string;
  product_description?: string;
  quantity_ordered: number;
  quantity_fulfilled: number;
  unit_price?: number;
  total_price?: number;
  notes?: string;
  created_on: string;
  modified_on: string;
}

/**
 * Fulfillment entity - tracks shipments
 */
export interface Fulfillment {
  id: string;
  tenant: string;
  fulfillment_number: string;
  inquiry: string;
  inquiry_number?: string;
  shipping_type?: ShippingType;
  supplier?: string;
  supplier_name?: string;
  customer?: string;
  customer_name?: string;
  status: FulfillmentStatus;
  // Shipping info
  shipped_by?: string;
  shipped_by_name?: string;
  tracking_numbers?: string[];
  shipped_date?: string;
  estimated_delivery?: string;
  actual_delivery?: string;
  // Products
  products: FulfillmentProduct[];
  is_partial?: boolean;
  // Metadata
  notes?: string;
  created_by?: string;
  created_by_name?: string;
  created_on: string;
  modified_on: string;
}

/**
 * Inquiry list item (lighter version for lists)
 */
export interface InquiryListItem {
  id: string;
  inquiry_number: string;
  status: InquiryStatus;
  entity_type: InquiryEntityType;
  shipping_type?: ShippingType;
  supplier_name?: string;
  customer_name?: string;
  contact_name?: string;
  source: InquirySource;
  total_desired?: number;
  total_actual?: number;
  total_margin?: number;
  product_count?: number;
  valid_until?: string;
  is_expired?: boolean;
  created_on: string;
}

/**
 * Fulfillment list item (lighter version for lists)
 */
export interface FulfillmentListItem {
  id: string;
  fulfillment_number: string;
  inquiry_number?: string;
  supplier_name?: string;
  customer_name?: string;
  status: FulfillmentStatus;
  tracking_numbers?: string[];
  shipped_date?: string;
  estimated_delivery?: string;
  is_partial?: boolean;
  created_on: string;
}

// ============================================================================
// Inquiry Templates (Phase 5)
// ============================================================================

/**
 * Inquiry template product - default values for quick inquiry creation
 */
export interface InquiryTemplateProduct {
  id: string;
  product: string;
  product_code?: string;
  product_description?: string;
  default_quantity: number;
  default_uom: string;
  default_price_per_unit?: number;
  notes?: string;
  sort_order: number;
}

/**
 * Inquiry template for reusable inquiry configurations
 */
export interface InquiryTemplate {
  id: string;
  tenant: string;
  name: string;
  description?: string;
  entity_type: InquiryEntityType;
  is_active: boolean;
  default_valid_days: number;
  default_notes?: string;
  use_count: number;
  products: InquiryTemplateProduct[];
  product_count?: number;
  created_by?: string;
  created_by_name?: string;
  created_on: string;
  modified_on: string;
}

/**
 * Inquiry template list item (lightweight)
 */
export interface InquiryTemplateListItem {
  id: string;
  name: string;
  description?: string;
  entity_type: InquiryEntityType;
  is_active: boolean;
  default_valid_days: number;
  use_count: number;
  product_count: number;
  created_on: string;
  modified_on: string;
}

/**
 * Clone inquiry request payload
 */
export interface CloneInquiryPayload {
  include_products?: boolean;
  include_pricing?: boolean;
  new_entity_id?: string;
  new_contact_id?: string;
}

// ============================================================================
// Workflow Execution Types (Phase 5)
// ============================================================================

export * from './workflows';
export * from './deals';
