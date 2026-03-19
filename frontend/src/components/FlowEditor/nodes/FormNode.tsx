/**
 * Form Node Component (Container)
 *
 * Implements the React Flow sub-flows pattern (parent + children) for multi-step forms.
 *
 * References (sub-flows):
 * - https://reactflow.dev/examples/layout/sub-flows
 * - https://reactflow.dev/examples/nodes/draggable-subflow
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  Handle,
  NodeToolbar,
  Position,
  getNodesBounds,
  type Edge,
  type Node,
  type NodeProps,
  useEdges,
  useNodes,
  useReactFlow,
  useUpdateNodeInternals,
} from '@xyflow/react';
import { Plus, Pencil, Trash2, Save } from 'lucide-react';

type PreviewField = {
  id: string;
  label?: string;
  type?: string;
  required?: boolean;
};

export type FormNodeData = {
  label?: string;
  containerName?: string;
  containerDescription?: string;
  steps?: Array<Record<string, unknown>>;

  // injected by UnifiedFlowEditor
  isSaving?: boolean;
  onAddStepInsideForm?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSave?: () => void;
} & Record<string, unknown>;

const LEFT_SIDEBAR_W = 220;
const RIGHT_PANEL_W = 260;
const HEADER_H = 64;
const TABS_H = 44;
const PADDING = 40;
const STEP_W = 320;
const STEP_H = 320;
const STEP_GAP = 30;

const Container = styled.div<{ $selected: boolean }>`
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 14px;
  overflow: visible;

  background:
    radial-gradient(1200px 500px at 50% 0%, rgb(var(--color-primary) / 0.10), transparent 60%),
    rgb(var(--color-surface));

  border: 2px dashed rgb(var(--color-primary) / 0.45);
  box-shadow:
    0 10px 28px rgb(var(--color-text-primary) / 0.10),
    0 0 0 6px rgb(var(--color-primary) / 0.10);

  ${(p) =>
    p.$selected
      ? `
    border-color: rgb(var(--color-primary));
    box-shadow:
      0 14px 36px rgb(var(--color-text-primary) / 0.14),
      0 0 0 8px rgb(var(--color-primary) / 0.16);
  `
      : ''}

  /* Smooth connector baseline behind pages */
  &::before {
    content: '';
    position: absolute;
    left: ${LEFT_SIDEBAR_W + 24}px;
    right: ${RIGHT_PANEL_W + 24}px;
    top: ${HEADER_H + TABS_H + 20 + STEP_H / 2}px;
    height: 2px;
    background: linear-gradient(
      90deg,
      transparent,
      rgb(var(--color-primary) / 0.25) 12%,
      rgb(var(--color-primary) / 0.25) 88%,
      transparent
    );
    pointer-events: none;
  }
`;

const Header = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: ${HEADER_H}px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: 14px 14px 0 0;
  background: rgb(var(--color-background));
  border-bottom: 1px solid rgb(var(--color-border));
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const Title = styled.div`
  font-weight: 900;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SubTitle = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Badge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  font-size: 11px;
  font-weight: 800;
  color: rgb(var(--color-text-secondary));
`;

const TabsRow = styled.div`
  position: absolute;
  left: ${LEFT_SIDEBAR_W}px;
  right: ${RIGHT_PANEL_W}px;
  top: ${HEADER_H}px;
  height: ${TABS_H}px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  overflow-x: auto;
`;

const StepTab = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgb(var(--color-border));
  background: ${(p) => (p.$active ? 'rgba(var(--color-primary), 0.12)' : 'rgb(var(--color-background))')};
  color: ${(p) => (p.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-primary))')};
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    border-color: rgb(var(--color-primary));
  }
`;

const TabDot = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgb(var(--color-primary));
  opacity: 0.6;
`;

const LeftSidebar = styled.div`
  position: absolute;
  top: ${HEADER_H}px;
  left: 0;
  bottom: 0;
  width: ${LEFT_SIDEBAR_W}px;
  border-right: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
  padding: 10px 10px 12px;
  overflow: auto;
`;

const RightPanel = styled.div`
  position: absolute;
  top: ${HEADER_H}px;
  right: 0;
  bottom: 0;
  width: ${RIGHT_PANEL_W}px;
  border-left: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
  padding: 10px 10px 12px;
  overflow: auto;
`;

const PanelTitle = styled.div`
  font-size: 12px;
  font-weight: 900;
  color: rgb(var(--color-text-primary));
  margin: 6px 0 10px;
`;

const GroupTitle = styled.div`
  font-size: 11px;
  font-weight: 900;
  color: rgb(var(--color-text-secondary));
  margin-top: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const FieldChip = styled.button`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  margin-top: 6px;

  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.06);
  }
`;

const SmallMuted = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  margin-top: 4px;
`;

const JsonTextarea = styled.textarea`
  width: 100%;
  min-height: 140px;
  resize: vertical;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.45;
`;

const ToolbarButton = styled.button<{ $primary?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  background: ${(p) => (p.$primary ? 'rgb(var(--color-primary))' : 'rgb(var(--color-surface))')};
  color: ${(p) => (p.$primary ? 'white' : 'rgb(var(--color-text-primary))')};
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;

  &:hover {
    filter: brightness(0.98);
  }
`;

const isFormBookStepType = (type?: string) =>
  type === 'form' || type === 'formStepSingle' || type === 'formStep' || type === 'formReference';

export const FormNode = React.memo<NodeProps<FormNodeData>>(({ id, data, selected }) => {
  const allNodes = useNodes();
  const allEdges = useEdges();
  const { setNodes, setEdges } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  const isExpanded = (data as any)?.isExpanded ?? true;
  const sequentialExecution = (data as any)?.sequentialExecution ?? true;

  const childSteps = useMemo(
    () => allNodes.filter((n) => (n as any).parentId === id && isFormBookStepType(n.type)),
    [allNodes, id]
  );

  const sortedSteps = useMemo(
    () =>
      [...childSteps].sort(
        (a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0) || (a.position?.y ?? 0) - (b.position?.y ?? 0)
      ),
    [childSteps]
  );

  const [activeStepId, setActiveStepId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeStepId && sortedSteps[0]?.id) setActiveStepId(sortedSteps[0].id);
    if (activeStepId && !sortedSteps.some((s) => s.id === activeStepId)) {
      setActiveStepId(sortedSteps[0]?.id ?? null);
    }
  }, [activeStepId, sortedSteps]);

  const activeStep = useMemo(
    () => sortedSteps.find((s) => s.id === activeStepId) ?? null,
    [sortedSteps, activeStepId]
  );

  const childKey = useMemo(
    () =>
      sortedSteps
        .map(
          (n) =>
            `${n.id}:${n.position?.x ?? 0},${n.position?.y ?? 0}:${(n as any).width ?? ''}x${(n as any).height ?? ''}`
        )
        .join('|'),
    [sortedSteps]
  );

  const childXKey = useMemo(
    () => JSON.stringify(sortedSteps.map((c) => ({ id: c.id, x: Math.round(c.position?.x ?? 0) }))),
    [sortedSteps]
  );

  // Auto-layout children (Book → Pages) with bailout to avoid render loops
  useEffect(() => {
    if (!isExpanded || sortedSteps.length === 0) return;

    const startX = LEFT_SIDEBAR_W + PADDING;
    const y = HEADER_H + TABS_H + PADDING;

    const layoutedChildren = sortedSteps.map((n, index) => ({
      id: n.id,
      position: {
        x: startX + index * (STEP_W + STEP_GAP),
        y,
      },
    }));

    setNodes((currentNodes) => {
      let hasChanges = false;
      const nextNodes = currentNodes.map((node) => {
        const layouted = layoutedChildren.find((child) => child.id === node.id);
        if (layouted && (node as any).parentId === id) {
          // CRITICAL: Bailout check to prevent infinite loops when positions are stable
          if (
            Math.abs((node.position?.x ?? 0) - layouted.position.x) > 1 ||
            Math.abs((node.position?.y ?? 0) - layouted.position.y) > 1
          ) {
            hasChanges = true;
            return {
              ...node,
              position: layouted.position,
            };
          }
        }
        return node;
      });

      // Only return a new array reference if positions actually changed
      return hasChanges ? nextNodes : currentNodes;
    });

    requestAnimationFrame(() => {
      updateNodeInternals(id);
    });
  }, [sortedSteps.length, id, isExpanded, setNodes, updateNodeInternals]);

  // Auto-connect pages left-to-right with thick "step" edges
  useEffect(() => {
    if (!isExpanded || !sequentialExecution || sortedSteps.length < 2) return;

    const sortedChildren = [...sortedSteps].sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0));

    const expectedEdgeIds = new Set<string>();
    for (let i = 0; i < sortedChildren.length - 1; i++) {
      expectedEdgeIds.add(`${sortedChildren[i].id}-to-${sortedChildren[i + 1].id}`);
    }

    const currentAutoEdges = allEdges.filter(
      (edge) => (edge.data as any)?.autoStepEdge === true && (edge.data as any)?.parentFormId === id
    );
    const currentEdgeIds = new Set(currentAutoEdges.map((e) => e.id));

    const needsUpdate =
      expectedEdgeIds.size !== currentEdgeIds.size ||
      [...expectedEdgeIds].some((edgeId) => !currentEdgeIds.has(edgeId));

    if (!needsUpdate) return;

    const newEdges: Edge[] = [];
    for (let i = 0; i < sortedChildren.length - 1; i++) {
      const sourceNode = sortedChildren[i];
      const targetNode = sortedChildren[i + 1];

      newEdges.push({
        id: `${sourceNode.id}-to-${targetNode.id}`,
        source: sourceNode.id,
        target: targetNode.id,
        type: 'step',
        animated: true,
        style: { stroke: 'rgba(var(--color-primary), 0.55)', strokeWidth: 3 },
        label: `Step ${i + 1} → ${i + 2}`,
        data: {
          autoStepEdge: true,
          parentFormId: id,
        },
      });
    }

    if (newEdges.length > 0) {
      setEdges((edges) => {
        const filteredEdges = edges.filter(
          (edge) => !((edge.data as any)?.autoStepEdge === true && (edge.data as any)?.parentFormId === id)
        );
        return [...filteredEdges, ...newEdges];
      });
    }
  }, [sortedSteps.length, isExpanded, sequentialExecution, childXKey, allEdges, id, setEdges]);

  // Auto-size the container + persist nested steps payload
  useEffect(() => {
    if (sortedSteps.length === 0) return;

    const bounds = getNodesBounds(sortedSteps as unknown as Node[]);

    const minWidth = LEFT_SIDEBAR_W + RIGHT_PANEL_W + STEP_W + PADDING * 2;
    const minHeight = HEADER_H + TABS_H + STEP_H + PADDING * 2;

    const nextWidth = Math.max(minWidth, Math.ceil(bounds.width + LEFT_SIDEBAR_W + RIGHT_PANEL_W + PADDING * 2));
    const nextHeight = Math.max(minHeight, Math.ceil(bounds.height + HEADER_H + TABS_H + PADDING * 2));

    const stepsPayload = sortedSteps.map((n, index) => {
      const stepData: any = n.data || {};
      return {
        id: n.id,
        order: index,
        name: stepData.stepTitle || stepData.label || `Step ${index + 1}`,
        description: stepData.stepDescription || '',
        entity_type: stepData.entityType || stepData.entity_type,
        fields: stepData.fields || [],
        field_mappings: stepData.fieldMappings || stepData.field_mappings || [],
        cascade_mappings: stepData.cascadeMappings || stepData.cascade_mappings || [],
      };
    });

    const stepsJson = JSON.stringify(stepsPayload);

    setNodes((nds) => {
      let changed = false;

      const next = nds.map((n) => {
        if (n.id === id) {
          const currentStyle: any = n.style || {};
          const widthChanged = Math.abs((currentStyle.width ?? 0) - nextWidth) > 1;
          const heightChanged = Math.abs((currentStyle.height ?? 0) - nextHeight) > 1;

          const existingStepsJson = JSON.stringify((n.data as any)?.steps || []);
          const stepsChanged = existingStepsJson !== stepsJson;

          if (!widthChanged && !heightChanged && !stepsChanged) return n;
          changed = true;

          return {
            ...n,
            style: {
              ...currentStyle,
              width: nextWidth,
              height: nextHeight,
            },
            data: {
              ...(n.data || {}),
              steps: stepsPayload,
            },
          };
        }

        if ((n as any).parentId === id && isFormBookStepType(n.type)) {
          const idx = sortedSteps.findIndex((s) => s.id === n.id);
          const desiredOrder = idx >= 0 ? idx : (n.data as any)?.order;

          const orderUnchanged = (n.data as any)?.order === desiredOrder;
          const extentUnchanged = n.extent === 'parent';
          const expandUnchanged = (n as any).expandParent === true;

          if (orderUnchanged && extentUnchanged && expandUnchanged) return n;
          changed = true;

          return {
            ...n,
            extent: 'parent',
            expandParent: true,
            data: {
              ...(n.data || {}),
              order: desiredOrder,
            },
          };
        }

        return n;
      });

      return changed ? next : nds;
    });
  }, [childKey, id, setNodes, sortedSteps]);

  // Step drag-to-reorder via tab bar
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);

  const repositionSteps = useCallback(
    (ordered: Node[]) => {
      const startX = LEFT_SIDEBAR_W + PADDING;
      const y = HEADER_H + TABS_H + PADDING;

      setNodes((nds) => {
        let changed = false;
        const next = nds.map((n) => {
          const idx = ordered.findIndex((s) => s.id === n.id);
          if (idx === -1) return n;

          const nextX = startX + idx * (STEP_W + STEP_GAP);
          const nextY = y;

          const positionUnchanged = (n.position?.x ?? 0) === nextX && (n.position?.y ?? 0) === nextY;
          const orderUnchanged = (n.data as any)?.order === idx;
          if (positionUnchanged && orderUnchanged) return n;

          changed = true;
          return {
            ...n,
            position: {
              x: nextX,
              y: nextY,
            },
            data: {
              ...(n.data || {}),
              order: idx,
            },
          };
        });

        return changed ? next : nds;
      });
    },
    [setNodes]
  );

  const handleTabDrop = useCallback(
    (targetId: string) => {
      if (!draggingStepId || draggingStepId === targetId) return;
      const current = [...sortedSteps];
      const from = current.findIndex((s) => s.id === draggingStepId);
      const to = current.findIndex((s) => s.id === targetId);
      if (from < 0 || to < 0) return;

      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      repositionSteps(next);
      setDraggingStepId(null);
    },
    [draggingStepId, sortedSteps, repositionSteps]
  );

  const title = data.containerName || data.label || 'Form';
  const description = data.containerDescription || 'Multi-step form';

  // Field library grouped by entity across steps
  const fieldsByEntity = useMemo(() => {
    const groups = new Map<string, PreviewField[]>();
    for (const step of sortedSteps) {
      const d: any = step.data || {};
      const entity = (d.entityType || d.entity_type || 'Unknown') as string;
      const fields = Array.isArray(d.fields) ? (d.fields as PreviewField[]) : [];
      const existing = groups.get(entity) || [];
      groups.set(entity, [...existing, ...fields]);
    }

    // De-dupe within each entity group by id
    const normalized: Array<{ entity: string; fields: PreviewField[] }> = [];
    for (const [entity, fields] of groups.entries()) {
      const seen = new Set<string>();
      const uniq = fields.filter((f) => {
        const k = String(f.id);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      normalized.push({ entity, fields: uniq });
    }

    return normalized.sort((a, b) => a.entity.localeCompare(b.entity));
  }, [sortedSteps]);

  const addFieldToActiveStep = useCallback(
    (template: PreviewField) => {
      if (!activeStepId) return;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== activeStepId) return n;
          const d: any = n.data || {};
          const prev = Array.isArray(d.fields) ? (d.fields as PreviewField[]) : [];
          const nextField: PreviewField = {
            ...template,
            id: `field-${Date.now()}`,
          };
          return {
            ...n,
            data: {
              ...d,
              fields: [...prev, nextField],
            },
          };
        })
      );
    },
    [activeStepId, setNodes]
  );

  const [cascadeDraft, setCascadeDraft] = useState('');

  useEffect(() => {
    const d: any = activeStep?.data || {};
    const cascades = d.cascadeMappings || d.cascade_mappings || [];
    setCascadeDraft(JSON.stringify(cascades, null, 2));
  }, [activeStepId, activeStep]);

  const commitCascadeDraft = useCallback(() => {
    if (!activeStepId) return;
    try {
      const parsed = JSON.parse(cascadeDraft || '[]');
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== activeStepId) return n;
          return {
            ...n,
            data: {
              ...(n.data || {}),
              cascadeMappings: parsed,
            },
          };
        })
      );
    } catch {
      // keep draft; user can correct JSON
    }
  }, [activeStepId, cascadeDraft, setNodes]);

  return (
    <Container $selected={!!selected}>
      <NodeToolbar isVisible position={Position.Top}>
        <div style={{ display: 'flex', gap: 8 }}>
          <ToolbarButton onClick={data.onAddStepInsideForm} title="Add step">
            <Plus size={14} />
            Step
          </ToolbarButton>
          <ToolbarButton onClick={data.onEdit} title="Edit">
            <Pencil size={14} />
            Edit
          </ToolbarButton>
          <ToolbarButton onClick={data.onDelete} title="Delete">
            <Trash2 size={14} />
            Delete
          </ToolbarButton>
          <ToolbarButton $primary onClick={data.onSave} title="Save">
            <Save size={14} />
            {data.isSaving ? 'Saving…' : 'Save'}
          </ToolbarButton>
        </div>
      </NodeToolbar>

      <Header className="custom-drag-handle">
        <TitleBlock>
          <Title title={title}>{title}</Title>
          <SubTitle title={description}>{description}</SubTitle>
        </TitleBlock>
        <Badge>
          {sortedSteps.length} step{sortedSteps.length === 1 ? '' : 's'}
        </Badge>
      </Header>

      <LeftSidebar className="nodrag">
        <PanelTitle>Field Library</PanelTitle>
        {fieldsByEntity.length === 0 ? (
          <SmallMuted>Add steps to see fields grouped by entity.</SmallMuted>
        ) : (
          fieldsByEntity.map((group) => (
            <div key={group.entity}>
              <GroupTitle>{group.entity}</GroupTitle>
              {group.fields.slice(0, 12).map((f) => (
                <FieldChip key={f.id} onClick={() => addFieldToActiveStep(f)} title="Add to active step">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.label || f.id}
                  </span>
                  <span style={{ fontSize: 11, color: 'rgb(var(--color-text-secondary))' }}>+</span>
                </FieldChip>
              ))}
              {group.fields.length > 12 ? <SmallMuted>+ {group.fields.length - 12} more…</SmallMuted> : null}
            </div>
          ))
        )}
        <SmallMuted style={{ marginTop: 12 }}>
          Tip: Click a field to add it to the active step.
        </SmallMuted>
      </LeftSidebar>

      <TabsRow className="nodrag">
        {sortedSteps.map((s, idx) => {
          const sd: any = s.data || {};
          const label = sd.stepTitle || sd.label || `Step ${idx + 1}`;
          const active = s.id === activeStepId;
          return (
            <StepTab
              key={s.id}
              $active={active}
              draggable
              onDragStart={() => setDraggingStepId(s.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleTabDrop(s.id)}
              onClick={() => setActiveStepId(s.id)}
              title="Drag to reorder steps"
            >
              <TabDot />
              {idx + 1} of {sortedSteps.length} • {label}
            </StepTab>
          );
        })}
      </TabsRow>

      <RightPanel className="nodrag">
        <PanelTitle>Properties</PanelTitle>
        <SmallMuted>
          Active step: {activeStep ? ((activeStep.data as any)?.stepTitle || (activeStep.data as any)?.label || activeStep.id) : 'None'}
        </SmallMuted>

        <GroupTitle style={{ marginTop: 14 }}>Cascade mappings (JSON)</GroupTitle>
        <JsonTextarea
          value={cascadeDraft}
          onChange={(e) => setCascadeDraft(e.target.value)}
          onBlur={commitCascadeDraft}
          spellCheck={false}
        />
        <SmallMuted>Edits apply on blur. Invalid JSON is ignored until fixed.</SmallMuted>
      </RightPanel>

      {/* External connections in/out */}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </Container>
  );
});

export default FormNode;
