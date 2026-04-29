import { apiClient } from './apiService';

export interface SearchItem {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  route: string;
  icon?: string;
  score?: number;
  labels: string[];
  metadata: Record<string, unknown>;
  colorVar: string;
}

export interface SearchResponse {
  query: string;
  results: SearchItem[];
  counts: Record<string, number>;
  total: number;
}

interface RawSearchItem {
  id?: string | number;
  type?: string;
  entity_type?: string;
  title?: string;
  name?: string;
  label?: string;
  subtitle?: string;
  route?: string;
  icon?: string;
  score?: string | number;
  labels?: unknown;
  color?: unknown;
  colorVar?: unknown;
  metadata?: Record<string, unknown> | null;
}

interface RawSearchResponse {
  query?: string;
  results?: RawSearchItem[];
  counts?: Record<string, unknown>;
  total?: string | number;
}

export interface RankedSearchParams {
  query: string;
  dateRange?: string;
  entityTypes?: string[];
  limit?: number;
}

export interface UniversalSearchParams {
  query: string;
  entityTypes?: string[];
  limit?: number;
}

export interface RecentSearchItemPayload {
  type: string;
  id: string | number;
  title: string;
}

const DEFAULT_RESULT_COLOR_VAR = '--color-primary';

const TYPE_ALIASES: Record<string, string> = {
  customer: 'customer',
  customers: 'customer',
  supplier: 'supplier',
  suppliers: 'supplier',
  product: 'product',
  products: 'product',
  contact: 'contact',
  contacts: 'contact',
  po: 'purchase_order',
  purchase_order: 'purchase_order',
  'purchase-order': 'purchase_order',
  purchase_orders: 'purchase_order',
  'purchase-orders': 'purchase_order',
  so: 'sales_order',
  sales_order: 'sales_order',
  'sales-order': 'sales_order',
  sales_orders: 'sales_order',
  'sales-orders': 'sales_order',
  invoice: 'invoice',
  invoices: 'invoice',
  plant: 'plant',
  plants: 'plant',
  carrier: 'carrier',
  carriers: 'carrier',
};

const extractColorVar = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();

  if (normalized.startsWith('--color-')) return normalized;
  if (/^(primary|info|success|warning|error)$/.test(normalized)) return `--color-${normalized}`;

  const colorVarMatch = normalized.match(/var\(--(color-[a-z0-9-]+)\)/i);
  if (colorVarMatch?.[1]) {
    return `--${colorVarMatch[1]}`;
  }

  return null;
};

export const normalizeSearchType = (value: unknown): string => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return TYPE_ALIASES[normalized] ?? normalized;
};

export const getSearchColorVar = (item: {
  type?: unknown;
  color?: unknown;
  colorVar?: unknown;
  metadata?: Record<string, unknown> | null;
}): string => {
  const normalizedType = normalizeSearchType(item.type);

  return (
    extractColorVar(item.colorVar) ??
    extractColorVar(item.color) ??
    extractColorVar(item.metadata?.color) ??
    ({
      purchase_order: '--color-info',
      sales_order: '--color-success',
      customer: '--color-warning',
      supplier: '--color-primary',
      product: '--color-warning',
      contact: '--color-success',
    }[normalizedType] ?? DEFAULT_RESULT_COLOR_VAR)
  );
};

const normalizeSearchLabels = (labels: unknown): string[] => {
  if (!Array.isArray(labels)) return [];

  return labels
    .map((label) => {
      if (typeof label === 'string') return label;
      if (label && typeof label === 'object' && 'text' in label && typeof label.text === 'string') {
        return label.text;
      }
      return null;
    })
    .filter((label): label is string => Boolean(label));
};

const buildDefaultRoute = (type: string, id: string): string => {
  switch (type) {
    case 'customer':
      return `/customers/${id}`;
    case 'supplier':
      return `/suppliers/${id}`;
    case 'product':
      return `/products/${id}`;
    case 'contact':
      return `/contacts/${id}`;
    case 'purchase_order':
      return `/purchase-orders/${id}`;
    case 'sales_order':
      return `/sales-orders/${id}`;
    case 'plant':
      return `/plants/${id}`;
    case 'carrier':
      return `/carriers/${id}`;
    case 'invoice':
      return `/invoices/${id}`;
    default:
      return `/${type}s/${id}`;
  }
};

export const normalizeSearchItem = (item: RawSearchItem): SearchItem => {
  const id = String(item.id ?? '');
  const type = normalizeSearchType(item.type ?? item.entity_type);
  const metadata = item.metadata ?? {};
  const title = String(item.title ?? item.name ?? item.label ?? `${type} ${id}`).trim();
  const numericScore = Number(item.score);

  return {
    id,
    type,
    title: title || `${type} ${id}`,
    subtitle: item.subtitle ? String(item.subtitle) : '',
    route: item.route ? String(item.route) : buildDefaultRoute(type, id),
    icon: item.icon ? String(item.icon) : undefined,
    score: Number.isFinite(numericScore) ? numericScore : undefined,
    labels: normalizeSearchLabels(item.labels),
    metadata,
    colorVar: getSearchColorVar(item),
  };
};

const normalizeCounts = (counts: Record<string, unknown> | undefined): Record<string, number> => {
  if (!counts || typeof counts !== "object") {
    return {};
  }

  return Object.entries(counts).reduce<Record<string, number>>((acc, [rawType, rawCount]) => {
    const normalizedType = normalizeSearchType(rawType);
    const count = Number(rawCount ?? 0);
    acc[normalizedType] = (acc[normalizedType] ?? 0) + (Number.isFinite(count) ? count : 0);
    return acc;
  }, {});
};

const normalizeSearchResponse = (response: RawSearchResponse): SearchResponse => {
  const results = Array.isArray(response.results) ? response.results.map(normalizeSearchItem) : [];
  const total = Number(response.total ?? results.length);

  return {
    query: String(response.query ?? ''),
    results,
    counts: normalizeCounts(response.counts),
    total: Number.isFinite(total) ? total : results.length,
  };
};

const encodeRankedEntityType = (value: string): string => {
  const normalized = normalizeSearchType(value);
  if (normalized === 'purchase_order') return 'po';
  if (normalized === 'sales_order') return 'so';
  return normalized;
};

export const groupSearchResultsByType = (results: SearchItem[]): Record<string, SearchItem[]> => {
  return results.reduce<Record<string, SearchItem[]>>((acc, item) => {
    if (!acc[item.type]) {
      acc[item.type] = [];
    }
    acc[item.type].push(item);
    return acc;
  }, {});
};

export const searchRanked = async ({
  query,
  dateRange = 'all',
  entityTypes,
  limit = 8,
}: RankedSearchParams): Promise<SearchResponse> => {
  const response = await apiClient.get<RawSearchResponse>('system/search/ranked/', {
    params: {
      q: query,
      date_range: dateRange,
      limit,
      entity_types: entityTypes?.map(encodeRankedEntityType).join(',') || undefined,
    },
  });

  return normalizeSearchResponse(response.data);
};

export const searchUniversal = async ({
  query,
  entityTypes,
  limit = 5,
}: UniversalSearchParams): Promise<SearchResponse> => {
  const response = await apiClient.get<RawSearchResponse>('search/universal/', {
    params: {
      q: query,
      limit,
      types: entityTypes?.map(normalizeSearchType).join(',') || undefined,
    },
  });

  return normalizeSearchResponse(response.data);
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
    limit,
    entityTypes: [entityType],
  });

  return response.results;
};

export const getRecentItems = async (limit = 5): Promise<SearchItem[]> => {
  const response = await apiClient.get<{ items?: RawSearchItem[] }>('search/recent/', {
    params: { limit },
  });

  return Array.isArray(response.data.items) ? response.data.items.map(normalizeSearchItem) : [];
};

export const trackRecentItem = async ({ type, id, title }: RecentSearchItemPayload): Promise<void> => {
  await apiClient.post('search/recent/', {
    entity_type: normalizeSearchType(type),
    entity_id: id,
    title,
  });
};
