import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

vi.mock('./EntityFormSurface', () => ({
  EntityFormSurface: (props: Record<string, unknown>) => entityFormSurfaceMock(props),
  default: (props: Record<string, unknown>) => entityFormSurfaceMock(props),
}));

import { UnifiedEntityTable } from './UnifiedEntityTable';

describe('UnifiedEntityTable', () => {
  beforeEach(() => {
    businessApiMock.get.mockReset();
    entityFormSurfaceMock.mockClear();
  });

  it('keeps quick edit form unmounted until the button opens the drawer', async () => {
    businessApiMock.get.mockResolvedValue({
      data: {
        fields: [{ key: 'name', label: 'Name', surfaces: { table: true } }],
      },
    });

    render(
      <MemoryRouter>
        <UnifiedEntityTable
          entityType="plant"
          data={[{ id: '42', name: 'North Plant' }]}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('North Plant')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('entity-form-surface')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /quick edit/i }));

    await waitFor(() => {
      expect(screen.getByTestId('entity-form-surface')).toBeInTheDocument();
    });

    const formSurface = screen.getByTestId('entity-form-surface');
    expect(formSurface.getAttribute('data-entity-type')).toBe('plant');
    expect(formSurface.getAttribute('data-mode')).toBe('edit');
    expect(formSurface.getAttribute('data-variant')).toBe('inline');
    expect(formSurface.getAttribute('data-entity-id')).toBe('42');
  });
});
