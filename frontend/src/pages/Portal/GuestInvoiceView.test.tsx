import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import GuestInvoiceView, { getPortalSessionStorageKey } from './GuestInvoiceView';
import {
  getPortalGrantSnapshot,
  PortalServiceError,
} from '../../services/portalService';

vi.mock('../../services/portalService', async () => {
  const actual = await vi.importActual<typeof import('../../services/portalService')>(
    '../../services/portalService'
  );

  return {
    ...actual,
    getPortalGrantSnapshot: vi.fn(),
  };
});

const mockedGetPortalGrantSnapshot = vi.mocked(getPortalGrantSnapshot);

const renderPortalRoute = (initialEntry: string) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const router = createMemoryRouter(
    [
      {
        path: '/portal/tenants/:tenantId/grants/:grantId',
        element: (
          <QueryClientProvider client={queryClient}>
            <GuestInvoiceView />
          </QueryClientProvider>
        ),
      },
    ],
    {
      initialEntries: [initialEntry],
    }
  );

  render(<RouterProvider router={router} />);

  return { router };
};

afterEach(() => {
  mockedGetPortalGrantSnapshot.mockReset();
  sessionStorage.clear();
});

describe('GuestInvoiceView', () => {
  it('consumes the query token, stores it in session storage, and replaces the visible URL', async () => {
    mockedGetPortalGrantSnapshot.mockResolvedValue({
      grantId: 'grant-1',
      subjectEmail: 'counterparty@example.com',
      invoices: [
        {
          invoice_number: 'INV-1001',
          customer_name: 'Acme Foods',
          sales_order_num: 'SO-2002',
          pick_up_date: null,
          delivery_date: null,
          due_date: null,
          total_weight: '1500',
          weight_unit: 'LBS',
          total_amount: '1250.00',
          tax_amount: '0.00',
          status: 'sent',
          payment_status: 'unpaid',
          outstanding_amount: '1250.00',
          created_on: '2026-05-06T12:00:00Z',
        },
      ],
      documents: [],
      fulfillments: [],
    });

    const { router } = renderPortalRoute(
      '/portal/tenants/tenant-1/grants/grant-1?token=magic-token'
    );

    await waitFor(() => {
      expect(mockedGetPortalGrantSnapshot).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        grantId: 'grant-1',
        token: 'magic-token',
      });
    });

    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });

    expect(
      sessionStorage.getItem(getPortalSessionStorageKey('tenant-1', 'grant-1'))
    ).toBe('magic-token');
    expect(
      screen.getByText('Shared invoice and shipment details')
    ).toBeInTheDocument();
  });

  it('renders the deterministic expired-link state and clears the stored token', async () => {
    mockedGetPortalGrantSnapshot.mockRejectedValue(
      new PortalServiceError(
        'invalid_or_expired',
        'This portal link is invalid, expired, or has already been used.'
      )
    );

    const storageKey = getPortalSessionStorageKey('tenant-2', 'grant-2');
    sessionStorage.setItem(storageKey, 'stale-token');

    renderPortalRoute('/portal/tenants/tenant-2/grants/grant-2');

    expect(
      await screen.findByText('This portal link is invalid or has expired.')
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(sessionStorage.getItem(storageKey)).toBeNull();
    });
  });
});
