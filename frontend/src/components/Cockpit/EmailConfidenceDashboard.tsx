/**
 * EmailConfidenceDashboard — Email classification confidence scoring widget.
 *
 * Shows auto-approve vs manual-review rates, confidence distribution histogram,
 * category breakdown, and average confidence for the current tenant.
 * Embedded in the Cockpit workspace to help operators tune classification thresholds.
 */

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  DashboardOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  RobotOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';

const { Text, Title } = Typography;

// ─── Types ───────────────────────────────────────────────────────────
interface ConfidenceBucket {
  range: string;
  count: number;
}

interface EmailStatsResponse {
  total_emails: number;
  email_status_counts: Record<string, number>;
  total_drafts: number;
  category_counts: Record<string, number>;
  draft_status_counts: Record<string, number>;
  auto_approved: number;
  manual_reviewed: number;
  dismissed: number;
  pending_review: number;
  avg_confidence: number;
  high_confidence_rate: number;
  confidence_histogram: ConfidenceBucket[];
}

// ─── Helpers ─────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  purchase_order: 'Purchase Order',
  bill_of_lading: 'Bill of Lading',
  new_customer: 'New Customer',
  invoice: 'Invoice',
  pricing_sheet: 'Pricing Sheet',
  contact: 'Contact Update',
  company: 'Company Update',
  payment: 'Payment Notice',
  supplier_note: 'Supplier Note',
};

const CATEGORY_COLORS: Record<string, string> = {
  purchase_order: 'blue',
  bill_of_lading: 'cyan',
  new_customer: 'green',
  invoice: 'orange',
  pricing_sheet: 'purple',
  contact: 'geekblue',
  company: 'magenta',
  payment: 'gold',
  supplier_note: 'lime',
};

const fetchEmailStats = async (): Promise<EmailStatsResponse> => {
  const response = await businessApi.get<EmailStatsResponse>('/integrations/email/stats/');
  return response.data;
};

/** Pure CSS bar — avoids importing recharts or any chart library. */
const ConfidenceBar: React.FC<{ buckets: ConfidenceBucket[]; max: number }> = ({
  buckets,
  max,
}) => {
  if (max === 0) return <Text type="secondary">No data</Text>;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${buckets.length}, 1fr)`,
        gap: 2,
        alignItems: 'end',
        height: 80,
      }}
    >
      {buckets.map((b) => {
        const pct = max > 0 ? (b.count / max) * 100 : 0;
        return (
          <Tooltip key={b.range} title={`${b.range}: ${b.count} drafts`}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: '100%',
                  minHeight: 4,
                  height: `${Math.max(pct, 4)}%`,
                  background: `rgb(var(--color-primary))`,
                  borderRadius: 2,
                  opacity: pct > 0 ? 1 : 0.15,
                  transition: 'height 0.3s ease',
                }}
              />
              <Text
                type="secondary"
                style={{ fontSize: 9, marginTop: 2, whiteSpace: 'nowrap' }}
              >
                {b.range.split('-')[0]}
              </Text>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
};

// ─── Component ───────────────────────────────────────────────────────
export const EmailConfidenceDashboard: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: withTenantQueryKey('email-confidence-stats'),
    queryFn: fetchEmailStats,
    staleTime: 30_000,
  });

  const categoryRows = useMemo(() => {
    if (!data?.category_counts) return [];
    return Object.entries(data.category_counts)
      .map(([key, count]) => ({
        key,
        category: CATEGORY_LABELS[key] ?? key,
        color: CATEGORY_COLORS[key] ?? 'default',
        count: count as number,
      }))
      .sort((a, b) => b.count - a.count);
  }, [data?.category_counts]);

  const histogramMax = useMemo(() => {
    if (!data?.confidence_histogram) return 0;
    return Math.max(...data.confidence_histogram.map((b) => b.count), 1);
  }, [data?.confidence_histogram]);

  if (isLoading) {
    return (
      <Card size="small" title="Email Classification Analytics">
        <div style={{ padding: 32, textAlign: 'center' }}>
          <Spin />
        </div>
      </Card>
    );
  }

  if (!data || data.total_drafts === 0) {
    return (
      <Card
        size="small"
        title={
          <Space>
            <DashboardOutlined />
            Email Classification Analytics
          </Space>
        }
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No email classification data yet. Sync emails to start seeing analytics."
        />
      </Card>
    );
  }

  const autoRate =
    data.total_drafts > 0
      ? Math.round(((data.auto_approved) / data.total_drafts) * 100)
      : 0;

  return (
    <Card
      size="small"
      title={
        <Space>
          <DashboardOutlined />
          Email Classification Analytics
        </Space>
      }
    >
      <div style={{ display: 'grid', gap: 16 }}>
        {/* Row 1: Key metrics */}
        <Row gutter={[16, 12]}>
          <Col xs={12} sm={6}>
            <Statistic
              title="Total Classified"
              value={data.total_drafts}
              prefix={<ThunderboltOutlined />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="Auto-Approved"
              value={data.auto_approved}
              prefix={<RobotOutlined />}
              valueStyle={{ color: 'rgb(var(--color-success))' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="Manual Review"
              value={data.manual_reviewed}
              prefix={<EyeOutlined />}
              valueStyle={{ color: 'rgb(var(--color-warning))' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="Pending"
              value={data.pending_review}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={
                data.pending_review > 0
                  ? { color: 'rgb(var(--color-error))' }
                  : undefined
              }
            />
          </Col>
        </Row>

        {/* Row 2: Auto-approve rate + avg confidence */}
        <Row gutter={[16, 12]}>
          <Col xs={24} sm={12}>
            <Card size="small" bordered={false} style={{ background: 'rgb(var(--color-bg-secondary))' }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                Auto-Approve Rate (≥ 98% confidence)
              </Text>
              <Progress
                percent={autoRate}
                status={autoRate >= 50 ? 'success' : 'normal'}
                strokeColor="rgb(var(--color-success))"
                trailColor="rgba(var(--color-border), 0.3)"
                format={(pct) => `${pct}%`}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card size="small" bordered={false} style={{ background: 'rgb(var(--color-bg-secondary))' }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                Average Confidence Score
              </Text>
              <Space>
                <Progress
                  type="circle"
                  percent={Math.round(data.avg_confidence * 100)}
                  size={48}
                  strokeColor={
                    data.avg_confidence >= 0.9
                      ? 'rgb(var(--color-success))'
                      : data.avg_confidence >= 0.7
                        ? 'rgb(var(--color-warning))'
                        : 'rgb(var(--color-error))'
                  }
                />
                <div>
                  <Text strong style={{ fontSize: 18 }}>
                    {(data.avg_confidence * 100).toFixed(1)}%
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <CheckCircleOutlined /> {(data.high_confidence_rate * 100).toFixed(0)}% high-confidence (≥ 90%)
                  </Text>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* Row 3: Confidence histogram + Category breakdown */}
        <Row gutter={[16, 12]}>
          <Col xs={24} sm={12}>
            <Card size="small" bordered={false} style={{ background: 'rgb(var(--color-bg-secondary))' }}>
              <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                Confidence Distribution
              </Title>
              <ConfidenceBar buckets={data.confidence_histogram} max={histogramMax} />
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card size="small" bordered={false} style={{ background: 'rgb(var(--color-bg-secondary))' }}>
              <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                Classification Categories
              </Title>
              <Table
                aria-label="Email confidence scores"
                dataSource={categoryRows}
                pagination={false}
                size="small"
                showHeader={false}
                columns={[
                  {
                    dataIndex: 'category',
                    render: (val: string, row: { color: string }) => (
                      <Tag color={row.color}>{val}</Tag>
                    ),
                  },
                  {
                    dataIndex: 'count',
                    align: 'right' as const,
                    render: (val: number) => <Text strong>{val}</Text>,
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </div>
    </Card>
  );
};

export default EmailConfidenceDashboard;
