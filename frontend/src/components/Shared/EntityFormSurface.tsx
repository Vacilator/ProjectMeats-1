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

import React, { useCallback, useEffect, useMemo } from 'react';

import { useQueries, useQuery } from '@tanstack/react-query';

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
      ...(initialValues || {}),
      ...(context?.customerId != null ? { customer: String(context.customerId) } : {}),
      ...(context?.supplierId != null ? { supplier: String(context.supplierId) } : {}),
      ...(context?.contactId != null ? { contact: String(context.contactId) } : {}),
    }),
    [context?.contactId, context?.customerId, context?.supplierId, initialValues]
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

  const schemaQuery = useQuery({
    queryKey: ['entity-form-schema', normalizedEntityKey],
    queryFn: () => fetchUniversalEntitySchema(entityType),
    enabled: shouldHydrate,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const recordQuery = useQuery({
    queryKey: ['entity-form-record', normalizedEntityKey, entityId == null ? 'new' : String(entityId)],
    queryFn: () => fetchUniversalEntityRecord(entityType, entityId as string | number),
    enabled: shouldLoadRecord,
    staleTime: Number.POSITIVE_INFINITY,
  });

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

  const fkQueries = useQueries({
    queries: fkFields.map((field) => ({
      queryKey: [
        'entity-form-fk-options',
        normalizedEntityKey,
        field.key,
        String(field.related_entity || ''),
      ],
      queryFn: () => fetchUniversalEntityFkOptions(field as BackendField),
      enabled: shouldHydrate && Boolean(augmentedSchema),
      staleTime: Number.POSITIVE_INFINITY,
    })),
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

  const formLoading =
    (isOpen && authLoading) ||
    (shouldHydrate &&
      (schemaQuery.isLoading ||
        schemaQuery.isPending ||
        (shouldLoadRecord && (recordQuery.isLoading || recordQuery.isPending))));
  const formReady =
    Boolean(augmentedSchema) && (!shouldLoadRecord || Boolean(recordQuery.data || recordQuery.error));
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
        ready: formReady ? 'ready' : 'loading',
      }),
    [
      derivedInitialValues,
      entityId,
      formReady,
      mode,
      normalizedEntityKey,
      shouldLoadRecord,
    ]
  );

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
