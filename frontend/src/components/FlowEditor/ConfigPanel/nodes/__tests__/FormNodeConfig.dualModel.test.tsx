import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { FormNodeConfig } from '../FormNodeConfig';

vi.mock('../../EntityFieldPicker', () => {
  return {
    default: (props: any) => {
      return (
        <div>
          <div data-testid="selected-count">{props.selectedFields?.length ?? 0}</div>
          <button
            onClick={() =>
              props.onFieldsChange([
                {
                  name: 'email',
                  label: 'Email',
                  type: 'EmailField',
                  required: true,
                  fieldId: 'sf-123',
                },
              ])
            }
          >
            set-fields
          </button>
        </div>
      );
    },
  };
});

vi.mock('@/services/schemaService', () => ({
  useEntityList: () => ({ data: [] }),
}));

vi.mock('../../hooks/useUpstreamVariables', () => ({
  useUpstreamVariables: () => ({ variables: [] }),
}));

vi.mock('../hooks/useUpstreamVariables', () => ({
  useUpstreamVariables: () => ({ variables: [] }),
}));

describe('FormNodeConfig dual-model', () => {
  it('preselects fields when node.data.formFields is FormField[]', () => {
    render(
      <FormNodeConfig
        node={{
          id: 'n1',
          type: 'form',
          position: { x: 0, y: 0 },
          data: {
            entityType: 'supplier',
            formFields: [
              { id: 'email', type: 'email', label: 'Email', required: true, validation: [] },
            ],
          },
        } as any}
        nodes={[] as any}
        edges={[] as any}
        onUpdateNode={vi.fn()}
      />
    );

    expect(screen.getByTestId('selected-count')).toHaveTextContent('1');
  });

  it('writes formFields when picker changes selection', () => {
    const onUpdateNode = vi.fn();

    render(
      <FormNodeConfig
        node={{
          id: 'n1',
          type: 'form',
          position: { x: 0, y: 0 },
          data: {
            entityType: 'supplier',
            fields: [],
          },
        } as any}
        nodes={[] as any}
        edges={[] as any}
        onUpdateNode={onUpdateNode}
      />
    );

    fireEvent.click(screen.getByText('set-fields'));

    const last = onUpdateNode.mock.calls.at(-1);
    expect(last?.[0]).toBe('n1');

    const nextData = last?.[1];
    expect(nextData.fields).toHaveLength(1);
    expect(nextData.formFields).toHaveLength(1);
    expect(nextData.formFields[0]).toMatchObject({ id: 'email', type: 'email' });
  });
});
