import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, message, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';

import { businessApi } from '@/services/businessApi';
import { containsUuidToken, isIdentifierLike, resolveEntityDisplay } from '@/utils/entityDisplay';

import { EntityFormSurface } from './EntityFormSurface';
import { FormErrorBoundary } from './FormErrorBoundary';
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

  /** Enable checkbox selection + bulk action toolbar. Defaults to false. */
  enableBulkActions?: boolean;
}

import { normalizeSchemaEntityType, entityRecordPath } from '../../utils/entityTypeRegistry';
import { logger } from '@/utils/logger';

const defaultRecordPath = (entityType: string, id: string) =>
  entityRecordPath(entityType, id);

const getRowSubtitle = (row: Record<string, unknown>): string | undefined => {
  const candidates = [row.subtitle, row.city, row.state, row.email, row.phone];
  const parts: string[] = [];

  candidates.forEach((c) => {
    const s = String(c ?? '').trim();
    if (!s || isIdentifierLike(s) || containsUuidToken(s)) return;
    parts.push(s);
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
    const obj = value as Record<string, unknown>;
    if (typeof obj?.name === 'string') return obj.name;
    if (typeof obj?.title === 'string') return obj.title;
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
  enableBulkActions = false,
}: UnifiedEntityTableProps<Row>) => {
  const navigate = useNavigate();
  const [schema, setSchema] = useState<BackendSchema | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const normalizedEntityType = useMemo(() => normalizeSchemaEntityType(entityType), [entityType]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const exportingRef = useRef(false);

  const resolvedRowKey = useCallback(
    (row: Row) => {
      if (rowKey) return rowKey(row);
      return String(row?.id ?? '');
    },
    [rowKey]
  );

  const loadSchema = useCallback(async () => {
    const schemaKey = normalizeSchemaEntityType(entityType);
    if (!schemaKey) return;

    try {
      const resp = await businessApi.get('/system/forms/schema/', { params: { entity_type: schemaKey } });
      setSchema((resp.data as BackendSchema) || null);
    } catch (err) {
      logger.warn('Failed to fetch entity schema', { err, entityType });
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

  const closeQuickEdit = useCallback(() => {
    setQuickEditOpen(false);
    setEditingId(null);
  }, []);

  const handleQuickEditSuccess = useCallback(() => {
    setQuickEditOpen(false);
    setEditingId(null);
    onReload?.();
  }, [onReload]);

  const handleQuickEdit = useCallback(
    (row: Row) => {
      const id = String(row?.id ?? '').trim();
      if (!id) return;

      if (normalizedEntityType === 'plant') {
        const supplierId = String(
          (row as Record<string, unknown>)?.supplier ??
            (row as Record<string, unknown>)?.supplier_id ??
            ''
        ).trim();

        if (supplierId) {
          navigate(`/suppliers/${encodeURIComponent(supplierId)}/plants/${encodeURIComponent(id)}`, {
            state: { startEditing: true },
          });
          return;
        }

        navigate(`/plants/${encodeURIComponent(id)}/edit`);
        return;
      }

      setEditingId(id);
      setQuickEditOpen(true);
    },
    [navigate, normalizedEntityType]
  );

  const columns: ColumnsType<Row> = useMemo(() => {
    const cols: ColumnsType<Row> = [
      {
        title: 'Record',
        key: 'record',
        render: (_: unknown, row: Row) => {
          const resolvedTitle = resolveEntityDisplay(row as Record<string, unknown>, {
            entityType,
            fallbackStyle: 'id',
          });
          const item: EntityListItem = {
            id: String(row?.id ?? ''),
            type: entityType,
            name: resolvedTitle.text,
            subtitle: getRowSubtitle(row as Record<string, unknown>),
            tooltip: resolvedTitle.tooltip,
          };

          return <EntityListPrimaryCell item={item} />;
        },
      },
    ];

    schemaColumns.forEach((f) => {
      cols.push({
        title: f.label || f.key,
        dataIndex: f.key as string & keyof Row,
        key: f.key,
        render: (v: unknown) => {
          const s = formatScalar(v);
          return s || <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>—</span>;
        },
      });
    });

    // Ensure Department is consistently visible for Contact lists even if schema omits it from table surface.
    const hasDeptColumn = cols.some((c) => c?.key === 'department');
    if (normalizedEntityType === 'contact' && !hasDeptColumn) {
      cols.push({
        title: 'Department',
        dataIndex: 'department' as string & keyof Row,
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
          const id = String(row?.id ?? '').trim();
          if (!id) return null;

          return (
            <Button
              type="link"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleQuickEdit(row);
              }}
            >
              Quick Edit
            </Button>
          );
        },
      });
    }

    return cols;
  }, [enableQuickEdit, entityType, handleQuickEdit, normalizedEntityType, schemaColumns]);

  const handleExportCSV = useCallback(() => {
    if (exportingRef.current) return;
    exportingRef.current = true;

    try {
      const selectedData = data.filter((row) =>
        selectedRowKeys.includes(String(row?.id ?? '')),
      );
      if (selectedData.length === 0) {
        message.warning('No rows selected for export.');
        return;
      }

      const allKeys = new Set<string>();
      selectedData.forEach((row) => Object.keys(row).forEach((k) => allKeys.add(k)));
      const headers = Array.from(allKeys);

      const csvRows = [headers.join(',')];
      selectedData.forEach((row) => {
        const vals = headers.map((h) => {
          const v = (row as Record<string, unknown>)[h];
          const s = v == null ? '' : String(v);
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        });
        csvRows.push(vals.join(','));
      });

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entityType}_export_${selectedData.length}_rows.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(`Exported ${selectedData.length} rows.`);
    } finally {
      exportingRef.current = false;
    }
  }, [data, entityType, selectedRowKeys]);

  const handleClearSelection = useCallback(() => {
    setSelectedRowKeys([]);
  }, []);

  const rowSelection = enableBulkActions
    ? {
        selectedRowKeys,
        onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
      }
    : undefined;

  return (
    <>
      {enableBulkActions && selectedRowKeys.length > 0 && (
        <div
          style={{
            padding: '8px 12px',
            marginBottom: 8,
            borderRadius: 8,
            background: 'rgb(var(--color-surface))',
            border: '1px solid rgb(var(--color-border))',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontWeight: 500, fontSize: 13 }}>
            {selectedRowKeys.length} selected
          </span>
          <Space size={8}>
            <Button size="small" onClick={handleExportCSV}>
              Export CSV
            </Button>
            <Button size="small" onClick={handleClearSelection}>
              Clear
            </Button>
          </Space>
        </div>
      )}

      <Table<Row>
        aria-label={`${entityType || 'Entity'} records`}
        size="small"
        rowKey={resolvedRowKey}
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pageSize ? { pageSize } : false}
        rowSelection={rowSelection}
        onRow={(row) => ({
          onClick: () => {
            const id = String(row?.id ?? '').trim();
            if (!id) return;

            const overridden = recordPathForRow?.(entityType, row);
            const href = overridden || defaultRecordPath(entityType, id);
            navigate(href);
          },
        })}
      />

      <FormErrorBoundary entityType={entityType} onClose={closeQuickEdit}>
        <EntityFormSurface
          entityType={entityType}
          mode="edit"
          variant="modal"
          isOpen={quickEditOpen}
          entityId={editingId ?? undefined}
          onClose={closeQuickEdit}
          onSuccess={handleQuickEditSuccess}
        />
      </FormErrorBoundary>
    </>
  );
};

export default UnifiedEntityTable;
