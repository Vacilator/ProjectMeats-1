/**
 * TradesInterventionDashboard - Trades Requiring Intervention
 *
 * Dedicated control tower for halted/failed trades showing:
 * - Exception queue with failure reasons
 * - Lineage context (which process step failed)
 * - Current trade state and last successful step
 * - One-click recovery actions (Retry, Requeue, Escalate, Skip)
 */

import React, { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Table,
  Tag,
  Button,
  Badge,
  Tooltip,
  Empty,
  Spin,
  Space,
  Modal,
  Descriptions,
  Alert,
  message,
} from 'antd';
import {
  WarningOutlined,
  ReloadOutlined,
  StopOutlined,
  ExclamationCircleOutlined,
  RightCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { businessApi } from '@/services/businessApi';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface InterventionTrade {
  id: string;
  trade_ref: string;
  process_run_id: string;
  failed_step: string;
  failed_step_label: string;
  failure_reason: string;
  failure_category: 'timeout' | 'validation' | 'external' | 'permission' | 'data' | 'unknown';
  last_successful_step: string;
  customer_name: string;
  supplier_name: string;
  order_amount: number;
  failed_at: string;
  retry_count: number;
  max_retries: number;
  assigned_to: string | null;
  lineage: {
    source_type: string;
    source_ref: string;
    inquiry_ref: string | null;
    so_ref: string | null;
    po_ref: string | null;
  };
}

type RecoveryAction = 'retry' | 'requeue' | 'escalate' | 'skip';

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    timeout: 'orange',
    validation: 'red',
    external: 'purple',
    permission: 'volcano',
    data: 'cyan',
    unknown: 'default',
  };
  return map[cat] || 'default';
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export function TradesInterventionDashboard(): React.ReactElement {
  const queryClient = useQueryClient();

  const { data: trades, isLoading } = useQuery<InterventionTrade[]>({
    queryKey: ['intervention', 'trades'],
    queryFn: async () => {
      const res = await businessApi.get('/workflows/intervention/trades/');
      return res.data ?? [];
    },
    refetchInterval: 30_000,
  });

  const recoveryMutation = useMutation({
    mutationFn: async (params: { tradeId: string; action: RecoveryAction }) => {
      const res = await businessApi.post(
        `/workflows/intervention/trades/${params.tradeId}/${params.action}/`,
      );
      return res.data;
    },
    onSuccess: (_, vars) => {
      message.success(`${vars.action} action completed`);
      queryClient.invalidateQueries({ queryKey: ['intervention', 'trades'] });
    },
    onError: (_, vars) => {
      message.error(`Failed to ${vars.action} trade`);
    },
  });

  const handleRecovery = useCallback(
    (tradeId: string, action: RecoveryAction) => {
      if (action === 'skip') {
        Modal.confirm({
          title: 'Skip Failed Step',
          content:
            'This will skip the failed step and continue the process. The skipped step will not be retried. Are you sure?',
          okText: 'Skip',
          okType: 'danger',
          onOk: () => recoveryMutation.mutate({ tradeId, action }),
        });
      } else {
        recoveryMutation.mutate({ tradeId, action });
      }
    },
    [recoveryMutation],
  );

  const columns = useMemo(
    () => [
      {
        title: 'Trade',
        dataIndex: 'trade_ref',
        key: 'trade_ref',
        render: (val: string, record: InterventionTrade) => (
          <div>
            <span className="font-medium">{val}</span>
            <div className="text-xs text-gray-400">{timeAgo(record.failed_at)}</div>
          </div>
        ),
      },
      {
        title: 'Failed Step',
        dataIndex: 'failed_step_label',
        key: 'failed_step_label',
        render: (val: string, record: InterventionTrade) => (
          <div>
            <span>{val}</span>
            <div className="text-xs text-gray-500">
              After: {record.last_successful_step}
            </div>
          </div>
        ),
      },
      {
        title: 'Reason',
        key: 'reason',
        render: (_: unknown, record: InterventionTrade) => (
          <div>
            <Tag color={categoryColor(record.failure_category)}>
              {record.failure_category}
            </Tag>
            <Tooltip title={record.failure_reason}>
              <span className="text-xs text-gray-600 block truncate max-w-[200px]">
                {record.failure_reason}
              </span>
            </Tooltip>
          </div>
        ),
      },
      {
        title: 'Customer / Supplier',
        key: 'parties',
        render: (_: unknown, record: InterventionTrade) => (
          <div className="text-sm">
            <div>{record.customer_name}</div>
            <div className="text-gray-400">{record.supplier_name}</div>
          </div>
        ),
      },
      {
        title: 'Amount',
        dataIndex: 'order_amount',
        key: 'order_amount',
        sorter: (a: InterventionTrade, b: InterventionTrade) =>
          a.order_amount - b.order_amount,
        render: (val: number) => formatCurrency(val),
      },
      {
        title: 'Retries',
        key: 'retries',
        render: (_: unknown, record: InterventionTrade) => (
          <span
            className={
              record.retry_count >= record.max_retries ? 'text-red-500' : ''
            }
          >
            {record.retry_count}/{record.max_retries}
          </span>
        ),
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (_: unknown, record: InterventionTrade) => (
          <Space size="small">
            <Tooltip title="Retry this step">
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => handleRecovery(record.id, 'retry')}
                disabled={record.retry_count >= record.max_retries}
              />
            </Tooltip>
            <Tooltip title="Requeue for processing">
              <Button
                size="small"
                icon={<RightCircleOutlined />}
                onClick={() => handleRecovery(record.id, 'requeue')}
              />
            </Tooltip>
            <Tooltip title="Escalate to manager">
              <Button
                size="small"
                icon={<UserOutlined />}
                onClick={() => handleRecovery(record.id, 'escalate')}
              />
            </Tooltip>
            <Tooltip title="Skip step and continue">
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
                onClick={() => handleRecovery(record.id, 'skip')}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [handleRecovery],
  );

  // Summary stats
  const stats = useMemo(() => {
    if (!trades) return { total: 0, timeout: 0, validation: 0, maxRetries: 0 };
    return {
      total: trades.length,
      timeout: trades.filter((t) => t.failure_category === 'timeout').length,
      validation: trades.filter((t) => t.failure_category === 'validation').length,
      maxRetries: trades.filter((t) => t.retry_count >= t.max_retries).length,
    };
  }, [trades]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spin size="large" tip="Loading intervention queue..." />
      </div>
    );
  }

  if (!trades || trades.length === 0) {
    return (
      <div className="py-12">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span className="text-green-600 font-medium">
              All trades are running smoothly — no intervention needed
            </span>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Alert */}
      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        message={
          <span className="font-medium">
            {stats.total} trade{stats.total !== 1 ? 's' : ''} requiring intervention
          </span>
        }
        description={
          <Space split="•" className="text-sm">
            {stats.timeout > 0 && <span>{stats.timeout} timeouts</span>}
            {stats.validation > 0 && <span>{stats.validation} validation errors</span>}
            {stats.maxRetries > 0 && (
              <span className="text-red-500">
                {stats.maxRetries} exceeded max retries
              </span>
            )}
          </Space>
        }
      />

      {/* Main Table */}
      <Card
        title={
          <span>
            <ExclamationCircleOutlined className="mr-2 text-orange-500" />
            Intervention Queue
          </span>
        }
        size="small"
        className="shadow-sm"
        extra={
          <Badge
            count={stats.total}
            overflowCount={99}
            style={{ backgroundColor: 'rgb(var(--color-warning))' }}
          />
        }
      >
        <Table
          dataSource={trades}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 15, showSizeChanger: true }}
          scroll={{ x: 1000 }}
          expandable={{
            expandedRowRender: (record) => (
              <Descriptions size="small" column={3} bordered>
                <Descriptions.Item label="Process Run">
                  {record.process_run_id}
                </Descriptions.Item>
                <Descriptions.Item label="Source">
                  {record.lineage.source_type}: {record.lineage.source_ref}
                </Descriptions.Item>
                <Descriptions.Item label="Inquiry">
                  {record.lineage.inquiry_ref ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Sales Order">
                  {record.lineage.so_ref ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Purchase Order">
                  {record.lineage.po_ref ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Assigned To">
                  {record.assigned_to ?? 'Unassigned'}
                </Descriptions.Item>
              </Descriptions>
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default TradesInterventionDashboard;
