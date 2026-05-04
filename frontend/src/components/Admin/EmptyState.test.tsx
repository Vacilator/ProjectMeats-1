import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders multiple actions without breaking the legacy single-action contract', () => {
    const primaryAction = vi.fn();
    const secondaryAction = vi.fn();

    render(
      <EmptyState
        icon={<span>✨</span>}
        title="Nothing here yet"
        message="Choose a next step."
        actions={[
          { label: 'Primary action', onClick: primaryAction, variant: 'primary' },
          { label: 'Secondary action', onClick: secondaryAction, variant: 'secondary' },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Primary action' }));
    fireEvent.click(screen.getByRole('button', { name: 'Secondary action' }));

    expect(primaryAction).toHaveBeenCalledTimes(1);
    expect(secondaryAction).toHaveBeenCalledTimes(1);
  });
});
