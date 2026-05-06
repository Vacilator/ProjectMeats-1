import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';

import { AdminGuard } from '@/components/Admin';
import type { AdminPermissions } from '@/hooks/useAdminPermissions';
import {
  settlementEventsService,
  type SettlementEvent,
  type SettlementReasonCode,
} from '@/services/settlementEventsService';

const reasonLabels: Record<SettlementReasonCode, string> = {
  '': 'Needs review',
  exact_invoice_match: 'Exact invoice match',
  exact_sales_order_match: 'Exact sales order match',
  exact_purchase_order_match: 'Exact purchase order match',
  manual_invoice_override: 'Manual invoice override',
  manual_sales_order_override: 'Manual sales order override',
  manual_purchase_order_override: 'Manual purchase order override',
  accountant_rejected: 'Accountant rejected',
  missing_reference: 'Missing reference',
  reference_not_found: 'Reference not found',
  amount_mismatch: 'Amount mismatch',
  ambiguous_match: 'Ambiguous match',
  unsupported_direction: 'Unsupported direction',
};

const reasonOptions = [
  { label: 'All review reasons', value: '' },
  { label: 'Missing reference', value: 'missing_reference' },
  { label: 'Reference not found', value: 'reference_not_found' },
  { label: 'Amount mismatch', value: 'amount_mismatch' },
  { label: 'Ambiguous match', value: 'ambiguous_match' },
  { label: 'Unsupported direction', value: 'unsupported_direction' },
] as const;

const numberFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatAmount(amount: string): string {
  const parsed = Number(amount);
  return Number.isFinite(parsed) ? numberFormatter.format(parsed) : amount;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '—';
  }
  return dateTimeFormatter.format(new Date(value));
}

function resolveMatchedTarget(event: SettlementEvent): string {
  if (event.matched_invoice) {
    return `Invoice #${event.matched_invoice}`;
  }
  if (event.matched_sales_order) {
    return `Sales Order #${event.matched_sales_order}`;
  }
  if (event.matched_purchase_order) {
    return `Purchase Order #${event.matched_purchase_order}`;
  }
  return 'Unlinked';
}

function isAccountingAdmin(permissions: AdminPermissions): boolean {
  return ['admin', 'owner', 'superuser'].includes(permissions.role);
}

export const SettlementQueue: React.FC = () => {
  const [events, setEvents] = useState<SettlementEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SettlementEvent | null>(null);
  const [reasonFilter, setReasonFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [activeAction, setActiveAction] = useState<'override' | 'reject' | null>(null);
  const [overrideForm] = Form.useForm();
  const [rejectForm] = Form.useForm();

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextEvents = await settlementEventsService.list({
        queue_only: true,
        ...(reasonFilter ? { reason_code: reasonFilter } : {}),
      });
      setEvents(nextEvents);
      setSelectedEvent((current) => nextEvents.find((event) => event.id === current?.id) ?? null);
    } catch (loadError) {
      console.error('[SettlementQueue] Failed to load queue', loadError);
      setError('Unable to load the settlement review queue.');
    } finally {
      setLoading(false);
    }
  }, [reasonFilter]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const columns = useMemo(
    () => [
      {
        title: 'Occurred',
        dataIndex: 'occurred_at',
        key: 'occurred_at',
        render: (value: string) => formatDateTime(value),
      },
      {
        title: 'Source',
        dataIndex: 'source_name',
        key: 'source_name',
      },
      {
        title: 'Amount',
        dataIndex: 'amount',
        key: 'amount',
        render: (value: string) => formatAmount(value),
      },
      {
        title: 'Reason',
        dataIndex: 'reconciliation_reason_code',
        key: 'reconciliation_reason_code',
        render: (value: SettlementReasonCode) => (
          <Tag color="gold">{reasonLabels[value] ?? 'Needs review'}</Tag>
        ),
      },
      {
        title: 'Reference',
        key: 'reference',
        render: (_value: unknown, record: SettlementEvent) =>
          record.external_event_id || record.idempotency_key.slice(0, 12),
      },
    ],
    []
  );

  const selectedRawPayload = useMemo(() => {
    if (!selectedEvent) {
      return '';
    }
    try {
      return JSON.stringify(JSON.parse(selectedEvent.raw_payload), null, 2);
    } catch {
      return selectedEvent.raw_payload;
    }
  }, [selectedEvent]);

  const handleOverride = useCallback(async () => {
    if (!selectedEvent) {
      return;
    }
    const values = await overrideForm.validateFields();
    setSubmitting(true);
    try {
      await settlementEventsService.override(selectedEvent.id, {
        target_type: values.target_type,
        target_id: values.target_id,
        review_note: values.review_note || '',
      });
      message.success('Settlement override applied.');
      setActiveAction(null);
      overrideForm.resetFields();
      setSelectedEvent(null);
      await loadQueue();
    } catch (submitError) {
      console.error('[SettlementQueue] Failed to apply override', submitError);
      message.error('Unable to apply the settlement override.');
    } finally {
      setSubmitting(false);
    }
  }, [loadQueue, overrideForm, selectedEvent]);

  const handleReject = useCallback(async () => {
    if (!selectedEvent) {
      return;
    }
    const values = await rejectForm.validateFields();
    setSubmitting(true);
    try {
      await settlementEventsService.reject(selectedEvent.id, {
        review_note: values.review_note || '',
      });
      message.success('Settlement event rejected.');
      setActiveAction(null);
      rejectForm.resetFields();
      setSelectedEvent(null);
      await loadQueue();
    } catch (submitError) {
      console.error('[SettlementQueue] Failed to reject settlement event', submitError);
      message.error('Unable to reject the settlement event.');
    } finally {
      setSubmitting(false);
    }
  }, [loadQueue, rejectForm, selectedEvent]);

  return (
    <AdminGuard feature="workspace" allow={isAccountingAdmin}>
      <Space orientation="vertical" size="large" style={{ width: '100%', padding: '24px' }}>
        <Space orientation="vertical" size={4}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Settlement Queue
          </Typography.Title>
          <Typography.Text type="secondary">
            Review unmatched settlement events, relink them to the correct record, or reject them
            without posting a payment.
          </Typography.Text>
        </Space>

        <Card>
          <Space
            align="center"
            size="middle"
            style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}
          >
            <Select
              aria-label="Settlement reason filter"
              options={reasonOptions.map((option) => ({ ...option }))}
              style={{ minWidth: 240 }}
              value={reasonFilter}
              onChange={setReasonFilter}
            />
            <Button onClick={() => void loadQueue()} loading={loading}>
              Refresh queue
            </Button>
          </Space>
        </Card>

        {error ? <Alert type="error" message={error} showIcon /> : null}

        <Card styles={{ body: { padding: 0 } }}>
          <Table<SettlementEvent>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={events}
            locale={{
              emptyText: (
                <Empty
                  description="No settlement events need review right now."
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            onRow={(record) => ({
              onClick: () => setSelectedEvent(record),
              style: { cursor: 'pointer' },
            })}
          />
        </Card>

        <Drawer
          title={selectedEvent ? `Settlement event #${selectedEvent.id}` : 'Settlement event'}
          open={Boolean(selectedEvent)}
          onClose={() => {
            setSelectedEvent(null);
            setActiveAction(null);
            overrideForm.resetFields();
            rejectForm.resetFields();
          }}
          size="large"
          extra={
            selectedEvent ? (
              <Space>
                <Button onClick={() => setActiveAction('reject')}>Reject</Button>
                <Button type="primary" onClick={() => setActiveAction('override')}>
                  Override / Relink
                </Button>
              </Space>
            ) : null
          }
        >
          {selectedEvent ? (
            <Space orientation="vertical" size="large" style={{ width: '100%' }}>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Review reason">
                  {reasonLabels[selectedEvent.reconciliation_reason_code] ?? 'Needs review'}
                </Descriptions.Item>
                <Descriptions.Item label="Occurred">
                  {formatDateTime(selectedEvent.occurred_at)}
                </Descriptions.Item>
                <Descriptions.Item label="Amount">
                  {formatAmount(selectedEvent.amount)}
                </Descriptions.Item>
                <Descriptions.Item label="Source">
                  {selectedEvent.source_name}
                </Descriptions.Item>
                <Descriptions.Item label="Provider account">
                  {selectedEvent.provider_account_reference}
                </Descriptions.Item>
                <Descriptions.Item label="Current link">
                  {resolveMatchedTarget(selectedEvent)}
                </Descriptions.Item>
                <Descriptions.Item label="Reviewed by">
                  {selectedEvent.reviewed_by_name || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Reviewed at">
                  {formatDateTime(selectedEvent.reviewed_at)}
                </Descriptions.Item>
                <Descriptions.Item label="Review note">
                  {selectedEvent.review_note || '—'}
                </Descriptions.Item>
              </Descriptions>

              <Card size="small" title="Raw payload">
                <Typography.Paragraph
                  style={{
                    marginBottom: 0,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'var(--font-family-mono, monospace)',
                  }}
                >
                  {selectedRawPayload}
                </Typography.Paragraph>
              </Card>

              {activeAction === 'override' ? (
                <Card size="small" title="Override settlement event">
                  <Form
                    form={overrideForm}
                    layout="vertical"
                    initialValues={{ target_type: 'invoice', target_id: undefined, review_note: '' }}
                  >
                    <Form.Item
                      label="Target type"
                      name="target_type"
                      rules={[{ required: true, message: 'Select a target type.' }]}
                    >
                      <Select
                        options={[
                          { label: 'Invoice', value: 'invoice' },
                          { label: 'Sales Order', value: 'sales_order' },
                          { label: 'Purchase Order', value: 'purchase_order' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item
                      label="Target record ID"
                      name="target_id"
                      rules={[{ required: true, message: 'Enter the target record id.' }]}
                    >
                      <InputNumber min={1} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item label="Review note" name="review_note">
                      <Input.TextArea rows={4} placeholder="Why this event was relinked" />
                    </Form.Item>
                    <Space>
                      <Button
                        onClick={() => {
                          setActiveAction(null);
                          overrideForm.resetFields();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="primary" loading={submitting} onClick={() => void handleOverride()}>
                        Apply override
                      </Button>
                    </Space>
                  </Form>
                </Card>
              ) : null}

              {activeAction === 'reject' ? (
                <Card size="small" title="Reject settlement event">
                  <Form form={rejectForm} layout="vertical">
                    <Form.Item label="Review note" name="review_note">
                      <Input.TextArea rows={4} placeholder="Why this event should stay ignored" />
                    </Form.Item>
                    <Space>
                      <Button
                        onClick={() => {
                          setActiveAction(null);
                          rejectForm.resetFields();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button danger loading={submitting} onClick={() => void handleReject()}>
                        Reject event
                      </Button>
                    </Space>
                  </Form>
                </Card>
              ) : null}
            </Space>
          ) : null}
        </Drawer>
      </Space>
    </AdminGuard>
  );
};

export default SettlementQueue;
