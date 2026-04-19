import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CloneInquiryModal } from './CloneInquiryModal';
import { businessApi } from '@/services/businessApi';

vi.mock('@/services/businessApi', () => ({
  businessApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/utils/uiDialogs', () => ({
  showAlert: vi.fn(),
}));

describe('CloneInquiryModal', () => {
  beforeEach(() => {
    vi.mocked(businessApi.get).mockResolvedValue({ data: [] } as any);
    vi.mocked(businessApi.post).mockResolvedValue({ data: { id: 999 } } as any);
  });

  it('disables pricing when products are not included and submits expected payload', async () => {
    const onClose = vi.fn();
    const onCloned = vi.fn();

    render(
      <CloneInquiryModal
        isOpen={true}
        onClose={onClose}
        onCloned={onCloned}
        inquiry={
          {
            id: '123',
            inquiry_number: 'INQ-1',
            entity_type: 'customer',
            customer_name: 'ACME',
            supplier_name: '',
            contact_name: 'Jane Doe',
          } as any
        }
      />
    );

    const includeProducts = await screen.findByLabelText('Include Products');
    const includePricing = await screen.findByLabelText('Include Pricing');

    // Turn off products -> pricing should be disabled and forced off
    await userEvent.click(includeProducts);
    expect(includePricing).toBeDisabled();
    expect(includePricing).not.toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: /Clone Inquiry/i }));

    expect(businessApi.post).toHaveBeenCalledWith('/inquiries/123/clone/', {
      include_products: false,
      include_pricing: false,
    });

    expect(onCloned).toHaveBeenCalledWith({ id: 999 });
    expect(onClose).toHaveBeenCalled();
  });
});
