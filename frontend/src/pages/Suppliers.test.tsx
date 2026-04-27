import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Suppliers from './Suppliers';
import * as apiService from '../services/apiService';

vi.mock('../services/apiService', () => ({
  apiClient: {
    get: vi.fn(),
  },
  apiService: {
    getSuppliers: vi.fn(),
    deleteSupplier: vi.fn(),
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
    (apiService.apiService.getSuppliers as any).mockResolvedValue([
      { id: 1, name: 'Acme Meats' },
      { id: 2, name: 'Bravo Foods' },
    ]);
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

    expect(apiService.apiService.getSuppliers).toHaveBeenCalled();
  });

  it('does not prefetch products on mount (no N+1)', async () => {
    render(
      <TestWrapper>
        <Suppliers />
      </TestWrapper>
    );

    expect(await screen.findByText('Suppliers')).toBeInTheDocument();
    expect(apiService.apiClient.get).not.toHaveBeenCalled();
  });
});
