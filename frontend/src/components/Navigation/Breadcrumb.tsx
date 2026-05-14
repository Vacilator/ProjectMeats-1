import React, { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';

import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';

/**
 * Context-aware Breadcrumb Component
 *
 * Updated: 2026-05-14 — Hierarchical breadcrumb rework
 *
 * Rules:
 * 1. "Workspace" appears as the first breadcrumb ONLY when:
 *    a. The path starts with /workspace/ (workspace admin child page)
 *    b. Navigation was initiated from the search bar (?ref=search)
 * 2. Otherwise, breadcrumbs build naturally from the URL path hierarchy:
 *    Parent / Parent Display Name / Child / Child Display Name / ...
 * 3. The LAST breadcrumb is NEVER shown in the trail — it becomes the
 *    page header (rendered by each page's EntityPageHeader or equivalent).
 * 4. Single-segment top-level pages (e.g. /suppliers) show no trail at all.
 *
 * Special cases:
 * - /records/:entityType/:id → maps entityType to a parent list link
 * - /accounting/... → preserves full accounting hierarchy
 */

type BreadcrumbResolver = {
  singularLabel: string;
  apiPath: string;
  getDisplayName: (payload: Record<string, unknown>, id: string) => string | null;
};

const breadcrumbNameMap: { [key: string]: string } = {
  // Home/Workspace aliases
  '': 'Workspace',
  workspace: 'Workspace',
  cockpit: 'Workspace',
  'command-center': 'Workspace',
  calls: 'Calls',
  'call-log': 'Calls',
  'my-trades': 'My Trades',
  reports: 'Reports',

  // WorkForms section
  workforms: 'WorkForms',
  'forms-flows': 'WorkForms',
  tasks: 'My Tasks',
  'in-progress': 'In Progress',
  catalog: 'Catalog',
  history: 'History',
  monitoring: 'Monitoring',

  // Core entities
  suppliers: 'Suppliers',
  customers: 'Customers',
  'purchase-orders': 'Purchase Orders',
  'sales-orders': 'Sales Orders',
  'accounts-receivables': 'Accounts Receivable',
  contacts: 'Contacts',
  plants: 'Plants',
  products: 'Products',
  locations: 'Locations',
  carriers: 'Carriers',
  'cold-storage': 'Cold Storage',
  'freight-orders': 'Freight Orders',

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
  settlements: 'Settlements',

  // Admin & Settings
  admin: 'Admin',
  'option-lists': 'Option Lists',
  configurations: 'Configurations',
  customizations: 'Customizations',
  users: 'Users & Invitations',
  settings: 'Settings',
  notifications: 'Notifications',
  profile: 'Profile',
  billing: 'Billing',
  activity: 'Activity & Audit Logs',

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

  // Records route virtual segment
  records: 'Records',
};

/**
 * Maps entity type slugs used in /records/:entityType/:id to their
 * parent list breadcrumb: { label, path }.
 */
const RECORD_ENTITY_PARENT: Record<string, { label: string; path: string }> = {
  supplier: { label: 'Suppliers', path: '/suppliers' },
  customer: { label: 'Customers', path: '/customers' },
  purchase_order: { label: 'Purchase Orders', path: '/purchase-orders' },
  sales_order: { label: 'Sales Orders', path: '/sales-orders' },
  invoice: { label: 'Invoices', path: '/accounting/receivables/invoices' },
  carrier_purchase_order: { label: 'Freight Orders', path: '/freight-orders' },
  freight_order: { label: 'Freight Orders', path: '/freight-orders' },
  inquiry: { label: 'Inquiries', path: '/inquiries' },
  fulfillment: { label: 'Fulfillments', path: '/fulfillments' },
  claim: { label: 'Claims', path: '/accounting/payables/claims' },
  plant: { label: 'Plants', path: '/suppliers/plants' },
  location: { label: 'Locations', path: '/customers/locations' },
  contact: { label: 'Contacts', path: '/suppliers/contacts' },
  carrier: { label: 'Carriers', path: '/carriers' },
  product: { label: 'Products', path: '/products' },
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
  const [searchParams] = useSearchParams();

  const pathnames = useMemo(() => location.pathname.split('/').filter((x) => x), [location.pathname]);

  const isFromSearch = searchParams.get('ref') === 'search';
  const isWorkspacePath = pathnames[0] === 'workspace';
  const isRecordsPath = pathnames[0] === 'records';

  // Build the logical breadcrumb items.
  // For /records/:entityType/:id, synthesize a parent list crumb.
  const breadcrumbItems = useMemo(() => {
    if (isRecordsPath && pathnames.length >= 3) {
      const entityType = pathnames[1];
      const entityId = pathnames[2];
      const parent = RECORD_ENTITY_PARENT[entityType];

      // If we have a known parent, create:  ParentList / EntityId (page header)
      const items: BreadcrumbItemData[] = [];
      if (parent) {
        items.push({
          pathname: entityType,
          routeTo: parent.path,
          isLast: false,
          resolver: undefined,
          staticDisplayName: parent.label,
        });
      }
      // The entity record itself (will be dropped — becomes page header)
      const recordResolver = findResolverForEntityType(entityType);
      items.push({
        pathname: entityId,
        routeTo: `/records/${entityType}/${entityId}`,
        isLast: true,
        resolver: recordResolver,
        staticDisplayName: recordResolver
          ? fallbackEntityLabel(recordResolver.singularLabel, entityId)
          : entityType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      });
      // Handle sub-paths after /records/:entityType/:id/... (e.g. /edit)
      for (let i = 3; i < pathnames.length; i++) {
        const seg = pathnames[i];
        items.push({
          pathname: seg,
          routeTo: `/${pathnames.slice(0, i + 1).join('/')}`,
          isLast: i === pathnames.length - 1,
          resolver: undefined,
          staticDisplayName:
            breadcrumbNameMap[seg] ||
            seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
        });
      }
      // Mark last
      if (items.length > 0) items[items.length - 1].isLast = true;
      return items;
    }

    // Standard path-based breadcrumbs.
    // When path starts with /workspace/, skip the first "workspace" segment
    // because we add "Workspace" as the root via showWorkspaceRoot.
    const segments = isWorkspacePath ? pathnames.slice(1) : pathnames;
    const offset = isWorkspacePath ? 1 : 0;

    return segments.map((pathname, index) => {
      const routeTo = `/${pathnames.slice(0, index + offset + 1).join('/')}`;
      const previousSegment = index > 0 ? segments[index - 1] : (offset > 0 ? pathnames[0] : null);
      const resolver =
        previousSegment && !breadcrumbNameMap[pathname] && isLikelyEntityIdentifier(pathname)
          ? resolverMap[previousSegment]
          : undefined;

      return {
        pathname,
        routeTo,
        isLast: index === segments.length - 1,
        resolver,
        staticDisplayName:
          breadcrumbNameMap[pathname] ||
          pathname.charAt(0).toUpperCase() + pathname.slice(1).replace(/-/g, ' '),
      };
    });
  }, [pathnames, isRecordsPath, isWorkspacePath]);

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

  // The last breadcrumb item is NOT rendered in the trail — it becomes
  // the page header (rendered by EntityPageHeader or equivalent).
  const trailItems = breadcrumbItems.slice(0, -1);

  // Determine whether to prepend "Workspace" as the root crumb.
  // Only shown for /workspace/* paths or when navigating from search.
  const showWorkspaceRoot = isWorkspacePath || isFromSearch;

  // If there are no trail items and no workspace root, show nothing.
  if (trailItems.length === 0 && !showWorkspaceRoot) {
    return null;
  }

  return (
    <BreadcrumbWrapper>
      <BreadcrumbContainer aria-label="Breadcrumb navigation">
        {showWorkspaceRoot && (
          <BreadcrumbItem>
            <BreadcrumbLink to="/">Workspace</BreadcrumbLink>
            {trailItems.length > 0 && <Separator aria-hidden="true">/</Separator>}
          </BreadcrumbItem>
        )}
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

type BreadcrumbItemData = {
  pathname: string;
  routeTo: string;
  isLast: boolean;
  resolver: BreadcrumbResolver | undefined;
  staticDisplayName: string;
};

/** Map record entity type slugs to their resolver for breadcrumb name lookup */
function findResolverForEntityType(entityType: string): BreadcrumbResolver | undefined {
  const mapping: Record<string, string> = {
    supplier: 'suppliers',
    customer: 'customers',
    plant: 'plants',
    location: 'locations',
    contact: 'contacts',
    carrier: 'carriers',
    product: 'products',
    purchase_order: 'purchase-orders',
    sales_order: 'sales-orders',
    invoice: 'invoices',
  };
  const resolverKey = mapping[entityType];
  return resolverKey ? resolverMap[resolverKey] : undefined;
}

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
