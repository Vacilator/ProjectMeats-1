import { businessApi } from './businessApi';

type UnknownRecord = Record<string, unknown>;

const DEFAULT_COLOR_VAR = '--color-info';

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
};

const asOptionalString = (value: unknown): string | undefined => {
  const normalized = asString(value).trim();
  return normalized ? normalized : undefined;
};

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeLabels = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (isRecord(entry)) return asString(entry.text).trim();
      return '';
    })
    .filter(Boolean);
};

const normalizeMetadata = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {};

const SEARCH_TYPE_ALIASES: Record<string, string> = {
  carrier: 'carrier',
  carriers: 'carrier',
  contact: 'contact',
  contacts: 'contact',
  customer: 'customer',
  customers: 'customer',
  invoice: 'invoice',
  invoices: 'invoice',
  plant: 'plant',
  plants: 'plant',
  po: 'purchase_order',
  purchase_order: 'purchase_order',
  purchase_orders: 'purchase_order',
  product: 'product',
  products: 'product',
  so: 'sales_order',
  sales_order: 'sales_order',
  sales_orders: 'sales_order',
  supplier: 'supplier',
  suppliers: 'supplier',
};

const RANKED_TYPE_PARAMS: Record<string, string> = {
  contact: 'contact',
  customer: 'customer',
  product: 'product',
  purchase_order: 'po',
  sales_order: 'so',
  supplier: 'supplier',
};

const SEARCH_TYPE_ROUTES: Record<string, string> = {
  carrier: '/carriers',
  contact: '/contacts',
  customer: '/customers',
  invoice: '/accounting/invoices',
  plant: '/plants',
  product: '/products',
  purchase_order: '/purchase-orders',
  sales_order: '/sales-orders',
  supplier: '/suppliers',
};

const SEARCH_TYPE_ICONS: Record<string, string> = {
  carrier: 'Truck',
  contact: 'User',
  customer: 'Users',
  invoice: 'Receipt',
  plant: 'Factory',
  product: 'Package',
  purchase_order: 'Package',
  sales_order: 'FileText',
  supplier: 'Building2',
};

const COLOR_TOKEN_MAP: Record<string, string> = {
  error: '--color-error',
  info: '--color-info',
  primary: '--color-primary',
  success: '--color-success',
  warning: '--color-warning',
};

const TYPE_COLOR_MAP: Record<string, string> = {
  carrier: '--color-warning',
  contact: '--color-info',
  customer: '--color-info',
  invoice: '--color-error',
  plant: '--color-primary',
  product: '--color-success',
  purchase_order: '--color-success',
  sales_order: '--color-warning',
  supplier: '--color-primary',
};

export interface SearchItem {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  icon: string;
  color?: string;
  colorVar: string;
  route: string;
  score: number;
  labels: string[];
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  query: string;
  results: SearchItem[];
  counts: Record<string, number>;
  total: number;
  message?: string;
}

export interface RankedSearchOptions {
  query: string;
  dateRange?: string;
  entityTypes?: string[];
  limit?: number;
}

export interface UniversalSearchOptions {
  query: string;
  entityTypes?: string[];
  limit?: number;
}

const getDefaultIcon = (type: string): string =>
  SEARCH_TYPE_ICONS[normalizeSearchType(type)] ?? 'File';

const getDefaultRoute = (type: string, id: string): string => {
  const canonicalType = normalizeSearchType(type);
  const baseRoute = SEARCH_TYPE_ROUTES[canonicalType] ?? `/${canonicalType}s`;
  return id ? `${baseRoute}/${id}` : baseRoute;
};

const toColorVar = (value: unknown): string | undefined => {
  const normalized = asString(value).trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.startsWith('--color-')) return normalized;
  return COLOR_TOKEN_MAP[normalized];
};

export const normalizeSearchType = (value: unknown): string => {
  const normalized = asString(value).trim().toLowerCase();
  if (!normalized) return 'unknown';
  return SEARCH_TYPE_ALIASES[normalized] ?? normalized;
};

export const getSearchColorVar = (value: {
  type: string;
  colorVar?: unknown;
  color?: unknown;
  metadata?: Record<string, unknown>;
}): string => {
  const explicit =
    toColorVar(value.colorVar) ??
    toColorVar(value.color) ??
    toColorVar(value.metadata?.color);

  return explicit ?? TYPE_COLOR_MAP[normalizeSearchType(value.type)] ?? DEFAULT_COLOR_VAR;
};

export const normalizeSearchItem = (value: unknown): SearchItem => {
  const record = isRecord(value) ? value : {};
  const metadata = normalizeMetadata(record.metadata);
  const id = asString(record.id).trim();
  const type = normalizeSearchType(record.type ?? record.entity_type);

  return {
    id,
    type,
    title:
      asOptionalString(record.title) ??
      asOptionalString(record.name) ??
      asOptionalString(record.label) ??
      'Unnamed',
    subtitle:
      asOptionalString(record.subtitle) ??
      asOptionalString(record.description),
    icon: asOptionalString(record.icon) ?? getDefaultIcon(type),
    color: asOptionalString(record.color) ?? asOptionalString(metadata.color),
    colorVar: getSearchColorVar({
      type,
      colorVar: record.colorVar,
      color: record.color,
      metadata,
    }),
    route: asOptionalString(record.route) ?? getDefaultRoute(type, id),
    score: asNumber(record.score) ?? 0,
    labels: normalizeLabels(record.labels),
    metadata,
  };
};

export const normalizeSearchResults = (value: unknown): SearchItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeSearchItem)
    .filter((item) => item.id && item.type !== 'unknown');
};

const normalizeCounts = (value: unknown, results: SearchItem[]): Record<string, number> => {
  if (isRecord(value)) {
    return Object.entries(value).reduce<Record<string, number>>((acc, [key, raw]) => {
      const type = normalizeSearchType(key);
      const parsed = asNumber(raw) ?? 0;
      acc[type] = (acc[type] ?? 0) + parsed;
      return acc;
    }, {});
  }

  return results.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1;
    return acc;
  }, {});
};

const normalizeSearchResponse = (value: unknown, fallbackQuery: string): SearchResponse => {
  const record = isRecord(value) ? value : {};
  const results = normalizeSearchResults(record.results);

  return {
    query: asOptionalString(record.query) ?? fallbackQuery,
    results,
    counts: normalizeCounts(record.counts, results),
    total: asNumber(record.total) ?? results.length,
    message: asOptionalString(record.message),
  };
};

export const groupSearchResultsByType = (
  results: SearchItem[],
): Record<string, SearchItem[]> =>
  results.reduce<Record<string, SearchItem[]>>((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {});

export const searchRanked = async ({
  query,
  dateRange = 'all',
  entityTypes,
  limit = 8,
}: RankedSearchOptions): Promise<SearchResponse> => {
  const response = await businessApi.get('/system/search/ranked/', {
    params: {
      q: query,
      date_range: dateRange,
      limit,
      ...(entityTypes && entityTypes.length > 0
        ? {
            entity_types: entityTypes
              .map((type) => RANKED_TYPE_PARAMS[normalizeSearchType(type)] ?? normalizeSearchType(type))
              .join(','),
          }
        : {}),
    },
  });

  return normalizeSearchResponse(response.data, query);
};

export const searchUniversal = async ({
  query,
  entityTypes,
  limit = 5,
}: UniversalSearchOptions): Promise<SearchResponse> => {
  const response = await businessApi.get('/search/universal/', {
    params: {
      q: query,
      limit,
      ...(entityTypes && entityTypes.length > 0
        ? { types: entityTypes.map((type) => normalizeSearchType(type)).join(',') }
        : {}),
    },
  });

  return normalizeSearchResponse(response.data, query);
};

export const searchContinuous = async ({
  query,
  entityType,
  limit = 20,
}: {
  query: string;
  entityType: string;
  limit?: number;
}): Promise<SearchItem[]> => {
  const response = await searchUniversal({
    query,
    entityTypes: [entityType],
    limit,
  });

  return response.results;
};

export const getRecentItems = async (limit = 10): Promise<SearchItem[]> => {
  const response = await businessApi.get('/search/recent/', {
    params: { limit },
  });
  const data = isRecord(response.data) ? response.data : {};
  return normalizeSearchResults(data.items);
};

export const trackRecentItem = async ({
  type,
  id,
  title,
}: {
  type: string;
  id: string | number;
  title: string;
}): Promise<void> => {
  await businessApi.post('/search/recent/', {
    entity_type: normalizeSearchType(type),
    entity_id: id,
    title,
  });
};

export const searchService = {
  getRecentItems,
  groupSearchResultsByType,
  normalizeSearchItem,
  normalizeSearchType,
  searchContinuous,
  searchRanked,
  searchUniversal,
  trackRecentItem,
};
