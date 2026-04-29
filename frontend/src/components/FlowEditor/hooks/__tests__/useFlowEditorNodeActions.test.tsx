import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Node } from '@xyflow/react';

import { useFlowEditorNodeActions } from '../useFlowEditorNodeActions';

const isFormProcessContainerType = (nodeType: string | undefined | null) =>
  nodeType === 'formBook' || nodeType === 'formMultiStepContainer';

const baseActions = () => ({
  editNode: vi.fn(),
  deleteNode: vi.fn(),
  duplicateNode: vi.fn(),
  saveWorkflow: vi.fn(),
  changeNodeTitle: vi.fn(),
  moveNode: vi.fn(),
  addFormStepInsideContainer: vi.fn(),
  lastNodeIdSet: new Set<string>(),
  isFormProcessContainerType,
});

describe('useFlowEditorNodeActions', () => {
  it('prefers node override callbacks before fallback handlers', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onDuplicate = vi.fn();
    const onTitleChange = vi.fn();
    const actions = baseActions();

    const node = {
      id: 'node-1',
      type: 'action',
      position: { x: 0, y: 0 },
      data: { onEdit, onDelete, onDuplicate, onTitleChange },
    } as unknown as Node;

    const { result } = renderHook(() =>
      useFlowEditorNodeActions({
        ...actions,
        nodes: [node],
      })
    );

    result.current.editNode('node-1');
    result.current.deleteNode('node-1');
    result.current.duplicateNode('node-1');
    result.current.changeNodeTitle('node-1', 'Renamed');

    expect(onEdit).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
    expect(onDuplicate).toHaveBeenCalled();
    expect(onTitleChange).toHaveBeenCalledWith('Renamed');
    expect(actions.editNode).not.toHaveBeenCalled();
    expect(actions.deleteNode).not.toHaveBeenCalled();
    expect(actions.duplicateNode).not.toHaveBeenCalled();
    expect(actions.changeNodeTitle).not.toHaveBeenCalled();
  });

  it('adds a step inside a form container when the selected node is itself a container', () => {
    const actions = baseActions();
    const node = {
      id: 'container-1',
      type: 'formBook',
      position: { x: 0, y: 0 },
      data: { nodeType: 'formBook' },
    } as unknown as Node;

    const { result } = renderHook(() =>
      useFlowEditorNodeActions({
        ...actions,
        nodes: [node],
      })
    );

    result.current.addStepInsideForm('container-1');

    expect(actions.addFormStepInsideContainer).toHaveBeenCalledWith('container-1');
  });

  it('adds a step inside the parent container when the selected node is a child page', () => {
    const actions = baseActions();
    const parent = {
      id: 'container-1',
      type: 'formBook',
      position: { x: 0, y: 0 },
      data: { nodeType: 'formBook' },
    } as unknown as Node;
    const child = {
      id: 'step-1',
      parentId: 'container-1',
      type: 'formStep',
      position: { x: 0, y: 0 },
      data: {},
    } as unknown as Node;

    const { result } = renderHook(() =>
      useFlowEditorNodeActions({
        ...actions,
        nodes: [parent, child],
      })
    );

    result.current.addStepInsideForm('step-1');

    expect(actions.addFormStepInsideContainer).toHaveBeenCalledWith('container-1', 'step-1');
  });

  it('dispatches the node palette event when addStepInsideForm falls back to insert-after', () => {
    const actions = baseActions();
    const node = {
      id: 'node-1',
      type: 'action',
      position: { x: 0, y: 0 },
      data: {},
    } as unknown as Node;
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    const { result } = renderHook(() =>
      useFlowEditorNodeActions({
        ...actions,
        nodes: [node],
      })
    );

    result.current.addStepInsideForm('node-1');

    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    expect(dispatchEventSpy.mock.calls[0]?.[0]).toBeInstanceOf(CustomEvent);
    expect((dispatchEventSpy.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      anchorNodeId: 'node-1',
    });
  });

  it('prefers node-level onInsertAfter callbacks over the palette fallback', () => {
    const actions = baseActions();
    const onInsertAfter = vi.fn();
    const node = {
      id: 'node-1',
      type: 'action',
      position: { x: 0, y: 0 },
      data: { onInsertAfter },
    } as unknown as Node;
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    const { result } = renderHook(() =>
      useFlowEditorNodeActions({
        ...actions,
        nodes: [node],
      })
    );
    const paletteEventsBefore = dispatchEventSpy.mock.calls.filter(
      ([event]) => event instanceof CustomEvent && event.type === 'pm:openNodePalette'
    ).length;

    result.current.insertAfterNode('node-1');
    const paletteEventsAfter = dispatchEventSpy.mock.calls.filter(
      ([event]) => event instanceof CustomEvent && event.type === 'pm:openNodePalette'
    ).length;

    expect(onInsertAfter).toHaveBeenCalled();
    expect(paletteEventsAfter).toBe(paletteEventsBefore);
  });

  it('reports whether a node is last in workflow from the injected sink set', () => {
    const actions = baseActions();
    actions.lastNodeIdSet = new Set(['last-node']);

    const { result } = renderHook(() =>
      useFlowEditorNodeActions({
        ...actions,
        nodes: [],
      })
    );

    expect(result.current.isLastInWorkflow('last-node')).toBe(true);
    expect(result.current.isLastInWorkflow('other-node')).toBe(false);
  });
});
