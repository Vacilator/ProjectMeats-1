/**
 * Hook to resolve entity display names for breadcrumb navigation.
 *
 * Extracted from Breadcrumb.tsx to keep query logic in a dedicated hook.
 * Fetches entity details (supplier name, PO number, etc.) from the API
 * based on URL path segments that look like entity identifiers.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { logger } from '@/utils/logger';

type BreadcrumbResolver = {
  singularLabel: string;
  apiPath: string;
  getDisplayName: (payload: Record<string, unknown>, id: string) => string | null;
};

type ResolvableItem = {
  pathname: string;
  routeTo: string;
  resolver: BreadcrumbResolver;
};

function fallbackEntityLabel(singularLabel: string, id: string): string {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return `${singularLabel} Details`;

  if (/^\d+$/.test(normalizedId) && normalizedId.length <= 6) {
    return `${singularLabel} ${normalizedId}`;
  }

  return `${singularLabel} Details`;
}

/**
 * Resolves entity display names for breadcrumb items that have a resolver.
 * Returns a Map<routeTo, displayName> for resolved entities.
 *
 * Uses a single useQuery with Promise.all to batch-resolve all entity names
 * in one render cycle, keyed by the combined set of resolvable segments.
 */
export function useBreadcrumbNames(
  items: Array<{
    pathname: string;
    routeTo: string;
    resolver?: BreadcrumbResolver;
  }>
): Map<string, string> {
  const resolvableItems = useMemo(
    () =>
      items.filter(
        (item): item is ResolvableItem & typeof item => !!item.resolver
      ),
    [items]
  );

  // Stable cache key from the set of items to resolve
  const cacheKey = useMemo(
    () => resolvableItems.map((i) => `${i.resolver.apiPath}/${i.pathname}`).join('|'),
    [resolvableItems]
  );

  const { data: resolvedEntries } = useQuery({
    queryKey: withTenantQueryKey('breadcrumb-names', cacheKey),
    queryFn: async () => {
      if (resolvableItems.length === 0) return [] as Array<[string, string]>;

      const results = await Promise.all(
        resolvableItems.map(async (item) => {
          try {
            const response = await businessApi.get(
              `${item.resolver.apiPath}/${item.pathname}/`
            );
            const payload =
              response?.data && typeof response.data === 'object'
                ? (response.data as Record<string, unknown>)
                : null;

            const displayName = payload
              ? item.resolver.getDisplayName(payload, item.pathname) ||
                fallbackEntityLabel(item.resolver.singularLabel, item.pathname)
              : fallbackEntityLabel(item.resolver.singularLabel, item.pathname);

            return [item.routeTo, displayName] as [string, string];
          } catch (err) {
            logger.debug('Breadcrumb name resolution failed', { err, pathname: item.pathname });
            return [
              item.routeTo,
              fallbackEntityLabel(item.resolver.singularLabel, item.pathname),
            ] as [string, string];
          }
        })
      );
      return results;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: resolvableItems.length > 0,
  });

  return useMemo(() => {
    if (!resolvedEntries) return new Map<string, string>();
    return new Map(resolvedEntries);
  }, [resolvedEntries]);
}

export { fallbackEntityLabel };
export type { BreadcrumbResolver };
