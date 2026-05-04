import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CockpitWelcomeEmptyState } from './CockpitWelcomeEmptyState';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('CockpitWelcomeEmptyState', () => {
  it('routes users to first-run CTAs and starts the tour', () => {
    const customizeDashboard = vi.fn();
    const startTour = vi.fn();

    render(
      <MemoryRouter>
        <CockpitWelcomeEmptyState
          onCustomizeDashboard={customizeDashboard}
          onStartTour={startTour}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Take the Cockpit Tour' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Your First Customer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create Your First Inquiry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Customize Dashboard' }));

    expect(startTour).toHaveBeenCalledTimes(1);
    expect(customizeDashboard).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/customers/new');
    expect(navigateMock).toHaveBeenCalledWith('/inquiries', { state: { openCreateModal: true } });
  });
});
