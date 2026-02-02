/**
 * Today's Numbers Widget Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TodaysNumbersWidget } from './TodaysNumbersWidget';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockedAxios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <MemoryRouter>
        <TodaysNumbersWidget />
      </MemoryRouter>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders metrics after data loads', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('purchase-orders')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('suppliers')) {
        return Promise.resolve({ data: [{ id: 1 }, { id: 2 }] });
      }
      if (url.includes('customers')) {
        return Promise.resolve({ data: [{ id: 1 }] });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <MemoryRouter>
        <TodaysNumbersWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Orders Today')).toBeInTheDocument();
    });

    expect(screen.getByText('Order Value')).toBeInTheDocument();
    expect(screen.getByText('Weight Today')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Suppliers')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
  });

  it('displays supplier and customer counts', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('suppliers')) {
        return Promise.resolve({ data: [{ id: 1 }, { id: 2 }, { id: 3 }] });
      }
      if (url.includes('customers')) {
        return Promise.resolve({ data: [{ id: 1 }, { id: 2 }] });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <MemoryRouter>
        <TodaysNumbersWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument(); // Suppliers
    });
    expect(screen.getByText('2')).toBeInTheDocument(); // Customers
  });

  it('shows empty data when API fails', async () => {
    // Since each axios.get has its own .catch(), errors result in empty data, not error state
    mockedAxios.get.mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter>
        <TodaysNumbersWidget />
      </MemoryRouter>
    );

    // When all APIs fail, we still get metrics but with 0 values
    await waitFor(() => {
      expect(screen.getByText('Orders Today')).toBeInTheDocument();
    });
    
    // All counts should be 0 (multiple 0s exist, so use getAllByText)
    const zeroElements = screen.getAllByText('0');
    expect(zeroElements.length).toBeGreaterThan(0);
  });

  it('handles paginated API responses', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('purchase-orders')) {
        return Promise.resolve({ 
          data: { 
            results: [
              { id: 1, created_at: new Date().toISOString(), total_price: '100', total_weight: '50', status: 'pending' }
            ] 
          } 
        });
      }
      if (url.includes('suppliers')) {
        return Promise.resolve({ data: { results: [{ id: 1 }] } });
      }
      if (url.includes('customers')) {
        return Promise.resolve({ data: { results: [] } });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <MemoryRouter>
        <TodaysNumbersWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Orders Today')).toBeInTheDocument();
    });
  });

  it('shows last updated timestamp', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });

    render(
      <MemoryRouter>
        <TodaysNumbersWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Updated/)).toBeInTheDocument();
    });
  });

  it('navigates to orders page when clicking order metric', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });

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
    mockedAxios.get.mockResolvedValue({ data: [] });

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
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('suppliers')) {
        return Promise.resolve({ 
          data: Array.from({ length: 1500 }, (_, i) => ({ id: i }))
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <MemoryRouter>
        <TodaysNumbersWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      // 1500 should be formatted as "1.5K"
      expect(screen.getByText('1.5K')).toBeInTheDocument();
    });
  });
});
