import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { PlantDetail } from './PlantDetail';

const useAuthStateMock = vi.fn(() => ({ loading: false, isAuthenticated: true }));
const standalonePlantEditFormMock = vi.fn(
  ({ plantId }: { plantId: string }) => (
    <div data-testid="standalone-plant-edit-form">standalone:{plantId}</div>
  )
);

vi.mock('@/contexts/AuthContext', () => ({
  useAuthState: () => useAuthStateMock(),
}));
const entityFormSurfaceMock = vi.fn(
  ({
    entityType,
    entityId,
    mode,
    variant,
    isOpen,
    initialValues,
  }: {
    entityType: string;
    entityId?: string | number;
    mode: string;
    variant?: string;
    isOpen?: boolean;
    initialValues?: Record<string, unknown>;
  }) =>
    isOpen ? (
      <div data-testid="entity-form-surface">
        {entityType}:{mode}:{variant || 'modal'}:{String(entityId || '')}:{String(initialValues?.plant || '')}:{String(initialValues?.supplier || '')}
      </div>
    ) : null
);

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}{location.search}</div>;
};

vi.mock('@/components/Cockpit', () => ({
  EntityProfileHeader: () => <div data-testid="entity-profile-header" />,
  AIOverviewCard: () => <div data-testid="ai-overview-card" />,
}));

vi.mock('@/pages/Plants/StandalonePlantEditForm', () => ({
  default: (props: { plantId: string }) => standalonePlantEditFormMock(props),
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
  EntityFormSurface: (props: {
    entityType: string;
    entityId?: string | number;
    mode: string;
    variant?: string;
    isOpen?: boolean;
    initialValues?: Record<string, unknown>;
  }) => entityFormSurfaceMock(props),
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

beforeEach(() => {
  entityFormSurfaceMock.mockClear();
  standalonePlantEditFormMock.mockClear();
});

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

  it('opens plant contact creation on the plant detail route with plant context', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/suppliers/1/plants/2']}>
        <LocationProbe />
        <Routes>
          <Route path="/suppliers/:supplierId/plants/:plantId" element={<PlantDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('tab', { name: /plant dept\. contacts/i })).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /\+ add department contact/i }));

    expect(await screen.findByTestId('location-probe')).toHaveTextContent(
      '/suppliers/1/plants/2?createDeptContact=1'
    );
    expect(await screen.findByTestId('entity-form-surface')).toHaveTextContent(
      'contact:create:modal::2:1'
    );

    expect(
      entityFormSurfaceMock.mock.calls.some(
        ([props]) =>
          Boolean(props?.isOpen) &&
          props?.entityType === 'contact' &&
          props?.mode === 'create' &&
          props?.initialValues?.plant === '2' &&
          props?.initialValues?.supplier === '1'
      )
    ).toBe(true);
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

  it('unmounts the detail tree and mounts the standalone editor when edit is clicked', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/suppliers/1/plants/2']}>
        <Routes>
          <Route path="/suppliers/:supplierId/plants/:plantId" element={<PlantDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('button', { name: /edit plant/i }));

    expect(await screen.findByTestId('standalone-plant-edit-form')).toHaveTextContent('standalone:2');
    expect(screen.queryByTestId('entity-profile-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('entity-form-surface')).not.toBeInTheDocument();
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
