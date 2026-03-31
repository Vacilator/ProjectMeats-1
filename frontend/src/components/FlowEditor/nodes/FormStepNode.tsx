/**
 * Form Step Node Component
 *
 * Visual metaphor: a "page" that lives inside a Form container (formBook).
 *
 * Fixed-height preview (320px) with internal vertical scroll for many fields.
 */

import React, { useMemo } from 'react';
import styled from 'styled-components';
import { Handle, NodeToolbar, Position, type Node, type NodeProps } from '@xyflow/react';
import { ArrowDown, ArrowUp, Edit2, Trash2 } from 'lucide-react';

type PreviewField = {
  id: string;
  label?: string;
  type?: string;
  required?: boolean;
};

export type FormStepNodeData = {
  label?: string;
  stepTitle?: string;
  stepDescription?: string;
  fields?: PreviewField[];
  entityType?: string;
  order?: number;

  // Injected by UnifiedFlowEditor via nodesWithHandlers
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
} & Record<string, unknown>;

const Page = styled.div<{ $selected: boolean }>`
  position: relative;
  width: 320px;
  min-width: 320px;
  max-width: 320px;
  height: 320px;
  background: rgb(var(--color-surface));
  border-radius: 12px;
  border: 1px solid rgb(var(--color-border));
  box-shadow:
    0 10px 24px rgb(var(--color-text-primary) / 0.08),
    0 1px 0 rgb(var(--color-text-primary) / 0.05);
  overflow: hidden;
  transition: box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease;

  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 10px;
    background:
      linear-gradient(
        135deg,
        transparent 0,
        transparent 6px,
        rgb(var(--color-surface)) 6px
      );
    opacity: 0.55;
    pointer-events: none;
  }

  ${(p) =>
    p.$selected
      ? `
    border-color: rgb(var(--color-primary));
    box-shadow:
      0 12px 28px rgb(var(--color-text-primary) / 0.12),
      0 0 0 4px rgb(var(--color-primary) / 0.15);
  `
      : ''}

  &:hover {
    box-shadow:
      0 12px 28px rgb(var(--color-text-primary) / 0.12),
      0 0 0 3px rgb(var(--color-primary) / 0.10);
  }
`;

const Header = styled.div`
  padding: 10px 12px;
  background: rgb(var(--color-background));
  border-bottom: 1px solid rgb(var(--color-border));
  border-top: 4px solid rgb(var(--color-primary));

  &.custom-drag-handle {
    cursor: grab;
  }
  &.custom-drag-handle:active {
    cursor: grabbing;
  }
`;

const TitleRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
`;

const Title = styled.div`
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.2px;
  color: rgb(var(--color-text-primary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PageBadge = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  min-width: 18px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  color: rgb(var(--color-text-secondary));
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
`;

const ToolbarCard = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  border-radius: 10px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.12);
`;

const ToolbarBtn = styled.button<{ $danger?: boolean }>`
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
  color: ${(p) => (p.$danger ? 'rgb(239, 68, 68)' : 'rgb(var(--color-text-primary))')};
  cursor: pointer;

  &:hover {
    background: rgb(var(--color-background-secondary));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Meta = styled.div`
  margin-top: 4px;
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ScrollBody = styled.div`
  height: calc(320px - 54px);
  padding: 10px 12px 12px;
  background: rgb(var(--color-surface));
  overflow-y: auto;
`;

const PreviewCard = styled.div`
  padding: 12px;
  background: rgb(var(--color-background-secondary));
  border-radius: 8px;
  margin-top: 10px;
`;

const PreviewTitle = styled.div`
  font-size: 10px;
  font-weight: 800;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
`;

const PreviewFieldRow = styled.div`
  margin-bottom: 8px;
`;

const PreviewFieldLabel = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-primary));
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PreviewFieldBox = styled.div`
  height: 24px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
`;

const PreviewMore = styled.div`
  font-size: 10px;
  color: rgb(var(--color-text-secondary));
  text-align: center;
  margin-top: 2px;
`;

export const FormStepNode = React.memo<NodeProps<Node<FormStepNodeData>>>(({ data, selected }) => {
  const fields = Array.isArray(data.fields) ? data.fields : [];

  const title = data.stepTitle || data.label || 'Step';
  const entityType = data.entityType ? `Entity: ${data.entityType}` : undefined;
  const pageNumber = typeof data.order === 'number' ? data.order + 1 : undefined;

  const previewFields = useMemo(() => fields.slice(0, 4), [fields]);

  const showToolbar = Boolean(selected);

  return (
    <>
      <NodeToolbar isVisible={!!selected} position={Position.Top}>
        <ToolbarCard
          className="nodrag"
          style={{
            opacity: showToolbar ? 1 : 0,
            transform: `translateY(${showToolbar ? 0 : -4}px) scale(${showToolbar ? 1 : 0.98})`,
            pointerEvents: showToolbar ? 'auto' : 'none',
            transition: 'opacity 0.15s ease, transform 0.15s ease',
          }}
        >
          {(data.onMoveUp || data.onMoveDown) && (
            <>
              <ToolbarBtn
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  data.onMoveUp?.();
                }}
                title="Move up"
                disabled={!data.onMoveUp}
              >
                <ArrowUp size={16} />
              </ToolbarBtn>
              <ToolbarBtn
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  data.onMoveDown?.();
                }}
                title="Move down"
                disabled={!data.onMoveDown}
              >
                <ArrowDown size={16} />
              </ToolbarBtn>
            </>
          )}

          {data.onEdit && (
            <ToolbarBtn
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                data.onEdit?.();
              }}
              title="Edit step"
            >
              <Edit2 size={16} />
            </ToolbarBtn>
          )}

          {data.onDelete && (
            <ToolbarBtn
              type="button"
              $danger
              onClick={(e) => {
                e.stopPropagation();
                data.onDelete?.();
              }}
              title="Delete step"
            >
              <Trash2 size={16} />
            </ToolbarBtn>
          )}
        </ToolbarCard>
      </NodeToolbar>

      <Page $selected={!!selected}>
        <Header className="custom-drag-handle">
          <TitleRow>
            <Title title={title}>{title}</Title>
            {pageNumber !== undefined && <PageBadge title="Step order">{pageNumber}</PageBadge>}
          </TitleRow>
          <Meta title={entityType}>{entityType || 'Form Step'}</Meta>
        </Header>

        <ScrollBody>
          <PreviewCard>
            <PreviewTitle>Fields ({fields.length})</PreviewTitle>
            {previewFields.map((f) => (
              <PreviewFieldRow key={f.id}>
                <PreviewFieldLabel title={f.label || f.id}>
                  {f.label || f.id}
                  {f.required ? ' *' : ''}
                </PreviewFieldLabel>
                <PreviewFieldBox />
              </PreviewFieldRow>
            ))}
            {fields.length > previewFields.length && (
              <PreviewMore>+{fields.length - previewFields.length} more</PreviewMore>
            )}
          </PreviewCard>

          {/* Placeholder for future inline editing */}
          <div style={{ marginTop: 10, fontSize: 11, color: 'rgb(var(--color-text-tertiary))' }}>
            Double-click title to rename
          </div>
        </ScrollBody>

        {/* Handles (kept for compatibility with existing edge patterns) */}
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
          aria-label="Form Step input"
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
          aria-label="Form Step output"
        />
      </Page>
    </>
  );
});

export default FormStepNode;
