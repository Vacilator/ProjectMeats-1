/**
 * Workflow Configuration — Golden standard for entity status/action display.
 *
 * Maps entity types to human-readable transition labels, icons, and party
 * field names. Used by WorkflowStatusBar, StatusActionCell, and PartyContactCell.
 *
 * Theme Compliance: CSS custom properties only.
 */

import {
  FileText,
  ShoppingCart,
  Package,
  Truck,
  Receipt,
  AlertTriangle,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface TransitionMeta {
  /** Human-readable label for the action button */
  label: string;
  /** Semantic intent for button styling */
  intent: 'primary' | 'success' | 'danger' | 'warning' | 'neutral';
  /** Optional confirmation message before executing */
  confirm?: string;
  /** Short description of what this action does (shown as tooltip) */
  description?: string;
}

export interface EntityWorkflowConfig {
  /** Display name of this entity type */
  label: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Map from "fromStatus→toStatus" to transition metadata */
  transitions: Record<string, TransitionMeta>;
  /** Field name on the entity record that holds the primary party (supplier/customer) */
  partyField?: string;
  /** Label for the party column (e.g. "Supplier", "Customer") */
  partyLabel?: string;
  /** Field name for the contact person */
  contactField?: string;
}

// ============================================================================
// Transition label helpers
// ============================================================================

/** Generate a map key for a status transition */
const t = (from: string, to: string) => `${from}→${to}`;

// ============================================================================
// Entity Configurations
// ============================================================================

const INQUIRY_CONFIG: EntityWorkflowConfig = {
  label: 'Inquiry',
  icon: FileText,
  partyField: 'customer_name',
  partyLabel: 'Customer',
  contactField: 'contact_name',
  transitions: {
    [t('draft', 'pending')]: { label: 'Submit', intent: 'primary', description: 'Submit inquiry for review' },
    [t('draft', 'quoted')]: { label: 'Mark as Quoted', intent: 'primary', description: 'Record that a price quote has been provided to the customer' },
    [t('draft', 'cancelled')]: { label: 'Cancel', intent: 'danger', confirm: 'Cancel this inquiry?' },
    [t('pending', 'quoted')]: { label: 'Mark as Quoted', intent: 'primary', description: 'Record that a price quote has been provided to the customer' },
    [t('pending', 'cancelled')]: { label: 'Cancel', intent: 'danger', confirm: 'Cancel this inquiry?' },
    [t('quoted', 'accepted')]: { label: 'Accept Inquiry', intent: 'success', description: 'Accept this inquiry and auto-create a Purchase Order', confirm: 'Accept this inquiry? A draft Purchase Order will be created automatically.' },
    [t('quoted', 'rejected')]: { label: 'Reject', intent: 'danger', confirm: 'Reject this inquiry?' },
    [t('quoted', 'cancelled')]: { label: 'Cancel', intent: 'danger', confirm: 'Cancel this inquiry?' },
    [t('accepted', 'fulfilled')]: { label: 'Mark Fulfilled', intent: 'success', description: 'Mark this inquiry as fully fulfilled' },
    [t('accepted', 'cancelled')]: { label: 'Cancel', intent: 'danger', confirm: 'Cancel this inquiry?' },
  },
};

const PURCHASE_ORDER_CONFIG: EntityWorkflowConfig = {
  label: 'Purchase Order',
  icon: ShoppingCart,
  partyField: 'supplier_name',
  partyLabel: 'Supplier',
  contactField: 'contact_name',
  transitions: {
    [t('draft', 'pending_approval')]: { label: 'Submit for Approval', intent: 'primary', description: 'Submit this PO for manager approval' },
    [t('draft', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('pending', 'pending_approval')]: { label: 'Submit for Approval', intent: 'primary', description: 'Submit this PO for manager approval' },
    [t('pending', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('pending_approval', 'approved')]: { label: 'Approve', intent: 'success', description: 'Approve this PO — a Sales Order will be auto-created' },
    [t('pending_approval', 'cancelled')]: { label: 'Reject', intent: 'danger' },
    [t('approved', 'sent')]: { label: 'Send to Supplier', intent: 'primary', description: 'Send this PO to the supplier for confirmation' },
    [t('approved', 'carrier_assigned')]: { label: 'Assign Carrier', intent: 'primary', description: 'Assign a carrier for transport' },
    [t('approved', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('sent', 'carrier_assigned')]: { label: 'Assign Carrier', intent: 'primary' },
    [t('sent', 'in_transit')]: { label: 'Mark In Transit', intent: 'primary' },
    [t('sent', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('carrier_assigned', 'in_transit')]: { label: 'Mark In Transit', intent: 'primary' },
    [t('carrier_assigned', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('in_transit', 'delivered')]: { label: 'Mark Delivered', intent: 'success' },
    [t('in_transit', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('delivered', 'invoiced')]: { label: 'Create Invoice', intent: 'primary' },
  },
};

const SALES_ORDER_CONFIG: EntityWorkflowConfig = {
  label: 'Sales Order',
  icon: Package,
  partyField: 'customer_name',
  partyLabel: 'Customer',
  contactField: 'contact_name',
  transitions: {
    [t('draft', 'pending_approval')]: { label: 'Submit for Approval', intent: 'primary', description: 'Submit this SO for manager approval' },
    [t('draft', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('pending', 'pending_approval')]: { label: 'Submit for Approval', intent: 'primary', description: 'Submit this SO for manager approval' },
    [t('pending', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('pending_approval', 'approved')]: { label: 'Approve', intent: 'success', description: 'Approve this SO' },
    [t('pending_approval', 'cancelled')]: { label: 'Reject', intent: 'danger' },
    [t('approved', 'confirmed')]: { label: 'Confirm Order', intent: 'primary', description: 'Confirm this order — a Carrier PO will be auto-created for logistics' },
    [t('approved', 'sent')]: { label: 'Send to Customer', intent: 'primary', description: 'Send this SO to the customer for confirmation' },
    [t('approved', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('confirmed', 'sent')]: { label: 'Send to Customer', intent: 'primary' },
    [t('confirmed', 'in_transit')]: { label: 'Mark In Transit', intent: 'primary' },
    [t('confirmed', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('sent', 'in_transit')]: { label: 'Mark In Transit', intent: 'primary' },
    [t('sent', 'delivered')]: { label: 'Mark Delivered', intent: 'success' },
    [t('sent', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('in_transit', 'delivered')]: { label: 'Mark Delivered', intent: 'success' },
    [t('in_transit', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('delivered', 'invoiced')]: { label: 'Create Invoice', intent: 'primary' },
  },
};

const INVOICE_CONFIG: EntityWorkflowConfig = {
  label: 'Invoice',
  icon: Receipt,
  partyField: 'customer_name',
  partyLabel: 'Customer',
  contactField: 'contact_name',
  transitions: {
    [t('draft', 'pending_approval')]: { label: 'Submit for Approval', intent: 'primary' },
    [t('draft', 'approved')]: { label: 'Approve', intent: 'success' },
    [t('draft', 'sent')]: { label: 'Send', intent: 'primary' },
    [t('draft', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('pending_approval', 'approved')]: { label: 'Approve', intent: 'success' },
    [t('pending_approval', 'cancelled')]: { label: 'Reject', intent: 'danger' },
    [t('approved', 'sent')]: { label: 'Send to Customer', intent: 'primary' },
    [t('approved', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('sent', 'partial_paid')]: { label: 'Record Partial Payment', intent: 'primary' },
    [t('sent', 'paid')]: { label: 'Record Payment', intent: 'success' },
    [t('sent', 'overdue')]: { label: 'Mark Overdue', intent: 'danger' },
    [t('sent', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('partial_paid', 'paid')]: { label: 'Record Full Payment', intent: 'success' },
    [t('partial_paid', 'overdue')]: { label: 'Mark Overdue', intent: 'danger' },
    [t('partial_paid', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('overdue', 'partial_paid')]: { label: 'Record Partial Payment', intent: 'primary' },
    [t('overdue', 'paid')]: { label: 'Record Payment', intent: 'success' },
    [t('overdue', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
  },
};

const CARRIER_PO_CONFIG: EntityWorkflowConfig = {
  label: 'Freight Order',
  icon: Truck,
  partyField: 'carrier_name',
  partyLabel: 'Carrier',
  contactField: 'contact_name',
  transitions: {
    [t('draft', 'pending_approval')]: { label: 'Submit for Approval', intent: 'primary', description: 'Submit this freight order for approval' },
    [t('draft', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('pending_approval', 'approved')]: { label: 'Approve', intent: 'success', description: 'Approve this freight order' },
    [t('pending_approval', 'cancelled')]: { label: 'Reject', intent: 'danger' },
    [t('approved', 'dispatched')]: { label: 'Dispatch', intent: 'primary', description: 'Mark as dispatched to carrier' },
    [t('approved', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('dispatched', 'in_transit')]: { label: 'Mark In Transit', intent: 'primary' },
    [t('dispatched', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('in_transit', 'delivered')]: { label: 'Mark Delivered', intent: 'success', description: 'Mark as delivered — a Fulfillment record will be auto-created' },
    [t('in_transit', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('delivered', 'completed')]: { label: 'Complete', intent: 'success' },
  },
};

const FULFILLMENT_CONFIG: EntityWorkflowConfig = {
  label: 'Fulfillment',
  icon: ClipboardCheck,
  partyField: 'customer_name',
  partyLabel: 'Customer',
  contactField: 'contact_name',
  transitions: {
    [t('pending', 'in_progress')]: { label: 'Start Processing', intent: 'primary', description: 'Begin processing this fulfillment' },
    [t('pending', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('in_progress', 'shipped')]: { label: 'Mark Shipped', intent: 'primary', description: 'Mark goods as shipped' },
    [t('in_progress', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('shipped', 'delivered')]: { label: 'Mark Delivered', intent: 'success', description: 'Confirm delivery to customer' },
    [t('shipped', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('delivered', 'completed')]: { label: 'Complete', intent: 'success', description: 'Complete fulfillment — an Invoice will be auto-created' },
  },
};

const CLAIM_CONFIG: EntityWorkflowConfig = {
  label: 'Claim',
  icon: AlertTriangle,
  partyField: 'customer_name',
  partyLabel: 'Customer',
  contactField: 'contact_name',
  transitions: {
    [t('pending', 'approved')]: { label: 'Approve Claim', intent: 'success' },
    [t('pending', 'denied')]: { label: 'Deny Claim', intent: 'danger', confirm: 'Deny this claim?' },
    [t('pending', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
    [t('approved', 'settled')]: { label: 'Mark Settled', intent: 'success' },
    [t('approved', 'cancelled')]: { label: 'Cancel', intent: 'danger' },
  },
};

// ============================================================================
// Registry
// ============================================================================

const WORKFLOW_CONFIGS: Record<string, EntityWorkflowConfig> = {
  inquiry: INQUIRY_CONFIG,
  inquiries: INQUIRY_CONFIG,
  purchase_order: PURCHASE_ORDER_CONFIG,
  purchase_orders: PURCHASE_ORDER_CONFIG,
  'purchase-orders': PURCHASE_ORDER_CONFIG,
  sales_order: SALES_ORDER_CONFIG,
  sales_orders: SALES_ORDER_CONFIG,
  'sales-orders': SALES_ORDER_CONFIG,
  invoice: INVOICE_CONFIG,
  invoices: INVOICE_CONFIG,
  carrier_purchase_order: CARRIER_PO_CONFIG,
  carrier_po: CARRIER_PO_CONFIG,
  'carrier-pos': CARRIER_PO_CONFIG,
  freight_order: CARRIER_PO_CONFIG,
  'freight-orders': CARRIER_PO_CONFIG,
  fulfillment: FULFILLMENT_CONFIG,
  fulfillments: FULFILLMENT_CONFIG,
  claim: CLAIM_CONFIG,
  claims: CLAIM_CONFIG,
};

/**
 * Get the workflow config for an entity type. Returns null for non-workflow
 * entities (supplier, customer, plant, location, contact, carrier, product).
 */
export function getWorkflowConfig(entityType: string): EntityWorkflowConfig | null {
  const normalized = entityType.toLowerCase().replace(/\s+/g, '_');
  return WORKFLOW_CONFIGS[normalized] ?? null;
}

/**
 * Get a human-readable label for a status transition button.
 * Falls back to "→ Status Name" if no custom label is configured.
 */
export function getTransitionLabel(
  entityType: string,
  currentStatus: string,
  nextStatus: string,
): TransitionMeta {
  const config = getWorkflowConfig(entityType);
  const key = t(currentStatus, nextStatus);
  if (config?.transitions[key]) {
    return config.transitions[key];
  }
  // Fallback: capitalize the target status
  const fallbackLabel = nextStatus
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { label: fallbackLabel, intent: 'neutral' };
}

/**
 * Get allowed transitions for an entity type from a given status (client-side).
 * Mirrors the backend `DocumentWorkflow.allowed_transitions()` by parsing
 * transition keys in the config. Returns target status strings.
 */
export function getAllowedTransitions(
  entityType: string,
  currentStatus: string,
): string[] {
  const config = getWorkflowConfig(entityType);
  if (!config) return [];
  const prefix = `${currentStatus}→`;
  return Object.keys(config.transitions)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length));
}

/**
 * Given an entity type and its current status, return the single "primary"
 * next action (the first non-cancel transition). Used for quick-action buttons
 * at the row level.
 */
export function getPrimaryTransition(
  entityType: string,
  currentStatus: string,
  allowedTransitions?: string[],
): { nextStatus: string; meta: TransitionMeta } | null {
  const transitions = allowedTransitions ?? getAllowedTransitions(entityType, currentStatus);
  const nonCancel = transitions.filter((s) => s !== 'cancelled');
  if (nonCancel.length === 0) return null;
  const nextStatus = nonCancel[0];
  return { nextStatus, meta: getTransitionLabel(entityType, currentStatus, nextStatus) };
}
