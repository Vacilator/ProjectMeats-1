import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { TriggerNode } from '../TriggerNode';

vi.mock('../BaseNode', () => ({
  BaseNode: ({ children }: any) => <div data-testid="base-node">{children}</div>,
}));

vi.mock('../../nodeTypes', () => ({
  getNodeTypeDefinition: vi.fn(() => ({
    id: 'triggerForm',
    name: 'Form Trigger',
    category: 'trigger',
    color: 'rgb(var(--color-primary))',
    icon: '🧾',
    description: 'Form submit',
    maxInputs: 0,
    maxOutputs: 1,
  })),
}));

describe('TriggerNode (legacy triggerType)', () => {
  it('normalizes triggerType=formSubmit to form for rendering', () => {
    render(
      <TriggerNode
        id="n1"
        selected={false}
        dragging={false}
        data={{
          triggerType: 'formSubmit' as any,
          formId: 'form-123',
          label: 'Trigger',
          maxInputs: 0,
          maxOutputs: 1,
        }}
        type="triggerForm"
        xPos={0}
        yPos={0}
        zIndex={0}
        isConnectable={true}
      />
    );

    expect(screen.getByText('FORM')).toBeInTheDocument();
    expect(screen.getByText('Form ID:')).toBeInTheDocument();
    expect(screen.getByText('form-123')).toBeInTheDocument();
  });
});
