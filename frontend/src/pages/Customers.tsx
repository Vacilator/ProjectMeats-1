import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Result, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { DownloadOutlined } from '@ant-design/icons';

import { EntityPageHeader } from '@/components/Shared/EntityPageHeader';
import EntityFormSurface from '../components/Shared/EntityFormSurface';
import StatusFilterBar from '../components/Shared/StatusFilterBar';
import { FormErrorBoundary } from '@/components/Shared/FormErrorBoundary';
import type { Customer } from '../services/apiService';
import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '../utils/queryKeys';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { confirmDialog } from '@/utils/uiDialogs';
import { buildCsv, downloadCsv } from '@/utils/csv';
import { logger } from '@/utils/logger';

type CustomerProduct = {
  id: string | number;
  product_code?: string;
  name?: string;
  product_name?: string;
};

type CustomerListRow = Customer & {
  associated_products?: CustomerProduct[];
  is_active?: boolean;
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
  useDocumentTitle('Customers');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const customersQuery = useQuery({
    queryKey: withTenantQueryKey('customers'),
    queryFn: async () => {
      const resp = await businessApi.get('customers/');
      return (resp.data.results || resp.data) as Customer[];
    },
  });

  const customers = useMemo(() => (customersQuery.data ?? []) as CustomerListRow[], [customersQuery.data]);

  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const customerTabs = useMemo(() => [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'inactive', label: 'Inactive' },
  ], []);
  const filteredCustomers = useMemo(() => {
    let result = customers;
    if (activeTab === 'active') {
      result = result.filter((c) => c.is_active !== false);
    } else if (activeTab === 'inactive') {
      result = result.filter((c) => c.is_active === false);
    }
    const q = searchText.trim().toLowerCase();
    if (q) {
      result = result.filter((c) => String(c.name ?? '').toLowerCase().includes(q));
    }
    return result;
  }, [customers, activeTab, searchText]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | number | null>(null);
  const createAction = searchParams.get('action');
  const refreshCustomers = useCallback(
    () => queryClient.invalidateQueries({ queryKey: withTenantQueryKey('customers') }),
    [queryClient]
  );

  const [productsByCustomerId, setProductsByCustomerId] = useState<Record<string, CustomerProduct[]>>({});
  const [productsLoadingByCustomerId, setProductsLoadingByCustomerId] = useState<Record<string, boolean>>({});

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

  const productsByCachedRef = React.useRef(productsByCustomerId);
  productsByCachedRef.current = productsByCustomerId;

  const loadCustomerProducts = useCallback(
    async (customerId: string | number) => {
      const id = String(customerId);
      if (!id) return;
      if (productsByCachedRef.current[id]?.length) return;

      setProductsLoadingByCustomerId((prev) => ({ ...prev, [id]: true }));
      try {
        const resp = await businessApi.get(`/customers/${encodeURIComponent(id)}/products/`);
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
      const customer = customers.find((c) => c.id === customerId);
      const name = customer?.name || 'this customer';
      const confirmed = await confirmDialog({
        title: 'Delete Customer',
        content: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
        okText: 'Delete',
        danger: true,
      });
      if (!confirmed) return;

      try {
        await businessApi.delete(`customers/${customerId}/`);
        await refreshCustomers();
      } catch (err) {
        logger.error('Failed to delete customer', { component: 'Customers' }, err);
        message.error('Failed to delete customer. Please try again.');
      }
    },
    [customers, refreshCustomers]
  );

  const handleExportCsv = useCallback(() => {
    const headers = ['Name', 'Email', 'Contact Person', 'Phone', 'City', 'State', 'Country'];
    const rows = customers.map((c) => [
      c.name ?? '', c.email ?? '', c.contact_person ?? '',
      c.phone_office || c.phone_mobile || c.phone || '',
      c.city ?? '', c.state ?? '', c.country ?? '',
    ]);
    const csv = buildCsv({ headers, rows });
    downloadCsv(`customers_${new Date().toISOString().split('T')[0]}.csv`, csv);
  }, [customers]);

  const handleCreateClose = useCallback(() => {
    setCreateOpen(false);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setCreateOpen(false);
    void refreshCustomers();
  }, [refreshCustomers]);

  const handleEditClose = useCallback(() => {
    setEditOpen(false);
    setEditingCustomerId(null);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setEditOpen(false);
    setEditingCustomerId(null);
    void refreshCustomers();
  }, [refreshCustomers]);

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
      <EntityPageHeader
        title="Customers"
        subtitle="Headquarters list"
        actions={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExportCsv} disabled={!customers.length}>
              Export CSV
            </Button>
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              New Customer
            </Button>
          </Space>
        }
      />

      <StatusFilterBar
        tabs={customerTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchText={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Search customers…"
      />

      <TableContainer data-testid="customers-table-container">
        {customersQuery.isError ? (
          <Result
            status="error"
            title="Failed to load customers"
            subTitle="Something went wrong. Please try again."
            extra={<Button type="primary" onClick={() => void customersQuery.refetch()}>Retry</Button>}
          />
        ) : (
        <Table<CustomerListRow>
          aria-label="Customers list"
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
        )}
      </TableContainer>

      <FormErrorBoundary entityType="customer" onClose={handleCreateClose}>
        <EntityFormSurface
          entityType="customer"
          mode="create"
          variant="modal"
          isOpen={createOpen}
          onClose={handleCreateClose}
          onSuccess={handleCreateSuccess}
        />
      </FormErrorBoundary>

      <FormErrorBoundary entityType="customer" onClose={handleEditClose}>
        <EntityFormSurface
          entityType="customer"
          mode="edit"
          variant="modal"
          isOpen={editOpen}
          entityId={editingCustomerId ?? undefined}
          onClose={handleEditClose}
          onSuccess={handleEditSuccess}
        />
      </FormErrorBoundary>
    </PageContainer>
  );
};

export default Customers;
