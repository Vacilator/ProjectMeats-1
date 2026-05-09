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

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, nodeTypes, children }: any) => (
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

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

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

    renderWithProviders(<TradeLineageFlow inquiryId="inq-1" compact />);

    expect(await screen.findByText(/RFQ sent to Sales - Angie Sanchez \(Allen Lund\)/i)).toBeInTheDocument();
    expect(screen.getByText('Beef Trim')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open contact/i })).toBeInTheDocument();
  });

  it('shows AI suggestion on empty supplier PO node with supplier context', async () => {
    vi.mocked(businessApi.get).mockResolvedValueOnce({
      data: {
        inquiry: {
          id: 'inq-2',
          number: 'INQ-2',
          status: 'sourcing',
          supplier: 'Acme Meats',
          customer: 'Big Foods',
          contact_roles: [],
        },
        supplier_purchase_order: null,
        sales_order: null,
        carrier_purchase_order: null,
        current_step: 'inquiry_created',
      },
    } as any);

    renderWithProviders(<TradeLineageFlow inquiryId="inq-2" compact />);

    expect(await screen.findByText(/Create PO for Acme Meats/)).toBeInTheDocument();
  });

  it('shows AI suggestion on empty sales order node with customer context', async () => {
    vi.mocked(businessApi.get).mockResolvedValueOnce({
      data: {
        inquiry: {
          id: 'inq-3',
          number: 'INQ-3',
          status: 'quoted',
          supplier: 'Acme Meats',
          customer: 'Big Foods',
          contact_roles: [],
        },
        supplier_purchase_order: { id: 'po-1', number: 'PO-001', status: 'ordered', contact_roles: [] },
        sales_order: null,
        carrier_purchase_order: null,
        current_step: 'supplier_ordered',
      },
    } as any);

    renderWithProviders(<TradeLineageFlow inquiryId="inq-3" compact />);

    expect(await screen.findByText(/Create SO for Big Foods/)).toBeInTheDocument();
  });

  it('shows generic AI suggestion on empty carrier PO node', async () => {
    vi.mocked(businessApi.get).mockResolvedValueOnce({
      data: {
        inquiry: {
          id: 'inq-4',
          number: 'INQ-4',
          status: 'ordered',
          contact_roles: [],
        },
        supplier_purchase_order: { id: 'po-1', number: 'PO-001', status: 'ordered', contact_roles: [] },
        sales_order: { id: 'so-1', number: 'SO-001', status: 'approved', contact_roles: [] },
        carrier_purchase_order: null,
        current_step: 'logistics',
      },
    } as any);

    renderWithProviders(<TradeLineageFlow inquiryId="inq-4" compact />);

    expect(await screen.findByText(/Create Carrier PO for logistics/)).toBeInTheDocument();
  });

  it('shows "Click to create" on all empty nodes', async () => {
    vi.mocked(businessApi.get).mockResolvedValueOnce({
      data: {
        inquiry: { id: 'inq-5', number: 'INQ-5', status: 'pending', contact_roles: [] },
        supplier_purchase_order: null,
        sales_order: null,
        carrier_purchase_order: null,
        current_step: 'inquiry_created',
      },
    } as any);

    renderWithProviders(<TradeLineageFlow inquiryId="inq-5" compact />);

    const clickToCreate = await screen.findAllByText(/Click to create/);
    // 3 empty nodes should show "Click to create" (supplier PO, sales order, carrier PO)
    expect(clickToCreate).toHaveLength(3);
  });

  it('does not show AI suggestion on populated nodes', async () => {
    vi.mocked(businessApi.get).mockResolvedValueOnce({
      data: {
        inquiry: { id: 'inq-6', number: 'INQ-6', status: 'completed', supplier: 'Acme', customer: 'Big Foods', contact_roles: [] },
        supplier_purchase_order: { id: 'po-1', number: 'PO-001', status: 'ordered', contact_roles: [] },
        sales_order: { id: 'so-1', number: 'SO-001', status: 'approved', contact_roles: [] },
        carrier_purchase_order: { id: 'cpo-1', number: 'CPO-001', status: 'completed', contact_roles: [] },
        current_step: 'completed',
      },
    } as any);

    renderWithProviders(<TradeLineageFlow inquiryId="inq-6" compact />);

    await screen.findByText('INQ-6');
    expect(screen.queryByText(/Click to create/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Create PO/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Create SO/)).not.toBeInTheDocument();
  });
});
