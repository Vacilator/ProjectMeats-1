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

import React, { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import { Modal, Skeleton, Button } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import isEqual from 'lodash/isEqual';

import { getRuntimeConfigBoolean } from '@/config/runtime';
import { useAuthState } from '@/contexts/AuthContext';
import { buildEntityCascade, buildRouteHierarchy } from '@/hooks/useEntityCascade';
import { withTenantQueryKey } from '@/utils/queryKeys';

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
  onValuesChange?: (values: Record<string, unknown>) => void;
}

import { normalizeEntityType } from '../../utils/entityTypeRegistry';

const buildUnauthorizedLoadError = () => ({ response: { status: 401 } });
const EMPTY_INITIAL_VALUES: Record<string, unknown> = {};
type FkOption = { id: string | number; name: string };
type FkOptionsMap = Record<string, FkOption[]>;
type FkDescriptor = { fieldKey: string; relatedEntity: string };

function useDeepStableValue<T>(value: T): T {
  const ref = useRef(value);

  if (!isEqual(ref.current, value)) {
    ref.current = value;
  }

  return ref.current;
}

/**
 * Returns a stable callback that always invokes the latest version of `fn`.
 * Prevents render cascades when parent components pass fresh arrow functions.
 */
function useStableCallback<T extends (...args: any[]) => any>(fn: T | undefined): T {
  const ref: RefObject<T | undefined> = useRef(fn);
  ref.current = fn;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(((...args: any[]) => ref.current?.(...args)) as unknown as T, []);
}

const humanizeEntityType = (value: string): string => {
  const tail = String(value || '')
    .split('.')
    .pop()
    ?.replace(/[_-]+/g, ' ')
    .trim();

  if (!tail) return 'Record';

  return tail.replace(/\b\w/g, (char) => char.toUpperCase());
};

const fetchEntityFormFkOptionsBatch = async (
  descriptors: FkDescriptor[],
): Promise<FkOptionsMap> => {
  if (!descriptors.length) {
    return {};
  }

  const entries = await Promise.all(
    descriptors.map(async (descriptor) => {
      const options = await fetchUniversalEntityFkOptions({
        key: descriptor.fieldKey,
        related_entity: descriptor.relatedEntity,
      } as BackendField);

      return [descriptor.fieldKey, options] as const;
    }),
  );

  return entries.reduce<FkOptionsMap>((accumulator, [fieldKey, options]) => {
    if (options.length > 0) {
      accumulator[fieldKey] = options;
    }

    return accumulator;
  }, {});
};

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
  onValuesChange,
}) => {
  const normalized = useMemo(() => normalizeEntityType(entityType), [entityType]);
  const normalizedEntityKey = useMemo(() => normalizeEntityKey(entityType), [entityType]);
  const { isAuthenticated, loading: authLoading } = useAuthState();
  const queryClient = useQueryClient();
  const stableInitialValues = useDeepStableValue(initialValues ?? EMPTY_INITIAL_VALUES);
  const stableContext = useDeepStableValue(context);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const useUniversalInquiryCreate = getRuntimeConfigBoolean('USE_UNIVERSAL_INQUIRY_CREATE', false);
  const handleClose = useStableCallback(onClose);
  const handleSuccess = useStableCallback(onSuccess);
  const derivedInitialValues = useMemo<Record<string, unknown>>(
    () => ({
      ...stableInitialValues,
      ...(stableContext?.customerId != null ? { customer: String(stableContext.customerId) } : {}),
      ...(stableContext?.supplierId != null ? { supplier: String(stableContext.supplierId) } : {}),
      ...(stableContext?.contactId != null ? { contact: String(stableContext.contactId) } : {}),
    }),
    [stableContext?.contactId, stableContext?.customerId, stableContext?.supplierId, stableInitialValues]
  );

  const pathname = typeof window === 'undefined' ? '' : window.location.pathname;
  const routeHierarchy = useMemo(() => buildRouteHierarchy(pathname), [pathname]);
  const { initialValues: cascadedInitialValues, lockedFieldKeys } = useMemo(
    () => buildEntityCascade(derivedInitialValues, stableContext, routeHierarchy),
    [derivedInitialValues, routeHierarchy, stableContext]
  );

  useEffect(() => {
    if (!isOpen) {
      setFormSubmitting(false);
    }
  }, [isOpen]);

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
        initialValues={stableInitialValues}
        onValuesChange={onValuesChange}
      />
    );
  }

  // Default: Universal schema-driven form.
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
      queryKey: withTenantQueryKey('entity-form-schema', normalizedEntityKey),
      queryFn: () => fetchUniversalEntitySchema(entityType),
      enabled: shouldHydrate,
      staleTime: 5 * 60 * 1000,
    }),
    [entityType, normalizedEntityKey, shouldHydrate]
  );
  const schemaQuery = useQuery(schemaQueryOptions);

  const recordQueryOptions = useMemo(
    () => ({
      queryKey: withTenantQueryKey('entity-form-record', normalizedEntityKey, entityId == null ? 'new' : String(entityId)),
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
          ...cascadedInitialValues,
        }),
    [cascadedInitialValues, recordQuery.data, schemaQuery.data]
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
  const fkDescriptors = useMemo(
    () =>
      fkFields.map((field) => ({
        fieldKey: String(field.key),
        relatedEntity: String(field.related_entity || ''),
      })),
    [fkFields]
  );
  const stableFkDescriptors = useDeepStableValue(fkDescriptors);
  const fkFieldSignature = useMemo(
    () => getStableSignature(stableFkDescriptors),
    [stableFkDescriptors]
  );
  const hasAugmentedSchema = Boolean(augmentedSchema);
  const fkOptionsQueryOptions = useMemo(
    () => ({
      queryKey: withTenantQueryKey(
        'entity-form-fk-options-batch',
        normalizedEntityKey,
        fkFieldSignature,
      ),
      queryFn: () => fetchEntityFormFkOptionsBatch(stableFkDescriptors),
      enabled: shouldHydrate && hasAugmentedSchema && stableFkDescriptors.length > 0,
      staleTime: 5 * 60 * 1000,
    }),
    [fkFieldSignature, hasAugmentedSchema, normalizedEntityKey, shouldHydrate, stableFkDescriptors]
  );
  const fkOptionsQuery = useQuery(fkOptionsQueryOptions);
  const fkOptions = useMemo<FkOptionsMap>(() => fkOptionsQuery.data ?? {}, [fkOptionsQuery.data]);

  const fkOptionsLoading =
    shouldHydrate &&
    stableFkDescriptors.length > 0 &&
    (fkOptionsQuery.isLoading || fkOptionsQuery.isPending);
  const formLoading =
    (isOpen && authLoading) ||
    (shouldHydrate &&
      (schemaQuery.isLoading ||
        schemaQuery.isPending ||
        (shouldLoadRecord && (recordQuery.isLoading || recordQuery.isPending)) ||
        fkOptionsLoading));
  const formReady =
    hasAugmentedSchema &&
    (!shouldLoadRecord || Boolean(recordQuery.data || recordQuery.error)) &&
    (!shouldHydrate ||
      !stableFkDescriptors.length ||
      // FK options are non-blocking: form renders even if they fail or finish loading
      !(fkOptionsQuery.isLoading || fkOptionsQuery.isPending) ||
      Boolean(fkOptionsQuery.error));
  const formLoadError =
    !authLoading && !isAuthenticated && isOpen
      ? buildUnauthorizedLoadError()
      : schemaQuery.error || recordQuery.error || null;
  // FK option errors are non-fatal — form renders with empty dropdowns
  const formKey = useMemo(
    () =>
      getStableSignature({
        entityType: normalizedEntityKey,
        mode,
        entityId: shouldLoadRecord ? String(entityId) : 'new',
        seed: cascadedInitialValues,
      }),
    [cascadedInitialValues, entityId, mode, normalizedEntityKey, shouldLoadRecord]
  );
  const modalTitle = useMemo(() => {
    const baseLabel = String(
      augmentedSchema?.name || schemaQuery.data?.name || humanizeEntityType(entityType)
    );

    if (mode === 'create') return `New ${baseLabel}`;
    if (mode === 'edit') return `Edit ${baseLabel}`;
    if (mode === 'clone') return `Clone ${baseLabel}`;
    return baseLabel;
  }, [augmentedSchema?.name, entityType, mode, schemaQuery.data?.name]);
  const handleRetry = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: withTenantQueryKey('entity-form-schema', normalizedEntityKey),
    });
    void queryClient.invalidateQueries({
      queryKey: withTenantQueryKey('entity-form-fk-options-batch', normalizedEntityKey),
    });
    if (entityId != null) {
      void queryClient.invalidateQueries({
        queryKey: withTenantQueryKey('entity-form-record', normalizedEntityKey, String(entityId)),
      });
    }
  }, [queryClient, normalizedEntityKey, entityId]);

  const loaderBody = (
    <div style={{ padding: 16 }}>
      <Skeleton active paragraph={{ rows: 6 }} />
    </div>
  );
  const isAuthError =
    (formLoadError as any)?.response?.status === 401 ||
    (formLoadError as any)?.response?.status === 403;
  const errorBody = (
    <div style={{ padding: 16, textAlign: 'center', color: 'rgb(var(--color-text-secondary))', fontSize: 13 }}>
      <div style={{ marginBottom: 12 }}>
        {isAuthError
          ? 'Authentication required. Redirecting to login…'
          : 'Unable to load form. The schema or record data could not be fetched.'}
      </div>
      {!isAuthError && (
        <Button type="primary" onClick={handleRetry} size="small">
          Retry
        </Button>
      )}
    </div>
  );
  const shouldMountForm = isOpen && formReady && !formLoading && !formLoadError;

  const formSubmittingRef = useRef(formSubmitting);
  formSubmittingRef.current = formSubmitting;
  const handleCancel = useCallback(() => {
    if (formSubmittingRef.current) return;
    handleClose();
  }, [handleClose]);
  const modalMaskConfig = useMemo(
    () => ({ closable: !formSubmitting }),
    [formSubmitting]
  );
  if (variant === 'modal' && !isOpen) {
    return null;
  }

  if (!formReady || formLoading || formLoadError) {
    const fallbackContent = formLoadError ? errorBody : loaderBody;

    if (variant === 'inline') {
      return fallbackContent;
    }
  }

  if (variant === 'inline') {
    return (
      <UniversalEntityForm
        key={formKey}
        entityType={entityType}
        mode={mode}
        variant="inline"
        entityId={mode === 'edit' || mode === 'view' || mode === 'clone' ? entityId : undefined}
        isOpen={isOpen}
        onClose={handleClose}
        onSuccess={handleSuccess}
        initialValues={cascadedInitialValues}
        lockedFieldKeys={lockedFieldKeys}
        externalSchema={augmentedSchema}
        externalRecordValues={recordQuery.data ?? null}
        externalLoading={formLoading}
        externalLoadError={formLoadError}
        externalFkOptions={fkOptions}
        onSubmittingChange={setFormSubmitting}
        onValuesChange={onValuesChange}
      />
    );
  }

  return (
    <Modal
      open={isOpen}
      centered
      onCancel={handleCancel}
      closable={!formSubmitting}
      mask={modalMaskConfig}
      keyboard={!formSubmitting}
      footer={null}
      width="min(720px, calc(100vw - 32px))"
      destroyOnHidden
      title={modalTitle}
    >
      {shouldMountForm ? (
        <UniversalEntityForm
          key={formKey}
          entityType={entityType}
          mode={mode}
          variant="inline"
          entityId={mode === 'edit' || mode === 'view' || mode === 'clone' ? entityId : undefined}
          isOpen={shouldMountForm}
          onClose={handleClose}
          onSuccess={handleSuccess}
          initialValues={cascadedInitialValues}
          lockedFieldKeys={lockedFieldKeys}
          externalSchema={augmentedSchema}
          externalRecordValues={recordQuery.data ?? null}
          externalLoading={formLoading}
          externalLoadError={formLoadError}
          externalFkOptions={fkOptions}
          onSubmittingChange={setFormSubmitting}
          onValuesChange={onValuesChange}
        />
      ) : formLoadError ? (
        errorBody
      ) : (
        loaderBody
      )}
    </Modal>
  );
};

export default EntityFormSurface;
