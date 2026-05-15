import React, { useCallback } from 'react';
import {
  ReactFlow,
  type Node,
  type Edge,
  addEdge,
  type Connection,
  useNodesState,
  useEdgesState,
  MiniMap,
  Controls,
  Background,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import styled from 'styled-components';

export interface WorkflowStage {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'exception';
  description?: string;
}

interface PurchaseOrderWorkflowProps {
  stages: WorkflowStage[];
  height?: number;
}

const PurchaseOrderWorkflow: React.FC<PurchaseOrderWorkflowProps> = ({ stages, height = 400 }) => {
  // Create nodes from stages
  const initialNodes: Node[] = stages.map((stage, index) => ({
    id: stage.id,
    position: { x: index * 200, y: 100 },
    data: {
      label: (
        <StageNode status={stage.status}>
          <StageName>{stage.label}</StageName>
          {stage.description && <StageDescription>{stage.description}</StageDescription>}
          <StageStatus status={stage.status}>{getStatusIcon(stage.status)}</StageStatus>
        </StageNode>
      ),
    },
    style: {
      background: getNodeColor(stage.status),
      border: `2px solid ${getBorderColor(stage.status)}`,
      borderRadius: '8px',
      padding: '10px',
      width: 180,
    },
  }));

  // Create edges between consecutive stages
  const initialEdges: Edge[] = stages.slice(0, -1).map((stage, index) => ({
    id: `${stage.id}-${stages[index + 1].id}`,
    source: stage.id,
    target: stages[index + 1].id,
    animated: stages[index + 1].status === 'active',
    style: { stroke: 'rgb(var(--color-text-muted))' },
  }));

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <WorkflowContainer>
      <WorkflowTitle>Purchase Order Workflow</WorkflowTitle>
      <ReactFlowContainer style={{ height }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          fitView
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </ReactFlowContainer>
    </WorkflowContainer>
  );
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return '✓';
    case 'active':
      return '⏳';
    case 'exception':
      return '⚠️';
    default:
      return '○';
  }
};

const getNodeColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'rgba(var(--color-success), 0.14)';
    case 'active':
      return 'rgba(var(--color-warning), 0.14)';
    case 'exception':
      return 'rgba(var(--color-error), 0.14)';
    default:
      return 'rgb(var(--color-surface))';
  }
};

const getBorderColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'rgb(var(--color-success))';
    case 'active':
      return 'rgb(var(--color-warning))';
    case 'exception':
      return 'rgb(var(--color-error))';
    default:
      return 'rgb(var(--color-text-muted))';
  }
};

const WorkflowContainer = styled.div`
  background: rgb(var(--color-surface));
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(var(--color-overlay), 0.1);
  margin-bottom: 20px;
`;

const WorkflowTitle = styled.h3`
  margin: 0 0 20px 0;
  color: rgb(var(--color-text-primary));
  font-size: 18px;
  font-weight: 600;
`;

const ReactFlowContainer = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: 4px;
`;

const StageNode = styled.div<{ status: string }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 8px;
`;

const StageName = styled.div`
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  color: rgb(var(--color-text-primary));
`;

const StageDescription = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-muted));
  margin-bottom: 8px;
`;

const StageStatus = styled.div<{ status: string }>`
  font-size: 20px;
  color: ${(props) => {
    switch (props.status) {
      case 'completed':
        return 'rgb(var(--color-success))';
      case 'active':
        return 'rgb(var(--color-warning))';
      case 'exception':
        return 'rgb(var(--color-error))';
      default:
        return 'rgb(var(--color-text-muted))';
    }
  }};
`;

export default PurchaseOrderWorkflow;
