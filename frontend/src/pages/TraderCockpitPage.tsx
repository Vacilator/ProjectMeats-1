/**
 * Trader Cockpit Page
 *
 * The single entry point for initiating and monitoring end-to-end meat trades.
 * Combines: New Trade wizard, active trades grid, pipeline visualization,
 * and dependency resolution.
 *
 * Features:
 * - "New Trade" button → route selection → dependency wizard → auto-pipeline
 * - Active trades table with pipeline status indicators
 * - Trade detail modal with TradeLineageFlow and dependency status
 * - Quick actions (Advance, View, Intervene)
 *
 * Theme Compliance: CSS custom properties only.
 * Service Layer: Uses traderService for all API calls.
 */
import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  Button,
  Card,
  Input,
  Modal,
  Radio,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  RefreshCw,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Zap,
} from 'lucide-react';

import { DependencyWizard } from '../components/Trader/DependencyWizard';
import { TradePipelineTracker } from '../components/Trader/TradePipelineTracker';
import { TradeLineageFlow } from '../components/Cockpit/TradeLineageFlow';
import {
  TransactionalEmptyState,
  TransactionalEmptyStateGuidance,
  TransactionalEmptyStateGuidanceItem,
} from '../components/Onboarding';
import {
  traderService,
  type TradeSession,
  type DependencyCheckResult,
} from '../services/traderService';
import { withTenantQueryKey } from '../utils/queryKeys';

const { Text, Title } = Typography;

// ============================================================================
// Styled Components
// ============================================================================

const PageContainer = styled.div`
  padding: 1rem;
  max-width: 1600px;
  margin: 0 auto;
`;

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
`;

const StatCard = styled(Card)`
  .ant-card-body {
    padding: 0.75rem 1rem;
  }
`;

const StatValue = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: rgb(var(--color-text-primary, 17 24 39));
`;

const StatLabel = styled.div`
  font-size: 0.72rem;
  color: rgb(var(--color-text-tertiary, 107 114 128));
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const WizardModal = styled(Modal)`
  .ant-modal-body {
    padding: 24px;
  }
`;

const RouteSelector = styled.div`
  margin-bottom: 20px;
`;

const RouteDescription = styled.div`
  font-size: 0.75rem;
  color: rgb(var(--color-text-tertiary, 107 114 128));
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(var(--color-bg-secondary, 249 250 251));
  border-radius: 6px;
`;

const DetailModalContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

// ============================================================================
// Step Labels for Display
// ============================================================================

const STEP_LABELS: Record<string, string> = {
  supplier_rfq: 'Supplier RFQ',
  supplier_reply_parse: 'Awaiting Supplier Reply',
  draft_supplier_po: 'Draft Supplier PO',
  approve_supplier_po: 'Approve Supplier PO',
  draft_sales_order: 'Draft Sales Order',
  approve_sales_order: 'Approve Sales Order',
  carrier_fan_out: 'Carrier Fan-Out',
  carrier_reply_parse: 'Awaiting Carrier Reply',
  draft_carrier_po: 'Draft Carrier PO',
  completed: 'Completed',
};

const STATUS_COLORS: Record<string, string> = {
  initiated: 'blue',
  sourcing: 'orange',
  quoted: 'purple',
  ordered: 'cyan',
  logistics: 'geekblue',
  completed: 'green',
  cancelled: 'default',
  halted: 'red',
};

// ============================================================================
// Component
// ============================================================================

const TraderCockpitPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<'FULFILL' | 'BROKER'>('FULFILL');
  const [selectedTrade, setSelectedTrade] = useState<TradeSession | null>(null);
  const [depCheck, setDepCheck] = useState<DependencyCheckResult | null>(null);
  const [newTradeInquiryId, setNewTradeInquiryId] = useState<string | null>(null);
  const [newTradeSessionId, setNewTradeSessionId] = useState<string | null>(null);

  // Fetch active trades
  const tradesQuery = useQuery({
    queryKey: withTenantQueryKey('trader-cockpit-active-trades'),
    queryFn: () => traderService.listActiveTrades(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const trades = tradesQuery.data?.results || [];

  // Filtered trades
  const filteredTrades = useMemo(() => {
    if (!searchText.trim()) return trades;
    const term = searchText.toLowerCase();
    return trades.filter(
      (t) =>
        t.trade_id.toLowerCase().includes(term) ||
        t.customer_name?.toLowerCase().includes(term) ||
        t.source_email_subject.toLowerCase().includes(term) ||
        t.current_step.toLowerCase().includes(term)
    );
  }, [trades, searchText]);

  // Stats
  const stats = useMemo(() => ({
    total: trades.length,
    active: trades.filter((t) => !['completed', 'cancelled', 'halted'].includes(t.status)).length,
    blocked: trades.filter((t) => t.status === 'halted').length,
    completedToday: 0, // Would need timestamp filtering
  }), [trades]);

  // Initiate trade mutation
  const initiateMutation = useMutation({
    mutationFn: (data: { route: 'FULFILL' | 'BROKER' }) =>
      traderService.initiateTrade({ route: data.route }),
    onSuccess: (result) => {
      setDepCheck(result.dependencies);
      setNewTradeInquiryId(result.inquiry_id);
      setNewTradeSessionId(result.trade_session_id);
      message.success(`Trade ${result.trade_id} initiated`);
    },
    onError: () => {
      message.error('Failed to initiate trade');
    },
  });

  // Advance trade mutation
  const advanceMutation = useMutation({
    mutationFn: (tradeSessionId: string) =>
      traderService.advanceTrade(tradeSessionId),
    onSuccess: (result) => {
      if (result.completed) {
        message.success('Trade completed!');
      } else if (result.blocked) {
        message.info(`Trade blocked: ${result.blocked_reason}`);
      } else {
        message.success(`Advanced to: ${STEP_LABELS[result.current_step] || result.current_step}`);
      }
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey('trader-cockpit-active-trades') });
    },
    onError: () => {
      message.error('Failed to advance trade');
    },
  });

  // Handlers
  const handleNewTrade = useCallback(() => {
    setWizardOpen(true);
    setDepCheck(null);
    setNewTradeInquiryId(null);
    setNewTradeSessionId(null);
    setSelectedRoute('FULFILL');
  }, []);

  const handleInitiate = useCallback(() => {
    initiateMutation.mutate({ route: selectedRoute });
  }, [selectedRoute, initiateMutation]);

  const handleStartPipeline = useCallback(() => {
    if (newTradeSessionId) {
      advanceMutation.mutate(newTradeSessionId);
      setWizardOpen(false);
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey('trader-cockpit-active-trades') });
    }
  }, [newTradeSessionId, advanceMutation, queryClient]);

  const handleRefreshDeps = useCallback(() => {
    if (newTradeInquiryId) {
      traderService.checkDependencies(newTradeInquiryId).then(setDepCheck);
    }
  }, [newTradeInquiryId]);

  // Table columns
  const columns = useMemo<ColumnsType<TradeSession>>(
    () => [
      {
        title: 'Trade ID',
        dataIndex: 'trade_id',
        key: 'trade_id',
        width: 140,
        render: (value: string) => <Text strong style={{ fontSize: '0.8rem' }}>{value}</Text>,
      },
      {
        title: 'Customer',
        dataIndex: 'customer_name',
        key: 'customer_name',
        render: (value: string | null) => value || <Text type="secondary">—</Text>,
      },
      {
        title: 'Route',
        dataIndex: 'route',
        key: 'route',
        width: 90,
        render: (value: string) => (
          <Tag color={value === 'BROKER' ? 'purple' : 'blue'}>
            {value || 'FULFILL'}
          </Tag>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (value: string) => (
          <Tag color={STATUS_COLORS[value] || 'default'}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </Tag>
        ),
      },
      {
        title: 'Current Step',
        dataIndex: 'current_step',
        key: 'current_step',
        render: (value: string) => (
          <Text style={{ fontSize: '0.75rem' }}>
            {STEP_LABELS[value] || value}
          </Text>
        ),
      },
      {
        title: 'Started',
        dataIndex: 'initiated_at',
        key: 'initiated_at',
        width: 110,
        render: (value: string | null) =>
          value ? new Date(value).toLocaleDateString() : '—',
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 120,
        render: (_: unknown, record: TradeSession) => (
          <Space size={4}>
            <Button
              size="small"
              type="primary"
              ghost
              icon={<ArrowRight size={12} />}
              onClick={(e) => {
                e.stopPropagation();
                advanceMutation.mutate(record.id);
              }}
              loading={advanceMutation.isPending}
            >
              Advance
            </Button>
          </Space>
        ),
      },
    ],
    [advanceMutation]
  );

  return (
    <PageContainer>
      <PageHeader>
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            Trader Cockpit
          </Title>
          <Text type="secondary">
            Initiate, monitor, and advance end-to-end meat trades.
          </Text>
        </div>
        <Space>
          <Input
            placeholder="Search trades…"
            prefix={<Search size={14} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Button
            icon={<RefreshCw size={14} />}
            onClick={() => tradesQuery.refetch()}
            loading={tradesQuery.isFetching}
          />
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={handleNewTrade}
          >
            New Trade
          </Button>
        </Space>
      </PageHeader>

      {/* Stats */}
      <StatsRow>
        <StatCard size="small">
          <StatValue>{stats.total}</StatValue>
          <StatLabel>
            <Space size={4}><Activity size={10} /> Active Trades</Space>
          </StatLabel>
        </StatCard>
        <StatCard size="small">
          <StatValue>{stats.active}</StatValue>
          <StatLabel>
            <Space size={4}><TrendingUp size={10} /> In Progress</Space>
          </StatLabel>
        </StatCard>
        <StatCard size="small">
          <StatValue style={{ color: stats.blocked > 0 ? 'rgb(var(--color-error))' : undefined }}>
            {stats.blocked}
          </StatValue>
          <StatLabel>
            <Space size={4}><AlertTriangle size={10} /> Blocked</Space>
          </StatLabel>
        </StatCard>
        <StatCard size="small">
          <StatValue>{stats.completedToday}</StatValue>
          <StatLabel>
            <Space size={4}><CheckCircle2 size={10} /> Completed Today</Space>
          </StatLabel>
        </StatCard>
      </StatsRow>

      {/* Active Trades Table */}
      <Card size="small" title="Active Trades">
        {tradesQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : filteredTrades.length > 0 ? (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredTrades}
            pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (total) => `${total} trades` }}
            size="small"
            onRow={(record) => ({
              onClick: () => setSelectedTrade(record),
              style: { cursor: 'pointer' },
            })}
          />
        ) : (
          <TransactionalEmptyState
            icon={<Zap size={36} />}
            title="No active trades"
            message="Start your first end-to-end trade to see it tracked here. The system will guide you through dependency setup and pipeline automation."
            actions={[
              {
                label: 'New Trade',
                onClick: handleNewTrade,
                variant: 'primary',
              },
            ]}
          >
            <TransactionalEmptyStateGuidance>
              <TransactionalEmptyStateGuidanceItem>
                Click "New Trade" to choose a route (Direct Fulfillment or Broker) and set up dependencies.
              </TransactionalEmptyStateGuidanceItem>
              <TransactionalEmptyStateGuidanceItem>
                The system checks for required Customer, Supplier, Plant, and Contact before starting.
              </TransactionalEmptyStateGuidanceItem>
            </TransactionalEmptyStateGuidance>
          </TransactionalEmptyState>
        )}
      </Card>

      {/* New Trade Wizard Modal */}
      <WizardModal
        open={wizardOpen}
        onCancel={() => setWizardOpen(false)}
        title="New Trade"
        footer={null}
        width={560}
        destroyOnClose
      >
        {!depCheck ? (
          <>
            <RouteSelector>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Select Trade Route
              </Text>
              <Radio.Group
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
                buttonStyle="solid"
              >
                <Radio.Button value="FULFILL">Direct Fulfillment</Radio.Button>
                <Radio.Button value="BROKER">Broker (via Supplier)</Radio.Button>
              </Radio.Group>
              <RouteDescription>
                {selectedRoute === 'FULFILL'
                  ? 'You fulfill directly from your own inventory. Pipeline: Draft SO → Approve → Carrier assignment → Delivery.'
                  : 'You source from a supplier first. Pipeline: Supplier RFQ → Quote → PO → Approve → Draft SO → Carrier → Delivery.'}
              </RouteDescription>
            </RouteSelector>
            <Button
              type="primary"
              onClick={handleInitiate}
              loading={initiateMutation.isPending}
              icon={<ArrowRight size={14} />}
              block
            >
              Initiate Trade & Check Dependencies
            </Button>
          </>
        ) : (
          <DependencyWizard
            checklist={depCheck.checklist}
            allSatisfied={depCheck.all_satisfied}
            onStartTrade={handleStartPipeline}
            onRefresh={handleRefreshDeps}
            loading={advanceMutation.isPending}
          />
        )}
      </WizardModal>

      {/* Trade Detail Modal */}
      <Modal
        open={Boolean(selectedTrade)}
        onCancel={() => setSelectedTrade(null)}
        title={selectedTrade?.trade_id || 'Trade Details'}
        footer={[
          <Button key="close" onClick={() => setSelectedTrade(null)}>
            Close
          </Button>,
          <Button
            key="advance"
            type="primary"
            icon={<ArrowRight size={14} />}
            onClick={() => {
              if (selectedTrade) advanceMutation.mutate(selectedTrade.id);
            }}
            loading={advanceMutation.isPending}
          >
            Advance
          </Button>,
        ]}
        width={700}
      >
        {selectedTrade && (
          <DetailModalContent>
            <TradePipelineTracker
              currentStep={selectedTrade.current_step}
              route={selectedTrade.route}
            />
            <Space wrap>
              <Tag color={STATUS_COLORS[selectedTrade.status] || 'default'}>
                {selectedTrade.status}
              </Tag>
              <Tag color={selectedTrade.route === 'BROKER' ? 'purple' : 'blue'}>
                {selectedTrade.route || 'FULFILL'}
              </Tag>
              {selectedTrade.customer_name && (
                <Text type="secondary">Customer: {selectedTrade.customer_name}</Text>
              )}
            </Space>
            <div>
              <Text type="secondary" style={{ fontSize: '0.75rem' }}>
                Current Step: <strong>{STEP_LABELS[selectedTrade.current_step] || selectedTrade.current_step}</strong>
              </Text>
            </div>
            {selectedTrade.initiated_at && (
              <Text type="secondary" style={{ fontSize: '0.72rem' }}>
                Started: {new Date(selectedTrade.initiated_at).toLocaleString()}
              </Text>
            )}
          </DetailModalContent>
        )}
      </Modal>
    </PageContainer>
  );
};

export default TraderCockpitPage;
