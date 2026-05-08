import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';

import EntityFormSurface from '../components/Shared/EntityFormSurface';
import { apiClient, apiService, type Customer } from '../services/apiService';
import { withTenantQueryKey } from '../utils/queryKeys';

type CustomerProduct = {
  id: string | number;
  product_code?: string;
  name?: string;
  product_name?: string;
};

type CustomerListRow = Customer & {
  associated_products?: CustomerProduct[];
};

const PageContainer = styled.div`
  padding: 1rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;

  @media (max-width: 520px) {
    padding: 0.75rem;
  }
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
  min-width: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
  flex: 1 1 320px;
  min-width: 0;

  @media (max-width: 520px) {
    width: 100%;
  }
`;

const SearchInputContainer = styled.div`
  flex: 1 1 220px;
  min-width: 0;
`;

const TableContainer = styled.div`
  width: 100%;
  max-width: 100%;
  min-width: 0;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  background: rgb(var(--color-surface));
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;

  .ant-table-wrapper,
  .ant-spin-nested-loading,
  .ant-spin-container {
    min-width: 0;
  }
`;

const Customers: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const customersQuery = useQuery({
    queryKey: withTenantQueryKey('customers'),
    queryFn: apiService.getCustomers,
  });

  const customers = (customersQuery.data ?? []) as CustomerListRow[];

  const [searchText, setSearchText] = useState('');
  const filteredCustomers = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => String(c.name ?? '').toLowerCase().includes(q));
  }, [customers, searchText]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | number | null>(null);

  const [productsByCustomerId, setProductsByCustomerId] = useState<Record<string, CustomerProduct[]>>({});
  const [productsLoadingByCustomerId, setProductsLoadingByCustomerId] = useState<Record<string, boolean>>({});

  // Back-compat: if anything still links to ?action=create
  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setCreateOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next);
    }
  }, [searchParams, setSearchParams]);

  const productsByCachedRef = React.useRef(productsByCustomerId);
  productsByCachedRef.current = productsByCustomerId;

  const loadCustomerProducts = useCallback(
    async (customerId: string | number) => {
      const id = String(customerId);
      if (!id) return;
      if (productsByCachedRef.current[id]?.length) return;

      setProductsLoadingByCustomerId((prev) => ({ ...prev, [id]: true }));
      try {
        const resp = await apiClient.get(`/customers/${encodeURIComponent(id)}/products/`);
        const raw = resp.data as unknown;
        const rows = Array.isArray(raw) ? (raw as CustomerProduct[]) : [];
        setProductsByCustomerId((prev) => ({ ...prev, [id]: rows }));
      } finally {
        setProductsLoadingByCustomerId((prev) => ({ ...prev, [id]: false }));
      }
    },
    []
  );

  const handleDelete = useCallback(
    async (customerId: string | number) => {
      const confirmed = window.confirm('Are you sure you want to delete this customer?');
      if (!confirmed) return;

      try {
        await apiService.deleteCustomer(Number(customerId));
        void customersQuery.refetch();
      } catch {
        message.error('Failed to delete customer. Please try again.');
      }
    },
    [customersQuery]
  );

  const handleCreateClose = useCallback(() => {
    setCreateOpen(false);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setCreateOpen(false);
    void customersQuery.refetch();
  }, [customersQuery]);

  const handleEditClose = useCallback(() => {
    setEditOpen(false);
    setEditingCustomerId(null);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setEditOpen(false);
    setEditingCustomerId(null);
    void customersQuery.refetch();
  }, [customersQuery]);

  const columns: ColumnsType<CustomerListRow> = useMemo(
    () => [
      {
        title: 'Name',
        key: 'name',
        render: (_: unknown, record) => {
          const displayName = String(record.name ?? '').trim() || 'Unnamed Customer';
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
                setEditingCustomerId(record.id ?? null);
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
    <PageContainer>
      <HeaderRow>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Customers
          </Typography.Title>
          <Typography.Text style={{ color: 'rgb(var(--color-text-tertiary))' }}>
            Headquarters list
          </Typography.Text>
        </div>

        <HeaderActions>
          <SearchInputContainer>
            <Input
              placeholder="Search customers"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: '100%' }}
            />
          </SearchInputContainer>
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            New Customer
          </Button>
        </HeaderActions>
      </HeaderRow>

      <TableContainer data-testid="customers-table-container">
        <Table<CustomerListRow>
          rowKey={(row) => String(row.id ?? '')}
          columns={columns}
          dataSource={filteredCustomers}
          loading={customersQuery.isLoading}
          pagination={{ pageSize: 25 }}
          scroll={{ x: 'max-content' }}
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onClick: () => {
              const id = String(record.id ?? '').trim();
              if (!id) return;
              navigate(`/customers/${encodeURIComponent(id)}`);
            },
          })}
          expandable={{
            onExpand: (expanded, record) => {
              if (!expanded) return;
              if (Array.isArray(record.associated_products) && record.associated_products.length) return;
              void loadCustomerProducts(record.id ?? '');
            },
            expandedRowRender: (record) => {
              const id = String(record.id ?? '').trim();
              const loading = productsLoadingByCustomerId[id];
              const products = productsByCustomerId[id] ?? [];

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
      </TableContainer>

      <EntityFormSurface
        entityType="customer"
        mode="create"
        variant="modal"
        isOpen={createOpen}
        onClose={handleCreateClose}
        onSuccess={handleCreateSuccess}
      />

      <EntityFormSurface
        entityType="customer"
        mode="edit"
        variant="modal"
        isOpen={editOpen}
        entityId={editingCustomerId ?? undefined}
        onClose={handleEditClose}
        onSuccess={handleEditSuccess}
      />
    </PageContainer>
  );
};

export default Customers;
