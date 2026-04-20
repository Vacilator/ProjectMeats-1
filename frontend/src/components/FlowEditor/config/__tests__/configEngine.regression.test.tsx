import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import type { ConfigField, ConditionalRule } from '../types';
import { evaluateCondition } from '../conditionalLogic';
import { validateField } from '../validationEngine';
import { renderSelectField, renderTextField } from '../fieldRenderers/basicRenderers';
import { renderFieldMapping, renderVariablePicker } from '../fieldRenderers/complexRenderers';
import { NestedChildrenRenderer } from '../../ConfigPanel/NestedChildrenRenderer';

// Mock FieldMappingPanel to keep renderer tests lightweight + deterministic.
const { mockFieldMappingPanel } = vi.hoisted(() => ({
  mockFieldMappingPanel: vi.fn(),
}));

vi.mock('../../ConfigPanel/FieldMappingPanel', () => ({
  default: (props: any) => {
    mockFieldMappingPanel(props);
    return <div data-testid="field-mapping-panel" />;
  },
}));

describe('FlowEditor config engine regressions', () => {
  it('conditionalLogic supports in / notIn operators', () => {
    const ruleIn: ConditionalRule = { field: 'status', operator: 'in', value: ['open', 'pending'] };
    expect(evaluateCondition(ruleIn, { status: 'open' })).toBe(true);
    expect(evaluateCondition(ruleIn, { status: 'closed' })).toBe(false);

    const ruleNotIn: ConditionalRule = { field: 'status', operator: 'notIn', value: ['closed'] };
    expect(evaluateCondition(ruleNotIn, { status: 'open' })).toBe(true);
    expect(evaluateCondition(ruleNotIn, { status: 'closed' })).toBe(false);

    // Arrays should be supported (any-match semantics)
    const arrayRule: ConditionalRule = { field: 'tags', operator: 'in', value: ['a', 'b'] };
    expect(evaluateCondition(arrayRule, { tags: ['c', 'b'] })).toBe(true);
    expect(evaluateCondition(arrayRule, { tags: ['c'] })).toBe(false);
  });

  it('validationEngine treats pattern as alias of regex', () => {
    const field: ConfigField = {
      id: 'sku',
      label: 'SKU',
      type: 'text',
      validation: [
        {
          type: 'pattern',
          value: '^SKU-[0-9]+$',
          message: 'Invalid SKU',
        },
      ],
    };

    expect(validateField(field, 'SKU-123', {})).toBe(null);
    expect(validateField(field, 'BAD', {})).toBe('Invalid SKU');
  });

  it('renderSelectField supports legacy multiSelect alias and emits string[]', () => {
    const field: ConfigField = {
      id: 'colors',
      label: 'Colors',
      type: 'multiSelect',
      options: [
        { value: 'red', label: 'Red' },
        { value: 'blue', label: 'Blue' },
      ],
    };

    const onChange = vi.fn();

    const node = renderSelectField({
      field,
      value: ['red'],
      onChange,
      error: undefined,
      disabled: false,
    });

    render(<>{node}</>);

    const select = screen.getByRole('listbox') as HTMLSelectElement;

    // Simulate selecting both options
    Array.from(select.options).forEach((opt) => {
      opt.selected = true;
    });
    fireEvent.change(select);

    expect(onChange).toHaveBeenCalledWith(['red', 'blue']);
  });

  it('renderTextField preserves 0 and parses number inputs to numbers', () => {
    const field: ConfigField = {
      id: 'count',
      label: 'Count',
      type: 'number',
    };

    const onChange = vi.fn();

    const node = renderTextField({
      field,
      value: 0,
      onChange,
      error: undefined,
      disabled: false,
    });

    render(<>{node}</>);

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('0');

    fireEvent.change(input, { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith(5);

    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('NestedChildrenRenderer can render when schema uses itemSchema (no childSchema)', () => {
    const field: ConfigField = {
      id: 'options',
      label: 'Options',
      type: 'nested-children',
      itemSchema: {
        fields: [
          { id: 'label', label: 'Label', type: 'text', defaultValue: '' },
          { id: 'value', label: 'Value', type: 'text', defaultValue: '' },
        ],
      },
    };

    const Wrapper: React.FC = () => {
      const [value, setValue] = React.useState<any[]>([]);
      return <NestedChildrenRenderer field={field} value={value} onChange={setValue} />;
    };

    render(<Wrapper />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    // Child fields should render (auto-expanded)
    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('renderVariablePicker supports multiple selection (string[]) when field.multiple=true', () => {
    const field: ConfigField = {
      id: 'attachments',
      label: 'Attachments',
      type: 'variablePicker',
      multiple: true,
    };

    const upstream = [
      {
        template: '{{form.email}}',
        fieldName: 'email',
        fieldLabel: 'Email',
        fieldType: 'string',
        nodeId: 'n1',
        nodeName: 'Form',
        nodeType: 'form',
      },
      {
        template: '{{form.id}}',
        fieldName: 'id',
        fieldLabel: 'ID',
        fieldType: 'string',
        nodeId: 'n1',
        nodeName: 'Form',
        nodeType: 'form',
      },
    ];

    const Wrapper: React.FC = () => {
      const [val, setVal] = React.useState<string[]>([]);
      return (
        <div>
          {renderVariablePicker({
            field,
            value: val,
            onChange: setVal,
            error: undefined,
            data: { _upstreamVariables: upstream },
          } as any)}
          <div data-testid="value">{JSON.stringify(val)}</div>
        </div>
      );
    };

    render(<Wrapper />);

    // Select two variables
    fireEvent.click(screen.getByText('Email').closest('button')!);
    expect(screen.getByTestId('value')).toHaveTextContent('{{form.email}}');

    fireEvent.click(screen.getByText('ID').closest('button')!);
    expect(screen.getByTestId('value')).toHaveTextContent('{{form.email}}');
    expect(screen.getByTestId('value')).toHaveTextContent('{{form.id}}');

    // Toggle off the first
    fireEvent.click(screen.getByText('Email').closest('button')!);
    expect(screen.getByTestId('value')).not.toHaveTextContent('{{form.email}}');
    expect(screen.getByTestId('value')).toHaveTextContent('{{form.id}}');
  });

  it('renderFieldMapping respects field.entityFieldId (createRecord schema compatibility)', () => {
    const field: ConfigField = {
      id: 'fieldMappings',
      label: 'Field Mappings',
      type: 'field-mapping',
      entityFieldId: 'entity',
    };

    const node = renderFieldMapping({
      field,
      value: [],
      onChange: vi.fn(),
      error: undefined,
      data: {
        entity: 'supplier',
        _upstreamVariables: [
          {
            template: '{{form.email}}',
            fieldName: 'email',
            fieldLabel: 'Email',
            fieldType: 'string',
            nodeId: 'n1',
            nodeName: 'Form',
            nodeType: 'form',
          },
        ],
      },
    } as any);

    render(<>{node}</>);

    expect(screen.getByTestId('field-mapping-panel')).toBeInTheDocument();
    expect(mockFieldMappingPanel).toHaveBeenCalled();

    const props = mockFieldMappingPanel.mock.calls.at(-1)?.[0];
    expect(props.targetEntity).toBe('supplier');
    expect(props.formFields).toEqual([{ id: '{{form.email}}', label: 'Email', type: 'string' }]);
  });
});
