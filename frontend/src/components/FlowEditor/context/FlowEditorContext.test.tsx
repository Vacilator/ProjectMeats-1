import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FlowEditorProvider, useFlowEditorNodeActions } from './FlowEditorContext';

function NodeActionProbe() {
  const nodeActions = useFlowEditorNodeActions();

  return (
    <div>
      <button type="button" onClick={() => nodeActions.editNode('node-1')}>
        edit
      </button>
      <button type="button" onClick={() => nodeActions.moveNode('node-1', 1)}>
        move
      </button>
      <span>{nodeActions.isLastInWorkflow('node-1') ? 'last' : 'not-last'}</span>
    </div>
  );
}

describe('FlowEditorProvider nodeActions', () => {
  it('provides node action callbacks through context', () => {
    const editNode = vi.fn();
    const moveNode = vi.fn();

    render(
      <FlowEditorProvider
        nodeActions={{
          editNode,
          deleteNode: vi.fn(),
          duplicateNode: vi.fn(),
          saveWorkflow: vi.fn(),
          changeNodeTitle: vi.fn(),
          insertAfterNode: vi.fn(),
          addStepInsideForm: vi.fn(),
          moveNode,
          isLastInWorkflow: (nodeId) => nodeId === 'node-1',
        }}
      >
        <NodeActionProbe />
      </FlowEditorProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'move' }));

    expect(editNode).toHaveBeenCalledWith('node-1');
    expect(moveNode).toHaveBeenCalledWith('node-1', 1);
    expect(screen.getByText('last')).toBeInTheDocument();
  });
});
