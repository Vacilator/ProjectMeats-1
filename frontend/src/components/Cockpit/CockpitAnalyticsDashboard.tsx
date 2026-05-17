/**
 * CockpitAnalyticsDashboard - Trading Performance Analytics
 *
 * Charts and metrics for the Cockpit workspace:
 * - Win rate by supplier (horizontal bar)
 * - Average margin trend (line sparkline)
 * - Process cycle time stats
 * - Top contacts activity table
 * - Export to CSV
 */

import React, { useMemo, useCallback, useState } from 'react';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  Statistic,
  Table,
  Tag,
  Select,
  Button,
  Empty,
  Spin,
  Progress,
  Space,
  Tooltip,
} from 'antd';
import {
  TrophyOutlined,
  LineChartOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface SupplierWinRate {
  supplier_id: string;
  supplier_name: string;
  bids_submitted: number;
  bids_won: number;
  win_rate: number;
}

interface MarginDataPoint {
  period: string;
  average_margin: number;
  trade_count: number;
  total_revenue: number;
}

interface CycleTimeStats {
  average_days: number;
  median_days: number;
  min_days: number;
  max_days: number;
  total_completed: number;
}

interface ContactActivity {
  contact_id: string;
  contact_name: string;
  contact_type: string;
  department: string;
  interactions: number;
  last_activity: string;
}

interface AnalyticsDashboardData {
  supplier_win_rates: SupplierWinRate[];
  margin_trend: MarginDataPoint[];
  cycle_time: CycleTimeStats;
  top_contacts: ContactActivity[];
  summary: {
    total_trades: number;
    average_margin: number;
    avg_cycle_days: number;
    total_suppliers: number;
    top_win_rate: number;
    total_interactions: number;
  };
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function exportToCsv(data: AnalyticsDashboardData): void {
  const rows: string[] = ['Category,Metric,Value'];

  // Summary
  rows.push(`Summary,Total Trades,${data.summary.total_trades}`);
  rows.push(`Summary,Average Margin,${data.summary.average_margin}%`);
  rows.push(`Summary,Avg Cycle Days,${data.summary.avg_cycle_days}`);

  // Win rates
  for (const s of data.supplier_win_rates) {
    rows.push(
      `Win Rate,${s.supplier_name},${s.win_rate}% (${s.bids_won}/${s.bids_submitted})`,
    );
  }

  // Margin trend
  for (const m of data.margin_trend) {
    rows.push(
      `Margin Trend,${m.period},${m.average_margin}% (${m.trade_count} trades)`,
    );
  }

  // Contacts
  for (const c of data.top_contacts) {
    rows.push(`Top Contacts,${c.contact_name},${c.interactions} interactions`);
  }

  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trading-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export function CockpitAnalyticsDashboard(): React.ReactElement {
  const [dateRange, setDateRange] = useState<string>('30');

  const { data, isLoading, isError, refetch } = useQuery<AnalyticsDashboardData>({
    queryKey: withTenantQueryKey('cockpit', 'analytics', dateRange),
    queryFn: async () => {
      const res = await businessApi.get('/workflows/analytics/dashboard/', {
        params: { days: dateRange },
      });
      return res.data;
    },
    refetchInterval: 120_000,
    retry: false,
  });

  const handleExport = useCallback(() => {
    if (data) exportToCsv(data);
  }, [data]);

  const winRateColumns = useMemo(
    () => [
      {
        title: 'Supplier',
        dataIndex: 'supplier_name',
        key: 'supplier_name',
        render: (val: string) => <span className="font-medium">{val}</span>,
      },
      {
        title: 'Win Rate',
        dataIndex: 'win_rate',
        key: 'win_rate',
        sorter: (a: SupplierWinRate, b: SupplierWinRate) => a.win_rate - b.win_rate,
        render: (val: number) => (
          <Progress
            percent={val}
            size="small"
            status={val >= 50 ? 'success' : val >= 25 ? 'normal' : 'exception'}
            format={() => `${val.toFixed(0)}%`}
          />
        ),
      },
      {
        title: 'Bids',
        key: 'bids',
        render: (_: unknown, record: SupplierWinRate) => (
          <span>
            {record.bids_won}/{record.bids_submitted}
          </span>
        ),
      },
    ],
    [],
  );

  const contactColumns = useMemo(
    () => [
      {
        title: 'Contact',
        dataIndex: 'contact_name',
        key: 'contact_name',
        render: (val: string) => <span className="font-medium">{val}</span>,
      },
      {
        title: 'Type',
        dataIndex: 'contact_type',
        key: 'contact_type',
        render: (val: string) => <Tag>{val}</Tag>,
      },
      {
        title: 'Interactions',
        dataIndex: 'interactions',
        key: 'interactions',
        sorter: (a: ContactActivity, b: ContactActivity) =>
          a.interactions - b.interactions,
      },
      {
        title: 'Last Active',
        dataIndex: 'last_activity',
        key: 'last_activity',
        render: (val: string) => (val ? dayjs(val).format('MMM D, YYYY') : '—'),
      },
    ],
    [],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spin size="large" tip="Loading analytics..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <ExclamationCircleOutlined style={{ fontSize: 36, color: 'rgb(var(--color-error))', marginBottom: 12 }} />
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'rgb(var(--color-text-primary))' }}>
          Failed to load analytics
        </div>
        <div style={{ fontSize: 14, color: 'rgb(var(--color-text-secondary))', marginBottom: 16 }}>
          Something went wrong while fetching dashboard data. Please try again.
        </div>
        <Button type="primary" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) {
    return <Empty description="No analytics data available" className="py-12" />;
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <Space>
          <FilterOutlined />
          <Select
            value={dateRange}
            onChange={setDateRange}
            style={{ width: 140 }}
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
              { value: '180', label: 'Last 6 months' },
              { value: '365', label: 'Last year' },
            ]}
          />
        </Space>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card size="small" className="shadow-sm">
          <Statistic
            title="Total Trades"
            value={data.summary.total_trades}
            prefix={<LineChartOutlined />}
          />
        </Card>
        <Card size="small" className="shadow-sm">
          <Statistic
            title="Avg Margin"
            value={data.summary.average_margin}
            precision={1}
            suffix="%"
            valueStyle={{
              color: data.summary.average_margin >= 5 ? 'rgb(var(--color-success))' : 'rgb(var(--color-error))',
            }}
          />
        </Card>
        <Card size="small" className="shadow-sm">
          <Statistic
            title="Avg Cycle Time"
            value={data.summary.avg_cycle_days}
            precision={1}
            suffix=" days"
            prefix={<ClockCircleOutlined />}
          />
        </Card>
        <Card size="small" className="shadow-sm">
          <Statistic
            title="Top Win Rate"
            value={data.summary.top_win_rate}
            precision={0}
            suffix="%"
            prefix={<TrophyOutlined />}
            valueStyle={{ color: 'rgb(var(--color-warning))' }}
          />
        </Card>
      </div>

      {/* Margin Trend (simple text table since we don't add chart libs) */}
      {data.margin_trend.length > 0 && (
        <Card
          title="Margin Trend"
          size="small"
          className="shadow-sm"
          extra={<Tag color="blue">{data.margin_trend.length} periods</Tag>}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {data.margin_trend.map((dp) => (
              <Tooltip
                key={dp.period}
                title={`${dp.trade_count} trades • ${formatCurrency(dp.total_revenue)} revenue`}
              >
                <div className="text-center p-2 rounded" style={{ border: '1px solid rgb(var(--color-border))' }}>
                  <div className="text-xs" style={{ color: 'rgb(var(--color-text-tertiary))' }}>{dp.period}</div>
                  <div
                    className="text-lg font-semibold"
                    style={{
                      color: dp.average_margin >= 5 ? 'rgb(var(--color-success))' : 'rgb(var(--color-error))',
                    }}
                  >
                    {dp.average_margin.toFixed(1)}%
                  </div>
                  <div className="text-xs" style={{ color: 'rgb(var(--color-text-quaternary))' }}>
                    {dp.trade_count} trade{dp.trade_count !== 1 ? 's' : ''}
                  </div>
                </div>
              </Tooltip>
            ))}
          </div>
        </Card>
      )}

      {/* Two-column: Win Rates + Cycle Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          title={
            <span>
              <TrophyOutlined className="mr-2" />
              Supplier Win Rates
            </span>
          }
          size="small"
          className="shadow-sm"
        >
          <Table
            aria-label="Supplier win rates"
            dataSource={data.supplier_win_rates}
            columns={winRateColumns}
            rowKey="supplier_id"
            size="small"
            pagination={false}
          />
        </Card>

        <Card
          title={
            <span>
              <ClockCircleOutlined className="mr-2" />
              Cycle Time Stats
            </span>
          }
          size="small"
          className="shadow-sm"
        >
          <div className="space-y-4 py-2">
            <Statistic
              title="Average"
              value={data.cycle_time.average_days}
              suffix=" days"
              precision={1}
            />
            <Statistic
              title="Median"
              value={data.cycle_time.median_days}
              suffix=" days"
              precision={1}
            />
            <div className="flex justify-between text-sm" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
              <span>Min: {data.cycle_time.min_days} days</span>
              <span>Max: {data.cycle_time.max_days} days</span>
            </div>
            <div className="text-sm" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
              {data.cycle_time.total_completed} processes completed
            </div>
          </div>
        </Card>
      </div>

      {/* Top Contacts */}
      <Card
        title={
          <span>
            <TeamOutlined className="mr-2" />
            Top Contacts
          </span>
        }
        size="small"
        className="shadow-sm"
      >
        <Table
          aria-label="Top contacts"
          dataSource={data.top_contacts}
          columns={contactColumns}
          rowKey="contact_id"
          size="small"
          pagination={{ pageSize: 5 }}
        />
      </Card>
    </div>
  );
}

export default CockpitAnalyticsDashboard;
