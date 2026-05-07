import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const navigateMock = vi.fn();
const businessApiGetMock = vi.fn();

vi.mock('@/services/businessApi', () => ({
  businessApi: {
    get: (...args: unknown[]) => businessApiGetMock(...args),
  },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('./EntityFormSurface', () => ({
  EntityFormSurface: ({
    entityType,
    mode,
    variant,
    entityId,
    isOpen,
  }: {
    entityType: string;
    mode: string;
    variant?: string;
    entityId?: string | number;
    isOpen?: boolean;
  }) =>
    isOpen ? (
      <div data-testid="entity-form-surface">
        {entityType}:{mode}:{variant ?? 'modal'}:{String(entityId ?? '')}
      </div>
    ) : null,
}));

import { UnifiedEntityTable } from './UnifiedEntityTable';

describe('UnifiedEntityTable quick edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    businessApiGetMock.mockResolvedValue({ data: { fields: [] } });
  });

  it('opens non-plant quick edits on the shared modal surface', async () => {
    const user = userEvent.setup();

    render(
      <UnifiedEntityTable
        entityType="supplier"
        data={[{ id: '12', name: 'Acme Supplier' }]}
      />
    );

    await user.click(await screen.findByRole('button', { name: /quick edit/i }));

    expect(await screen.findByTestId('entity-form-surface')).toHaveTextContent(
      'supplier:edit:modal:12'
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('routes plant quick edit through the safe supplier plant detail editor when supplier context exists', async () => {
    const user = userEvent.setup();

    render(
      <UnifiedEntityTable
        entityType="plant"
        data={[{ id: '42', name: 'North Plant', supplier: '7' }]}
      />
    );

    await user.click(await screen.findByRole('button', { name: /quick edit/i }));

    expect(navigateMock).toHaveBeenCalledWith('/suppliers/7/plants/42', {
      state: { startEditing: true },
    });
    expect(screen.queryByTestId('entity-form-surface')).not.toBeInTheDocument();
  });

  it('routes orphaned plant quick edits to the standalone plant edit route', async () => {
    const user = userEvent.setup();

    render(
      <UnifiedEntityTable
        entityType="plant"
        data={[{ id: '42', name: 'North Plant' }]}
      />
    );

    await user.click(await screen.findByRole('button', { name: /quick edit/i }));

    expect(navigateMock).toHaveBeenCalledWith('/plants/42/edit');
    expect(screen.queryByTestId('entity-form-surface')).not.toBeInTheDocument();
  });
});
