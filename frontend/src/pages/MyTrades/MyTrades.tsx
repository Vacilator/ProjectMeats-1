/**
 * MyTrades — Active trade pipeline monitoring dashboard.
 *
 * Shows all active/recent trade sessions with:
 * - Status-based tabs (Active, Completed, All)
 * - KPI strip with pipeline health metrics + aging indicators
 * - Expandable trade cards with workflow progress stepper
 * - Quick links to related entities (Inquiry, PO, SO, Carrier)
 * - Route-type filter pills and "Initiate Trade" / "Advance Trade" actions
 */
import React, { useCallback, useMemo, useState } from 'react';
import styled, { css } from 'styled-components';
import { Badge, Skeleton, Tag, Tooltip, message } from 'antd';
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock,
  Mail,
  Package,
  Play,
  Plus,
  RefreshCw,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { traderService, type TradeSession, type TradeListResponse, type DependencyCheckResult } from '@/services/traderService';
import { TradeWorkflowStepper } from '@/components/Workflow/TradeWorkflowStepper';
import { TradeDocumentsPanel } from '@/components/Trader/TradeDocumentsPanel';
import { businessApi } from '@/services/businessApi';
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
    draft_fulfillment: 'Draft Fulfillment',
    draft_invoice: 'Draft Invoice',
    completed: 'Completed',
  };
  return labels[step] || step?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';
};

/** Map orchestrator step to pipeline stage index (0-5) for progress display */
const STEP_TO_STAGE_INDEX: Record<string, number> = {
  supplier_rfq: 0,
  supplier_reply_parse: 0,
  draft_supplier_po: 1,
  approve_supplier_po: 1,
  draft_sales_order: 2,
  approve_sales_order: 2,
  carrier_fan_out: 3,
  carrier_reply_parse: 3,
  draft_carrier_po: 3,
  draft_fulfillment: 4,
  draft_invoice: 5,
  completed: 5,
};

/** Fallback: Map trade session status to pipeline step index when no orchestrator step */
const STATUS_TO_STAGE_INDEX: Record<string, number> = {
  initiated: 0,
  sourcing: 0,
  quoted: 0,
  ordered: 1,
  logistics: 3,
  completed: 5,
  cancelled: -1,
  halted: -1,
};

const PIPELINE_STAGES = ['Inquiry', 'Purchase Order', 'Sales Order', 'Carrier PO', 'Fulfillment', 'Invoice'];

/** Get a human-readable progress summary like "Stage 2 of 6 • Purchase Order" */
const getPipelineProgress = (trade: TradeSession): string => {
  if (trade.status === 'cancelled') return 'Cancelled';
  if (trade.status === 'halted') return 'Halted';
  if (trade.status === 'completed') return '✓ All 6 stages complete';
  // Prefer orchestrator step for accuracy, fallback to status
  const step = trade.current_step;
  let idx: number;
  if (step === 'completed' && trade.status === 'logistics') {
    idx = 4; // Fulfillment in progress
  } else if (step && STEP_TO_STAGE_INDEX[step] !== undefined) {
    idx = STEP_TO_STAGE_INDEX[step];
  } else {
    idx = STATUS_TO_STAGE_INDEX[trade.status?.toLowerCase()] ?? 0;
  }
  const stageName = PIPELINE_STAGES[idx] ?? 'Unknown';
  const stepLabel = (step && step !== 'completed') ? formatStepLabel(step) : '';
  return `Stage ${idx + 1} of 6 • ${stageName}${stepLabel ? ` — ${stepLabel}` : ''}`;
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

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'halted', 'failed']);
const isActiveStatus = (status: string) =>
  !TERMINAL_STATUSES.has(status?.toLowerCase());

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

/** Determine the "next action" hint for a trade to guide the user */
const getNextActionHint = (trade: TradeSession): string => {
  if (!isActiveStatus(trade.status)) return '';
  const step = trade.current_step;
  if (!step) return 'Review inquiry details to begin';
  const hints: Record<string, string> = {
    supplier_rfq: 'Waiting for supplier RFQ to be sent',
    supplier_reply_parse: 'Waiting for supplier to reply with quote',
    draft_supplier_po: 'Ready to generate Supplier Purchase Order',
    approve_supplier_po: 'Supplier PO awaiting your approval',
    draft_sales_order: 'Ready to generate Sales Order',
    approve_sales_order: 'Sales Order awaiting your approval',
    carrier_fan_out: 'Selecting carriers for logistics',
    carrier_reply_parse: 'Waiting for carrier quotes',
    draft_carrier_po: 'Ready to generate Carrier PO',
    draft_fulfillment: 'Ready to create Fulfillment record',
    draft_invoice: 'Ready to generate Invoice',
    completed: 'All steps complete',
  };
  return hints[step] || `Current step: ${formatStepLabel(step)}`;
};

/** Dev environment detection for simulation tools */
const IS_DEV_ENV = import.meta.env.DEV || window.location.hostname.includes('dev.');

const MyTrades: React.FC = () => {
  useDocumentTitle('My Trades');
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TradeTab>('active');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [routeFilter, setRouteFilter] = useState<RouteFilter>('all');
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [depInfo, setDepInfo] = useState<Record<string, DependencyCheckResult>>({});

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: withTenantQueryKey('my-trades'),
    queryFn: () => traderService.listActiveTrades(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 2,
  });

  // Surface backend errors that return 200 OK with empty results
  const serverError = (data as TradeListResponse & { error?: string })?.error;
  if (serverError && !isLoading) {
    logger.warn('[MyTrades] Backend reported error:', serverError);
  }

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
    navigate(`/inquiries?review=inquiry&inquiry=${inquiryId}`);
  }, [navigate]);

  const handleAdvanceTrade = useCallback(async (e: React.MouseEvent, trade: TradeSession) => {
    e.stopPropagation();
    setAdvancingId(trade.id);
    try {
      const result = await traderService.advanceTrade(trade.id);
      if (result.completed) {
        void message.success('Trade completed!');
      } else if (result.blocked) {
        // Fetch dependency details when blocked to show user what's missing
        try {
          const deps = await traderService.checkDependencies(trade.inquiry_id);
          setDepInfo((prev) => ({ ...prev, [trade.id]: deps }));
          const missing = deps.checklist.filter((d) => !d.satisfied).map((d) => d.label);
          void message.warning(
            `Blocked: ${missing.length > 0 ? `Missing: ${missing.join(', ')}` : result.blocked_reason || 'Unmet dependencies'}`,
            5,
          );
        } catch {
          void message.warning(`Blocked: ${result.blocked_reason || 'Missing dependencies'}`);
        }
      } else {
        void message.success(`Advanced to: ${formatStepLabel(result.current_step || 'next step')}`);
      }
      void refetch();
    } catch (err) {
      const axErr = err as { code?: string; message?: string; kind?: string };
      const isTimeout = axErr.code === 'ECONNABORTED' || axErr.message?.includes('timeout');
      logger.error('Advance trade failed', err);
      if (isTimeout) {
        void message.error('Server is taking too long to respond. Please try again in a moment.');
      } else if (axErr.kind === 'circuit_breaker') {
        void message.error('Server is temporarily unavailable. It will auto-recover shortly.');
      } else {
        void message.error('Failed to advance trade. Please try again.');
      }
    } finally {
      setAdvancingId(null);
    }
  }, [refetch]);

  const handleInitiateTrade = useCallback(async () => {
    try {
      const result = await traderService.initiateTrade({});
      // Navigate to the newly created inquiry in edit mode
      navigate(`/inquiries?review=inquiry&inquiry=${result.inquiry_id}`);
      void message.success('New trade initiated — complete the inquiry details');
    } catch (err) {
      // Fallback: just navigate to create inquiry
      navigate('/inquiries?action=create');
      void message.warning('Could not auto-create trade session. Please create inquiry manually.');
    }
  }, [navigate]);

  /** Dev-mode: simulate inbound email to populate the AI approval queue */
  const simulateEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await businessApi.post('/ai-assistant/simulate-inbound-email/');
      return response.data as { created: number; scenario: string };
    },
    onSuccess: (data) => {
      void message.success(`Simulated email created (${data.scenario ?? 'random'}). Check AI Approvals tab.`);
    },
    onError: () => {
      void message.error('Failed to simulate email. Ensure the backend command endpoint is available.');
    },
  });

  /** Navigate to linked entity record when a stepper action is clicked */
  const handleStepperActionClick = useCallback(
    (action: { label: string; section?: string }, step: { key: string; entityType?: string }, trade?: TradeSession) => {
      if (!trade) return;
      // Use the same route map as step clicks — navigate to the entity
      const STEP_ROUTE_MAP: Record<string, { listPath: string; viewParam?: string }> = {
        inquiry: { listPath: '/inquiries', viewParam: 'review=inquiry&inquiry' },
        purchase_order: { listPath: '/purchase-orders', viewParam: 'edit' },
        sales_order: { listPath: '/sales-orders', viewParam: 'edit' },
        carrier_po: { listPath: '/carrier-pos', viewParam: 'edit' },
        fulfillment: { listPath: '/fulfillment', viewParam: 'edit' },
        invoice: { listPath: '/invoices', viewParam: 'edit' },
      };
      const route = STEP_ROUTE_MAP[step.key];
      if (!route) return;

      // For the inquiry step, always navigate to the inquiry
      if (step.key === 'inquiry') {
        navigate(`${route.listPath}?${route.viewParam}=${trade.inquiry_id}`);
        return;
      }

      // For other steps, check if entity already exists in the trade
      const entityIdMap: Record<string, string | null | undefined> = {
        purchase_order: trade.supplier_purchase_order_id,
        sales_order: trade.sales_order_id,
        carrier_po: trade.carrier_purchase_order_id,
        fulfillment: trade.fulfillment_id,
        invoice: trade.invoice_id,
      };
      const entityId = entityIdMap[step.key];
      if (entityId) {
        navigate(`${route.listPath}?${route.viewParam}=${entityId}`);
      } else {
        // Entity doesn't exist yet — navigate to create page
        navigate(`${route.listPath}?action=create`);
      }
    },
    [navigate],
  );

  const handleStepClick = useCallback(
    (step: { key: string; entityType?: string; entityId?: string; isEmpty: boolean }, trade?: TradeSession) => {
      if (!trade) return;
      // Navigate to existing record or create new
      const STEP_ROUTE_MAP: Record<string, { listPath: string; viewParam?: string }> = {
        inquiry: { listPath: '/inquiries', viewParam: 'review=inquiry&inquiry' },
        purchase_order: { listPath: '/purchase-orders', viewParam: 'edit' },
        sales_order: { listPath: '/sales-orders', viewParam: 'edit' },
        carrier_po: { listPath: '/carrier-pos', viewParam: 'edit' },
        fulfillment: { listPath: '/fulfillment', viewParam: 'edit' },
        invoice: { listPath: '/invoices', viewParam: 'edit' },
      };
      const route = STEP_ROUTE_MAP[step.key];
      if (!route) return;

      if (!step.isEmpty && step.entityId) {
        // Navigate to the list page with param to open detail/edit
        navigate(`${route.listPath}?${route.viewParam}=${step.entityId}`);
      } else {
        // Navigate to list with create action
        navigate(`${route.listPath}?action=create`);
      }
    },
    [navigate],
  );

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
            <RefreshButton onClick={handleRefresh} disabled={isFetching} title="Refresh trades" aria-label="Refresh trades list">
              <RefreshCw size={16} className={isFetching ? 'spin' : ''} />
            </RefreshButton>
            <InitiateButton onClick={handleInitiateTrade} aria-label="Initiate new trade">
              <Plus size={14} /> Initiate Trade
            </InitiateButton>
            {IS_DEV_ENV && (
              <SimulateButton
                onClick={() => simulateEmailMutation.mutate()}
                disabled={simulateEmailMutation.isPending}
                title="Simulate inbound email for AI approval testing"
                aria-label="Simulate inbound email"
              >
                <Mail size={14} /> {simulateEmailMutation.isPending ? 'Sending…' : 'Simulate Email'}
              </SimulateButton>
            )}
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
          <EmptyStateIcon>{serverError ? '⚠️' : activeTab === 'completed' ? '🏆' : '📋'}</EmptyStateIcon>
          <EmptyStateTitle>
            {serverError
              ? 'Trades could not be loaded'
              : activeTab === 'active'
              ? 'No active trades'
              : activeTab === 'completed'
              ? 'No completed trades yet'
              : 'No trades found'}
          </EmptyStateTitle>
          <EmptyStateDesc>
            {serverError
              ? `Server error: ${serverError}. Try refreshing.`
              : activeTab === 'active'
              ? 'Trades will appear here when inquiries are created. Click below to start one.'
              : 'Completed trades will appear here once active trades are fulfilled.'}
          </EmptyStateDesc>
          {activeTab === 'active' && (
            <EmptyStateCTA onClick={handleInitiateTrade}>
              <Plus size={14} /> Create Inquiry to Start
            </EmptyStateCTA>
          )}
          {serverError && (
            <EmptyStateCTA onClick={() => void refetch()}>
              <RefreshCw size={14} /> Retry
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
                <TradeCardHeader onClick={() => toggleExpand(trade.id)} role="button" tabIndex={0} aria-expanded={expandedId === trade.id} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(trade.id); } }}>
                  <ExpandIcon>
                    {expandedId === trade.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </ExpandIcon>
                  <TradeInfo>
                    <TradeTitle>
                      {trade.party_name
                        ? `${trade.entity_type === 'supplier' ? '🏭' : '👤'} ${trade.party_name}${trade.products_summary ? ` — ${trade.products_summary}` : ''}`
                        : trade.source_email_subject || `Trade ${trade.trade_id?.slice(0, 8) ?? trade.id.slice(0, 8)}`
                      }
                    </TradeTitle>
                    <TradeMeta>
                      <Tag color={getStatusMeta(trade.status).color}>
                        {getStatusMeta(trade.status).label}
                      </Tag>
                      {trade.current_step && trade.current_step !== trade.status && (
                        <Tag color="blue" style={{ fontSize: '0.7rem' }}>
                          {formatStepLabel(trade.current_step)}
                        </Tag>
                      )}
                      <PipelineProgress>
                        {getPipelineProgress(trade)}
                      </PipelineProgress>
                      {trade.customer_name && (
                        <MetaItem>👤 {trade.customer_name}</MetaItem>
                      )}
                      {trade.supplier_name && (
                        <MetaItem>🏭 {trade.supplier_name}</MetaItem>
                      )}
                      {trade.valid_until && (
                        <MetaItem>📅 Valid until {trade.valid_until}</MetaItem>
                      )}
                      <MetaItem>
                        <Tooltip title={`Route: ${trade.route || 'Unknown'}`}>
                          {trade.route === 'FULFILL' ? '📦 Fulfill' : trade.route === 'BROKER' ? '🔄 Broker' : trade.route || '—'}
                        </Tooltip>
                      </MetaItem>
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
                      <Tooltip
                        title={
                          depInfo[trade.id] && !depInfo[trade.id].all_satisfied
                            ? `Missing: ${depInfo[trade.id].checklist.filter(d => !d.satisfied).map(d => d.label).join(', ')}`
                            : getNextActionHint(trade)
                        }
                        placement="left"
                      >
                        <AdvanceButton
                          onClick={(e) => void handleAdvanceTrade(e, trade)}
                          disabled={advancingId === trade.id}
                          $blocked={!!depInfo[trade.id] && !depInfo[trade.id].all_satisfied}
                        >
                          {depInfo[trade.id] && !depInfo[trade.id].all_satisfied ? (
                            <><AlertCircle size={12} /> Blocked</>
                          ) : (
                            <><Play size={12} /> {advancingId === trade.id ? 'Advancing…' : 'Advance'}</>
                          )}
                        </AdvanceButton>
                      </Tooltip>
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
                    {/* Workflow Progress Stepper (consolidated — replaces lineage flow) */}
                    <FlowSection>
                      <FlowLabel>Workflow Progress</FlowLabel>
                      <TradeWorkflowStepper
                        tradeStatus={trade.status}
                        currentStep={trade.current_step ?? undefined}
                        tradeSessionId={trade.id}
                        inquiryId={trade.inquiry_id}
                        onActionClick={(action, step) => handleStepperActionClick(action, step, trade)}
                        onStepClick={(step) => handleStepClick(step, trade)}
                      />
                    </FlowSection>
                    <FlowSection>
                      <FlowLabel>Documents</FlowLabel>
                      <TradeDocumentsPanel
                        entityType="inquiry"
                        entityId={String(trade.inquiry_id)}
                        tradeSessionId={trade.id}
                      />
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

const SimulateButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px dashed rgb(var(--color-warning));
  border-radius: var(--radius-md, 8px);
  background: rgba(var(--color-warning), 0.06);
  color: rgb(var(--color-warning));
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: rgba(var(--color-warning), 0.12); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
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

const AdvanceButton = styled.button<{ $blocked?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: var(--radius-md, 8px);
  background: ${(p) => p.$blocked ? 'rgb(var(--color-warning))' : 'rgb(var(--color-primary))'};
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

const PipelineProgress = styled.span`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  font-weight: 500;
  padding: 2px 8px;
  background: rgba(var(--color-primary), 0.06);
  border-radius: var(--radius-sm, 4px);
  white-space: nowrap;
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
