/**
 * OperationsPanel — Embedded contextual operations summary for the Trader Cockpit.
 *
 * Renders inline summaries of Cold Storage, Logistics, and Carriers
 * as a compact, glanceable panel within the command center.
 * Each section is a collapsible mini-card. Full pages remain available
 * via sidebar nav for deep-dive.
 *
 * Additive only — does not replace existing pages.
 */
import React from 'react';
import { Badge, Button, Collapse, Skeleton, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Package, Truck, Snowflake, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';

const { Text } = Typography;

const PanelWrapper = styled.div`
  margin-bottom: 1rem;
`;

const MiniStat = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
`;

const MiniStatValue = styled.span`
  font-weight: 700;
  font-size: 1rem;
  color: rgb(var(--color-text-primary, 17 24 39));
`;

const MiniStatLabel = styled.span`
  font-size: 0.75rem;
  color: rgb(var(--color-text-tertiary, 107 114 128));
`;

const SectionRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const OperationsPanel: React.FC = () => {
  const navigate = useNavigate();

  const coldStorageQuery = useQuery({
    queryKey: withTenantQueryKey('ops-cold-storage-summary'),
    queryFn: async () => {
      try {
        const res = await businessApi.get('/cold-storage/lots/');
        const data = res.data;
        const lots = Array.isArray(data)
          ? data
          : Array.isArray((data as { results?: unknown[] })?.results)
            ? (data as { results: unknown[] }).results
            : [];
        return { count: lots.length };
      } catch {
        return { count: 0 };
      }
    },
    staleTime: 60_000,
  });

  const freightQuery = useQuery({
    queryKey: withTenantQueryKey('ops-freight-summary'),
    queryFn: async () => {
      try {
        const res = await businessApi.get('/carrier-pos/');
        const data = res.data;
        const orders = Array.isArray(data)
          ? data
          : Array.isArray((data as { results?: unknown[] })?.results)
            ? (data as { results: unknown[] }).results
            : [];
        const active = orders.filter(
          (o: Record<string, unknown>) => o.status && o.status !== 'completed' && o.status !== 'cancelled'
        );
        return { total: orders.length, active: active.length };
      } catch {
        return { total: 0, active: 0 };
      }
    },
    staleTime: 60_000,
  });

  const carriersQuery = useQuery({
    queryKey: withTenantQueryKey('ops-carriers-summary'),
    queryFn: async () => {
      try {
        const res = await businessApi.get('/carriers/');
        const data = res.data;
        const carriers = Array.isArray(data)
          ? data
          : Array.isArray((data as { results?: unknown[] })?.results)
            ? (data as { results: unknown[] }).results
            : [];
        return { count: carriers.length };
      } catch {
        return { count: 0 };
      }
    },
    staleTime: 120_000,
  });

  const items = [
    {
      key: 'cold-storage',
      label: (
        <SectionRow>
          <Space size={6}>
            <Snowflake size={14} />
            <Text strong style={{ fontSize: '0.8rem' }}>Cold Storage</Text>
            <Badge count={coldStorageQuery.data?.count || 0} size="small" showZero={false} />
          </Space>
          <Button
            type="link"
            size="small"
            icon={<ExternalLink size={11} />}
            onClick={(e) => { e.stopPropagation(); navigate('/cold-storage'); }}
            style={{ fontSize: '0.7rem', padding: 0 }}
            aria-label="Open cold storage page"
          >
            Open
          </Button>
        </SectionRow>
      ),
      children: coldStorageQuery.isLoading ? (
        <Skeleton.Input active size="small" style={{ width: 80 }} />
      ) : (
        <MiniStat>
          <MiniStatValue>{coldStorageQuery.data?.count ?? '—'}</MiniStatValue>
          <MiniStatLabel>active lots in inventory</MiniStatLabel>
        </MiniStat>
      ),
    },
    {
      key: 'freight',
      label: (
        <SectionRow>
          <Space size={6}>
            <Truck size={14} />
            <Text strong style={{ fontSize: '0.8rem' }}>Freight Orders</Text>
            {(freightQuery.data?.active ?? 0) > 0 && (
              <Tag color="blue" style={{ margin: 0, borderRadius: 6, fontSize: '0.65rem' }}>
                {freightQuery.data?.active} active
              </Tag>
            )}
          </Space>
          <Button
            type="link"
            size="small"
            icon={<ExternalLink size={11} />}
            onClick={(e) => { e.stopPropagation(); navigate('/logistics/freight-orders'); }}
            style={{ fontSize: '0.7rem', padding: 0 }}
            aria-label="Open freight orders page"
          >
            Open
          </Button>
        </SectionRow>
      ),
      children: freightQuery.isLoading ? (
        <Skeleton.Input active size="small" style={{ width: 120 }} />
      ) : (
        <MiniStat>
          <MiniStatValue>{freightQuery.data?.total ?? '—'}</MiniStatValue>
          <MiniStatLabel>total freight orders</MiniStatLabel>
          {(freightQuery.data?.active ?? 0) > 0 && (
            <>
              <MiniStatValue style={{ marginLeft: '1rem' }}>{freightQuery.data?.active}</MiniStatValue>
              <MiniStatLabel>in transit</MiniStatLabel>
            </>
          )}
        </MiniStat>
      ),
    },
    {
      key: 'carriers',
      label: (
        <SectionRow>
          <Space size={6}>
            <Package size={14} />
            <Text strong style={{ fontSize: '0.8rem' }}>Carriers</Text>
          </Space>
          <Button
            type="link"
            size="small"
            icon={<ExternalLink size={11} />}
            onClick={(e) => { e.stopPropagation(); navigate('/logistics/carriers'); }}
            style={{ fontSize: '0.7rem', padding: 0 }}
            aria-label="Open carriers page"
          >
            Open
          </Button>
        </SectionRow>
      ),
      children: carriersQuery.isLoading ? (
        <Skeleton.Input active size="small" style={{ width: 80 }} />
      ) : (
        <MiniStat>
          <MiniStatValue>{carriersQuery.data?.count ?? '—'}</MiniStatValue>
          <MiniStatLabel>registered carriers</MiniStatLabel>
        </MiniStat>
      ),
    },
  ];

  return (
    <PanelWrapper role="region" aria-label="Operations overview">
      <Collapse
        ghost
        size="small"
        defaultActiveKey={['cold-storage', 'freight']}
        items={items}
        style={{ background: 'transparent' }}
      />
    </PanelWrapper>
  );
};

export default OperationsPanel;
