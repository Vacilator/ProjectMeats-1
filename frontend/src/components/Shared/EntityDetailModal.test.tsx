import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EntityDetailModal } from './EntityDetailModal';

const apiClientGet = vi.fn();

vi.mock('../../services/apiService', () => ({
  apiClient: {
    get: (...args: unknown[]) => apiClientGet(...args),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();

  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('EntityDetailModal', () => {
  beforeEach(() => {
    apiClientGet.mockReset();
  });

  it('renders zero-valued invoice amounts as currency instead of hiding them', async () => {
    apiClientGet.mockResolvedValueOnce({
      data: {
        id: 1,
        invoice_number: 'INV-1',
        customer_name: 'Acme Foods',
        amount: 0,
        status: 'draft',
        created_at: '2026-05-04T00:00:00Z',
      },
    });

    render(
      <EntityDetailModal
        isOpen
        onClose={() => {}}
        entityType="invoice"
        entityId={1}
      />
    );

    expect(await screen.findByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('INV-1')).toBeInTheDocument();
  });
});
