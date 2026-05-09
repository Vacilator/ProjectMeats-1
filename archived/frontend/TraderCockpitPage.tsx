/**
 * Trader Cockpit Page — Unified Command Center
 *
 * The single, beautiful hub for all meat trading operations.
 * Radical simplicity: one-click actions, progressive disclosure,
 * AI-driven suggestions, and minimal cognitive load.
 *
 * Sections (tab-based):
 * - Command Center: AI Proposals + Quick Actions + KPIs
 * - Live Pipeline: Active trades with real-time status
 * - History: Completed trades and analytics
 *
 * Theme Compliance: CSS custom properties only.
 * Service Layer: Uses traderService for all API calls.
 */
import React, { useCallback, useMemo, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  Badge,
  Button,
  Input,
  Modal,
  Segmented,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
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
  ArrowRight,
  Zap,
  Sparkles,
  LayoutDashboard,
  Clock,
  Boxes,
} from 'lucide-react';

import { TradePipelineTracker } from '../components/Trader/TradePipelineTracker';
import { SmartTradeCreator } from '../components/Trader/SmartTradeCreator';
import { AITradeProposals } from '../components/Trader/AITradeProposals';
import { OperationsPanel } from '../components/Trader/OperationsPanel';
import { StatCardGrid } from '../components/Shared/StatCardGrid';
import { CockpitPanel } from '../components/Shared/CockpitPanel';
import { ErrorBoundary } from '../components/Shared/ErrorBoundary';
import {
  TransactionalEmptyState,
  TransactionalEmptyStateGuidance,
  TransactionalEmptyStateGuidanceItem,
} from '../components/Onboarding';
import {
  traderService,
  type TradeSession,
} from '../services/traderService';
import { withTenantQueryKey } from '../utils/queryKeys';

const { Text, Title } = Typography;

// ============================================================================
// Animations
// ============================================================================

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
  50% { box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15); }
`;

// ============================================================================
// Styled Components — Minimalist Design System
// ============================================================================

const PageContainer = styled.div`
  padding: 1.5rem 2rem;
  max-width: 1400px;
  margin: 0 auto;
  animation: ${fadeIn} 0.3s ease-out;
`;

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const HeaderLeft = styled.div`
  flex: 1;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Subtitle = styled(Text)`
  font-size: 0.82rem;
  color: rgb(var(--color-text-tertiary, 107 114 128));
  display: block;
  margin-top: 2px;
`;

const TabContainer = styled.div`
  margin-bottom: 1.25rem;
`;

const WizardModal = styled(Modal)`
  .ant-modal-content {
    border-radius: 16px;
    overflow: hidden;
  }
  .ant-modal-body {
    padding: 1.5rem;
  }
`;

const DetailModalContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const QuickActionsRow = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const QuickActionButton = styled(Button)`
  border-radius: 10px;
  height: 44px;
  font-weight: 500;
  padding: 0 1.25rem;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
  }

  &.ant-btn-primary {
    animation: ${pulseGlow} 3s ease-in-out infinite;
  }
`;

// ============================================================================
// Constants
// ============================================================================

const STEP_LABELS: Record<string, string> = {
  supplier_rfq: 'Supplier RFQ',
  supplier_reply_parse: 'Awaiting Reply',
  draft_supplier_po: 'Draft PO',
  approve_supplier_po: 'Approve PO',
  draft_sales_order: 'Draft SO',
  approve_sales_order: 'Approve SO',
  carrier_fan_out: 'Carrier Fan-Out',
  carrier_reply_parse: 'Awaiting Carrier',
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

type CockpitTab = 'command' | 'pipeline' | 'operations' | 'history';

// ============================================================================
// Component
// ============================================================================

const TraderCockpitPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<TradeSession | null>(null);
  const [activeTab, setActiveTab] = useState<CockpitTab>('command');

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
    completedToday: trades.filter((t) => {
      if (t.status !== 'completed' || !t.updated_at) return false;
      return new Date(t.updated_at).toDateString() === new Date().toDateString();
    }).length,
  }), [trades]);

  // Handlers
  const handleNewTrade = useCallback(() => {
    setWizardOpen(true);
  }, []);

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

  // Table columns — compact and clean
  const columns = useMemo<ColumnsType<TradeSession>>(
    () => [
      {
        title: 'Trade',
        dataIndex: 'trade_id',
        key: 'trade_id',
        width: 130,
        render: (value: string) => <Text strong style={{ fontSize: '0.8rem' }}>{value}</Text>,
      },
      {
        title: 'Customer',
        dataIndex: 'customer_name',
        key: 'customer_name',
        ellipsis: true,
        render: (value: string | null) => value || <Text type="secondary">—</Text>,
      },
      {
        title: 'Route',
        dataIndex: 'route',
        key: 'route',
        width: 85,
        render: (value: string) => (
          <Tag color={value === 'BROKER' ? 'purple' : 'blue'} style={{ margin: 0, borderRadius: 6 }}>
            {value || 'FULFILL'}
          </Tag>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 95,
        render: (value: string) => (
          <Tag color={STATUS_COLORS[value] || 'default'} style={{ margin: 0, borderRadius: 6 }}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </Tag>
        ),
      },
      {
        title: 'Step',
        dataIndex: 'current_step',
        key: 'current_step',
        ellipsis: true,
        render: (value: string) => (
          <Text style={{ fontSize: '0.75rem' }}>
            {STEP_LABELS[value] || value}
          </Text>
        ),
      },
      {
        title: '',
        key: 'actions',
        width: 100,
        render: (_: unknown, record: TradeSession) => (
          <Button
            size="small"
            type="primary"
            ghost
            icon={<ArrowRight size={12} />}
            style={{ borderRadius: 8 }}
            onClick={(e) => {
              e.stopPropagation();
              advanceMutation.mutate(record.id);
            }}
            loading={advanceMutation.isPending}
          >
            Advance
          </Button>
        ),
      },
    ],
    [advanceMutation]
  );

  return (
    <PageContainer>
      {/* Minimalist Header */}
      <PageHeader>
        <HeaderLeft>
          <Title level={3} style={{ marginBottom: 0, fontWeight: 800 }}>
            Trader Cockpit
          </Title>
          <Subtitle>
            Your intelligent command center for end-to-end meat trades.
          </Subtitle>
        </HeaderLeft>
        <HeaderActions>
          <Input
            placeholder="Search…"
            prefix={<Search size={14} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200, borderRadius: 10 }}
            allowClear
          />
          <Tooltip title="Refresh">
            <Button
              icon={<RefreshCw size={14} />}
              onClick={() => tradesQuery.refetch()}
              loading={tradesQuery.isFetching}
              style={{ borderRadius: 10 }}
            />
          </Tooltip>
        </HeaderActions>
      </PageHeader>

      {/* Glanceable KPIs — using canonical StatCardGrid */}
      <StatCardGrid items={[
        { value: stats.total, label: 'Total Trades', icon: <Activity size={11} /> },
        { value: stats.active, label: 'In Progress', icon: <TrendingUp size={11} /> },
        { value: stats.blocked, label: 'Blocked', icon: <AlertTriangle size={11} />, alert: true },
        { value: stats.completedToday, label: 'Today', icon: <CheckCircle2 size={11} /> },
      ]} />

      {/* Quick Actions */}
      <QuickActionsRow>
        <QuickActionButton
          type="primary"
          icon={<Plus size={15} />}
          onClick={handleNewTrade}
        >
          New Trade
        </QuickActionButton>
        <Tooltip title="AI will suggest the best next actions">
          <QuickActionButton
            icon={<Sparkles size={15} />}
            onClick={() => setActiveTab('command')}
          >
            AI Suggestions
          </QuickActionButton>
        </Tooltip>
      </QuickActionsRow>

      {/* Tab Navigation */}
      <TabContainer>
        <Segmented
          value={activeTab}
          onChange={(val) => setActiveTab(val as CockpitTab)}
          options={[
            {
              label: (
                <Space size={6}>
                  <Sparkles size={13} />
                  <span>Command Center</span>
                </Space>
              ),
              value: 'command',
            },
            {
              label: (
                <Space size={6}>
                  <LayoutDashboard size={13} />
                  <span>Live Pipeline</span>
                  {stats.active > 0 && <Badge count={stats.active} size="small" />}
                </Space>
              ),
              value: 'pipeline',
            },
            {
              label: (
                <Space size={6}>
                  <Boxes size={13} />
                  <span>Operations</span>
                </Space>
              ),
              value: 'operations',
            },
            {
              label: (
                <Space size={6}>
                  <Clock size={13} />
                  <span>History</span>
                </Space>
              ),
              value: 'history',
            },
          ]}
          style={{ borderRadius: 10 }}
          block
        />
      </TabContainer>

      {/* Tab Content */}
      {activeTab === 'command' && (
        <>
          <ErrorBoundary fallbackMessage="AI proposals could not be loaded.">
            <AITradeProposals
              onProposalExecuted={() => {
                queryClient.invalidateQueries({ queryKey: withTenantQueryKey('trader-cockpit-active-trades') });
                setActiveTab('pipeline');
              }}
            />
          </ErrorBoundary>
          {stats.active > 0 && (
            <CockpitPanel
              title="Needs Attention"
              extra={
                <Button type="link" size="small" onClick={() => setActiveTab('pipeline')}>
                  View all →
                </Button>
              }
            >
              <Table
                rowKey="id"
                columns={columns}
                dataSource={trades.filter((t) => t.status === 'halted').slice(0, 3)}
                pagination={false}
                size="small"
                showHeader={false}
                onRow={(record) => ({
                  onClick: () => setSelectedTrade(record),
                  style: { cursor: 'pointer' },
                })}
                locale={{ emptyText: <Text type="secondary">All clear — no trades need attention</Text> }}
              />
            </CockpitPanel>
          )}
        </>
      )}

      {activeTab === 'pipeline' && (
        <CockpitPanel
          title="Active Trades"
          extra={<Text type="secondary" style={{ fontSize: '0.72rem' }}>{filteredTrades.length} trades</Text>}
        >
          {tradesQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : filteredTrades.length > 0 ? (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={filteredTrades}
              pagination={{ pageSize: 12, showSizeChanger: false, size: 'small' }}
              size="small"
              onRow={(record) => ({
                onClick: () => setSelectedTrade(record),
                style: { cursor: 'pointer' },
              })}
            />
          ) : (
            <TransactionalEmptyState
              icon={<Zap size={32} />}
              title="No active trades"
              message="Start a trade with one click — the AI will guide everything."
              actions={[{ label: 'New Trade', onClick: handleNewTrade, variant: 'primary' }]}
            >
              <TransactionalEmptyStateGuidance>
                <TransactionalEmptyStateGuidanceItem>
                  Click "New Trade" or let AI proposals create one for you.
                </TransactionalEmptyStateGuidanceItem>
              </TransactionalEmptyStateGuidance>
            </TransactionalEmptyState>
          )}
        </CockpitPanel>
      )}

      {activeTab === 'operations' && (
        <CockpitPanel title="Operations Overview">
          <ErrorBoundary fallbackMessage="Operations data could not be loaded.">
            <OperationsPanel />
          </ErrorBoundary>
        </CockpitPanel>
      )}

      {activeTab === 'history' && (
        <CockpitPanel title="Completed Trades">
          {trades.filter((t) => t.status === 'completed').length > 0 ? (
            <Table
              rowKey="id"
              columns={columns.filter((c) => c.key !== 'actions')}
              dataSource={trades.filter((t) => t.status === 'completed')}
              pagination={{ pageSize: 10, showSizeChanger: false, size: 'small' }}
              size="small"
              onRow={(record) => ({
                onClick: () => setSelectedTrade(record),
                style: { cursor: 'pointer' },
              })}
            />
          ) : (
            <Text type="secondary">No completed trades yet. They'll appear here once finished.</Text>
          )}
        </CockpitPanel>
      )}

      {/* Smart Trade Creator Modal */}
      <WizardModal
        open={wizardOpen}
        onCancel={() => setWizardOpen(false)}
        title={null}
        footer={null}
        width={680}
        destroyOnHidden
      >
        <SmartTradeCreator
          onTradeCreated={() => {
            setWizardOpen(false);
            queryClient.invalidateQueries({ queryKey: withTenantQueryKey('trader-cockpit-active-trades') });
            setActiveTab('pipeline');
            message.success('Trade pipeline started!');
          }}
          onCancel={() => setWizardOpen(false)}
        />
      </WizardModal>

      {/* Trade Detail Modal — clean and focused */}
      <Modal
        open={Boolean(selectedTrade)}
        onCancel={() => setSelectedTrade(null)}
        title={
          <Space>
            <Text strong>{selectedTrade?.trade_id}</Text>
            {selectedTrade && (
              <Tag color={STATUS_COLORS[selectedTrade.status] || 'default'} style={{ borderRadius: 6 }}>
                {selectedTrade.status}
              </Tag>
            )}
          </Space>
        }
        footer={[
          <Button key="close" onClick={() => setSelectedTrade(null)} style={{ borderRadius: 8 }}>
            Close
          </Button>,
          <Button
            key="advance"
            type="primary"
            icon={<ArrowRight size={14} />}
            style={{ borderRadius: 8 }}
            onClick={() => {
              if (selectedTrade) advanceMutation.mutate(selectedTrade.id);
            }}
            loading={advanceMutation.isPending}
          >
            Advance
          </Button>,
        ]}
        width={650}
      >
        {selectedTrade && (
          <DetailModalContent>
            <TradePipelineTracker
              currentStep={selectedTrade.current_step}
              route={selectedTrade.route}
            />
            <Space wrap style={{ marginTop: 8 }}>
              <Tag color={selectedTrade.route === 'BROKER' ? 'purple' : 'blue'} style={{ borderRadius: 6 }}>
                {selectedTrade.route || 'FULFILL'}
              </Tag>
              {selectedTrade.customer_name && (
                <Text type="secondary" style={{ fontSize: '0.8rem' }}>
                  Customer: <strong>{selectedTrade.customer_name}</strong>
                </Text>
              )}
            </Space>
            <Text type="secondary" style={{ fontSize: '0.75rem' }}>
              Current Step: <strong>{STEP_LABELS[selectedTrade.current_step] || selectedTrade.current_step}</strong>
              {selectedTrade.initiated_at && (
                <> · Started {new Date(selectedTrade.initiated_at).toLocaleDateString()}</>
              )}
            </Text>
          </DetailModalContent>
        )}
      </Modal>
    </PageContainer>
  );
};

export default TraderCockpitPage;
