import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { NestedChildrenRenderer } from './NestedChildrenRenderer';

describe('NestedChildrenRenderer', () => {
  it('supports toggle fields inside nested children', () => {
    const onChange = vi.fn();

    render(
      <NestedChildrenRenderer
        field={{
          id: 'options',
          label: 'Options',
          type: 'nested-children',
          itemSchema: {
            fields: [
              { id: 'label', label: 'Label', type: 'text' },
              { id: 'disabled', label: 'Disabled', type: 'toggle' },
            ],
          },
        } as any}
        value={[{ label: 'A', disabled: false }]}
        onChange={onChange}
      />
    );

    const disabled = screen.getByLabelText('Disabled') as HTMLInputElement;
    expect(disabled.checked).toBe(false);

    fireEvent.click(disabled);

    expect(onChange).toHaveBeenCalledWith([{ label: 'A', disabled: true }]);
  });

  it('allows keyboard toggle of child expansion', () => {
    render(
      <NestedChildrenRenderer
        field={{
          id: 'options',
          label: 'Options',
          type: 'nested-children',
          itemSchema: {
            fields: [
              { id: 'label', label: 'Label', type: 'text' },
              { id: 'disabled', label: 'Disabled', type: 'toggle' },
            ],
          },
        } as any}
        value={[{ label: 'A', disabled: false }, { label: 'B', disabled: false }]}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('Disabled')).toBeNull();

    const header = screen.getByLabelText('Toggle item 1');
    fireEvent.keyDown(header, { key: 'Enter' });

    expect(screen.getByLabelText('Disabled')).toBeInTheDocument();
  });
});
