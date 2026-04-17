import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Drawer, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';

import { businessApi } from '@/services/businessApi';

import { EntityFormSurface } from './EntityFormSurface';
import { EntityListPrimaryCell, type EntityListItem } from './entityListPresentation';

type BackendSchemaField = {
  key: string;
  label?: string;
  type?: string;
  hidden?: boolean;
  read_only?: boolean;
  order?: number;
  surfaces?: {
    table?: boolean;
  };
};

type BackendSchema = {
  fields?: BackendSchemaField[];
};

export type UnifiedEntityTableRow = Record<string, unknown> & {
  id?: string | number;
};

export interface UnifiedEntityTableProps<Row extends UnifiedEntityTableRow = UnifiedEntityTableRow> {
  entityType: string;
  data: Row[];

  loading?: boolean;
  pageSize?: number;

  /** Called after a successful quick edit save. */
  onReload?: () => void;

  /** Override for navigation target when a row is clicked. */
  recordPathForRow?: (entityType: string, row: Row) => string | null;

  /** Defaults to row.id. */
  rowKey?: (row: Row) => string;

  /** Defaults to true. */
  enableQuickEdit?: boolean;
}

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

const defaultRecordPath = (entityType: string, id: string) => {
  const t = normalizeSchemaEntityType(entityType);
  return `/records/${encodeURIComponent(t)}/${encodeURIComponent(id)}`;
};

const getRowTitle = (row: Record<string, unknown>): string => {
  const candidates = [row.name, row.company_name, row.company, row.title, row.code];
  for (const c of candidates) {
    const s = String(c ?? '').trim();
    if (s) return s;
  }
  const id = String(row.id ?? '').trim();
  return id ? `Record ${id}` : 'Record';
};

const getRowSubtitle = (row: Record<string, unknown>): string | undefined => {
  const candidates = [row.subtitle, row.city, row.state, row.email, row.phone];
  const parts: string[] = [];

  candidates.forEach((c) => {
    const s = String(c ?? '').trim();
    if (s) parts.push(s);
  });

  const unique = Array.from(new Set(parts));
  const compact = unique.slice(0, 2).join(' · ');
  return compact || undefined;
};

const formatScalar = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => formatScalar(v)).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const anyVal = value as any;
    if (typeof anyVal?.name === 'string') return anyVal.name;
    if (typeof anyVal?.title === 'string') return anyVal.title;
  }
  return String(value);
};

export const UnifiedEntityTable = <Row extends UnifiedEntityTableRow = UnifiedEntityTableRow>({
  entityType,
  data,
  loading,
  pageSize,
  onReload,
  recordPathForRow,
  rowKey,
  enableQuickEdit = true,
}: UnifiedEntityTableProps<Row>) => {
  const navigate = useNavigate();
  const [schema, setSchema] = useState<BackendSchema | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const resolvedRowKey = useCallback(
    (row: Row) => {
      if (rowKey) return rowKey(row);
      return String((row as any)?.id ?? '');
    },
    [rowKey]
  );

  const loadSchema = useCallback(async () => {
    const schemaKey = normalizeSchemaEntityType(entityType);
    if (!schemaKey) return;

    try {
      const resp = await businessApi.get('/system/forms/schema/', { params: { entity_type: schemaKey } });
      setSchema((resp.data as BackendSchema) || null);
    } catch {
      setSchema(null);
    }
  }, [entityType]);

  useEffect(() => {
    void loadSchema();
  }, [loadSchema]);

  const schemaColumns = useMemo(() => {
    const fields = Array.isArray(schema?.fields) ? [...schema!.fields] : [];

    return fields
      .filter((f) => f && f.key && !f.hidden)
      .filter((f) => f.surfaces?.table)
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
      .slice(0, 4);
  }, [schema]);

  const columns: ColumnsType<Row> = useMemo(() => {
    const cols: ColumnsType<Row> = [
      {
        title: 'Record',
        key: 'record',
        render: (_: unknown, row: Row) => {
          const item: EntityListItem = {
            id: String((row as any)?.id ?? ''),
            type: entityType,
            name: getRowTitle(row as any),
            subtitle: getRowSubtitle(row as any),
          };

          return <EntityListPrimaryCell item={item} />;
        },
      },
    ];

    schemaColumns.forEach((f) => {
      cols.push({
        title: f.label || f.key,
        dataIndex: f.key as any,
        key: f.key,
        render: (v: unknown) => {
          const s = formatScalar(v);
          return s || <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>—</span>;
        },
      });
    });

    // Ensure Department is consistently visible for Contact lists even if schema omits it from table surface.
    const normalizedType = normalizeSchemaEntityType(entityType);
    const hasDeptColumn = cols.some((c) => (c as any)?.key === 'department');
    if (normalizedType === 'contact' && !hasDeptColumn) {
      cols.push({
        title: 'Department',
        dataIndex: 'department' as any,
        key: 'department',
        render: (v: unknown) => {
          const s = formatScalar(v);
          return s || <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>—</span>;
        },
      });
    }

    if (enableQuickEdit) {
      cols.push({
        title: '',
        key: 'actions',
        width: 120,
        render: (_: unknown, row: Row) => {
          const id = String((row as any)?.id ?? '').trim();
          if (!id) return null;

          return (
            <Button
              type="link"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setEditingId(id);
                setDrawerOpen(true);
              }}
            >
              Quick Edit
            </Button>
          );
        },
      });
    }

    return cols;
  }, [enableQuickEdit, entityType, schemaColumns]);

  return (
    <>
      <Table<Row>
        size="small"
        rowKey={resolvedRowKey}
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pageSize ? { pageSize } : false}
        onRow={(row) => ({
          onClick: () => {
            const id = String((row as any)?.id ?? '').trim();
            if (!id) return;

            const overridden = recordPathForRow?.(entityType, row);
            const href = overridden || defaultRecordPath(entityType, id);
            navigate(href);
          },
        })}
      />

      <Drawer
        title="Quick Edit"
        open={drawerOpen}
        width={560}
        destroyOnClose
        onClose={() => {
          setDrawerOpen(false);
          setEditingId(null);
        }}
      >
        {editingId ? (
          <EntityFormSurface
            entityType={entityType}
            mode="edit"
            variant="inline"
            isOpen={true}
            entityId={editingId}
            onClose={() => {
              setDrawerOpen(false);
              setEditingId(null);
            }}
            onSuccess={() => {
              setDrawerOpen(false);
              setEditingId(null);
              onReload?.();
            }}
          />
        ) : null}
      </Drawer>
    </>
  );
};

export default UnifiedEntityTable;
