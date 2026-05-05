import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Spin, Typography, message, Tag, Select } from 'antd';
import debounce from 'lodash/debounce';
import { businessApi } from '../../services/businessApi';
import { logger } from '@/utils/logger';
import AmbientSuggestions from '@/components/AIAssistant/AmbientSuggestions';

const { Text } = Typography;

export interface EntityReference {
  id: string | number;
  type?: string | null;
  title?: string | null;
}

export interface EntityDetailResponse {
  id: string | number;
  type: string;
  title: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  fields?: Record<string, unknown>;
  can_edit?: boolean;
}

type BackendSchemaField = {
  key: string;
  label?: string;
  type?: string;
  required?: boolean;
  order?: number;

  hidden?: boolean;
  read_only?: boolean;
  group?: string;
  surfaces?: {
    header?: boolean;
    form?: boolean;
    table?: boolean;
  };

  ui?: Record<string, unknown> | null;
  related_entity?: string | null;
  choices?: Array<{ value: unknown; label: string }> | null;
};

type BackendSchema = {
  name?: string;
  description?: string;
  fields?: BackendSchemaField[];
  key_fields?: string[];
  header_fields?: string[];
  groups?: Array<{ id: string; label: string; order?: number }>;
};

const normalizeSchemaEntityType = (raw: string): string => {
  const t = String(raw || '').trim().toLowerCase();

  if (t === 'inquiry' || t === 'inquiries') return 'inquiry';
  if (t === 'sales_order' || t === 'sales-orders' || t === 'sales_orders') return 'sales_order';
  if (t === 'purchase_order' || t === 'purchase-orders' || t === 'purchase_orders') return 'purchase_order';

  if (t === 'customer' || t === 'customers') return 'customer';
  if (t === 'supplier' || t === 'suppliers') return 'supplier';
  if (t === 'plant' || t === 'plants') return 'plant';
  if (t === 'location' || t === 'locations') return 'location';
  if (t === 'contact' || t === 'contacts') return 'contact';
  if (t === 'invoice' || t === 'invoices') return 'invoice';
  if (t === 'claim' || t === 'claims') return 'claim';

  return t;
};

export interface EntityProfileHeaderProps {
  entityType: string;
  entityId: string;
  onNavigateToEntity: (entityType: string, entityId: string, label: string) => void;

  /**
   * When set to "compact", only the most important fields are shown.
   * Defaults to "full" for backward compatibility.
   */
  variant?: 'full' | 'compact';

  /**
   * Layout mode:
   * - grid: existing dense field grid
   * - sidebar: field grid + right sidebar for secondary widgets (products, etc.)
   */
  layout?: 'grid' | 'sidebar';
}

const Container = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
`;

const TitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
`;

const TitleBlock = styled.div`
  min-width: 0;
`;

const Title = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Subtitle = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

const FieldsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px 16px;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const SidebarLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 16px;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const GroupHeading = styled.div`
  grid-column: 1 / -1;
  font-size: 12px;
  font-weight: 800;
  color: rgb(var(--color-text-secondary));
  letter-spacing: 0.2px;
  text-transform: uppercase;
  padding-top: 6px;
  border-top: 1px solid rgb(var(--color-border));
`;

const FieldRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const FieldLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const FieldValue = styled.div<{ $editable?: boolean }>`
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  min-width: 0;
  padding: 6px 8px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  transition: background 120ms ease, border-color 120ms ease;

  ${p =>
    p.$editable
      ? `
    cursor: text;

    &:hover {
      background: rgb(var(--color-primary) / 0.06);
      border-color: rgb(var(--color-primary) / 0.18);
    }

    &:focus-within {
      background: rgb(var(--color-primary) / 0.06);
      border-color: rgb(var(--color-primary) / 0.25);
    }
  `
      : ''}
`;

const PreferredProductsSection = styled.div`
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgb(var(--color-border));
`;

const PreferredProductsTitle = styled.div`
  font-size: 12px;
  font-weight: 800;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 8px;
  letter-spacing: 0.2px;
`;

const LinkButton = styled.button`
  padding: 0;
  border: none;
  background: transparent;
  color: rgb(var(--color-primary));
  cursor: pointer;
  text-align: left;

  &:hover {
    text-decoration: underline;
  }
`;

const formatScalar = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
        if (v instanceof Date) return v.toISOString();
        if (typeof v === 'object') {
          const anyV = v as any;
          return String(
            anyV.name ??
              anyV.title ??
              anyV.label ??
              anyV.product_code ??
              anyV.id ??
              ''
          );
        }
        return String(v);
      })
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

const isEntityReference = (value: unknown): value is EntityReference => {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return 'id' in v && (typeof v.id === 'string' || typeof v.id === 'number');
};

type ProductListEntry = { id: string; product_code?: string; name?: string };

type ProductListField = 'preferred_products' | 'active_products';

const ProductListSection: React.FC<{
  title: string;
  field: ProductListField;
  entries: ProductListEntry[];
  canEdit: boolean;
  proteinFilter: string[];
  onSave: (field: ProductListField, value: string[]) => Promise<void>;
}> = ({ title, field, entries, canEdit, proteinFilter, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string[]>(entries.map((e) => e.id));
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>(
    entries.map((e) => ({
      value: e.id,
      label: `${e.product_code ? `${e.product_code} - ` : ''}${e.name || e.id}`,
    }))
  );
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    setValue(entries.map((e) => e.id));
    setOptions(
      entries.map((e) => ({
        value: e.id,
        label: `${e.product_code ? `${e.product_code} - ` : ''}${e.name || e.id}`,
      }))
    );
  }, [entries]);

  const fetchOptions = useMemo(
    () => debounce(async (q: string) => {
      setLoadingOptions(true);
      try {
        const resp = await businessApi.get('/system/products/', {
          params: {
            search: q || undefined,
            // Some environments allow client-set page sizing; some don't.
            // Include both params for maximum compatibility.
            page_size: 50,
            limit: 50,
            is_active: true,
            ...(proteinFilter.length ? { protein: proteinFilter.join(',') } : {}),
          },
        });

        const raw = resp.data as any;
        const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
        const next = rows.map((p: any) => ({
          value: String(p.id),
          label: `${p.product_code ? `${p.product_code} - ` : ''}${p.name || p.effective_name || ''}`.trim() || String(p.id),
        }));

        // Replace options for the current search (so the dropdown actually narrows),
        // but keep currently-selected values so they don't disappear.
        setOptions((prev) => {
          const selected = new Set(value.map(String));
          const keep = prev.filter((o) => selected.has(o.value));
          const map = new Map<string, { value: string; label: string }>();
          keep.forEach((o) => map.set(o.value, o));
          next.forEach((o: { value: string; label: string }) => map.set(o.value, o));
          return Array.from(map.values());
        });
      } catch (err) {
        logger.error('[EntityProfileHeader] Failed to search products:', err);
      } finally {
        setLoadingOptions(false);
      }
    }, 250),
    [proteinFilter.join('|'), value.join('|')]
  );

  useEffect(() => () => fetchOptions.cancel(), [fetchOptions]);

  return (
    <PreferredProductsSection>
      <PreferredProductsTitle style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span>{title}</span>
        {canEdit && (
          <LinkButton type="button" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Cancel' : 'Edit'}
          </LinkButton>
        )}
      </PreferredProductsTitle>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Select
            mode="multiple"
            value={value}
            options={options}
            placeholder={proteinFilter.length ? 'Search products (filtered by protein types)…' : 'Search products…'}
            showSearch
            filterOption={false}
            onSearch={(q) => fetchOptions(q)}
            onChange={(vals) => setValue(vals as string[])}
            notFoundContent={loadingOptions ? <Spin size="small" /> : null}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <LinkButton
              type="button"
              onClick={async () => {
                await onSave(field, value);
                setEditing(false);
              }}
            >
              Save
            </LinkButton>
          </div>
        </div>
      ) : entries.length ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {entries.map((p) => {
            const label = `${p.product_code ? `${p.product_code} - ` : ''}${p.name || ''}`.trim() || p.id;
            return (
              <Tag key={p.id} color="purple">
                {label}
              </Tag>
            );
          })}
        </div>
      ) : (
        <div style={{ color: 'rgb(var(--color-text-tertiary))', fontSize: 12 }}>—</div>
      )}
    </PreferredProductsSection>
  );
};

export const EntityProfileHeader: React.FC<EntityProfileHeaderProps> = ({

  entityType,
  entityId,
  onNavigateToEntity,
  variant = 'full',
}) => {
  const [data, setData] = useState<EntityDetailResponse | null>(null);
  const [schema, setSchema] = useState<BackendSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);
  const [editingArrayField, setEditingArrayField] = useState<string | null>(null);
  const [arrayDraft, setArrayDraft] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const schemaKey = normalizeSchemaEntityType(entityType);
      const [detailRes, schemaRes] = await Promise.allSettled([
        businessApi.get(`/system/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}/`),
        businessApi.get('/system/forms/schema/', { params: { entity_type: schemaKey } }),
      ]);

      if (detailRes.status === 'fulfilled') {
        setData(detailRes.value.data as EntityDetailResponse);
      } else {
        const err: any = detailRes.reason;
        const status = err?.response?.status;
        logger.error('Failed to load entity profile header details', { component: 'EntityProfileHeader' }, err);

        // During backend outages, avoid toast-spam; render a stable placeholder instead.
        if (status === 500 || status === 502 || status === 503 || status === 504) {
          setData(null);
          return;
        }

        message.error('Failed to load record details');
        setData(null);
      }

      if (schemaRes.status === 'fulfilled') {
        setSchema(schemaRes.value.data as BackendSchema);
      } else {
        setSchema(null);
      }
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = Boolean(data?.can_edit);

  useEffect(() => {
    setIsEditMode(false);
    setShowAllFields(false);
    setEditingArrayField(null);
    setArrayDraft([]);
  }, [entityType, entityId]);

  const normalizeArrayStrings = useCallback((value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((v) => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
        if (v instanceof Date) return v.toISOString();
        if (typeof v === 'object') {
          const anyV = v as any;
          return String(anyV.name ?? anyV.title ?? anyV.label ?? anyV.id ?? '');
        }
        return String(v);
      })
      .map((s) => s.trim())
      .filter(Boolean);
  }, []);

  const patchField = useCallback(async (field: string, value: unknown) => {
    try {
      const resp = await businessApi.patch(
        `/system/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}/`,
        { field, value }
      );
      setData(resp.data as EntityDetailResponse);
      return resp.data as EntityDetailResponse;
    } catch (err: any) {
      const status = err?.response?.status;
      logger.error('Failed to update entity profile header field', { component: 'EntityProfileHeader' }, err);

      if (status === 500 || status === 502 || status === 503 || status === 504) {
        message.error('Server temporarily unavailable. Please try again in a moment.');
      } else {
        message.error(err?.response?.data?.error || 'Failed to update field');
      }

      void load();
      throw err;
    }
  }, [entityType, entityId, load]);

  const debouncedPatch = useMemo(
    () => debounce(async (field: string, value: unknown) => {
      try {
        await patchField(field, value);
      } catch {
        // patchField handles toast + reload
      }
    }, 300),
    [patchField]
  );

  useEffect(() => {
    return () => debouncedPatch.cancel();
  }, [debouncedPatch]);

  const preferredProducts = useMemo(() => {
    const fieldsAny = (data?.fields ?? {}) as any;
    const metaAny = (data?.metadata ?? {}) as any;
    const raw = fieldsAny?.preferred_products ?? metaAny?.preferred_products;

    if (!Array.isArray(raw)) return [] as ProductListEntry[];

    return raw
      .map((item: any) => {
        if (!item) return null;
        if (typeof item === 'string') return { id: item, name: item };
        if (typeof item === 'object') {
          const id = String(item.id ?? '').trim();
          if (!id) return null;
          return {
            id,
            product_code: item.product_code ? String(item.product_code) : undefined,
            name: item.name ? String(item.name) : undefined,
          };
        }
        return null;
      })
      .filter(Boolean) as ProductListEntry[];
  }, [data?.fields, data?.metadata]);

  const activeProducts = useMemo(() => {
    const fieldsAny = (data?.fields ?? {}) as any;
    const metaAny = (data?.metadata ?? {}) as any;
    const raw = fieldsAny?.active_products ?? metaAny?.active_products;

    if (!Array.isArray(raw)) return [] as ProductListEntry[];

    return raw
      .map((item: any) => {
        if (!item) return null;
        if (typeof item === 'string') return { id: item, name: item };
        if (typeof item === 'object') {
          const id = String(item.id ?? '').trim();
          if (!id) return null;
          return {
            id,
            product_code: item.product_code ? String(item.product_code) : undefined,
            name: item.name ? String(item.name) : undefined,
          };
        }
        return null;
      })
      .filter(Boolean) as ProductListEntry[];
  }, [data?.fields, data?.metadata]);

  type HeaderFieldEntry = {
    key: string;
    label: string;
    value: unknown;
    readOnly: boolean;
    group: string;
  };

  const headerFieldEntries = useMemo<HeaderFieldEntry[]>(() => {
    const fields = (data?.fields ?? {}) as Record<string, unknown>;

    if (schema?.fields?.length) {
      const schemaFields = (schema.fields || []).filter((f) => f && typeof f.key === 'string' && f.key.trim());
      const byKey = new Map(schemaFields.map((f) => [String(f.key), f] as const));

      const headerKeysRaw: string[] = Array.isArray(schema.header_fields) && schema.header_fields.length
        ? schema.header_fields.map(String)
        : Array.isArray(schema.key_fields)
          ? schema.key_fields.map(String)
          : [];

      const surfaceKeys = schemaFields
        .filter((f) => Boolean(f.surfaces?.header) && !f.hidden)
        .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
        .map((f) => String(f.key));

      const orderedKeys = (headerKeysRaw.length ? headerKeysRaw : surfaceKeys)
        .map((k) => String(k || '').trim())
        .filter(Boolean);

      const uniqKeys: string[] = [];
      orderedKeys.forEach((k) => {
        if (!uniqKeys.includes(k)) uniqKeys.push(k);
      });

      const entries = uniqKeys
        .map((k) => {
          const def = byKey.get(k);
          if (!def) return null;
          if (def.hidden) return null;
          if (def.surfaces && def.surfaces.header === false) return null;

          return {
            key: k,
            label: String(def.label || k),
            value: fields[k],
            readOnly: Boolean(def.read_only),
            group: String(def.group || 'Details'),
          } as HeaderFieldEntry;
        })
        .filter(Boolean) as HeaderFieldEntry[];

      return variant === 'compact' && !showAllFields ? entries.slice(0, 6) : entries;
    }

    // Fallback: pre-schema behavior
    const entries = Object.entries(fields)
      .filter(([key]) => !['id', 'preferred_products', 'active_products'].includes(key))
      .map(([key, value]) => ({
        key,
        label: key,
        value,
        readOnly: false,
        group: 'Details',
      }));

    if (variant !== 'compact') {
      return entries.sort((a, b) => a.key.localeCompare(b.key));
    }

    const type = String(entityType || '').toLowerCase();
    const preferredByType: Record<string, string[]> = {
      customer: ['company_name', 'company', 'name', 'phone', 'phone_number', 'email', 'contact_email', 'status'],
      supplier: ['company_name', 'company', 'name', 'phone', 'phone_number', 'email', 'contact_email', 'status'],
      contact: ['first_name', 'last_name', 'email', 'phone', 'status'],
      sales_order: ['our_sales_order_num', 'delivery_po_num', 'status', 'due_date', 'delivery_date'],
      purchase_order: ['order_number', 'our_purchase_order_num', 'status', 'due_date', 'delivery_date'],
      invoice: ['invoice_number', 'status', 'due_date', 'total_amount', 'payment_status'],
    };

    const preferred = preferredByType[type] ?? [];
    const preferredIndex = new Map(preferred.map((k, idx) => [k, idx] as const));

    const sorted = [...entries].sort((a, b) => {
      const ai = preferredIndex.has(a.key) ? (preferredIndex.get(a.key) as number) : Number.POSITIVE_INFINITY;
      const bi = preferredIndex.has(b.key) ? (preferredIndex.get(b.key) as number) : Number.POSITIVE_INFINITY;
      if (ai !== bi) return ai - bi;
      return a.key.localeCompare(b.key);
    });

    return showAllFields ? sorted : sorted.slice(0, 6);
  }, [data, entityType, schema, showAllFields, variant]);

  const groupedHeaderFieldEntries = useMemo(() => {
    const byGroup = new Map<string, HeaderFieldEntry[]>();
    headerFieldEntries.forEach((f) => {
      const g = String(f.group || 'Details');
      byGroup.set(g, [...(byGroup.get(g) || []), f]);
    });

    const schemaGroups = Array.isArray(schema?.groups) ? [...schema.groups] : [];
    schemaGroups.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));

    const orderedGroupLabels = schemaGroups.length ? schemaGroups.map((g) => g.label) : Array.from(byGroup.keys());

    return orderedGroupLabels
      .map((label) => ({ label, fields: byGroup.get(label) || [] }))
      .filter((g) => g.fields.length > 0);
  }, [headerFieldEntries, schema?.groups]);

  return (
    <Container>
      <TitleRow>
        <TitleBlock>
          <Title title={data?.title || ''}>{data?.title || 'Record'}</Title>
          <Subtitle>
            <Tag color="blue">{variant === 'compact' ? `${entityType} · key fields` : entityType}</Tag>
            <span style={{ marginLeft: 8 }}>ID: {entityId}</span>
          </Subtitle>
        </TitleBlock>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {variant === 'compact' && (
            <LinkButton type="button" onClick={() => setShowAllFields((v) => !v)}>
              {showAllFields ? 'Show fewer fields' : 'Show all fields'}
            </LinkButton>
          )}
          {canEdit && (
            <LinkButton
              type="button"
              onClick={() =>
                setIsEditMode((v) => {
                  const next = !v;
                  if (!next) {
                    setEditingArrayField(null);
                    setArrayDraft([]);
                  }
                  return next;
                })
              }
            >
              {isEditMode ? 'Done' : 'Edit'}
            </LinkButton>
          )}
        </div>
      </TitleRow>

      <AmbientSuggestions entityType={entityType} entityId={entityId} />

      {loading ? (
        <div style={{ padding: 12 }}><Spin /></div>
      ) : (
        <>
          <FieldsGrid>
            {groupedHeaderFieldEntries.map((group) => (
              <React.Fragment key={group.label}>
                {groupedHeaderFieldEntries.length > 1 && <GroupHeading>{group.label}</GroupHeading>}
                {group.fields.map(({ key, label: fieldLabel, value, readOnly }) => {
                  if (isEntityReference(value) && value.type && value.id !== null && value.id !== undefined) {
                    const linkLabel = value.title || `${value.type} ${value.id}`;
                    return (
                      <FieldRow key={key}>
                        <FieldLabel>{String(fieldLabel || key)}</FieldLabel>
                        <FieldValue>
                          <LinkButton
                            onClick={() => onNavigateToEntity(String(value.type), String(value.id), linkLabel)}
                            title="Navigate"
                          >
                            {linkLabel}
                          </LinkButton>
                        </FieldValue>
                      </FieldRow>
                    );
                  }

                  const scalar = formatScalar(value);
                  const lowerKey = String(key).toLowerCase();
                  const isMultiValue = Array.isArray(value) || lowerKey.includes('products');
                  const isEditingMulti = editingArrayField === key;
                  const isEditableText =
                    canEdit &&
                    isEditMode &&
                    !readOnly &&
                    !isMultiValue &&
                    typeof value === 'string' &&
                    scalar.length <= 200;

                  const renderMultiValue = () => {
                    const values = Array.isArray(value) ? normalizeArrayStrings(value) : [];

                    if (isEditingMulti) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <Select
                            mode="tags"
                            value={arrayDraft}
                            options={Array.from(new Set([...values, ...arrayDraft])).map((v) => ({ value: v, label: v }))}
                            placeholder="Add values…"
                            tokenSeparators={[',']}
                            onChange={(vals) => setArrayDraft(vals as string[])}
                            style={{ width: '100%' }}
                          />
                          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <LinkButton
                              type="button"
                              onClick={() => {
                                setEditingArrayField(null);
                                setArrayDraft([]);
                              }}
                            >
                              Cancel
                            </LinkButton>
                            <LinkButton
                              type="button"
                              onClick={async () => {
                                await patchField(key, arrayDraft);
                                setEditingArrayField(null);
                                setArrayDraft([]);
                              }}
                            >
                              Save
                            </LinkButton>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        {values.length ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {values.map((v) => (
                              <Tag key={`${key}:${v}`} color="geekblue">
                                {v}
                              </Tag>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>—</span>
                        )}

                        {canEdit && isEditMode && !readOnly && (
                          <LinkButton
                            type="button"
                            onClick={() => {
                              setEditingArrayField(key);
                              setArrayDraft(values);
                            }}
                          >
                            Edit
                          </LinkButton>
                        )}
                      </div>
                    );
                  };

                  return (
                    <FieldRow key={key}>
                      <FieldLabel>{String(fieldLabel || key)}</FieldLabel>
                      <FieldValue $editable={isEditableText}>
                        {typeof value === 'boolean' ? (
                          <Tag color={value ? 'success' : 'default'}>{value ? 'Yes' : 'No'}</Tag>
                        ) : isMultiValue ? (
                          renderMultiValue()
                        ) : isEditableText ? (
                          <Text
                            editable={
                              isEditMode
                                ? {
                                    onChange: (next) => debouncedPatch(key, next),
                                    tooltip: 'Click to edit',
                                    triggerType: ['icon', 'text'],
                                  }
                                : false
                            }
                          >
                            {scalar || <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>—</span>}
                          </Text>
                        ) : (
                          scalar || <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>—</span>
                        )}
                      </FieldValue>
                    </FieldRow>
                  );
                })}
              </React.Fragment>
            ))}
          </FieldsGrid>

          {(() => {
            const type = String(entityType || '').toLowerCase();
            const isSupplier = type === 'supplier';
            const isCustomer = type === 'customer';

            const proteinTypesRaw = ((data?.fields ?? {}) as any)?.preferred_protein_types;
            const proteinFilter = Array.isArray(proteinTypesRaw)
              ? proteinTypesRaw.map((v: any) => String(v).toLowerCase()).filter(Boolean)
              : [];

            const preferredIds = new Set(preferredProducts.map((p) => p.id));
            const activeIds = new Set(activeProducts.map((p) => p.id));
            const activeIsSameAsPreferred = preferredIds.size === activeIds.size && Array.from(preferredIds).every((id) => activeIds.has(id));

            const canEditProducts = canEdit && isEditMode && (isCustomer || isSupplier);

            const showPreferred = canEditProducts || preferredProducts.length > 0;
            const showActive = isSupplier
              ? (canEditProducts || activeProducts.length > 0)
              : (activeProducts.length > 0 && !activeIsSameAsPreferred);

            if (!showPreferred && !showActive) return null;

            return (
              <>
                {showPreferred && (
                  <ProductListSection
                    title="Preferred Products"
                    field="preferred_products"
                    entries={preferredProducts}
                    canEdit={canEditProducts}
                    proteinFilter={proteinFilter}
                    onSave={async (field, ids) => {
                      await patchField(field, ids);
                    }}
                  />
                )}
                {showActive && (
                  <ProductListSection
                    title="Active Products"
                    field="active_products"
                    entries={activeProducts}
                    canEdit={canEditProducts}
                    proteinFilter={proteinFilter}
                    onSave={async (field, ids) => {
                      await patchField(field, ids);
                    }}
                  />
                )}
              </>
            );
          })()}
        </>
      )}
    </Container>
  );
};

export default EntityProfileHeader;
