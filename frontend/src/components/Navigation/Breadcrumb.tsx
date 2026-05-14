import React, { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';

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
  singularLabel: string;
  apiPath: string;
  getDisplayName: (payload: Record<string, unknown>, id: string) => string | null;
};

const breadcrumbNameMap: { [key: string]: string } = {
  // Home/Workspace aliases
  '': 'Workspace',
  cockpit: 'Workspace',
  'command-center': 'Workspace',
  calls: 'Calls',
  'call-log': 'Calls',
  'my-trades': 'My Trades',
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
    singularLabel: 'Supplier',
    apiPath: 'suppliers',
    getDisplayName: (payload) => readString(payload.name),
  },
  customers: {
    singularLabel: 'Customer',
    apiPath: 'customers',
    getDisplayName: (payload) => readString(payload.name),
  },
  plants: {
    singularLabel: 'Plant',
    apiPath: 'plants',
    getDisplayName: (payload) => readString(payload.name) || readString(payload.plant_est_num),
  },
  locations: {
    singularLabel: 'Location',
    apiPath: 'locations',
    getDisplayName: (payload) => readString(payload.name),
  },
  contacts: {
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
    singularLabel: 'Carrier',
    apiPath: 'carriers',
    getDisplayName: (payload) => readString(payload.name),
  },
  products: {
    singularLabel: 'Product',
    apiPath: 'products',
    getDisplayName: (payload) =>
      readString(payload.name) || readString(payload.product_code) || readString(payload.description),
  },
  'purchase-orders': {
    singularLabel: 'Purchase Order',
    apiPath: 'purchase-orders',
    getDisplayName: (payload, id) =>
      readString(payload.order_number) || readString(payload.po_number) || fallbackEntityLabel('Purchase Order', id),
  },
  'sales-orders': {
    singularLabel: 'Sales Order',
    apiPath: 'sales-orders',
    getDisplayName: (payload, id) =>
      readString(payload.order_number) || readString(payload.sales_order_number) || fallbackEntityLabel('Sales Order', id),
  },
  invoices: {
    singularLabel: 'Invoice',
    apiPath: 'accounting/invoices',
    getDisplayName: (payload, id) =>
      readString(payload.invoice_number) || fallbackEntityLabel('Invoice', id),
  },
};

const Breadcrumb: React.FC = () => {
  const location = useLocation();

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

  // If at root, show nothing
  if (pathnames.length === 0) {
    return null;
  }

  // The last breadcrumb item is NOT rendered in the trail — it's handled by
  // each page's own EntityPageHeader component.
  const trailItems = breadcrumbItems.slice(0, -1);

  return (
    <BreadcrumbWrapper>
      <BreadcrumbContainer aria-label="Breadcrumb navigation">
        <BreadcrumbItem>
          <BreadcrumbLink to="/">Workspace</BreadcrumbLink>
          {trailItems.length > 0 && <Separator aria-hidden="true">/</Separator>}
        </BreadcrumbItem>
        {trailItems.map(({ routeTo, staticDisplayName, resolver, pathname }, index) => {
          const displayName =
            resolvedNameMap.get(routeTo) ||
            (resolver ? fallbackEntityLabel(resolver.singularLabel, pathname) : staticDisplayName);
          const isLastTrail = index === trailItems.length - 1;

          return (
            <BreadcrumbItem key={routeTo}>
              <BreadcrumbLink to={routeTo}>{displayName}</BreadcrumbLink>
              {!isLastTrail && <Separator aria-hidden="true">/</Separator>}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbContainer>
    </BreadcrumbWrapper>
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

const BreadcrumbWrapper = styled.div`
  padding: 16px 0 0;
`;

const BreadcrumbContainer = styled.nav`
  display: flex;
  align-items: center;
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

const Separator = styled.span`
  margin: 0 8px;
  color: rgb(var(--color-text-secondary, 108, 117, 125));
`;

export default Breadcrumb;
