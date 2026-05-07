import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const businessApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}));
const navigateMock = vi.hoisted(() => vi.fn());

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

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('./EntityFormSurface', () => ({
  EntityFormSurface: (props: Record<string, unknown>) => entityFormSurfaceMock(props),
  default: (props: Record<string, unknown>) => entityFormSurfaceMock(props),
}));

import { UnifiedEntityTable } from './UnifiedEntityTable';

describe('UnifiedEntityTable', () => {
  beforeEach(() => {
    businessApiMock.get.mockReset();
    entityFormSurfaceMock.mockClear();
    navigateMock.mockReset();
  });

  it('keeps non-plant quick edit on the shared modal surface', async () => {
    businessApiMock.get.mockResolvedValue({
      data: {
        fields: [{ key: 'name', label: 'Name', surfaces: { table: true } }],
      },
    });

    render(
      <UnifiedEntityTable
        entityType="supplier"
        data={[{ id: '42', name: 'North Plant' }]}
      />
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
    expect(formSurface.getAttribute('data-entity-type')).toBe('supplier');
    expect(formSurface.getAttribute('data-mode')).toBe('edit');
    expect(formSurface.getAttribute('data-variant')).toBe('modal');
    expect(formSurface.getAttribute('data-entity-id')).toBe('42');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('uses a readable fallback instead of rendering a raw UUID row title', async () => {
    const uuid = '7d9154f4-1a4d-4f47-b7d4-6223479c1fe7';
    businessApiMock.get.mockResolvedValue({
      data: {
        fields: [],
      },
    });

    render(
      <MemoryRouter>
        <UnifiedEntityTable entityType="plant" data={[{ id: uuid }]} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Plant 7d9154f4/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(uuid)).not.toBeInTheDocument();
  });
});
