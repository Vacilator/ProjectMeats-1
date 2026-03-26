import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import dayjs from 'dayjs';
import { Alert, Button, DatePicker, Segmented, Spin, Tabs } from 'antd';
import type { TabsProps } from 'antd';

import PurchaseOrderTrends from '../components/Visualization/PurchaseOrderTrends';
import SupplierPerformanceChart from '../components/Visualization/SupplierPerformanceChart';
import {
  reportsService,
  type PurchaseOrderTrendPoint,
  type ReportsSummaryResponse,
  type SupplierPerformancePoint,
} from '../services/reportsService';

const { RangePicker } = DatePicker;

type RangePreset = '30d' | '90d' | 'ytd' | 'custom';

const Reports: React.FC = () => {
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [customRange, setCustomRange] = useState<[string, string] | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<ReportsSummaryResponse | null>(null);
  const [poTrends, setPoTrends] = useState<PurchaseOrderTrendPoint[]>([]);
  const [topSuppliers, setTopSuppliers] = useState<SupplierPerformancePoint[]>([]);

  const range = useMemo(() => {
    const today = dayjs();

    if (preset === 'custom' && customRange) {
      return { start: customRange[0], end: customRange[1] };
    }

    if (preset === '90d') {
      return {
        start: today.subtract(90, 'day').format('YYYY-MM-DD'),
        end: today.format('YYYY-MM-DD'),
      };
    }

    if (preset === 'ytd') {
      return {
        start: today.startOf('year').format('YYYY-MM-DD'),
        end: today.format('YYYY-MM-DD'),
      };
    }

    // default: 30d
    return {
      start: today.subtract(30, 'day').format('YYYY-MM-DD'),
      end: today.format('YYYY-MM-DD'),
    };
  }, [customRange, preset]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = { start: range.start, end: range.end };

    try {
      const [s, t, ts] = await Promise.all([
        reportsService.getSummary(params),
        reportsService.getPurchaseOrderTrends(params),
        reportsService.getTopSuppliers(params, 10),
      ]);

      setSummary(s);
      setPoTrends(t.data || []);
      setTopSuppliers(ts.data || []);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || err?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [range.end, range.start]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = summary?.summary;

  const items: TabsProps['items'] = [
    {
      key: 'overview',
      label: 'Overview',
      children: (
        <>
          <KpiGrid>
            <KpiCard>
              <KpiLabel>Purchase Orders</KpiLabel>
              <KpiValue>{kpis?.purchase_orders.count ?? 0}</KpiValue>
              <KpiSub>${(kpis?.purchase_orders.total_amount ?? 0).toLocaleString()}</KpiSub>
            </KpiCard>
            <KpiCard>
              <KpiLabel>Sales Orders</KpiLabel>
              <KpiValue>{kpis?.sales_orders.count ?? 0}</KpiValue>
              <KpiSub>${(kpis?.sales_orders.total_amount ?? 0).toLocaleString()}</KpiSub>
            </KpiCard>
            <KpiCard>
              <KpiLabel>Inquiries (Win Rate)</KpiLabel>
              <KpiValue>{kpis ? `${kpis.inquiries.win_rate}%` : '0%'}</KpiValue>
              <KpiSub>
                Won {kpis?.inquiries.won ?? 0} / Lost {kpis?.inquiries.lost ?? 0}
              </KpiSub>
            </KpiCard>
            <KpiCard>
              <KpiLabel>Calls</KpiLabel>
              <KpiValue>{kpis?.calls.completed ?? 0}</KpiValue>
              <KpiSub>
                Completed · Upcoming {kpis?.calls.upcoming ?? 0} · Overdue {kpis?.calls.overdue ?? 0}
              </KpiSub>
            </KpiCard>
            <KpiCard>
              <KpiLabel>WorkForms (Completion)</KpiLabel>
              <KpiValue>{kpis ? `${kpis.workforms.completion_rate}%` : '0%'}</KpiValue>
              <KpiSub>
                {kpis?.workforms.completed ?? 0} completed · {kpis?.workforms.in_progress ?? 0} in progress
              </KpiSub>
            </KpiCard>
            <KpiCard>
              <KpiLabel>Master Data</KpiLabel>
              <KpiValue>{(kpis?.master_data.customers ?? 0) + (kpis?.master_data.suppliers ?? 0)}</KpiValue>
              <KpiSub>
                {kpis?.master_data.customers ?? 0} customers · {kpis?.master_data.suppliers ?? 0} suppliers
              </KpiSub>
            </KpiCard>
          </KpiGrid>

          <Section>
            <SectionHeader>
              <SectionTitle>Purchase Order Trends</SectionTitle>
              <Button
                onClick={() => reportsService.downloadCsv('purchase-order-trends.csv', poTrends)}
                disabled={!poTrends.length}
              >
                Export CSV
              </Button>
            </SectionHeader>
            <PurchaseOrderTrends data={poTrends} height={320} />
          </Section>

          <Section>
            <SectionHeader>
              <SectionTitle>Top Suppliers (by PO value)</SectionTitle>
              <Button
                onClick={() => reportsService.downloadCsv('top-suppliers.csv', topSuppliers)}
                disabled={!topSuppliers.length}
              >
                Export CSV
              </Button>
            </SectionHeader>
            <SupplierPerformanceChart data={topSuppliers} height={320} />
          </Section>
        </>
      ),
    },
  ];

  return (
    <Container>
      <Header>
        <HeaderLeft>
          <Title>Reports</Title>
          <Subtitle>
            Business performance snapshots ({range.start} → {range.end})
          </Subtitle>
        </HeaderLeft>

        <HeaderRight>
          <Segmented
            value={preset}
            onChange={(v) => setPreset(v as RangePreset)}
            options={[
              { label: '30D', value: '30d' },
              { label: '90D', value: '90d' },
              { label: 'YTD', value: 'ytd' },
              { label: 'Custom', value: 'custom' },
            ]}
          />
          {preset === 'custom' && (
            <RangePicker
              allowClear={false}
              value={customRange ? [dayjs(customRange[0]), dayjs(customRange[1])] : null}
              onChange={(vals) => {
                if (!vals || vals.length !== 2 || !vals[0] || !vals[1]) return;
                setCustomRange([vals[0].format('YYYY-MM-DD'), vals[1].format('YYYY-MM-DD')]);
              }}
            />
          )}
          <Button onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </HeaderRight>
      </Header>

      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} />}

      {loading ? (
        <LoadingBlock>
          <Spin />
          <span>Loading reports…</span>
        </LoadingBlock>
      ) : (
        <Tabs defaultActiveKey="overview" items={items} />
      )}
    </Container>
  );
};

const Container = styled.div`
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const HeaderLeft = styled.div``;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 1.75rem;
  font-weight: 800;
  color: rgb(var(--color-text-primary));
`;

const Subtitle = styled.div`
  margin-top: 0.25rem;
  font-size: 0.9rem;
  color: rgb(var(--color-text-secondary));
`;

const LoadingBlock = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  justify-content: center;
  color: rgb(var(--color-text-secondary));
`;

const KpiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(6, 1fr);
  }
  @media (max-width: 650px) {
    grid-template-columns: repeat(1, 1fr);
  }
`;

const KpiCard = styled.div`
  grid-column: span 4;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 1rem;

  @media (max-width: 1100px) {
    grid-column: span 3;
  }
  @media (max-width: 650px) {
    grid-column: span 1;
  }
`;

const KpiLabel = styled.div`
  font-size: 0.8rem;
  font-weight: 700;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const KpiValue = styled.div`
  margin-top: 0.25rem;
  font-size: 1.6rem;
  font-weight: 900;
  color: rgb(var(--color-text-primary));
`;

const KpiSub = styled.div`
  margin-top: 0.25rem;
  font-size: 0.85rem;
  color: rgb(var(--color-text-secondary));
`;

const Section = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 1rem;
  margin-bottom: 1rem;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  color: rgb(var(--color-text-primary));
`;

export default Reports;
