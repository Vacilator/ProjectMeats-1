/**
 * MyTrades — Active trade pipeline monitoring dashboard.
 *
 * Shows all active/recent trade sessions with:
 * - Status-based tabs (Active, Completed, All)
 * - KPI strip with pipeline health metrics + aging indicators
 * - Expandable trade cards with React Flow lineage visual
 * - Quick links to related entities (Inquiry, PO, SO, Carrier)
 * - Route-type filter pills and "Initiate Trade" / "Advance Trade" actions
 */
import React, { useCallback, useMemo, useState } from 'react';
import styled, { css } from 'styled-components';
import { Badge, Skeleton, Tag, Tooltip, message } from 'antd';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock,
  Package,
  Play,
  Plus,
  RefreshCw,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { traderService, type TradeSession } from '@/services/traderService';
import { TradeLineageFlow } from '@/components/Cockpit/TradeLineageFlow';
import { TradeWorkflowStepper } from '@/components/Workflow/TradeWorkflowStepper';
import { logger } from '@/utils/logger';

/** Human-readable label for orchestrator step values */
const formatStepLabel = (step: string): string => {
  const labels: Record<string, string> = {
    supplier_rfq: 'Supplier RFQ',
    supplier_reply_parse: 'Awaiting Supplier Reply',
    draft_supplier_po: 'Draft Supplier PO',
    approve_supplier_po: 'Approve Supplier PO',
    draft_sales_order: 'Draft Sales Order',
    approve_sales_order: 'Approve Sales Order',
    carrier_fan_out: 'Carrier Selection',
    carrier_reply_parse: 'Awaiting Carrier Reply',
    draft_carrier_po: 'Draft Carrier PO',
    completed: 'Completed',
  };
  return labels[step] || step?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';
};

type TradeTab = 'active' | 'completed' | 'all';
type RouteFilter = 'all' | 'FULFILL' | 'BROKER';

const STATUS_META: Record<string, { color: string; label: string }> = {
  initiated: { color: 'blue', label: 'Initiated' },
  sourcing: { color: 'processing', label: 'Sourcing' },
  quoted: { color: 'cyan', label: 'Quoted' },
  ordered: { color: 'geekblue', label: 'Ordered' },
  logistics: { color: 'orange', label: 'Logistics' },
  active: { color: 'blue', label: 'Active' },
  in_progress: { color: 'processing', label: 'In Progress' },
  pending: { color: 'warning', label: 'Pending' },
  completed: { color: 'success', label: 'Completed' },
  halted: { color: 'error', label: 'Halted' },
  failed: { color: 'error', label: 'Failed' },
  cancelled: { color: 'default', label: 'Cancelled' },
};

const getStatusMeta = (status: string) =>
  STATUS_META[status?.toLowerCase()] ?? { color: 'default', label: status || 'Unknown' };

const isActiveStatus = (status: string) =>
  ['active', 'in_progress', 'pending', 'initiated', 'sourcing', 'quoted', 'ordered', 'logistics'].includes(status?.toLowerCase());

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

/** How many days since last activity — for aging indicators */
const getAgingDays = (trade: TradeSession): number => {
  const ref = trade.updated_at || trade.initiated_at;
  if (!ref) return 0;
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000);
};

type AgingLevel = 'critical' | 'warning' | 'ok';
const getAgingLevel = (days: number): AgingLevel => {
  if (days > 7) return 'critical';
  if (days >= 3) return 'warning';
  return 'ok';
};

const MyTrades: React.FC = () => {
  useDocumentTitle('My Trades');
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TradeTab>('active');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [routeFilter, setRouteFilter] = useState<RouteFilter>('all');
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: withTenantQueryKey('my-trades'),
    queryFn: () => traderService.listActiveTrades(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const trades = useMemo(() => data?.results ?? [], [data]);

  const filteredTrades = useMemo(() => {
    let items = trades;
    if (activeTab === 'active') items = items.filter((t) => isActiveStatus(t.status));
    else if (activeTab === 'completed') items = items.filter((t) => !isActiveStatus(t.status));
    if (routeFilter !== 'all') items = items.filter((t) => t.route === routeFilter);
    return items;
  }, [trades, activeTab, routeFilter]);

  const counts = useMemo(() => ({
    active: trades.filter((t) => isActiveStatus(t.status)).length,
    completed: trades.filter((t) => !isActiveStatus(t.status)).length,
    all: trades.length,
  }), [trades]);

  /** Trades with no activity in >3 days */
  const agingCount = useMemo(
    () => trades.filter(t => isActiveStatus(t.status) && getAgingDays(t) >= 3).length,
    [trades],
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleRefresh = useCallback(() => { void refetch(); }, [refetch]);

  const handleNavigateToInquiry = useCallback((inquiryId: string) => {
    navigate(`/inquiries?highlight=${inquiryId}`);
  }, [navigate]);

  const handleAdvanceTrade = useCallback(async (e: React.MouseEvent, trade: TradeSession) => {
    e.stopPropagation();
    setAdvancingId(trade.id);
    try {
      const result = await traderService.advanceTrade(trade.id);
      if (result.completed) {
        void message.success('Trade completed!');
      } else if (result.blocked) {
        void message.warning(`Blocked: ${result.blocked_reason || 'Missing dependencies'}`);
      } else {
        void message.success(`Advanced to: ${result.current_step}`);
      }
      void refetch();
    } catch (err) {
      logger.error('Advance trade failed', err);
      void message.error('Failed to advance trade');
    } finally {
      setAdvancingId(null);
    }
  }, [refetch]);

  const handleInitiateTrade = useCallback(() => {
    navigate('/inquiries?action=create');
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
          <HeaderActions>
            <RefreshButton onClick={handleRefresh} disabled={isFetching} title="Refresh trades">
              <RefreshCw size={16} className={isFetching ? 'spin' : ''} />
            </RefreshButton>
            <InitiateButton onClick={handleInitiateTrade}>
              <Plus size={14} /> Initiate Trade
            </InitiateButton>
          </HeaderActions>
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
        {agingCount > 0 && (
          <KpiCard $highlight="warning">
            <KpiIcon><Zap size={18} /></KpiIcon>
            <KpiContent>
              <KpiValue $color="warning">{agingCount}</KpiValue>
              <KpiLabel>Aging (3+ days)</KpiLabel>
            </KpiContent>
          </KpiCard>
        )}
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

      {/* Route filter pills */}
      <RouteFilterRow>
        <RouteFilterPill $active={routeFilter === 'all'} onClick={() => setRouteFilter('all')}>All Routes</RouteFilterPill>
        <RouteFilterPill $active={routeFilter === 'FULFILL'} onClick={() => setRouteFilter('FULFILL')}>📦 Fulfill</RouteFilterPill>
        <RouteFilterPill $active={routeFilter === 'BROKER'} onClick={() => setRouteFilter('BROKER')}>🔄 Broker</RouteFilterPill>
      </RouteFilterRow>

      {/* Trade List */}
      {isLoading ? (
        <SkeletonList>
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i}>
              <Skeleton active paragraph={{ rows: 2 }} />
            </SkeletonCard>
          ))}
        </SkeletonList>
      ) : isError ? (
        <EmptyStateWrapper>
          <EmptyStateIcon>⚠️</EmptyStateIcon>
          <EmptyStateTitle>Unable to load trades</EmptyStateTitle>
          <EmptyStateDesc>Something went wrong while fetching your trades. Please try again.</EmptyStateDesc>
          <EmptyStateCTA onClick={() => void refetch()}>
            <RefreshCw size={14} /> Retry
          </EmptyStateCTA>
        </EmptyStateWrapper>
      ) : filteredTrades.length === 0 ? (
        <EmptyStateWrapper>
          <EmptyStateIcon>{activeTab === 'completed' ? '🏆' : '📋'}</EmptyStateIcon>
          <EmptyStateTitle>
            {activeTab === 'active'
              ? 'No active trades'
              : activeTab === 'completed'
              ? 'No completed trades yet'
              : 'No trades found'}
          </EmptyStateTitle>
          <EmptyStateDesc>
            {activeTab === 'active'
              ? 'Start by creating an inquiry to initiate a trade session.'
              : 'Completed trades will appear here once active trades are fulfilled.'}
          </EmptyStateDesc>
          {activeTab === 'active' && (
            <EmptyStateCTA onClick={handleInitiateTrade}>
              <Plus size={14} /> Create Inquiry to Start
            </EmptyStateCTA>
          )}
        </EmptyStateWrapper>
      ) : (
        <TradeList>
          {filteredTrades.map((trade) => {
            const agingDays = getAgingDays(trade);
            const aging = getAgingLevel(agingDays);
            const isActive = isActiveStatus(trade.status);
            return (
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
                      <MetaItem>Step: {formatStepLabel(trade.current_step)}</MetaItem>
                    </TradeMeta>
                  </TradeInfo>

                  {/* Aging indicator */}
                  {isActive && agingDays >= 3 && (
                    <AgingBadge $level={aging}>
                      {agingDays}d idle
                    </AgingBadge>
                  )}

                  <TradeTimestamp>{formatRelativeTime(trade.updated_at)}</TradeTimestamp>

                  <CardActions>
                    {isActive && (
                      <AdvanceButton
                        onClick={(e) => void handleAdvanceTrade(e, trade)}
                        disabled={advancingId === trade.id}
                        title="Advance to next step"
                      >
                        <Play size={12} /> {advancingId === trade.id ? 'Advancing…' : 'Advance'}
                      </AdvanceButton>
                    )}
                    <ViewButton onClick={(e) => {
                      e.stopPropagation();
                      handleNavigateToInquiry(trade.inquiry_id);
                    }}>
                      View <ArrowRight size={14} />
                    </ViewButton>
                  </CardActions>
                </TradeCardHeader>

                {expandedId === trade.id && (
                  <TradeCardBody>
                    {/* Workflow Progress Stepper */}
                    <FlowSection>
                      <FlowLabel>Workflow Progress</FlowLabel>
                      <TradeWorkflowStepper
                        tradeStatus={trade.status}
                        currentStep={trade.current_step}
                        tradeSessionId={trade.id}
                      />
                    </FlowSection>
                    <FlowSection>
                      <FlowLabel>Trade Lineage</FlowLabel>
                      <TradeLineageFlow inquiryId={trade.inquiry_id} compact />
                    </FlowSection>
                  </TradeCardBody>
                )}
              </TradeCard>
            );
          })}
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
  justify-content: space-between;
  gap: 12px;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const InitiateButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-primary));
  color: rgb(var(--color-primary-foreground, 255, 255, 255));
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  &:hover { opacity: 0.9; }
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
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
`;

const KpiCard = styled.div<{ $highlight?: string }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: rgb(var(--color-surface));
  border-radius: var(--radius-lg, 12px);
  border: 1px solid ${(p) =>
    p.$highlight === 'warning'
      ? 'rgb(var(--color-warning) / 0.4)'
      : 'rgb(var(--color-border))'
  };
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
const KpiValue = styled.div<{ $color?: string }>`
  font-size: 22px;
  font-weight: 700;
  color: ${(p) =>
    p.$color === 'warning'
      ? 'rgb(var(--color-warning))'
      : 'rgb(var(--color-text-primary))'
  };
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

const EmptyStateWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 64px 24px;
  text-align: center;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg, 12px);
`;

const EmptyStateIcon = styled.span`
  font-size: 2.5rem;
  opacity: 0.7;
`;

const EmptyStateTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const EmptyStateDesc = styled.p`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  margin: 0;
  max-width: 320px;
`;

const EmptyStateCTA = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 20px;
  border-radius: 8px;
  border: none;
  background: rgb(var(--color-primary));
  color: rgb(var(--color-primary-foreground, 255, 255, 255));
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  &:hover { opacity: 0.9; }
`;

/* ── Route filter pills ── */
const RouteFilterRow = styled.div`
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
`;

const RouteFilterPill = styled.button<{ $active?: boolean }>`
  padding: 5px 14px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s;
  ${({ $active }) => $active
    ? css`
        background: rgb(var(--color-primary));
        color: rgb(var(--color-primary-foreground, 255, 255, 255));
        border: 1px solid rgb(var(--color-primary));
      `
    : css`
        background: rgb(var(--color-surface));
        color: rgb(var(--color-text-secondary));
        border: 1px solid rgb(var(--color-border));
        &:hover { border-color: rgb(var(--color-primary)); color: rgb(var(--color-primary)); }
      `
  }
`;

/* ── Aging & advance badges ── */
const AgingBadge = styled.span<{ $level: AgingLevel }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;

  ${(p) => p.$level === 'critical' ? css`
    background: rgb(var(--color-error) / 0.1);
    color: rgb(var(--color-error));
  ` : css`
    background: rgb(var(--color-warning) / 0.1);
    color: rgb(var(--color-warning));
  `}
`;

const CardActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`;

const AdvanceButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-primary));
  color: rgb(var(--color-primary-foreground, 255, 255, 255));
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  &:hover { opacity: 0.9; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
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
