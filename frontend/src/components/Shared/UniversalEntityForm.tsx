/**
 * UniversalEntityForm
 *
 * Schema-driven create/edit form surface.
 *
 * Responsibilities:
 * - Fetch entity schema + existing values (edit)
 * - Render fields via DynamicFormEngine
 * - Provide tenant-safe, service-layer-backed persistence
 *
 * Notes:
 * - All requests must go through businessApi/apiClient (service layer)
 * - Foreign keys should use SearchableSelect to avoid massive dropdowns
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal, Spin, message, Select, Skeleton } from 'antd';
import styled from 'styled-components';
import { businessApi } from '../../services/businessApi';
import { apiClient } from '../../services/apiService';
import DynamicFormEngine from '../../features/system/DynamicFormEngine';
import EntityOptionsSelect from '../FormSubmission/SearchableSelect';
import { isValidEmail } from '../../shared/utils';

export type UniversalEntityFormMode = 'create' | 'edit' | 'view';
export type UniversalEntityFormVariant = 'modal' | 'inline';

export interface UniversalEntityFormProps {
  entityType: string;
  entityId?: string | number;

  /**
   * Form mode:
   * - create: create new record
   * - edit: edit existing record
   * - view: read-only view with optional switch to edit
   */
  mode?: UniversalEntityFormMode;

  /**
   * Render surface.
   * - modal: wraps form in a modal (default)
   * - inline: renders directly (embeddable into pages/panels)
   */
  variant?: UniversalEntityFormVariant;

  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: unknown) => void;
  initialValues?: Record<string, unknown>;

  /** Optional override for prioritizing key fields first. */
  keyFields?: string[];

  /** When true, allows switching view → edit within the same surface. */
  allowModeSwitch?: boolean;
}

type SchemaChoice = { value: unknown; label: string };

type BackendField = {
  key: string;
  label?: string;
  type?: string;
  required?: boolean;
  placeholder?: string | null;
  help_text?: string;
  // Relationship metadata (schema endpoint)
  related_entity?: string | null;
  choices?: SchemaChoice[] | null;
};

type BackendSchema = {
  name?: string;
  description?: string;
  fields?: BackendField[];
  key_fields?: string[];
};

const Container = styled.div`
  width: 100%;
  min-height: 520px;
`;

const normalizeEntityKey = (entityType: string): string => {
  const raw = String(entityType || '').trim();
  const lower = raw.toLowerCase();

  // Common UI paths → introspection aliases.
  if (lower === 'sales-orders' || lower === 'sales_orders') return 'sales_order';
  if (lower === 'purchase-orders' || lower === 'purchase_orders') return 'purchase_order';

  // Plural resources commonly used in UI routes.
  if (lower === 'customers' || lower === 'customer') return 'customer';
  if (lower === 'suppliers' || lower === 'supplier') return 'supplier';
  if (lower === 'contacts' || lower === 'contact') return 'contact';
  if (lower === 'products' || lower === 'product') return 'product';
  if (lower === 'invoices' || lower === 'invoice') return 'invoice';

  if (lower === 'inquiries' || lower === 'inquiry') return 'inquiries.inquiry';
  if (lower === 'claims' || lower === 'claim') return 'invoices.claim';

  // Fallback: pass through.
  return raw;
};

const normalizeEntityEndpoint = (entityType: string): string => {
  const lower = String(entityType || '').toLowerCase();
  if (lower === 'sales-orders' || lower === 'sales_orders' || lower === 'sales_order')
    return 'sales-orders/';
  if (lower === 'purchase-orders' || lower === 'purchase_orders' || lower === 'purchase_order')
    return 'purchase-orders/';
  if (lower === 'inquiries' || lower === 'inquiry') return 'inquiries/';

  // Accounting canonical paths (legacy aliases still exist server-side).
  if (lower === 'claims' || lower === 'claim') return 'accounting/claims/';
  if (lower === 'invoices' || lower === 'invoice') return 'accounting/invoices/';

  // Common singular → plural API resources
  if (lower === 'customer') return 'customers/';
  if (lower === 'supplier') return 'suppliers/';
  if (lower === 'contact') return 'contacts/';
  if (lower === 'product') return 'products/';

  return `${lower.replace(/^\/+/, '').replace(/\/+$/, '')}/`;
};

const relatedEntityToEntityOptionsType = (relatedEntity: string | null | undefined, fieldKey: string): string | null => {
  const related = String(relatedEntity || '').toLowerCase();
  const key = String(fieldKey || '').toLowerCase();

  if (!related && !key) return null;

  if (related.includes('customers.') || key === 'customer') return 'customer';
  if (related.includes('suppliers.') || key === 'supplier') return 'supplier';
  if (related.includes('contacts.') || key === 'contact') return 'contact';
  if (related.includes('purchase_orders.') || key === 'purchase_order') return 'purchase_order';
  if (related.includes('sales_orders.') || key === 'sales_order') return 'sales_order';
  if (related.includes('inquiries.') || key === 'inquiry') return 'inquiry';
  if (related.includes('invoices.') || key === 'invoice') return 'invoice';
  if (key.includes('product') || related.includes('system.product')) return 'product';

  return null;
};

const shouldSkipField = (key: string): boolean => {
  const k = String(key || '').toLowerCase();
  return [
    'id',
    'uuid',
    'tenant',
    'custom_data',
    'created_at',
    'updated_at',
    'created_on',
    'updated_on',
    'modified_on',
    'created_by',
  ].includes(k);
};

const mapDrfOptionsType = (t: string | undefined): string => {
  const type = String(t || '').toLowerCase();
  if (type.includes('boolean')) return 'checkbox';
  if (type.includes('date') && !type.includes('datetime')) return 'date';
  if (type.includes('datetime')) return 'datetime';
  if (
    type.includes('decimal') ||
    type.includes('float') ||
    type.includes('integer') ||
    type.includes('number')
  )
    return 'number';
  if (type.includes('email')) return 'email';
  if (type.includes('url')) return 'url';
  if (type.includes('choice') || type.includes('select')) return 'select';
  if (type.includes('text') || type.includes('textarea')) return 'textarea';
  return 'text';
};

export const UniversalEntityForm: React.FC<UniversalEntityFormProps> = ({
  entityType,
  entityId,
  mode,
  variant = 'modal',
  isOpen,
  onClose,
  onSuccess,
  initialValues,
  keyFields,
  allowModeSwitch,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [schema, setSchema] = useState<BackendSchema | null>(null);
  const [recordValues, setRecordValues] = useState<Record<string, unknown> | null>(null);

  const inferredMode: UniversalEntityFormMode = useMemo(() => {
    if (mode) return mode;
    return entityId != null && String(entityId).trim() ? 'edit' : 'create';
  }, [entityId, mode]);

  const canSwitchModes = allowModeSwitch ?? inferredMode === 'view';
  const [activeMode, setActiveMode] = useState<UniversalEntityFormMode>(inferredMode);

  const [fkValues, setFkValues] = useState<Record<string, unknown>>({});
  const [fkOptions, setFkOptions] = useState<
    Record<string, Array<{ id: string | number; name: string }>>
  >({});
  const [productOptions, setProductOptions] = useState<
    Record<string, Array<{ value: string; label: string }>>
  >({});
  const [loadingProducts, setLoadingProducts] = useState<Record<string, boolean>>({});
  const [showAllFields, setShowAllFields] = useState(false);

  const productSearchSeqRef = useRef<Record<string, number>>({});

  const schemaEntityKey = useMemo(() => normalizeEntityKey(entityType), [entityType]);
  const endpoint = useMemo(() => normalizeEntityEndpoint(entityType), [entityType]);

  const loadSchema = useCallback(async () => {
    // 1) Preferred: metadata endpoint (tenant-safe)
    try {
      const resp = await businessApi.get('/system/forms/schema/', {
        params: { entity_type: schemaEntityKey },
      });
      return (resp.data ?? null) as BackendSchema | null;
    } catch {
      // 2) Fallback: DRF OPTIONS on the resource endpoint
      try {
        const resp = await apiClient.options(endpoint);

        const data = resp.data as unknown;
        const actions =
          data && typeof data === 'object' && 'actions' in data
            ? ((data as Record<string, unknown>).actions as Record<string, unknown> | undefined)
            : undefined;

        const postFields =
          (actions && 'POST' in actions ? (actions.POST as Record<string, unknown>) : {}) || {};

        const fields: BackendField[] = Object.entries(postFields).map(([key, meta]) => {
          const metaObj =
            (meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {}) || {};
          const choicesRaw = metaObj.choices;
          const choices = Array.isArray(choicesRaw)
            ? choicesRaw.map((c: unknown) => {
                const choice =
                  (c && typeof c === 'object' ? (c as Record<string, unknown>) : {}) || {};
                const value = choice.value;
                const label =
                  (typeof choice.display_name === 'string' && choice.display_name) ||
                  (value != null ? String(value) : '');
                return { value, label };
              })
            : null;

          return {
            key,
            label: (typeof metaObj.label === 'string' && metaObj.label) || key,
            type: mapDrfOptionsType(typeof metaObj.type === 'string' ? metaObj.type : undefined),
            required: Boolean(metaObj.required),
            help_text: (typeof metaObj.help_text === 'string' && metaObj.help_text) || '',
            choices,
          };
        });

        return {
          name: `Universal Form: ${entityType}`,
          description: 'Auto-derived from OPTIONS.',
          fields,
        };
      } catch (err) {
        throw err;
      }
    }
  }, [endpoint, entityType, schemaEntityKey]);

  useEffect(() => {
    if (!isOpen) return;

    setShowAllFields(false);
    setActiveMode(inferredMode);
    setRecordValues(null);

    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const nextSchema = await loadSchema();
        if (!mounted) return;
        setSchema(nextSchema);

        const shouldLoadRecord =
          inferredMode !== 'create' && entityId != null && String(entityId).trim().length > 0;

        let nextRecord: Record<string, unknown> | null = null;
        if (shouldLoadRecord) {
          const resp = await apiClient.get(`${endpoint}${entityId}/`);
          const data = resp.data as unknown;
          nextRecord = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
        }

        if (!mounted) return;
        setRecordValues(nextRecord);

        const merged: Record<string, unknown> = { ...(nextRecord || {}), ...(initialValues || {}) };
        setFkValues(merged);
      } catch (err: unknown) {
        if (!mounted) return;
        setSchema(null);
        setRecordValues(null);
        const errorMessage =
          typeof (err as { response?: { data?: { error?: string } } })?.response?.data?.error ===
          'string'
            ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
            : 'Failed to load form';
        message.error(errorMessage);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [endpoint, entityId, inferredMode, initialValues, isOpen, loadSchema]);

  // Load basic FK option lists (best-effort) for non-product references.
  useEffect(() => {
    if (!isOpen || !schema?.fields?.length) return;

    const fkFields = schema.fields.filter(
      (f) => !shouldSkipField(f.key) && Boolean(f.related_entity)
    );
    if (!fkFields.length) return;

    let cancelled = false;

    const loadFk = async () => {
      for (const f of fkFields) {
        const related = String(f.related_entity || '').toLowerCase();
        if (
          !related ||
          related.includes('system.product') ||
          String(f.key).toLowerCase().includes('product')
        ) {
          continue;
        }

        // Minimal mapping for top FK types.
        const relatedEndpoint = related.includes('customers.')
          ? 'customers/'
          : related.includes('suppliers.')
            ? 'suppliers/'
            : related.includes('contacts.')
              ? 'contacts/'
              : null;

        if (!relatedEndpoint) continue;

        try {
          const resp = await apiClient.get(relatedEndpoint, { params: { page_size: 200 } });
          const payload = resp.data as unknown;

          const payloadObj =
            typeof payload === 'object' && payload ? (payload as Record<string, unknown>) : null;
          const rows = Array.isArray(payloadObj?.results) ? payloadObj?.results : payload;

          const options = (Array.isArray(rows) ? rows : []).map((r: unknown) => {
            const row = (r && typeof r === 'object' ? (r as Record<string, unknown>) : {}) || {};
            return {
              id: (row.id as string | number | undefined) ?? '',
              name:
                (typeof row.name === 'string' && row.name) ||
                (typeof row.company_name === 'string' && row.company_name) ||
                (typeof row.full_name === 'string' && row.full_name) ||
                (typeof row.email === 'string' && row.email) ||
                String(row.id ?? ''),
            };
          });

          if (cancelled) return;
          setFkOptions((prev) => ({ ...prev, [f.key]: options }));
        } catch {
          // ignore
        }
      }
    };

    void loadFk();

    return () => {
      cancelled = true;
    };
  }, [isOpen, schema?.fields]);

  const preferredKeys = useMemo(() => {
    const normalized = schemaEntityKey.toLowerCase();
    const defaultKeyFields: Record<string, string[]> = {
      customer: [
        'name',
        'contact_person',
        'email',
        'phone_type',
        'phone',
        'street_address',
        'city',
        'state',
        'zip_code',
      ],
      supplier: [
        'name',
        'contact_person',
        'email',
        'phone_type',
        'phone',
        'street_address',
        'city',
        'state',
        'zip_code',
      ],
      contact: ['full_name', 'email', 'phone_type', 'phone', 'contact_type'],
      'inquiries.inquiry': [
        'entity_type',
        'customer',
        'supplier',
        'contact_name',
        'contact_email',
        'contact_phone_type',
        'contact_phone',
        'valid_until',
      ],
      inquiry: [
        'entity_type',
        'customer',
        'supplier',
        'contact_name',
        'contact_email',
        'contact_phone_type',
        'contact_phone',
        'valid_until',
      ],
      sales_order: ['customer', 'order_date', 'delivery_date', 'status', 'notes'],
      purchase_order: ['supplier', 'product', 'order_date', 'delivery_date', 'status', 'notes'],
      invoice: ['customer', 'invoice_date', 'status', 'notes'],
      product: ['name', 'product_code', 'protein_type', 'packaging_type', 'weight_unit'],
    };

    return (
      (keyFields && keyFields.length
        ? keyFields
        : schema?.key_fields && schema.key_fields.length
          ? schema.key_fields
          : defaultKeyFields[normalized]) ||
      []
    );
  }, [keyFields, schema?.key_fields, schemaEntityKey]);

  const preferredKeySet = useMemo(() => {
    return new Set(preferredKeys.map((k) => String(k).toLowerCase()));
  }, [preferredKeys]);

  const preferredKeyRank = useMemo(() => {
    return new Map(preferredKeys.map((k, idx) => [String(k).toLowerCase(), idx] as const));
  }, [preferredKeys]);

  const fkFields = useMemo(() => {
    return (schema?.fields ?? []).filter((f) => !shouldSkipField(f.key) && Boolean(f.related_entity));
  }, [schema?.fields]);

  const keyFkFields = useMemo(() => {
    const keyOnes = fkFields.filter((f) => preferredKeySet.has(String(f.key).toLowerCase()));

    return [...keyOnes].sort((a, b) => {
      const ka = String(a.key).toLowerCase();
      const kb = String(b.key).toLowerCase();
      const ra = preferredKeyRank.has(ka) ? (preferredKeyRank.get(ka) as number) : 9999;
      const rb = preferredKeyRank.has(kb) ? (preferredKeyRank.get(kb) as number) : 9999;
      if (ra !== rb) return ra - rb;
      return String(a.label || a.key).localeCompare(String(b.label || b.key));
    });
  }, [fkFields, preferredKeyRank, preferredKeySet]);

  const otherFkFields = useMemo(() => {
    const others = fkFields.filter((f) => !preferredKeySet.has(String(f.key).toLowerCase()));
    return [...others].sort((a, b) => String(a.label || a.key).localeCompare(String(b.label || b.key)));
  }, [fkFields, preferredKeySet]);

  const scalarFields = useMemo(() => {
    const raw = (schema?.fields ?? [])
      .filter((f) => !shouldSkipField(f.key))
      .filter((f) => !f.related_entity)
      .map((f) => ({
        key: f.key,
        label: f.label || f.key,
        type: f.choices?.length ? 'select' : String(f.type ?? 'text'),
        required: Boolean(f.required),
        options: f.choices?.map((c) => String(c.value)) || undefined,
        placeholder: f.placeholder || undefined,
        help_text: f.help_text,
      }));

    if (!preferredKeys.length) return raw;

    const rank = new Map(preferredKeys.map((k, idx) => [String(k).toLowerCase(), idx] as const));
    return [...raw].sort((a, b) => {
      const ra = rank.has(a.key.toLowerCase()) ? (rank.get(a.key.toLowerCase()) as number) : 9999;
      const rb = rank.has(b.key.toLowerCase()) ? (rank.get(b.key.toLowerCase()) as number) : 9999;
      if (ra !== rb) return ra - rb;
      return a.label.localeCompare(b.label);
    });
  }, [preferredKeys, schema?.fields]);

  type DynamicSchema = {
    step_index: number;
    name: string;
    description?: string;
    fields: typeof scalarFields;
  };

  const dynamicSchema: DynamicSchema = useMemo(() => {
    return {
      step_index: 0,
      name: schema?.name || `Universal Form: ${entityType}`,
      description: schema?.description,
      fields: scalarFields,
    };
  }, [entityType, scalarFields, schema?.description, schema?.name]);

  const formInitialValues = useMemo(() => {
    return { ...(recordValues || {}), ...(initialValues || {}) };
  }, [initialValues, recordValues]);

  const submit = useCallback(
    async (data: Record<string, unknown>) => {
      const payload: Record<string, unknown> = { ...data };

      // Enforce required FK fields (they are rendered outside DynamicFormEngine).
      const missingFk = fkFields
        .filter((f) => Boolean(f.required))
        .filter((f) => {
          const v = fkValues[f.key] ?? formInitialValues?.[f.key];
          return v === undefined || v === null || v === '';
        });
      if (missingFk.length) {
        const missingHiddenFk = missingFk.filter((f) => !preferredKeySet.has(String(f.key).toLowerCase()));
        if (missingHiddenFk.length && !showAllFields) {
          setShowAllFields(true);
        }

        message.error(`Please select ${missingFk[0].label || missingFk[0].key}`);
        return;
      }

      // Merge FK values into payload.
      fkFields.forEach((f) => {
        if (fkValues[f.key] !== undefined) {
          payload[f.key] = fkValues[f.key];
        }
      });

      // Merge explicit initial values for fields not rendered by the schema.
      if (initialValues) {
        Object.entries(initialValues).forEach(([k, v]) => {
          if (payload[k] === undefined && v !== undefined) payload[k] = v;
        });
      }

      // Normalize payload (avoid sending empty strings that cause DRF validation errors).
      const numberKeys = new Set(
        (scalarFields || []).filter((f) => String(f.type).toLowerCase() === 'number').map((f) => f.key)
      );
      const emailKeySet = new Set(
        (scalarFields || [])
          .filter((f) => {
            const key = String(f.key || '').toLowerCase();
            const type = String(f.type || '').toLowerCase();
            return key.includes('email') || type.includes('email');
          })
          .map((f) => f.key)
      );
      const emailLabelByKey = new Map(
        (scalarFields || [])
          .filter((f) => emailKeySet.has(f.key))
          .map((f) => [f.key, f.label || f.key] as const)
      );
      const zipKeySet = new Set(
        (scalarFields || [])
          .filter((f) => String(f.key || '').toLowerCase().includes('zip_code'))
          .map((f) => f.key)
      );
      const zipLabelByKey = new Map(
        (scalarFields || [])
          .filter((f) => zipKeySet.has(f.key))
          .map((f) => [f.key, f.label || f.key] as const)
      );

      Object.entries(payload).forEach(([k, v]) => {
        if (v === '') {
          delete payload[k];
          return;
        }
        if (typeof v === 'string') {
          const trimmed = v.trim();
          if (!trimmed) {
            delete payload[k];
            return;
          }
          if (zipKeySet.has(k)) {
            payload[k] = trimmed.replace(/\D/g, '').slice(0, 5);
            return;
          }
          if (numberKeys.has(k)) {
            const n = Number(trimmed);
            if (Number.isFinite(n)) payload[k] = n;
          } else {
            payload[k] = trimmed;
          }
        }
      });

      // Validate email(s) before submit.
      for (const k of emailKeySet) {
        const v = payload[k];
        if (typeof v === 'string' && v.trim() && !isValidEmail(v.trim())) {
          const label = emailLabelByKey.get(k) || k;
          message.error(`Please enter a valid email for ${label}`);
          return;
        }
      }

      // Validate ZIP code(s) before submit.
      for (const k of zipKeySet) {
        const v = payload[k];
        if (typeof v === 'string' && v.trim() && !/^\d{5}$/.test(v.trim())) {
          const label = zipLabelByKey.get(k) || k;
          message.error(`${label} must be exactly 5 digits`);
          return;
        }
      }

      try {
        setSubmitting(true);
        const resp = entityId
          ? await apiClient.patch(`${endpoint}${entityId}/`, payload)
          : await apiClient.post(endpoint, payload);

        onSuccess?.(resp.data);
        onClose();
      } catch (err: unknown) {
        console.error('[UniversalEntityForm] Submit failed:', err);
        const typed = err as {
          response?: {
            data?: unknown;
          };
          message?: string;
        };

        const data = typed?.response?.data;
        if (data && typeof data === 'object') {
          const obj = data as Record<string, unknown>;
          const top =
            (typeof obj.error === 'string' && obj.error) ||
            (typeof obj.detail === 'string' && obj.detail) ||
            null;

          if (top) {
            message.error(top);
          } else {
            const firstField = Object.entries(obj).find(([, v]) => Array.isArray(v) || typeof v === 'string');
            const fieldMsg = firstField
              ? Array.isArray(firstField[1])
                ? String((firstField[1] as unknown[])[0] ?? 'Invalid value')
                : String(firstField[1])
              : null;
            message.error(fieldMsg || 'Failed to submit form');
          }
        } else if (typeof data === 'string' && data) {
          message.error(data);
        } else {
          message.error(typed?.message || 'Failed to submit form');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [
      endpoint,
      entityId,
      fkFields,
      fkValues,
      formInitialValues,
      initialValues,
      onClose,
      onSuccess,
      preferredKeySet,
      scalarFields,
      showAllFields,
    ]
  );

  const fetchProducts = useCallback(
    async (fieldKey: string, q: string) => {
      const nextSeq = (productSearchSeqRef.current[fieldKey] ?? 0) + 1;
      productSearchSeqRef.current[fieldKey] = nextSeq;

      setLoadingProducts((prev) => ({ ...prev, [fieldKey]: true }));
      try {
        const resp = await businessApi.get('/system/products/', {
          params: { search: q || undefined, page_size: 50, limit: 50, is_active: true },
        });

        // Ignore out-of-order responses.
        if (productSearchSeqRef.current[fieldKey] !== nextSeq) return;

        const payload = resp.data as unknown;
        const payloadObj =
          typeof payload === 'object' && payload ? (payload as Record<string, unknown>) : null;
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payloadObj?.results)
            ? payloadObj?.results
            : [];

        const opts = rows.map((p: unknown) => {
          const row = (p && typeof p === 'object' ? (p as Record<string, unknown>) : {}) || {};
          const id = row.id;
          const code = typeof row.product_code === 'string' ? row.product_code : '';
          const name =
            typeof row.name === 'string'
              ? row.name
              : typeof row.effective_name === 'string'
                ? row.effective_name
                : '';
          const label = `${code ? `${code} - ` : ''}${name}`.trim() || String(id ?? '');
          return { value: String(id ?? ''), label };
        });

        // Replace options for the current search (so results actually refresh on every keystroke),
        // but keep the currently-selected value so it doesn't disappear.
        const selectedValue = String((fkValues[fieldKey] as string | number | undefined) ?? '');

        setProductOptions((prev) => {
          const selected = selectedValue
            ? (prev[fieldKey] || []).find((o) => String(o.value) === selectedValue)
            : undefined;

          const merged = [...opts];
          if (selected && !merged.some((o) => String(o.value) === String(selected.value))) {
            merged.unshift(selected);
          }

          return {
            ...prev,
            [fieldKey]: merged,
          };
        });
      } catch (err) {
        console.error('[UniversalEntityForm] Failed to search products:', err);
      } finally {
        if (productSearchSeqRef.current[fieldKey] === nextSeq) {
          setLoadingProducts((prev) => ({ ...prev, [fieldKey]: false }));
        }
      }
    },
    [fkValues]
  );

  if (variant === 'inline' && !isOpen) return null;

  const formatValue = (v: unknown): string => {
    if (v === undefined || v === null) return '';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(formatValue).filter(Boolean).join(', ');
    if (typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      const name = typeof obj.name === 'string' ? obj.name : null;
      if (name) return name;
      const id = obj.id;
      if (id != null) return String(id);
      try {
        return JSON.stringify(obj);
      } catch {
        return '[object]';
      }
    }
    return String(v);
  };

  const keyScalarFields = scalarFields.filter((f) => preferredKeySet.has(String(f.key).toLowerCase()));
  const otherScalarFields = scalarFields.filter((f) => !preferredKeySet.has(String(f.key).toLowerCase()));
  const visibleScalarFields = [...keyScalarFields, ...(showAllFields ? otherScalarFields : [])];

  const showVisibilityToggle =
    otherFkFields.length > 0 || otherScalarFields.length > 0;

  const modeSwitchControls =
    entityId != null &&
    canSwitchModes && (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 10 }}>
        {activeMode === 'view' ? (
          <Button type="primary" onClick={() => setActiveMode('edit')}>
            Edit
          </Button>
        ) : inferredMode === 'view' ? (
          <Button onClick={() => setActiveMode('view')} disabled={submitting}>
            View
          </Button>
        ) : null}
      </div>
    );

  const content = (
    <Container>
      {loading ? (
        <div style={{ padding: 16 }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      ) : !schema ? (
        <div style={{ padding: 12, color: 'rgb(var(--color-text-secondary))', fontSize: 13 }}>
          Unable to load form.
        </div>
      ) : (
        <>
          {modeSwitchControls}

          {(keyFkFields.length > 0 || otherFkFields.length > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 10 }}>
              {[...keyFkFields, ...(showAllFields ? otherFkFields : [])].map((f) => {
                const related = String(f.related_entity || '').toLowerCase();
                const isProduct =
                  related.includes('system.product') ||
                  String(f.key).toLowerCase().includes('product');

                const value = String((fkValues[f.key] as string | number | undefined) ?? '');

                if (activeMode === 'view') {
                  return (
                    <div key={f.key}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'rgb(var(--color-text-secondary))',
                          marginBottom: 6,
                        }}
                      >
                        {f.label || f.key}
                      </div>
                      <div
                        style={{
                          padding: '10px 12px',
                          border: '1px solid rgb(var(--color-border))',
                          borderRadius: 8,
                          background: 'rgb(var(--color-input-readonly))',
                          color: 'rgb(var(--color-text-primary))',
                          fontSize: 13,
                        }}
                      >
                        {formatValue(formInitialValues[f.key]) || '—'}
                      </div>
                    </div>
                  );
                }

                if (isProduct) {
                  return (
                    <div key={f.key}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'rgb(var(--color-text-secondary))',
                          marginBottom: 6,
                        }}
                      >
                        {f.label || f.key}
                      </div>
                      <Select
                        showSearch
                        filterOption={false}
                        onDropdownVisibleChange={(open) => {
                          if (open && (productOptions[f.key] || []).length === 0) {
                            void fetchProducts(f.key, '');
                          }
                        }}
                        onSearch={(q) => void fetchProducts(f.key, q)}
                        options={productOptions[f.key] || []}
                        value={value || undefined}
                        onChange={(next) => setFkValues((prev) => ({ ...prev, [f.key]: String(next) }))}
                        notFoundContent={loadingProducts[f.key] ? <Spin size="small" /> : null}
                        style={{ width: '100%' }}
                        placeholder="Search products…"
                      />
                    </div>
                  );
                }

                const mapped = relatedEntityToEntityOptionsType(f.related_entity, f.key);

                if (mapped && mapped !== 'product') {
                  return (
                    <div key={f.key}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'rgb(var(--color-text-secondary))',
                          marginBottom: 6,
                        }}
                      >
                        {f.label || f.key}
                      </div>
                      <EntityOptionsSelect
                        entityType={mapped}
                        value={value}
                        onChange={(next) => setFkValues((prev) => ({ ...prev, [f.key]: next }))}
                        placeholder={`Search ${f.label || f.key}…`}
                        forceSearch
                        debounceMs={0}
                      />
                    </div>
                  );
                }

                const options = fkOptions[f.key] || [];
                return (
                  <div key={f.key}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'rgb(var(--color-text-secondary))',
                        marginBottom: 6,
                      }}
                    >
                      {f.label || f.key}
                    </div>
                    <Select
                      showSearch
                      options={options.map((o) => ({ value: String(o.id), label: o.name }))}
                      value={value || undefined}
                      onChange={(next) => setFkValues((prev) => ({ ...prev, [f.key]: String(next) }))}
                      style={{ width: '100%' }}
                      placeholder={`Select ${f.label || f.key}`}
                      filterOption={(input, option) =>
                        String(option?.label || '').toLowerCase().includes(String(input || '').toLowerCase())
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}

          {showVisibilityToggle && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <Button
                type="link"
                onClick={() => setShowAllFields((v) => !v)}
                style={{ padding: 0, height: 'auto' }}
              >
                {showAllFields ? 'Show fewer fields' : 'Show all fields'}
              </Button>
            </div>
          )}

          {activeMode === 'view' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {visibleScalarFields.map((f) => (
                <div key={f.key}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'rgb(var(--color-text-secondary))',
                      marginBottom: 6,
                    }}
                  >
                    {f.label || f.key}
                  </div>
                  <div
                    style={{
                      padding: '10px 12px',
                      border: '1px solid rgb(var(--color-border))',
                      borderRadius: 8,
                      background: 'rgb(var(--color-input-readonly))',
                      color: 'rgb(var(--color-text-primary))',
                      fontSize: 13,
                    }}
                  >
                    {formatValue(formInitialValues[f.key]) || '—'}
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <Button onClick={onClose} disabled={submitting}>
                  Close
                </Button>
                {entityId != null && canSwitchModes && (
                  <Button type="primary" onClick={() => setActiveMode('edit')}>
                    Edit
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <DynamicFormEngine
              schema={dynamicSchema as any}
              initialValues={formInitialValues}
              isSubmitting={submitting}
              submitLabel={entityId ? 'Save' : 'Create'}
              keyFieldKeys={preferredKeys}
              showAllFields={showAllFields}
              onShowAllFieldsChange={setShowAllFields}
              showAllFieldsToggle={false}
              onSubmit={(data) => {
                void submit(data);
              }}
              onCancel={() => {
                if (submitting) return;
                if (inferredMode === 'view' && canSwitchModes) {
                  setActiveMode('view');
                  return;
                }
                onClose();
              }}
            />
          )}
        </>
      )}
    </Container>
  );

  if (variant === 'inline') return content;

  return (
    <Modal
      open={isOpen}
      onCancel={() => {
        if (submitting) return;
        onClose();
      }}
      maskClosable={!submitting}
      keyboard={!submitting}
      footer={null}
      width={720}
      destroyOnClose
      title={schema?.name || (entityId ? `${entityType} ${entityId}` : `New ${entityType}`)}
    >
      {content}
    </Modal>
  );
};

export default UniversalEntityForm;
