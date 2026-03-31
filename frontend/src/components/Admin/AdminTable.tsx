/**
 * Admin Table Component
 * 
 * Enhanced table component for admin workspace with additional features:
 * - Action buttons per row
 * - Bulk selection
 * - Custom column rendering
 * - Mobile-responsive (cards on mobile)
 * - Loading and empty states
 * - Pagination support
 * 
 * Usage:
 * ```tsx
 * <AdminTable
 *   columns={[
 *     { key: 'name', label: 'Name', sortable: true },
 *     { key: 'email', label: 'Email', sortable: true },
 *     { key: 'role', label: 'Role', render: (val) => <RoleBadge role={val} /> },
 *   ]}
 *   data={users}
 *   onRowClick={(user) => handleEdit(user)}
 *   actions={[
 *     { label: 'Edit', icon: '✏️', onClick: (row) => handleEdit(row) },
 *     { label: 'Delete', icon: '🗑️', onClick: (row) => handleDelete(row), variant: 'danger' },
 *   ]}
 *   loading={loading}
 *   emptyState={{
 *     icon: '👥',
 *     title: 'No users found',
 *     message: 'Get started by inviting team members.',
 *   }}
 * />
 * ```
 */

import React, { useState, useMemo, useCallback } from 'react';
import styled from 'styled-components';
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
}

type SortDirection = 'asc' | 'desc' | null;

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
}: AdminTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  // Handle column header click for sorting
  const handleSort = (columnKey: string, sortable?: boolean) => {
    if (!sortable) return;

    if (sortColumn === columnKey) {
      setSortDirection(
        sortDirection === 'asc' ? 'desc' : sortDirection === 'desc' ? null : 'asc'
      );
      if (sortDirection === 'desc') {
        setSortColumn(null);
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

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

  // Sort data based on current sort column and direction
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aValue = resolveValue(a, sortColumn);
      const bValue = resolveValue(b, sortColumn);

      if (aValue == null) return 1;
      if (bValue == null) return -1;

      const aComparable = typeof aValue === 'string' ? aValue.toLowerCase() : aValue;
      const bComparable = typeof bValue === 'string' ? bValue.toLowerCase() : bValue;

      const comparison = aComparable < bComparable ? -1 : aComparable > bComparable ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection, resolveValue]);

  // Handle row selection
  const handleSelectRow = (id: string | number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
    onSelectionChange?.(Array.from(newSelected));
  };

  const handleSelectAll = () => {
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set());
      onSelectionChange?.([]);
    } else {
      const allIds = data.map((row) => row[idKey]);
      setSelectedIds(new Set(allIds));
      onSelectionChange?.(allIds);
    }
  };

  // Loading state
  if (loading) {
    return (
      <TableContainer>
        <LoadingSkeleton type="table" rows={5} columns={columns.length + (actions ? 1 : 0)} />
      </TableContainer>
    );
  }

  // Empty state
  if (data.length === 0 && emptyState) {
    return (
      <TableContainer>
        <EmptyState {...emptyState} />
      </TableContainer>
    );
  }

  if (data.length === 0) {
    return (
      <TableContainer>
        <EmptyState
          icon="📋"
          title="No data"
          message="No data available to display."
        />
      </TableContainer>
    );
  }

  const handleExportCsv = () => {
    const exportColumns = columns.filter((c) => c.exportable !== false);
    const headers = exportColumns.map((c) => String(c.exportLabel ?? c.label ?? c.key));

    const rows = sortedData.map((row) =>
      exportColumns.map((c) => {
        const raw = resolveValue(row, c.key);
        return c.exportValue ? c.exportValue(raw, row) : raw;
      })
    );

    const csv = buildCsv({ headers, rows });
    downloadCsv(csvExport?.fileName ?? 'export.csv', csv);
  };

  // Render table
  return (
    <TableContainer>
      {csvExport && (
        <Toolbar>
          <ToolbarLeft>
            {selectable && selectedIds.size > 0 && (
              <SelectionPill>{selectedIds.size} selected</SelectionPill>
            )}
          </ToolbarLeft>
          <ToolbarRight>
            <ToolbarButton type="button" onClick={handleExportCsv}>
              Export CSV
            </ToolbarButton>
          </ToolbarRight>
        </Toolbar>
      )}
      <Table>
        <TableHead>
          <TableRow>
            {selectable && (
              <TableHeader style={{ width: '40px' }}>
                <Checkbox
                  type="checkbox"
                  checked={selectedIds.size === data.length}
                  onChange={handleSelectAll}
                  aria-label="Select all rows"
                />
              </TableHeader>
            )}
            {columns.map((column) => (
              <TableHeader
                key={String(column.key)}
                onClick={() => handleSort(String(column.key), column.sortable)}
                sortable={column.sortable}
                style={{ width: column.width }}
              >
                <HeaderContent>
                  {column.label}
                  {column.sortable && (
                    <SortIcon>
                      {sortColumn === column.key
                        ? sortDirection === 'asc'
                          ? '↑'
                          : '↓'
                        : '↕'}
                    </SortIcon>
                  )}
                </HeaderContent>
              </TableHeader>
            ))}
            {actions && <TableHeader style={{ width: '120px' }}>Actions</TableHeader>}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedData.map((row, rowIndex) => {
            const rowId = row[idKey];
            const isSelected = selectedIds.has(rowId);
            const isHighlighted = selectedRowId === rowId;

            return (
              <TableRow
                key={rowId || rowIndex}
                onClick={() => onRowClick?.(row)}
                clickable={!!onRowClick}
                selected={isHighlighted || isSelected}
              >
                {selectable && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectRow(rowId)}
                      aria-label={`Select row ${rowId}`}
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={String(column.key)}>
                    {column.render
                      ? column.render(resolveValue(row, column.key), row)
                      : resolveValue(row, column.key)}
                  </TableCell>
                ))}
                {actions && Array.isArray(actions) && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <ActionsGroup>
                      {actions
                        .filter((action) => !action.hidden?.(row))
                        .map((action, actionIndex) => (
                          <ActionButton
                            key={actionIndex}
                            onClick={() => action.onClick(row)}
                            variant={action.variant || 'default'}
                            title={action.label}
                            aria-label={action.label}
                          >
                            {action.icon && <span>{action.icon}</span>}
                            <span>{action.label}</span>
                          </ActionButton>
                        ))}
                    </ActionsGroup>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// Styled Components

const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  background: rgb(var(--color-surface));
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

const ToolbarButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  cursor: pointer;

  &:hover {
    background: rgb(var(--color-surface-hover));
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const TableHead = styled.thead`
  background: rgb(var(--color-surface));
  border-bottom: 2px solid rgb(var(--color-border));
`;

const TableBody = styled.tbody``;

const TableRow = styled.tr<{ clickable?: boolean; selected?: boolean }>`
  cursor: ${({ clickable }) => (clickable ? 'pointer' : 'default')};
  background: ${({ selected }) =>
    selected ? 'rgba(var(--color-primary), 0.05)' : 'transparent'};
  transition: background-color 0.2s;

  &:hover {
    background: ${({ clickable }) =>
      clickable ? 'rgb(var(--color-surface-hover))' : 'transparent'};
  }

  &:not(:last-child) {
    border-bottom: 1px solid rgb(var(--color-border));
  }
`;

const TableHeader = styled.th<{ sortable?: boolean }>`
  padding: 12px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: ${({ sortable }) => (sortable ? 'pointer' : 'default')};
  user-select: none;
  white-space: nowrap;

  &:hover {
    color: ${({ sortable }) =>
      sortable ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-secondary))'};
  }
`;

const HeaderContent = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SortIcon = styled.span`
  font-size: 12px;
  opacity: 0.6;
`;

const TableCell = styled.td`
  padding: 16px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  vertical-align: middle;
`;

const ActionsGroup = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const ActionButton = styled.button<{ variant: 'default' | 'primary' | 'danger' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  background: ${({ variant }) =>
    variant === 'primary'
      ? 'rgb(var(--color-primary))'
      : variant === 'danger'
      ? 'rgb(239, 68, 68)'
      : 'rgb(var(--color-surface))'};
  color: ${({ variant }) =>
    variant === 'default' ? 'rgb(var(--color-text-primary))' : 'white'};
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: rgb(var(--color-primary));
`;
