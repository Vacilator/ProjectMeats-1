export type ResolvedEntityDisplay = {
  text: string;
  tooltip?: string;
  usedIdentifierFallback: boolean;
  identifier?: string;
};

type ResolveEntityDisplayOptions = {
  entityType?: string;
  preferredKeys?: string[];
  fallbackStyle?: 'id' | 'details';
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_TOKEN_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
const HEX32_PATTERN = /^[0-9a-f]{32}$/i;
const NUMERIC_ID_PATTERN = /^\d+$/;

const DEFAULT_CANDIDATE_KEYS = [
  'display_name',
  'displayName',
  'effective_name',
  'effectiveName',
  'full_name',
  'fullName',
  'name',
  'title',
  'label',
  'company_name',
  'companyName',
  'company',
  'supplier_name',
  'supplierName',
  'customer_name',
  'customerName',
  'plant_name',
  'plantName',
  'location_name',
  'locationName',
  'department_name',
  'departmentName',
  'item_name',
  'itemName',
  'invoice_number',
  'invoiceNumber',
  'order_number',
  'orderNumber',
  'our_sales_order_num',
  'ourSalesOrderNum',
  'our_purchase_order_num',
  'ourPurchaseOrderNum',
  'code',
  'subtitle',
];

const SINGULAR_ENTITY_LABELS: Record<string, string> = {
  suppliers: 'Supplier',
  supplier: 'Supplier',
  customers: 'Customer',
  customer: 'Customer',
  plants: 'Plant',
  plant: 'Plant',
  locations: 'Location',
  location: 'Location',
  contacts: 'Contact',
  contact: 'Contact',
  departments: 'Department',
  department: 'Department',
  records: 'Record',
  record: 'Record',
  inquiries: 'Inquiry',
  inquiry: 'Inquiry',
  invoices: 'Invoice',
  invoice: 'Invoice',
  'sales-orders': 'Sales Order',
  sales_orders: 'Sales Order',
  sales_order: 'Sales Order',
  'purchase-orders': 'Purchase Order',
  purchase_orders: 'Purchase Order',
  purchase_order: 'Purchase Order',
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const cleanText = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
};

export const isUuidLike = (value: unknown): boolean => {
  const text = cleanText(value);
  return Boolean(text) && (UUID_PATTERN.test(text) || HEX32_PATTERN.test(text));
};

export const isIdentifierLike = (value: unknown): boolean => {
  const text = cleanText(value);
  return Boolean(text) && (isUuidLike(text) || NUMERIC_ID_PATTERN.test(text));
};

export const containsUuidToken = (value: unknown): boolean => {
  const text = cleanText(value);
  return Boolean(text) && UUID_TOKEN_PATTERN.test(text);
};

export const humanizeEntityType = (rawType: unknown): string => {
  const normalized = cleanText(rawType).toLowerCase();
  if (!normalized) return 'Record';
  if (SINGULAR_ENTITY_LABELS[normalized]) return SINGULAR_ENTITY_LABELS[normalized];

  const compact = normalized.replace(/[_-]+/g, ' ').trim();
  if (!compact) return 'Record';
  if (compact.endsWith('ies') && compact.length > 3) {
    return compact.slice(0, -3).replace(/\b\w/g, (char) => char.toUpperCase()) + 'y';
  }
  const singular = compact.endsWith('s') && !compact.endsWith('ss') ? compact.slice(0, -1) : compact;
  return singular.replace(/\b\w/g, (char) => char.toUpperCase());
};

const composePersonName = (record: Record<string, unknown>): string => {
  const firstName = cleanText(record.first_name ?? record.firstName);
  const lastName = cleanText(record.last_name ?? record.lastName);
  return [firstName, lastName].filter(Boolean).join(' ').trim();
};

const getIdentifier = (record: Record<string, unknown>): string => {
  const candidates = [record.id, record.uuid, record.pk, record.guid];
  for (const candidate of candidates) {
    const text = cleanText(candidate);
    if (text) return text;
  }
  return '';
};

const getCandidateValues = (
  source: Record<string, unknown>,
  preferredKeys: string[]
): string[] => {
  const keys = Array.from(new Set([...preferredKeys, ...DEFAULT_CANDIDATE_KEYS]));
  const values = keys.map((key) => cleanText(source[key])).filter(Boolean);
  const personName = composePersonName(source);
  if (personName) values.unshift(personName);
  return values;
};

const formatIdentifierFallback = (
  identifier: string,
  entityType: string | undefined,
  fallbackStyle: 'id' | 'details'
): ResolvedEntityDisplay => {
  const entityLabel = humanizeEntityType(entityType);

  if (!identifier) {
    return {
      text: fallbackStyle === 'details' ? `${entityLabel} Details` : entityLabel,
      usedIdentifierFallback: true,
    };
  }

  if (fallbackStyle === 'details') {
    return {
      text: `${entityLabel} Details`,
      tooltip: `${entityLabel} ID: ${identifier}`,
      usedIdentifierFallback: true,
      identifier,
    };
  }

  if (NUMERIC_ID_PATTERN.test(identifier)) {
    return {
      text: `${entityLabel} #${identifier}`,
      tooltip: `${entityLabel} ID: ${identifier}`,
      usedIdentifierFallback: true,
      identifier,
    };
  }

  if (isUuidLike(identifier)) {
    const compact = identifier.slice(0, 8);
    return {
      text: `${entityLabel} ${compact}\u2026`,
      tooltip: `${entityLabel} ID: ${identifier}`,
      usedIdentifierFallback: true,
      identifier,
    };
  }

  return {
    text: `${entityLabel} ${identifier}`,
    tooltip: `${entityLabel} ID: ${identifier}`,
    usedIdentifierFallback: true,
    identifier,
  };
};

export const resolveEntityDisplay = (
  source: unknown,
  options: ResolveEntityDisplayOptions = {}
): ResolvedEntityDisplay => {
  const { entityType, preferredKeys = [], fallbackStyle = 'id' } = options;
  const record = asRecord(source);

  if (!record) {
    const text = cleanText(source);
    if (text && !isIdentifierLike(text) && !containsUuidToken(text)) {
      return { text, usedIdentifierFallback: false };
    }
    return formatIdentifierFallback(text, entityType, fallbackStyle);
  }

  const candidates = getCandidateValues(record, preferredKeys);
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (containsUuidToken(candidate)) continue;
    if (isIdentifierLike(candidate)) continue;
    return { text: candidate, tooltip: candidate, usedIdentifierFallback: false };
  }

  return formatIdentifierFallback(getIdentifier(record), entityType, fallbackStyle);
};

export const resolveRouteBreadcrumbLabel = (
  pathname: string,
  previousPathname?: string
): ResolvedEntityDisplay => {
  const segment = cleanText(pathname);
  if (!segment) {
    return { text: 'Details', usedIdentifierFallback: false };
  }

  if (!isIdentifierLike(segment) && !containsUuidToken(segment)) {
    const mapped = SINGULAR_ENTITY_LABELS[segment.toLowerCase()];
    if (mapped) {
      return { text: mapped.endsWith('s') ? mapped : mapped, usedIdentifierFallback: false };
    }

    const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    return { text: label, tooltip: label, usedIdentifierFallback: false };
  }

  const parentType = previousPathname ? humanizeEntityType(previousPathname) : 'Record';
  return formatIdentifierFallback(segment, parentType, 'details');
};
