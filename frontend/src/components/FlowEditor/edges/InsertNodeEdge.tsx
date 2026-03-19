import React from 'react';
import { EdgeLabelRenderer, EdgeProps, getSmoothStepPath, useReactFlow } from '@xyflow/react';
import { Plus } from 'lucide-react';
import styled from 'styled-components';

const EdgeContainer = styled.div`
  position: relative;
  pointer-events: all;
`;

const AddButton = styled.button`
  width: 24px;
  height: 24px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

  &:hover {
    background: rgb(var(--color-primary));
    color: white;
    border-color: rgb(var(--color-primary));
    transform: scale(1.1);
  }
`;

export default function InsertNodeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  useReactFlow();
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleInsertClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // New: unified event used by CustomEdge (+) button
    window.dispatchEvent(
      new CustomEvent('insert-node-between', {
        detail: { edgeId: id },
      })
    );

    // Backward compatibility: existing listener
    window.dispatchEvent(
      new CustomEvent('pm:openNodePalette', {
        detail: { insertOnEdgeId: id },
      })
    );
  };

  return (
    <>
      {/* Invisible thick hitbox under the visible edge to prevent hover flicker */}
      <path
        d={edgePath}
        className="react-flow__edge-path"
        style={{ stroke: 'transparent', strokeWidth: 30, strokeOpacity: 0 }}
        pointerEvents="stroke"
      />

      <path
        id={id}
        style={{ ...style, strokeWidth: 2, stroke: 'rgb(var(--color-border))' }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />

      {/* Render the insert button above nodes/containers (foreignObject can get covered/clipped) */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 1000,
          }}
          className="nodrag nopan"
        >
          <EdgeContainer>
            <AddButton onClick={handleInsertClick} title="Add step here">
              <Plus size={14} />
            </AddButton>
          </EdgeContainer>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
