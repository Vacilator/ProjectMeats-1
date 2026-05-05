import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { PlantDetail } from './PlantDetail';

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
  ActivityFeed: ({ entityType, entityId }: { entityType: string; entityId: string | number }) => (
    <div data-testid="activity-feed">
      {entityType}:{String(entityId)}
    </div>
  ),
  EntityFormSurface: ({
    entityType,
    mode,
    variant,
  }: {
    entityType: string;
    mode: string;
    variant?: string;
  }) => (
    <div data-testid="entity-form-surface">
      {entityType}:{mode}:{variant ?? 'modal'}
    </div>
  ),
}));

const apiGet = vi.fn(async (url: string) => {
  if (url.startsWith('suppliers/')) return { data: { id: 1, name: 'Supplier' } };
  if (url.startsWith('plants/')) return { data: { id: 2, name: 'Plant' } };
  if (url === 'contacts/') return { data: { results: [] } };
  return { data: {} };
});

vi.mock('@/services/businessApi', () => ({
  businessApi: {
    get: (url: string, _config?: unknown) => apiGet(url),
  },
}));

describe('PlantDetail workflows tab', () => {
  beforeEach(() => {
    useAuthStateMock.mockReturnValue({ loading: false, isAuthenticated: true });
    apiGet.mockImplementation(async (url: string) => {
      if (url.startsWith('suppliers/')) return { data: { id: 1, name: 'Supplier' } };
      if (url.startsWith('plants/')) return { data: { id: 2, name: 'Plant' } };
      if (url === 'contacts/') return { data: { results: [] } };
      return { data: {} };
    });
  });

  it('renders an Automation tab that shows the entity workflow status panel', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/suppliers/1/plants/2']}>
        <Routes>
          <Route path="/suppliers/:supplierId/plants/:plantId" element={<PlantDetail />} />
        </Routes>
      </MemoryRouter>
    );

    const automationTab = await screen.findByRole('tab', { name: /automation/i });
    await user.click(automationTab);

    expect(await screen.findByTestId('entity-workflow-status-panel')).toHaveTextContent('plant:2');
  });

  it('navigates plant contacts to the standard contact create flow', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/suppliers/1/plants/2']}>
        <Routes>
          <Route path="/suppliers/:supplierId/plants/:plantId" element={<PlantDetail />} />
          <Route path="/contacts" element={<div data-testid="contacts-route" />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('tab', { name: /plant dept\. contacts/i })).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /\+ add department contact/i }));
    expect(await screen.findByTestId('contacts-route')).toBeInTheDocument();
  });

  it('passes plant ids to activity as strings without numeric coercion', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/suppliers/1/plants/2']}>
        <Routes>
          <Route path="/suppliers/:supplierId/plants/:plantId" element={<PlantDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('tab', { name: /activity/i }));
    expect(await screen.findByTestId('activity-feed')).toHaveTextContent('plant:2');
  });

  it('clones the supplier edit flow by routing plant edits onto the dedicated edit page', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/suppliers/1/plants/2']}>
        <Routes>
          <Route path="/suppliers/:supplierId/plants/:plantId" element={<PlantDetail />} />
          <Route path="/plants/:id/edit" element={<div data-testid="plant-edit-route">Plant Edit Route</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('ai-overview-card')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /edit plant/i }));

    expect(await screen.findByTestId('plant-edit-route')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-overview-card')).not.toBeInTheDocument();
  });

  it('fails closed on unauthorized detail loads instead of rendering the heavy detail tree', async () => {
    const unauthorized = new Error('Unauthorized') as Error & {
      response: { status: number; data: { detail: string } };
    };
    unauthorized.response = { status: 401, data: { detail: 'Unauthorized' } };

    apiGet.mockImplementation(async (url: string) => {
      if (url.startsWith('suppliers/') || url.startsWith('plants/')) throw unauthorized;
      if (url === 'contacts/') throw unauthorized;
      return { data: {} };
    });

    render(
      <MemoryRouter initialEntries={['/suppliers/1/plants/2']}>
        <Routes>
          <Route path="/suppliers/:supplierId/plants/:plantId" element={<PlantDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/authentication required/i)).toBeInTheDocument();
    expect(screen.queryByTestId('ai-overview-card')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /automation/i })).not.toBeInTheDocument();
  });
});
