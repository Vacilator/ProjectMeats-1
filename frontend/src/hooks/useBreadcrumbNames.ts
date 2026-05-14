/**
 * Hook to resolve entity display names for breadcrumb navigation.
 *
 * Extracted from Breadcrumb.tsx to keep query logic in a dedicated hook.
 * Fetches entity details (supplier name, PO number, etc.) from the API
 * based on URL path segments that look like entity identifiers.
 */
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';

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

  const resolvedNameQueries = useMemo(
    () =>
      resolvableItems.map((item) => ({
        queryKey: withTenantQueryKey(
          'breadcrumb-name',
          item.resolver.apiPath,
          item.pathname
        ),
        queryFn: async () => {
          const response = await businessApi.get(
            `${item.resolver.apiPath}/${item.pathname}/`
          );
          const payload =
            response?.data && typeof response.data === 'object'
              ? (response.data as Record<string, unknown>)
              : null;

          if (!payload) {
            return fallbackEntityLabel(item.resolver.singularLabel, item.pathname);
          }

          return (
            item.resolver.getDisplayName(payload, item.pathname) ||
            fallbackEntityLabel(item.resolver.singularLabel, item.pathname)
          );
        },
        staleTime: 5 * 60 * 1000,
        retry: 1,
      })),
    [resolvableItems]
  );

  const resolvedNames = useQueries({
    queries: resolvedNameQueries,
  });

  return useMemo(() => {
    const next = new Map<string, string>();
    resolvableItems.forEach((item, index) => {
      const query = resolvedNames[index];
      if (query?.data) {
        next.set(item.routeTo, query.data);
      }
    });
    return next;
  }, [resolvableItems, resolvedNames]);
}

export { fallbackEntityLabel };
export type { BreadcrumbResolver };
