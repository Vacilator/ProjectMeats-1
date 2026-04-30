/**
 * EntityFormSurface
 *
 * Smart loader/controller boundary for record create/edit forms.
 * It preloads every schema, record, dropdown, and AI document dependency
 * before mounting the pure UniversalEntityForm renderer.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton, message } from 'antd';
import { isEqual } from 'lodash';

import { getRuntimeConfigBoolean } from '@/config/runtime';
import { useAuthState } from '@/contexts/AuthContext';

import UniversalEntityForm, {
  augmentSchemaForFrontend,
  getStableSignature,
  normalizeEntityEndpoint,
  normalizeEntityKey,
  sanitizeInitialValuesForSchema,
  type BackendField,
  type BackendSchema,
} from './UniversalEntityForm';
import { InquiryCreateModal } from '../Inquiry/InquiryCreateModal';
import { businessApi } from '../../services/businessApi';
import { documentsApi, schemaExtractionApi } from '../../services/aiService';
import { contactFormOptionsService } from '../../services/contactFormOptionsService';
import { getChoicesForField } from '../../services/choicesService';
import { resolveConfig } from '../../services/configService';
import type { DynamicFormConfig } from '../../features/system/DynamicFormEngine';
import {
  fetchUniversalEntityFkOptions,
  fetchUniversalEntityRecord,
  fetchUniversalEntitySchema,
  type PreloadedDropdownOption,
} from './entityFormData';

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
  variant?: EntityFormSurfaceVariant;
  forceUniversal?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: unknown) => void;
  entityId?: string | number;
  initialValues?: Record<string, unknown>;
  context?: EntityFormContext;
}

const DEFAULT_FORM_CONFIG: DynamicFormConfig = {
  showRequiredIndicator: true,
  showHelpText: true,
  validateOnChange: false,
  submitButtonText: 'Submit',
};

const EXTRACTABLE_ENTITY_KEYS = new Set(['purchase_order', 'sales_order', 'invoice', 'carrier_po']);

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

const flattenSchemaFields = (schema: BackendSchema | null): BackendField[] => {
  const directFields = Array.isArray(schema?.fields) ? (schema?.fields as BackendField[]) : [];

  return directFields.flatMap((field) => [
    field,
    ...((String(field.type || '').toLowerCase() === 'inline_form_array'
      ? field.item_fields || []
      : []) as BackendField[]),
  ]);
};

const isMasterProductField = (field: BackendField): boolean => {
  const relatedEntity = String(field.related_entity || '').toLowerCase();
  const ui = field.ui && typeof field.ui === 'object' ? (field.ui as Record<string, unknown>) : null;
  const dataSource =
    ui && typeof ui.data_source === 'object' ? (ui.data_source as Record<string, unknown>) : null;
  const dataSourceType = String(dataSource?.type || '').toLowerCase();

  return (
    dataSourceType === 'master_products' ||
    relatedEntity.includes('system.product') ||
    String(field.key || '').toLowerCase().includes('product')
  );
};

const fetchAllMasterProductOptions = async (): Promise<PreloadedDropdownOption[]> => {
  const response = await businessApi.get('/master-products/', {
    params: { page_size: 200, limit: 200, is_active: true },
  });

  const payload = response.data as unknown;
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as Record<string, unknown> | null)?.results)
      ? (((payload as Record<string, unknown>).results as unknown[]) || [])
      : [];

  return rows.map((rowValue: unknown) => {
    const row = rowValue && typeof rowValue === 'object' ? (rowValue as Record<string, unknown>) : {};
    const id = String(row.id ?? row.value ?? '');
    const code = typeof row.product_code === 'string' ? row.product_code : '';
    const name =
      typeof row.display_name === 'string'
        ? row.display_name
        : typeof row.effective_name === 'string'
          ? row.effective_name
          : typeof row.name === 'string'
            ? row.name
            : id;

    const proteinTypes = Array.isArray(row.protein_types)
      ? row.protein_types.map((item) => String(item ?? '').trim()).filter(Boolean)
      : typeof row.protein_type === 'string' && row.protein_type.trim()
        ? [row.protein_type.trim()]
        : [];

    return {
      value: id,
      label: `${code ? `${code} - ` : ''}${name}`.trim() || id,
      metadata: {
        ...row,
        protein_types: proteinTypes,
      },
    };
  });
};

const fetchFormConfig = async (): Promise<DynamicFormConfig> => {
  try {
    const [showRequired, showHelp, validateChange, submitText] = await Promise.all([
      resolveConfig<boolean>('forms.show_required_indicator', true),
      resolveConfig<boolean>('forms.show_help_text', true),
      resolveConfig<boolean>('forms.validate_on_change', false),
      resolveConfig<string>('forms.submit_button_text', 'Submit'),
    ]);

    return {
      showRequiredIndicator: showRequired.value,
      showHelpText: showHelp.value,
      validateOnChange: validateChange.value,
      submitButtonText: submitText.value,
    };
  } catch {
    return DEFAULT_FORM_CONFIG;
  }
};

const loadDropdownResources = async (
  schema: BackendSchema | null
): Promise<{
  dropdownOptions: Record<string, PreloadedDropdownOption[]>;
  formConfig: DynamicFormConfig;
}> => {
  const fields = flattenSchemaFields(schema);
  const dropdownOptions: Record<string, PreloadedDropdownOption[]> = {};

  const needsMasterProducts = fields.some((field) => isMasterProductField(field));
  const [formConfig, masterProductOptions] = await Promise.all([
    fetchFormConfig(),
    needsMasterProducts ? fetchAllMasterProductOptions() : Promise.resolve([]),
  ]);

  await Promise.all(
    fields.map(async (field) => {
      if (field.choices?.length) {
        return;
      }

      const dataSource =
        field.ui && typeof field.ui === 'object'
          ? ((field.ui as Record<string, unknown>).data_source as Record<string, unknown> | undefined)
          : undefined;

      if (dataSource?.type === 'choice_list' && typeof dataSource.list === 'string') {
        dropdownOptions[field.key] = (await contactFormOptionsService.getSystemChoiceOptions(
          dataSource.list
        )) as PreloadedDropdownOption[];
        return;
      }

      if (isMasterProductField(field)) {
        dropdownOptions[field.key] = masterProductOptions;
        return;
      }

      if (field.related_entity) {
        dropdownOptions[field.key] = await fetchUniversalEntityFkOptions(field);
        return;
      }

      if (String(field.type || '').toLowerCase() === 'select') {
        const staticChoices = await getChoicesForField(field.key);
        if (staticChoices?.length) {
          dropdownOptions[field.key] = staticChoices as PreloadedDropdownOption[];
        }
      }
    })
  );

  return {
    dropdownOptions,
    formConfig,
  };
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
}) => {
  const normalized = useMemo(() => normalizeEntityType(entityType), [entityType]);
  const normalizedEntityKey = useMemo(() => normalizeEntityKey(entityType), [entityType]);
  const endpoint = useMemo(() => normalizeEntityEndpoint(entityType), [entityType]);
  const { isAuthenticated, loading: authLoading } = useAuthState();
  const queryClient = useQueryClient();
  const stableInitialValues = useDeepStableValue(initialValues ?? EMPTY_INITIAL_VALUES);

  const useUniversalInquiryCreate = getRuntimeConfigBoolean('USE_UNIVERSAL_INQUIRY_CREATE', false);
  const shouldRenderInquiryCreate =
    normalized === 'inquiry' && mode === 'create' && !useUniversalInquiryCreate && !forceUniversal;
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);
  const handleSuccess = useCallback(
    (result: unknown) => {
      onSuccess?.(result);
    },
    [onSuccess]
  );

  const derivedInitialValues = useMemo<Record<string, unknown>>(
    () => ({
      ...stableInitialValues,
      ...(context?.customerId != null ? { customer: String(context.customerId) } : {}),
      ...(context?.supplierId != null ? { supplier: String(context.supplierId) } : {}),
      ...(context?.contactId != null ? { contact: String(context.contactId) } : {}),
    }),
    [context?.contactId, context?.customerId, context?.supplierId, stableInitialValues]
  );

  const [draftValues, setDraftValues] = useState<Record<string, unknown> | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [extracting, setExtracting] = useState(false);

  const shouldHydrate = isOpen && !authLoading && isAuthenticated;
  const shouldLoadRecord =
    shouldHydrate &&
    (mode === 'edit' || mode === 'view' || mode === 'clone') &&
    entityId != null &&
    String(entityId).trim().length > 0;
  const supportsAutofill = EXTRACTABLE_ENTITY_KEYS.has(String(normalizedEntityKey || '').toLowerCase());
  const schemaQueryKey = useMemo(
    () => ['entity-form-schema', normalizedEntityKey] as const,
    [normalizedEntityKey]
  );
  const recordQueryKey = useMemo(
    () =>
      [
        'entity-form-record',
        normalizedEntityKey,
        entityId == null ? 'new' : String(entityId),
      ] as const,
    [entityId, normalizedEntityKey]
  );
  const recordQueryPrefix = useMemo(
    () => ['entity-form-record', normalizedEntityKey] as const,
    [normalizedEntityKey]
  );
  const documentsQueryKey = useMemo(
    () => ['entity-form-documents', normalizedEntityKey] as const,
    [normalizedEntityKey]
  );

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

  useEffect(() => {
    if (!isOpen) {
      setDraftValues(null);
      setSelectedDocumentId('');
      setExtracting(false);
    }
  }, [isOpen, entityId, entityType, mode]);

  const schemaQueryOptions = useMemo(
    () => ({
      queryKey: schemaQueryKey,
      queryFn: () => fetchUniversalEntitySchema(entityType),
      enabled: shouldHydrate,
      staleTime: 5 * 60 * 1000,
    }),
    [entityType, schemaQueryKey, shouldHydrate]
  );
  const schemaQuery = useQuery(schemaQueryOptions);

  const recordQueryOptions = useMemo(
    () => ({
      queryKey: recordQueryKey,
      queryFn: () => fetchUniversalEntityRecord(entityType, entityId as string | number),
      enabled: shouldLoadRecord,
      staleTime: Number.POSITIVE_INFINITY,
    }),
    [entityId, entityType, recordQueryKey, shouldLoadRecord]
  );
  const recordQuery = useQuery(recordQueryOptions);

  const mergedInitialValues = useMemo(
    () =>
      sanitizeInitialValuesForSchema(schemaQuery.data ?? null, {
        ...(recordQuery.data || {}),
        ...derivedInitialValues,
        ...(draftValues || {}),
      }),
    [derivedInitialValues, draftValues, recordQuery.data, schemaQuery.data]
  );

  const augmentedSchema = useMemo(
    () => augmentSchemaForFrontend(normalizedEntityKey, schemaQuery.data ?? null, mergedInitialValues),
    [mergedInitialValues, normalizedEntityKey, schemaQuery.data]
  );
  const hasAugmentedSchema = Boolean(augmentedSchema);

  const schemaResourcesSignature = useMemo(() => {
    return getStableSignature(
      flattenSchemaFields(augmentedSchema).map((field) => ({
        key: field.key,
        type: field.type,
        related_entity: field.related_entity,
        has_choices: Boolean(field.choices?.length),
        data_source: field.ui && typeof field.ui === 'object'
          ? (field.ui as Record<string, unknown>).data_source ?? null
          : null,
      }))
    );
  }, [augmentedSchema]);
  const stableResourceSchemaRef = useRef<BackendSchema | null>(null);
  const stableResourceSignatureRef = useRef('');

  if (stableResourceSignatureRef.current !== schemaResourcesSignature) {
    stableResourceSignatureRef.current = schemaResourcesSignature;
    stableResourceSchemaRef.current = augmentedSchema;
  }

  const resourcesQueryOptions = useMemo(
    () => ({
      queryKey: ['entity-form-resources', normalizedEntityKey, schemaResourcesSignature] as const,
      queryFn: () => loadDropdownResources(stableResourceSchemaRef.current),
      enabled: shouldHydrate && hasAugmentedSchema,
      staleTime: 5 * 60 * 1000,
    }),
    [hasAugmentedSchema, normalizedEntityKey, schemaResourcesSignature, shouldHydrate]
  );
  const resourcesQuery = useQuery(resourcesQueryOptions);

  const documentsQueryOptions = useMemo(
    () => ({
      queryKey: documentsQueryKey,
      queryFn: documentsApi.list,
      enabled: shouldHydrate && supportsAutofill,
      staleTime: 60 * 1000,
    }),
    [documentsQueryKey, shouldHydrate, supportsAutofill]
  );
  const documentsQuery = useQuery(documentsQueryOptions);

  const normalizedDocuments = useMemo(
    () =>
      (documentsQuery.data || []).map((document) => ({
        id: String(document.id),
        original_filename: document.original_filename,
      })),
    [documentsQuery.data]
  );

  useEffect(() => {
    if (!supportsAutofill || selectedDocumentId || normalizedDocuments.length === 0) {
      return;
    }

    setSelectedDocumentId(normalizedDocuments[0]?.id || '');
  }, [normalizedDocuments, selectedDocumentId, supportsAutofill]);

  const formLoading =
    (isOpen && authLoading) ||
    (shouldHydrate &&
      (schemaQuery.isLoading ||
        schemaQuery.isPending ||
        (shouldLoadRecord && (recordQuery.isLoading || recordQuery.isPending)) ||
        resourcesQuery.isLoading ||
        resourcesQuery.isPending ||
        (supportsAutofill && (documentsQuery.isLoading || documentsQuery.isPending))));

  const formLoadError =
    !authLoading && !isAuthenticated && isOpen
      ? buildUnauthorizedLoadError()
      : schemaQuery.error || recordQuery.error || resourcesQuery.error || documentsQuery.error || null;

  const formKey = useMemo(
    () =>
      getStableSignature({
        entityType: normalizedEntityKey,
        mode,
        entityId: shouldLoadRecord ? String(entityId) : 'new',
        seed: mergedInitialValues,
      }),
    [entityId, mergedInitialValues, mode, normalizedEntityKey, shouldLoadRecord]
  );

  const handleSubmit = useCallback(
    async (payload: Record<string, unknown>) => {
      const hasEntityId = entityId != null && String(entityId).trim().length > 0;
      const isEditSubmit = hasEntityId && mode === 'edit';
      const response = isEditSubmit
        ? await businessApi.patch(`${endpoint}${entityId}/`, payload)
        : await businessApi.post(endpoint, payload);

      await queryClient.invalidateQueries({
        queryKey: recordQueryPrefix,
      });

      return response.data;
    },
    [endpoint, entityId, mode, queryClient, recordQueryPrefix]
  );

  const runExtraction = useCallback(
    async (documentId: string) => {
      if (!documentId) {
        message.error('Select a document first');
        return;
      }

      setExtracting(true);
      try {
        const response = await schemaExtractionApi.extractToSchema({
          document_id: documentId,
          entity_type: normalizedEntityKey,
        });
        setDraftValues((response.extracted_data || {}) as Record<string, unknown>);
        message.success('Draft autofilled from document');
      } catch (error) {
        const typed = error as { response?: { data?: { error?: string } }; message?: string };
        message.error(typed.response?.data?.error || typed.message || 'Unable to extract document');
      } finally {
        setExtracting(false);
      }
    },
    [normalizedEntityKey]
  );

  const handleUploadAndExtract = useCallback(
    async (file: File) => {
      setExtracting(true);
      try {
        const uploaded = await documentsApi.upload(file);
        const nextDocument = {
          id: String(uploaded.id),
          original_filename: uploaded.original_filename,
        };

        queryClient.setQueryData(documentsQueryKey, (current: unknown) => {
          const existing = Array.isArray(current) ? current : [];
          return [
            uploaded,
            ...existing.filter((entry) => String((entry as { id?: string | number }).id ?? '') !== nextDocument.id),
          ];
        });
        setSelectedDocumentId(nextDocument.id);
        await runExtraction(nextDocument.id);
      } catch (error) {
        const typed = error as { response?: { data?: { error?: string } }; message?: string };
        message.error(typed.response?.data?.error || typed.message || 'Unable to upload document');
        setExtracting(false);
      }
    },
    [documentsQueryKey, queryClient, runExtraction]
  );

  if (!isOpen) {
    return null;
  }

  if (shouldRenderInquiryCreate) {
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

  if (variant === 'inline' && formLoading) {
    return (
      <div data-testid="entity-form-loading" style={{ padding: 16 }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (variant === 'inline' && (formLoadError || !augmentedSchema)) {
    return (
      <div
        data-testid="entity-form-load-error"
        style={{ padding: 12, color: 'rgb(var(--color-text-secondary))', fontSize: 13 }}
      >
        {(formLoadError as { response?: { status?: number } } | null)?.response?.status === 401 ||
        (formLoadError as { response?: { status?: number } } | null)?.response?.status === 403
          ? 'Authentication required. Redirecting to login…'
          : 'Unable to load form.'}
      </div>
    );
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
      initialData={mergedInitialValues}
      schema={augmentedSchema}
      dropdownOptions={resourcesQuery.data?.dropdownOptions || {}}
      formConfig={resourcesQuery.data?.formConfig || DEFAULT_FORM_CONFIG}
      loading={formLoading}
      loadError={formLoadError}
      onSubmit={handleSubmit}
      autofill={
        supportsAutofill
          ? {
              documents: normalizedDocuments,
              selectedDocumentId,
              loadingDocuments: documentsQuery.isLoading || documentsQuery.isPending,
              extracting,
              onDocumentChange: setSelectedDocumentId,
              onExtract: () => {
                void runExtraction(selectedDocumentId);
              },
              onUpload: (file) => {
                void handleUploadAndExtract(file);
              },
            }
          : null
      }
    />
  );
};

export default EntityFormSurface;
