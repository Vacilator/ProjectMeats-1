import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Suppliers from './Suppliers';
import * as businessApiModule from '../services/businessApi';

vi.mock('../services/businessApi', () => ({
  businessApi: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Suppliers page (HQ simplified)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (businessApiModule.businessApi.get as any).mockResolvedValue({
      data: [
        { id: 1, name: 'Acme Meats' },
        { id: 2, name: 'Bravo Foods' },
      ],
    });
  });

  it('renders Suppliers header and lists suppliers', async () => {
    render(
      <TestWrapper>
        <Suppliers />
      </TestWrapper>
    );

    expect(await screen.findByText('Suppliers')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Acme Meats')).toBeInTheDocument();
      expect(screen.getByText('Bravo Foods')).toBeInTheDocument();
    });

    expect(businessApiModule.businessApi.get).toHaveBeenCalledWith('suppliers/');
  });

  it('does not prefetch products on mount (no N+1)', async () => {
    render(
      <TestWrapper>
        <Suppliers />
      </TestWrapper>
    );

    expect(await screen.findByText('Suppliers')).toBeInTheDocument();
    // Only the suppliers/ call should be made, not individual product calls
    expect(businessApiModule.businessApi.get).toHaveBeenCalledTimes(1);
  });
});
