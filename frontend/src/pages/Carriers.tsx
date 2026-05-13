/**
 * Carriers Page
 *
 * Full carrier management: database, scorecards, compliance, performance metrics.
 * Follows the FreightOrders/SalesOrders pattern with AntD Table + EntityFormSurface.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Button, Card, Input, Modal, Skeleton, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck, Search, Plus, Shield, AlertTriangle, AlertCircle } from 'lucide-react';
import styled from 'styled-components';

import {
  TransactionalEmptyState,
  TransactionalEmptyStateGuidance,
  TransactionalEmptyStateGuidanceItem,
} from '@/components/Onboarding';
import { StatCardGrid } from '@/components/Shared/StatCardGrid';
import { CarrierCreateForm } from './Carriers/CarrierCreateForm';
import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { buildCsv, downloadCsv } from '@/utils/csv';

const { Text, Title } = Typography;

interface Carrier {
  id: number;
  name: string;
  code?: string;
  carrier_type?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  mc_number?: string;
  dot_number?: string;
  insurance_provider?: string;
  insurance_expiry?: string;
  is_active?: boolean;
  city?: string;
  state?: string;
  country?: string;
}

const PageContainer = styled.div`
  padding: 1rem;
  max-width: 1600px;
  margin: 0 auto;
`;

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const HeaderLeft = styled.div``;

const isInsuranceExpiringSoon = (expiry?: string): boolean => {
  if (!expiry) return false;
  const expiryDate = new Date(expiry);
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return expiryDate <= thirtyDaysFromNow && expiryDate >= now;
};

const isInsuranceExpired = (expiry?: string): boolean => {
  if (!expiry) return false;
  return new Date(expiry) < new Date();
};

const Carriers: React.FC = () => {
  useDocumentTitle('Carriers');
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCarrierId, setEditingCarrierId] = useState<string | null>(null);

  const carriersQuery = useQuery({
    queryKey: withTenantQueryKey('carriers'),
    queryFn: async () => {
      const response = await businessApi.get('/carriers/');
      const payload = response.data;
      if (Array.isArray(payload)) return payload as Carrier[];
      const results = (payload as { results?: Carrier[] } | null)?.results;
      return Array.isArray(results) ? results : [];
    },
    staleTime: 30 * 1000,
  });

  const carriers = carriersQuery.data || [];
  const refreshCarriers = useCallback(
    () => queryClient.invalidateQueries({ queryKey: withTenantQueryKey('carriers') }),
    [queryClient]
  );

  const handleExportCsv = useCallback(() => {
    const headers = ['Name', 'Code', 'Type', 'Contact Person', 'Phone', 'Email', 'MC Number'];
    const rows = carriers.map((c: Carrier) => [
      c.name ?? '', c.code ?? '', c.carrier_type ?? '',
      c.contact_person ?? '', c.phone ?? '', c.email ?? '', c.mc_number ?? '',
    ]);
    const csv = buildCsv({ headers, rows });
    downloadCsv(`carriers_${new Date().toISOString().split('T')[0]}.csv`, csv);
  }, [carriers]);

  const handleCreateClose = useCallback(() => {
    setIsCreateOpen(false);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setIsCreateOpen(false);
    void refreshCarriers();
  }, [refreshCarriers]);

  const handleEditClose = useCallback(() => {
    setEditingCarrierId(null);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setEditingCarrierId(null);
    void refreshCarriers();
  }, [refreshCarriers]);

  const filteredCarriers = useMemo(() => {
    if (!searchText.trim()) return carriers;
    const term = searchText.toLowerCase();
    return carriers.filter(
      (c) =>
        c.name?.toLowerCase().includes(term) ||
        c.code?.toLowerCase().includes(term) ||
        c.mc_number?.toLowerCase().includes(term) ||
        c.dot_number?.toLowerCase().includes(term) ||
        c.city?.toLowerCase().includes(term) ||
        c.state?.toLowerCase().includes(term)
    );
  }, [carriers, searchText]);

  const stats = useMemo(() => {
    const active = carriers.filter((c) => c.is_active !== false).length;
    const expiring = carriers.filter((c) => isInsuranceExpiringSoon(c.insurance_expiry)).length;
    const expired = carriers.filter((c) => isInsuranceExpired(c.insurance_expiry)).length;
    return { total: carriers.length, active, expiring, expired };
  }, [carriers]);

  const columns = useMemo<ColumnsType<Carrier>>(
    () => [
      {
        title: 'Carrier',
        dataIndex: 'name',
        key: 'name',
        sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
        render: (value: string, record) => (
          <Space>
            <Truck size={14} />
            <div>
              <Text strong>{value}</Text>
              {record.code && (
                <Text type="secondary" style={{ display: 'block', fontSize: '0.75rem' }}>
                  {record.code}
                </Text>
              )}
            </div>
          </Space>
        ),
      },
      {
        title: 'Type',
        dataIndex: 'carrier_type',
        key: 'carrier_type',
        render: (value?: string) =>
          value ? <Tag>{value.replace(/_/g, ' ').toUpperCase()}</Tag> : '—',
      },
      {
        title: 'Location',
        key: 'location',
        render: (_: unknown, record) => {
          const parts = [record.city, record.state].filter(Boolean);
          return parts.length ? parts.join(', ') : '—';
        },
      },
      {
        title: 'Contact',
        dataIndex: 'contact_person',
        key: 'contact_person',
        render: (value?: string) => value || '—',
      },
      {
        title: 'MC / DOT',
        key: 'regulatory',
        render: (_: unknown, record) => (
          <Space direction="vertical" size={0}>
            {record.mc_number && <Text style={{ fontSize: '0.75rem' }}>MC: {record.mc_number}</Text>}
            {record.dot_number && <Text style={{ fontSize: '0.75rem' }}>DOT: {record.dot_number}</Text>}
            {!record.mc_number && !record.dot_number && <Text type="secondary">—</Text>}
          </Space>
        ),
      },
      {
        title: 'Insurance',
        key: 'insurance',
        render: (_: unknown, record) => {
          if (!record.insurance_expiry) return <Text type="secondary">—</Text>;
          if (isInsuranceExpired(record.insurance_expiry)) {
            return (
              <Tooltip title="Insurance expired">
                <Tag color="red" icon={<AlertTriangle size={10} />}>
                  Expired
                </Tag>
              </Tooltip>
            );
          }
          if (isInsuranceExpiringSoon(record.insurance_expiry)) {
            return (
              <Tooltip title="Insurance expiring within 30 days">
                <Tag color="orange" icon={<AlertTriangle size={10} />}>
                  Expiring
                </Tag>
              </Tooltip>
            );
          }
          return (
            <Tooltip title={`Expires: ${record.insurance_expiry}`}>
              <Tag color="green" icon={<Shield size={10} />}>
                Valid
              </Tag>
            </Tooltip>
          );
        },
      },
      {
        title: 'Status',
        dataIndex: 'is_active',
        key: 'is_active',
        render: (value?: boolean) =>
          value === false ? <Tag color="default">Inactive</Tag> : <Tag color="green">Active</Tag>,
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 100,
        render: (_: unknown, record) => (
          <Button size="small" type="primary" onClick={(e) => { e.stopPropagation(); setEditingCarrierId(String(record.id)); }}>
            Edit
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <PageContainer>
      <PageHeader>
        <HeaderLeft>
          <Title level={3} style={{ marginBottom: 0 }}>
            Carrier Management
          </Title>
          <Text type="secondary">
            Manage carriers, track compliance, and monitor performance.
          </Text>
        </HeaderLeft>
        <Space>
          <Input
            placeholder="Search carriers…"
            prefix={<Search size={14} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Button onClick={handleExportCsv} disabled={!carriers.length}>
            Export CSV
          </Button>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setIsCreateOpen(true)}>
            Add Carrier
          </Button>
        </Space>
      </PageHeader>

      <StatCardGrid items={[
        { value: stats.total, label: 'Total Carriers' },
        { value: stats.active, label: 'Active' },
        { value: stats.expiring, label: 'Insurance Expiring', alert: true },
        { value: stats.expired, label: 'Insurance Expired', alert: true },
      ]} />

      <Card size="small">
        {carriersQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : carriersQuery.isError ? (
          <TransactionalEmptyState
            icon={<AlertCircle size={36} />}
            title="Failed to load carriers"
            message="Something went wrong while fetching carriers. Please try again."
            actions={[{ label: 'Retry', onClick: () => void carriersQuery.refetch(), variant: 'primary' }]}
          />
        ) : filteredCarriers.length > 0 ? (
          <Table
            aria-label="Carriers list"
            rowKey="id"
            columns={columns}
            dataSource={filteredCarriers}
            pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (total) => `${total} carriers` }}
            size="small"
          />
        ) : carriers.length === 0 ? (
          <TransactionalEmptyState
            icon={<Truck size={36} />}
            title="No carriers yet"
            message="Add your first carrier to start managing your logistics network."
            actions={[
              { label: 'Add Carrier', onClick: () => setIsCreateOpen(true), variant: 'primary' },
            ]}
          >
            <TransactionalEmptyStateGuidance>
              <TransactionalEmptyStateGuidanceItem>
                Carriers handle transportation between plants, warehouses, and customers.
              </TransactionalEmptyStateGuidanceItem>
              <TransactionalEmptyStateGuidanceItem>
                Track MC/DOT numbers, insurance expiry, and performance metrics.
              </TransactionalEmptyStateGuidanceItem>
            </TransactionalEmptyStateGuidance>
          </TransactionalEmptyState>
        ) : (
          <TransactionalEmptyState
            icon={<Search size={36} />}
            title="No results"
            message={`No carriers match "${searchText}"`}
            actions={[{ label: 'Clear Search', onClick: () => setSearchText(''), variant: 'secondary' }]}
          />
        )}
      </Card>

      {/* Create Carrier Modal */}
      <Modal
        open={isCreateOpen}
        onCancel={handleCreateClose}
        footer={null}
        width={900}
        destroyOnClose
        title="New Carrier"
      >
        <CarrierCreateForm
          mode="create"
          onSuccess={handleCreateSuccess}
          onCancel={handleCreateClose}
        />
      </Modal>

      {/* Edit Carrier Modal */}
      <Modal
        open={Boolean(editingCarrierId)}
        onCancel={handleEditClose}
        footer={null}
        width={900}
        destroyOnClose
        title="Edit Carrier"
      >
        <CarrierCreateForm
          mode="edit"
          entityId={editingCarrierId || undefined}
          onSuccess={handleEditSuccess}
          onCancel={handleEditClose}
        />
      </Modal>
    </PageContainer>
  );
};

export default Carriers;
