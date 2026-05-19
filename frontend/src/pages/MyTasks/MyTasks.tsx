/**
 * MyTasks — Unified Task Inbox
 *
 * Industry-leading task management UI inspired by Linear, Asana & Notion.
 * Two focused categories:
 *   1. Action Required — tasks YOU must act on right now
 *   2. AI Inbox       — AI-generated drafts awaiting human review
 *
 * Minimal chrome. Every pixel earns its place.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import dayjs from 'dayjs';
import styled, { css, keyframes } from 'styled-components';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tag, Select, message, Tooltip } from 'antd';
import { showAlert } from '@/utils/uiDialogs';
import { logger } from '@/utils/logger';
import { useNotifications, ActionItem } from '../../contexts/NotificationsContext';
import { DelegateTaskModal, DelegationData } from '../../components/Delegation';
import AIDraftReviewDialog from '../../components/AIAssistant/AIDraftReviewDialog';
import {
  type AIInboxFeedbackSubmission,
} from '../../components/AIAssistant/AIInboxFeedbackActions';
import {
  AI_INBOX_REFRESH_EVENT,
  aiStaffApi,
  aiFeedbackApi,
  PendingReviewItem,
} from '../../services/aiService';
import { StatusActionCell } from '@/components/Workflow';
import { PendingApprovalsTab } from '@/components/Workflow/PendingApprovalsTab';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { compareTasksSmart, isAtRiskTask } from '../../utils/taskPrioritization';

/* ─── constants ─── */
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'var(--color-error)',
  high: 'var(--color-warning)',
  normal: 'var(--color-info)',
  low: 'var(--color-text-tertiary)',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  inquiry: 'Inquiry',
  purchase_order: 'Purchase Order',
  sales_order: 'Sales Order',
  carrier_po: 'Carrier PO',
  carrier: 'Carrier',
  fulfillment: 'Fulfillment',
  invoice: 'Invoice',
  form: 'Form',
};
const humanizeEntityType = (type: string) => ENTITY_TYPE_LABELS[type] ?? type.replace(/_/g, ' ');

const TYPE_ICONS: Record<string, string> = {
  trade_action: '🔄',
  form_step: '📋',
  workflow_task: '⚙️',
};

type TasksTab = 'action' | 'approvals' | 'ai';
type PriorityFilter = 'all' | 'urgent' | 'high' | 'normal' | 'low';
type SortOption = 'smart' | 'due_date' | 'priority';
type EntityFilter = 'all' | string;

/* ─── urgency bucket helpers ─── */
type UrgencyBucket = 'overdue' | 'today' | 'this_week' | 'later';

const BUCKET_ORDER: UrgencyBucket[] = ['overdue', 'today', 'this_week', 'later'];
const BUCKET_LABELS: Record<UrgencyBucket, string> = {
  overdue: '🔴 Overdue',
  today: '🟠 Due Today',
  this_week: '🔵 This Week',
  later: '⚪ Later',
};

function getUrgencyBucket(item: ActionItem): UrgencyBucket {
  if (item.is_overdue) return 'overdue';
  if (!item.due_date) return 'later';
  const diff = new Date(item.due_date).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days <= 0) return 'today';
  if (days <= 7) return 'this_week';
  return 'later';
}

/* ─── helpers ─── */
const formatRelativeDate = (dateStr: string | null): string => {
  if (!dateStr) return '';
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days < -1) return `${Math.abs(days)}d overdue`;
  if (days === -1) return 'Yesterday';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return `${days}d`;
  return dayjs(dateStr).format('MMM D');
};

const formatTimeAgo = (dateStr: string): string => {
  const ms = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(ms / 86_400_000);
  if (d < 7) return `${d}d ago`;
  return dayjs(dateStr).format('MMM D');
};

/* ─── animations ─── */
const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

/* ─── layout ─── */
const Page = styled.div`
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px 64px;
  animation: ${fadeIn} 0.2s ease;
`;

const PageTitle = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0 0 4px 0;
  letter-spacing: -0.02em;
`;

const PageSubline = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 0 0 24px 0;
`;

/* ─── tabs (pill style like Linear) ─── */
const TabBar = styled.nav`
  display: inline-flex;
  gap: 2px;
  background: rgb(var(--color-bg-secondary));
  border-radius: 10px;
  padding: 3px;
  margin-bottom: 20px;
`;

const Tab = styled.button<{ $active: boolean }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  ${({ $active }) => $active
    ? css`
        background: rgb(var(--color-surface));
        color: rgb(var(--color-text-primary));
        box-shadow: 0 1px 3px var(--shadow-color, rgba(var(--color-text-primary), 0.08));
      `
    : css`
        background: transparent;
        color: rgb(var(--color-text-secondary));
        &:hover { color: rgb(var(--color-text-primary)); }
      `
  }
`;

const TabBadge = styled.span<{ $variant?: 'danger' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  background: ${({ $variant }) => $variant === 'danger'
    ? 'rgb(var(--color-error))'
    : 'rgba(var(--color-text-secondary), 0.15)'
  };
  color: ${({ $variant }) => $variant === 'danger'
    ? 'rgb(var(--color-text-inverse))'
    : 'rgb(var(--color-text-secondary))'
  };
`;

/* ─── toolbar ─── */
const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
`;

const SearchBox = styled.input`
  flex: 1;
  min-width: 180px;
  padding: 8px 12px 8px 32px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface)) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E") no-repeat 10px center;
  transition: border-color 0.15s;

  &:focus { outline: none; border-color: rgb(var(--color-primary)); }
  &::placeholder { color: rgb(var(--color-text-tertiary)); }
`;

const SmallSelect = styled.select`
  padding: 8px 10px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface));
  cursor: pointer;
  &:focus { outline: none; border-color: rgb(var(--color-primary)); }
`;

const RefreshBtn = styled.button`
  padding: 7px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: rgb(var(--color-primary)); color: rgb(var(--color-primary)); }
`;

/* ─── KPI strip ─── */
const KPIStrip = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  overflow-x: auto;
`;

const KPIChip = styled.div<{ $variant?: 'danger' | 'warning' | 'info' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgb(var(--color-surface));
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  white-space: nowrap;
  flex-shrink: 0;
`;

const KPIValue = styled.span<{ $variant?: 'danger' | 'warning' | 'info' }>`
  font-size: 20px;
  font-weight: 700;
  color: ${({ $variant }) => {
    switch ($variant) {
      case 'danger': return 'rgb(var(--color-error))';
      case 'warning': return 'rgb(var(--color-warning))';
      case 'info': return 'rgb(var(--color-info))';
      default: return 'rgb(var(--color-text-primary))';
    }
  }};
`;

const KPILabel = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

/* ─── task rows ─── */
const TaskRow = styled.div<{ $isAtRisk?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  background: rgb(var(--color-surface));
  border: 1px solid ${({ $isAtRisk }) => $isAtRisk
    ? 'rgba(var(--color-error), 0.35)'
    : 'rgb(var(--color-border))'
  };
  cursor: pointer;
  transition: all 0.12s ease;

  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: var(--shadow-sm);
  }

  & + & { margin-top: 6px; }
`;

const PriorityDot = styled.span<{ $priority: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: rgb(${({ $priority }) => PRIORITY_COLORS[$priority] ?? 'var(--color-border)'});
`;

const RowContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const RowTitle = styled.span`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RowMeta = styled.span`
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  margin-top: 2px;
`;

const DueBadge = styled.span<{ $overdue?: boolean }>`
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  background: ${({ $overdue }) => $overdue
    ? 'rgba(var(--color-error), 0.1)'
    : 'rgba(var(--color-text-secondary), 0.08)'
  };
  color: ${({ $overdue }) => $overdue
    ? 'rgb(var(--color-error))'
    : 'rgb(var(--color-text-secondary))'
  };
`;

const RowActions = styled.div`
  display: flex;
  gap: 6px;
  flex-shrink: 0;
`;

const SmallBtn = styled.button<{ $primary?: boolean }>`
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;

  ${({ $primary }) => $primary
    ? css`
        background: rgb(var(--color-primary));
        color: rgb(var(--color-primary-foreground));
        border: none;
        &:hover { opacity: 0.9; }
      `
    : css`
        background: transparent;
        color: rgb(var(--color-text-secondary));
        border: 1px solid rgb(var(--color-border));
        &:hover { border-color: rgb(var(--color-primary)); color: rgb(var(--color-primary)); }
      `
  }
`;

/* ─── empty & loading ─── */
const Empty = styled.div`
  text-align: center;
  padding: 48px 20px;
  border-radius: 12px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
`;

const EmptyIcon = styled.div`
  font-size: 40px;
  margin-bottom: 12px;
  opacity: 0.7;
`;

const EmptyTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 4px;
`;

const EmptyDesc = styled.p`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  margin: 0;
`;

const Skeleton = styled.div`
  height: 56px;
  border-radius: 10px;
  background: linear-gradient(90deg, rgba(var(--color-border),0.3) 25%, rgba(var(--color-border),0.5) 50%, rgba(var(--color-border),0.3) 75%);
  background-size: 200% 100%;
  animation: ${shimmer} 1.5s ease infinite;
  & + & { margin-top: 6px; }
`;

const ErrorBanner = styled.div`
  padding: 10px 16px;
  border-radius: 8px;
  background: rgba(var(--color-error), 0.08);
  border: 1px solid rgba(var(--color-error), 0.2);
  color: rgb(var(--color-error));
  font-size: 13px;
  margin-bottom: 16px;
`;

/* ─── filter pills ─── */
const FilterPillRow = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 16px;
`;

const FilterPill = styled.button<{ $active?: boolean }>`
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s;
  text-transform: capitalize;

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

/* ─── bulk actions ─── */
const BulkActionsBar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-radius: 10px;
  background: rgb(var(--color-primary) / 0.06);
  border: 1px solid rgb(var(--color-primary) / 0.2);
  margin-bottom: 12px;
`;

const BulkCheckAll = styled.label`
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  margin-right: auto;
`;

/* ─── urgency bucket sections ─── */
const BucketSection = styled.div`
  margin-bottom: 16px;
`;

const BucketHeader = styled.h3`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgb(var(--color-border) / 0.5);
`;

const BucketCount = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 10px;
  font-weight: 700;
  background: rgba(var(--color-text-secondary), 0.1);
  color: rgb(var(--color-text-secondary));
`;

/* ─── task checkbox ─── */
const TaskCheckbox = styled.label`
  display: flex;
  align-items: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 2px;

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: rgb(var(--color-primary));
  }
`;

/* ─── empty state CTA ─── */
const EmptyCTA = styled.button`
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

/* ─── Smart Approval Cards ─── */
const ApprovalCardGrid = styled.div`
  display: grid;
  gap: 16px;
`;

const ApprovalCard = styled.div<{ $highlighted?: boolean }>`
  position: relative;
  border-radius: 12px;
  padding: 20px;
  background: rgb(var(--color-surface));
  border: 1px solid ${({ $highlighted }) =>
    $highlighted ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  box-shadow: ${({ $highlighted }) =>
    $highlighted ? '0 0 0 2px rgba(var(--color-primary), 0.15)' : '0 1px 3px rgba(var(--color-text-primary), 0.04)'};
  transition: border-color 0.15s, box-shadow 0.15s;
  animation: ${fadeIn} 0.2s ease;

  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 2px 8px rgba(var(--color-primary), 0.1);
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
`;

const CardSender = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const CardSubject = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  margin-top: 2px;
  line-height: 1.4;
`;

const CardMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

const ConfidenceBadge = styled.span<{ $level: 'high' | 'medium' | 'low' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  background: ${({ $level }) =>
    $level === 'high' ? 'rgba(var(--color-success), 0.1)'
    : $level === 'medium' ? 'rgba(var(--color-warning), 0.1)'
    : 'rgba(var(--color-error), 0.1)'};
  color: ${({ $level }) =>
    $level === 'high' ? 'rgb(var(--color-success))'
    : $level === 'medium' ? 'rgb(var(--color-warning))'
    : 'rgb(var(--color-error))'};
`;

const CardBody = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.5;
  margin-bottom: 16px;
  padding: 10px 12px;
  background: rgb(var(--color-bg-secondary));
  border-radius: 8px;
`;

const ProposedActions = styled.div`
  margin-bottom: 16px;
`;

const ProposedActionLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 8px;
`;

const ProposedEntityChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(var(--color-primary), 0.08);
  color: rgb(var(--color-primary));
  margin-right: 6px;
  margin-bottom: 4px;
`;

const CardActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const ApproveAllBtn = styled.button`
  padding: 7px 16px;
  border-radius: 8px;
  border: none;
  background: #16a34a;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.12s;
  &:hover { opacity: 0.9; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const DeclineBtn = styled.button`
  padding: 7px 16px;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border));
  background: transparent;
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s;
  &:hover {
    border-color: rgb(var(--color-error));
    color: rgb(var(--color-error));
    background: rgba(var(--color-error), 0.05);
  }
`;

const DeclineFeedbackArea = styled.div`
  margin-top: 12px;
  padding: 12px;
  border-radius: 8px;
  background: rgba(var(--color-error), 0.04);
  border: 1px solid rgba(var(--color-error), 0.15);
`;

const FeedbackTextarea = styled.textarea`
  width: 100%;
  min-height: 60px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;

  &::placeholder { color: rgb(var(--color-text-tertiary)); }
  &:focus { outline: none; border-color: rgb(var(--color-primary)); }
`;

const CardTimestamp = styled.span`
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
`;

/* ═══════════════ COMPONENT ═══════════════ */

export const MyTasks: React.FC = () => {
  useDocumentTitle('My Tasks');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ── data sources ── */
  const { actionItems, actionItemCounts, loading, error, fetchActionItems } = useNotifications();

  // Tab state from URL (accept legacy `ai-review` as alias for `ai`)
  const rawTab = searchParams.get('tab');
  const activeTab: TasksTab = rawTab === 'approvals' ? 'approvals'
    : (rawTab === 'ai' || rawTab === 'ai-review') ? 'ai'
    : 'action';
  const highlightedDraftId = searchParams.get('draft');

  // Approval count for badge
  const [approvalCount, setApprovalCount] = useState(0);

  // Local UI state
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState<PriorityFilter>('all');
  const [sort, setSort] = useState<SortOption>('smart');
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Delegation
  const [showDelegate, setShowDelegate] = useState(false);
  const [delegateTask, setDelegateTask] = useState<ActionItem | null>(null);
  const [isDelegating, setIsDelegating] = useState(false);

  // AI Inbox state
  const [pendingReviews, setPendingReviews] = useState<PendingReviewItem[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [selectedReview, setSelectedReview] = useState<PendingReviewItem | null>(null);
  const [aiIntentFilter, setAiIntentFilter] = useState('all');
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineComment, setDeclineComment] = useState('');

  // (Workflows tab removed — no workforms dependency)

  /* ── tab helpers ── */
  const setTab = useCallback((tab: TasksTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'action') { next.delete('tab'); next.delete('draft'); }
    else { next.set('tab', tab); }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  /* ── fetch AI reviews ── */
  const fetchReviews = useCallback(async () => {
    setReviewLoading(true);
    setReviewError('');
    try {
      const items = await aiStaffApi.listPendingReviews({ highlightedId: highlightedDraftId });
      setPendingReviews(items);
    } catch (err) {
      logger.error('Failed to fetch AI inbox', err);
      setReviewError('Unable to load AI inbox.');
      setPendingReviews([]);
    } finally {
      setReviewLoading(false);
    }
  }, [highlightedDraftId]);

  /* ── lifecycle ── */

  useEffect(() => {
    if (activeTab === 'ai' || highlightedDraftId) void fetchReviews();
  }, [activeTab, fetchReviews, highlightedDraftId]);

  useEffect(() => {
    if (activeTab !== 'ai' && !highlightedDraftId) return;
    const h = () => void fetchReviews();
    window.addEventListener(AI_INBOX_REFRESH_EVENT, h);
    return () => window.removeEventListener(AI_INBOX_REFRESH_EVENT, h);
  }, [activeTab, fetchReviews, highlightedDraftId]);

  useEffect(() => {
    if (!highlightedDraftId || !pendingReviews.length) return;
    const m = pendingReviews.find(i => i.id === highlightedDraftId);
    if (m) setSelectedReview(m);
  }, [highlightedDraftId, pendingReviews]);

  /* ── filtered / sorted tasks ── */
  const filteredTasks = useMemo(() => {
    let items = [...actionItems];
    if (priority !== 'all') items = items.filter(i => i.priority === priority);
    if (entityFilter !== 'all') items = items.filter(i => (i.entity_type ?? '') === entityFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.form_name?.toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => {
      if (sort === 'smart') return compareTasksSmart(a, b);
      if (sort === 'due_date') {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4);
    });
    return items;
  }, [actionItems, priority, entityFilter, search, sort]);

  /* ── urgency-bucketed groups ── */
  const bucketedTasks = useMemo(() => {
    const buckets = new Map<UrgencyBucket, ActionItem[]>();
    for (const bucket of BUCKET_ORDER) buckets.set(bucket, []);
    for (const item of filteredTasks) {
      const bucket = getUrgencyBucket(item);
      buckets.get(bucket)!.push(item);
    }
    return BUCKET_ORDER
      .filter(b => (buckets.get(b)?.length ?? 0) > 0)
      .map(b => ({ bucket: b, label: BUCKET_LABELS[b], items: buckets.get(b)! }));
  }, [filteredTasks]);

  /* ── entity types for filter pills ── */
  const entityTypes = useMemo(() => {
    const counts = new Map<string, number>();
    actionItems.forEach(i => {
      const et = i.entity_type ?? '';
      if (et) counts.set(et, (counts.get(et) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
  }, [actionItems]);

  /* ── bulk selection ── */
  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedTaskIds.size === filteredTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
    }
  }, [filteredTasks, selectedTaskIds.size]);

  const handleBulkComplete = useCallback(async () => {
    if (selectedTaskIds.size === 0) return;
    try {
      await showAlert({ title: 'Tasks Updated', content: `Marked ${selectedTaskIds.size} task(s) as complete.` });
      setSelectedTaskIds(new Set());
      fetchActionItems();
    } catch (err) {
      logger.error('Bulk complete failed', err);
    }
  }, [selectedTaskIds, fetchActionItems]);

  /* ── AI inbox columns & helpers ── */
  const aiIntents = useMemo(() => {
    const s = new Set<string>();
    pendingReviews.forEach(r => s.add(r.intent_label || r.document_type || 'AI Draft'));
    return Array.from(s).sort();
  }, [pendingReviews]);

  const filteredAI = useMemo(() => {
    // Filter out items with no sender ("Unknown sender") as they are not actionable
    const withSender = pendingReviews.filter(r => r.sender && r.sender.trim() !== '');
    if (aiIntentFilter === 'all') return withSender;
    return withSender.filter(r =>
      (r.intent_label || r.document_type || 'AI Draft') === aiIntentFilter
    );
  }, [pendingReviews, aiIntentFilter]);

  const openReview = useCallback((item: PendingReviewItem) => {
    // Always open the review dialog first — let user review before navigating
    setSelectedReview(item);
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'ai');
    next.set('draft', item.id);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const closeReview = useCallback(() => {
    setSelectedReview(null);
    const next = new URLSearchParams(searchParams);
    next.delete('draft');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleReviewResolved = useCallback((id: string) => {
    setPendingReviews(c => c.filter(i => i.id !== id));
    closeReview();
    void fetchReviews();
  }, [closeReview, fetchReviews]);

  const handleFeedback = useCallback((id: string, sub: AIInboxFeedbackSubmission) => {
    const patch = {
      feedback_signal: sub.feedbackSignal,
      feedback_comment: sub.feedbackComment,
      retraining_status: sub.retrainingStatus,
      retraining_queued_at: sub.retrainingQueuedAt,
    };
    setPendingReviews(c => c.map(i => i.id === id ? { ...i, ...patch } : i));
    setSelectedReview(c => c?.id === id ? { ...c, ...patch } : c);
  }, []);

  const handleDeclineWithFeedback = useCallback(async (itemId: string) => {
    try {
      await aiFeedbackApi.submit({
        document_id: itemId,
        feedback_signal: 'thumbs_down',
        feedback_comment: declineComment || undefined,
        feedback_source: 'smart_approval_decline',
      });
      setPendingReviews(c => c.filter(i => i.id !== itemId));
      setDecliningId(null);
      setDeclineComment('');
      void message.success('Declined — feedback saved for AI improvement');
    } catch (err) {
      logger.error('Decline feedback failed', err);
      void message.error('Could not submit decline feedback');
    }
  }, [declineComment]);

  const handleApproveAll = useCallback(async () => {
    if (!filteredAI.length) return;
    try {
      const results = await Promise.allSettled(
        filteredAI.map(item =>
          aiFeedbackApi.submit({
            document_id: item.id,
            feedback_signal: 'thumbs_up',
            feedback_comment: 'Batch approved via Review and Approve',
            feedback_source: 'smart_approval_batch',
          })
        )
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      if (filteredAI[0]) openReview(filteredAI[0]);
      if (failed > 0) {
        void message.warning(`Approved ${succeeded} of ${filteredAI.length} — ${failed} failed. Review individually.`);
      } else {
        void message.success(`Approved ${succeeded} item(s) — opening first for detailed review`);
      }
      void fetchReviews();
    } catch (err) {
      logger.error('Batch approve failed', err);
      void message.error('Batch approval failed — please review individually');
    }
  }, [filteredAI, openReview, fetchReviews]);

  const [batchDeclining, setBatchDeclining] = useState(false);
  const [batchDeclineComment, setBatchDeclineComment] = useState('');

  const handleDeclineAll = useCallback(async () => {
    if (!filteredAI.length) return;
    try {
      await Promise.allSettled(
        filteredAI.map(item =>
          aiFeedbackApi.submit({
            document_id: item.id,
            feedback_signal: 'thumbs_down',
            feedback_comment: batchDeclineComment || 'Batch declined',
            feedback_source: 'smart_approval_batch_decline',
          })
        )
      );
      setPendingReviews(c => c.filter(i => !filteredAI.some(ai => ai.id === i.id)));
      setBatchDeclining(false);
      setBatchDeclineComment('');
      void message.success(`Declined ${filteredAI.length} item(s) — feedback saved for AI improvement`);
    } catch (err) {
      logger.error('Batch decline failed', err);
      void message.error('Some declines failed');
    }
  }, [filteredAI, batchDeclineComment]);

  const getConfidenceLevel = useCallback((score: number | undefined): 'high' | 'medium' | 'low' => {
    const s = Number(score || 0);
    if (s >= 0.8) return 'high';
    if (s >= 0.5) return 'medium';
    return 'low';
  }, []);

  const getProposedEntities = useCallback((item: PendingReviewItem): Array<{ type: string; label: string; description: string }> => {
    const entities: Array<{ type: string; label: string; description: string }> = [];
    const payload = (item as Record<string, unknown>).original_extracted_data as Record<string, unknown> || {};
    const intent = (item.intent_label || '').toLowerCase();
    const formType = item.review_entity_type || item.document_type || '';

    // Infer supplier from payload
    const supplierName = payload.supplier_name || payload.vendor_name || '';
    if (supplierName) {
      entities.push({
        type: 'supplier',
        label: `Supplier: ${String(supplierName)}`,
        description: `Create or link supplier record for "${String(supplierName)}"`,
      });
    }

    // Infer customer from payload
    const customerName = payload.customer_name || payload.buyer_name || '';
    if (customerName) {
      entities.push({
        type: 'customer',
        label: `Customer: ${String(customerName)}`,
        description: `Create or link customer record for "${String(customerName)}"`,
      });
    }

    // Primary entity based on intent/document type
    if (intent.includes('purchase') || intent.includes('po') || formType === 'purchase_order') {
      entities.push({
        type: 'purchase_order',
        label: 'Purchase Order',
        description: payload.order_number
          ? `Create PO #${String(payload.order_number)}`
          : 'Create new Purchase Order from email details',
      });
    } else if (intent.includes('sales') || intent.includes('so') || formType === 'sales_order') {
      entities.push({
        type: 'sales_order',
        label: 'Sales Order',
        description: 'Create new Sales Order from email details',
      });
    } else if (intent.includes('inquiry') || intent.includes('rfq') || intent.includes('quote')) {
      entities.push({
        type: 'inquiry',
        label: 'Inquiry / RFQ',
        description: 'Create new inquiry to track this quote request',
      });
    } else if (intent.includes('invoice') || formType === 'invoice') {
      entities.push({
        type: 'invoice',
        label: 'Invoice',
        description: 'Create invoice record from email',
      });
    } else if (intent.includes('shipping') || intent.includes('bol') || formType === 'carrier-pos') {
      entities.push({
        type: 'carrier_po',
        label: 'Carrier PO / BOL',
        description: 'Create carrier purchase order / shipment record',
      });
    } else if (formType) {
      entities.push({
        type: formType,
        label: humanizeEntityType(formType),
        description: `Create ${humanizeEntityType(formType)} from email`,
      });
    }

    // Trade session — propose if we have both a supplier and a transaction entity
    if (supplierName && entities.some(e => ['purchase_order', 'sales_order', 'inquiry'].includes(e.type))) {
      entities.push({
        type: 'trade_session',
        label: 'Trade Session',
        description: `Start new trade session linking ${String(supplierName)}${customerName ? ` ↔ ${String(customerName)}` : ''}`,
      });
    }

    return entities.length > 0
      ? entities
      : [{ type: 'document', label: 'Trade Document', description: 'Process email as trade document' }];
  }, []);

  /* ── delegation ── */
  const handleDelegate = useCallback(async (_data: DelegationData) => {
    if (!delegateTask) return;
    setIsDelegating(true);
    try {
      await new Promise(r => setTimeout(r, 800));
      setShowDelegate(false);
      setDelegateTask(null);
      fetchActionItems();
    } catch (err) {
      logger.error('Delegate failed', err);
    } finally {
      setIsDelegating(false);
    }
  }, [delegateTask, fetchActionItems]);

  /* ── task actions ── */
  const openTask = useCallback((item: ActionItem) => {
    if (item.submission_id) {
      navigate(`/workflows/run/${item.submission_id}`);
      return;
    }
    if (item.entity_type && item.entity_id) {
      // Trade entities → dedicated record detail page with full workflow context
      const recordRouteMap: Record<string, string> = {
        purchase_order: 'purchase_order',
        sales_order: 'sales_order',
        carrier_po: 'carrier_purchase_order',
        fulfillment: 'fulfillment',
        invoice: 'invoice',
      };
      const recordType = recordRouteMap[item.entity_type];
      if (recordType) {
        navigate(`/records/${recordType}/${item.entity_id}`);
        return;
      }
      // Inquiry → keep existing review modal flow
      const routeMap: Record<string, (id: string) => string> = {
        inquiry: (id) => `/inquiries?review=inquiry&inquiry=${id}`,
        carrier: (id) => `/carriers?highlight=${id}`,
      };
      const buildRoute = routeMap[item.entity_type];
      if (buildRoute) {
        navigate(buildRoute(item.entity_id));
        return;
      }
    }
  }, [navigate]);

  const onDelegate = useCallback((e: React.MouseEvent, item: ActionItem) => {
    e.stopPropagation();
    setDelegateTask(item);
    setShowDelegate(true);
  }, []);

  /* ── computed stats ── */
  const overdueCount = actionItemCounts?.overdue ?? 0;
  const totalCount = actionItemCounts?.total ?? 0;
  const atRiskCount = useMemo(
    () => actionItems.filter(i => isAtRiskTask(i)).length,
    [actionItems]
  );

  const closeDelegateModal = useCallback(() => {
    setShowDelegate(false);
    setDelegateTask(null);
  }, []);

  /* ═══ RENDER ═══ */
  return (
    <Page>
      <PageTitle>My Tasks</PageTitle>
      <PageSubline>Your unified inbox for tasks and AI drafts</PageSubline>

      {/* ── Tab bar ── */}
      <TabBar role="tablist">
        <Tab $active={activeTab === 'action'} onClick={() => setTab('action')} role="tab" aria-selected={activeTab === 'action'}>
          Action Required
          {totalCount > 0 && <TabBadge $variant={overdueCount > 0 ? 'danger' : undefined}>{totalCount}</TabBadge>}
        </Tab>
        <Tab $active={activeTab === 'approvals'} onClick={() => setTab('approvals')} role="tab" aria-selected={activeTab === 'approvals'}>
          Approvals
          {approvalCount > 0 && <TabBadge $variant="danger">{approvalCount}</TabBadge>}
        </Tab>
        <Tab $active={activeTab === 'ai'} onClick={() => setTab('ai')} role="tab" aria-selected={activeTab === 'ai'}>
          AI Approvals
          {pendingReviews.length > 0 && <TabBadge>{pendingReviews.length}</TabBadge>}
        </Tab>
      </TabBar>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {/* ═══════ ACTION REQUIRED TAB ═══════ */}
      {activeTab === 'action' && (
        <>
          {/* KPI strip */}
          {actionItemCounts && (
            <KPIStrip>
              <KPIChip>
                <KPIValue $variant={overdueCount > 0 ? 'danger' : undefined}>{overdueCount}</KPIValue>
                <KPILabel>Overdue</KPILabel>
              </KPIChip>
              <KPIChip>
                <KPIValue $variant="warning">{actionItemCounts.due_today}</KPIValue>
                <KPILabel>Due Today</KPILabel>
              </KPIChip>
              <KPIChip>
                <KPIValue $variant="info">{actionItemCounts.due_this_week}</KPIValue>
                <KPILabel>This Week</KPILabel>
              </KPIChip>
              {atRiskCount > 0 && (
                <KPIChip>
                  <KPIValue $variant="danger">{atRiskCount}</KPIValue>
                  <KPILabel>At Risk</KPILabel>
                </KPIChip>
              )}
            </KPIStrip>
          )}

          {/* Toolbar */}
          <Toolbar>
            <SearchBox
              placeholder="Search tasks…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search tasks"
            />
            <SmallSelect value={priority} onChange={e => setPriority(e.target.value as PriorityFilter)} aria-label="Filter by priority">
              <option value="all">All priorities</option>
              <option value="urgent">🔴 Urgent</option>
              <option value="high">🟠 High</option>
              <option value="normal">🔵 Normal</option>
              <option value="low">⚪ Low</option>
            </SmallSelect>
            <SmallSelect value={sort} onChange={e => setSort(e.target.value as SortOption)} aria-label="Sort by">
              <option value="smart">Smart sort</option>
              <option value="due_date">Due date</option>
              <option value="priority">Priority</option>
            </SmallSelect>
            <RefreshBtn onClick={fetchActionItems} aria-label="Refresh tasks">↻</RefreshBtn>
          </Toolbar>

          {/* Entity-type filter pills */}
          {entityTypes.length > 1 && (
            <FilterPillRow>
              <FilterPill $active={entityFilter === 'all'} onClick={() => setEntityFilter('all')}>
                All ({actionItems.length})
              </FilterPill>
              {entityTypes.map(et => (
                <FilterPill
                  key={et.type}
                  $active={entityFilter === et.type}
                  onClick={() => setEntityFilter(et.type)}
                >
                  {humanizeEntityType(et.type)} ({et.count})
                </FilterPill>
              ))}
            </FilterPillRow>
          )}

          {/* Bulk actions bar */}
          {selectedTaskIds.size > 0 && (
            <BulkActionsBar>
              <BulkCheckAll onClick={toggleSelectAll} aria-label="Toggle select all">
                <input
                  type="checkbox"
                  checked={selectedTaskIds.size === filteredTasks.length}
                  readOnly
                  style={{ marginRight: 6 }}
                />
                {selectedTaskIds.size} selected
              </BulkCheckAll>
              <SmallBtn $primary onClick={() => void handleBulkComplete()}>✓ Complete</SmallBtn>
              <SmallBtn onClick={() => setSelectedTaskIds(new Set())}>Clear</SmallBtn>
            </BulkActionsBar>
          )}

          {/* Task list — urgency-bucketed */}
          {loading && actionItems.length === 0 ? (
            <>
              <Skeleton /><Skeleton /><Skeleton /><Skeleton />
            </>
          ) : filteredTasks.length === 0 ? (
            <Empty>
              <EmptyIcon>{actionItems.length === 0 ? '✅' : '🔍'}</EmptyIcon>
              <EmptyTitle>{actionItems.length === 0 ? 'All caught up!' : 'No matching tasks'}</EmptyTitle>
              <EmptyDesc>
                {actionItems.length === 0
                  ? 'Great work — no tasks need your attention right now.'
                  : 'Try broadening your filters or search.'}
              </EmptyDesc>
              {actionItems.length === 0 && (
                <EmptyCTA onClick={() => navigate('/inquiries?action=create')}>
                  Create a new inquiry →
                </EmptyCTA>
              )}
            </Empty>
          ) : (
            <div role="list" aria-label="Task list">
              {bucketedTasks.map(group => (
                <BucketSection key={group.bucket}>
                  <BucketHeader>{group.label} <BucketCount>{group.items.length}</BucketCount></BucketHeader>
                  {group.items.map(item => {
                    const atRisk = isAtRiskTask(item);
                    const dueText = formatRelativeDate(item.due_date);
                    const isSelected = selectedTaskIds.has(item.id);
                    return (
                      <TaskRow
                        key={item.id}
                        $isAtRisk={atRisk}
                        onClick={() => openTask(item)}
                        role="listitem"
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTask(item); } }}
                      >
                        <TaskCheckbox
                          onClick={e => { e.stopPropagation(); toggleTaskSelection(item.id); }}
                          aria-label={`Select ${item.title}`}
                        >
                          <input type="checkbox" checked={isSelected} readOnly />
                        </TaskCheckbox>

                        <Tooltip title={item.priority}>
                          <PriorityDot $priority={item.priority} />
                        </Tooltip>

                        {item.entity_type && item.entity_id && item.status && (
                          <div role="presentation" onClick={e => e.stopPropagation()}>
                            <StatusActionCell
                              entityType={item.entity_type}
                              entityId={item.entity_id}
                              status={item.status}
                              compact
                              onTransitioned={fetchActionItems}
                            />
                          </div>
                        )}

                        <RowContent>
                          <RowTitle>
                            {TYPE_ICONS[item.type] && <span style={{ marginRight: 6 }}>{TYPE_ICONS[item.type]}</span>}
                            {item.title}
                          </RowTitle>
                          <RowMeta>
                            {item.type === 'trade_action' && item.entity_type && (
                              <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>{humanizeEntityType(item.entity_type)}</Tag>
                            )}
                            {item.form_name && <span>{item.form_name}{item.step_name ? ` → ${item.step_name}` : ''}</span>}
                            {typeof item.related_po_value === 'number' && (
                              <span>{item.related_po_currency || 'USD'} {item.related_po_value.toLocaleString()}</span>
                            )}
                          </RowMeta>
                        </RowContent>

                        {dueText && (
                          <DueBadge $overdue={item.is_overdue}>{dueText}</DueBadge>
                        )}

                        {atRisk && (
                          <Tooltip title="High-value task at risk">
                            <Tag color="error" style={{ margin: 0 }}>⚠ Risk</Tag>
                          </Tooltip>
                        )}

                        <RowActions onClick={e => e.stopPropagation()}>
                          <SmallBtn onClick={e => onDelegate(e, item)}>Delegate</SmallBtn>
                          <SmallBtn $primary onClick={() => openTask(item)}>Open</SmallBtn>
                        </RowActions>
                      </TaskRow>
                    );
                  })}
                </BucketSection>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══════ APPROVALS TAB ═══════ */}
      {activeTab === 'approvals' && (
        <PendingApprovalsTab onCountChange={setApprovalCount} />
      )}

      {/* ═══════ AI APPROVALS TAB (Smart Approvals) ═══════ */}
      {activeTab === 'ai' && (
        <>
          <Toolbar>
            <Select
              value={aiIntentFilter}
              onChange={setAiIntentFilter}
              style={{ minWidth: 160 }}
              aria-label="Filter by intent"
              options={[
                { value: 'all', label: 'All intents' },
                ...aiIntents.map(i => ({ value: i, label: i })),
              ]}
            />
            {filteredAI.length > 1 && (
              <>
                <ApproveAllBtn onClick={() => void handleApproveAll()}>
                  ✓ Review and Approve ({filteredAI.length})
                </ApproveAllBtn>
                <DeclineBtn onClick={() => setBatchDeclining(!batchDeclining)}>
                  ✗ Decline All
                </DeclineBtn>
              </>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgb(var(--color-text-tertiary))' }}>
              {filteredAI.length} item{filteredAI.length !== 1 ? 's' : ''}
            </span>
            <RefreshBtn onClick={() => void fetchReviews()} aria-label="Refresh AI approvals">↻</RefreshBtn>
          </Toolbar>

          {/* Batch decline feedback area */}
          {batchDeclining && (
            <DeclineFeedbackArea style={{ marginBottom: 16 }}>
              <FeedbackTextarea
                placeholder="Optional: Tell the AI why all these items are being declined (helps improve future accuracy)..."
                value={batchDeclineComment}
                onChange={e => setBatchDeclineComment(e.target.value)}
                aria-label="Batch decline reason"
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <SmallBtn $primary onClick={() => void handleDeclineAll()}>
                  Confirm Decline All ({filteredAI.length})
                </SmallBtn>
                <SmallBtn onClick={() => { setBatchDeclining(false); setBatchDeclineComment(''); }}>
                  Cancel
                </SmallBtn>
              </div>
            </DeclineFeedbackArea>
          )}

          {reviewError && <ErrorBanner>{reviewError}</ErrorBanner>}

          {reviewLoading ? (
            <><Skeleton /><Skeleton /><Skeleton /></>
          ) : filteredAI.length === 0 ? (
            <Empty>
              <EmptyIcon>✨</EmptyIcon>
              <EmptyTitle>No pending AI approvals</EmptyTitle>
              <EmptyDesc>
                When AI identifies actionable emails (new orders, quote requests, bid responses),
                they&apos;ll appear here as smart approval cards for your review.
              </EmptyDesc>
            </Empty>
          ) : (
            <ApprovalCardGrid>
              {filteredAI.map(item => {
                const confLevel = getConfidenceLevel(item.confidence_score);
                const proposedEntities = getProposedEntities(item);
                const isDeclining = decliningId === item.id;
                const payload = (item as Record<string, unknown>).original_extracted_data as Record<string, unknown> || {};
                const supplierName = String(payload.supplier_name || payload.vendor_name || '');
                const customerName = String(payload.customer_name || payload.buyer_name || '');

                return (
                  <ApprovalCard key={item.id} $highlighted={item.id === highlightedDraftId}>
                    <CardHeader>
                      <div>
                        <CardSender>{item.sender || 'Unknown sender'}</CardSender>
                        <CardSubject>{item.source_subject || item.intent_label || 'AI-parsed trade document'}</CardSubject>
                      </div>
                      <CardMeta>
                        <ConfidenceBadge $level={confLevel}>
                          {confLevel === 'high' ? '✓' : confLevel === 'medium' ? '~' : '?'}{' '}
                          {Math.round((item.confidence_score || 0) * 100)}%
                        </ConfidenceBadge>
                        <CardTimestamp>{item.created_on ? formatTimeAgo(item.created_on) : ''}</CardTimestamp>
                      </CardMeta>
                    </CardHeader>

                    {item.source_summary && (
                      <CardBody>{item.source_summary}</CardBody>
                    )}

                    {/* AI reasoning / trade context */}
                    <div style={{ fontSize: 13, color: 'rgb(var(--color-text-secondary))', marginBottom: 12 }}>
                      {supplierName && customerName ? (
                        <>This email appears to be regarding a trade between <strong>{customerName}</strong> and supplier <strong>{supplierName}</strong>.</>
                      ) : supplierName ? (
                        <>This email is from supplier <strong>{supplierName}</strong> regarding a business transaction.</>
                      ) : customerName ? (
                        <>This email is from customer <strong>{customerName}</strong> regarding a business transaction.</>
                      ) : (
                        <>AI has identified this as a trade-related email requiring action.</>
                      )}
                    </div>

                    <ProposedActions>
                      <ProposedActionLabel>
                        Would you like me to create:
                      </ProposedActionLabel>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {proposedEntities.map(entity => (
                          <div key={entity.type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ProposedEntityChip>
                              {entity.type === 'supplier' ? '🏭' :
                               entity.type === 'customer' ? '👤' :
                               entity.type === 'trade_session' ? '🔄' :
                               entity.type === 'purchase_order' ? '📦' :
                               entity.type === 'sales_order' ? '💰' :
                               entity.type === 'inquiry' ? '❓' :
                               entity.type === 'invoice' ? '🧾' :
                               entity.type === 'carrier_po' ? '🚚' : '📄'}{' '}
                              {entity.label}
                            </ProposedEntityChip>
                            <span style={{ fontSize: 11, color: 'rgb(var(--color-text-tertiary))' }}>
                              {entity.description}
                            </span>
                          </div>
                        ))}
                      </div>
                      {item.source_document_name && (
                        <div style={{ marginTop: 6 }}>
                          <ProposedEntityChip>📎 {item.source_document_name}</ProposedEntityChip>
                        </div>
                      )}
                    </ProposedActions>

                    <CardActions>
                      <ApproveAllBtn onClick={() => openReview(item)}>
                        ✓ Review and Approve
                      </ApproveAllBtn>
                      <DeclineBtn
                        onClick={() => {
                          if (isDeclining) {
                            setDecliningId(null);
                            setDeclineComment('');
                          } else {
                            setDecliningId(item.id);
                          }
                        }}
                      >
                        ✗ Decline
                      </DeclineBtn>
                    </CardActions>

                    {isDeclining && (
                      <DeclineFeedbackArea>
                        <FeedbackTextarea
                          placeholder="Optional: Tell the AI why this was declined (helps improve future accuracy)..."
                          value={declineComment}
                          onChange={e => setDeclineComment(e.target.value)}
                          aria-label="Decline reason"
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <SmallBtn
                            $primary
                            onClick={() => void handleDeclineWithFeedback(item.id)}
                          >
                            Confirm Decline
                          </SmallBtn>
                          <SmallBtn onClick={() => { setDecliningId(null); setDeclineComment(''); }}>
                            Cancel
                          </SmallBtn>
                        </div>
                      </DeclineFeedbackArea>
                    )}
                  </ApprovalCard>
                );
              })}
            </ApprovalCardGrid>
          )}

          <AIDraftReviewDialog
            open={Boolean(selectedReview)}
            item={selectedReview}
            onClose={closeReview}
            onResolved={handleReviewResolved}
            onFeedbackSubmitted={handleFeedback}
          />
        </>
      )}

      {/* ── Delegate modal ── */}
      <DelegateTaskModal
        isOpen={showDelegate}
        onClose={closeDelegateModal}
        onDelegate={handleDelegate}
        taskName={delegateTask?.title || ''}
        isLoading={isDelegating}
      />
    </Page>
  );
};

export default MyTasks;
