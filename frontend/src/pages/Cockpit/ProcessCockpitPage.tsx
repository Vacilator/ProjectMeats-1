/**
 * Process Cockpit — World-Class Command Center
 *
 * Complete overhaul: simplified 3-tab layout with modal-based detail views.
 * Inspired by Linear.app + modern trading platforms.
 *
 * Tabs: All Processes • Action Required • Completed
 * Pattern: Card list → click → generous modal (no split panels)
 *
 * Additive only — replaces the previous 6-tab layout.
 */
import React, { useMemo, useState, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { Input, Modal, Tooltip } from 'antd';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Workflow,
  Mail,
  FileEdit,
  History,
  ClipboardList,
  Search,
  RefreshCw,
  Activity,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  User,
  ExternalLink,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { ProcessQuickActions } from '../../components/Cockpit/ProcessQuickActions';
import { TradeLineageFlow } from '../../components/Cockpit/TradeLineageFlow';
import { ProcessFlowHeader } from '../../components/Cockpit/ProcessFlowHeader';
import { businessApi } from '../../services/businessApi';
import { workflowExecutionService } from '../../services/workflowExecutionService';
import { tradeExceptionQueueService } from '../../services/tradeExceptionQueueService';
import { aiStaffApi } from '../../services/aiService';
import type { PendingReviewItem } from '../../services/aiService';
import { useNotifications } from '../../contexts/NotificationsContext';
import type { ActionItem } from '../../contexts/NotificationsContext';
import { withTenantQueryKey } from '../../utils/queryKeys';
import { getValidTenantId } from '../../utils/tenantId';
import AIDraftReviewModal from '../../components/AIAssistant/AIDraftReviewModal';

// ============================================================================
// Types
// ============================================================================

type CockpitTab = 'all' | 'action-required' | 'completed';

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
  raw?: unknown;
}

// ============================================================================
// Styled Components — Premium Layout
// ============================================================================

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

const PageContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 32px 48px;
  min-height: calc(100vh - 64px);
`;

const PageHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;
  flex-wrap: wrap;
`;

const PageTitle = styled.h1`
  font-size: 22px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const SyncChip = styled.div<{ $syncing?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  padding: 4px 10px;
  border-radius: 999px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  white-space: nowrap;
`;

const SearchBar = styled.div`
  flex: 1;
  max-width: 400px;
`;

const TabBar = styled.nav`
  display: flex;
  gap: 2px;
  padding: 3px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  margin-bottom: 20px;
`;

const Tab = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  background: ${(p) => (p.$active ? 'rgb(var(--color-surface))' : 'transparent')};
  color: ${(p) => (p.$active ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-secondary))')};
  box-shadow: ${(p) => (p.$active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none')};

  &:hover {
    background: ${(p) => (p.$active ? 'rgb(var(--color-surface))' : 'rgba(var(--color-border), 0.5)')};
    color: rgb(var(--color-text-primary));
  }
`;

const TabBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  background: rgb(var(--color-error));
  color: white;
`;

const CardList = styled.div`
  display: flex;
  flex-direction: column;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;
  animation: ${fadeIn} 0.2s ease;
`;

const ItemCard = styled.div.attrs({ role: 'button', tabIndex: 0 })`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  border-bottom: 1px solid rgb(var(--color-border));
  cursor: pointer;
  transition: background 0.1s ease;

  &:hover,
  &:focus-visible {
    background: rgba(var(--color-border), 0.25);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: -2px;
  }

  &:last-child {
    border-bottom: none;
  }
`;

const ItemIcon = styled.div<{ $variant: string }>`
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  ${(p) => {
    switch (p.$variant) {
      case 'success':
        return 'background: rgba(var(--color-success), 0.1); color: rgb(var(--color-success));';
      case 'warning':
        return 'background: rgba(var(--color-warning), 0.1); color: rgb(var(--color-warning));';
      case 'error':
        return 'background: rgba(var(--color-error), 0.1); color: rgb(var(--color-error));';
      case 'info':
      default:
        return 'background: rgba(var(--color-info), 0.1); color: rgb(var(--color-info));';
    }
  }}
`;

const ItemContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ItemTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ItemMeta = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const StatusPill = styled.span<{ $variant: string }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  ${({ $variant }) => {
    switch ($variant) {
      case 'success':
        return 'background: rgba(var(--color-success), 0.1); color: rgb(var(--color-success));';
      case 'warning':
        return 'background: rgba(var(--color-warning), 0.1); color: rgb(var(--color-warning));';
      case 'error':
        return 'background: rgba(var(--color-error), 0.1); color: rgb(var(--color-error));';
      case 'info':
      default:
        return 'background: rgba(var(--color-info), 0.1); color: rgb(var(--color-info));';
    }
  }}
`;

const SourceTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(var(--color-border), 0.4);
  color: rgb(var(--color-text-secondary));
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
  gap: 12px;
  padding: 40px;
  text-align: center;
`;

const EmptySubtext = styled.span`
  font-size: 12px;
  opacity: 0.7;
  max-width: 300px;
`;

// Modal styled components
const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
`;

const ModalEntity = styled.div`
  flex: 1;
`;

const ModalEntityTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const ModalEntityMeta = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ModalSection = styled.div`
  margin-bottom: 20px;
`;

const ModalSectionTitle = styled.h4`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px;
`;

const MetaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
`;

const MetaItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const MetaLabel = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const MetaValue = styled.span`
  font-size: 14px;
  color: rgb(var(--color-text-primary));
`;

// ============================================================================
// Helpers
// ============================================================================

function getStatusVariant(status: string): string {
  const s = status?.toLowerCase() ?? '';
  if (['completed', 'approved', 'resolved', 'done'].some((v) => s.includes(v))) return 'success';
  if (['failed', 'halted', 'error', 'rejected', 'overdue'].some((v) => s.includes(v))) return 'error';
  if (['pending', 'draft', 'waiting', 'review'].some((v) => s.includes(v))) return 'warning';
  return 'info';
}

function getIconForSource(icon: UnifiedItem['icon']) {
  switch (icon) {
    case 'mail':
      return <Mail size={18} />;
    case 'task':
      return <ClipboardList size={18} />;
    case 'alert':
      return <AlertTriangle size={18} />;
    case 'draft':
      return <FileEdit size={18} />;
    case 'workflow':
    default:
      return <Workflow size={18} />;
  }
}

function formatTimeAgo(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ============================================================================
// Main Component
// ============================================================================

const ProcessCockpitPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getValidTenantId();

  const activeTab = (searchParams.get('view') || searchParams.get('tab') || 'all') as CockpitTab;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<UnifiedItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftReviewItem, setDraftReviewItem] = useState<PendingReviewItem | null>(null);

  const { actionItems, fetchActionItems } = useNotifications();

  // ---------- Data Fetching ----------

  // Recent inquiries (all processes)
  const { data: inquiryData, dataUpdatedAt } = useQuery({
    queryKey: withTenantQueryKey('cockpit-all-processes'),
    queryFn: async () => {
      const res = await businessApi.get('/inquiries/', {
        params: { ordering: '-modified_on', page_size: 50 },
      });
      return res.data?.results ?? res.data ?? [];
    },
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });

  // Workflow executions
  const { data: executionData } = useQuery({
    queryKey: withTenantQueryKey('cockpit-executions'),
    queryFn: () => workflowExecutionService.getExecutions({ page_size: 50 }),
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });

  // AI Inbox pending reviews
  const { data: aiReviews } = useQuery({
    queryKey: withTenantQueryKey('cockpit-ai-reviews'),
    queryFn: () => aiStaffApi.listPendingReviews(),
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  // Draft forms
  const { data: draftsData } = useQuery({
    queryKey: withTenantQueryKey('cockpit-drafts'),
    queryFn: async () => {
      const res = await businessApi.get('/ai-assistant/cockpit-drafts/', {
        params: { status: 'pending' },
      });
      return res.data?.results ?? res.data ?? [];
    },
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  // Interventions count
  const { data: interventionData } = useQuery({
    queryKey: withTenantQueryKey('cockpit-interventions'),
    queryFn: () => tradeExceptionQueueService.listExceptions({ page_size: 100 }),
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  // ---------- Normalize into UnifiedItem[] ----------

  const allProcesses: UnifiedItem[] = useMemo(() => {
    const items: UnifiedItem[] = [];
    const rawInquiries = Array.isArray(inquiryData) ? inquiryData : [];
    for (const inq of rawInquiries) {
      items.push({
        id: `inq-${inq.id}`,
        source: 'process',
        icon: 'workflow',
        title: `${inq.inquiry_number || inq.id?.slice(0, 8)} — ${inq.customer_name || inq.supplier_name || 'Trade'}`,
        subtitle: inq.contact_name ? `Contact: ${inq.contact_name}` : '',
        status: inq.status || 'pending',
        statusLabel: (inq.status || 'pending').replace(/_/g, ' '),
        timestamp: inq.modified_on || inq.created_on || '',
        entity_type: 'inquiry',
        entity_id: inq.id,
        inquiry_id: inq.id,
        contact_name: inq.contact_name,
        department: inq.department,
        raw: inq,
      });
    }

    const execResults = executionData?.results ?? [];
    for (const exec of execResults) {
      if (items.some((i) => i.entity_id === exec.id)) continue;
      items.push({
        id: `exec-${exec.id}`,
        source: 'process',
        icon: 'workflow',
        title: exec.workflow_name || `Workflow ${exec.id.slice(0, 8)}`,
        subtitle: exec.current_step_name ? `Step: ${exec.current_step_name}` : '',
        status: exec.status || 'in_progress',
        statusLabel: (exec.status || 'in_progress').replace(/_/g, ' '),
        timestamp: exec.updated_at || exec.created_at || '',
        entity_type: 'workflow_execution',
        entity_id: exec.id,
        raw: exec,
      });
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items;
  }, [inquiryData, executionData]);

  const actionRequiredItems: UnifiedItem[] = useMemo(() => {
    const items: UnifiedItem[] = [];

    // AI Inbox items
    const reviews = Array.isArray(aiReviews) ? aiReviews : [];
    for (const review of reviews) {
      const reviewAny = review as PendingReviewItem & {
        attachment_count?: number;
        created_on?: string;
        created_at?: string;
        confidence_score?: number;
      };
      const fileCountLabel = reviewAny.attachment_count && reviewAny.attachment_count > 0
        ? `${reviewAny.attachment_count} file(s)`
        : null;
      items.push({
        id: `ai-${review.id}`,
        source: 'ai-inbox',
        icon: 'mail',
        title: review.source_subject || review.source_document_name || 'Email Review',
        subtitle: [
          review.sender && `From: ${review.sender}`,
          review.intent_label && `Intent: ${review.intent_label}`,
          fileCountLabel,
        ]
          .filter(Boolean)
          .join(' • '),
        status: 'review',
        statusLabel: 'Needs Review',
        timestamp: reviewAny.created_on || reviewAny.created_at || '',
        confidence: reviewAny.confidence_score,
        raw: review,
      });
    }

    // Operational tasks
    for (const task of actionItems) {
      items.push({
        id: `task-${task.id}`,
        source: 'task',
        icon: 'task',
        title: task.title,
        subtitle: [
          task.form_name && `Form: ${task.form_name}`,
          task.step_name && `Step: ${task.step_name}`,
        ]
          .filter(Boolean)
          .join(' • '),
        status: task.is_overdue ? 'overdue' : task.status,
        statusLabel: task.is_overdue ? 'Overdue' : task.status.replace(/_/g, ' '),
        timestamp: task.assigned_at || '',
        entity_type: task.entity_type,
        entity_id: task.entity_id || task.submission_id,
        raw: task,
      });
    }

    // Interventions
    const exceptions = interventionData?.results ?? [];
    for (const exc of exceptions) {
      items.push({
        id: `int-${exc.id}`,
        source: 'intervention',
        icon: 'alert',
        title: `${exc.reason_code || 'Trade Exception'} — ${exc.failed_step || exc.trade_id}`,
        subtitle: exc.error_message || '',
        status: 'intervention',
        statusLabel: 'Intervention Required',
        timestamp: exc.created_on || exc.modified_on || '',
        entity_type: exc.entity_type,
        entity_id: exc.entity_id,
        raw: exc,
      });
    }

    // Drafts
    const draftList = Array.isArray(draftsData) ? draftsData : [];
    for (const draft of draftList) {
      items.push({
        id: `draft-${draft.id}`,
        source: 'draft',
        icon: 'draft',
        title:
          (draft.form_type?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Draft Form') +
          (draft.form_data?.po_number ? ` — ${draft.form_data.po_number}` : ''),
        subtitle: draft.form_data?.supplier_name ? `From: ${draft.form_data.supplier_name}` : '',
        status: 'draft',
        statusLabel: 'Draft',
        timestamp: draft.created_on || '',
        raw: draft,
      });
    }

    // Sort: overdue first, then by timestamp desc
    items.sort((a, b) => {
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (b.status === 'overdue' && a.status !== 'overdue') return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return items;
  }, [aiReviews, actionItems, interventionData, draftsData]);

  const completedItems: UnifiedItem[] = useMemo(() => {
    return allProcesses.filter((item) =>
      ['completed', 'approved', 'resolved', 'done', 'cancelled'].includes(item.status?.toLowerCase()),
    );
  }, [allProcesses]);

  const activeProcesses: UnifiedItem[] = useMemo(() => {
    return allProcesses.filter(
      (item) => !['completed', 'approved', 'resolved', 'done', 'cancelled'].includes(item.status?.toLowerCase()),
    );
  }, [allProcesses]);

  // Sync indicator
  const lastSynced = useMemo(() => {
    if (!dataUpdatedAt) return 'Never';
    return formatTimeAgo(new Date(dataUpdatedAt).toISOString());
  }, [dataUpdatedAt]);

  // Action required count for badge
  const actionCount = actionRequiredItems.length;

  // ---------- Handlers ----------

  const handleTabChange = useCallback(
    (tab: CockpitTab) => {
      const next = new URLSearchParams(searchParams);
      next.set('view', tab);
      next.delete('tab');
      setSearchParams(next);
      setSelectedItem(null);
    },
    [searchParams, setSearchParams],
  );

  const handleItemClick = useCallback((item: UnifiedItem) => {
    if (item.source === 'ai-inbox') {
      setDraftReviewItem(item.raw as PendingReviewItem);
      return;
    }
    setSelectedItem(item);
    setModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setSelectedItem(null);
  }, []);

  const handleDraftReviewClose = useCallback(() => {
    setDraftReviewItem(null);
    queryClient.invalidateQueries({ queryKey: withTenantQueryKey('cockpit-ai-reviews') });
    queryClient.invalidateQueries({ queryKey: withTenantQueryKey('cockpit-drafts') });
    fetchActionItems();
  }, [queryClient, fetchActionItems]);

  const handleNavigateToEntity = useCallback(() => {
    if (!selectedItem) return;
    if (selectedItem.entity_type && selectedItem.entity_id) {
      navigate(`/records/${selectedItem.entity_type}/${selectedItem.entity_id}`);
      handleModalClose();
    }
  }, [selectedItem, navigate, handleModalClose]);

  // ---------- Filtering ----------

  const getFilteredItems = useCallback(
    (items: UnifiedItem[]) => {
      if (!searchQuery) return items;
      const q = searchQuery.toLowerCase();
      return items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.statusLabel.toLowerCase().includes(q) ||
          item.contact_name?.toLowerCase().includes(q),
      );
    },
    [searchQuery],
  );

  const currentItems = useMemo(() => {
    switch (activeTab) {
      case 'action-required':
        return getFilteredItems(actionRequiredItems);
      case 'completed':
        return getFilteredItems(completedItems);
      case 'all':
      default:
        return getFilteredItems(activeProcesses);
    }
  }, [activeTab, activeProcesses, actionRequiredItems, completedItems, getFilteredItems]);

  // ---------- Render ----------

  const renderEmptyState = () => {
    switch (activeTab) {
      case 'action-required':
        return (
          <EmptyState>
            <CheckCircle2 size={32} strokeWidth={1.5} />
            <span>You're all caught up!</span>
            <EmptySubtext>No items require your attention right now.</EmptySubtext>
          </EmptyState>
        );
      case 'completed':
        return (
          <EmptyState>
            <History size={32} strokeWidth={1.5} />
            <span>No completed processes yet</span>
            <EmptySubtext>Completed workflows and inquiries will appear here.</EmptySubtext>
          </EmptyState>
        );
      default:
        return (
          <EmptyState>
            <Workflow size={32} strokeWidth={1.5} />
            <span>No active processes</span>
            <EmptySubtext>Start a new workflow from the WorkForms catalog.</EmptySubtext>
          </EmptyState>
        );
    }
  };

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>
          <Activity size={20} />
          Process Monitor
        </PageTitle>
        <SearchBar>
          <Input
            prefix={<Search size={14} />}
            placeholder="Search processes, POs, suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            size="middle"
            style={{ borderRadius: 8 }}
          />
        </SearchBar>
        <HeaderRight>
          <SyncChip>
            <RefreshCw size={12} />
            <span>Synced {lastSynced}</span>
          </SyncChip>
        </HeaderRight>
      </PageHeader>

      <TabBar>
        <Tab $active={activeTab === 'all'} onClick={() => handleTabChange('all')}>
          <Workflow size={15} /> All Processes
          {activeProcesses.length > 0 && (
            <span style={{ fontSize: 11, opacity: 0.6 }}>({activeProcesses.length})</span>
          )}
        </Tab>
        <Tab $active={activeTab === 'action-required'} onClick={() => handleTabChange('action-required')}>
          <AlertCircle size={15} /> Action Required
          {actionCount > 0 && <TabBadge>{actionCount}</TabBadge>}
        </Tab>
        <Tab $active={activeTab === 'completed'} onClick={() => handleTabChange('completed')}>
          <CheckCircle2 size={15} /> Completed
        </Tab>
      </TabBar>

      {currentItems.length === 0 ? (
        renderEmptyState()
      ) : (
        <CardList>
          {currentItems.map((item) => (
            <ItemCard
              key={item.id}
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
                  {item.subtitle && <span>{item.subtitle}</span>}
                  {item.timestamp && <span>• {formatTimeAgo(item.timestamp)}</span>}
                </ItemMeta>
              </ItemContent>
              <SourceTag>
                {item.source === 'ai-inbox'
                  ? 'AI'
                  : item.source === 'intervention'
                    ? 'Alert'
                    : item.source === 'draft'
                      ? 'Draft'
                      : item.source === 'task'
                        ? 'Task'
                        : ''}
              </SourceTag>
              <ChevronRight size={16} style={{ color: 'rgb(var(--color-text-secondary))', flexShrink: 0 }} />
            </ItemCard>
          ))}
        </CardList>
      )}

      {/* Detail Modal — generous 1100px */}
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
                  {selectedItem.contact_name && (
                    <span>
                      <User size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                      {selectedItem.contact_name}
                    </span>
                  )}
                  {selectedItem.department && <span>• {selectedItem.department}</span>}
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

            {/* Process Flow Visualization */}
            {selectedItem.inquiry_id && (
              <ModalSection>
                <ModalSectionTitle>Process Flow</ModalSectionTitle>
                <ProcessFlowHeader inquiryId={selectedItem.inquiry_id} />
                <div style={{ marginTop: 12 }}>
                  <TradeLineageFlow inquiryId={selectedItem.inquiry_id} compact />
                </div>
              </ModalSection>
            )}

            {/* Key Details */}
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
                {selectedItem.contact_name && (
                  <MetaItem>
                    <MetaLabel>Contact</MetaLabel>
                    <MetaValue>{selectedItem.contact_name}</MetaValue>
                  </MetaItem>
                )}
                {selectedItem.department && (
                  <MetaItem>
                    <MetaLabel>Department</MetaLabel>
                    <MetaValue>{selectedItem.department}</MetaValue>
                  </MetaItem>
                )}
                {selectedItem.confidence != null && (
                  <MetaItem>
                    <MetaLabel>AI Confidence</MetaLabel>
                    <MetaValue>{Math.round(selectedItem.confidence * 100)}%</MetaValue>
                  </MetaItem>
                )}
              </MetaGrid>
            </ModalSection>

            {/* Quick Actions */}
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

      {/* AI Draft Review Modal (reuse existing) */}
      {draftReviewItem && (
        <AIDraftReviewModal
          open={!!draftReviewItem}
          item={draftReviewItem}
          onClose={handleDraftReviewClose}
          onResolved={handleDraftReviewClose}
        />
      )}
    </PageContainer>
  );
};

export default ProcessCockpitPage;
export { ProcessCockpitPage };
