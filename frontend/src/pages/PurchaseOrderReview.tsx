import React, { useCallback, useMemo } from 'react';
import { Alert, Button, Card, Descriptions, Result, Space, Spin, Tag, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';

import { OperationalDocumentActions } from '@/components/Operations/OperationalDocumentActions';
import {
  purchaseOrderReviewService,
  type PurchaseOrderReviewContext,
} from '@/services/purchaseOrderReviewService';
import { withTenantQueryKey } from '@/utils/queryKeys';

const { Paragraph, Text, Title } = Typography;

const asDisplay = (value: unknown, fallback = '—'): string => {
  if (value === null || value === undefined) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized ? normalized : fallback;
};

const formatMoney = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `$${numeric.toFixed(2)}` : String(value);
};

const formatDate = (value?: string | null): string => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
};

const statusTone = (status?: string): 'blue' | 'gold' | 'green' | 'default' => {
  switch (status) {
    case 'pending_approval':
      return 'gold';
    case 'approved':
      return 'green';
    case 'draft':
    case 'pending':
      return 'blue';
    default:
      return 'default';
  }
};

const ReviewDetails: React.FC<{
  title: string;
  items: Array<{ key: string; label: React.ReactNode; children: React.ReactNode }>;
}> = ({ title, items }) => (
  <Card title={title}>
    <Descriptions column={1} size="small" items={items} />
  </Card>
);

export const PurchaseOrderReview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const reviewQueryKey = useMemo(
    () => withTenantQueryKey('purchase-order-review', String(id || '')),
    [id],
  );

  const reviewQuery = useQuery({
    queryKey: reviewQueryKey,
    queryFn: async () => purchaseOrderReviewService.getReviewContext(String(id)),
    enabled: Boolean(id),
    staleTime: 15 * 1000,
  });

  const handleChanged = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: reviewQueryKey });
  }, [queryClient, reviewQueryKey]);

  if (!id) {
    return (
      <Result
        status="404"
        title="Purchase order review unavailable"
        subTitle="The requested purchase order review link is incomplete."
      />
    );
  }

  if (reviewQuery.isLoading) {
    return (
      <main style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
        <Spin size="large" />
      </main>
    );
  }

  if (reviewQuery.isError || !reviewQuery.data) {
    return (
      <main style={{ padding: 24 }}>
        <Result
          status="error"
          title="Unable to load supplier PO review"
          subTitle="The review context could not be loaded for this purchase order."
          extra={
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/purchase-orders')}>
              Back to Purchase Orders
            </Button>
          }
        />
      </main>
    );
  }

  const data: PurchaseOrderReviewContext = reviewQuery.data;
  const purchaseOrder = data.purchase_order;
  const reviewTitle = purchaseOrder.order_number || `Purchase Order ${purchaseOrder.id}`;

  return (
    <main style={{ padding: 24, display: 'grid', gap: 16 }}>
      <Space orientation="vertical" size={8} style={{ width: '100%' }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/purchase-orders')}
          style={{ alignSelf: 'flex-start' }}
        >
          Back to Purchase Orders
        </Button>
        <Title level={2} style={{ margin: 0 }}>
          Purchase Order Review
        </Title>
        <Paragraph style={{ marginBottom: 0 }}>
          Review the supplier quote lineage and approve this draft purchase order using the shared
          document workflow.
        </Paragraph>
      </Space>

      {!data.review_context_complete ? (
        <Alert
          type="warning"
          showIcon
          message="Review context is incomplete"
          description="This purchase order is available, but its supplier quote lineage is incomplete or could not be resolved safely for this tenant."
        />
      ) : null}

      <Card>
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap size={[8, 8]}>
            <Title level={3} style={{ margin: 0 }}>
              {reviewTitle}
            </Title>
            <Tag color={statusTone(purchaseOrder.status)}>{asDisplay(purchaseOrder.status)}</Tag>
            {data.review_state ? <Tag color="purple">{data.review_state}</Tag> : null}
          </Space>
          <Descriptions
            size="small"
            column={2}
            items={[
              {
                key: 'supplier',
                label: 'Supplier',
                children: asDisplay(data.rfq?.supplier_name || data.inquiry?.supplier_name),
              },
              {
                key: 'order-date',
                label: 'Order Date',
                children: formatDate(purchaseOrder.order_date),
              },
              {
                key: 'item',
                label: 'Item',
                children: asDisplay(purchaseOrder.item_description),
              },
              {
                key: 'amount',
                label: 'Total Amount',
                children: formatMoney(purchaseOrder.total_amount),
              },
              {
                key: 'weight',
                label: 'Quoted Weight',
                children: `${asDisplay(purchaseOrder.total_weight)} ${asDisplay(
                  purchaseOrder.weight_unit,
                  '',
                )}`.trim() || '—',
              },
              {
                key: 'contact-email',
                label: 'Supplier Contact Email',
                children: asDisplay(purchaseOrder.supplier_contact_email),
              },
            ]}
          />
          {purchaseOrder.notes ? (
            <Text type="secondary">{purchaseOrder.notes}</Text>
          ) : null}
        </Space>
      </Card>

      <ReviewDetails
        title="Approval Actions"
        items={[
          {
            key: 'current-status',
            label: 'Current Status',
            children: (
              <Space wrap>
                <Tag color={statusTone(data.workflow.current_status)}>
                  {asDisplay(data.workflow.current_status)}
                </Tag>
                {data.workflow.allowed_transitions.map((statusValue) => (
                  <Tag key={statusValue}>{statusValue}</Tag>
                ))}
              </Space>
            ),
          },
          {
            key: 'actions',
            label: 'Workflow Controls',
            children: (
              <OperationalDocumentActions
                entityType="purchase_order"
                entityId={purchaseOrder.id}
                recordLabel={reviewTitle}
                onChanged={handleChanged}
              />
            ),
          },
        ]}
      />

      <ReviewDetails
        title="Source Lineage"
        items={[
          {
            key: 'inquiry-number',
            label: 'Inquiry Number',
            children: asDisplay(
              data.inquiry?.inquiry_number || data.source_lineage?.inquiry_number,
            ),
          },
          {
            key: 'rfq-id',
            label: 'RFQ',
            children: asDisplay(data.rfq?.id || data.source_lineage?.rfq_id),
          },
          {
            key: 'correlation',
            label: 'Correlation Key',
            children: asDisplay(data.source_lineage?.correlation_key),
          },
          {
            key: 'thread',
            label: 'Email Thread',
            children: asDisplay(
              data.rfq?.provider_thread_id || data.source_lineage?.email_thread_id,
            ),
          },
          {
            key: 'message',
            label: 'Email Message',
            children: asDisplay(
              data.rfq?.provider_message_id || data.source_lineage?.email_message_id,
            ),
          },
          {
            key: 'rfq-recipient',
            label: 'RFQ Recipient',
            children: asDisplay(data.rfq?.recipient_email),
          },
        ]}
      />

      <ReviewDetails
        title="Inquiry Context"
        items={[
          {
            key: 'route',
            label: 'Route Decision',
            children: asDisplay(data.inquiry?.route_decision),
          },
          {
            key: 'protein',
            label: 'Requested Protein',
            children: asDisplay(data.inquiry?.requested_protein),
          },
          {
            key: 'master-product',
            label: 'Requested Product',
            children: asDisplay(data.inquiry?.requested_master_product_name),
          },
          {
            key: 'customer',
            label: 'Customer',
            children: asDisplay(data.inquiry?.customer_name),
          },
          {
            key: 'contact',
            label: 'Inquiry Contact',
            children: asDisplay(data.inquiry?.contact_name),
          },
          {
            key: 'contact-email',
            label: 'Inquiry Email',
            children: asDisplay(data.inquiry?.contact_email),
          },
        ]}
      />

      <ReviewDetails
        title="Parsed Quote"
        items={[
          {
            key: 'availability',
            label: 'Availability',
            children: asDisplay(data.normalized_quote?.availability_status),
          },
          {
            key: 'offered-product',
            label: 'Offered Product',
            children: asDisplay(data.normalized_quote?.offered_product_name),
          },
          {
            key: 'quantity',
            label: 'Quantity',
            children: `${asDisplay(data.normalized_quote?.quantity)} ${asDisplay(
              data.normalized_quote?.uom,
              '',
            )}`.trim() || '—',
          },
          {
            key: 'ppu',
            label: 'Price Per Unit',
            children: formatMoney(data.normalized_quote?.price_per_unit),
          },
          {
            key: 'lead-time',
            label: 'Lead Time',
            children: asDisplay(data.normalized_quote?.lead_time_text),
          },
          {
            key: 'summary',
            label: 'AI Summary',
            children: asDisplay(data.supplier_reply_parse?.summary),
          },
          {
            key: 'confidence',
            label: 'AI Confidence',
            children:
              typeof data.supplier_reply_parse?.confidence === 'number'
                ? `${Math.round(data.supplier_reply_parse.confidence * 100)}%`
                : '—',
          },
          {
            key: 'notes',
            label: 'Supplier Notes',
            children: asDisplay(data.normalized_quote?.notes),
          },
        ]}
      />
    </main>
  );
};

export default PurchaseOrderReview;
