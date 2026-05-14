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
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Table, Tag, Select, message, Tooltip } from 'antd';
import { showAlert } from '@/utils/uiDialogs';
import { logger } from '@/utils/logger';
import { useNotifications, ActionItem } from '../../contexts/NotificationsContext';
import { DelegateTaskModal, DelegationData, User } from '../../components/Delegation';
import AIDraftReviewDialog from '../../components/AIAssistant/AIDraftReviewDialog';
import {
  AIInboxFeedbackActions,
  type AIInboxFeedbackSubmission,
} from '../../components/AIAssistant/AIInboxFeedbackActions';
import {
  AI_INBOX_REFRESH_EVENT,
  aiStaffApi,
  PendingReviewItem,
} from '../../services/aiService';
import { StatusActionCell } from '@/components/Workflow';
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

type TasksTab = 'action' | 'ai';
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
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

/* ═══════════════ COMPONENT ═══════════════ */

export const MyTasks: React.FC = () => {
  useDocumentTitle('My Tasks');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ── data sources ── */
  const { actionItems, actionItemCounts, loading, error, fetchActionItems } = useNotifications();

  // Tab state from URL (accept legacy `ai-review` as alias for `ai`)
  const rawTab = searchParams.get('tab');
  const activeTab: TasksTab = (rawTab === 'ai' || rawTab === 'ai-review') ? 'ai' : 'action';
  const highlightedDraftId = searchParams.get('draft');

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
  const mockUsers = useRef<User[]>([
    { id: '1', name: 'John Smith', email: 'john@example.com', role: 'Sales Rep', department: 'Sales' },
    { id: '2', name: 'Jane Doe', email: 'jane@example.com', role: 'Manager', department: 'Operations' },
    { id: '3', name: 'Bob Johnson', email: 'bob@example.com', role: 'Analyst', department: 'Finance' },
  ]).current;

  // AI Inbox state
  const [pendingReviews, setPendingReviews] = useState<PendingReviewItem[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [selectedReview, setSelectedReview] = useState<PendingReviewItem | null>(null);
  const [aiIntentFilter, setAiIntentFilter] = useState('all');
  const [aiSelectedKeys, setAiSelectedKeys] = useState<React.Key[]>([]);

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
    if (aiIntentFilter === 'all') return pendingReviews;
    return pendingReviews.filter(r =>
      (r.intent_label || r.document_type || 'AI Draft') === aiIntentFilter
    );
  }, [pendingReviews, aiIntentFilter]);

  const openReview = useCallback((item: PendingReviewItem) => {
    if (item.review_entity_type === 'purchase_order' && item.review_target_url) {
      navigate(item.review_target_url);
      return;
    }
    setSelectedReview(item);
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'ai');
    next.set('draft', item.id);
    setSearchParams(next, { replace: true });
  }, [navigate, searchParams, setSearchParams]);

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

  const handleBatchAction = useCallback(async (action: 'approve' | 'reject') => {
    const sel = pendingReviews.filter(r => aiSelectedKeys.includes(r.id));
    if (!sel.length) return;
    if (action === 'approve') {
      sel.forEach(i => openReview(i));
      void message.info(`Opening ${sel.length} draft(s)`);
    } else {
      setPendingReviews(c => c.filter(r => !aiSelectedKeys.includes(r.id)));
      void message.success(`${sel.length} draft(s) dismissed`);
    }
    setAiSelectedKeys([]);
  }, [aiSelectedKeys, pendingReviews, openReview]);

  const aiColumns = useMemo(() => [
    {
      title: 'Sender', dataIndex: 'sender', key: 'sender',
      render: (v: string | undefined) => v || 'Unknown',
    },
    {
      title: 'Intent', dataIndex: 'intent_label', key: 'intent',
      render: (_: string | undefined, r: PendingReviewItem) => (
        <Tag color="blue">{r.intent_label || r.document_type || 'AI Draft'}</Tag>
      ),
    },
    {
      title: 'Date', dataIndex: 'created_on', key: 'date',
      render: (v: string | undefined) => v ? formatTimeAgo(v) : '—',
    },
    {
      title: 'Confidence', dataIndex: 'confidence_score', key: 'conf', width: 90,
      render: (v: number | undefined) => {
        const s = Number(v || 0);
        return <Tag color={s >= 0.8 ? 'green' : s >= 0.5 ? 'orange' : 'red'}>{Math.round(s * 100)}%</Tag>;
      },
    },
    {
      title: '', key: 'actions', width: 120,
      render: (_: unknown, r: PendingReviewItem) => (
        <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
          <SmallBtn $primary onClick={() => openReview(r)}>Review</SmallBtn>
          <AIInboxFeedbackActions item={r} onSubmitted={sub => handleFeedback(r.id, sub)} />
        </div>
      ),
    },
  ], [handleFeedback, openReview]);

  /* ── delegation ── */
  const handleDelegate = useCallback(async (data: DelegationData) => {
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
    if (item.submission_id) navigate(`/workflows/run/${item.submission_id}`);
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
        <Tab $active={activeTab === 'ai'} onClick={() => setTab('ai')} role="tab" aria-selected={activeTab === 'ai'}>
          AI Inbox
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
                  {et.type.replace(/_/g, ' ')} ({et.count})
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
                        onKeyDown={e => e.key === 'Enter' && openTask(item)}
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
                          <div onClick={e => e.stopPropagation()}>
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
                          <RowTitle>{item.title}</RowTitle>
                          <RowMeta>
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

      {/* ═══════ AI INBOX TAB ═══════ */}
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
            {aiSelectedKeys.length > 0 && (
              <>
                <Tag color="blue">{aiSelectedKeys.length} selected</Tag>
                <SmallBtn $primary onClick={() => void handleBatchAction('approve')}>Review selected</SmallBtn>
                <SmallBtn onClick={() => void handleBatchAction('reject')}>Dismiss</SmallBtn>
              </>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgb(var(--color-text-tertiary))' }}>
              {filteredAI.length} item{filteredAI.length !== 1 ? 's' : ''}
            </span>
            <RefreshBtn onClick={() => void fetchReviews()} aria-label="Refresh AI inbox">↻</RefreshBtn>
          </Toolbar>

          {reviewError && <ErrorBanner>{reviewError}</ErrorBanner>}

          {reviewLoading ? (
            <><Skeleton /><Skeleton /><Skeleton /></>
          ) : filteredAI.length === 0 ? (
            <Empty>
              <EmptyIcon>📥</EmptyIcon>
              <EmptyTitle>AI Inbox is clear</EmptyTitle>
              <EmptyDesc>Drafts from AI email parsing will appear here for your review.</EmptyDesc>
            </Empty>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table
                aria-label="AI review queue"
                rowKey="id"
                dataSource={filteredAI}
                columns={aiColumns}
                pagination={false}
                size="small"
                rowSelection={{ selectedRowKeys: aiSelectedKeys, onChange: setAiSelectedKeys }}
                expandable={{
                  expandedRowRender: (item: PendingReviewItem) => (
                    <div style={{ padding: '8px 0' }}>
                      <div style={{ fontWeight: 500, marginBottom: 4 }}>{item.source_subject || 'AI Draft'}</div>
                      <div style={{ color: 'rgb(var(--color-text-secondary))', fontSize: 13 }}>
                        {item.source_summary || 'Open to inspect and save the entity.'}
                      </div>
                      {item.source_document_name && (
                        <Tag style={{ marginTop: 8 }}>📎 {item.source_document_name}</Tag>
                      )}
                    </div>
                  ),
                }}
              />
            </div>
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
        availableUsers={mockUsers}
        isLoading={isDelegating}
      />
    </Page>
  );
};

export default MyTasks;
