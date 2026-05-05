import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders multiple actions and custom guidance content', () => {
    render(
      <EmptyState
        icon={<span aria-hidden="true">✨</span>}
        title="No cockpit activity yet"
        message="Start with a guided action to populate your dashboard."
        actions={[
          { label: 'Take the Tour', onClick: vi.fn(), variant: 'primary' },
          { label: 'Add Customer', onClick: vi.fn(), variant: 'secondary' },
        ]}
      >
        <p>Helpful guidance</p>
      </EmptyState>
    );

    expect(screen.getByRole('heading', { name: /no cockpit activity yet/i })).toBeInTheDocument();
    expect(screen.getByText(/start with a guided action/i)).toBeInTheDocument();
    expect(screen.getByText('Helpful guidance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /take the tour/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add customer/i })).toBeInTheDocument();
  });

  it('invokes action callbacks through keyboard-usable buttons', async () => {
    const user = userEvent.setup();
    const primaryAction = vi.fn();
    const secondaryAction = vi.fn();

    render(
      <EmptyState
        icon={<span aria-hidden="true">🧭</span>}
        title="Start your cockpit"
        message="Choose a first action."
        actions={[
          { label: 'Take the Tour', onClick: primaryAction, variant: 'primary' },
          { label: 'Customize Dashboard', onClick: secondaryAction, variant: 'secondary' },
        ]}
      />
    );

    await user.click(screen.getByRole('button', { name: /take the tour/i }));
    await user.click(screen.getByRole('button', { name: /customize dashboard/i }));

    expect(primaryAction).toHaveBeenCalledTimes(1);
    expect(secondaryAction).toHaveBeenCalledTimes(1);
  });
});
