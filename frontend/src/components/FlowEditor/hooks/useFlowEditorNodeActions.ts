import { useMemo } from 'react';
import type { Node } from '@xyflow/react';

import type { FlowEditorNodeActionsValue } from '../context/FlowEditorContext';

interface UseFlowEditorNodeActionsOptions {
  nodes: Node[];
  editNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void | Promise<void>;
  duplicateNode: (nodeId: string) => void;
  saveWorkflow: () => void | Promise<void>;
  changeNodeTitle: (nodeId: string, newTitle: string) => void;
  moveNode: (nodeId: string, delta: -1 | 1) => void;
  addFormStepInsideContainer: (containerId: string, anchorNodeId?: string) => void;
  lastNodeIdSet: Set<string>;
  isFormProcessContainerType: (nodeType: string | undefined | null) => boolean;
}

export function useFlowEditorNodeActions({
  nodes,
  editNode,
  deleteNode,
  duplicateNode,
  saveWorkflow,
  changeNodeTitle,
  moveNode,
  addFormStepInsideContainer,
  lastNodeIdSet,
  isFormProcessContainerType,
}: UseFlowEditorNodeActionsOptions): FlowEditorNodeActionsValue {
  return useMemo(() => {
    const nodeById = new Map(nodes.map((node) => [node.id, node] as const));

    const isFormContainerNode = (node?: Node) =>
      !!node && isFormProcessContainerType(((node.data as any)?.nodeType as string | undefined) || node.type);

    const insertAfterNode = (nodeId: string) => {
      const node = nodeById.get(nodeId);
      const data = node?.data ?? {};
      if (typeof (data as any).onInsertAfter === 'function') {
        (data as any).onInsertAfter();
        return;
      }

      window.dispatchEvent(
        new CustomEvent('pm:openNodePalette', {
          detail: { anchorNodeId: nodeId },
        })
      );
    };

    const addStepInsideForm = (nodeId: string) => {
      const node = nodeById.get(nodeId);
      if (!node) {
        return;
      }

      const data = node.data ?? {};
      if (typeof (data as any).onAddStepInsideForm === 'function') {
        (data as any).onAddStepInsideForm();
        return;
      }

      const parent = node.parentId ? nodeById.get(node.parentId) : undefined;
      const parentIsFormContainer = isFormContainerNode(parent);
      const nodeIsFormContainer = isFormContainerNode(node);

      if (nodeIsFormContainer) {
        addFormStepInsideContainer(node.id);
        return;
      }

      if (parentIsFormContainer && node.parentId) {
        addFormStepInsideContainer(node.parentId, node.id);
        return;
      }

      insertAfterNode(nodeId);
    };

    return {
      editNode: (nodeId: string) => {
        const node = nodeById.get(nodeId);
        const onEdit = (node?.data as any)?.onEdit;
        if (typeof onEdit === 'function') {
          onEdit();
          return;
        }
        editNode(nodeId);
      },
      deleteNode: (nodeId: string) => {
        const node = nodeById.get(nodeId);
        const onDelete = (node?.data as any)?.onDelete;
        if (typeof onDelete === 'function') {
          return onDelete();
        }
        return deleteNode(nodeId);
      },
      duplicateNode: (nodeId: string) => {
        const node = nodeById.get(nodeId);
        const onDuplicate = (node?.data as any)?.onDuplicate;
        if (typeof onDuplicate === 'function') {
          onDuplicate();
          return;
        }
        duplicateNode(nodeId);
      },
      saveWorkflow,
      changeNodeTitle: (nodeId: string, newTitle: string) => {
        const node = nodeById.get(nodeId);
        const onTitleChange = (node?.data as any)?.onTitleChange;
        if (typeof onTitleChange === 'function') {
          onTitleChange(newTitle);
          return;
        }
        changeNodeTitle(nodeId, newTitle);
      },
      insertAfterNode,
      addStepInsideForm,
      moveNode,
      isLastInWorkflow: (nodeId: string) => lastNodeIdSet.has(nodeId),
    };
  }, [
    addFormStepInsideContainer,
    changeNodeTitle,
    deleteNode,
    duplicateNode,
    editNode,
    isFormProcessContainerType,
    lastNodeIdSet,
    moveNode,
    nodes,
    saveWorkflow,
  ]);
}
