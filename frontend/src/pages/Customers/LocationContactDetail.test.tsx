import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const businessApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@/services/businessApi', () => ({
  businessApi: businessApiMock,
}));

vi.mock('@/components/Cockpit', () => ({
  AIOverviewCard: () => <div data-testid="ai-overview-card" />,
  EntityProfileHeader: () => <div data-testid="entity-profile-header" />,
}));

vi.mock('@/components/Shared', () => ({
  ActivityFeed: ({ entityType, entityId }: { entityType: string; entityId: string | number }) => (
    <div data-testid="activity-feed">
      {entityType}:{String(entityId)}
    </div>
  ),
}));

import LocationContactDetail from './LocationContactDetail';

describe('LocationContactDetail', () => {
  beforeEach(() => {
    businessApiMock.get.mockReset();
  });

  it('renders profile and loads entity data', async () => {
    businessApiMock.get.mockImplementation((url: string) => {
      if (url === 'customers/1/') return Promise.resolve({ data: { id: 1, name: 'Big City Market' } });
      if (url === 'locations/2/') return Promise.resolve({ data: { id: 2, name: 'West Dock' } });
      if (url === 'contacts/3/') {
        return Promise.resolve({ data: { id: 3, first_name: 'Taylor', last_name: 'Nguyen' } });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    render(
      <MemoryRouter initialEntries={['/customers/1/locations/2/contacts/3']}>
        <Routes>
          <Route
            path="/customers/:customerId/locations/:locationId/contacts/:contactId"
            element={<LocationContactDetail />}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('entity-profile-header')).toBeInTheDocument();
    });

    expect(businessApiMock.get).toHaveBeenCalledWith('customers/1/');
    expect(businessApiMock.get).toHaveBeenCalledWith('locations/2/');
    expect(businessApiMock.get).toHaveBeenCalledWith('contacts/3/');
  });

  it('renders an activity tab for the contact record', async () => {
    const user = userEvent.setup();

    businessApiMock.get.mockImplementation((url: string) => {
      if (url === 'customers/1/') return Promise.resolve({ data: { id: 1, name: 'Big City Market' } });
      if (url === 'locations/2/') return Promise.resolve({ data: { id: 2, name: 'West Dock' } });
      if (url === 'contacts/3/') {
        return Promise.resolve({ data: { id: 3, first_name: 'Taylor', last_name: 'Nguyen' } });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    render(
      <MemoryRouter initialEntries={['/customers/1/locations/2/contacts/3']}>
        <Routes>
          <Route
            path="/customers/:customerId/locations/:locationId/contacts/:contactId"
            element={<LocationContactDetail />}
          />
        </Routes>
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('tab', { name: /activity/i }));
    expect(await screen.findByTestId('activity-feed')).toHaveTextContent('contact:3');
  });
});
