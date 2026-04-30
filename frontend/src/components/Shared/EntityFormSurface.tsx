/**
 * EntityFormSurface
 *
 * Single entry point for record create/edit forms.
 *
 * - Default renderer: UniversalEntityForm (schema-driven)
 * - Enhanced renderer(s): entity-specific modules (e.g., InquiryCreateModal)
 *
 * This is the consolidation layer that lets the same form be embedded
 * in a modal today, and later embedded inline/panels/workforms without
 * duplicating per-entry-point logic.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import { Skeleton } from 'antd';
import { useQueries, useQuery } from '@tanstack/react-query';
import { isEqual } from 'lodash';

import { getRuntimeConfigBoolean } from '@/config/runtime';
import { useAuthState } from '@/contexts/AuthContext';

import UniversalEntityForm, {
  augmentSchemaForFrontend,
  fetchUniversalEntityFkOptions,
  fetchUniversalEntityRecord,
  fetchUniversalEntitySchema,
  getStableSignature,
  normalizeEntityKey,
  sanitizeInitialValuesForSchema,
  type BackendField,
} from './UniversalEntityForm';
import { InquiryCreateModal } from '../Inquiry/InquiryCreateModal';

export type EntityFormMode = 'create' | 'edit' | 'view' | 'clone';

export type EntityFormSurfaceVariant = 'modal' | 'inline';

export type EntityFormContext = {
  customerId?: string | number;
  supplierId?: string | number;
  contactId?: string | number;
  sourceCallId?: string | number;
};

export interface EntityFormSurfaceProps {
  entityType: string;
  mode: EntityFormMode;

  /**
   * Render surface.
   * - modal: wraps form in a modal (default)
   * - inline: renders directly (embeddable into pages/panels)
   */
  variant?: EntityFormSurfaceVariant;

  /**
   * When true, forces the UniversalEntityForm even if an enhanced renderer exists.
   * Useful for embedded Cockpit panes where modals would break the UX.
   */
  forceUniversal?: boolean;

  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: unknown) => void;

  /** For edit/view mode */
  entityId?: string | number;

  /** Seed values for universal schema-driven form */
  initialValues?: Record<string, unknown>;

  /** Context entity for cascade-prefill across Cockpit etc. */
  context?: EntityFormContext;
}

const normalizeEntityType = (raw: string): string => {
  const t = String(raw || '')
    .trim()
    .toLowerCase();

  if (t === 'inquiry' || t === 'inquiries') return 'inquiry';
  if (t === 'customer' || t === 'customers') return 'customer';
  if (t === 'supplier' || t === 'suppliers') return 'supplier';

  return t;
};

const buildUnauthorizedLoadError = () => ({ response: { status: 401 } });
const EMPTY_INITIAL_VALUES: Record<string, unknown> = {};

function useDeepStableValue<T>(value: T): T {
  const ref = useRef(value);

  if (!isEqual(ref.current, value)) {
    ref.current = value;
  }

  return ref.current;
}

export const EntityFormSurface: React.FC<EntityFormSurfaceProps> = ({
  entityType,
  mode,
  variant = 'modal',
  forceUniversal = false,
  isOpen,
  onClose,
  onSuccess,
  entityId,
  initialValues,
  context,
}) => {
  const normalized = useMemo(() => normalizeEntityType(entityType), [entityType]);
  const normalizedEntityKey = useMemo(() => normalizeEntityKey(entityType), [entityType]);
  const { isAuthenticated, loading: authLoading } = useAuthState();
  const stableInitialValues = useDeepStableValue(initialValues ?? EMPTY_INITIAL_VALUES);

  const useUniversalInquiryCreate = getRuntimeConfigBoolean('USE_UNIVERSAL_INQUIRY_CREATE', false);
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);
  const handleSuccess = useCallback(
    (result: unknown) => {
      onSuccess?.(result);
    },
    [onSuccess]
  );

  // Enhanced form: Inquiry (create) — can be swapped to UniversalEntityForm via runtime flag.
  if (normalized === 'inquiry' && mode === 'create' && !useUniversalInquiryCreate && !forceUniversal) {
    const initialEntityType = context?.customerId
      ? 'customer'
      : context?.supplierId
        ? 'supplier'
        : undefined;
    const initialEntityId = context?.customerId ?? context?.supplierId;

    return (
      <InquiryCreateModal
        isOpen={isOpen}
        onClose={handleClose}
        onSuccess={handleSuccess}
        initialEntityType={initialEntityType}
        initialEntityId={initialEntityId}
        sourceCallId={context?.sourceCallId}
      />
    );
  }

  // Default: Universal schema-driven form.
  const derivedInitialValues = useMemo<Record<string, unknown>>(
    () => ({
      ...stableInitialValues,
      ...(context?.customerId != null ? { customer: String(context.customerId) } : {}),
      ...(context?.supplierId != null ? { supplier: String(context.supplierId) } : {}),
      ...(context?.contactId != null ? { contact: String(context.contactId) } : {}),
    }),
    [context?.contactId, context?.customerId, context?.supplierId, stableInitialValues]
  );
  const shouldHydrate = isOpen && !authLoading && isAuthenticated;
  const shouldLoadRecord =
    shouldHydrate &&
    (mode === 'edit' || mode === 'view' || mode === 'clone') &&
    entityId != null &&
    String(entityId).trim().length > 0;

  useEffect(() => {
    if (!isOpen || authLoading || isAuthenticated || typeof window === 'undefined') {
      return;
    }

    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (currentPath.startsWith('/login')) {
      return;
    }

    try {
      localStorage.setItem('redirectAfterLogin', currentPath);
    } catch {
      // best-effort only
    }

    try {
      window.location.assign('/login');
    } catch {
      // JSDOM/tests may throw on navigation.
    }
  }, [authLoading, isAuthenticated, isOpen]);

  const schemaQueryOptions = useMemo(
    () => ({
      queryKey: ['entity-form-schema', normalizedEntityKey],
      queryFn: () => fetchUniversalEntitySchema(entityType),
      enabled: shouldHydrate,
      staleTime: 5 * 60 * 1000,
    }),
    [entityType, normalizedEntityKey, shouldHydrate]
  );
  const schemaQuery = useQuery(schemaQueryOptions);

  const recordQueryOptions = useMemo(
    () => ({
      queryKey: ['entity-form-record', normalizedEntityKey, entityId == null ? 'new' : String(entityId)],
      queryFn: () => fetchUniversalEntityRecord(entityType, entityId as string | number),
      enabled: shouldLoadRecord,
      staleTime: Number.POSITIVE_INFINITY,
    }),
    [entityId, entityType, normalizedEntityKey, shouldLoadRecord]
  );
  const recordQuery = useQuery(recordQueryOptions);

  const mergedInitialValues = useMemo(
    () =>
      sanitizeInitialValuesForSchema(schemaQuery.data ?? null, {
        ...(recordQuery.data || {}),
        ...derivedInitialValues,
      }),
    [derivedInitialValues, recordQuery.data, schemaQuery.data]
  );

  const augmentedSchema = useMemo(
    () => augmentSchemaForFrontend(normalizedEntityKey, schemaQuery.data ?? null, mergedInitialValues),
    [mergedInitialValues, normalizedEntityKey, schemaQuery.data]
  );

  const fkFields = useMemo(
    () =>
      (augmentedSchema?.fields ?? []).filter(
        (field) =>
          Boolean(field.related_entity) &&
          !String(field.related_entity || '').toLowerCase().includes('system.product') &&
          !String(field.key || '').toLowerCase().includes('product')
      ),
    [augmentedSchema?.fields]
  );
  const fkFieldSignature = useMemo(
    () =>
      getStableSignature(
        fkFields.map((field) => ({
          key: String(field.key),
          relatedEntity: String(field.related_entity || ''),
        }))
      ),
    [fkFields]
  );
  const stableFkDescriptorsRef = useRef<
    Array<{ fieldKey: string; relatedEntity: string }>
  >([]);
  const stableFkSignatureRef = useRef('');

  if (stableFkSignatureRef.current !== fkFieldSignature) {
    stableFkSignatureRef.current = fkFieldSignature;
    stableFkDescriptorsRef.current = fkFields.map((field) => ({
      fieldKey: String(field.key),
      relatedEntity: String(field.related_entity || ''),
    }));
  }

  const hasAugmentedSchema = Boolean(augmentedSchema);
  const fkQueryOptions = useMemo(
    () =>
      stableFkDescriptorsRef.current.map((descriptor) => ({
        queryKey: [
          'entity-form-fk-options',
          normalizedEntityKey,
          descriptor.fieldKey,
          descriptor.relatedEntity,
        ],
        queryFn: () =>
          fetchUniversalEntityFkOptions({
            key: descriptor.fieldKey,
            related_entity: descriptor.relatedEntity,
          } as BackendField),
        enabled: shouldHydrate && hasAugmentedSchema,
        staleTime: 5 * 60 * 1000,
      })),
    [fkFieldSignature, hasAugmentedSchema, normalizedEntityKey, shouldHydrate]
  );

  const fkQueries = useQueries({
    queries: fkQueryOptions,
  });

  const fkOptions = useMemo(() => {
    const next: Record<string, Array<{ id: string | number; name: string }>> = {};

    fkFields.forEach((field, index) => {
      const options = fkQueries[index]?.data;
      if (options?.length) {
        next[field.key] = options;
      }
    });

    return next;
  }, [fkFields, fkQueries]);

  const fkQueriesLoading =
    shouldHydrate &&
    fkQueryOptions.length > 0 &&
    fkQueries.some((query) => query.isLoading);
  const formLoading =
    (isOpen && authLoading) ||
    (shouldHydrate &&
      (schemaQuery.isLoading ||
        schemaQuery.isPending ||
        (shouldLoadRecord && (recordQuery.isLoading || recordQuery.isPending)) ||
        fkQueriesLoading));
  const formReady =
    hasAugmentedSchema &&
    (!shouldLoadRecord || Boolean(recordQuery.data || recordQuery.error)) &&
    (!shouldHydrate || !fkQueryOptions.length || fkQueries.every((query) => !query.isLoading));
  const formLoadError =
    !authLoading && !isAuthenticated && isOpen
      ? buildUnauthorizedLoadError()
      : schemaQuery.error || recordQuery.error || fkQueries.find((query) => query.error)?.error || null;
  const formKey = useMemo(
    () =>
      getStableSignature({
        entityType: normalizedEntityKey,
        mode,
        entityId: shouldLoadRecord ? String(entityId) : 'new',
        seed: derivedInitialValues,
      }),
    [derivedInitialValues, entityId, mode, normalizedEntityKey, shouldLoadRecord]
  );
  const loaderBody = (
    <div style={{ padding: 16 }}>
      <Skeleton active paragraph={{ rows: 6 }} />
    </div>
  );
  const errorBody = (
    <div style={{ padding: 12, color: 'rgb(var(--color-text-secondary))', fontSize: 13 }}>
      {(formLoadError as any)?.response?.status === 401 ||
      (formLoadError as any)?.response?.status === 403
        ? 'Authentication required. Redirecting to login…'
        : 'Unable to load form.'}
    </div>
  );

  if (!formReady || formLoading || formLoadError) {
    const fallbackContent = formLoadError ? errorBody : loaderBody;

    if (variant === 'inline') {
      return fallbackContent;
    }
  }

  return (
    <UniversalEntityForm
      key={formKey}
      entityType={entityType}
      mode={mode}
      variant={variant}
      entityId={mode === 'edit' || mode === 'view' || mode === 'clone' ? entityId : undefined}
      isOpen={isOpen}
      onClose={handleClose}
      onSuccess={handleSuccess}
      initialValues={derivedInitialValues}
      externalSchema={augmentedSchema}
      externalRecordValues={recordQuery.data ?? null}
      externalLoading={formLoading}
      externalLoadError={formLoadError}
      externalFkOptions={fkOptions}
    />
  );
};

export default EntityFormSurface;
