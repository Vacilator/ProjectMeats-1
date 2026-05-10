/**
 * Admin Table Component
 *
 * NOTE: This component intentionally keeps the existing AdminTable API,
 * but renders using Ant Design's Table under the hood to reduce duplicated
 * table primitives across the app.
 */

import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Button, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { buildCsv, downloadCsv } from '@/utils/csv';
import { LoadingSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';

interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  width?: string;

  /** CSV export: by default we export the resolved raw value for the column key. */
  exportable?: boolean;
  exportLabel?: string;
  exportValue?: (value: any, row: T) => unknown;
}

interface Action<T> {
  label: string;
  icon?: string;
  onClick: (row: T) => void;
  variant?: 'default' | 'primary' | 'danger';
  hidden?: (row: T) => boolean;
}

interface EmptyStateConfig {
  icon: string;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface AdminTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  actions?: Action<T>[];
  loading?: boolean;
  emptyState?: EmptyStateConfig;
  selectedRowId?: number | string;
  idKey?: keyof T;
  selectable?: boolean;
  onSelectionChange?: (selectedIds: (string | number)[]) => void;

  /** Optional: add an Export CSV button for the current (sorted/filtered) rows. */
  csvExport?: {
    fileName?: string;
  };

  /** Accessible label for the table. Defaults to "Data table". */
  ariaLabel?: string;
}

const compareForSort = (aValue: unknown, bValue: unknown) => {
  if (aValue == null && bValue == null) return 0;
  if (aValue == null) return 1;
  if (bValue == null) return -1;

  const aComparable = typeof aValue === 'string' ? aValue.toLowerCase() : aValue;
  const bComparable = typeof bValue === 'string' ? bValue.toLowerCase() : bValue;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aAny = aComparable as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bAny = bComparable as any;

  if (aAny < bAny) return -1;
  if (aAny > bAny) return 1;
  return 0;
};

export function AdminTable<T extends Record<string, any>>({
  columns,
  data,
  onRowClick,
  actions,
  loading = false,
  emptyState,
  selectedRowId,
  idKey = 'id' as keyof T,
  selectable = false,
  onSelectionChange,
  csvExport,
  ariaLabel = 'Data table',
}: AdminTableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  const resolveValue = useCallback((row: T, key: Column<T>['key']): any => {
    const rawKey = String(key);
    if (!rawKey.includes('.')) {
      return row[key as keyof T];
    }

    // Support dot-path keys like "user.email" for nested objects.
    return rawKey.split('.').reduce<any>((acc, part) => {
      if (acc == null) return undefined;
      return acc[part];
    }, row);
  }, []);

  const safeActions: Action<T>[] | undefined = Array.isArray(actions) ? actions : undefined;

  const antdColumns: ColumnsType<T> = useMemo(() => {
    const baseCols: ColumnsType<T> = columns.map((c) => {
      const rawKey = String(c.key);
      const dataIndex = rawKey.includes('.') ? rawKey.split('.') : (rawKey as any);

      return {
        title: c.label,
        dataIndex,
        key: rawKey,
        width: c.width,
        sorter: c.sortable
          ? (a: T, b: T) => compareForSort(resolveValue(a, c.key), resolveValue(b, c.key))
          : undefined,
        render: (_: unknown, row: T) => {
          const value = resolveValue(row, c.key);
          return c.render ? c.render(value, row) : value;
        },
      };
    });

    if (!safeActions) return baseCols;

    const actionCol = {
      title: 'Actions',
      key: '__actions',
      width: 160,
      render: (_: unknown, row: T) => (
        <Space size={8} onClick={(e) => e.stopPropagation()}>
          {safeActions
            .filter((a) => !a.hidden?.(row))
            .map((a) => (
              <Button
                key={a.label}
                type={a.variant === 'primary' ? 'primary' : 'default'}
                danger={a.variant === 'danger'}
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  a.onClick(row);
                }}
              >
                {a.icon ? <span style={{ marginRight: 6 }}>{a.icon}</span> : null}
                {a.label}
              </Button>
            ))}
        </Space>
      ),
    };

    return [...baseCols, actionCol];
  }, [columns, resolveValue, safeActions]);

  const handleExportCsv = () => {
    const exportColumns = columns.filter((c) => c.exportable !== false);
    const headers = exportColumns.map((c) => String(c.exportLabel ?? c.label ?? c.key));

    const rows = data.map((row) =>
      exportColumns.map((c) => {
        const raw = resolveValue(row, c.key);
        return c.exportValue ? c.exportValue(raw, row) : raw;
      })
    );

    const csv = buildCsv({ headers, rows });
    downloadCsv(csvExport?.fileName ?? 'export.csv', csv);
  };

  if (loading) {
    return (
      <TableContainer>
        <LoadingSkeleton type="table" rows={5} columns={columns.length + (safeActions ? 1 : 0)} />
      </TableContainer>
    );
  }

  if (data.length === 0) {
    return (
      <TableContainer>
        <EmptyState
          {...(emptyState ?? {
            icon: '📋',
            title: 'No data',
            message: 'No data available to display.',
          })}
        />
      </TableContainer>
    );
  }

  const rowSelection = selectable
    ? {
        selectedRowKeys: Array.from(selectedIds),
        onChange: (keys: React.Key[]) => {
          const next = new Set(keys as Array<string | number>);
          setSelectedIds(next);
          onSelectionChange?.(Array.from(next));
        },
      }
    : undefined;

  return (
    <TableContainer>
      {csvExport && (
        <Toolbar>
          <ToolbarLeft>
            {selectable && selectedIds.size > 0 && <SelectionPill>{selectedIds.size} selected</SelectionPill>}
          </ToolbarLeft>
          <ToolbarRight>
            <Button size="small" onClick={handleExportCsv}>
              Export CSV
            </Button>
          </ToolbarRight>
        </Toolbar>
      )}
      <Table
        aria-label={ariaLabel}
        size="middle"
        columns={antdColumns}
        dataSource={data}
        pagination={false}
        rowKey={(row: T) => {
          const direct = row[idKey] as unknown as string | number | undefined | null;
          if (direct !== undefined && direct !== null && String(direct) !== '') return direct;

          const fallbackAny = row as any;
          const legacy = fallbackAny.id ?? fallbackAny.key;
          if (legacy !== undefined && legacy !== null && String(legacy) !== '') return legacy;

          try {
            return JSON.stringify(row);
          } catch {
            return Object.prototype.toString.call(row);
          }
        }}
        rowSelection={rowSelection}
        onRow={(record) => ({
          onClick: () => onRowClick?.(record),
        })}
        rowClassName={(record) => {
          const rid = record[idKey] as unknown as string | number | undefined;
          const isHighlighted = selectedRowId !== undefined && rid === selectedRowId;
          const isSelected = rid !== undefined && selectedIds.has(rid);
          return isHighlighted || isSelected ? 'pm-admin-table-row-selected' : '';
        }}
      />
    </TableContainer>
  );
}

const TableContainer = styled.div`
  width: 100%;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  background: rgb(var(--color-surface));
  overflow: hidden;

  .ant-table {
    background: transparent;
  }

  .pm-admin-table-row-selected > td {
    background: rgba(var(--color-primary), 0.05) !important;
  }
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SelectionPill = styled.div`
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(var(--color-primary), 0.08);
  color: rgb(var(--color-text-primary));
  font-size: 12px;
  font-weight: 600;
`;
