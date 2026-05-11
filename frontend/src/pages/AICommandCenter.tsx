/**
 * AI Command Center — Unified Hub
 *
 * Consolidates legacy process surfaces, Trader Cockpit, and WorkForms AI Inbox
 * into a single operational command center.
 *
 * Tabs:
 *   1. Overview   — KPIs, quick actions, AI proposals
 *   2. Action Required — Items needing human attention (AI inbox + interventions)
 *   3. Live Pipeline — Active trade sessions
 *   4. History    — Completed trades, resolved reviews
 *
 * Execution drill-ins live in WorkForms Monitoring instead of competing as a
 * fifth top-level Command Center section.
 *
 * Theme: CSS custom properties only.
 * Service Layer: businessApi / traderService / aiStaffApi.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  Alert,
  Badge,
  Button,
  Input,
  Modal,
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
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
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
  Mail,
  Workflow,
  AlertCircle,
  Clock,
  ExternalLink,
  User,
  ChevronRight,
} from 'lucide-react';

import { TradePipelineTracker } from '../components/Trader/TradePipelineTracker';
import { SmartTradeCreator } from '../components/Trader/SmartTradeCreator';
import { AITradeProposals } from '../components/Trader/AITradeProposals';
import { StatCardGrid } from '../components/Shared/StatCardGrid';
import { CockpitPanel } from '../components/Shared/CockpitPanel';
import { ErrorBoundary } from '../components/Shared/ErrorBoundary';
import {
  OperatorActionRow,
  OperatorHeader,
  OperatorTabBar,
  OperatorShell,
} from '../components/Shared/OperatorShell';
import { ProcessQuickActions } from '../components/Cockpit/ProcessQuickActions';
import { TradeLineageFlow } from '../components/Cockpit/TradeLineageFlow';
import { ProcessFlowHeader } from '../components/Cockpit/ProcessFlowHeader';
import { MissingDependencyQuickCreate, type DependencyType } from '../components/Cockpit/MissingDependencyQuickCreate';
import { AIDraftReviewModal } from '../components/AIAssistant/AIDraftReviewModal';
import {
  TransactionalEmptyState,
  TransactionalEmptyStateGuidance,
  TransactionalEmptyStateGuidanceItem,
} from '../components/Onboarding';
import {
  traderService,
  type TradeSession,
} from '../services/traderService';
import { aiStaffApi, type PendingReviewItem } from '../services/aiService';
import { withTenantQueryKey } from '../utils/queryKeys';
import { entityListPath } from '../utils/entityTypeRegistry';
import {
  buildCanonicalSearchParams,
  getCanonicalSearchQuery,
} from '../utils/canonicalSearch';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const { Text, Title } = Typography;

// ============================================================================
// Animations
// ============================================================================

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--color-primary), 0); }
  50%      { box-shadow: 0 0 0 4px rgba(var(--color-primary), 0.15); }
`;

// ============================================================================
// Styled Components
// ============================================================================

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

const WizardModal = styled(Modal)`
  .ant-modal-content {
    border-radius: 16px;
    overflow: hidden;
  }
  .ant-modal-body {
    padding: 1.5rem;
  }
`;

// AI Inbox card styles
const CardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const ItemCard = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.02);
  }
`;

const ItemIcon = styled.div<{ $variant?: string }>`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${({ $variant }) =>
    $variant === 'warning'
      ? 'rgba(var(--color-warning), 0.1)'
      : $variant === 'error'
        ? 'rgba(var(--color-error), 0.1)'
        : $variant === 'success'
          ? 'rgba(var(--color-success), 0.1)'
          : 'rgba(var(--color-primary), 0.1)'};
  color: ${({ $variant }) =>
    $variant === 'warning'
      ? 'rgb(var(--color-warning))'
      : $variant === 'error'
        ? 'rgb(var(--color-error))'
        : $variant === 'success'
          ? 'rgb(var(--color-success))'
          : 'rgb(var(--color-primary))'};
`;

const ItemContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ItemTitle = styled.div`
  font-weight: 600;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ItemMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  margin-top: 2px;
`;

const StatusPill = styled.span<{ $variant?: string }>`
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  background: ${({ $variant }) =>
    $variant === 'warning'
      ? 'rgba(var(--color-warning), 0.12)'
      : $variant === 'error'
        ? 'rgba(var(--color-error), 0.12)'
        : $variant === 'success'
          ? 'rgba(var(--color-success), 0.12)'
          : 'rgba(var(--color-primary), 0.12)'};
  color: ${({ $variant }) =>
    $variant === 'warning'
      ? 'rgb(var(--color-warning))'
      : $variant === 'error'
        ? 'rgb(var(--color-error))'
        : $variant === 'success'
          ? 'rgb(var(--color-success))'
          : 'rgb(var(--color-primary))'};
`;

const SourceTag = styled.span`
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgb(var(--color-text-tertiary));
  flex-shrink: 0;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 24px;
  color: rgb(var(--color-text-secondary));
  text-align: center;
`;

const EmptySubtext = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

// Detail Modal styles
const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`;

const ModalEntity = styled.div`
  flex: 1;
`;

const ModalEntityTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const ModalEntityMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  margin-top: 4px;
`;

const ModalSection = styled.div`
  margin-top: 16px;
`;

const ModalSectionTitle = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const MetaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
`;

const MetaItem = styled.div``;

const MetaLabel = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const MetaValue = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  margin-top: 2px;
`;

const DetailModalContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const ShortcutHintBar = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 6px 16px;
  background: rgba(var(--color-bg-elevated, 30, 30, 46), 0.92);
  backdrop-filter: blur(8px);
  border-top: 1px solid rgba(var(--color-border, 200, 200, 220), 0.1);
  font-size: 0.72rem;
  color: rgba(var(--color-text-secondary, 160, 160, 180), 0.7);
  z-index: 100;
  pointer-events: none;

  kbd {
    display: inline-block;
    padding: 1px 5px;
    border-radius: 4px;
    border: 1px solid rgba(var(--color-border, 200, 200, 220), 0.2);
    background: rgba(var(--color-bg-surface, 50, 50, 70), 0.5);
    font-family: inherit;
    font-size: 0.7rem;
    font-weight: 500;
  }

  .separator {
    opacity: 0.4;
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

const HUB_TABS = ['overview', 'action-required', 'pipeline', 'history'] as const;
type HubTab = (typeof HUB_TABS)[number];

function isHubTab(value: string | null): value is HubTab {
  return value !== null && HUB_TABS.includes(value as HubTab);
}

// ============================================================================
// Unified operator item type
// ============================================================================

interface UnifiedItem {
  id: string;
  source: 'process' | 'ai-inbox' | 'task' | 'intervention' | 'draft';
  icon: 'workflow' | 'mail' | 'task' | 'alert' | 'draft';
  title: string;
  subtitle: string;
  status: string;
  statusLabel: string;
  timestamp: string;
  entity_type?: string;
  entity_id?: string;
  inquiry_id?: string;
  contact_name?: string;
  department?: string;
  confidence?: number;
  intent_label?: string;
  raw?: unknown;
}

// ============================================================================
// Helpers
// ============================================================================

function getStatusVariant(status: string): string {
  switch (status) {
    case 'review':
    case 'pending':
    case 'awaiting':
      return 'warning';
    case 'error':
    case 'failed':
    case 'halted':
      return 'error';
    case 'completed':
    case 'resolved':
    case 'done':
      return 'success';
    default:
      return 'info';
  }
}

function getIconForSource(icon: string) {
  switch (icon) {
    case 'mail':
      return <Mail size={16} />;
    case 'alert':
      return <AlertCircle size={16} />;
    case 'draft':
      return <Sparkles size={16} />;
    case 'task':
      return <CheckCircle2 size={16} />;
    default:
      return <Workflow size={16} />;
  }
}

function formatTimeAgo(timestamp: string): string {
  if (!timestamp) return '';
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ============================================================================
// Component
// ============================================================================

const AICommandCenter: React.FC = () => {
  useDocumentTitle('Command Center');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');

  // Tab from URL
  const activeTab = useMemo<HubTab>(() => {
    if (isHubTab(requestedTab)) {
      return requestedTab;
    }
    return 'overview';
  }, [requestedTab]);

  const setActiveTab = useCallback(
    (tab: HubTab) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
      });
    },
    [setSearchParams],
  );

  const searchText = useMemo(() => getCanonicalSearchQuery(searchParams), [searchParams]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UnifiedItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftReviewItem, setDraftReviewItem] = useState<PendingReviewItem | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<TradeSession | null>(null);
  const [quickCreateTarget, setQuickCreateTarget] = useState<{
    entityType: DependencyType;
    suggestedName?: string;
  } | null>(null);

  const handleQuickCreateClose = useCallback(() => setQuickCreateTarget(null), []);

  const updateSearchText = useCallback(
    (nextQuery: string) => {
      setSearchParams((prev) => buildCanonicalSearchParams(prev, nextQuery), { replace: true });
    },
    [setSearchParams],
  );

  const handleQuickCreateCreated = useCallback((_entityId: string, entityName: string) => {
    if (quickCreateTarget) {
      message.success(`Created ${quickCreateTarget.entityType}: ${entityName}`);
      setQuickCreateTarget(null);
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey('trade-lineage') });
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey(quickCreateTarget.entityType + 's') });
    }
  }, [quickCreateTarget, queryClient, withTenantQueryKey]);

  // ---- Data Queries ----

  // Active trades
  const tradesQuery = useQuery({
    queryKey: withTenantQueryKey('command-center-trades'),
    queryFn: () => traderService.listActiveTrades(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const trades = useMemo(() => tradesQuery.data?.results || [], [tradesQuery.data]);

  // AI inbox reviews
  const reviewsQuery = useQuery({
    queryKey: withTenantQueryKey('command-center-ai-reviews'),
    queryFn: () => aiStaffApi.listPendingReviews(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // ---- Derived: AI inbox items as UnifiedItem ----

  const aiInboxItems = useMemo<UnifiedItem[]>(() => {
    const reviews = reviewsQuery.data ?? [];
    return reviews.map((review: PendingReviewItem) => {
      const reviewAny = review as Record<string, unknown>;
      return {
        id: `ai-${review.id}`,
        source: 'ai-inbox' as const,
        icon: 'mail' as const,
        title: review.source_subject || review.source_document_name || 'Email Review',
        subtitle: [
          review.sender && `From: ${review.sender}`,
          review.intent_label && `Intent: ${review.intent_label}`,
        ].filter(Boolean).join(' • '),
        status: 'review',
        statusLabel: 'Needs Review',
        timestamp: (reviewAny.created_on || reviewAny.created_at || '') as string,
        confidence: reviewAny.confidence_score as number | undefined,
        intent_label: review.intent_label,
        raw: review,
      };
    });
  }, [reviewsQuery.data]);

  // ---- Derived: trade stats ----

  const tradeStats = useMemo(() => ({
    total: trades.length,
    active: trades.filter((t) => !['completed', 'cancelled', 'halted'].includes(t.status)).length,
    blocked: trades.filter((t) => t.status === 'halted').length,
    completedToday: trades.filter((t) => {
      if (t.status !== 'completed' || !t.updated_at) return false;
      return new Date(t.updated_at).toDateString() === new Date().toDateString();
    }).length,
  }), [trades]);

  // Filtered trades
  const filteredTrades = useMemo(() => {
    if (!searchText.trim()) return trades;
    const term = searchText.toLowerCase();
    return trades.filter(
      (t) =>
        (t.trade_id || '').toLowerCase().includes(term) ||
        t.customer_name?.toLowerCase().includes(term) ||
        (t.source_email_subject || '').toLowerCase().includes(term) ||
        (t.current_step || '').toLowerCase().includes(term),
    );
  }, [trades, searchText]);

  // Filtered AI inbox
  const filteredAiInbox = useMemo(() => {
    if (!searchText.trim()) return aiInboxItems;
    const q = searchText.toLowerCase();
    return aiInboxItems.filter(
      (item) =>
        (item.title || '').toLowerCase().includes(q) ||
        (item.subtitle || '').toLowerCase().includes(q) ||
        item.intent_label?.toLowerCase().includes(q),
    );
  }, [aiInboxItems, searchText]);

  // ---- Handlers ----

  const handleNewTrade = useCallback(() => {
    setWizardOpen(true);
  }, []);

  const handleItemClick = useCallback((item: UnifiedItem) => {
    if (item.source === 'ai-inbox' && item.raw) {
      const reviewItem = item.raw as PendingReviewItem;
      setDraftReviewItem((current) => (current?.id === reviewItem.id ? current : reviewItem));
      // Mark deep-link as handled so the effect doesn't double-fire
      deepLinkHandled.current = true;
      // Update URL for deep-linkable state
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('item', reviewItem.id);
        return next;
      });
    } else {
      setSelectedItem(item);
      setModalOpen(true);
    }
  }, [setSearchParams]);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setSelectedItem(null);
  }, []);

  const handleDraftReviewClose = useCallback(() => {
    setDraftReviewItem(null);
    // Reset deep-link guard so future deep-links work
    deepLinkHandled.current = false;
    // Remove ?item= from URL after close
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('item');
      return next;
    });
    // Invalidate AI reviews and related entity data (entities may have been created)
    queryClient.invalidateQueries({ queryKey: withTenantQueryKey('command-center-ai-reviews') });
    queryClient.invalidateQueries({ queryKey: withTenantQueryKey('command-center-trades') });
    queryClient.invalidateQueries({ queryKey: withTenantQueryKey('contacts') });
    queryClient.invalidateQueries({ queryKey: withTenantQueryKey('suppliers') });
    queryClient.invalidateQueries({ queryKey: withTenantQueryKey('customers') });
    queryClient.invalidateQueries({ queryKey: withTenantQueryKey('inquiries') });
    queryClient.invalidateQueries({ queryKey: withTenantQueryKey('purchase-orders') });
  }, [queryClient, setSearchParams]);

  // Deep link: ?item=xxx auto-opens that AI review item
  const deepLinkHandled = useRef(false);
  const deepLinkedItemId = searchParams.get('item');
  useEffect(() => {
    if (!deepLinkedItemId) {
      deepLinkHandled.current = false;
      return;
    }

    if (deepLinkHandled.current && draftReviewItem?.id === deepLinkedItemId) return;

    const reviews = reviewsQuery.data ?? [];
    const match = reviews.find((r: PendingReviewItem) => r.id === deepLinkedItemId);
    if (match) {
      deepLinkHandled.current = true;
      setDraftReviewItem((current) => (current?.id === match.id ? current : match));
    }
  }, [deepLinkedItemId, draftReviewItem?.id, reviewsQuery.data]);

  const handleNavigateToEntity = useCallback(() => {
    if (!selectedItem) return;
    if (selectedItem.entity_type && selectedItem.entity_id) {
      navigate(`/records/${selectedItem.entity_type}/${selectedItem.entity_id}`);
      handleModalClose();
    }
  }, [selectedItem, navigate, handleModalClose]);

  const handleFlowNodeClick = useCallback((entityType: string, entityId: string) => {
    const route = entityListPath(entityType);

    if (!entityId) {
      // Empty node — open quick-create modal for supported dependency types
      const depType = entityType === 'supplier_purchase_order' ? 'supplier'
        : entityType === 'carrier_purchase_order' ? 'supplier'
        : entityType === 'inquiry' ? undefined
        : (entityType as DependencyType | undefined);

      if (depType && ['supplier', 'customer', 'contact', 'plant'].includes(depType)) {
        setQuickCreateTarget({ entityType: depType as DependencyType });
        return;
      }
      // Fallback: navigate to creation page
      if (route) {
        navigate(`${route}?action=create`);
        handleModalClose();
      }
      return;
    }
    // Existing entity — navigate to record
    if (route) {
      navigate(`${route}?highlight=${entityId}`);
      handleModalClose();
    }
  }, [navigate, handleModalClose]);

  const handleRefreshAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: withTenantQueryKey('command-center-trades') });
    void queryClient.invalidateQueries({
      queryKey: withTenantQueryKey('command-center-ai-reviews'),
    });
  }, [queryClient]);

  const handleOpenWorkFormsMonitoring = useCallback(() => {
    navigate('/workforms/monitoring');
  }, [navigate]);

  const handleTabChange = useCallback(
    (value: string | number | undefined) => {
      if (!value) {
        return;
      }

      setActiveTab(value as HubTab);
    },
    [setActiveTab],
  );

  const hubTabOptions = useMemo(
    () => [
      {
        label: (
          <Space size={6}>
            <Sparkles size={13} />
            <span>Overview</span>
          </Space>
        ),
        value: 'overview',
      },
      {
        label: (
          <Space size={6}>
            <AlertCircle size={13} />
            <span>Action Required</span>
            {aiInboxItems.length > 0 && <Badge count={aiInboxItems.length} size="small" />}
          </Space>
        ),
        value: 'action-required',
      },
      {
        label: (
          <Space size={6}>
            <LayoutDashboard size={13} />
            <span>Live Pipeline</span>
            {tradeStats.active > 0 && <Badge count={tradeStats.active} size="small" />}
          </Space>
        ),
        value: 'pipeline',
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
    ],
    [aiInboxItems.length, tradeStats.active],
  );

  // ---- Keyboard Shortcuts ----
  useEffect(() => {
    const TAB_MAP: Record<string, HubTab> = {
      '1': 'overview',
      '2': 'action-required',
      '3': 'pipeline',
      '4': 'history',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        // Allow Escape to blur from search
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
          e.preventDefault();
        }
        return;
      }

      // Alt+1 through Alt+4: Switch tabs
      if (e.altKey && TAB_MAP[e.key]) {
        e.preventDefault();
        setActiveTab(TAB_MAP[e.key]);
        return;
      }

      // n: New Trade
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleNewTrade();
        return;
      }

      // r: Refresh
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleRefreshAll();
        return;
      }

    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab, handleNewTrade, handleRefreshAll]);

  // Advance trade mutation
  const { mutate: advanceTrade, isPending: isAdvancePending } = useMutation({
    mutationFn: (tradeSessionId: string) => traderService.advanceTrade(tradeSessionId),
    onSuccess: (result) => {
      if (result.completed) {
        message.success('Trade completed!');
      } else if (result.blocked) {
        message.info(`Trade blocked: ${result.blocked_reason}`);
      } else {
        message.success(`Advanced to: ${STEP_LABELS[result.current_step] || result.current_step}`);
      }
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey('command-center-trades') });
    },
    onError: () => {
      message.error('Failed to advance trade');
    },
  });

  // Trade table columns
  const tradeColumns = useMemo<ColumnsType<TradeSession>>(
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
              advanceTrade(record.id);
            }}
            loading={isAdvancePending}
          >
            Advance
          </Button>
        ),
      },
    ],
    [advanceTrade, isAdvancePending],
  );

  const workflowRedirectSearch = useMemo(() => {
    if (requestedTab !== 'workflows') {
      return '';
    }

    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    const query = next.toString();
    return query ? `?${query}` : '';
  }, [requestedTab, searchParams]);

  // ============================================================================
  // Render
  // ============================================================================

  if (requestedTab === 'workflows') {
    return <Navigate to={`/workforms/monitoring${workflowRedirectSearch}`} replace />;
  }

  return (
    <OperatorShell role="main" aria-label="AI Command Center">
      {/* Header */}
      <OperatorHeader
        title={(
          <Title level={3} style={{ marginBottom: 0, fontWeight: 800 }}>
            ⚡ Command Center
          </Title>
        )}
        subtitle="Primary operator queue for action-required work, live trades, and daily oversight. Use WorkForms Monitoring for execution drill-ins."
        actions={(
          <>
            <Input
              placeholder="Search command center…"
              prefix={<Search size={14} />}
              value={searchText}
              onChange={(e) => updateSearchText(e.target.value)}
              style={{ width: 220, borderRadius: 10 }}
              allowClear
              aria-label="Search command center"
            />
            <Tooltip title="Refresh all (R)">
              <Button
                icon={<RefreshCw size={14} />}
                onClick={handleRefreshAll}
                loading={tradesQuery.isFetching || reviewsQuery.isFetching}
                style={{ borderRadius: 10 }}
                aria-label="Refresh all data"
              />
            </Tooltip>
          </>
        )}
      />

      {/* Quick Actions */}
      <OperatorActionRow role="toolbar" aria-label="Quick actions">
        <Tooltip title="N">
          <QuickActionButton
            type="primary"
            icon={<Plus size={15} />}
            onClick={handleNewTrade}
          >
            New Trade
          </QuickActionButton>
        </Tooltip>
        <Tooltip title="AI will suggest the best next actions based on your pipeline">
          <QuickActionButton
            icon={<Sparkles size={15} />}
            onClick={() => {
              setActiveTab('overview');
              // Scroll to AI proposals section after tab switch
              setTimeout(() => {
                document.getElementById('ai-proposals-section')?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
          >
            AI Suggestions
          </QuickActionButton>
        </Tooltip>
        <QuickActionButton
          icon={<Workflow size={15} />}
          onClick={handleOpenWorkFormsMonitoring}
        >
          Execution Monitoring
        </QuickActionButton>
        {aiInboxItems.length > 0 && (
          <QuickActionButton
            icon={<Mail size={15} />}
            onClick={() => setActiveTab('action-required')}
          >
            AI Inbox
            <Badge
              count={aiInboxItems.length}
              size="small"
              style={{ marginLeft: 6 }}
            />
          </QuickActionButton>
        )}
      </OperatorActionRow>

      {/* Tab Navigation */}
      <OperatorTabBar
        value={activeTab}
        onChange={handleTabChange}
        options={hubTabOptions}
        ariaLabel="Command center sections"
      />

      {/* ======== Overview Tab ======== */}
      {activeTab === 'overview' && (
        <>
          {/* KPIs */}
          <StatCardGrid items={[
            { value: tradeStats.total, label: 'Total Trades', icon: <Activity size={11} /> },
            { value: tradeStats.active, label: 'In Progress', icon: <TrendingUp size={11} /> },
            { value: tradeStats.blocked, label: 'Blocked', icon: <AlertTriangle size={11} />, alert: true },
            { value: aiInboxItems.length, label: 'AI Inbox', icon: <Mail size={11} /> },
          ]} />

          {/* AI Proposals */}
          <div id="ai-proposals-section">
            <ErrorBoundary fallbackMessage="AI proposals could not be loaded.">
              <AITradeProposals
                onProposalExecuted={() => {
                  queryClient.invalidateQueries({ queryKey: withTenantQueryKey('command-center-trades') });
                  setActiveTab('pipeline');
                }}
              />
            </ErrorBoundary>
          </div>

          <CockpitPanel
            title="Execution Drill-In"
            extra={(
              <Button type="link" size="small" onClick={handleOpenWorkFormsMonitoring}>
                Open monitoring →
              </Button>
            )}
          >
            <Text type="secondary">
              WorkForms Monitoring is the dedicated drill-in for active executions,
              run analytics, and step-level follow-through.
            </Text>
          </CockpitPanel>

          {/* Needs Attention preview */}
          {tradeStats.blocked > 0 && (
            <CockpitPanel
              title="Blocked Trades"
              extra={
                <Button type="link" size="small" onClick={() => setActiveTab('pipeline')}>
                  View all →
                </Button>
              }
            >
              <Table
                aria-label="Halted trades requiring attention"
                rowKey="id"
                columns={tradeColumns}
                dataSource={trades.filter((t) => t.status === 'halted').slice(0, 3)}
                pagination={false}
                size="small"
                showHeader={false}
                onRow={(record) => ({
                  onClick: () => setSelectedTrade(record),
                  style: { cursor: 'pointer' },
                })}
                locale={{ emptyText: <Text type="secondary">All clear</Text> }}
              />
            </CockpitPanel>
          )}

          {/* AI Inbox preview */}
          {aiInboxItems.length > 0 && (
            <CockpitPanel
              title="Recent AI Inbox"
              extra={
                <Button type="link" size="small" onClick={() => setActiveTab('action-required')}>
                  View all ({aiInboxItems.length}) →
                </Button>
              }
            >
              <CardList>
                {aiInboxItems.slice(0, 3).map((item) => (
                  <ItemCard
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleItemClick(item)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleItemClick(item); } }}
                    aria-label={`${item.title} – ${item.statusLabel ?? 'pending'}`}
                  >
                    <ItemIcon $variant={getStatusVariant(item.status)}>
                      {getIconForSource(item.icon)}
                    </ItemIcon>
                    <ItemContent>
                      <ItemTitle>{item.title}</ItemTitle>
                      <ItemMeta>
                        <StatusPill $variant={getStatusVariant(item.status)}>
                          {item.statusLabel}
                        </StatusPill>
                        {item.intent_label && (
                          <span style={{ fontWeight: 500, color: 'rgb(var(--color-primary))' }}>
                            🎯 {item.intent_label}
                          </span>
                        )}
                        {item.timestamp && <span>• {formatTimeAgo(item.timestamp)}</span>}
                      </ItemMeta>
                    </ItemContent>
                    <ChevronRight size={16} style={{ color: 'rgb(var(--color-text-secondary))' }} />
                  </ItemCard>
                ))}
              </CardList>
            </CockpitPanel>
          )}
        </>
      )}

      {/* ======== Action Required Tab ======== */}
      {activeTab === 'action-required' && (
        <>
          {reviewsQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : reviewsQuery.isError ? (
            <Alert
              type="error"
              message="Failed to load AI inbox items"
              description={reviewsQuery.error instanceof Error ? reviewsQuery.error.message : 'Unknown error'}
              showIcon
              action={<Button size="small" onClick={() => reviewsQuery.refetch()}>Retry</Button>}
            />
          ) : filteredAiInbox.length === 0 ? (
            <EmptyState>
              <CheckCircle2 size={32} strokeWidth={1.5} />
              <span>Operator queue is clear.</span>
              <EmptySubtext>
                No items need attention right now. Use WorkForms Monitoring for active
                execution details and step-level drill-ins.
              </EmptySubtext>
              <Button onClick={handleOpenWorkFormsMonitoring} style={{ borderRadius: 10 }}>
                Open WorkForms Monitoring
              </Button>
            </EmptyState>
          ) : (
            <CardList>
              {filteredAiInbox.map((item) => (
                <ItemCard
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleItemClick(item)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleItemClick(item); } }}
                  aria-label={`${item.title} – ${item.statusLabel}`}
                >
                  <ItemIcon $variant={getStatusVariant(item.status)}>
                    {getIconForSource(item.icon)}
                  </ItemIcon>
                  <ItemContent>
                    <ItemTitle>{item.title}</ItemTitle>
                    <ItemMeta>
                      <StatusPill $variant={getStatusVariant(item.status)}>
                        {item.statusLabel}
                      </StatusPill>
                      {item.intent_label && (
                        <span style={{ fontWeight: 500, color: 'rgb(var(--color-primary))' }}>
                          🎯 {item.intent_label}
                        </span>
                      )}
                      {item.confidence != null && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: item.confidence >= 0.8
                            ? 'rgba(var(--color-success), 0.1)'
                            : item.confidence >= 0.5
                              ? 'rgba(var(--color-warning), 0.1)'
                              : 'rgba(var(--color-error), 0.1)',
                          color: item.confidence >= 0.8
                            ? 'rgb(var(--color-success))'
                            : item.confidence >= 0.5
                              ? 'rgb(var(--color-warning))'
                              : 'rgb(var(--color-error))',
                        }}>
                          {Math.round(item.confidence * 100)}%
                        </span>
                      )}
                      {item.subtitle && <span style={{ fontSize: 11 }}>{item.subtitle}</span>}
                      {item.timestamp && <span>• {formatTimeAgo(item.timestamp)}</span>}
                    </ItemMeta>
                  </ItemContent>
                  <SourceTag>AI</SourceTag>
                  <ChevronRight size={16} style={{ color: 'rgb(var(--color-text-secondary))', flexShrink: 0 }} />
                </ItemCard>
              ))}
            </CardList>
          )}
        </>
      )}

      {/* ======== Live Pipeline Tab ======== */}
      {activeTab === 'pipeline' && (
        <CockpitPanel
          title="Active Trades"
          extra={<Text type="secondary" style={{ fontSize: '0.72rem' }}>{filteredTrades.length} trades</Text>}
        >
          {tradesQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : tradesQuery.isError ? (
            <Alert
              type="error"
              message="Failed to load trades"
              description={tradesQuery.error instanceof Error ? tradesQuery.error.message : 'Unknown error'}
              showIcon
              action={<Button size="small" onClick={() => tradesQuery.refetch()}>Retry</Button>}
            />
          ) : filteredTrades.length > 0 ? (
            <Table
              aria-label="Active trades"
              rowKey="id"
              columns={tradeColumns}
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

      {/* ======== History Tab ======== */}
      {activeTab === 'history' && (
        <CockpitPanel title="Completed Trades">
          {trades.filter((t) => t.status === 'completed').length > 0 ? (
            <Table
              aria-label="Completed trades history"
              rowKey="id"
              columns={tradeColumns.filter((c) => c.key !== 'actions')}
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

      {/* ======== Modals ======== */}

      {/* Smart Trade Creator */}
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
            queryClient.invalidateQueries({ queryKey: withTenantQueryKey('command-center-trades') });
            setActiveTab('pipeline');
            message.success('Trade pipeline started!');
          }}
          onCancel={() => setWizardOpen(false)}
        />
      </WizardModal>

      {/* Trade Detail Modal */}
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
                if (selectedTrade) advanceTrade(selectedTrade.id);
              }}
              loading={isAdvancePending}
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
            {selectedTrade.source_email_subject && (
              <Text type="secondary" style={{ fontSize: '0.75rem', display: 'block', marginTop: 4 }}>
                Source: {selectedTrade.source_email_subject}
              </Text>
            )}
            <Text type="secondary" style={{ fontSize: '0.75rem' }}>
              Current Step: <strong>{STEP_LABELS[selectedTrade.current_step] || selectedTrade.current_step}</strong>
              {selectedTrade.initiated_at && (
                <> · Started {new Date(selectedTrade.initiated_at).toLocaleDateString()}</>
              )}
            </Text>
            {selectedTrade.inquiry_id && (
              <Button
                type="link"
                size="small"
                style={{ padding: 0, marginTop: 4, fontSize: '0.8rem' }}
                onClick={() => {
                  setSelectedTrade(null);
                  navigate(`/inquiries/${selectedTrade.inquiry_id}`);
                }}
              >
                View Related Inquiry →
              </Button>
            )}
          </DetailModalContent>
        )}
      </Modal>

      {/* Process/Action Item Detail Modal */}
      <Modal
        open={modalOpen && !!selectedItem}
        onCancel={handleModalClose}
        footer={null}
        width={1100}
        destroyOnHidden
        styles={{ body: { padding: '24px' } }}
      >
        {selectedItem && (
          <>
            <ModalHeader>
              <ItemIcon $variant={getStatusVariant(selectedItem.status)}>
                {getIconForSource(selectedItem.icon)}
              </ItemIcon>
              <ModalEntity>
                <ModalEntityTitle>{selectedItem.title}</ModalEntityTitle>
                <ModalEntityMeta>
                  <StatusPill $variant={getStatusVariant(selectedItem.status)}>
                    {selectedItem.statusLabel}
                  </StatusPill>
                  {selectedItem.intent_label && (
                    <span style={{ fontWeight: 500, color: 'rgb(var(--color-primary))' }}>
                      🎯 {selectedItem.intent_label}
                    </span>
                  )}
                  {selectedItem.contact_name && (
                    <span>
                      <User size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                      {selectedItem.contact_name}
                    </span>
                  )}
                  {selectedItem.timestamp && <span>• {formatTimeAgo(selectedItem.timestamp)}</span>}
                </ModalEntityMeta>
              </ModalEntity>
              {selectedItem.entity_type && selectedItem.entity_id && (
                <Tooltip title="Open full record">
                  <button
                    onClick={handleNavigateToEntity}
                    style={{
                      background: 'none',
                      border: '1px solid rgb(var(--color-border))',
                      borderRadius: 6,
                      padding: '6px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      color: 'rgb(var(--color-text-primary))',
                    }}
                  >
                    <ExternalLink size={14} /> Open
                  </button>
                </Tooltip>
              )}
            </ModalHeader>

            {selectedItem.inquiry_id && (
              <ModalSection>
                <ModalSectionTitle>Process Flow</ModalSectionTitle>
                <ProcessFlowHeader inquiryId={selectedItem.inquiry_id} />
                <div style={{ marginTop: 12 }}>
                  <TradeLineageFlow
                    inquiryId={selectedItem.inquiry_id}
                    onNodeClick={handleFlowNodeClick}
                    compact
                  />
                </div>
              </ModalSection>
            )}

            <ModalSection>
              <ModalSectionTitle>Details</ModalSectionTitle>
              <MetaGrid>
                <MetaItem>
                  <MetaLabel>Type</MetaLabel>
                  <MetaValue>{selectedItem.entity_type?.replace(/_/g, ' ') || selectedItem.source}</MetaValue>
                </MetaItem>
                <MetaItem>
                  <MetaLabel>Status</MetaLabel>
                  <MetaValue>
                    <StatusPill $variant={getStatusVariant(selectedItem.status)}>
                      {selectedItem.statusLabel}
                    </StatusPill>
                  </MetaValue>
                </MetaItem>
                {selectedItem.confidence != null && (
                  <MetaItem>
                    <MetaLabel>AI Confidence</MetaLabel>
                    <MetaValue>{Math.round(selectedItem.confidence * 100)}%</MetaValue>
                  </MetaItem>
                )}
              </MetaGrid>
            </ModalSection>

            {selectedItem.entity_type && selectedItem.entity_id && (
              <ModalSection>
                <ModalSectionTitle>Quick Actions</ModalSectionTitle>
                <ProcessQuickActions
                  entityType={selectedItem.entity_type}
                  entityId={selectedItem.entity_id}
                  entityStatus={selectedItem.status}
                  inquiryId={selectedItem.inquiry_id}
                  compact={false}
                />
              </ModalSection>
            )}
          </>
        )}
      </Modal>

      {/* AI Draft Review Modal */}
      {draftReviewItem && (
        <AIDraftReviewModal
          open={!!draftReviewItem}
          item={draftReviewItem}
          onClose={handleDraftReviewClose}
          onResolved={handleDraftReviewClose}
        />
      )}

      {/* Quick Create Modal for empty flow nodes */}
      {quickCreateTarget && (
        <MissingDependencyQuickCreate
          open
          entityType={quickCreateTarget.entityType}
          suggestedName={quickCreateTarget.suggestedName}
          onCreated={handleQuickCreateCreated}
          onClose={handleQuickCreateClose}
        />
      )}

      {/* Keyboard shortcut hint bar */}
      <ShortcutHintBar aria-label="Keyboard shortcuts">
        <kbd>/</kbd> Search
        <span className="separator">•</span>
        <kbd>N</kbd> New Trade
        <span className="separator">•</span>
        <kbd>R</kbd> Refresh
        <span className="separator">•</span>
        <kbd>Alt+1‑4</kbd> Switch Tab
      </ShortcutHintBar>
    </OperatorShell>
  );
};

export default AICommandCenter;
export { AICommandCenter };
