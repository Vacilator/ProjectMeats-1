import { describe, expect, it } from 'vitest';

import { buildFlowHistoryState, shouldAutoSaveWorkflow } from './editorState';

describe('editorState utilities', () => {
  it('buildFlowHistoryState strips function-valued node data and produces a stable signature', () => {
    const first = buildFlowHistoryState(
      [
        {
          id: 'node-1',
          type: 'trigger',
          position: { x: 10, y: 20 },
          data: {
            label: 'Manual Trigger',
            onSave: () => undefined,
            config: {
              timeout: 30,
              formatter: () => undefined,
            },
          },
        } as any,
      ],
      [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
        } as any,
      ],
    );

    const second = buildFlowHistoryState(
      [
        {
          id: 'node-1',
          type: 'trigger',
          position: { x: 10, y: 20 },
          data: {
            label: 'Manual Trigger',
            onSave: () => undefined,
            config: {
              timeout: 30,
              formatter: () => undefined,
            },
          },
        } as any,
      ],
      [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
        } as any,
      ],
    );

    expect(first.nodes[0]?.data).toEqual({
      label: 'Manual Trigger',
      config: {
        timeout: 30,
      },
    });
    expect(first.signature).toBe(second.signature);
  });

  it('only autosaves persisted draft workflows with unsaved valid changes', () => {
    expect(
      shouldAutoSaveWorkflow({
        currentWorkflowId: 'wf-1',
        currentWorkflowStatus: 'draft',
        hasUnsavedChanges: true,
        readOnly: false,
        isSaving: false,
        validationErrorCount: 0,
      }),
    ).toBe(true);

    expect(
      shouldAutoSaveWorkflow({
        currentWorkflowId: 'wf-1',
        currentWorkflowStatus: 'active',
        hasUnsavedChanges: true,
        readOnly: false,
        isSaving: false,
        validationErrorCount: 0,
      }),
    ).toBe(false);

    expect(
      shouldAutoSaveWorkflow({
        currentWorkflowId: undefined,
        currentWorkflowStatus: 'draft',
        hasUnsavedChanges: true,
        readOnly: false,
        isSaving: false,
        validationErrorCount: 0,
      }),
    ).toBe(false);
  });
});
