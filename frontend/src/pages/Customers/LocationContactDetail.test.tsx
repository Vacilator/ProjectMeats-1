import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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

import LocationContactDetail from './LocationContactDetail';

describe('LocationContactDetail', () => {
  beforeEach(() => {
    apiClientMock.get.mockReset();
  });

  it('renders breadcrumb display names instead of raw route ids', async () => {
    apiClientMock.get.mockImplementation((url: string) => {
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

    expect(screen.getByText('Big City Market')).toBeInTheDocument();
    expect(screen.getByText('West Dock')).toBeInTheDocument();
    expect(screen.getByText('Taylor Nguyen')).toBeInTheDocument();
    expect(screen.queryByText('Customer #1')).not.toBeInTheDocument();
    expect(screen.queryByText('Location #2')).not.toBeInTheDocument();
    expect(screen.queryByText('Contact #3')).not.toBeInTheDocument();
  });
});
