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
 *
 * The Modal variant includes an **internal** error boundary so that React
 * render crashes (e.g. Error #185 — maximum update depth) are caught and
 * displayed *inside* the modal instead of silently replacing it with an
 * invisible inline fallback.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import { Modal, Skeleton, Button } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import isEqual from 'lodash/isEqual';

import { getRuntimeConfigBoolean } from '@/config/runtime';
import { useAuthState } from '@/contexts/AuthContext';
import { buildEntityCascade, buildRouteHierarchy } from '@/hooks/useEntityCascade';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { applyCascadeFilter, type FkOptionsMap as CascadeFkOptionsMap } from '@/utils/fkCascadeMap';
import { logger } from '@/utils/logger';

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

/** Loading timeout in milliseconds — after this, show a retry prompt instead of infinite skeleton. */
const SCHEMA_LOAD_TIMEOUT_MS = 12_000;

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

  // Use allSettled so one failing FK endpoint doesn't block the entire form
  const results = await Promise.allSettled(
    descriptors.map(async (descriptor) => {
      const options = await fetchUniversalEntityFkOptions({
        key: descriptor.fieldKey,
        related_entity: descriptor.relatedEntity,
      } as BackendField);

      return [descriptor.fieldKey, options] as const;
    }),
  );

  return results.reduce<FkOptionsMap>((accumulator, result) => {
    if (result.status === 'fulfilled') {
      const [fieldKey, options] = result.value;
      if (options.length > 0) {
        accumulator[fieldKey] = options;
      }
    }
    return accumulator;
  }, {});
};

// ---------------------------------------------------------------------------
// Internal error boundary — renders inside the Modal so crashes are visible
// ---------------------------------------------------------------------------

interface ModalFormErrorBoundaryProps {
  children: React.ReactNode;
  onRetry: () => void;
  entityType: string;
}

interface ModalFormErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ModalFormErrorBoundary extends React.Component<ModalFormErrorBoundaryProps, ModalFormErrorBoundaryState> {
  constructor(props: ModalFormErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ModalFormErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.warn(`[EntityFormSurface] ${this.props.entityType} form crashed`, {
      component: 'ModalFormErrorBoundary',
      metadata: { error: error.message, stack: errorInfo.componentStack?.slice(0, 500) },
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry();
  };

  render() {
    if (this.state.hasError) {
      const isMaxUpdate =
        this.state.error?.message?.includes('Maximum update depth') ||
        this.state.error?.message?.includes('#185');

      return (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, color: 'rgb(var(--color-text-primary))' }}>
            {isMaxUpdate ? 'Form loading issue' : 'Something went wrong'}
          </div>
          <div style={{ fontSize: 13, color: 'rgb(var(--color-text-secondary))', marginBottom: 16, maxWidth: 360, margin: '0 auto 16px' }}>
            {isMaxUpdate
              ? `The ${this.props.entityType} form encountered a rendering loop. This usually resolves on retry.`
              : `An unexpected error occurred while loading the ${this.props.entityType} form.`}
          </div>
          <Button type="primary" onClick={this.handleRetry} size="small">
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

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
  const [loadTimedOut, setLoadTimedOut] = useState(false);

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

  // --- All hooks MUST be above this line (before any conditional returns) ---

  // Default: Universal schema-driven form.
  const shouldHydrate = isOpen && !authLoading && isAuthenticated;
  const shouldLoadRecord =
    shouldHydrate &&
    (mode === 'edit' || mode === 'view' || mode === 'clone') &&
    entityId != null &&
    String(entityId).trim().length > 0;

  // Auth redirect for unauthenticated users
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

  // Reset submitting state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormSubmitting(false);
      setLoadTimedOut(false);
    }
  }, [isOpen]);

  // Loading timeout: if form hasn't loaded after SCHEMA_LOAD_TIMEOUT_MS, show retry prompt
  useEffect(() => {
    if (!isOpen || !shouldHydrate) return;

    const timer = window.setTimeout(() => {
      setLoadTimedOut(true);
    }, SCHEMA_LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [isOpen, shouldHydrate]);

  const schemaQueryOptions = useMemo(
    () => ({
      queryKey: withTenantQueryKey('entity-form-schema', normalizedEntityKey),
      queryFn: async () => {
        const result = await fetchUniversalEntitySchema(entityType);
        if (!result || !Array.isArray(result.fields) || result.fields.length === 0) {
          logger.warn('[EntityFormSurface] Schema loaded but has no fields', {
            component: 'EntityFormSurface',
            metadata: { entityType, normalizedEntityKey, resultKeys: result ? Object.keys(result) : 'null' },
          });
        }
        return result;
      },
      enabled: shouldHydrate,
      staleTime: 5 * 60 * 1000,
      retry: 2,
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
  const rawFkOptions = useMemo<FkOptionsMap>(() => fkOptionsQuery.data ?? {}, [fkOptionsQuery.data]);

  // Cascade filtering: filter child FK options based on parent field values.
  // Deep-equality guard prevents render cascades: DFE fires onValuesChange on
  // every watched value update (new ref each time). Without this check,
  // setLiveFormValues → re-render → new props to UEF → DFE re-render →
  // onValuesChange → loop → React error #185.
  //
  // Mount-guard: Skip cascade state updates for the first 2 render cycles
  // after the form opens. AntD Select's internal useStatus hook triggers
  // setState on prop changes; rapid state updates during mount exceed React's
  // max update depth (Error #185). Deferring cascade updates until after the
  // form has settled eliminates the loop.
  const [liveFormValues, setLiveFormValues] = useState<Record<string, unknown>>({});
  const liveFormValuesRef = useRef<Record<string, unknown>>({});
  const cascadeSettledRef = useRef(false);
  // Track how many onValuesChange calls we've seen since mount — ignore the
  // first few which are AntD form hydration, not user edits.
  const valuesChangeCountRef = useRef(0);
  useEffect(() => {
    if (!isOpen) {
      cascadeSettledRef.current = false;
      valuesChangeCountRef.current = 0;
      return;
    }
    // NOTE: Do NOT start the settle timer here. It will fire BEFORE the form
    // actually mounts (afterOpenChange fires ~200ms after isOpen), leaving
    // the guard open during initial form hydration. The timer is started by
    // the shouldMountForm effect below instead.
  }, [isOpen]);
  const fkOptions = useMemo<FkOptionsMap>(
    () => applyCascadeFilter(normalizedEntityKey, rawFkOptions as CascadeFkOptionsMap, liveFormValues) as unknown as FkOptionsMap,
    [normalizedEntityKey, rawFkOptions, liveFormValues],
  );
  const handleValuesChange = useCallback(
    (values: Record<string, unknown>) => {
      valuesChangeCountRef.current += 1;
      // Block cascade state updates during the settle window AND for the
      // first 3 onValuesChange calls (AntD form hydration). This prevents
      // the setState→re-render→useStatus loop that causes React error #185.
      if (
        cascadeSettledRef.current &&
        valuesChangeCountRef.current > 3 &&
        !isEqual(liveFormValuesRef.current, values)
      ) {
        liveFormValuesRef.current = values;
        setLiveFormValues(values);
      }
      onValuesChange?.(values);
    },
    [onValuesChange],
  );

  // FK options are NON-BLOCKING: form mounts as soon as schema loads.
  // Dropdowns populate asynchronously when FK options arrive.
  const formLoading =
    (isOpen && authLoading) ||
    (shouldHydrate &&
      (schemaQuery.isLoading ||
        schemaQuery.isPending ||
        (shouldLoadRecord && (recordQuery.isLoading || recordQuery.isPending))));
  const formReady =
    hasAugmentedSchema &&
    (!shouldLoadRecord || Boolean(recordQuery.data || recordQuery.error));
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
    setLoadTimedOut(false);
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

  // Determine effective load error (including timeout)
  const effectiveLoadError = formLoadError || (loadTimedOut && formLoading ? { timeout: true } : null);

  // ── Modal animation guard ──
  // NUCLEAR FIX: Disable CSS animations entirely (transitionName="") to
  // prevent CSSMotion useStatus ↔ react-hook-form useWatch infinite loop
  // (React error #185).  AntD's CSSMotion runs a layout-effect state
  // machine during open/close.  When DynamicFormEngine mounts during
  // that animation, useWatch/useForm state updates re-render the Modal
  // subtree faster than CSSMotion can settle.  Removing the animation
  // eliminates the race entirely.  Multiple timing-based fixes have
  // failed (see bug_fix_log); this is the definitive structural fix.
  //
  // With animations disabled, set modalAnimReady on the next animation
  // frame so React can flush the Modal's initial render first.
  const [modalAnimReady, setModalAnimReady] = useState(false);
  useEffect(() => {
    if (isOpen) {
      const raf = requestAnimationFrame(() => setModalAnimReady(true));
      return () => cancelAnimationFrame(raf);
    }
    setModalAnimReady(false);
  }, [isOpen]);
  const handleAfterOpenChange = useCallback((open: boolean) => {
    if (open) setModalAnimReady(true);
  }, []);

  const isModalVariant = variant === 'modal';
  const shouldMountForm =
    isOpen &&
    formReady &&
    !formLoading &&
    !effectiveLoadError &&
    (!isModalVariant || modalAnimReady);

  // Start the cascade settle timer when the form actually mounts — NOT when
  // `isOpen` flips. The modal animation takes ~200ms; if we started at isOpen
  // the 100ms timer would fire before the form mounts, leaving the guard open
  // during AntD form hydration (the root cause of React error #185).
  useEffect(() => {
    if (!shouldMountForm) {
      cascadeSettledRef.current = false;
      valuesChangeCountRef.current = 0;
      return;
    }
    const timer = window.setTimeout(() => {
      cascadeSettledRef.current = true;
    }, 300);
    return () => window.clearTimeout(timer);
  }, [shouldMountForm]);

  const isAuthError =
    (effectiveLoadError as any)?.response?.status === 401 ||
    (effectiveLoadError as any)?.response?.status === 403;
  const isTimeoutError = (effectiveLoadError as any)?.timeout === true;

  const loaderBody = (
    <div style={{ padding: 16 }}>
      <Skeleton active paragraph={{ rows: 6 }} />
    </div>
  );

  const errorBody = (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>
        {isTimeoutError ? '⏱️' : isAuthError ? '🔒' : '⚠️'}
      </div>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, color: 'rgb(var(--color-text-primary))' }}>
        {isTimeoutError
          ? 'Loading is taking too long'
          : isAuthError
            ? 'Authentication required'
            : 'Unable to load form'}
      </div>
      <div style={{ fontSize: 13, color: 'rgb(var(--color-text-secondary))', marginBottom: 16, maxWidth: 360, margin: '0 auto 16px' }}>
        {isTimeoutError
          ? 'The form schema is taking longer than expected. The backend may be unavailable. You can retry or close this dialog.'
          : isAuthError
            ? 'Your session may have expired. Please log in again.'
            : 'The form schema or record data could not be fetched. Please try again.'}
      </div>
      {!isAuthError && (
        <Button type="primary" onClick={handleRetry} size="small">
          Retry
        </Button>
      )}
    </div>
  );

  // --- Conditional renders ---

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

  if (variant === 'modal' && !isOpen) {
    return null;
  }

  if (variant === 'inline') {
    if (!formReady || formLoading || effectiveLoadError) {
      return effectiveLoadError ? errorBody : loaderBody;
    }

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
        externalLoadError={effectiveLoadError}
        externalFkOptions={fkOptions}
        onSubmittingChange={setFormSubmitting}
        onValuesChange={handleValuesChange}
      />
    );
  }

  // --- Modal variant ---
  // The ModalFormErrorBoundary catches React render errors INSIDE the modal
  // so the user sees the error in the dialog, not as an invisible inline fallback.
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
      afterOpenChange={handleAfterOpenChange}
      title={modalTitle}
      transitionName=""
      maskTransitionName=""
    >
      <ModalFormErrorBoundary entityType={entityType} onRetry={handleRetry}>
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
            externalLoadError={effectiveLoadError}
            externalFkOptions={fkOptions}
            onSubmittingChange={setFormSubmitting}
            onValuesChange={handleValuesChange}
          />
        ) : effectiveLoadError ? (
          errorBody
        ) : (
          loaderBody
        )}
      </ModalFormErrorBoundary>
    </Modal>
  );
};

export default EntityFormSurface;
