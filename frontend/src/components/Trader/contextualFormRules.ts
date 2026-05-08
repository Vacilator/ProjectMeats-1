/**
 * Contextual Form Rules Engine
 *
 * Provides dynamic field visibility, section logic, and AI-driven
 * auto-population rules based on trade context (route, entity links,
 * tenant preferences, and user intent).
 *
 * Used by DynamicFormEngine and SmartTradeCreator to intelligently
 * show/hide fields and pre-fill values.
 */

// ============================================================================
// Types
// ============================================================================

export type TradeContext = 'purchase' | 'sales' | 'freight' | 'inquiry' | 'carrier' | 'general';
export type DeliveryContext = 'customer_pickup' | 'supplier_delivery' | 'third_party' | 'unknown';
export type TradeType = 'spot' | 'contract' | 'unknown';

export interface FormContextRules {
  /** Which entity type the form is for */
  entityType: string;
  /** Trade side context */
  tradeContext: TradeContext;
  /** Delivery arrangement */
  deliveryContext: DeliveryContext;
  /** Trade type (spot vs contract) */
  tradeType: TradeType;
  /** Route decision for pipeline context */
  route: 'FULFILL' | 'BROKER' | null;
  /** Linked entity IDs for inference */
  linkedEntities: {
    customerId?: string | null;
    supplierId?: string | null;
    plantId?: string | null;
    locationId?: string | null;
    inquiryId?: string | null;
  };
  /** Tenant preference overrides */
  tenantPreferences: Record<string, unknown>;
}

export interface FieldVisibilityRule {
  /** Field key */
  field: string;
  /** Whether the field should be visible */
  visible: boolean;
  /** Reason for the decision (for AI explanation) */
  reason?: string;
}

export interface FieldAutoFillRule {
  /** Field key */
  field: string;
  /** Suggested value */
  value: unknown;
  /** Confidence (0-1) */
  confidence: number;
  /** Source of the suggestion */
  source: 'tenant_preference' | 'linked_entity' | 'history' | 'context_inference';
  /** Human-readable reason */
  reason: string;
}

export interface ContextualFormResult {
  /** Fields to hide/show based on context */
  visibilityRules: FieldVisibilityRule[];
  /** Fields to auto-fill with suggested values */
  autoFillRules: FieldAutoFillRule[];
  /** Sections to collapse/expand by default */
  sectionDefaults: Record<string, boolean>;
  /** Fields that become required based on context */
  conditionalRequired: string[];
  /** Fields that should be highlighted as key inputs */
  keyFields: string[];
}

// ============================================================================
// Context Detection
// ============================================================================

/**
 * Detects trade context from entity type and form values.
 */
export function detectTradeContext(entityType: string, values?: Record<string, unknown>): TradeContext {
  switch (entityType) {
    case 'purchase-orders':
    case 'purchase_orders':
      return 'purchase';
    case 'sales-orders':
    case 'sales_orders':
      return 'sales';
    case 'freight-orders':
    case 'freight_orders':
      return 'freight';
    case 'inquiry':
    case 'inquiries':
      return 'inquiry';
    case 'carriers':
    case 'carrier-purchase-orders':
      return 'carrier';
    default:
      return 'general';
  }
}

/**
 * Detects delivery context from form values.
 */
export function detectDeliveryContext(values?: Record<string, unknown>): DeliveryContext {
  if (!values) return 'unknown';

  const shippingType = values.shipping_type || values.delivery_type || values.freight_type;
  if (typeof shippingType === 'string') {
    const lower = shippingType.toLowerCase();
    if (lower.includes('pickup') || lower.includes('customer_pickup') || lower === 'fob_origin') {
      return 'customer_pickup';
    }
    if (lower.includes('delivery') || lower.includes('supplier_delivery') || lower === 'fob_destination') {
      return 'supplier_delivery';
    }
    if (lower.includes('third') || lower.includes('broker')) {
      return 'third_party';
    }
  }

  return 'unknown';
}

// ============================================================================
// Field Visibility Rules
// ============================================================================

/** Fields only relevant on the purchase side */
const PURCHASE_ONLY_FIELDS = new Set([
  'supplier', 'supplier_id', 'supplier_contact', 'supplier_reference',
  'supplier_plant', 'vendor_number', 'supplier_po_number',
]);

/** Fields only relevant on the sales side */
const SALES_ONLY_FIELDS = new Set([
  'our_sales_order_number', 'customer_po_number', 'margin',
  'markup_percentage', 'sales_rep',
]);

/** Fields only for broker route */
const BROKER_ONLY_FIELDS = new Set([
  'supplier', 'supplier_id', 'supplier_plant', 'supplier_contact',
  'rfq_deadline', 'bid_count', 'target_margin',
]);

/** Fields only for customer pickup delivery */
const PICKUP_ONLY_FIELDS = new Set([
  'pickup_date', 'pickup_time', 'pickup_contact', 'pickup_location',
  'customer_carrier', 'customer_trailer_number',
]);

/** Fields only for supplier delivery */
const DELIVERY_ONLY_FIELDS = new Set([
  'delivery_date', 'delivery_time', 'delivery_address', 'delivery_instructions',
  'carrier', 'carrier_id', 'freight_cost', 'tracking_number',
]);

/**
 * Compute field visibility rules based on trade context.
 */
export function computeVisibilityRules(context: FormContextRules): FieldVisibilityRule[] {
  const rules: FieldVisibilityRule[] = [];

  // Purchase-side fields hidden on sales forms
  if (context.tradeContext === 'sales') {
    for (const field of PURCHASE_ONLY_FIELDS) {
      rules.push({ field, visible: false, reason: 'Not relevant for sales orders' });
    }
  }

  // Sales-side fields hidden on purchase forms
  if (context.tradeContext === 'purchase') {
    for (const field of SALES_ONLY_FIELDS) {
      rules.push({ field, visible: false, reason: 'Not relevant for purchase orders' });
    }
  }

  // Route-based visibility
  if (context.route === 'FULFILL') {
    for (const field of BROKER_ONLY_FIELDS) {
      rules.push({ field, visible: false, reason: 'Direct fulfillment — no supplier brokerage needed' });
    }
  }

  // Delivery-context visibility
  if (context.deliveryContext === 'customer_pickup') {
    for (const field of DELIVERY_ONLY_FIELDS) {
      rules.push({ field, visible: false, reason: 'Customer pickup — no delivery logistics needed' });
    }
  } else if (context.deliveryContext === 'supplier_delivery') {
    for (const field of PICKUP_ONLY_FIELDS) {
      rules.push({ field, visible: false, reason: 'Supplier delivery — no pickup fields needed' });
    }
  }

  return rules;
}

// ============================================================================
// Auto-Fill Rules
// ============================================================================

/**
 * Compute auto-fill suggestions based on context, linked entities, and tenant prefs.
 */
export function computeAutoFillRules(context: FormContextRules): FieldAutoFillRule[] {
  const rules: FieldAutoFillRule[] = [];

  // Tenant preference: weight unit
  const weightUnit = context.tenantPreferences.weight_unit || context.tenantPreferences.default_weight_unit;
  if (weightUnit) {
    rules.push({
      field: 'weight_unit',
      value: weightUnit,
      confidence: 0.95,
      source: 'tenant_preference',
      reason: `Tenant default weight unit: ${weightUnit}`,
    });
  }

  // Tenant preference: currency
  const currency = context.tenantPreferences.currency || context.tenantPreferences.default_currency;
  if (currency) {
    rules.push({
      field: 'currency',
      value: currency,
      confidence: 0.95,
      source: 'tenant_preference',
      reason: `Tenant default currency: ${currency}`,
    });
  }

  // Route inference
  if (context.route) {
    rules.push({
      field: 'route_decision',
      value: context.route,
      confidence: 0.9,
      source: 'context_inference',
      reason: `Trade route selected: ${context.route}`,
    });
  }

  // Linked entity inference
  if (context.linkedEntities.customerId) {
    rules.push({
      field: 'customer',
      value: context.linkedEntities.customerId,
      confidence: 0.98,
      source: 'linked_entity',
      reason: 'Pre-linked customer from trade context',
    });
    rules.push({
      field: 'customer_id',
      value: context.linkedEntities.customerId,
      confidence: 0.98,
      source: 'linked_entity',
      reason: 'Pre-linked customer from trade context',
    });
  }

  if (context.linkedEntities.supplierId && context.route === 'BROKER') {
    rules.push({
      field: 'supplier',
      value: context.linkedEntities.supplierId,
      confidence: 0.95,
      source: 'linked_entity',
      reason: 'Pre-linked supplier for broker trade',
    });
    rules.push({
      field: 'supplier_id',
      value: context.linkedEntities.supplierId,
      confidence: 0.95,
      source: 'linked_entity',
      reason: 'Pre-linked supplier for broker trade',
    });
  }

  return rules;
}

// ============================================================================
// Section Defaults
// ============================================================================

/**
 * Compute which sections should be expanded/collapsed by default.
 */
export function computeSectionDefaults(context: FormContextRules): Record<string, boolean> {
  const defaults: Record<string, boolean> = {
    'Order Details': true,
    'Contact Information': true,
  };

  // Shipping section: expand only if delivery context is known
  if (context.deliveryContext !== 'unknown') {
    defaults['Shipping & Delivery'] = true;
  } else {
    defaults['Shipping & Delivery'] = false;
  }

  // Billing: collapse by default for quick entry, expand on sales
  defaults['Billing & Payment'] = context.tradeContext === 'sales';

  // Carrier: only expand for freight
  defaults['Carrier Information'] = context.tradeContext === 'freight';

  // Always collapse audit
  defaults['Audit & Tracking'] = false;

  return defaults;
}

// ============================================================================
// Key Fields (progressive disclosure)
// ============================================================================

/**
 * Determine which fields are "key" (shown first) vs advanced (collapsed).
 */
export function computeKeyFields(context: FormContextRules): string[] {
  const baseKeys = ['customer', 'customer_id'];

  switch (context.tradeContext) {
    case 'purchase':
      return [...baseKeys, 'supplier', 'supplier_id', 'type_of_protein', 'weight', 'price_per_unit', 'total_amount'];
    case 'sales':
      return [...baseKeys, 'type_of_protein', 'weight', 'price_per_unit', 'delivery_date', 'our_sales_order_number'];
    case 'freight':
      return ['carrier', 'carrier_id', 'origin', 'destination', 'pickup_date', 'delivery_date', 'freight_cost'];
    case 'inquiry':
      return [...baseKeys, 'type_of_protein', 'route_decision', 'description'];
    default:
      return baseKeys;
  }
}

// ============================================================================
// Conditional Required Fields
// ============================================================================

/**
 * Compute which fields become required based on context.
 */
export function computeConditionalRequired(context: FormContextRules): string[] {
  const required: string[] = [];

  if (context.tradeContext === 'purchase' || context.route === 'BROKER') {
    required.push('supplier', 'supplier_id');
  }

  if (context.deliveryContext === 'supplier_delivery') {
    required.push('delivery_date', 'carrier');
  }

  if (context.deliveryContext === 'customer_pickup') {
    required.push('pickup_date');
  }

  return required;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Compute all contextual form rules given the current context.
 * This is the primary export used by DynamicFormEngine and SmartTradeCreator.
 */
export function computeContextualFormRules(context: FormContextRules): ContextualFormResult {
  return {
    visibilityRules: computeVisibilityRules(context),
    autoFillRules: computeAutoFillRules(context),
    sectionDefaults: computeSectionDefaults(context),
    conditionalRequired: computeConditionalRequired(context),
    keyFields: computeKeyFields(context),
  };
}

/**
 * Build a FormContextRules object from minimal inputs.
 * Convenience function for pages that want to pass context to the form engine.
 */
export function buildFormContext(params: {
  entityType: string;
  values?: Record<string, unknown>;
  route?: 'FULFILL' | 'BROKER' | null;
  linkedEntities?: FormContextRules['linkedEntities'];
  tenantPreferences?: Record<string, unknown>;
}): FormContextRules {
  return {
    entityType: params.entityType,
    tradeContext: detectTradeContext(params.entityType, params.values),
    deliveryContext: detectDeliveryContext(params.values),
    tradeType: 'unknown',
    route: params.route || null,
    linkedEntities: params.linkedEntities || {},
    tenantPreferences: params.tenantPreferences || {},
  };
}
