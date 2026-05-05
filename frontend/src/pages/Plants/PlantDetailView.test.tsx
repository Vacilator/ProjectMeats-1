import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const businessApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

const entityFormSurfaceMock = vi.hoisted(() =>
  vi.fn((props: Record<string, unknown>) =>
    props.isOpen ? (
      <div
        data-testid="entity-form-surface"
        data-entity-type={String(props.entityType || '')}
        data-mode={String(props.mode || '')}
        data-variant={String(props.variant || '')}
        data-entity-id={String(props.entityId || '')}
      />
    ) : null
  )
);

vi.mock('@/services/businessApi', () => ({
  businessApi: businessApiMock,
}));

vi.mock('@/components/Cockpit', () => ({
  AIOverviewCard: () => <div data-testid="ai-overview-card" />,
  EntityProfileHeader: () => <div data-testid="entity-profile-header" />,
}));

vi.mock('@/components/Entities/EntityWorkflowStatusPanel', () => ({
  EntityWorkflowStatusPanel: () => <div data-testid="workflow-panel" />,
}));

vi.mock('@/components/Shared', () => ({
  ActivityFeed: () => <div data-testid="activity-feed" />,
  EntityFormSurface: entityFormSurfaceMock,
}));

import PlantDetailView from './PlantDetailView';

describe('PlantDetailView', () => {
  beforeEach(() => {
    businessApiMock.get.mockReset();
    entityFormSurfaceMock.mockClear();
  });

  it('uses the record header and opens plant edit in a modal surface', async () => {
    businessApiMock.get.mockImplementation((url: string) => {
      if (url === 'plants/123/') {
        return Promise.resolve({
          data: {
            id: 123,
            name: 'North Plant',
            supplier: 77,
            supplier_name: 'Acme Foods',
          },
        });
      }

      if (url === 'contacts/') {
        return Promise.resolve({
          data: {
            results: [],
          },
        });
      }

      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    render(
      <MemoryRouter initialEntries={['/plants/123']}>
        <Routes>
          <Route path="/plants/:id" element={<PlantDetailView />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('entity-profile-header')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('entity-form-surface')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Plant' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Plant' }));

    await waitFor(() => {
      expect(screen.getByTestId('entity-form-surface')).toBeInTheDocument();
    });

    const formSurface = screen.getByTestId('entity-form-surface');
    expect(formSurface.getAttribute('data-entity-type')).toBe('plant');
    expect(formSurface.getAttribute('data-mode')).toBe('edit');
    expect(formSurface.getAttribute('data-variant')).toBe('modal');
    expect(formSurface.getAttribute('data-entity-id')).toBe('123');
  });
});
