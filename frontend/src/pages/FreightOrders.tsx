import React, { useMemo, useState } from 'react';
import { Button, Card, Empty, Skeleton, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';

import { AuditHistoryTimeline } from '@/components/Operations/AuditHistoryTimeline';
import { OperationalDocumentActions } from '@/components/Operations/OperationalDocumentActions';
import { EntityFormSurface } from '@/components/Shared';
import { businessApi } from '@/services/businessApi';

const { Text, Title } = Typography;

interface FreightOrder {
  id: number;
  our_carrier_po_num?: string;
  carrier_name?: string;
  supplier?: number | null;
  carrier?: number | null;
  sales_order?: number | null;
  pick_up_date?: string | null;
  delivery_date?: string | null;
  status?: string;
  type_of_protein?: string;
  quantity?: number | null;
  total_weight?: string | null;
}

const formatDate = (value?: string | null): string =>
  value ? new Date(value).toLocaleDateString() : '—';

const formatStatus = (value?: string): string =>
  String(value || 'draft')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const FreightOrders: React.FC = () => {
  const [selectedOrder, setSelectedOrder] = useState<FreightOrder | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const freightOrdersQuery = useQuery({
    queryKey: ['freight-orders'],
    queryFn: async () => {
      const response = await businessApi.get('/carrier-pos/');
      const payload = response.data;
      if (Array.isArray(payload)) {
        return payload as FreightOrder[];
      }
      const results = (payload as { results?: FreightOrder[] } | null)?.results;
      return Array.isArray(results) ? results : [];
    },
    staleTime: 15 * 1000,
  });

  const columns = useMemo<ColumnsType<FreightOrder>>(
    () => [
      {
        title: 'Freight Order',
        dataIndex: 'our_carrier_po_num',
        key: 'our_carrier_po_num',
        render: (value: string | undefined, record) => value || `Carrier PO #${record.id}`,
      },
      {
        title: 'Carrier',
        dataIndex: 'carrier_name',
        key: 'carrier_name',
        render: (value: string | undefined) => value || '—',
      },
      {
        title: 'Pickup Date',
        dataIndex: 'pick_up_date',
        key: 'pick_up_date',
        render: (value: string | null | undefined) => formatDate(value),
      },
      {
        title: 'Delivery Date',
        dataIndex: 'delivery_date',
        key: 'delivery_date',
        render: (value: string | null | undefined) => formatDate(value),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (value: string | undefined) => <Tag color="blue">{formatStatus(value)}</Tag>,
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (_value, record) => (
          <Space>
            <Button size="small" onClick={() => setSelectedOrder(record)}>
              View
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={() => setEditingOrderId(String(record.id))}
            >
              Edit
            </Button>
          </Space>
        ),
      },
    ],
    []
  );

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            Freight Orders
          </Title>
          <Text type="secondary">
            Manage carrier purchase orders, dispatch workflow, PDFs, and audit history.
          </Text>
        </div>
        <Button type="primary" onClick={() => setIsCreateOpen(true)}>
          New Freight Order
        </Button>
      </div>

      <Card size="small">
        {freightOrdersQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : freightOrdersQuery.data?.length ? (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={freightOrdersQuery.data}
            pagination={{ pageSize: 10 }}
            onRow={(record) => ({
              onClick: () => setSelectedOrder(record),
            })}
          />
        ) : (
          <Empty description="No freight orders found." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      {selectedOrder ? (
        <Card
          size="small"
          title={selectedOrder.our_carrier_po_num || `Carrier PO #${selectedOrder.id}`}
          style={{ marginTop: 16 }}
          extra={
            <Space wrap>
              <OperationalDocumentActions
                entityType="carrier_purchase_order"
                entityId={selectedOrder.id}
                recordLabel={selectedOrder.our_carrier_po_num || `Carrier PO #${selectedOrder.id}`}
                compact
                onChanged={() => {
                  void freightOrdersQuery.refetch();
                }}
              />
              <Button type="primary" onClick={() => setEditingOrderId(String(selectedOrder.id))}>
                Edit
              </Button>
              <Button onClick={() => setSelectedOrder(null)}>Close</Button>
            </Space>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <Card size="small" title="General">
              <Space direction="vertical" size={4}>
                <Text>Status: {formatStatus(selectedOrder.status)}</Text>
                <Text>Carrier: {selectedOrder.carrier_name || '—'}</Text>
                <Text>Protein: {selectedOrder.type_of_protein || '—'}</Text>
                <Text>Quantity: {selectedOrder.quantity ?? '—'}</Text>
                <Text>Total Weight: {selectedOrder.total_weight || '—'}</Text>
              </Space>
            </Card>
            <Card size="small" title="Logistics">
              <Space direction="vertical" size={4}>
                <Text>Pickup Date: {formatDate(selectedOrder.pick_up_date)}</Text>
                <Text>Delivery Date: {formatDate(selectedOrder.delivery_date)}</Text>
                <Text>Carrier Ref: {selectedOrder.our_carrier_po_num || '—'}</Text>
              </Space>
            </Card>
            <Card size="small" title="Audit History">
              <AuditHistoryTimeline
                entityType="carrier_purchase_order"
                entityId={selectedOrder.id}
              />
            </Card>
          </div>
        </Card>
      ) : null}

      <EntityFormSurface
        entityType="freight-orders"
        mode="create"
        variant="modal"
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          setIsCreateOpen(false);
          void freightOrdersQuery.refetch();
        }}
      />

      <EntityFormSurface
        entityType="freight-orders"
        mode="edit"
        variant="modal"
        entityId={editingOrderId || undefined}
        isOpen={Boolean(editingOrderId)}
        onClose={() => setEditingOrderId(null)}
        onSuccess={() => {
          setEditingOrderId(null);
          void freightOrdersQuery.refetch();
        }}
      />
    </div>
  );
};

export default FreightOrders;
