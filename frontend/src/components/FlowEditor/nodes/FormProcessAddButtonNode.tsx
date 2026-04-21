import React from 'react';
import styled from 'styled-components';
import type { Node, NodeProps } from '@xyflow/react';
import { Plus } from 'lucide-react';

export type FormProcessAddButtonData = {
  containerId: string;
  onAddStepInsideForm?: () => void;
};

const Wrap = styled.div`
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: all;
`;

const CircleButton = styled.button`
  width: 56px;
  height: 56px;
  border-radius: 999px;
  border: 2px solid rgb(var(--color-surface));
  background: rgb(var(--color-primary));
  color: white;
  box-shadow:
    0 12px 24px rgba(var(--color-primary), 0.25),
    0 2px 8px rgba(var(--color-overlay), 0.10);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.12s ease, opacity 0.12s ease;

  &:hover {
    transform: translateY(-1px) scale(1.03);
    opacity: 0.96;
  }

  &:active {
    transform: translateY(0) scale(0.98);
  }

  &:focus-visible {
    outline: 3px solid rgba(var(--color-primary), 0.35);
    outline-offset: 4px;
  }
`;

export const FormProcessAddButtonNode = React.memo<NodeProps<Node<FormProcessAddButtonData>>>(({ data }) => {
  return (
    <Wrap className="nodrag nopan">
      <CircleButton
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          data?.onAddStepInsideForm?.();
        }}
        aria-label="Add next step"
        title="Add next step"
      >
        <Plus size={22} />
      </CircleButton>
    </Wrap>
  );
});

export default FormProcessAddButtonNode;
