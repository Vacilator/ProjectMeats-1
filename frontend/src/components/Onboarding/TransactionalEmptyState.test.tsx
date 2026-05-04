// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  TransactionalEmptyState,
  TransactionalEmptyStateGuidance,
  TransactionalEmptyStateGuidanceItem,
} from './TransactionalEmptyState';

describe('TransactionalEmptyState', () => {
  it('renders guidance and routes actions through the shared empty-state contract', () => {
    const primaryAction = vi.fn();
    const secondaryAction = vi.fn();

    render(
      <TransactionalEmptyState
        icon={<span>📄</span>}
        title="No invoices yet"
        message="Start by creating your first invoice."
        actions={[
          { label: 'Create Invoice', onClick: primaryAction, variant: 'primary' },
          { label: 'Create Sales Order', onClick: secondaryAction, variant: 'secondary' },
        ]}
      >
        <TransactionalEmptyStateGuidance>
          <TransactionalEmptyStateGuidanceItem>
            Invoices are easiest to manage once sales orders already exist.
          </TransactionalEmptyStateGuidanceItem>
        </TransactionalEmptyStateGuidance>
      </TransactionalEmptyState>,
    );

    expect(screen.getByText('No invoices yet')).toBeTruthy();
    expect(screen.getByText(/sales orders already exist/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Create Invoice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create Sales Order' }));

    expect(primaryAction).toHaveBeenCalledTimes(1);
    expect(secondaryAction).toHaveBeenCalledTimes(1);
  });
});
