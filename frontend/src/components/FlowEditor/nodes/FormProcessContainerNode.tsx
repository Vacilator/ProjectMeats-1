import React, { useMemo } from 'react';
import { Handle, NodeToolbar, Position, useNodes } from '@xyflow/react';
import { Pencil } from 'lucide-react';
import styled from 'styled-components';

import type { ContainerNodeData } from './FormProcessNode';

type Props = {
  id: string;
  data: ContainerNodeData & { nodeType?: string };
  selected?: boolean;
};

const Container = styled.div<{ $selected: boolean }>`
  min-width: 220px;
  padding: 10px 12px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  color: rgb(var(--color-text-primary));
  box-shadow:
    0 0 0 1px rgb(var(--color-primary) / 0.12),
    ${(p) => (p.$selected ? '0 0 0 3px rgb(var(--color-primary) / 0.25)' : 'none')};

  &:hover {
    border-color: rgb(var(--color-primary));
  }
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const Title = styled.div`
  font-weight: 700;
  font-size: 13px;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Badge = styled.div`
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: rgb(var(--color-text-secondary));
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
`;

const ToolbarButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;

  &:hover {
    border-color: rgb(var(--color-primary));
  }
`;

/**
 * Non-purple Form Process container.
 * Renders like a standard node, but includes a NodeToolbar for Add Step + Edit.
 */
export const FormProcessContainerNode = React.memo<Props>(({ id, data, selected }) => {
  const nodes = useNodes();

  const stepCount = useMemo(() => {
    const childSteps = nodes.filter(
      (n) => n.parentId === id && ['form', 'formStepSingle', 'formStep', 'formReference'].includes(n.type || '')
    );
    return childSteps.length;
  }, [id, nodes]);

  const title = (data as any)?.label || (data as any)?.containerName || 'Form Process';

  return (
    <>
      <NodeToolbar isVisible position={Position.Top}>
        <div style={{ display: 'flex', gap: 8 }}>
          <ToolbarButton
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              (data as any)?.onEdit?.();
            }}
            title="Configure Form Process"
          >
            <Pencil size={14} /> Edit
          </ToolbarButton>
        </div>
      </NodeToolbar>

      <Container $selected={!!selected}>
        <TitleRow>
          <Title title={title}>{title}</Title>
          <Badge>{stepCount} step{stepCount === 1 ? '' : 's'}</Badge>
        </TitleRow>

        <div style={{ marginTop: 6, fontSize: 11, color: 'rgb(var(--color-text-secondary))', fontWeight: 600 }}>
          Add steps and configure navigation (skip steps, etc.)
        </div>

        <Handle
          type="target"
          position={Position.Top}
          style={{
            left: '50%',
            width: 14,
            height: 14,
            background: 'rgb(var(--color-primary))',
            border: '2px solid rgb(var(--color-surface))',
            borderRadius: 6,
            transform: 'translateX(-50%)',
          }}
          aria-label="Form Process input"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            left: '50%',
            width: 14,
            height: 14,
            background: 'rgb(var(--color-primary))',
            border: '2px solid rgb(var(--color-surface))',
            borderRadius: 6,
            transform: 'translateX(-50%)',
          }}
          aria-label="Form Process output"
        />
      </Container>
    </>
  );
});

export default FormProcessContainerNode;
