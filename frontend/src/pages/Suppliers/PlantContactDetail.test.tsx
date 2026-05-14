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

import PlantContactDetail from './PlantContactDetail';

describe('PlantContactDetail', () => {
  beforeEach(() => {
    businessApiMock.get.mockReset();
  });

  it('renders profile and loads entity data', async () => {
    businessApiMock.get.mockImplementation((url: string) => {
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

    // Verify all three entity endpoints were called
    expect(businessApiMock.get).toHaveBeenCalledWith('suppliers/1/');
    expect(businessApiMock.get).toHaveBeenCalledWith('plants/2/');
    expect(businessApiMock.get).toHaveBeenCalledWith('contacts/3/');
  });

  it('renders an activity tab for the contact record', async () => {
    const user = userEvent.setup();

    businessApiMock.get.mockImplementation((url: string) => {
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
