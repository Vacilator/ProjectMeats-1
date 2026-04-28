import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { navigateMock, businessGetMock, businessPostMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  businessGetMock: vi.fn(),
  businessPostMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../services/businessApi', () => ({
  businessApi: {
    get: businessGetMock,
    post: businessPostMock,
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import { CommandPalette } from './CommandPalette';

const renderPalette = () =>
  render(
    <MemoryRouter>
      <CommandPalette isOpen={true} onClose={vi.fn()} />
    </MemoryRouter>
  );

describe('CommandPalette', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    businessGetMock.mockReset();
    businessPostMock.mockReset();
    businessGetMock.mockImplementation((url: string) => {
      if (url === '/search/recent/') {
        return Promise.resolve({ data: { items: [] } });
      }

      if (url === '/search/universal/') {
        return Promise.resolve({
          data: {
            query: 'Acme',
            search_text: 'Acme',
            results: [
              {
                id: 1,
                type: 'customer',
                title: 'Acme Corp',
                subtitle: 'Primary customer',
                icon: 'Users',
                route: '/records/customer/1',
                score: 96,
              },
              {
                id: 2,
                type: 'purchase_order',
                title: 'PO-1001',
                subtitle: 'Acme Corp',
                icon: 'ShoppingCart',
                route: '/records/purchase_order/2',
                score: 82,
              },
            ],
            counts: { customer: 1, purchase_order: 1 },
            total: 2,
          },
        });
      }

      return Promise.resolve({ data: {} });
    });
    businessPostMock.mockResolvedValue({ data: { status: 'tracked' } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders grouped universal search results by entity type', async () => {
    renderPalette();

    const input = screen.getByPlaceholderText(/search suppliers, customers, orders/i);

    fireEvent.change(input, { target: { value: 'Acme' } });

    await waitFor(() =>
      expect(businessGetMock).toHaveBeenCalledWith('/search/universal/', {
        params: { q: 'Acme', limit: 8 },
      })
    );

    expect(await screen.findByText('Customers')).toBeInTheDocument();
    expect(await screen.findByText('Purchase Orders')).toBeInTheDocument();
    expect((await screen.findAllByText('Acme Corp')).length).toBeGreaterThan(0);
    expect(await screen.findByText('PO-1001')).toBeInTheDocument();
  });

  it('navigates to the canonical record page when a result is selected', async () => {
    renderPalette();

    const input = screen.getByPlaceholderText(/search suppliers, customers, orders/i);

    fireEvent.change(input, { target: { value: 'Acme' } });

    const result = await screen.findByText('Primary customer');
    fireEvent.click(result);

    await waitFor(() =>
      expect(businessPostMock).toHaveBeenCalledWith('/search/recent/', {
        entity_type: 'customer',
        entity_id: 1,
        title: 'Acme Corp',
      })
    );

    expect(navigateMock).toHaveBeenCalledWith('/records/customer/1');
  });
});
