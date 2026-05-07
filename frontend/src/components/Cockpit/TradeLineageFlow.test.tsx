import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { TradeLineageFlow } from './TradeLineageFlow';
import { businessApi } from '@/services/businessApi';

vi.mock('@/services/businessApi', () => ({
  businessApi: {
    get: vi.fn(),
  },
}));

vi.mock('reactflow', () => ({
  default: ({ nodes, nodeTypes, children }: any) => (
    <div data-testid="reactflow">
      {nodes.map((node: any) => {
        const Component = nodeTypes[node.type];
        return (
          <div key={node.id} data-testid={`node-${node.id}`}>
            <Component data={node.data} />
          </div>
        );
      })}
      {children}
    </div>
  ),
  Controls: () => null,
  Background: () => null,
  MarkerType: { ArrowClosed: 'arrow-closed' },
  Position: { Right: 'right', Left: 'left' },
}));

describe('TradeLineageFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders contact role cards from the lineage payload', async () => {
    vi.mocked(businessApi.get).mockResolvedValueOnce({
      data: {
        inquiry: {
          id: 'inq-1',
          number: 'INQ-1',
          status: 'pending',
          route_decision: 'BROKER',
          contact_roles: [
            {
              role: 'rfq_recipient',
              role_label: 'RFQ Recipient',
              header: 'RFQ sent to Sales - Angie Sanchez (Allen Lund)',
              detail_path: '/records/contact/42',
              department_label: 'Sales',
              title: 'Account Manager',
              responsibilities: ['Beef Trim', 'Spec Sheets'],
            },
          ],
        },
        supplier_purchase_order: null,
        sales_order: null,
        carrier_purchase_order: null,
        current_step: 'supplier_rfq',
      },
    } as any);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TradeLineageFlow inquiryId="inq-1" compact />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/RFQ sent to Sales - Angie Sanchez \(Allen Lund\)/i)).toBeInTheDocument();
    expect(screen.getByText('Beef Trim')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open contact/i })).toBeInTheDocument();
  });
});
