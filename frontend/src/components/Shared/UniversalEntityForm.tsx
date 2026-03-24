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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Spin, message, Select, Skeleton } from 'antd';
import styled from 'styled-components';
import { businessApi } from '../../services/businessApi';
import { apiClient } from '../../services/apiService';
import DynamicFormEngine from '../../features/system/DynamicFormEngine';
import { SearchableSelect } from './SearchableSelect';

export interface UniversalEntityFormProps {
  entityType: string;
  entityId?: string | number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: unknown) => void;
  initialValues?: Record<string, unknown>;
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
  if (lower === 'inquiries' || lower === 'inquiry') return 'inquiries.inquiry';
  if (lower === 'claims' || lower === 'claim') return 'invoices.claim';

  // Fallback: pass through.
  return raw;
};

const normalizeEntityEndpoint = (entityType: string): string => {
  const lower = String(entityType || '').toLowerCase();
  if (lower === 'sales-orders' || lower === 'sales_orders' || lower === 'sales_order') return 'sales-orders/';
  if (lower === 'purchase-orders' || lower === 'purchase_orders' || lower === 'purchase_order') return 'purchase-orders/';
  if (lower === 'inquiries' || lower === 'inquiry') return 'inquiries/';
  if (lower === 'claims' || lower === 'claim') return 'claims/';
  return `${lower.replace(/^\/+/, '').replace(/\/+$/, '')}/`;
};

const shouldSkipField = (key: string): boolean => {
  const k = String(key || '').toLowerCase();
  return [
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
  if (type.includes('decimal') || type.includes('float') || type.includes('integer') || type.includes('number')) return 'number';
  if (type.includes('email')) return 'email';
  if (type.includes('url')) return 'url';
  if (type.includes('choice') || type.includes('select')) return 'select';
  if (type.includes('text') || type.includes('textarea')) return 'textarea';
  return 'text';
};

export const UniversalEntityForm: React.FC<UniversalEntityFormProps> = ({
  entityType,
  entityId,
  isOpen,
  onClose,
  onSuccess,
  initialValues,
}) => {
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState<BackendSchema | null>(null);
  const [fkValues, setFkValues] = useState<Record<string, unknown>>({});
  const [fkOptions, setFkOptions] = useState<Record<string, Array<{ id: string | number; name: string }>>>({});
  const [productOptions, setProductOptions] = useState<Record<string, Array<{ value: string; label: string }>>>({});
  const [loadingProducts, setLoadingProducts] = useState<Record<string, boolean>>({});

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

        const postFields = (actions && 'POST' in actions ? (actions.POST as Record<string, unknown>) : {}) || {};

        const fields: BackendField[] = Object.entries(postFields).map(([key, meta]) => {
          const metaObj = (meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {}) || {};
          const choicesRaw = metaObj.choices;
          const choices = Array.isArray(choicesRaw)
            ? choicesRaw.map((c: unknown) => {
                const choice = (c && typeof c === 'object' ? (c as Record<string, unknown>) : {}) || {};
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

        return { name: `Universal Form: ${entityType}`, description: 'Auto-derived from OPTIONS.', fields };
      } catch (err) {
        throw err;
      }
    }
  }, [endpoint, entityType, schemaEntityKey]);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const nextSchema = await loadSchema();
        if (!mounted) return;
        setSchema(nextSchema);

        // Prefill FK values from initialValues if present.
        setFkValues((prev) => ({ ...prev, ...(initialValues || {}) }));
      } catch (err: unknown) {
        if (!mounted) return;
        setSchema(null);
        const errorMessage =
          typeof (err as { response?: { data?: { error?: string } } })?.response?.data?.error === 'string'
            ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
            : 'Failed to load form schema';
        message.error(errorMessage);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [isOpen, loadSchema, initialValues]);

  // Load basic FK option lists (best-effort) for non-product references.
  useEffect(() => {
    if (!isOpen || !schema?.fields?.length) return;

    const fkFields = schema.fields.filter((f) => !shouldSkipField(f.key) && Boolean(f.related_entity));
    if (!fkFields.length) return;

    let cancelled = false;

    const loadFk = async () => {
      for (const f of fkFields) {
        const related = String(f.related_entity || '').toLowerCase();
        if (!related || related.includes('system.product') || String(f.key).toLowerCase().includes('product')) {
          continue;
        }

        // Minimal mapping for top FK types.
        const relatedEndpoint = related.includes('customers.') ? 'customers/' :
          related.includes('suppliers.') ? 'suppliers/' :
          related.includes('contacts.') ? 'contacts/' :
          null;

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

  const fkFields = useMemo(() => {
    return (schema?.fields ?? []).filter((f) => !shouldSkipField(f.key) && Boolean(f.related_entity));
  }, [schema?.fields]);

  const scalarFields = useMemo(() => {
    return (schema?.fields ?? [])
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
  }, [schema?.fields]);

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

  const submit = useCallback(
    async (data: Record<string, unknown>) => {
      const payload = { ...data };

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

      try {
        const resp = entityId
          ? await apiClient.patch(`${endpoint}${entityId}/`, payload)
          : await apiClient.post(endpoint, payload);

        onSuccess?.(resp.data);
        onClose();
      } catch (err: unknown) {
        console.error('[UniversalEntityForm] Submit failed:', err);
        const typed = err as { response?: { data?: { error?: string; detail?: string } } };
        message.error(typed?.response?.data?.error || typed?.response?.data?.detail || 'Failed to submit form');
        throw err;
      }
    },
    [endpoint, entityId, fkFields, fkValues, initialValues, onClose, onSuccess]
  );

  const fetchProducts = useMemo(
    () =>
      async (fieldKey: string, q: string) => {
        setLoadingProducts((prev) => ({ ...prev, [fieldKey]: true }));
        try {
          const resp = await businessApi.get('/system/products/', {
            params: { search: q || undefined, page_size: 50, is_active: true },
          });
          const payload = resp.data as unknown;
          const payloadObj =
            typeof payload === 'object' && payload ? (payload as Record<string, unknown>) : null;
          const rows = Array.isArray(payload) ? payload : (Array.isArray(payloadObj?.results) ? payloadObj?.results : []);

          const opts = rows.map((p: unknown) => {
            const row = (p && typeof p === 'object' ? (p as Record<string, unknown>) : {}) || {};
            const id = row.id;
            const code = typeof row.product_code === 'string' ? row.product_code : '';
            const name = typeof row.name === 'string' ? row.name : typeof row.effective_name === 'string' ? row.effective_name : '';
            const label = `${code ? `${code} - ` : ''}${name}`.trim() || String(id ?? '');
            return { value: String(id ?? ''), label };
          });
          setProductOptions((prev) => ({
            ...prev,
            [fieldKey]: (() => {
              const map = new Map((prev[fieldKey] || []).map((o) => [o.value, o] as const));
              opts.forEach((o) => map.set(o.value, o));
              return Array.from(map.values());
            })(),
          }));
        } catch (err) {
          console.error('[UniversalEntityForm] Failed to search products:', err);
        } finally {
          setLoadingProducts((prev) => ({ ...prev, [fieldKey]: false }));
        }
      },
    []
  );

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnClose
      title={schema?.name || `New ${entityType}`}
    >
      <Container>
        {loading ? (
          <div style={{ padding: 16 }}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </div>
        ) : !schema ? (
          <div style={{ padding: 12, color: 'rgb(var(--color-text-secondary))', fontSize: 13 }}>
            Unable to load form schema.
          </div>
        ) : (
          <>
            {fkFields.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                {fkFields.map((f) => {
                  const related = String(f.related_entity || '').toLowerCase();
                  const isProduct = related.includes('system.product') || String(f.key).toLowerCase().includes('product');

                  if (isProduct) {
                    const value = fkValues[f.key] as string | number | undefined;
                    return (
                      <div key={f.key}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgb(var(--color-text-secondary))', marginBottom: 6 }}>
                          {f.label || f.key}
                        </div>
                        <Select
                          showSearch
                          filterOption={false}
                          onSearch={(q) => void fetchProducts(f.key, q)}
                          options={productOptions[f.key] || []}
                          value={value}
                          onChange={(next) => setFkValues((prev) => ({ ...prev, [f.key]: next }))}
                          notFoundContent={loadingProducts[f.key] ? <Spin size="small" /> : null}
                          style={{ width: '100%' }}
                          placeholder="Search products…"
                        />
                      </div>
                    );
                  }

                  const options = fkOptions[f.key] || [];
                  return (
                    <div key={f.key}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'rgb(var(--color-text-secondary))', marginBottom: 6 }}>
                        {f.label || f.key}
                      </div>
                      <SearchableSelect
                        value={(fkValues[f.key] as string | number | undefined) ?? ''}
                        options={options}
                        onChange={(next) => setFkValues((prev) => ({ ...prev, [f.key]: next }))}
                        placeholder={`Select ${f.label || f.key}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <DynamicFormEngine
              schema={dynamicSchema}
              initialValues={initialValues || {}}
              onSubmit={(data) => {
                void submit(data);
              }}
              onCancel={onClose}
            />
          </>
        )}
      </Container>
    </Modal>
  );
};

export default UniversalEntityForm;
