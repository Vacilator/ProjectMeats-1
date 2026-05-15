/**
 * Workspace Page — Central Hub Dashboard
 *
 * Clean, minimal dashboard with quick navigation to
 * My Tasks, My Trades, and Calls alongside KPI widgets.
 * Urgency-first design: surfaces overdue items, action counts,
 * and pipeline value so users see what needs attention immediately.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { css, keyframes } from 'styled-components';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton, Button } from 'antd';
import { ExclamationCircleOutlined, ReloadOutlined } from '@ant-design/icons';

import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { authService } from '@/services/authService';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useNotifications } from '@/contexts/NotificationsContext';
import { UserProfile } from '@/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ActivityEntry {
  id: string;
  description: string;
  timestamp: string;
  type: string;
}

interface QuickStat {
  label: string;
  value: number | string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Home: React.FC = () => {
  useDocumentTitle('Workspace');
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);
  const { actionItems, actionItemCounts } = useNotifications();

  const overdueCount = actionItemCounts?.overdue ?? 0;
  const dueTodayCount = actionItemCounts?.due_today ?? 0;
  const dueThisWeekCount = actionItemCounts?.due_this_week ?? 0;
  const totalActionItems = actionItemCounts?.total ?? actionItems.length;

  useEffect(() => {
    void Promise.resolve(authService.getCurrentUser())
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const displayName = user?.first_name || user?.username || 'there';

  const todayFormatted = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date()),
    [],
  );

  /* ---- data queries ---- */

  const queryClient = useQueryClient();

  const recentActivityQuery = useQuery<ActivityEntry[]>({
    queryKey: withTenantQueryKey('home', 'recent-activity'),
    queryFn: async () => {
      const res = await businessApi.get('/activity/recent/');
      return Array.isArray(res?.data) ? res.data : [];
    },
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const quickStatsQuery = useQuery<QuickStat[]>({
    queryKey: withTenantQueryKey('home', 'quick-stats'),
    queryFn: async (): Promise<QuickStat[]> => {
      const res = await businessApi.get('/dashboard/stats/');
      if (res?.data && typeof res.data === 'object') {
        const d = res.data as Record<string, unknown>;
        return [
          { label: 'Inquiries', value: String(d.inquiries ?? '—') },
          { label: 'Purchase Orders', value: String(d.purchase_orders ?? '—') },
          { label: 'Sales Orders', value: String(d.sales_orders ?? '—') },
          { label: 'Invoices Due', value: String(d.invoices_due ?? d.open_items ?? '—') },
          { label: 'Pending Approvals', value: String(d.pending_approvals ?? '—') },
          { label: 'Active Carriers', value: String(d.active_carriers ?? '—') },
        ];
      }
      return [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  /* ---- handlers ---- */

  const openCommandPalette = useCallback(() => {
    window.dispatchEvent(new CustomEvent('pm:open-command-palette'));
  }, []);

  const quickActions = useMemo(
    () => [
      { label: 'New Inquiry', icon: '📋', path: '/inquiries?action=create' },
      { label: 'New P.O.', icon: '📦', path: '/purchase-orders?action=create' },
      { label: 'New S.O.', icon: '🚚', path: '/sales-orders?action=create' },
      { label: 'New Supplier', icon: '🏭', path: '/suppliers?action=create' },
      { label: 'New Customer', icon: '👥', path: '/customers?action=create' },
    ],
    [],
  );

  const handleQuickAction = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  /* ---- retry handlers (stable refs via queryClient) ---- */

  const retryStats = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: withTenantQueryKey('home', 'quick-stats') });
  }, [queryClient]);

  const retryActivity = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: withTenantQueryKey('home', 'recent-activity') });
  }, [queryClient]);

  /* ---- placeholders when endpoints don't exist yet ---- */

  const recentActivity: ActivityEntry[] = recentActivityQuery.data ?? [];
  const stats: QuickStat[] = quickStatsQuery.data ?? [];

  return (
    <PageWrapper>
      {/* Hero */}
      <HeroSection>
        <HeroContent>
          <Greeting>
            {greeting}, {displayName}
          </Greeting>
          <DateLine>{todayFormatted}</DateLine>
        </HeroContent>
        <SearchTrigger
          onClick={openCommandPalette}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') openCommandPalette();
          }}
          aria-label="Open command palette"
        >
          <SearchIcon aria-hidden="true">🔍</SearchIcon>
          <SearchPlaceholder>Search anything… (⌘K)</SearchPlaceholder>
        </SearchTrigger>
      </HeroSection>

      {/* Urgency Callout — only shown when items need attention */}
      {(overdueCount > 0 || dueTodayCount > 0) && (
        <UrgencyCallout
          $level={overdueCount > 0 ? 'critical' : 'warning'}
          onClick={() => navigate('/my-tasks')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate('/my-tasks'); }}
          aria-label="View items needing attention"
        >
          <UrgencyIcon aria-hidden="true">{overdueCount > 0 ? '🔴' : '🟠'}</UrgencyIcon>
          <UrgencyText>
            <UrgencyHeadline>
              {overdueCount > 0
                ? `${overdueCount} overdue item${overdueCount === 1 ? '' : 's'} need${overdueCount === 1 ? 's' : ''} your attention`
                : `${dueTodayCount} item${dueTodayCount === 1 ? '' : 's'} due today`}
            </UrgencyHeadline>
            <UrgencyDetail>
              {overdueCount > 0 && dueTodayCount > 0
                ? `Plus ${dueTodayCount} due today · ${dueThisWeekCount} this week`
                : `${dueThisWeekCount} more this week`}
            </UrgencyDetail>
          </UrgencyText>
          <UrgencyAction>View Tasks →</UrgencyAction>
        </UrgencyCallout>
      )}

      {/* Workspace Navigation Tiles */}
      <NavTileRow>
        <NavTile onClick={() => navigate('/my-tasks')} aria-label="Go to My Tasks">
          <NavTileIcon>✅</NavTileIcon>
          <NavTileContent>
            <NavTileLabel>My Tasks</NavTileLabel>
            <NavTileDesc>Action items, approvals &amp; AI drafts</NavTileDesc>
          </NavTileContent>
          {overdueCount > 0 && (
            <NavTileBadge $variant="danger">{overdueCount} overdue</NavTileBadge>
          )}
          {overdueCount === 0 && totalActionItems > 0 && (
            <NavTileBadge $variant="primary">{totalActionItems}</NavTileBadge>
          )}
        </NavTile>
        <NavTile onClick={() => navigate('/my-trades')} aria-label="Go to My Trades">
          <NavTileIcon>🔄</NavTileIcon>
          <NavTileContent>
            <NavTileLabel>My Trades</NavTileLabel>
            <NavTileDesc>Active trade pipelines &amp; document flow</NavTileDesc>
          </NavTileContent>
        </NavTile>
        <NavTile onClick={() => navigate('/calls')} aria-label="Go to Calls">
          <NavTileIcon>📞</NavTileIcon>
          <NavTileContent>
            <NavTileLabel>Calls</NavTileLabel>
            <NavTileDesc>Schedule, log &amp; track calls</NavTileDesc>
          </NavTileContent>
        </NavTile>
      </NavTileRow>

      {/* Widget grid */}
      <WidgetGrid>
        {/* 1. Today's Numbers */}
        <WidgetCard>
          <WidgetHeader>
            <WidgetIcon aria-hidden="true">📈</WidgetIcon>
            <WidgetTitle>Today&apos;s Numbers</WidgetTitle>
          </WidgetHeader>
          <WidgetBody>
            {quickStatsQuery.isLoading ? (
              <StatsGrid>
                {Array.from({ length: 6 }).map((_, i) => (
                  <StatItem key={i}>
                    <Skeleton.Button active size="small" block style={{ height: 28, marginBottom: 4 }} />
                    <Skeleton.Input active size="small" block style={{ height: 14 }} />
                  </StatItem>
                ))}
              </StatsGrid>
            ) : quickStatsQuery.isError ? (
              <WidgetErrorState>
                <ExclamationCircleOutlined style={{ fontSize: 24, color: 'rgb(var(--color-error, 239, 68, 68))' }} />
                <WidgetErrorText>Something went wrong loading stats</WidgetErrorText>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={retryStats}
                >
                  Retry
                </Button>
              </WidgetErrorState>
            ) : stats.length === 0 ? (
              <EmptyState>
                <EmptyStateIcon>📈</EmptyStateIcon>
                <EmptyStateText>No stats available yet</EmptyStateText>
                <EmptyStateCTA onClick={() => navigate('/inquiries?action=create')}>
                  Create your first inquiry to get started →
                </EmptyStateCTA>
              </EmptyState>
            ) : (
              <StatsGrid>
                {stats.map((stat) => (
                  <StatItem key={stat.label}>
                    <StatValue>{String(stat.value)}</StatValue>
                    <StatLabel>{stat.label}</StatLabel>
                  </StatItem>
                ))}
              </StatsGrid>
            )}
          </WidgetBody>
        </WidgetCard>

        {/* 2. Recent Activity */}
        <WidgetCard>
          <WidgetHeader>
            <WidgetIcon aria-hidden="true">📊</WidgetIcon>
            <WidgetTitle>Recent Activity</WidgetTitle>
          </WidgetHeader>
          <WidgetBody>
            {recentActivityQuery.isLoading ? (
              <ActivitySkeletonList>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} active title={false} paragraph={{ rows: 1, width: '80%' }} style={{ marginBottom: 8 }} />
                ))}
              </ActivitySkeletonList>
            ) : recentActivityQuery.isError ? (
              <WidgetErrorState>
                <ExclamationCircleOutlined style={{ fontSize: 24, color: 'rgb(var(--color-error, 239, 68, 68))' }} />
                <WidgetErrorText>Something went wrong loading activity</WidgetErrorText>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={retryActivity}
                >
                  Retry
                </Button>
              </WidgetErrorState>
            ) : recentActivity.length === 0 ? (
              <EmptyState>
                <EmptyStateIcon>📊</EmptyStateIcon>
                <EmptyStateText>No recent activity yet</EmptyStateText>
                <EmptyStateCTA onClick={() => navigate('/inquiries?action=create')}>
                  Create your first inquiry →
                </EmptyStateCTA>
              </EmptyState>
            ) : (
              <ItemList>
                {recentActivity.slice(0, 5).map((entry) => (
                  <ListItem key={entry.id}>
                    <ItemTitle>{entry.description}</ItemTitle>
                    <ItemMeta>{formatRelativeTime(entry.timestamp)}</ItemMeta>
                  </ListItem>
                ))}
              </ItemList>
            )}
          </WidgetBody>
        </WidgetCard>

        {/* 3. Task Summary — quick glance at pending work */}
        <WidgetCard>
          <WidgetHeader>
            <WidgetIcon aria-hidden="true">📋</WidgetIcon>
            <WidgetTitle>Task Summary</WidgetTitle>
            <WidgetAction onClick={() => navigate('/my-tasks')}>View all →</WidgetAction>
          </WidgetHeader>
          <WidgetBody>
            <TaskSummaryGrid>
              <TaskSummaryStat $color="error">
                <TaskSummaryValue>{overdueCount}</TaskSummaryValue>
                <TaskSummaryLabel>Overdue</TaskSummaryLabel>
              </TaskSummaryStat>
              <TaskSummaryStat $color="warning">
                <TaskSummaryValue>{dueTodayCount}</TaskSummaryValue>
                <TaskSummaryLabel>Due Today</TaskSummaryLabel>
              </TaskSummaryStat>
              <TaskSummaryStat $color="info">
                <TaskSummaryValue>{dueThisWeekCount}</TaskSummaryValue>
                <TaskSummaryLabel>This Week</TaskSummaryLabel>
              </TaskSummaryStat>
              <TaskSummaryStat $color="primary">
                <TaskSummaryValue>{totalActionItems}</TaskSummaryValue>
                <TaskSummaryLabel>Total</TaskSummaryLabel>
              </TaskSummaryStat>
            </TaskSummaryGrid>
            {totalActionItems === 0 && (
              <EmptyState>
                <EmptyStateIcon>🎉</EmptyStateIcon>
                <EmptyStateText>You&apos;re all caught up!</EmptyStateText>
              </EmptyState>
            )}
          </WidgetBody>
        </WidgetCard>

        {/* 4. Quick Actions */}
        <WidgetCard>
          <WidgetHeader>
            <WidgetIcon aria-hidden="true">⚡</WidgetIcon>
            <WidgetTitle>Quick Actions</WidgetTitle>
          </WidgetHeader>
          <WidgetBody>
            <ActionsGrid>
              {quickActions.map((action) => (
                <ActionButton
                  key={action.label}
                  onClick={() => handleQuickAction(action.path)}
                  aria-label={action.label}
                >
                  <ActionIcon aria-hidden="true">{action.icon}</ActionIcon>
                  <ActionLabel>{action.label}</ActionLabel>
                </ActionButton>
              ))}
            </ActionsGrid>
          </WidgetBody>
        </WidgetCard>
      </WidgetGrid>
    </PageWrapper>
  );
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatRelativeTime(timestamp: string): string {
  try {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------------ */
/*  Styled Components                                                  */
/* ------------------------------------------------------------------ */

const PageWrapper = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 0 2rem;
`;

const HeroSection = styled.section`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
`;

const HeroContent = styled.div`
  flex: 1;
  min-width: 200px;
`;

const Greeting = styled.h1`
  font-size: 1.75rem;
  font-weight: 700;
  color: rgb(var(--color-text-primary, 73, 80, 87));
  margin: 0 0 0.25rem;
`;

const DateLine = styled.p`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary, 108, 117, 125));
  margin: 0;
`;

const SearchTrigger = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border, 222, 226, 230));
  background: rgb(var(--color-surface, 255, 255, 255));
  cursor: pointer;
  min-width: 280px;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover,
  &:focus-visible {
    border-color: rgb(var(--color-primary, 102, 126, 234));
    box-shadow: 0 0 0 2px rgba(var(--color-primary, 102, 126, 234), 0.15);
    outline: none;
  }

  @media (max-width: 600px) {
    min-width: 0;
    flex: 1;
  }
`;

const SearchIcon = styled.span`
  font-size: 1rem;
`;

const SearchPlaceholder = styled.span`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary, 108, 117, 125));
`;

/* ---- Workspace Navigation Tiles ---- */

const NavTileRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const NavTile = styled.button`
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1rem 1.25rem;
  border-radius: 12px;
  border: 1px solid rgb(var(--color-border, 222, 226, 230));
  background: rgb(var(--color-surface, 255, 255, 255));
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;

  &:hover {
    border-color: rgb(var(--color-primary, 102, 126, 234));
    box-shadow: 0 2px 8px rgba(var(--color-primary, 102, 126, 234), 0.1);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary, 102, 126, 234));
    outline-offset: 2px;
  }
`;

const NavTileIcon = styled.span`
  font-size: 1.5rem;
  flex-shrink: 0;
`;

const NavTileContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const NavTileLabel = styled.div`
  font-size: 0.9375rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary, 73, 80, 87));
`;

const NavTileDesc = styled.div`
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary, 108, 117, 125));
  margin-top: 2px;
`;

const NavTileBadge = styled.span<{ $variant?: 'primary' | 'danger' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 8px;
  border-radius: 11px;
  font-size: 0.6875rem;
  font-weight: 600;
  flex-shrink: 0;
  white-space: nowrap;

  ${(p) =>
    p.$variant === 'danger'
      ? css`
          background: rgb(var(--color-error, 239, 68, 68));
          color: rgb(255, 255, 255);
        `
      : css`
          background: rgb(var(--color-primary, 102, 126, 234));
          color: rgb(255, 255, 255);
        `}
`;

/* ---- Urgency Callout ---- */

const subtlePulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
`;

const UrgencyCallout = styled.div<{ $level: 'critical' | 'warning' }>`
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1.25rem;
  border-radius: 12px;
  margin-bottom: 1.25rem;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;

  ${(p) =>
    p.$level === 'critical'
      ? css`
          background: rgb(var(--color-error, 239, 68, 68) / 0.08);
          border: 1px solid rgb(var(--color-error, 239, 68, 68) / 0.3);
          animation: ${subtlePulse} 3s ease-in-out infinite;
        `
      : css`
          background: rgb(var(--color-warning, 234, 179, 8) / 0.08);
          border: 1px solid rgb(var(--color-warning, 234, 179, 8) / 0.3);
        `}

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary, 102, 126, 234));
    outline-offset: 2px;
  }
`;

const UrgencyIcon = styled.span`
  font-size: 1.25rem;
  flex-shrink: 0;
`;

const UrgencyText = styled.div`
  flex: 1;
  min-width: 0;
`;

const UrgencyHeadline = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary, 73, 80, 87));
`;

const UrgencyDetail = styled.div`
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary, 108, 117, 125));
  margin-top: 1px;
`;

const UrgencyAction = styled.span`
  font-size: 0.8125rem;
  font-weight: 600;
  color: rgb(var(--color-primary, 102, 126, 234));
  white-space: nowrap;
  flex-shrink: 0;
`;

/* ---- Widget grid ---- */

const WidgetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const WidgetCard = styled.article<{ $fullWidth?: boolean }>`
  background: rgb(var(--color-surface, 255, 255, 255));
  border: 1px solid rgb(var(--color-border, 222, 226, 230));
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  ${(p) => p.$fullWidth ? 'grid-column: 1 / -1;' : ''}
`;

const WidgetHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid rgb(var(--color-border, 222, 226, 230));
`;

const WidgetIcon = styled.span`
  font-size: 1.125rem;
`;

const WidgetTitle = styled.h2`
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary, 73, 80, 87));
  margin: 0;
  flex: 1;
`;

const WidgetBody = styled.div`
  padding: 1rem;
  flex: 1;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 1.25rem 0;
  text-align: center;
`;

const EmptyStateIcon = styled.span`
  font-size: 1.5rem;
`;

const EmptyStateText = styled.p`
  font-size: 0.8125rem;
  color: rgb(var(--color-text-secondary, 108, 117, 125));
  margin: 0;
`;

const EmptyStateCTA = styled.button`
  background: none;
  border: none;
  padding: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: rgb(var(--color-primary, 102, 126, 234));
  cursor: pointer;
  margin-top: 0.25rem;

  &:hover {
    text-decoration: underline;
  }
`;

/* ---- Widget error state ---- */

const WidgetErrorState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem;
  text-align: center;
`;

const WidgetErrorText = styled.p`
  font-size: 0.8125rem;
  color: rgb(var(--color-text-secondary, 108, 117, 125));
  margin: 0;
`;

/* ---- Activity skeleton list ---- */

const ActivitySkeletonList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

/* ---- Task Summary ---- */

const colorMap: Record<string, string> = {
  error: 'var(--color-error, 239, 68, 68)',
  warning: 'var(--color-warning, 234, 179, 8)',
  info: 'var(--color-info, 59, 130, 246)',
  primary: 'var(--color-primary, 102, 126, 234)',
};

const TaskSummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
`;

const TaskSummaryStat = styled.div<{ $color?: string }>`
  text-align: center;
  padding: 0.5rem 0.25rem;
  border-radius: 8px;
  background: ${(p) => `rgb(${colorMap[p.$color ?? 'primary']} / 0.06)`};
`;

const TaskSummaryValue = styled.div`
  font-size: 1.375rem;
  font-weight: 700;
  color: rgb(var(--color-text-primary, 73, 80, 87));
`;

const TaskSummaryLabel = styled.div`
  font-size: 0.6875rem;
  font-weight: 500;
  color: rgb(var(--color-text-secondary, 108, 117, 125));
  margin-top: 0.125rem;
`;

/* ---- Widget header action ---- */

const WidgetAction = styled.button`
  background: none;
  border: none;
  padding: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--color-primary, 102, 126, 234));
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
`;

/* ---- List items ---- */

const ItemList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ListItem = styled.li`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0;
  border-bottom: 1px solid rgb(var(--color-border, 222, 226, 230) / 0.5);

  &:last-child {
    border-bottom: none;
  }
`;

const ItemTitle = styled.span`
  font-size: 0.8125rem;
  color: rgb(var(--color-text-primary, 73, 80, 87));
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ItemMeta = styled.span`
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary, 108, 117, 125));
  white-space: nowrap;
`;

/* ---- Stats ---- */

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
`;

const StatItem = styled.div`
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: rgb(var(--color-text-primary, 73, 80, 87));
`;

const StatLabel = styled.div`
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary, 108, 117, 125));
  margin-top: 0.125rem;
`;

/* ---- Quick actions ---- */

const ActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.625rem;
`;

const ActionButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.75rem 0.5rem;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border, 222, 226, 230));
  background: rgb(var(--color-surface, 255, 255, 255));
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: rgb(var(--color-primary, 102, 126, 234) / 0.06);
    border-color: rgb(var(--color-primary, 102, 126, 234));
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary, 102, 126, 234));
    outline-offset: 2px;
  }
`;

const ActionIcon = styled.span`
  font-size: 1.25rem;
`;

const ActionLabel = styled.span`
  font-size: 0.75rem;
  font-weight: 500;
  color: rgb(var(--color-text-primary, 73, 80, 87));
  text-align: center;
`;

export default Home;
