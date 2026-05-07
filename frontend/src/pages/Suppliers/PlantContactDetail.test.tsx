import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@/services/apiService', () => ({
  apiClient: apiClientMock,
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

import PlantContactDetail from './PlantContactDetail';

describe('PlantContactDetail', () => {
  beforeEach(() => {
    apiClientMock.get.mockReset();
  });

  it('renders breadcrumb display names instead of raw route ids', async () => {
    apiClientMock.get.mockImplementation((url: string) => {
      if (url === 'suppliers/1/') return Promise.resolve({ data: { id: 1, name: 'Acme Foods' } });
      if (url === 'plants/2/') return Promise.resolve({ data: { id: 2, name: 'North Plant' } });
      if (url === 'contacts/3/') {
        return Promise.resolve({ data: { id: 3, first_name: 'Jamie', last_name: 'Smith' } });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    render(
      <MemoryRouter initialEntries={['/suppliers/1/plants/2/contacts/3']}>
        <Routes>
          <Route
            path="/suppliers/:supplierId/plants/:plantId/contacts/:contactId"
            element={<PlantContactDetail />}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('entity-profile-header')).toBeInTheDocument();
    });

    expect(screen.getByText('Acme Foods')).toBeInTheDocument();
    expect(screen.getByText('North Plant')).toBeInTheDocument();
    expect(screen.getByText('Jamie Smith')).toBeInTheDocument();
    expect(screen.queryByText('Supplier #1')).not.toBeInTheDocument();
    expect(screen.queryByText('Plant #2')).not.toBeInTheDocument();
    expect(screen.queryByText('Contact #3')).not.toBeInTheDocument();
  });

  it('renders an activity tab for the contact record', async () => {
    const user = userEvent.setup();

    apiClientMock.get.mockImplementation((url: string) => {
      if (url === 'suppliers/1/') return Promise.resolve({ data: { id: 1, name: 'Acme Foods' } });
      if (url === 'plants/2/') return Promise.resolve({ data: { id: 2, name: 'North Plant' } });
      if (url === 'contacts/3/') {
        return Promise.resolve({ data: { id: 3, first_name: 'Jamie', last_name: 'Smith' } });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    render(
      <MemoryRouter initialEntries={['/suppliers/1/plants/2/contacts/3']}>
        <Routes>
          <Route
            path="/suppliers/:supplierId/plants/:plantId/contacts/:contactId"
            element={<PlantContactDetail />}
          />
        </Routes>
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('tab', { name: /activity/i }));
    expect(await screen.findByTestId('activity-feed')).toHaveTextContent('contact:3');
  });
});
