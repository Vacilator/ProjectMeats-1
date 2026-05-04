import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/inquiries', state: {} }),
  };
});

vi.mock('../services/apiService', () => ({
  apiClient: {
    get: vi.fn(),
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

import { apiClient } from '../services/apiService';
import Inquiries from './Inquiries';

describe('Inquiries page', () => {
  beforeEach(() => {
    cloneLifecycle.mounts = 0;
    cloneLifecycle.unmounts = 0;
    refetchMock.mockReset();

    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === 'inquiry-templates/') {
        return Promise.resolve({ data: [] } as never);
      }

      if (url === 'inquiries/1/') {
        return Promise.resolve({
          data: {
            id: 1,
            inquiry_number: 'INQ-1',
            status: 'pending',
            entity_type: 'customer',
            customer_name: 'Acme Foods',
            supplier_name: '',
            contact_name: 'Jane Buyer',
          },
        } as never);
      }

      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
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
});
