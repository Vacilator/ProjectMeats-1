/**
 * Cached Query Hook (Phase 8.1: Redis Query Caching)
 * 
 * React hook for cached API queries with Redis backend.
 */
import { useState, useEffect, useCallback } from 'react';
import { businessApi } from '@/services/businessApi';

interface CacheOptions {
  ttl?: number;
  forceRefresh?: boolean;
}

/**
 * Hook for cached API queries.
 * 
 * Automatically caches results server-side via Redis.
 */
export const useCachedQuery = <T>(
  endpoint: string,
  options: CacheOptions = {}
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const params: any = {};
      if (forceRefresh) {
        params.cache = 'refresh';
      }
      if (options.ttl) {
        params.ttl = options.ttl;
      }

      const response = await businessApi.get(endpoint, { params });
      setData(response.data);
    } catch (err: unknown) {
      const message = (err && typeof err === 'object' && 'message' in err) ? String((err as Record<string, unknown>).message) : 'Failed to fetch data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, options.ttl]);

  useEffect(() => {
    fetchData(options.forceRefresh);
  }, [fetchData, options.forceRefresh]);

  const refresh = () => fetchData(true);

  return { data, loading, error, refresh };
};

/**
 * Hook for parallel cached queries.
 * 
 * Executes multiple queries in parallel with caching.
 */
export const useParallelCachedQueries = <T>(endpoints: string[]) => {
  const [data, setData] = useState<Record<string, T>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      try {
        const promises = endpoints.map(endpoint =>
          businessApi.get(endpoint).then(res => ({ endpoint, data: res.data }))
        );

        const results = await Promise.all(promises);
        
        const dataMap: Record<string, T> = {};
        results.forEach(({ endpoint, data }) => {
          dataMap[endpoint] = data;
        });

        setData(dataMap);
      } catch (err: unknown) {
        const message = (err && typeof err === 'object' && 'message' in err) ? String((err as Record<string, unknown>).message) : 'Failed to fetch data';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    if (endpoints.length > 0) {
      fetchAll();
    }
  }, [endpoints.join(',')]);

  return { data, loading, error };
};
