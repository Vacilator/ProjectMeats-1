/**
 * MyTrades — Active trade pipeline monitoring dashboard.
 *
 * Shows all active/recent trade sessions with:
 * - Status-based tabs (Active, Completed, All)
 * - KPI strip with pipeline health metrics
 * - Expandable trade cards with React Flow lineage visual
 * - Quick links to related entities (Inquiry, PO, SO, Carrier)
 */
import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Badge, Empty, Skeleton, Tag, Tooltip } from 'antd';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock,
  Package,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { traderService, type TradeSession } from '@/services/traderService';
import { TradeLineageFlow } from '@/components/Cockpit/TradeLineageFlow';

type TradeTab = 'active' | 'completed' | 'all';

const STATUS_META: Record<string, { color: string; label: string }> = {
  active: { color: 'blue', label: 'Active' },
  in_progress: { color: 'processing', label: 'In Progress' },
  pending: { color: 'warning', label: 'Pending' },
  completed: { color: 'success', label: 'Completed' },
  failed: { color: 'error', label: 'Failed' },
  cancelled: { color: 'default', label: 'Cancelled' },
};

const getStatusMeta = (status: string) =>
  STATUS_META[status?.toLowerCase()] ?? { color: 'default', label: status || 'Unknown' };

const isActiveStatus = (status: string) =>
  ['active', 'in_progress', 'pending'].includes(status?.toLowerCase());

const formatRelativeTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const MyTrades: React.FC = () => {
  useDocumentTitle('My Trades');
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TradeTab>('active');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: withTenantQueryKey('my-trades'),
    queryFn: () => traderService.listActiveTrades(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const trades = useMemo(() => data?.results ?? [], [data]);

  const filteredTrades = useMemo(() => {
    if (activeTab === 'active') return trades.filter((t) => isActiveStatus(t.status));
    if (activeTab === 'completed') return trades.filter((t) => !isActiveStatus(t.status));
    return trades;
  }, [trades, activeTab]);

  const counts = useMemo(() => ({
    active: trades.filter((t) => isActiveStatus(t.status)).length,
    completed: trades.filter((t) => !isActiveStatus(t.status)).length,
    all: trades.length,
  }), [trades]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleRefresh = useCallback(() => { void refetch(); }, [refetch]);

  const handleNavigateToInquiry = useCallback((inquiryId: string) => {
    navigate(`/inquiries?highlight=${inquiryId}`);
  }, [navigate]);

  const tabItems: { key: TradeTab; label: string; count: number }[] = [
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'completed', label: 'Completed', count: counts.completed },
    { key: 'all', label: 'All Trades', count: counts.all },
  ];

  return (
    <Container>
      <PageHeader>
        <TitleRow>
          <Title>My Trades</Title>
          <RefreshButton onClick={handleRefresh} disabled={isFetching} title="Refresh trades">
            <RefreshCw size={16} className={isFetching ? 'spin' : ''} />
          </RefreshButton>
        </TitleRow>
        <Subtitle>Monitor active trade pipelines and document flow</Subtitle>
      </PageHeader>

      {/* KPI Strip */}
      <KpiStrip>
        <KpiCard>
          <KpiIcon><TrendingUp size={18} /></KpiIcon>
          <KpiContent>
            <KpiValue>{counts.active}</KpiValue>
            <KpiLabel>Active Trades</KpiLabel>
          </KpiContent>
        </KpiCard>
        <KpiCard>
          <KpiIcon><Package size={18} /></KpiIcon>
          <KpiContent>
            <KpiValue>{counts.completed}</KpiValue>
            <KpiLabel>Completed</KpiLabel>
          </KpiContent>
        </KpiCard>
        <KpiCard>
          <KpiIcon><Clock size={18} /></KpiIcon>
          <KpiContent>
            <KpiValue>{counts.all}</KpiValue>
            <KpiLabel>Total</KpiLabel>
          </KpiContent>
        </KpiCard>
      </KpiStrip>

      {/* Tab Bar */}
      <TabBar>
        {tabItems.map((tab) => (
          <TabButton
            key={tab.key}
            $active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <Badge count={tab.count} size="small" showZero
              style={{ marginLeft: 6, backgroundColor: activeTab === tab.key
                ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-tertiary))' }}
            />
          </TabButton>
        ))}
      </TabBar>

      {/* Trade List */}
      {isLoading ? (
        <SkeletonList>
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i}>
              <Skeleton active paragraph={{ rows: 2 }} />
            </SkeletonCard>
          ))}
        </SkeletonList>
      ) : filteredTrades.length === 0 ? (
        <EmptyState>
          <Empty
            description={
              activeTab === 'active'
                ? 'No active trades. Initiate a trade from an inquiry to get started.'
                : activeTab === 'completed'
                ? 'No completed trades yet.'
                : 'No trades found.'
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </EmptyState>
      ) : (
        <TradeList>
          {filteredTrades.map((trade) => (
            <TradeCard key={trade.id} $expanded={expandedId === trade.id}>
              <TradeCardHeader onClick={() => toggleExpand(trade.id)}>
                <ExpandIcon>
                  {expandedId === trade.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </ExpandIcon>
                <TradeInfo>
                  <TradeTitle>
                    {trade.source_email_subject || `Trade ${trade.trade_id?.slice(0, 8) ?? trade.id.slice(0, 8)}`}
                  </TradeTitle>
                  <TradeMeta>
                    <Tag color={getStatusMeta(trade.status).color}>
                      {getStatusMeta(trade.status).label}
                    </Tag>
                    {trade.customer_name && (
                      <MetaItem>{trade.customer_name}</MetaItem>
                    )}
                    <MetaItem>
                      <Tooltip title={`Route: ${trade.route || 'Unknown'}`}>
                        {trade.route === 'FULFILL' ? '📦 Fulfill' : trade.route === 'BROKER' ? '🔄 Broker' : trade.route || '—'}
                      </Tooltip>
                    </MetaItem>
                    <MetaItem>Step: {trade.current_step || '—'}</MetaItem>
                  </TradeMeta>
                </TradeInfo>
                <TradeTimestamp>{formatRelativeTime(trade.updated_at)}</TradeTimestamp>
                <ViewButton onClick={(e) => {
                  e.stopPropagation();
                  handleNavigateToInquiry(trade.inquiry_id);
                }}>
                  View <ArrowRight size={14} />
                </ViewButton>
              </TradeCardHeader>

              {expandedId === trade.id && (
                <TradeCardBody>
                  <FlowSection>
                    <FlowLabel>Trade Lineage</FlowLabel>
                    <TradeLineageFlow inquiryId={trade.inquiry_id} compact />
                  </FlowSection>
                </TradeCardBody>
              )}
            </TradeCard>
          ))}
        </TradeList>
      )}
    </Container>
  );
};

/* ------------------------------------------------------------------ */
/*  Styled Components                                                  */
/* ------------------------------------------------------------------ */

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const PageHeader = styled.div`
  margin-bottom: 24px;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 4px 0 0;
`;

const RefreshButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: all 0.15s;

  &:hover { color: rgb(var(--color-primary)); border-color: rgb(var(--color-primary)); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  .spin { animation: pm-spin 1s linear infinite; }
  @keyframes pm-spin { to { transform: rotate(360deg); } }
`;

const KpiStrip = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
`;

const KpiCard = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg, 12px);
`;

const KpiIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md, 8px);
  background: rgba(var(--color-primary), 0.08);
  color: rgb(var(--color-primary));
`;

const KpiContent = styled.div``;
const KpiValue = styled.div`
  font-size: 22px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  line-height: 1;
`;
const KpiLabel = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  margin-top: 2px;
`;

const TabBar = styled.div`
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgb(var(--color-surface-secondary, var(--color-surface)));
  border-radius: var(--radius-lg, 12px);
  margin-bottom: 16px;
`;

const TabButton = styled.button<{ $active: boolean }>`
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-md, 8px);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  background: ${(p) => (p.$active ? 'rgb(var(--color-surface))' : 'transparent')};
  color: ${(p) => (p.$active ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-tertiary))')};
  box-shadow: ${(p) => (p.$active ? '0 1px 3px rgba(var(--shadow-color, 0,0,0), 0.08)' : 'none')};

  &:hover { color: rgb(var(--color-text-primary)); }
`;

const SkeletonList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SkeletonCard = styled.div`
  padding: 16px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg, 12px);
`;

const EmptyState = styled.div`
  padding: 48px 24px;
  text-align: center;
`;

const TradeList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TradeCard = styled.div<{ $expanded: boolean }>`
  background: rgb(var(--color-surface));
  border: 1px solid ${(p) => (p.$expanded ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))')};
  border-radius: var(--radius-lg, 12px);
  overflow: hidden;
  transition: border-color 0.15s;
`;

const TradeCardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;

  &:hover { background: rgba(var(--color-primary), 0.02); }
`;

const ExpandIcon = styled.div`
  color: rgb(var(--color-text-tertiary));
  flex-shrink: 0;
`;

const TradeInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const TradeTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TradeMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  flex-wrap: wrap;
`;

const MetaItem = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

const TradeTimestamp = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  white-space: nowrap;
  flex-shrink: 0;
`;

const ViewButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-primary));
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover {
    background: rgba(var(--color-primary), 0.06);
    border-color: rgb(var(--color-primary));
  }
`;

const TradeCardBody = styled.div`
  border-top: 1px solid rgb(var(--color-border));
  padding: 16px;
`;

const FlowSection = styled.div``;

const FlowLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: rgb(var(--color-text-tertiary));
  margin-bottom: 8px;
`;

export { MyTrades };
export default MyTrades;
