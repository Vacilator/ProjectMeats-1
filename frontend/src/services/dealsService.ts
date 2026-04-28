import { businessApi } from './businessApi';
import type { DealDeskRow, DealStatus } from '../types/deals';

export interface DealDeskFilters {
  status?: DealStatus | 'all';
}

const normalizeListResponse = <T>(data: T[] | { results?: T[] } | undefined): T[] => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
};

export const dealsService = {
  async list(filters: DealDeskFilters = {}): Promise<DealDeskRow[]> {
    const params: Record<string, string> = {};
    if (filters.status && filters.status !== 'all') {
      params.status = filters.status;
    }

    const response = await businessApi.get<DealDeskRow[] | { results?: DealDeskRow[] }>('/deals/', {
      params,
    });

    return normalizeListResponse(response.data);
  },
};
