export type SupportedOperationalEntityType =
  | 'inquiry'
  | 'purchase_order'
  | 'sales_order'
  | 'invoice'
  | 'carrier_purchase_order'
  | 'fulfillment'
  | 'claim'
  | 'carrier';

type DocumentEntityConfig = {
  entityType: SupportedOperationalEntityType;
  endpoint: string;
  recordPath?: (id: string | number) => string;
  auditEntityType: string;
  label: string;
  supportsOptimisticStatus?: boolean;
};

const CONFIG_BY_ALIAS: Record<string, DocumentEntityConfig> = {
  inquiry: {
    entityType: 'inquiry',
    endpoint: 'inquiries',
    recordPath: (id) => `/records/inquiry/${encodeURIComponent(String(id))}`,
    auditEntityType: 'Inquiry',
    label: 'Inquiry',
    supportsOptimisticStatus: true,
  },
  inquiries: {
    entityType: 'inquiry',
    endpoint: 'inquiries',
    recordPath: (id) => `/records/inquiry/${encodeURIComponent(String(id))}`,
    auditEntityType: 'Inquiry',
    label: 'Inquiry',
    supportsOptimisticStatus: true,
  },
  purchase_order: {
    entityType: 'purchase_order',
    endpoint: 'purchase-orders',
    recordPath: (id) => `/records/purchase_order/${encodeURIComponent(String(id))}`,
    auditEntityType: 'PurchaseOrder',
    label: 'Purchase Order',
    supportsOptimisticStatus: true,
  },
  'purchase-orders': {
    entityType: 'purchase_order',
    endpoint: 'purchase-orders',
    recordPath: (id) => `/records/purchase_order/${encodeURIComponent(String(id))}`,
    auditEntityType: 'PurchaseOrder',
    label: 'Purchase Order',
    supportsOptimisticStatus: true,
  },
  purchase_orders: {
    entityType: 'purchase_order',
    endpoint: 'purchase-orders',
    recordPath: (id) => `/records/purchase_order/${encodeURIComponent(String(id))}`,
    auditEntityType: 'PurchaseOrder',
    label: 'Purchase Order',
    supportsOptimisticStatus: true,
  },
  sales_order: {
    entityType: 'sales_order',
    endpoint: 'sales-orders',
    recordPath: (id) => `/records/sales_order/${encodeURIComponent(String(id))}`,
    auditEntityType: 'SalesOrder',
    label: 'Sales Order',
    supportsOptimisticStatus: true,
  },
  'sales-orders': {
    entityType: 'sales_order',
    endpoint: 'sales-orders',
    recordPath: (id) => `/records/sales_order/${encodeURIComponent(String(id))}`,
    auditEntityType: 'SalesOrder',
    label: 'Sales Order',
    supportsOptimisticStatus: true,
  },
  sales_orders: {
    entityType: 'sales_order',
    endpoint: 'sales-orders',
    recordPath: (id) => `/records/sales_order/${encodeURIComponent(String(id))}`,
    auditEntityType: 'SalesOrder',
    label: 'Sales Order',
    supportsOptimisticStatus: true,
  },
  invoice: {
    entityType: 'invoice',
    endpoint: 'accounting/invoices',
    recordPath: (id) => `/records/invoice/${encodeURIComponent(String(id))}`,
    auditEntityType: 'Invoice',
    label: 'Invoice',
  },
  invoices: {
    entityType: 'invoice',
    endpoint: 'accounting/invoices',
    recordPath: (id) => `/records/invoice/${encodeURIComponent(String(id))}`,
    auditEntityType: 'Invoice',
    label: 'Invoice',
  },
  carrier_purchase_order: {
    entityType: 'carrier_purchase_order',
    endpoint: 'carrier-pos',
    auditEntityType: 'CarrierPurchaseOrder',
    label: 'Freight Order',
    supportsOptimisticStatus: true,
  },
  carrier_po: {
    entityType: 'carrier_purchase_order',
    endpoint: 'carrier-pos',
    auditEntityType: 'CarrierPurchaseOrder',
    label: 'Freight Order',
    supportsOptimisticStatus: true,
  },
  'carrier-pos': {
    entityType: 'carrier_purchase_order',
    endpoint: 'carrier-pos',
    auditEntityType: 'CarrierPurchaseOrder',
    label: 'Freight Order',
    supportsOptimisticStatus: true,
  },
  freight_order: {
    entityType: 'carrier_purchase_order',
    endpoint: 'carrier-pos',
    auditEntityType: 'CarrierPurchaseOrder',
    label: 'Freight Order',
    supportsOptimisticStatus: true,
  },
  'freight-orders': {
    entityType: 'carrier_purchase_order',
    endpoint: 'carrier-pos',
    auditEntityType: 'CarrierPurchaseOrder',
    label: 'Freight Order',
    supportsOptimisticStatus: true,
  },
  carrier: {
    entityType: 'carrier',
    endpoint: 'carriers',
    recordPath: (id) => `/records/carrier/${encodeURIComponent(String(id))}`,
    auditEntityType: 'Carrier',
    label: 'Carrier',
  },
  carriers: {
    entityType: 'carrier',
    endpoint: 'carriers',
    recordPath: (id) => `/records/carrier/${encodeURIComponent(String(id))}`,
    auditEntityType: 'Carrier',
    label: 'Carrier',
  },
  fulfillment: {
    entityType: 'fulfillment',
    endpoint: 'fulfillments',
    recordPath: (id) => `/records/fulfillment/${encodeURIComponent(String(id))}`,
    auditEntityType: 'Fulfillment',
    label: 'Fulfillment',
    supportsOptimisticStatus: true,
  },
  fulfillments: {
    entityType: 'fulfillment',
    endpoint: 'fulfillments',
    recordPath: (id) => `/records/fulfillment/${encodeURIComponent(String(id))}`,
    auditEntityType: 'Fulfillment',
    label: 'Fulfillment',
    supportsOptimisticStatus: true,
  },
  claim: {
    entityType: 'claim',
    endpoint: 'accounting/claims',
    recordPath: (id) => `/records/claim/${encodeURIComponent(String(id))}`,
    auditEntityType: 'Claim',
    label: 'Claim',
  },
  claims: {
    entityType: 'claim',
    endpoint: 'accounting/claims',
    recordPath: (id) => `/records/claim/${encodeURIComponent(String(id))}`,
    auditEntityType: 'Claim',
    label: 'Claim',
  },
};

export const getDocumentEntityConfig = (rawEntityType: string): DocumentEntityConfig | null => {
  const normalized = String(rawEntityType || '').trim().toLowerCase().replace(/\s+/g, '_');
  return CONFIG_BY_ALIAS[normalized] ?? null;
};

export const supportsOperationalActions = (rawEntityType: string): boolean => {
  const config = getDocumentEntityConfig(rawEntityType);
  return Boolean(config && config.entityType !== 'carrier');
};

export const supportsOptimisticOperationalStatus = (rawEntityType: string): boolean =>
  Boolean(getDocumentEntityConfig(rawEntityType)?.supportsOptimisticStatus);

export const supportsAuditHistory = (rawEntityType: string): boolean =>
  Boolean(getDocumentEntityConfig(rawEntityType));
