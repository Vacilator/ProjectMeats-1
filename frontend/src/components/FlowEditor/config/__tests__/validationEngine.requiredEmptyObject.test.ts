import { describe, it, expect } from 'vitest';

import { validateField } from '../validationEngine';

describe('validationEngine (required rule)', () => {
  it('treats empty plain objects as empty for required validation', () => {
    const allValues = {};

    expect(
      validateField(
        {
          id: 'headers',
          label: 'Headers',
          validation: [{ type: 'required', message: 'required' }],
        } as any,
        {},
        allValues
      )
    ).toBe('required');

    expect(
      validateField(
        {
          id: 'headers',
          label: 'Headers',
          validation: [{ type: 'required', message: 'required' }],
        } as any,
        { Authorization: 'Bearer x' },
        allValues
      )
    ).toBeNull();
  });
});
