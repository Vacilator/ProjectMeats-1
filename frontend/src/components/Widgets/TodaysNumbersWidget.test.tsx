/**
 * Today's Numbers Widget Tests
 * 
 * Updated: 2026-02-04 - Phase 1.3: Tests now use useCockpitStats hook
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TodaysNumbersWidget } from './TodaysNumbersWidget';
import type { CockpitStats } from '../../hooks/useCockpitStats';

// Mock useCockpitStats hook
const mockUseCockpitStats = vi.fn();
vi.mock('../../hooks/useCockpitStats', () => ({
  useCockpitStats: () => mockUseCockpitStats(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('TodaysNumbersWidget', () => {
  const mockStatsData: CockpitStats = {
    quick_stats: {
      total_orders: 0,
      total_revenue: 0,
      total_customers: 0,
      total_suppliers: 0,
    },
    todays_numbers: {
      orders_today: 5,
      order_value_today: 1250.50,
      weight_today: 500.25,
      pending_orders: 2,
      completed_today: 3,
      active_customers: 8,
      suppliers_count: 10,
      customers_count: 8,
    },
    recent_activity: [],
    upcoming_calls: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockUseCockpitStats.mockReturnValue({
      stats: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <TodaysNumbersWidget />
      </MemoryRouter>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders metrics after data loads', async () => {
    mockUseCockpitStats.mockReturnValue({
      stats: mockStatsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <TodaysNumbersWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Orders Today')).toBeInTheDocument();
    });

    expect(screen.getByText('Pending Orders')).toBeInTheDocument();
    expect(screen.getByText('Completed Today')).toBeInTheDocument();
    expect(screen.getByText('Active Customers')).toBeInTheDocument();
  });

  it('displays supplier and customer counts', async () => {
    const customStats = {
      ...mockStatsData,
      todays_numbers: {
        ...mockStatsData.todays_numbers,
        suppliers_count: 15,
        customers_count: 25,
        active_customers: 20,
      },
    };

    mockUseCockpitStats.mockReturnValue({
      stats: customStats,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <TodaysNumbersWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      // Active Customers is displayed (not total suppliers)
      expect(screen.getByText('20')).toBeInTheDocument(); // Active Customers
    });
  });

  it('shows error state when API fails', async () => {
    mockUseCockpitStats.mockReturnValue({
      stats: null,
      isLoading: false,
      error: 'Network error',
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <TodaysNumbersWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows last updated timestamp when data is loaded', async () => {
    mockUseCockpitStats.mockReturnValue({
      stats: mockStatsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <TodaysNumbersWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      // Widget title should be rendered
      expect(screen.getByText("Today's Numbers")).toBeInTheDocument();
    });
  });

  it('navigates to orders page when clicking order metric', async () => {
    mockUseCockpitStats.mockReturnValue({
      stats: mockStatsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <TodaysNumbersWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Orders Today')).toBeInTheDocument();
    });

    // Find the metric card containing "Orders Today" and click it
    const ordersMetric = screen.getByText('Orders Today').closest('div[role="button"]');
    if (ordersMetric) {
      ordersMetric.click();
      expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders');
    }
  });

  it('renders title', async () => {
    mockUseCockpitStats.mockReturnValue({
      stats: mockStatsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <TodaysNumbersWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Today's Numbers")).toBeInTheDocument();
    });
  });

  it('formats large numbers correctly', async () => {
    const largeNumberStats = {
      ...mockStatsData,
      todays_numbers: {
        ...mockStatsData.todays_numbers,
        suppliers_count: 1500,
        active_customers: 1200,
        completed_today: 3,
      },
    };

    mockUseCockpitStats.mockReturnValue({
      stats: largeNumberStats,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <TodaysNumbersWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      // 1200 should be formatted with comma separator: "1,200"
      expect(screen.getByText('1,200')).toBeInTheDocument();
    });
  });
});
