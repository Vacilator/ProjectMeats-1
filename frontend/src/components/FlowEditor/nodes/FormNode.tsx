/**
 * Form Node Component (Phase 10: WYSIWYG Form Flow)
 *
 * Visual metaphor: a "ripped page" that can live inside a "book" (formProcessGroup).
 * This intentionally does NOT rely on BaseNode so we can fully customize the UI.
 */

import React, { useCallback } from 'react';
import styled from 'styled-components';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';

type PreviewField = {
  id: string;
  label?: string;
  type?: string;
  required?: boolean;
};

export type FormNodeData = {
  label?: string;
  stepTitle?: string;
  fields?: PreviewField[];
  entityType?: string;
} & Record<string, unknown>;

const Page = styled.div<{ $selected: boolean }>`
  position: relative;
  min-width: 240px;
  max-width: 340px;
  min-height: 260px;
  background: rgb(var(--color-surface));
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  box-shadow: 0 4px 14px rgb(var(--color-text-primary) / 0.08);
  overflow: hidden;
  transition: box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease;

  ${(p) =>
    p.$selected
      ? `
    border-color: rgb(var(--color-primary));
    box-shadow: 0 6px 18px rgb(var(--color-text-primary) / 0.12);
  `
      : ''}

  &:hover {
    box-shadow: 0 6px 18px rgb(var(--color-text-primary) / 0.12);
  }
`;

const Header = styled.div`
  padding: 10px 12px;
  background: rgb(var(--color-background));
  border-bottom: 1px solid rgb(var(--color-border));
  border-top: 4px solid rgb(var(--color-primary));

  /* Drag handle for ReactFlow: configured via nodeDragHandle in UnifiedFlowEditor */
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

const Meta = styled.div`
  margin-top: 4px;
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Body = styled.div`
  padding: 10px 12px 12px;
  background: rgb(var(--color-surface));
`;

const FieldPreview = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const InlineEditor = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const EditorHint = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  text-align: center;
`;

const EditorRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 90px 26px auto;
  gap: 6px;
  align-items: center;
  padding: 8px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  background: rgb(var(--color-background));
`;

const SmallInput = styled.input`
  width: 100%;
  padding: 6px 8px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const SmallSelect = styled.select`
  width: 100%;
  padding: 6px 8px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const IconBtn = styled.button`
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-secondary));
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-text-primary));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const AddFieldBtn = styled.button`
  width: 100%;
  padding: 8px 10px;
  border: 1px dashed rgb(var(--color-border));
  background: transparent;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;

  &:hover {
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.06);
  }
`;

const FieldStub = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
  padding: 8px 8px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  background: rgb(var(--color-background));
`;

const FieldLabel = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Required = styled.span`
  font-size: 11px;
  font-weight: 800;
  color: rgb(var(--color-error));
`;

const MockBox = styled.div<{ $type?: string }>`
  height: ${(p) => (p.$type === 'textarea' ? '16px' : '10px')};
  border-radius: 4px;
  background: rgb(var(--color-border));
  opacity: 0.55;
`;

const Empty = styled.div`
  padding: 10px 0;
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  font-style: italic;
  text-align: center;
`;

const StyledHandle = styled(Handle)<{ $role: 'in' | 'out' }>`
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 2px solid rgb(var(--color-surface));
  background: ${(p) => (p.$role === 'in' ? 'rgb(var(--color-primary))' : 'rgb(var(--color-success))')};
  z-index: 20;

  &.react-flow__handle-top {
    top: -14px;
  }
  &.react-flow__handle-bottom {
    bottom: -14px;
  }
`;

export const FormNode: React.FC<NodeProps<FormNodeData>> = React.memo(({ id, data, selected }) => {
  const { setNodes } = useReactFlow();

  const fields = (data?.fields as PreviewField[] | undefined) ?? [];
  const title =
    (data?.stepTitle as string | undefined) ||
    (data?.label as string | undefined) ||
    'Form';

  const entityType = (data?.entityType as string | undefined) || '';
  const preview = fields.slice(0, 4);
  const showInSituEditor = Boolean(selected);

  const mutateFields = useCallback(
    (mutator: (prev: PreviewField[]) => PreviewField[]) => {
      setNodes((nodes) =>
        nodes.map((n) => {
          if (n.id !== id) return n;
          const prevFields = ((n.data as any)?.fields as PreviewField[] | undefined) ?? [];
          const nextFields = mutator([...prevFields]);
          return {
            ...n,
            data: {
              ...(n.data as any),
              fields: nextFields,
            },
          };
        })
      );
    },
    [id, setNodes]
  );

  const handleAddField = useCallback(() => {
    mutateFields((prev) => [
      ...prev,
      {
        id: `field-${Date.now()}`,
        label: `Field ${prev.length + 1}`,
        type: 'text',
        required: false,
      },
    ]);
  }, [mutateFields]);

  const handleRemoveField = useCallback(
    (fieldId: string) => {
      mutateFields((prev) => prev.filter((f) => f.id !== fieldId));
    },
    [mutateFields]
  );

  const handleMoveField = useCallback(
    (fieldId: string, dir: -1 | 1) => {
      mutateFields((prev) => {
        const idx = prev.findIndex((f) => f.id === fieldId);
        if (idx === -1) return prev;
        const nextIdx = idx + dir;
        if (nextIdx < 0 || nextIdx >= prev.length) return prev;
        const next = [...prev];
        [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
        return next;
      });
    },
    [mutateFields]
  );

  const handleUpdateField = useCallback(
    (fieldId: string, patch: Partial<PreviewField>) => {
      mutateFields((prev) => prev.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)));
    },
    [mutateFields]
  );

  return (
    <Page $selected={Boolean(selected)} role="article" aria-label={`Form node: ${title}`} aria-selected={selected}>
      <StyledHandle id="input" type="target" position={Position.Top} $role="in" aria-label="Input handle" />

      <Header className="custom-drag-handle">
        <TitleRow>
          <Title title={title}>{title}</Title>
          <div style={{ fontSize: 11, color: 'rgb(var(--color-text-secondary))', fontWeight: 700 }}>
            {fields.length} field{fields.length === 1 ? '' : 's'}
          </div>
        </TitleRow>
        {entityType && <Meta>Entity: {entityType}</Meta>}
      </Header>

      <Body className="nodrag">
        {showInSituEditor ? (
          <InlineEditor aria-label="In-situ form field editor">
            {fields.length === 0 ? (
              <Empty>Add fields directly on the canvas</Empty>
            ) : null}

            {fields.map((f, idx) => (
              <EditorRow key={f.id} onMouseDown={(e) => e.stopPropagation()}>
                <SmallInput
                  value={f.label || ''}
                  placeholder="Field label"
                  onChange={(e) => handleUpdateField(f.id, { label: e.target.value })}
                />

                <SmallSelect
                  value={f.type || 'text'}
                  onChange={(e) => handleUpdateField(f.id, { type: e.target.value })}
                >
                  <option value="text">Text</option>
                  <option value="textarea">Textarea</option>
                  <option value="number">Number</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="url">URL</option>
                  <option value="date">Date</option>
                  <option value="datetime">DateTime</option>
                  <option value="select">Select</option>
                  <option value="radio">Radio</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="file">File</option>
                </SmallSelect>

                <input
                  type="checkbox"
                  checked={Boolean(f.required)}
                  onChange={(e) => handleUpdateField(f.id, { required: e.target.checked })}
                  aria-label={`Required: ${f.label || f.id}`}
                  onMouseDown={(e) => e.stopPropagation()}
                />

                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <IconBtn
                    onClick={() => handleMoveField(f.id, -1)}
                    disabled={idx === 0}
                    aria-label="Move field up"
                  >
                    ↑
                  </IconBtn>
                  <IconBtn
                    onClick={() => handleMoveField(f.id, 1)}
                    disabled={idx === fields.length - 1}
                    aria-label="Move field down"
                  >
                    ↓
                  </IconBtn>
                  <IconBtn onClick={() => handleRemoveField(f.id)} aria-label="Delete field">
                    ✕
                  </IconBtn>
                </div>
              </EditorRow>
            ))}

            <AddFieldBtn onClick={handleAddField} onMouseDown={(e) => e.stopPropagation()}>
              + Add field
            </AddFieldBtn>

            <EditorHint>Advanced options are available in the side panel</EditorHint>
          </InlineEditor>
        ) : preview.length === 0 ? (
          <Empty>Click “Fields” in the config panel to add fields</Empty>
        ) : (
          <FieldPreview>
            {preview.map((f) => (
              <FieldStub key={f.id}>
                <FieldLabel title={f.label || f.id}>
                  <span>{f.label || 'Untitled field'}</span>
                  {f.required ? <Required>*</Required> : null}
                </FieldLabel>
                <MockBox $type={f.type} />
              </FieldStub>
            ))}
            {(fields || []).length > 4 && (
              <div style={{ fontSize: 11, color: 'rgb(var(--color-text-tertiary))', textAlign: 'center' }}>
                + {(fields.length - 4)} more fields...
              </div>
            )}
          </FieldPreview>
        )}
      </Body>

      <StyledHandle id="output" type="source" position={Position.Bottom} $role="out" aria-label="Output handle" />

      {/* Keep node identity stable for debugging */}
      <div style={{ position: 'absolute', bottom: 6, right: 10, fontSize: 10, color: 'rgb(var(--color-text-tertiary))' }}>
        {id}
      </div>
    </Page>
  );
});

FormNode.displayName = 'FormNode';

export default FormNode;
