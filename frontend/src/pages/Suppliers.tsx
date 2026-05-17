import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Result, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DownloadOutlined } from '@ant-design/icons';

import { EntityPageHeader } from '@/components/Shared/EntityPageHeader';
import EntityFormSurface from '../components/Shared/EntityFormSurface';
import StatusFilterBar from '../components/Shared/StatusFilterBar';
import { FormErrorBoundary } from '@/components/Shared/FormErrorBoundary';
import type { Supplier } from '../services/apiService';
import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '../utils/queryKeys';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { confirmDialog } from '@/utils/uiDialogs';
import { buildCsv, downloadCsv } from '@/utils/csv';
import { logger } from '@/utils/logger';

type SupplierProduct = {
  id: string | number;
  product_code?: string;
  name?: string;
  product_name?: string;
};

type SupplierListRow = Supplier & {
  associated_products?: SupplierProduct[];
  is_active?: boolean;
};

const Suppliers: React.FC = () => {
  useDocumentTitle('Suppliers');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const suppliersQuery = useQuery({
    queryKey: withTenantQueryKey('suppliers'),
    queryFn: async () => {
      const resp = await businessApi.get('suppliers/');
      return (resp.data.results || resp.data) as Supplier[];
    },
  });

  const suppliers = useMemo(() => (suppliersQuery.data ?? []) as SupplierListRow[], [suppliersQuery.data]);

  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const supplierTabs = useMemo(() => [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'inactive', label: 'Inactive' },
  ], []);
  const filteredSuppliers = useMemo(() => {
    let result = suppliers;
    if (activeTab === 'active') {
      result = result.filter((s) => s.is_active !== false);
    } else if (activeTab === 'inactive') {
      result = result.filter((s) => s.is_active === false);
    }
    const q = searchText.trim().toLowerCase();
    if (q) {
      result = result.filter((s) => String(s.name ?? '').toLowerCase().includes(q));
    }
    return result;
  }, [suppliers, activeTab, searchText]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | number | null>(null);
  const createAction = searchParams.get('action');
  const refreshSuppliers = useCallback(
    () => queryClient.invalidateQueries({ queryKey: withTenantQueryKey('suppliers') }),
    [queryClient]
  );

  const [productsBySupplierId, setProductsBySupplierId] = useState<Record<string, SupplierProduct[]>>({});
  const [productsLoadingBySupplierId, setProductsLoadingBySupplierId] = useState<Record<string, boolean>>({});

  // Back-compat: if anything still links to ?action=create
  useEffect(() => {
    if (createAction !== 'create') return;
    setCreateOpen(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('action');
      return next;
    });
  }, [createAction, setSearchParams]);

  const productsByCachedRef = React.useRef(productsBySupplierId);
  productsByCachedRef.current = productsBySupplierId;

  const loadSupplierProducts = useCallback(
    async (supplierId: string | number) => {
      const id = String(supplierId);
      if (!id) return;
      if (productsByCachedRef.current[id]?.length) return;

      setProductsLoadingBySupplierId((prev) => ({ ...prev, [id]: true }));
      try {
        const resp = await businessApi.get(`/suppliers/${encodeURIComponent(id)}/products/`);
        const raw = resp.data as unknown;
        const rows = Array.isArray(raw) ? (raw as SupplierProduct[]) : [];
        setProductsBySupplierId((prev) => ({ ...prev, [id]: rows }));
      } finally {
        setProductsLoadingBySupplierId((prev) => ({ ...prev, [id]: false }));
      }
    },
    []
  );

  const handleDelete = useCallback(
    async (supplierId: string | number) => {
      const supplier = suppliers.find((s) => s.id === supplierId);
      const name = supplier?.name || 'this supplier';
      const confirmed = await confirmDialog({
        title: 'Delete Supplier',
        content: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
        okText: 'Delete',
        danger: true,
      });
      if (!confirmed) return;

      setDeletingId(supplierId);
      try {
        await businessApi.delete(`suppliers/${supplierId}/`);
        await refreshSuppliers();
      } catch (err) {
        logger.error('Failed to delete supplier', { component: 'Suppliers' }, err);
        message.error('Failed to delete supplier. Please try again.');
      } finally {
        setDeletingId(null);
      }
    },
    [refreshSuppliers, suppliers]
  );

  const handleExportCsv = useCallback(() => {
    const headers = ['Name', 'Email', 'Contact Person', 'Phone', 'City', 'State', 'Country'];
    const rows = suppliers.map((s) => [
      s.name ?? '', s.email ?? '', s.contact_person ?? '',
      s.phone ?? '', s.city ?? '', s.state ?? '', s.country ?? '',
    ]);
    const csv = buildCsv({ headers, rows });
    downloadCsv(`suppliers_${new Date().toISOString().split('T')[0]}.csv`, csv);
  }, [suppliers]);

  const handleCreateClose = useCallback(() => {
    setCreateOpen(false);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setCreateOpen(false);
    void refreshSuppliers();
  }, [refreshSuppliers]);

  const handleEditClose = useCallback(() => {
    setEditOpen(false);
    setEditingSupplierId(null);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setEditOpen(false);
    setEditingSupplierId(null);
    void refreshSuppliers();
  }, [refreshSuppliers]);

  const columns: ColumnsType<SupplierListRow> = useMemo(
    () => [
      {
        title: 'Company Name',
        key: 'name',
        render: (_: unknown, record) => {
          const displayName = String(record.name ?? '').trim() || 'Unnamed Supplier';
          const associatedProducts = Array.isArray(record.associated_products) ? record.associated_products : [];

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontWeight: 600, color: 'rgb(var(--color-text-primary))' }}>{displayName}</span>
              {associatedProducts.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {associatedProducts.map((p) => (
                    <Tag key={String(p.id)}>{p.product_name || p.name || p.product_code || 'Product'}</Tag>
                  ))}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 180,
        render: (_: unknown, record) => (
          <Space size="small">
            <Button
              type="link"
              onClick={(e) => {
                e.stopPropagation();
                setEditingSupplierId(record.id ?? null);
                setEditOpen(true);
              }}
            >
              Edit
            </Button>
            <Button
              type="link"
              danger
              loading={deletingId === record.id}
              disabled={deletingId !== null}
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete(record.id ?? '');
              }}
            >
              Delete
            </Button>
          </Space>
        ),
      },
    ],
    [handleDelete]
  );

  const handleRowClick = useCallback(
    (record: SupplierListRow) => {
      const id = String(record.id ?? '').trim();
      if (!id) return;
      navigate(`/suppliers/${encodeURIComponent(id)}`);
    },
    [navigate]
  );

  const onRow = useCallback(
    (record: SupplierListRow) => ({
      style: { cursor: 'pointer' } as const,
      onClick: () => handleRowClick(record),
    }),
    [handleRowClick]
  );

  const expandable = useMemo(
    () => ({
      onExpand: (expanded: boolean, record: SupplierListRow) => {
        if (!expanded) return;
        if (Array.isArray(record.associated_products) && record.associated_products.length) return;
        void loadSupplierProducts(record.id ?? '');
      },
      expandedRowRender: (record: SupplierListRow) => {
        const id = String(record.id ?? '').trim();
        const loading = productsLoadingBySupplierId[id];
        const products = productsBySupplierId[id] ?? [];

        if (Array.isArray(record.associated_products) && record.associated_products.length) {
          return null;
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ color: 'rgb(var(--color-text-tertiary))' }}>Aggregated Products</div>
            {loading ? (
              <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>Loading…</span>
            ) : products.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {products.map((p) => (
                  <Tag key={String(p.id)}>{p.product_name || p.name || p.product_code || 'Product'}</Tag>
                ))}
              </div>
            ) : (
              <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>No products found.</span>
            )}
          </div>
        );
      },
      rowExpandable: (record: SupplierListRow) => {
        const hasInline = Array.isArray(record.associated_products) && record.associated_products.length > 0;
        return !hasInline;
      },
    }),
    [loadSupplierProducts, productsLoadingBySupplierId, productsBySupplierId]
  );

  return (
    <div style={{ padding: 16 }}>
      <EntityPageHeader
        title="Suppliers"
        subtitle="Headquarters list"
        actions={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExportCsv} disabled={!suppliers.length}>
              Export CSV
            </Button>
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              New Supplier
            </Button>
          </Space>
        }
      />

      <StatusFilterBar
        tabs={supplierTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchText={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Search suppliers…"
      />

      {suppliersQuery.isError ? (
        <Result
          status="error"
          title="Failed to load suppliers"
          subTitle="Something went wrong. Please try again."
          extra={<Button type="primary" onClick={() => void suppliersQuery.refetch()}>Retry</Button>}
        />
      ) : (
      <Table<SupplierListRow>
        rowKey={(row) => String(row.id ?? '')}
        columns={columns}
        dataSource={filteredSuppliers}
        loading={suppliersQuery.isLoading}
        pagination={{ pageSize: 25 }}
        onRow={onRow}
        expandable={expandable}
      />
      )}

      <FormErrorBoundary entityType="supplier" onClose={handleCreateClose}>
        <EntityFormSurface
          entityType="supplier"
          mode="create"
          variant="modal"
          isOpen={createOpen}
          onClose={handleCreateClose}
          onSuccess={handleCreateSuccess}
        />
      </FormErrorBoundary>

      <FormErrorBoundary entityType="supplier" onClose={handleEditClose}>
        <EntityFormSurface
          entityType="supplier"
          mode="edit"
          variant="modal"
          isOpen={editOpen}
          entityId={editingSupplierId ?? undefined}
          onClose={handleEditClose}
          onSuccess={handleEditSuccess}
        />
      </FormErrorBoundary>
    </div>
  );
};

export default Suppliers;
