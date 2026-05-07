import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InterventionsPanel } from './InterventionsPanel';
import { businessApi } from '@/services/businessApi';

vi.mock('@/services/businessApi', () => ({
  businessApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/utils/tenantId', () => ({
  getValidTenantId: () => 'tenant-1',
}));

vi.mock('./TradeLineageFlow', () => ({
  TradeLineageFlow: ({ inquiryId }: { inquiryId: string }) => (
    <div data-testid="trade-lineage-flow">{inquiryId}</div>
  ),
}));

const baseListItem = {
  id: 101,
  trade_session_id: 88,
  trade_id: 'TRD-2026-00088',
  failed_step: 'sales_order.dispatch',
  reason_code: 'EMAIL_DISPATCH_FAILED',
  error_message: 'SMTP timeout',
  status: 'open',
  retry_count: 0,
  last_retry_at: null,
  resolved_by: '',
  resolved_at: null,
  resolution_notes: '',
  entity_type: 'sales_order',
  entity_id: '55',
  source_event_id: 'evt-1',
  created_on: '2026-05-07T12:00:00Z',
  modified_on: '2026-05-07T12:00:00Z',
  can_retry: true,
  can_resolve: true,
  active_sibling_count: 1,
  trade_session: {
    id: 88,
    trade_id: 'TRD-2026-00088',
    status: 'halted',
    route_decision: 'BROKER',
    inquiry_id: 44,
    source_email_subject: 'Need 80/20 trim',
    source_email_sender: 'buyer@example.com',
  },
  related_entities: [
    {
      entity_type: 'sales_order',
      entity_id: '55',
      label: 'SO-55',
      status: 'pending',
      record_path: '/records/sales_order/55',
    },
  ],
  record_path: '/records/sales_order/55',
};

const baseDetail = {
  ...baseListItem,
  stack_trace: 'Traceback: timeout',
  context_payload: { recipient: 'buyer@example.com' },
  recent_events: [
    {
      event_id: 'evt-1',
      event_type: 'sales_order.email_failed',
      entity_type: 'sales_order',
      entity_id: '55',
      created_on: '2026-05-07T12:00:00Z',
    },
  ],
  trade_resumable: false,
};

describe('InterventionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(businessApi.get).mockImplementation(async (url) => {
      if (url === '/workspace/trade-exceptions/') {
        return {
          data: {
            count: 1,
            next: null,
            previous: null,
            results: [baseListItem],
          },
        } as never;
      }

      if (url === '/workspace/trade-exceptions/101/') {
        return { data: baseDetail } as never;
      }

      throw new Error(`Unexpected GET ${String(url)}`);
    });

    vi.mocked(businessApi.post).mockImplementation(async (url, payload) => {
      if (url === '/workspace/trade-exceptions/101/retry/') {
        return { data: { ...baseDetail, status: 'retrying', retry_count: 1 } } as never;
      }

      if (url === '/workspace/trade-exceptions/101/resolve/') {
        return {
          data: {
            ...baseDetail,
            status: 'resolved',
            resolution_notes: (payload as { resolution_notes: string }).resolution_notes,
            trade_resumed: false,
            resume_blocked_reason: 'Other active exceptions still block this trade session.',
          },
        } as never;
      }

      throw new Error(`Unexpected POST ${String(url)}`);
    });
  });

  const renderPanel = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InterventionsPanel />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('renders the intervention queue and loads detail context', async () => {
    renderPanel();

    expect(await screen.findByText('TRD-2026-00088')).toBeInTheDocument();
    expect(await screen.findByText('SMTP timeout')).toBeInTheDocument();
    expect(await screen.findByText('Need 80/20 trim')).toBeInTheDocument();
    expect(screen.getByTestId('trade-lineage-flow')).toHaveTextContent('44');
  });

  it('retries and resolves the selected exception', async () => {
    renderPanel();
    const user = userEvent.setup();

    expect(await screen.findByText('TRD-2026-00088')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /Retry Step/i }));
    await waitFor(() => {
      expect(businessApi.post).toHaveBeenCalledWith('/workspace/trade-exceptions/101/retry/', {});
    });

    await user.type(screen.getByLabelText(/Resolution notes/i), 'Confirmed mail credentials and safe retry path.');
    await user.click(screen.getByRole('button', { name: /Resolve Exception/i }));

    await waitFor(() => {
      expect(businessApi.post).toHaveBeenCalledWith('/workspace/trade-exceptions/101/resolve/', {
        resolution_notes: 'Confirmed mail credentials and safe retry path.',
      });
    });
  });
});
