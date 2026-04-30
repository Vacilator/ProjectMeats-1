import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { LocationDetail } from './LocationDetail';

const useAuthStateMock = vi.fn(() => ({ loading: false, isAuthenticated: true }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuthState: () => useAuthStateMock(),
}));

vi.mock('@/components/Cockpit', () => ({
  EntityProfileHeader: () => <div data-testid="entity-profile-header" />,
  AIOverviewCard: () => <div data-testid="ai-overview-card" />,
}));

vi.mock('@/components/Entities/EntityWorkflowStatusPanel', () => ({
  EntityWorkflowStatusPanel: ({ entityType, entityId }: { entityType: string; entityId: string }) => (
    <div data-testid="entity-workflow-status-panel">
      {entityType}:{entityId}
    </div>
  ),
}));

vi.mock('@/components/Shared', () => ({
  ActivityFeed: () => <div data-testid="activity-feed" />,
  EntityFormSurface: () => null,
}));

const apiGet = vi.fn(async (url: string) => {
  if (url.startsWith('customers/')) return { data: { id: 1, name: 'ACME' } };
  if (url.startsWith('locations/')) return { data: { id: 2, name: 'Dock' } };
  if (url === 'contacts/') return { data: { results: [] } };
  return { data: {} };
});

vi.mock('@/services/apiService', () => ({
  apiClient: {
    get: (url: string, _config?: unknown) => apiGet(url),
  },
}));

describe('LocationDetail workflows tab', () => {
  beforeEach(() => {
    useAuthStateMock.mockReturnValue({ loading: false, isAuthenticated: true });
    apiGet.mockImplementation(async (url: string) => {
      if (url.startsWith('customers/')) return { data: { id: 1, name: 'ACME' } };
      if (url.startsWith('locations/')) return { data: { id: 2, name: 'Dock' } };
      if (url === 'contacts/') return { data: { results: [] } };
      return { data: {} };
    });
  });

  it('renders an Automation tab that shows the entity workflow status panel', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/customers/1/locations/2']}>
        <Routes>
          <Route path="/customers/:customerId/locations/:locationId" element={<LocationDetail />} />
        </Routes>
      </MemoryRouter>
    );

    const automationTab = await screen.findByRole('tab', { name: /automation/i });
    await user.click(automationTab);

    expect(await screen.findByTestId('entity-workflow-status-panel')).toHaveTextContent('location:2');
  });

  it('fails closed on unauthorized detail loads instead of rendering the heavy detail tree', async () => {
    const unauthorized = new Error('Unauthorized') as Error & {
      response: { status: number; data: { detail: string } };
    };
    unauthorized.response = { status: 401, data: { detail: 'Unauthorized' } };

    apiGet.mockImplementation(async (url: string) => {
      if (url.startsWith('customers/') || url.startsWith('locations/')) throw unauthorized;
      if (url === 'contacts/') throw unauthorized;
      return { data: {} };
    });

    render(
      <MemoryRouter initialEntries={['/customers/1/locations/2']}>
        <Routes>
          <Route path="/customers/:customerId/locations/:locationId" element={<LocationDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/authentication required/i)).toBeInTheDocument();
    expect(screen.queryByTestId('ai-overview-card')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /automation/i })).not.toBeInTheDocument();
  });
});
