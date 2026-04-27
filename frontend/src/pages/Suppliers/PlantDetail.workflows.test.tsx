import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { PlantDetail } from './PlantDetail';

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
  EntityFormSurface: () => null,
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
});
