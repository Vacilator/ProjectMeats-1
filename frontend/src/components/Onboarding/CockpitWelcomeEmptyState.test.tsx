import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { CockpitWelcomeEmptyState } from './CockpitWelcomeEmptyState';

describe('CockpitWelcomeEmptyState', () => {
  it('renders first-run guidance and direct CTA actions', () => {
    render(
      <MemoryRouter>
        <CockpitWelcomeEmptyState
          onCustomizeDashboard={vi.fn()}
          onStartTour={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /start your cockpit/i })).toBeInTheDocument();
    expect(
      screen.getByText(/fastest way to get value is to set up a few core records/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /take the cockpit tour/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add your first customer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create your first inquiry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /customize dashboard/i })).toBeInTheDocument();
  });

  it('routes create CTAs and invokes the tour/customize callbacks', async () => {
    const user = userEvent.setup();
    const onCustomizeDashboard = vi.fn();
    const onStartTour = vi.fn();

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <CockpitWelcomeEmptyState
                onCustomizeDashboard={onCustomizeDashboard}
                onStartTour={onStartTour}
              />
            }
          />
          <Route path="/customers/new" element={<div>Customer create route</div>} />
          <Route path="/inquiries" element={<div>Inquiry route</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /take the cockpit tour/i }));
    await user.click(screen.getByRole('button', { name: /customize dashboard/i }));

    expect(onStartTour).toHaveBeenCalledTimes(1);
    expect(onCustomizeDashboard).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /add your first customer/i }));
    expect(await screen.findByText('Customer create route')).toBeInTheDocument();

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <CockpitWelcomeEmptyState
                onCustomizeDashboard={onCustomizeDashboard}
                onStartTour={onStartTour}
              />
            }
          />
          <Route path="/customers/new" element={<div>Customer create route</div>} />
          <Route path="/inquiries" element={<div>Inquiry route</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /create your first inquiry/i }));
    expect(await screen.findByText('Inquiry route')).toBeInTheDocument();
  });
});
