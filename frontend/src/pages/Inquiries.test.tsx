import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.hoisted(() => vi.fn());
const routerLocation = vi.hoisted(() => ({
  pathname: '/inquiries',
  search: '',
  state: {},
}));
const refetchMock = vi.hoisted(() => vi.fn());
const cloneLifecycle = vi.hoisted(() => ({
  mounts: 0,
  unmounts: 0,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {
      items: [
        {
          id: 1,
          inquiry_number: 'INQ-1',
          status: 'pending',
          entity_type: 'customer',
          customer_name: 'Acme Foods',
          supplier_name: '',
          product_count: 1,
          total_desired: 12,
          total_actual: 0,
          valid_until: null,
          created_on: '2026-05-04T00:00:00Z',
          is_expired: false,
        },
      ],
      count: 1,
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: refetchMock,
  }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();

  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => routerLocation,
  };
});

vi.mock('../services/inquiryService', () => ({
  inquiryService: {
    listInquiryTemplates: vi.fn(),
    getInquiryDetail: vi.fn(),
    createInquiryFromTemplate: vi.fn(),
    updateInquiryStatus: vi.fn(),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@/utils/uiDialogs', () => ({
  showAlert: vi.fn(),
}));

vi.mock('../components/Shared', () => ({
  EntityFormSurface: () => <div data-testid="entity-form-surface" />,
}));

vi.mock('../components/Inquiry', async () => {
  const ReactModule = await import('react');

  return {
    InquiryDetailModal: ({ inquiry, onClone }: { inquiry: Record<string, unknown>; onClone: (inquiry: Record<string, unknown>) => void }) => (
      <div data-testid="inquiry-detail-modal">
        <button type="button" onClick={() => onClone(inquiry)}>
          Open clone modal
        </button>
      </div>
    ),
    CloneInquiryModal: ({ onClose }: { onClose: () => void }) => {
      ReactModule.useEffect(() => {
        cloneLifecycle.mounts += 1;

        return () => {
          cloneLifecycle.unmounts += 1;
        };
      }, []);

      return (
        <div data-testid="clone-inquiry-modal">
          <button type="button" onClick={onClose}>
            Close clone modal
          </button>
        </div>
      );
    },
  };
});

import { inquiryService } from '../services/inquiryService';
import Inquiries from './Inquiries';

describe('Inquiries page', () => {
  beforeEach(() => {
    routerLocation.search = '';
    routerLocation.state = {};
    cloneLifecycle.mounts = 0;
    cloneLifecycle.unmounts = 0;
    refetchMock.mockReset();
    mockNavigate.mockReset();

    vi.mocked(inquiryService.listInquiryTemplates).mockResolvedValue([]);
    vi.mocked(inquiryService.getInquiryDetail).mockResolvedValue({
      id: '1',
      inquiry_number: 'INQ-1',
      status: 'pending',
      route_decision: 'BROKER',
      entity_type: 'customer',
      customer_name: 'Acme Foods',
      supplier_name: '',
      contact_name: 'Jane Buyer',
      source: 'email',
      products: [],
      created_on: '2026-05-04T00:00:00Z',
      modified_on: '2026-05-04T00:00:00Z',
    } as never);
  });

  it('only mounts the clone modal while the clone flow is open', async () => {
    const user = userEvent.setup();

    render(<Inquiries />);

    await user.click(screen.getByText('INQ-1'));

    expect(await screen.findByTestId('inquiry-detail-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('clone-inquiry-modal')).not.toBeInTheDocument();
    expect(cloneLifecycle.mounts).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Open clone modal' }));

    expect(await screen.findByTestId('clone-inquiry-modal')).toBeInTheDocument();
    expect(cloneLifecycle.mounts).toBe(1);
    expect(cloneLifecycle.unmounts).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Close clone modal' }));

    await waitFor(() => {
      expect(screen.queryByTestId('clone-inquiry-modal')).not.toBeInTheDocument();
    });
    expect(cloneLifecycle.unmounts).toBe(1);
  });

  it('opens inquiry detail automatically from review query params', async () => {
    routerLocation.search = '?review=inquiry&inquiry=1';

    render(<Inquiries />);

    expect(await screen.findByTestId('inquiry-detail-modal')).toBeInTheDocument();
    expect(inquiryService.getInquiryDetail).toHaveBeenCalledWith('1');
  });
});
