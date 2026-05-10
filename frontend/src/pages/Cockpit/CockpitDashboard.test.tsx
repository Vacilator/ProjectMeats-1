import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import type { CockpitStats } from '../../hooks/useCockpitStats';
import CockpitDashboard from './CockpitDashboard';

const onboardingMock = vi.hoisted(() => ({
  hasCompletedTour: vi.fn(),
  launchTour: vi.fn(),
}));

const cockpitStatsMock = vi.hoisted(() => ({
  current: {
    stats: null as CockpitStats | null,
    isLoading: false,
    error: null as string | null,
    refetch: vi.fn(async () => {}),
  },
}));

const navigationMock = vi.hoisted(() => ({
  state: {
    path: [] as Array<{ entityType: string; entityId: string }>,
    clearPath: vi.fn(),
  },
}));

const pinnedToolsMock = vi.hoisted(() => ({
  state: {
    pinWidget: vi.fn(),
  },
}));

const businessApiMock = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../components/Widgets', () => ({
  WidgetGrid: () => <div data-testid="widget-grid">Widget Grid</div>,
  QuickStatsWidget: () => <div />,
  RecentActivityWidget: () => <div />,
  UpcomingCallsWidget: () => <div />,
  QuickActionsWidget: () => <div />,
  EntityExplorerWidget: () => <div />,
  MyTasksWidget: () => <div />,
  TodaysNumbersWidget: () => <div />,
  ActionItemsWidget: () => <div />,
  CalendarWidget: () => <div />,
  EmailIntegrationWidget: () => <div />,
  EmailIngestionMonitorWidget: () => <div />,
}));

vi.mock('../../components/Cockpit', () => ({
  CockpitTour: () => <div data-testid="cockpit-tour" />,
  SmartSearch: () => <div data-testid="smart-search" />,
  BreadcrumbBar: () => <div data-testid="breadcrumb-bar" />,
  COCKPIT_TOUR_SELECTORS: {
    smartSearch: '[data-testid="smart-search"]',
    widgetGrid: '[data-testid="tour-cockpit-grid"]',
    quickActions: '[data-testid="quick-actions"]',
  },
}));

vi.mock('../../components/Cockpit/AILearningMetricsWidget', () => ({
  AILearningMetricsWidget: () => <div data-testid="ai-learning-metrics">AI metrics</div>,
}));

vi.mock('../../components/Cockpit/NextActionChips', () => ({
  NextActionChips: () => <div data-testid="next-action-chips" />,
}));

vi.mock('../../components/Onboarding', () => ({
  CockpitWelcomeEmptyState: ({
    onCustomizeDashboard,
    onStartTour,
  }: {
    onCustomizeDashboard: () => void;
    onStartTour: () => void;
  }) => (
    <div data-testid="cockpit-welcome">
      <button type="button" onClick={onStartTour}>
        Take the Cockpit Tour
      </button>
      <button type="button" onClick={onCustomizeDashboard}>
        Customize Dashboard
      </button>
    </div>
  ),
  useOnboarding: () => onboardingMock,
}));

vi.mock('../../contexts/CockpitNavigationContext', () => ({
  useCockpitNavigation: () => navigationMock.state,
}));

vi.mock('../../contexts/CockpitPinnedToolsContext', () => ({
  useCockpitPinnedTools: () => pinnedToolsMock.state,
}));

vi.mock('../../hooks/useCockpitStats', () => ({
  useCockpitStats: () => cockpitStatsMock.current,
}));

vi.mock('../../services/businessApi', () => ({
  businessApi: businessApiMock,
}));

const blankStats: CockpitStats = {
  quick_stats: {
    total_orders: 0,
    total_revenue: 0,
    total_customers: 0,
    total_suppliers: 0,
  },
  todays_numbers: {
    orders_today: 0,
    pending_orders: 0,
    completed_today: 0,
    active_customers: 0,
  },
  recent_activity: [],
  upcoming_calls: [],
};

const populatedStats: CockpitStats = {
  quick_stats: {
    total_orders: 4,
    total_revenue: 2400,
    total_customers: 2,
    total_suppliers: 1,
  },
  todays_numbers: {
    orders_today: 1,
    pending_orders: 2,
    completed_today: 1,
    active_customers: 1,
  },
  recent_activity: [
    {
      id: 1,
      entity_type: 'sales_order',
      entity_id: 10,
      title: 'Created sales order',
      content: 'SO-10',
      created_by: 'Alice',
      created_on: '2026-05-05T19:00:00Z',
      is_pinned: false,
      tags: 'sales',
    },
  ],
  upcoming_calls: [
    {
      id: 2,
      entity_type: 'customer',
      entity_id: 5,
      title: 'Customer follow-up',
      description: 'Check delivery timing',
      scheduled_for: '2026-05-06T10:00:00Z',
      duration_minutes: 30,
      assigned_to: 'Alice',
    },
  ],
};

const renderDashboard = (initialEntries: string[] = ['/cockpit']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/cockpit" element={<CockpitDashboard />} />
      </Routes>
    </MemoryRouter>
  );

describe('CockpitDashboard empty states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onboardingMock.hasCompletedTour.mockReturnValue(true);
    onboardingMock.launchTour.mockResolvedValue(undefined);
    cockpitStatsMock.current = {
      stats: populatedStats,
      isLoading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    };
    navigationMock.state.path = [];
    businessApiMock.get.mockResolvedValue({
      data: {
        version: 1,
        widgets: [
          { id: 'quick-actions', type: 'QuickActionsWidget', title: 'Quick Actions' },
        ],
        layout: [{ i: 'quick-actions', x: 0, y: 0, w: 6, h: 3 }],
      },
    });
    businessApiMock.put.mockResolvedValue({ data: {} });
    businessApiMock.delete.mockResolvedValue({ data: {} });
  });

  it('shows the cockpit welcome when dashboard stats are blank even after the tour is completed', async () => {
    onboardingMock.hasCompletedTour.mockReturnValue(true);
    cockpitStatsMock.current = {
      stats: blankStats,
      isLoading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    };

    renderDashboard();

    expect(await screen.findByTestId('cockpit-welcome')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-learning-metrics')).not.toBeInTheDocument();
  });

  it('suppresses the cockpit welcome while search is active', async () => {
    onboardingMock.hasCompletedTour.mockReturnValue(false);
    cockpitStatsMock.current = {
      stats: blankStats,
      isLoading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    };

    renderDashboard(['/cockpit?q=brisket']);

    expect(await screen.findByTestId('smart-search')).toBeInTheDocument();
    expect(screen.queryByTestId('cockpit-welcome')).not.toBeInTheDocument();
  });

  it('shows the generic no-widgets branch when stats are populated but the saved widget layout is empty', async () => {
    businessApiMock.get.mockResolvedValue({
      data: {
        version: 1,
        widgets: [],
        layout: [],
      },
    });

    renderDashboard();

    expect(await screen.findByText('No widgets configured')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /customize dashboard/i })).toBeInTheDocument();
  });

  it('lets Customize Dashboard dismiss the welcome and reveal the editable widget surface', async () => {
    const user = userEvent.setup();

    onboardingMock.hasCompletedTour.mockReturnValue(false);
    cockpitStatsMock.current = {
      stats: blankStats,
      isLoading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    };

    renderDashboard();

    await user.click(await screen.findByRole('button', { name: /customize dashboard/i }));

    expect(screen.queryByTestId('cockpit-welcome')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /save & lock/i })).toBeInTheDocument();
    expect(screen.getByTestId('widget-grid')).toBeInTheDocument();
  });
});
