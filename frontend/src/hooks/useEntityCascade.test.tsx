import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { useEntityCascade } from './useEntityCascade';

const createWrapper =
  (initialPath: string) =>
  ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
  );

describe('useEntityCascade', () => {
  it('infers supplier context from the current supplier route', () => {
    const { result } = renderHook(() => useEntityCascade(undefined, undefined), {
      wrapper: createWrapper('/suppliers/7186/plants'),
    });

    expect(result.current.initialValues).toMatchObject({
      supplier: '7186',
      supplier_id: '7186',
    });
    expect(result.current.lockedFieldKeys).toEqual(
      expect.arrayContaining(['supplier', 'supplier_id'])
    );
  });

  it('keeps explicit context when it matches the active route', () => {
    const { result } = renderHook(
      () => useEntityCascade({ supplier: '7186' }, { supplierId: 7186 }),
      {
        wrapper: createWrapper('/suppliers/7186/plants'),
      }
    );

    expect(result.current.initialValues).toMatchObject({
      supplier: '7186',
      supplier_id: '7186',
    });
    expect(result.current.lockedFieldKeys).toEqual(
      expect.arrayContaining(['supplier', 'supplier_id'])
    );
  });
});
