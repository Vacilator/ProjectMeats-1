import React, { useCallback, useMemo, useState } from 'react';
import { Button, Card, Skeleton, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Truck, AlertCircle } from 'lucide-react';

import {
  TransactionalEmptyState,
  TransactionalEmptyStateGuidance,
  TransactionalEmptyStateGuidanceItem,
} from '@/components/Onboarding';
import { AuditHistoryTimeline } from '@/components/Operations/AuditHistoryTimeline';
import SharePortalLinkPanel from '@/components/Portal/SharePortalLinkPanel';
import { OperationalDocumentActions } from '@/components/Operations/OperationalDocumentActions';
import { EntityFormSurface } from '@/components/Shared';
import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';
import type { TradeTimelinePayload, TradeWeightPayload } from '@/utils/trade';
import { formatTradeDate, formatTradeWeight } from '@/utils/trade';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

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
  weight_unit?: string | null;
  trade_weight?: TradeWeightPayload | null;
  trade_timeline?: TradeTimelinePayload;
}

const formatStatus = (value?: string): string =>
  String(value || 'draft')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const FreightOrders: React.FC = () => {
  useDocumentTitle('Freight Orders');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<FreightOrder | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [portalAccessOrderId, setPortalAccessOrderId] = useState<string | null>(null);

  const freightOrdersQuery = useQuery({
    queryKey: withTenantQueryKey('freight-orders'),
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

  const handleCreateClose = useCallback(() => {
    setIsCreateOpen(false);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setIsCreateOpen(false);
    void freightOrdersQuery.refetch();
  }, [freightOrdersQuery]);

  const handleEditClose = useCallback(() => {
    setEditingOrderId(null);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setEditingOrderId(null);
    void freightOrdersQuery.refetch();
  }, [freightOrdersQuery]);

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
        render: (_value: string | null | undefined, record) =>
          formatTradeDate(record.trade_timeline, 'pick_up_date', record.pick_up_date),
      },
      {
        title: 'Delivery Date',
        dataIndex: 'delivery_date',
        key: 'delivery_date',
        render: (_value: string | null | undefined, record) =>
          formatTradeDate(record.trade_timeline, 'delivery_date', record.delivery_date),
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
        ) : freightOrdersQuery.isError ? (
          <TransactionalEmptyState
            icon={<AlertCircle size={36} />}
            title="Failed to load freight orders"
            message="Something went wrong while fetching freight orders. Please try again."
            actions={[{ label: 'Retry', onClick: () => void freightOrdersQuery.refetch(), variant: 'primary' }]}
          />
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
          <TransactionalEmptyState
            icon={<Truck size={36} />}
            title="No freight orders yet"
            message="Create your first freight order to coordinate carriers, pickup windows, and delivery commitments."
            actions={[
              {
                label: 'Create Freight Order',
                onClick: () => setIsCreateOpen(true),
                variant: 'primary',
              },
              {
                label: 'Manage Carriers',
                onClick: () => navigate('/carriers'),
                variant: 'secondary',
              },
            ]}
          >
            <TransactionalEmptyStateGuidance>
              <TransactionalEmptyStateGuidanceItem>
                Add or review carriers first so dispatch teams have the right transportation options available.
              </TransactionalEmptyStateGuidanceItem>
              <TransactionalEmptyStateGuidanceItem>
                Freight orders tie delivery planning, documents, and audit history together in one place.
              </TransactionalEmptyStateGuidanceItem>
            </TransactionalEmptyStateGuidance>
          </TransactionalEmptyState>
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
                onOptimisticStatusChange={(nextStatus) => {
                  setSelectedOrder((current) => (current ? { ...current, status: nextStatus } : current));
                  queryClient.setQueryData<FreightOrder[] | undefined>(
                    ['freight-orders'],
                    (current) =>
                      Array.isArray(current)
                        ? current.map((order) =>
                            order.id === selectedOrder.id ? { ...order, status: nextStatus } : order
                          )
                        : current
                  );
                }}
                onChanged={() => {
                  void freightOrdersQuery.refetch();
                }}
              />
              <Button onClick={() => setPortalAccessOrderId(String(selectedOrder.id))}>
                Portal Access
              </Button>
              <Button type="primary" onClick={() => setEditingOrderId(String(selectedOrder.id))}>
                Edit
              </Button>
              <Button onClick={() => setSelectedOrder(null)}>Close</Button>
            </Space>
          }
        >
          {portalAccessOrderId === String(selectedOrder.id) ? (
            <SharePortalLinkPanel
              entityType="freight-orders"
              entityId={selectedOrder.id}
              onBack={() => setPortalAccessOrderId(null)}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <Card size="small" title="General">
                <Space direction="vertical" size={4}>
                  <Text>Status: {formatStatus(selectedOrder.status)}</Text>
                  <Text>Carrier: {selectedOrder.carrier_name || '—'}</Text>
                  <Text>Protein: {selectedOrder.type_of_protein || '—'}</Text>
                  <Text>Quantity: {selectedOrder.quantity ?? '—'}</Text>
                  <Text>Total Weight: {formatTradeWeight(selectedOrder)}</Text>
                </Space>
              </Card>
              <Card size="small" title="Logistics">
                <Space direction="vertical" size={4}>
                  <Text>
                    Pickup Date: {formatTradeDate(
                      selectedOrder.trade_timeline,
                      'pick_up_date',
                      selectedOrder.pick_up_date
                    )}
                  </Text>
                  <Text>
                    Delivery Date: {formatTradeDate(
                      selectedOrder.trade_timeline,
                      'delivery_date',
                      selectedOrder.delivery_date
                    )}
                  </Text>
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
          )}
        </Card>
      ) : null}

      <EntityFormSurface
        entityType="freight-orders"
        mode="create"
        variant="modal"
        isOpen={isCreateOpen}
        onClose={handleCreateClose}
        onSuccess={handleCreateSuccess}
      />

      <EntityFormSurface
        entityType="freight-orders"
        mode="edit"
        variant="modal"
        entityId={editingOrderId || undefined}
        isOpen={Boolean(editingOrderId)}
        onClose={handleEditClose}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
};

export default FreightOrders;
