/**
 * Home Page — Modern SaaS Dashboard
 *
 * Consolidates the best widgets from the old Cockpit/Command Center
 * into a clean, minimal 4-widget grid dashboard.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';

import { businessApi } from '@/services/businessApi';
import { authService } from '@/services/authService';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { UserProfile } from '@/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ActionItem {
  id: string;
  title: string;
  type: string;
  created_at: string;
}

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
  useDocumentTitle('Home');
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);

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

  const actionItemsQuery = useQuery<ActionItem[]>({
    queryKey: ['home', 'action-items'],
    queryFn: async () => {
      try {
        const res = await businessApi.get('/action-items/');
        return Array.isArray(res?.data) ? res.data : [];
      } catch {
        return [];
      }
    },
    staleTime: 2 * 60 * 1000,
    retry: 0,
  });

  const recentActivityQuery = useQuery<ActivityEntry[]>({
    queryKey: ['home', 'recent-activity'],
    queryFn: async () => {
      try {
        const res = await businessApi.get('/activity/recent/');
        return Array.isArray(res?.data) ? res.data : [];
      } catch {
        return [];
      }
    },
    staleTime: 2 * 60 * 1000,
    retry: 0,
  });

  const quickStatsQuery = useQuery<QuickStat[]>({
    queryKey: ['home', 'quick-stats'],
    queryFn: async (): Promise<QuickStat[]> => {
      try {
        const res = await businessApi.get('/dashboard/stats/');
        if (res?.data && typeof res.data === 'object') {
          const d = res.data as Record<string, unknown>;
          return [
            { label: 'Inquiries', value: String(d.inquiries ?? '—') },
            { label: 'Purchase Orders', value: String(d.purchase_orders ?? '—') },
            { label: 'Sales Orders', value: String(d.sales_orders ?? '—') },
            { label: 'Open Items', value: String(d.open_items ?? '—') },
          ];
        }
        return [];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 0,
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

  /* ---- placeholders when endpoints don't exist yet ---- */

  const actionItems: ActionItem[] = actionItemsQuery.data ?? [];
  const recentActivity: ActivityEntry[] = recentActivityQuery.data ?? [];
  const stats: QuickStat[] = quickStatsQuery.data ?? [];
  const fallbackStats: QuickStat[] = useMemo(
    () => [
      { label: 'Inquiries', value: '—' },
      { label: 'Purchase Orders', value: '—' },
      { label: 'Sales Orders', value: '—' },
      { label: 'Open Items', value: '—' },
    ],
    [],
  );

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

      {/* 4-widget grid */}
      <WidgetGrid>
        {/* 1. Action Items */}
        <WidgetCard>
          <WidgetHeader>
            <WidgetIcon aria-hidden="true">🔔</WidgetIcon>
            <WidgetTitle>Action Items</WidgetTitle>
            {actionItems.length > 0 && <Badge>{actionItems.length}</Badge>}
          </WidgetHeader>
          <WidgetBody>
            {actionItems.length === 0 ? (
              <EmptyState>No pending items — you&#39;re all caught up!</EmptyState>
            ) : (
              <ItemList>
                {actionItems.slice(0, 5).map((item) => (
                  <ListItem key={item.id}>
                    <ItemType>{item.type}</ItemType>
                    <ItemTitle>{item.title}</ItemTitle>
                  </ListItem>
                ))}
              </ItemList>
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
            {recentActivity.length === 0 ? (
              <EmptyState>No recent activity to display.</EmptyState>
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

        {/* 3. Quick Stats */}
        <WidgetCard>
          <WidgetHeader>
            <WidgetIcon aria-hidden="true">📈</WidgetIcon>
            <WidgetTitle>Quick Stats</WidgetTitle>
          </WidgetHeader>
          <WidgetBody>
            <StatsGrid>
              {(stats.length > 0 ? stats : fallbackStats).map((stat) => (
                <StatItem key={stat.label}>
                  <StatValue>{String(stat.value)}</StatValue>
                  <StatLabel>{stat.label}</StatLabel>
                </StatItem>
              ))}
            </StatsGrid>
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

/* ---- Widget grid ---- */

const WidgetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const WidgetCard = styled.article`
  background: rgb(var(--color-surface, 255, 255, 255));
  border: 1px solid rgb(var(--color-border, 222, 226, 230));
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
  background: rgb(var(--color-primary, 102, 126, 234));
  color: rgb(255, 255, 255);
`;

const WidgetBody = styled.div`
  padding: 1rem;
  flex: 1;
`;

const EmptyState = styled.p`
  font-size: 0.8125rem;
  color: rgb(var(--color-text-secondary, 108, 117, 125));
  text-align: center;
  padding: 1rem 0;
  margin: 0;
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

const ItemType = styled.span`
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  color: rgb(var(--color-primary, 102, 126, 234));
  white-space: nowrap;
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
