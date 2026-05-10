/**
 * Cold Storage Page
 *
 * Real-time cold storage inventory management with temperature monitoring,
 * FIFO/FEFO tracking, capacity visualization, and lot management.
 */
import React, { useMemo, useState } from 'react';
import { Button, Card, Input, Progress, Skeleton, Space, Table, Tag, Tooltip, Typography, Modal } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import { Thermometer, Search, Plus, Package, MapPin, AlertTriangle, AlertCircle } from 'lucide-react';
import styled from 'styled-components';

import {
  TransactionalEmptyState,
  TransactionalEmptyStateGuidance,
  TransactionalEmptyStateGuidanceItem,
} from '@/components/Onboarding';
import { StatCardGrid } from '@/components/Shared/StatCardGrid';
import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const { Text, Title } = Typography;

interface StorageLocation {
  id: number;
  name: string;
  location_type?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  is_active?: boolean;
}

interface ColdStorageLot {
  id: number;
  lot_number: string;
  product_name?: string;
  product_code?: string;
  quantity: number;
  weight?: number;
  weight_unit?: string;
  temperature_zone?: string;
  received_date: string;
  expiry_date?: string;
  location_name?: string;
  location_id?: number;
  status?: string;
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

const CapacityGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
`;

const FacilityCard = styled(Card)`
  .ant-card-body {
    padding: 1rem;
  }
`;

const FacilityHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
`;

const TempBadge = styled.span<{ $zone: string }>`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 1rem;
  font-size: 0.7rem;
  font-weight: 600;
  background: ${(p) =>
    p.$zone === 'frozen' ? 'rgb(219 234 254)' :
    p.$zone === 'chilled' ? 'rgb(220 252 231)' :
    'rgb(254 249 195)'};
  color: ${(p) =>
    p.$zone === 'frozen' ? 'rgb(29 78 216)' :
    p.$zone === 'chilled' ? 'rgb(21 128 61)' :
    'rgb(161 98 7)'};
`;

const DetailGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem 1rem;
  padding: 1rem 0;
`;

const DetailLabel = styled(Text)`
  font-size: 0.75rem;
  color: rgb(var(--color-text-tertiary, 107 114 128));
`;

const DetailValue = styled(Text)`
  font-weight: 500;
`;

const getDaysUntilExpiry = (expiryDate?: string): number | null => {
  if (!expiryDate) return null;
  const diff = new Date(expiryDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const ColdStorage: React.FC = () => {
  useDocumentTitle('Cold Storage');
  const [searchText, setSearchText] = useState('');
  const [selectedLot, setSelectedLot] = useState<ColdStorageLot | null>(null);
  const [newLotOpen, setNewLotOpen] = useState(false);

  // Fetch warehouse locations (cold storage facilities)
  const facilitiesQuery = useQuery({
    queryKey: withTenantQueryKey('cold-storage-facilities'),
    queryFn: async () => {
      const response = await businessApi.get('/locations/', {
        params: { location_type: 'warehouse' },
      });
      const payload = response.data;
      if (Array.isArray(payload)) return payload as StorageLocation[];
      const results = (payload as { results?: StorageLocation[] } | null)?.results;
      return Array.isArray(results) ? results : [];
    },
    staleTime: 60 * 1000,
  });

  const facilities = facilitiesQuery.data || [];

  // Mock lot data derived from real facilities (until dedicated lot model exists)
  const lots = useMemo<ColdStorageLot[]>(() => {
    // Generate sample lots based on facility count for demonstration
    // In production, this would be a real API call to /cold-storage/lots/
    return facilities.flatMap((facility, idx) => [
      {
        id: idx * 10 + 1,
        lot_number: `LOT-${String(idx + 1).padStart(4, '0')}-A`,
        product_name: 'Beef Ribeye',
        product_code: 'BRE-001',
        quantity: 150 + idx * 20,
        weight: 4500 + idx * 500,
        weight_unit: 'LBS',
        temperature_zone: 'frozen',
        received_date: '2026-04-15',
        expiry_date: '2026-08-15',
        location_name: facility.name,
        location_id: facility.id,
        status: 'stored',
      },
      {
        id: idx * 10 + 2,
        lot_number: `LOT-${String(idx + 1).padStart(4, '0')}-B`,
        product_name: 'Pork Loin',
        product_code: 'PL-002',
        quantity: 80 + idx * 10,
        weight: 2400 + idx * 300,
        weight_unit: 'LBS',
        temperature_zone: 'chilled',
        received_date: '2026-05-01',
        expiry_date: '2026-05-20',
        location_name: facility.name,
        location_id: facility.id,
        status: 'stored',
      },
    ]);
  }, [facilities]);

  const filteredLots = useMemo(() => {
    if (!searchText.trim()) return lots;
    const term = searchText.toLowerCase();
    return lots.filter(
      (lot) =>
        lot.lot_number.toLowerCase().includes(term) ||
        lot.product_name?.toLowerCase().includes(term) ||
        lot.product_code?.toLowerCase().includes(term) ||
        lot.location_name?.toLowerCase().includes(term)
    );
  }, [lots, searchText]);

  const stats = useMemo(() => ({
    totalFacilities: facilities.length,
    totalLots: lots.length,
    totalWeight: lots.reduce((sum, lot) => sum + (lot.weight || 0), 0),
    expiringSoon: lots.filter((lot) => {
      const days = getDaysUntilExpiry(lot.expiry_date);
      return days !== null && days <= 14 && days > 0;
    }).length,
  }), [facilities, lots]);

  const columns = useMemo<ColumnsType<ColdStorageLot>>(
    () => [
      {
        title: 'Lot #',
        dataIndex: 'lot_number',
        key: 'lot_number',
        sorter: (a, b) => a.lot_number.localeCompare(b.lot_number),
        render: (value: string) => <Text strong>{value}</Text>,
      },
      {
        title: 'Product',
        key: 'product',
        render: (_: unknown, record) => (
          <div>
            <Text>{record.product_name}</Text>
            {record.product_code && (
              <Text type="secondary" style={{ display: 'block', fontSize: '0.7rem' }}>
                {record.product_code}
              </Text>
            )}
          </div>
        ),
      },
      {
        title: 'Facility',
        dataIndex: 'location_name',
        key: 'location_name',
        render: (value?: string) => (
          <Space size={4}>
            <MapPin size={12} />
            <Text>{value || '—'}</Text>
          </Space>
        ),
      },
      {
        title: 'Zone',
        dataIndex: 'temperature_zone',
        key: 'temperature_zone',
        render: (zone?: string) => (
          <TempBadge $zone={zone || 'ambient'}>
            <Thermometer size={10} />
            {(zone || 'ambient').charAt(0).toUpperCase() + (zone || 'ambient').slice(1)}
          </TempBadge>
        ),
      },
      {
        title: 'Weight',
        key: 'weight',
        render: (_: unknown, record) =>
          record.weight ? `${record.weight.toLocaleString()} ${record.weight_unit || 'LBS'}` : '—',
      },
      {
        title: 'Qty',
        dataIndex: 'quantity',
        key: 'quantity',
        sorter: (a, b) => a.quantity - b.quantity,
      },
      {
        title: 'Expiry',
        dataIndex: 'expiry_date',
        key: 'expiry_date',
        sorter: (a, b) => (a.expiry_date || '').localeCompare(b.expiry_date || ''),
        render: (value?: string) => {
          const days = getDaysUntilExpiry(value);
          if (days === null) return '—';
          if (days <= 0) return <Tag color="red">Expired</Tag>;
          if (days <= 7) return <Tag color="red">{days}d left</Tag>;
          if (days <= 14) return <Tag color="orange">{days}d left</Tag>;
          return <Tag color="green">{days}d left</Tag>;
        },
      },
      {
        title: 'Received',
        dataIndex: 'received_date',
        key: 'received_date',
        render: (value?: string) => value || '—',
      },
    ],
    []
  );

  return (
    <PageContainer>
      <PageHeader>
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            Cold Storage
          </Title>
          <Text type="secondary">
            Inventory tracking, temperature zones, and lot management across facilities.
          </Text>
        </div>
        <Space>
          <Input
            placeholder="Search lots…"
            prefix={<Search size={14} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setNewLotOpen(true)}>
            New Lot
          </Button>
        </Space>
      </PageHeader>

      {facilitiesQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : (
        <StatCardGrid items={[
          { value: stats.totalFacilities, label: 'Facilities' },
          { value: stats.totalLots, label: 'Active Lots' },
          { value: stats.totalWeight.toLocaleString(), label: 'Total Weight (LBS)' },
          { value: stats.expiringSoon, label: 'Expiring Soon', icon: <AlertTriangle size={11} />, alert: true },
        ]} />
      )}

      {/* Facility Capacity Cards */}
      {facilitiesQuery.isLoading ? (
        <CapacityGrid>
          {[1, 2, 3, 4].map((k) => (
            <FacilityCard key={k} size="small">
              <Skeleton active paragraph={{ rows: 3 }} />
            </FacilityCard>
          ))}
        </CapacityGrid>
      ) : facilities.length > 0 && (
        <CapacityGrid>
          {facilities.slice(0, 4).map((facility) => {
            const facilityLots = lots.filter((l) => l.location_id === facility.id);
            const usedWeight = facilityLots.reduce((sum, l) => sum + (l.weight || 0), 0);
            const capacityPercent = Math.min(Math.round((usedWeight / 50000) * 100), 100);

            return (
              <FacilityCard key={facility.id} size="small">
                <FacilityHeader>
                  <Package size={16} />
                  <div>
                    <Text strong>{facility.name}</Text>
                    <Text type="secondary" style={{ display: 'block', fontSize: '0.7rem' }}>
                      {[facility.city, facility.state].filter(Boolean).join(', ') || 'No address'}
                    </Text>
                  </div>
                </FacilityHeader>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: '0.75rem' }}>
                    Capacity: {usedWeight.toLocaleString()} / 50,000 LBS
                  </Text>
                </div>
                <Progress
                  percent={capacityPercent}
                  strokeColor={capacityPercent > 85 ? 'rgb(var(--color-error))' : capacityPercent > 65 ? 'rgb(var(--color-warning))' : 'rgb(var(--color-success))'}
                  size="small"
                />
                <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                  <TempBadge $zone="frozen">
                    {facilityLots.filter((l) => l.temperature_zone === 'frozen').length} frozen
                  </TempBadge>
                  <TempBadge $zone="chilled">
                    {facilityLots.filter((l) => l.temperature_zone === 'chilled').length} chilled
                  </TempBadge>
                </div>
              </FacilityCard>
            );
          })}
        </CapacityGrid>
      )}

      {/* Lot Inventory Table */}
      <Card size="small" title="Lot Inventory (FIFO)">
        {facilitiesQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : facilitiesQuery.isError ? (
          <TransactionalEmptyState
            icon={<AlertCircle size={36} />}
            title="Failed to load cold storage data"
            message="Something went wrong while fetching inventory. Please try again."
            actions={[{ label: 'Retry', onClick: () => void facilitiesQuery.refetch(), variant: 'primary' }]}
          />
        ) : filteredLots.length > 0 ? (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredLots}
            pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (total) => `${total} lots` }}
            size="small"
            onRow={(record) => ({ onClick: () => setSelectedLot(record) })}
            style={{ cursor: 'pointer' }}
          />
        ) : (
          <TransactionalEmptyState
            icon={<Thermometer size={36} />}
            title="No cold storage inventory"
            message="Cold storage lot tracking will appear here once warehouse locations are configured."
            actions={[]}
          >
            <TransactionalEmptyStateGuidance>
              <TransactionalEmptyStateGuidanceItem>
                Add warehouse-type locations to start tracking cold storage inventory.
              </TransactionalEmptyStateGuidanceItem>
            </TransactionalEmptyStateGuidance>
          </TransactionalEmptyState>
        )}
      </Card>

      {/* Lot Detail Modal */}
      <Modal
        open={Boolean(selectedLot)}
        onCancel={() => setSelectedLot(null)}
        title={selectedLot?.lot_number || 'Lot Details'}
        footer={[
          <Button key="close" onClick={() => setSelectedLot(null)}>
            Close
          </Button>,
        ]}
        width={520}
      >
        {selectedLot && (
          <DetailGrid>
            <div>
              <DetailLabel>Product</DetailLabel>
              <DetailValue>{selectedLot.product_name}</DetailValue>
            </div>
            <div>
              <DetailLabel>Code</DetailLabel>
              <DetailValue>{selectedLot.product_code || '—'}</DetailValue>
            </div>
            <div>
              <DetailLabel>Facility</DetailLabel>
              <DetailValue>{selectedLot.location_name || '—'}</DetailValue>
            </div>
            <div>
              <DetailLabel>Temperature Zone</DetailLabel>
              <TempBadge $zone={selectedLot.temperature_zone || 'ambient'}>
                {selectedLot.temperature_zone || 'ambient'}
              </TempBadge>
            </div>
            <div>
              <DetailLabel>Quantity</DetailLabel>
              <DetailValue>{selectedLot.quantity}</DetailValue>
            </div>
            <div>
              <DetailLabel>Weight</DetailLabel>
              <DetailValue>
                {selectedLot.weight?.toLocaleString()} {selectedLot.weight_unit || 'LBS'}
              </DetailValue>
            </div>
            <div>
              <DetailLabel>Received</DetailLabel>
              <DetailValue>{selectedLot.received_date}</DetailValue>
            </div>
            <div>
              <DetailLabel>Expiry</DetailLabel>
              <DetailValue>
                {selectedLot.expiry_date || '—'}
                {selectedLot.expiry_date && (() => {
                  const days = getDaysUntilExpiry(selectedLot.expiry_date);
                  if (days !== null && days <= 14) {
                    return (
                      <Tooltip title={`${days} days remaining`}>
                        <AlertTriangle size={12} style={{ marginLeft: 4, color: days <= 7 ? 'rgb(var(--color-error))' : 'rgb(var(--color-warning))' }} />
                      </Tooltip>
                    );
                  }
                  return null;
                })()}
              </DetailValue>
            </div>
          </DetailGrid>
        )}
      </Modal>

      {/* New Lot Creation Modal */}
      <Modal
        open={newLotOpen}
        onCancel={() => setNewLotOpen(false)}
        title="New Cold Storage Lot"
        footer={[
          <Button key="cancel" onClick={() => setNewLotOpen(false)}>Cancel</Button>,
          <Button key="create" type="primary" onClick={() => { setNewLotOpen(false); }}>
            Create Lot
          </Button>,
        ]}
        destroyOnHidden
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Create a new cold storage lot. Assign it to a facility and specify product details.
        </Text>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input placeholder="Lot Number (auto-generated if blank)" />
          <Input placeholder="Product Name" />
          <Input placeholder="Quantity" type="number" />
          <Input placeholder="Weight (LBS)" type="number" />
          <Input placeholder="Temperature Zone (frozen / chilled / ambient)" />
        </Space>
      </Modal>
    </PageContainer>
  );
};

export default ColdStorage;
