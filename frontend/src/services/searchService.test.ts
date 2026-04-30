import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getRecentItems,
  getSearchColorVar,
  groupSearchResultsByType,
  normalizeSearchItem,
  normalizeSearchType,
  searchContinuous,
  searchRanked,
  searchUniversal,
  trackRecentItem,
} from './searchService';
import { apiClient } from './apiService';

vi.mock('./apiService', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('searchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes alias entity types', () => {
    expect(normalizeSearchType('po')).toBe('purchase_order');
    expect(normalizeSearchType('customers')).toBe('customer');
    expect(normalizeSearchType('SO')).toBe('sales_order');
  });

  it('normalizes raw search items into the shared contract', () => {
    expect(
      normalizeSearchItem({
        id: 42,
        type: 'po',
        title: 'PO-42',
        metadata: { color: 'success' },
      })
    ).toMatchObject({
      id: '42',
      type: 'purchase_order',
      title: 'PO-42',
      route: '/purchase-orders/42',
      colorVar: '--color-success',
    });
  });

  it('groups normalized search items by canonical type', () => {
    const grouped = groupSearchResultsByType([
      normalizeSearchItem({ id: 1, type: 'supplier', title: 'A' }),
      normalizeSearchItem({ id: 2, type: 'suppliers', title: 'B' }),
    ]);

    expect(Object.keys(grouped)).toEqual(['supplier']);
    expect(grouped.supplier).toHaveLength(2);
  });

  it('requests ranked search and normalizes aliased types and counts', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        query: 'po',
        total: 1,
        counts: { po: 1 },
        results: [{ id: 3, type: 'po', title: 'PO-3', score: 88 }],
      },
    });

    const response = await searchRanked({ query: 'po', entityTypes: ['purchase_order'], limit: 8 });

    expect(apiClient.get).toHaveBeenCalledWith('system/search/ranked/', {
      params: {
        q: 'po',
        date_range: 'all',
        limit: 8,
        entity_types: 'po',
      },
    });
    expect(response.counts).toEqual({ purchase_order: 1 });
    expect(response.results[0]).toMatchObject({ type: 'purchase_order', title: 'PO-3' });
  });

  it('uses universal search for continuous results', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        query: 'ac',
        total: 1,
        counts: { customer: 1 },
        results: [{ id: 7, type: 'customer', title: 'Acme' }],
      },
    });

    const results = await searchContinuous({ query: 'ac', entityType: 'customers' });

    expect(apiClient.get).toHaveBeenCalledWith('search/universal/', {
      params: {
        q: 'ac',
        limit: 20,
        types: 'customer',
      },
    });
    expect(results[0]).toMatchObject({ id: '7', type: 'customer', title: 'Acme' });
  });

  it('normalizes recent items and tracks canonical recent entity types', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        items: [{ id: 5, type: 'so', title: 'SO-5' }],
      },
    });

    const items = await getRecentItems(3);
    await trackRecentItem({ type: 'so', id: '5', title: 'SO-5' });

    expect(items[0]).toMatchObject({ type: 'sales_order', route: '/sales-orders/5' });
    expect(apiClient.post).toHaveBeenCalledWith('search/recent/', {
      entity_type: 'sales_order',
      entity_id: '5',
      title: 'SO-5',
    });
  });

  it('prefers explicit color vars and metadata colors when present', () => {
    expect(getSearchColorVar({ type: 'supplier', colorVar: '--color-info' })).toBe('--color-info');
    expect(getSearchColorVar({ type: 'supplier', metadata: { color: 'warning' } })).toBe('--color-warning');
  });

  it('normalizes universal search responses', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        query: 'acme',
        total: 1,
        counts: { suppliers: 1 },
        results: [{ id: 1, type: 'suppliers', name: 'Acme Meats' }],
      },
    });

    const response = await searchUniversal({ query: 'acme', entityTypes: ['suppliers'], limit: 5 });

    expect(response.counts).toEqual({ supplier: 1 });
    expect(response.results[0]).toMatchObject({ type: 'supplier', title: 'Acme Meats' });
  });
});
