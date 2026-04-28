import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import DealDesk from './DealDesk';
import { dealsService } from '../../services/dealsService';

vi.mock('../../services/dealsService', () => ({
  dealsService: {
    list: vi.fn(),
  },
}));

describe('DealDesk page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (dealsService.list as any).mockResolvedValue([
      {
        id: 'deal-1',
        deal_number: 'DEAL-2026-00001',
        status: 'in_transit',
        purchase_order: 1,
        purchase_order_number: 'PO-1001',
        sales_order: 2,
        sales_order_number: 'SO-2001',
        fulfillment: 3,
        supplier_name: 'Acme Packers',
        customer_name: 'Bravo Foods',
        carrier_name: 'Road King',
        pickup_date: '2026-04-28',
        delivery_date: '2026-04-30',
        gross_revenue: '1800.00',
        cogs: '1250.00',
        freight_cost: '150.00',
        net_margin: '400.00',
        next_action: 'Collect BOL / COA',
        next_follow_up_date: '2026-04-27T12:00:00Z',
        is_past_due: true,
        created_on: '2026-04-26T10:00:00Z',
        modified_on: '2026-04-28T10:00:00Z',
      },
    ]);
  });

  it('renders the Deal Desk ledger table', async () => {
    render(
      <BrowserRouter>
        <DealDesk />
      </BrowserRouter>
    );

    expect(await screen.findByText('Deal Desk')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('DEAL-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('Acme Packers')).toBeInTheDocument();
      expect(screen.getByText('Collect BOL / COA')).toBeInTheDocument();
    });

    expect(dealsService.list).toHaveBeenCalledWith({ status: 'all' });
  });

  it('marks overdue follow-up rows for warning styling', async () => {
    render(
      <BrowserRouter>
        <DealDesk />
      </BrowserRouter>
    );

    const row = await screen.findByTestId('deal-row-deal-1');
    expect(row).toHaveAttribute('data-past-due', 'true');
  });
});
