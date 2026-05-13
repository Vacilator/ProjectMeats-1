import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useNavigation } from '@/contexts/NavigationContext';
import { businessApi } from '@/services/businessApi';

type BreadcrumbResolver = {
  entityType: string;
  singularLabel: string;
  apiPath: string;
  getDisplayName: (payload: Record<string, unknown>, id: string) => string | null;
};

const breadcrumbNameMap: Record<string, string> = {
  cockpit: 'Cockpit',
  workspace: 'Cockpit',
  calls: 'Calls',
  'call-log': 'Calls',
  reports: 'Reports',
  workforms: 'WorkForms',
  'forms-flows': 'WorkForms',
  tasks: 'My Tasks',
  'in-progress': 'In Progress',
  catalog: 'Catalog',
  history: 'History',
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
  inquiries: 'Inquiries',
  fulfillments: 'Fulfillments',
  templates: 'Templates',
  analytics: 'Analytics',
  attachments: 'Attachments',
  accounting: 'Accounting',
  payables: 'Payables',
  receivables: 'Receivables',
  claims: 'Claims',
  pos: "P.O.'s",
  sos: "S.O.'s",
  invoices: 'Invoices',
  admin: 'Admin',
  'option-lists': 'Option Lists',
  settings: 'Settings',
  notifications: 'Notifications',
  profile: 'Profile',
  'ai-assistant': 'AI Assistant',
  workflows: 'Workflows',
  monitor: 'Monitor',
  run: 'Run',
  details: 'Details',
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
      readString(payload.order_number) ||
      readString(payload.po_number) ||
      fallbackEntityLabel('Purchase Order', id),
  },
  'sales-orders': {
    entityType: 'sales_order',
    singularLabel: 'Sales Order',
    apiPath: 'sales-orders',
    getDisplayName: (payload, id) =>
      readString(payload.order_number) ||
      readString(payload.sales_order_number) ||
      fallbackEntityLabel('Sales Order', id),
  },
  invoices: {
    entityType: 'invoice',
    singularLabel: 'Invoice',
    apiPath: 'accounting/invoices',
    getDisplayName: (payload, id) =>
      readString(payload.invoice_number) || fallbackEntityLabel('Invoice', id),
  },
};

const BreadcrumbHierarchySync: React.FC = () => {
  const location = useLocation();
  const { setBreadcrumbPath, setHierarchyStack } = useNavigation();
  const [resolvedNameMap, setResolvedNameMap] = useState<Map<string, string | null>>(new Map());

  const pathnames = useMemo(() => location.pathname.split('/').filter(Boolean), [location.pathname]);

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

  const resolvableSignature = useMemo(
    () =>
      resolvableItems
        .map((item) => `${item.routeTo}:${item.resolver?.apiPath ?? ''}:${item.pathname}`)
        .join('|'),
    [resolvableItems]
  );

  useEffect(() => {
    let isCancelled = false;

    if (!resolvableItems.length) {
      return () => {
        isCancelled = true;
      };
    }

    const loadResolvedNames = async () => {
      const entries = await Promise.all(
        resolvableItems.map(async (item) => {
          if (!item.resolver) {
            return [item.routeTo, null] as const;
          }

          try {
            const response = await businessApi.get(`${item.resolver.apiPath}/${item.pathname}/`);
            const payload =
              response?.data && typeof response.data === 'object'
                ? (response.data as Record<string, unknown>)
                : null;

            if (!payload) {
              return [item.routeTo, fallbackEntityLabel(item.resolver.singularLabel, item.pathname)] as const;
            }

            return [
              item.routeTo,
              item.resolver.getDisplayName(payload, item.pathname) ||
                fallbackEntityLabel(item.resolver.singularLabel, item.pathname),
            ] as const;
          } catch {
            return [item.routeTo, fallbackEntityLabel(item.resolver.singularLabel, item.pathname)] as const;
          }
        })
      );

      if (isCancelled) {
        return;
      }

      const next = new Map(entries);
      setResolvedNameMap((prev) => (areMapsEqual(prev, next) ? prev : next));
    };

    void loadResolvedNames();

    return () => {
      isCancelled = true;
    };
  }, [resolvableItems, resolvableSignature]);

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

  return null;
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

  return (
    /^\d+$/.test(normalized) ||
    UUID_SEGMENT_PATTERN.test(normalized) ||
    normalized.toLowerCase().includes('uuid')
  );
};

const areMapsEqual = (
  left: Map<string, string | null>,
  right: Map<string, string | null>
): boolean => {
  if (left === right) return true;
  if (left.size !== right.size) return false;

  for (const [key, value] of left.entries()) {
    if (right.get(key) !== value) {
      return false;
    }
  }

  return true;
};

export default BreadcrumbHierarchySync;
