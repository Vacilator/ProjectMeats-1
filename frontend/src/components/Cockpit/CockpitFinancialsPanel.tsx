/**
 * CockpitFinancialsPanel - Financial snapshot for the Cockpit workspace
 *
 * Displays live-calculated financial metrics for active trades:
 * - Margin %, Outstanding Amount, Credit Risk, Supplier Risk
 * - Per-trade breakdown with status indicators
 * - Aggregated portfolio view
 */

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Progress, Statistic, Tag, Table, Tooltip, Empty, Spin } from 'antd';
import {
  DollarOutlined,
  PercentageOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface TradeFinancials {
  trade_id: string;
  trade_ref: string;
  customer_name: string;
  supplier_name: string;
  sell_price: number;
  buy_price: number;
  margin_percent: number;
  so_outstanding: number;
  po_outstanding: number;
  net_exposure: number;
  payment_status: string;
  credit_risk: 'low' | 'medium' | 'high';
  supplier_risk: 'low' | 'medium' | 'high';
}

interface PortfolioSummary {
  total_trades: number;
  total_revenue: number;
  total_cost: number;
  average_margin: number;
  total_outstanding: number;
  trades_at_risk: number;
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function riskTag(level: string): React.ReactNode {
  const color = level === 'high' ? 'red' : level === 'medium' ? 'orange' : 'green';
  return <Tag color={color}>{level.toUpperCase()}</Tag>;
}

function paymentTag(status: string): React.ReactNode {
  const map: Record<string, { color: string; label: string }> = {
    paid: { color: 'green', label: 'Paid' },
    partial: { color: 'orange', label: 'Partial' },
    unpaid: { color: 'red', label: 'Unpaid' },
    overdue: { color: 'volcano', label: 'Overdue' },
  };
  const entry = map[status] || { color: 'default', label: status };
  return <Tag color={entry.color}>{entry.label}</Tag>;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export function CockpitFinancialsPanel(): React.ReactElement {
  const { data: trades, isLoading: tradesLoading } = useQuery<TradeFinancials[]>({
    queryKey: withTenantQueryKey('cockpit', 'financials', 'trades'),
    queryFn: async () => {
      const res = await businessApi.get('/workflows/financials/trades/');
      return res.data ?? [];
    },
    refetchInterval: 60_000,
  });

  const summary = useMemo<PortfolioSummary>(() => {
    if (!trades || trades.length === 0) {
      return {
        total_trades: 0,
        total_revenue: 0,
        total_cost: 0,
        average_margin: 0,
        total_outstanding: 0,
        trades_at_risk: 0,
      };
    }
    const total_revenue = trades.reduce((s, t) => s + t.sell_price, 0);
    const total_cost = trades.reduce((s, t) => s + t.buy_price, 0);
    const average_margin =
      total_revenue > 0 ? ((total_revenue - total_cost) / total_revenue) * 100 : 0;
    const total_outstanding = trades.reduce((s, t) => s + t.so_outstanding, 0);
    const trades_at_risk = trades.filter(
      (t) => t.credit_risk === 'high' || t.supplier_risk === 'high',
    ).length;

    return {
      total_trades: trades.length,
      total_revenue,
      total_cost,
      average_margin,
      total_outstanding,
      trades_at_risk,
    };
  }, [trades]);

  const columns = useMemo(
    () => [
      {
        title: 'Trade',
        dataIndex: 'trade_ref',
        key: 'trade_ref',
        render: (val: string) => <span className="font-medium">{val}</span>,
      },
      {
        title: 'Customer',
        dataIndex: 'customer_name',
        key: 'customer_name',
        ellipsis: true,
      },
      {
        title: 'Margin',
        dataIndex: 'margin_percent',
        key: 'margin_percent',
        sorter: (a: TradeFinancials, b: TradeFinancials) =>
          a.margin_percent - b.margin_percent,
        render: (val: number) => (
          <Tooltip title={`${val.toFixed(2)}%`}>
            <Progress
              percent={Math.min(Math.abs(val), 100)}
              size="small"
              status={val < 0 ? 'exception' : val < 5 ? 'normal' : 'success'}
              format={() => `${val.toFixed(1)}%`}
            />
          </Tooltip>
        ),
      },
      {
        title: 'Outstanding',
        dataIndex: 'so_outstanding',
        key: 'so_outstanding',
        sorter: (a: TradeFinancials, b: TradeFinancials) =>
          a.so_outstanding - b.so_outstanding,
        render: (val: number) => formatCurrency(val),
      },
      {
        title: 'Net Exposure',
        dataIndex: 'net_exposure',
        key: 'net_exposure',
        render: (val: number) => (
          <span style={{ color: val > 0 ? 'rgb(var(--color-error))' : 'rgb(var(--color-success))' }}>
            {formatCurrency(val)}
          </span>
        ),
      },
      {
        title: 'Payment',
        dataIndex: 'payment_status',
        key: 'payment_status',
        render: (val: string) => paymentTag(val),
      },
      {
        title: 'Credit Risk',
        dataIndex: 'credit_risk',
        key: 'credit_risk',
        render: (val: string) => riskTag(val),
      },
      {
        title: 'Supplier Risk',
        dataIndex: 'supplier_risk',
        key: 'supplier_risk',
        render: (val: string) => riskTag(val),
      },
    ],
    [],
  );

  if (tradesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spin size="large" tip="Loading financials..." />
      </div>
    );
  }

  if (!trades || trades.length === 0) {
    return (
      <Empty
        description="No active trades with financial data"
        className="py-12"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card size="small" className="shadow-sm">
          <Statistic
            title="Portfolio Revenue"
            value={summary.total_revenue}
            prefix={<DollarOutlined />}
            formatter={(val) => formatCurrency(val as number)}
          />
        </Card>
        <Card size="small" className="shadow-sm">
          <Statistic
            title="Average Margin"
            value={summary.average_margin}
            precision={1}
            prefix={<PercentageOutlined />}
            suffix="%"
            valueStyle={{
              color: summary.average_margin >= 5 ? 'rgb(var(--color-success))' : 'rgb(var(--color-error))',
            }}
          />
        </Card>
        <Card size="small" className="shadow-sm">
          <Statistic
            title="Total Outstanding"
            value={summary.total_outstanding}
            prefix={<DollarOutlined />}
            formatter={(val) => formatCurrency(val as number)}
          />
        </Card>
        <Card size="small" className="shadow-sm">
          <Statistic
            title="Trades at Risk"
            value={summary.trades_at_risk}
            prefix={
              summary.trades_at_risk > 0 ? (
                <WarningOutlined style={{ color: 'rgb(var(--color-error))' }} />
              ) : (
                <CheckCircleOutlined style={{ color: 'rgb(var(--color-success))' }} />
              )
            }
            valueStyle={{
              color: summary.trades_at_risk > 0 ? 'rgb(var(--color-error))' : 'rgb(var(--color-success))',
            }}
          />
        </Card>
      </div>

      {/* Trade Table */}
      <Card
        title="Active Trade Financials"
        size="small"
        className="shadow-sm"
        extra={
          <Tag color="blue">{summary.total_trades} trades</Tag>
        }
      >
        <Table
          aria-label="Financial trades"
          dataSource={trades}
          columns={columns}
          rowKey="trade_id"
          size="small"
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 900 }}
        />
      </Card>
    </div>
  );
}

export default CockpitFinancialsPanel;
