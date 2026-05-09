import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';

import EntityFormSurface from '../components/Shared/EntityFormSurface';
import { apiClient, apiService, type Supplier } from '../services/apiService';
import { withTenantQueryKey } from '../utils/queryKeys';

type SupplierProduct = {
  id: string | number;
  product_code?: string;
  name?: string;
  product_name?: string;
};

type SupplierListRow = Supplier & {
  associated_products?: SupplierProduct[];
};

const Suppliers: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const suppliersQuery = useQuery({
    queryKey: withTenantQueryKey('suppliers'),
    queryFn: apiService.getSuppliers,
  });

  const suppliers = (suppliersQuery.data ?? []) as SupplierListRow[];

  const [searchText, setSearchText] = useState('');
  const filteredSuppliers = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => String(s.name ?? '').toLowerCase().includes(q));
  }, [searchText, suppliers]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | number | null>(null);

  const [productsBySupplierId, setProductsBySupplierId] = useState<Record<string, SupplierProduct[]>>({});
  const [productsLoadingBySupplierId, setProductsLoadingBySupplierId] = useState<Record<string, boolean>>({});

  // Back-compat: if anything still links to ?action=create
  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setCreateOpen(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('action');
        return next;
      });
    }
  }, [searchParams, setSearchParams]);

  const productsByCachedRef = React.useRef(productsBySupplierId);
  productsByCachedRef.current = productsBySupplierId;

  const loadSupplierProducts = useCallback(
    async (supplierId: string | number) => {
      const id = String(supplierId);
      if (!id) return;
      if (productsByCachedRef.current[id]?.length) return;

      setProductsLoadingBySupplierId((prev) => ({ ...prev, [id]: true }));
      try {
        const resp = await apiClient.get(`/suppliers/${encodeURIComponent(id)}/products/`);
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
      const confirmed = window.confirm('Are you sure you want to delete this supplier?');
      if (!confirmed) return;

      await apiService.deleteSupplier(Number(supplierId));
      void suppliersQuery.refetch();
    },
    [suppliersQuery]
  );

  const handleCreateClose = useCallback(() => {
    setCreateOpen(false);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setCreateOpen(false);
    void suppliersQuery.refetch();
  }, [suppliersQuery]);

  const handleEditClose = useCallback(() => {
    setEditOpen(false);
    setEditingSupplierId(null);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setEditOpen(false);
    setEditingSupplierId(null);
    void suppliersQuery.refetch();
  }, [suppliersQuery]);

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

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Suppliers
          </Typography.Title>
          <Typography.Text style={{ color: 'rgb(var(--color-text-tertiary))' }}>
            Headquarters list
          </Typography.Text>
        </div>

        <Space>
          <Input
            placeholder="Search suppliers"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            New Supplier
          </Button>
        </Space>
      </div>

      <Table<SupplierListRow>
        rowKey={(row) => String(row.id ?? '')}
        columns={columns}
        dataSource={filteredSuppliers}
        loading={suppliersQuery.isLoading}
        pagination={{ pageSize: 25 }}
        onRow={(record) => ({
          style: { cursor: 'pointer' },
          onClick: () => {
            const id = String(record.id ?? '').trim();
            if (!id) return;
            navigate(`/suppliers/${encodeURIComponent(id)}`);
          },
        })}
        expandable={{
          onExpand: (expanded, record) => {
            if (!expanded) return;
            if (Array.isArray(record.associated_products) && record.associated_products.length) return;
            void loadSupplierProducts(record.id ?? '');
          },
          expandedRowRender: (record) => {
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
          rowExpandable: (record) => {
            const hasInline = Array.isArray(record.associated_products) && record.associated_products.length > 0;
            return !hasInline;
          },
        }}
      />

      <EntityFormSurface
        entityType="supplier"
        mode="create"
        variant="modal"
        isOpen={createOpen}
        onClose={handleCreateClose}
        onSuccess={handleCreateSuccess}
      />

      <EntityFormSurface
        entityType="supplier"
        mode="edit"
        variant="modal"
        isOpen={editOpen}
        entityId={editingSupplierId ?? undefined}
        onClose={handleEditClose}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
};

export default Suppliers;
