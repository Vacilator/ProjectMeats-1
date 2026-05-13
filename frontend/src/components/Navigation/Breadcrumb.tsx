import React, { useEffect, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';

import { useNavigation } from '@/contexts/NavigationContext';
import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';

/**
 * Context-aware Breadcrumb Component
 * 
 * Updated: 2026-02-04 - Phase 1 Cockpit & WorkForms Enhancement
 * - Removed hardcoded "Dashboard" root
 * - Uses first path segment as root (context-aware)
 * - Added comprehensive breadcrumb name mapping
 * - Uses design system colors
 */

type BreadcrumbResolver = {
  entityType: string;
  singularLabel: string;
  apiPath: string;
  getDisplayName: (payload: Record<string, unknown>, id: string) => string | null;
};

const breadcrumbNameMap: { [key: string]: string } = {
  // Workspace section
  cockpit: 'Cockpit',
  workspace: 'Cockpit', // Legacy redirect
  calls: 'Calls',
  'call-log': 'Calls',
  reports: 'Reports',

  // WorkForms section
  workforms: 'WorkForms',
  'forms-flows': 'WorkForms', // Legacy redirect
  tasks: 'My Tasks',
  'in-progress': 'In Progress',
  catalog: 'Catalog',
  history: 'History',

  // Core entities
  suppliers: 'Suppliers',
  customers: 'Customers',
  'purchase-orders': 'Purchase Orders',
  'sales-orders': 'Sales Orders',
  'accounts-receivables': 'Accounts Receivables',
  contacts: 'Contacts',
  plants: 'Plants',
  products: 'Products',
  locations: 'Locations',
  carriers: 'Carriers',
  'cold-storage': 'Cold Storage',

  // Orders section
  inquiries: 'Inquiries',
  fulfillments: 'Fulfillments',
  templates: 'Templates',
  analytics: 'Analytics',
  attachments: 'Attachments',

  // Accounting section
  accounting: 'Accounting',
  payables: 'Payables',
  receivables: 'Receivables',
  claims: 'Claims',
  pos: "P.O.'s",
  sos: "S.O.'s",
  invoices: 'Invoices',

  // Admin & Settings
  admin: 'Admin',
  'option-lists': 'Option Lists',
  settings: 'Settings',
  notifications: 'Notifications',
  profile: 'Profile',

  // AI & Tools
  'ai-assistant': 'AI Assistant',

  // Workflows (legacy)
  workflows: 'Workflows',
  monitor: 'Monitor',
  run: 'Run',
  details: 'Details',

  // My items
  'my-submissions': 'My Submissions',
  'my-tasks': 'My Tasks',
};

const UUID_SEGMENT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const resolverMap: Record<string, BreadcrumbResolver> = {
  suppliers: {
    entityType: 'supplier',
    singularLabel: 'Supplier',
    apiPath: 'suppliers',
    getDisplayName: (payload) => readString(payload.name),
  },
  customers: {
    entityType: 'customer',
    singularLabel: 'Customer',
    apiPath: 'customers',
    getDisplayName: (payload) => readString(payload.name),
  },
  plants: {
    entityType: 'plant',
    singularLabel: 'Plant',
    apiPath: 'plants',
    getDisplayName: (payload) => readString(payload.name) || readString(payload.plant_est_num),
  },
  locations: {
    entityType: 'location',
    singularLabel: 'Location',
    apiPath: 'locations',
    getDisplayName: (payload) => readString(payload.name),
  },
  contacts: {
    entityType: 'contact',
    singularLabel: 'Contact',
    apiPath: 'contacts',
    getDisplayName: (payload) => {
      const fullName = [readString(payload.first_name), readString(payload.last_name)]
        .filter(Boolean)
        .join(' ')
        .trim();
      return fullName || readString(payload.name) || readString(payload.email);
    },
  },
  carriers: {
    entityType: 'carrier',
    singularLabel: 'Carrier',
    apiPath: 'carriers',
    getDisplayName: (payload) => readString(payload.name),
  },
  products: {
    entityType: 'product',
    singularLabel: 'Product',
    apiPath: 'products',
    getDisplayName: (payload) =>
      readString(payload.name) || readString(payload.product_code) || readString(payload.description),
  },
  'purchase-orders': {
    entityType: 'purchase_order',
    singularLabel: 'Purchase Order',
    apiPath: 'purchase-orders',
    getDisplayName: (payload, id) =>
      readString(payload.order_number) || readString(payload.po_number) || fallbackEntityLabel('Purchase Order', id),
  },
  'sales-orders': {
    entityType: 'sales_order',
    singularLabel: 'Sales Order',
    apiPath: 'sales-orders',
    getDisplayName: (payload, id) =>
      readString(payload.order_number) || readString(payload.sales_order_number) || fallbackEntityLabel('Sales Order', id),
  },
  invoices: {
    entityType: 'invoice',
    singularLabel: 'Invoice',
    apiPath: 'accounting/invoices',
    getDisplayName: (payload, id) =>
      readString(payload.invoice_number) || fallbackEntityLabel('Invoice', id),
  },
};

const Breadcrumb: React.FC = () => {
  const location = useLocation();
  const { setBreadcrumbPath, setHierarchyStack } = useNavigation();

  // Create breadcrumb items from current path
  const pathnames = useMemo(() => location.pathname.split('/').filter((x) => x), [location.pathname]);

  const breadcrumbItems = useMemo(
    () =>
      pathnames.map((pathname, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const previousSegment = index > 0 ? pathnames[index - 1] : null;
        const resolver =
          previousSegment && !breadcrumbNameMap[pathname] && isLikelyEntityIdentifier(pathname)
            ? resolverMap[previousSegment]
            : undefined;

        return {
          pathname,
          routeTo,
          isLast: index === pathnames.length - 1,
          resolver,
          staticDisplayName:
            breadcrumbNameMap[pathname] ||
            pathname.charAt(0).toUpperCase() + pathname.slice(1).replace(/-/g, ' '),
        };
      }),
    [pathnames]
  );

  const resolvableItems = useMemo(
    () => breadcrumbItems.filter((item) => item.resolver),
    [breadcrumbItems]
  );

  const resolvedNameQueries = useMemo(
    () =>
      resolvableItems.map((item) => ({
        queryKey: withTenantQueryKey('breadcrumb-name', item.resolver?.apiPath, item.pathname),
        queryFn: async () => {
          if (!item.resolver) return null;
          const response = await businessApi.get(`${item.resolver.apiPath}/${item.pathname}/`);
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

  const resolvedNameMap = useMemo(() => {
    const next = new Map<string, string>();

    resolvableItems.forEach((item, index) => {
      const query = resolvedNames[index];
      if (query?.data) {
        next.set(item.routeTo, query.data);
      }
    });

    return next;
  }, [resolvableItems, resolvedNames]);

  const breadcrumbDisplayItems = useMemo(
    () =>
      breadcrumbItems.map(({ routeTo, staticDisplayName, resolver, pathname }) => ({
        routeTo,
        pathname,
        resolver,
        displayName:
          resolvedNameMap.get(routeTo) ||
          (resolver ? fallbackEntityLabel(resolver.singularLabel, pathname) : staticDisplayName),
      })),
    [breadcrumbItems, resolvedNameMap]
  );

  const hierarchyStack = useMemo(
    () =>
      breadcrumbDisplayItems
        .filter((item) => item.resolver)
        .map((item) => ({
          entityType: item.resolver!.entityType,
          entityId: item.pathname,
          label: item.displayName,
          routeTo: item.routeTo,
        })),
    [breadcrumbDisplayItems]
  );

  useEffect(() => {
    setBreadcrumbPath(breadcrumbDisplayItems.map((item) => item.displayName));
    setHierarchyStack(hierarchyStack);
  }, [breadcrumbDisplayItems, hierarchyStack, setBreadcrumbPath, setHierarchyStack]);

  // If at root, show nothing (user knows where they are)
  if (pathnames.length === 0) {
    return null;
  }

  return (
    <BreadcrumbContainer aria-label="Breadcrumb navigation">
      {breadcrumbDisplayItems.map(({ routeTo, displayName }, index) => {
        const isLast = index === breadcrumbDisplayItems.length - 1;
        return (
          <BreadcrumbItem key={routeTo}>
            {isLast ? (
              <BreadcrumbText aria-current="page">
                {displayName}
              </BreadcrumbText>
            ) : (
              <>
                <BreadcrumbLink to={routeTo}>
                  {displayName}
                </BreadcrumbLink>
                <Separator aria-hidden="true">/</Separator>
              </>
            )}
          </BreadcrumbItem>
        );
      })}
    </BreadcrumbContainer>
  );
};

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const fallbackEntityLabel = (entityLabel: string, id: string): string => {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return `${entityLabel} Details`;

  if (/^\d+$/.test(normalizedId) && normalizedId.length <= 6) {
    return `${entityLabel} ${normalizedId}`;
  }

  return `${entityLabel} Details`;
};

const isLikelyEntityIdentifier = (segment: string): boolean => {
  const normalized = String(segment || '').trim();
  if (!normalized) return false;

  return /^\d+$/.test(normalized) || UUID_SEGMENT_PATTERN.test(normalized) || normalized.toLowerCase().includes('uuid');
};

const BreadcrumbContainer = styled.nav`
  display: flex;
  align-items: center;
  padding: 16px 0;
  font-size: 14px;
  flex-wrap: wrap;
  gap: 4px;
`;

const BreadcrumbItem = styled.div`
  display: flex;
  align-items: center;
`;

const BreadcrumbLink = styled(Link)`
  color: rgb(var(--color-text-secondary, 108, 117, 125));
  text-decoration: none;
  transition: color 0.2s;

  &:hover {
    color: rgb(var(--color-text-primary, 73, 80, 87));
    text-decoration: underline;
  }
  
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary, 102, 126, 234));
    outline-offset: 2px;
    border-radius: 2px;
  }
`;

const BreadcrumbText = styled.span`
  color: rgb(var(--color-text-primary, 73, 80, 87));
  font-weight: 500;
`;

const Separator = styled.span`
  margin: 0 8px;
  color: rgb(var(--color-text-secondary, 108, 117, 125));
`;

export default Breadcrumb;
