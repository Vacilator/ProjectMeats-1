import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Inquiry } from '../../types';
import { InquiryDetailModal } from './InquiryDetailModal';

const buildInquiry = (): Inquiry =>
  ({
    id: 101,
    inquiry_number: 'INQ-101',
    status: 'quoted',
    created_on: '2026-05-04T00:00:00Z',
    entity_type: 'customer',
    source: 'manual_entry',
    is_expired: false,
    products: [
      {
        id: 1,
        product_code: 'P-001',
        product_description: 'Trim',
        quantity: null,
        desired_price_per_unit: 12,
        actual_price_per_unit: 0,
        desired_total: 12,
        actual_total: 0,
        margin: 0,
        margin_percent: null,
      },
    ],
    total_desired: 12,
    total_actual: 0,
    total_margin: 0,
    notes: '',
  }) as Inquiry;

describe('InquiryDetailModal', () => {
  it('renders legacy null numeric values without crashing and preserves zero totals', () => {
    render(<InquiryDetailModal isOpen onClose={() => {}} inquiry={buildInquiry()} />);

    expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText((_, element) => element?.textContent?.includes('(0.0%)') ?? false).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText((_, element) => element?.textContent?.includes('Products (1)') ?? false).length
    ).toBeGreaterThan(0);
  });
});
