import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import type { EntityFormContext } from '@/components/Shared/EntityFormSurface';
import { normalizeEntityType } from '@/utils/entityTypeRegistry';

const EMPTY_VALUES: Record<string, unknown> = {};

const CONTEXT_ENTITY_KEYS: Record<keyof EntityFormContext, string> = {
  customerId: 'customer',
  supplierId: 'supplier',
  contactId: 'contact',
  sourceCallId: 'call',
};

const FIELD_ALIASES: Record<string, string[]> = {
  call: ['call', 'call_id', 'source_call', 'source_call_id'],
  carrier: ['carrier', 'carrier_id'],
  contact: ['contact', 'contact_id'],
  customer: ['customer', 'customer_id'],
  location: ['location', 'location_id'],
  plant: ['plant', 'plant_id'],
  supplier: ['supplier', 'supplier_id'],
};

const ROUTE_ENTITY_KEYS: Record<string, string> = {
  suppliers: 'supplier',
  customers: 'customer',
  plants: 'plant',
  locations: 'location',
  contacts: 'contact',
  carriers: 'carrier',
  products: 'product',
  'purchase-orders': 'purchase_order',
  'sales-orders': 'sales_order',
  invoices: 'invoice',
};

const isBlank = (value: unknown): boolean => {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  return false;
};

export interface EntityCascadeResult {
  initialValues: Record<string, unknown>;
  lockedFieldKeys: string[];
}

const isLikelyEntityIdentifier = (segment: string): boolean => {
  const normalized = String(segment || '').trim();
  if (!normalized) return false;

  return /^\d+$/.test(normalized) || normalized.toLowerCase().includes('uuid');
};

const buildRouteHierarchy = (pathname: string) => {
  const pathnames = String(pathname || '')
    .split('/')
    .filter(Boolean);

  return pathnames.flatMap((segment, index) => {
    const previousSegment = index > 0 ? pathnames[index - 1] : null;
    if (!previousSegment || !isLikelyEntityIdentifier(segment)) {
      return [];
    }

    const entityType = ROUTE_ENTITY_KEYS[previousSegment];
    if (!entityType) {
      return [];
    }

    return [{ entityType, entityId: segment }];
  });
};

export const buildEntityCascade = (
  initialValues: Record<string, unknown> | undefined,
  context: EntityFormContext | undefined,
  hierarchyStack: Array<{ entityType: string; entityId: string }>
): EntityCascadeResult => {
  const nextValues: Record<string, unknown> = { ...(initialValues ?? EMPTY_VALUES) };
  const lockedFieldKeys = new Set<string>();

  const explicitContextEntries = Object.entries(context ?? {})
    .map(([key, rawValue]) => {
      const entityType = CONTEXT_ENTITY_KEYS[key as keyof EntityFormContext];
      const value = String(rawValue ?? '').trim();
      if (!entityType || !value) return null;
      return { entityType, entityId: value };
    })
    .filter(Boolean) as Array<{ entityType: string; entityId: string }>;

  const mergedStack = [...explicitContextEntries, ...hierarchyStack]
    .map((entry) => ({
      entityType: normalizeEntityType(entry.entityType),
      entityId: String(entry.entityId ?? '').trim(),
    }))
    .filter((entry) => entry.entityType && entry.entityId);

  for (const entry of mergedStack) {
    const aliases = FIELD_ALIASES[entry.entityType] ?? [entry.entityType, `${entry.entityType}_id`];

    aliases.forEach((alias) => {
      const currentValue = nextValues[alias];
      if (isBlank(currentValue)) {
        nextValues[alias] = entry.entityId;
        lockedFieldKeys.add(alias);
        return;
      }

      if (String(currentValue).trim() === entry.entityId) {
        lockedFieldKeys.add(alias);
      }
    });
  }

  return {
    initialValues: nextValues,
    lockedFieldKeys: Array.from(lockedFieldKeys),
  };
};

export const useEntityCascade = (
  initialValues?: Record<string, unknown>,
  context?: EntityFormContext
): EntityCascadeResult => {
  const location = useLocation();
  const routeHierarchy = useMemo(() => buildRouteHierarchy(location.pathname), [location.pathname]);

  return useMemo(
    () => buildEntityCascade(initialValues, context, routeHierarchy),
    [context, initialValues, routeHierarchy]
  );
};
