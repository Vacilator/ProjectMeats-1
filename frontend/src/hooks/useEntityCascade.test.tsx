import { describe, expect, it } from 'vitest';

import { buildEntityCascade, buildRouteHierarchy } from './useEntityCascade';

describe('entity cascade helpers', () => {
  it('infers supplier context from the current supplier route', () => {
    const result = buildEntityCascade(undefined, undefined, buildRouteHierarchy('/suppliers/7186/plants'));

    expect(result.initialValues).toMatchObject({
      supplier: '7186',
      supplier_id: '7186',
    });
    expect(result.lockedFieldKeys).toEqual(expect.arrayContaining(['supplier', 'supplier_id']));
  });

  it('keeps explicit context when it matches the active route', () => {
    const result = buildEntityCascade(
      { supplier: '7186' },
      { supplierId: 7186 },
      buildRouteHierarchy('/suppliers/7186/plants')
    );

    expect(result.initialValues).toMatchObject({
      supplier: '7186',
      supplier_id: '7186',
    });
    expect(result.lockedFieldKeys).toEqual(expect.arrayContaining(['supplier', 'supplier_id']));
  });
});
