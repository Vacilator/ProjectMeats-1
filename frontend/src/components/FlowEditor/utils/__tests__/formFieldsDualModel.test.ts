import { describe, it, expect } from 'vitest';

import {
  getResolvedFormFields,
  getResolvedSelectedFields,
  toFormFieldsFromSelectedFields,
  toSelectedFieldsFromFormFields,
} from '../formFieldsDualModel';

describe('formFieldsDualModel', () => {
  it('converts SelectedField[] to FormField[] (id + label + type + required)', () => {
    const selected = [
      {
        name: 'email',
        label: 'Email',
        type: 'EmailField',
        required: true,
        fieldId: 'sf-123',
        customLabel: 'Work Email',
        cascadeFrom: '{{trigger.email}}',
      },
    ] as any;

    const out = toFormFieldsFromSelectedFields(selected);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: 'email',
      label: 'Work Email',
      type: 'email',
      required: true,
      validation: [],
    });
  });

  it('converts FormField[] to SelectedField[] for EntityFieldPicker', () => {
    const fields = [
      {
        id: 'email',
        type: 'email',
        label: 'Email',
        required: true,
        validation: [],
      },
    ] as any;

    const out = toSelectedFieldsFromFormFields(fields);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      fieldId: 'email',
    });
  });

  it('resolves formFields first, then fields as FormField[], then fields as SelectedField[]', () => {
    const asFormFields = [
      { id: 'a', type: 'text', label: 'A', required: false, validation: [] },
    ] as any;

    const asSelected = [{ name: 'b', label: 'B', type: 'text', required: false, fieldId: 'x' }] as any;

    expect(getResolvedFormFields({ formFields: asFormFields, fields: asSelected })[0]!.id).toBe('a');
    expect(getResolvedFormFields({ fields: asFormFields })[0]!.id).toBe('a');
    expect(getResolvedFormFields({ fields: asSelected })[0]!.id).toBe('b');

    expect(getResolvedSelectedFields({ fields: asSelected })[0]!.name).toBe('b');
    expect(getResolvedSelectedFields({ formFields: asFormFields })[0]!.name).toBe('a');
  });
});
