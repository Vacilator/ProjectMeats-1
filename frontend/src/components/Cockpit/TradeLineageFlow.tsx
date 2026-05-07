/**
 * Trade Lineage Flow Visualization (CTE-05.2)
 *
 * Renders the trade lineage chain as a horizontal React Flow diagram.
 * Shows: Inquiry → Supplier PO → Sales Order → Carrier PO
 * with status badges and clickable navigation.
 *
 * Theme Compliance: CSS custom properties only.
 */
import React, { useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MarkerType,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import { businessApi } from '../../services/businessApi';
import { withTenantQueryKey } from '../../utils/queryKeys';
import {
  FileText,
  ShoppingCart,
  Package,
  Truck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface LineageEntity {
  id: string;
  number: string;
  status: string;
  customer?: string | null;
  supplier?: string | null;
  route_decision?: string;
}

interface LineageChain {
  inquiry: LineageEntity;
  supplier_purchase_order: LineageEntity | null;
  sales_order: LineageEntity | null;
  carrier_purchase_order: LineageEntity | null;
  current_step: string;
}

export interface TradeLineageFlowProps {
  inquiryId: string;
  onNodeClick?: (entityType: string, entityId: string) => void;
  compact?: boolean;
  className?: string;
}

// ============================================================================
// Status config
// ============================================================================

const STATUS_COLORS: Record<string, string> = {
  pending: 'rgb(234, 179, 8)',
  in_progress: 'rgb(59, 130, 246)',
  sourcing: 'rgb(59, 130, 246)',
  quoted: 'rgb(139, 92, 246)',
  ordered: 'rgb(34, 197, 94)',
  completed: 'rgb(34, 197, 94)',
  approved: 'rgb(34, 197, 94)',
  draft: 'rgb(156, 163, 175)',
  cancelled: 'rgb(239, 68, 68)',
  halted: 'rgb(239, 68, 68)',
  initiated: 'rgb(234, 179, 8)',
  logistics: 'rgb(59, 130, 246)',
};

const getStatusColor = (status: string): string =>
  STATUS_COLORS[status?.toLowerCase()] ?? 'rgb(156, 163, 175)';

const ENTITY_ICONS: Record<string, React.FC<{ size?: number }>> = {
  inquiry: FileText,
  supplier_purchase_order: ShoppingCart,
  sales_order: Package,
  carrier_purchase_order: Truck,
};

// ============================================================================
// Styled Components
// ============================================================================

const FlowContainer = styled.div<{ $compact?: boolean }>`
  width: 100%;
  height: ${(p) => (p.$compact ? '180px' : '300px')};
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;

  .react-flow__attribution {
    display: none;
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
`;

const ErrorContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  color: rgb(239, 68, 68);
  font-size: 14px;
`;

const EmptyContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
`;

// ============================================================================
// Custom Node Component
// ============================================================================

interface LineageNodeData {
  label: string;
  entityType: string;
  entityId: string;
  status: string;
  subtitle?: string;
  isActive: boolean;
  isEmpty: boolean;
}

const NodeWrapper = styled.div<{ $color: string; $isActive: boolean; $isEmpty: boolean }>`
  padding: 10px 14px;
  border-radius: var(--radius-md);
  background: ${(p) => (p.$isEmpty ? 'rgb(var(--color-surface))' : 'rgb(var(--color-surface))')};
  border: 2px solid ${(p) => (p.$isEmpty ? 'rgb(var(--color-border))' : p.$color)};
  opacity: ${(p) => (p.$isEmpty ? 0.5 : 1)};
  min-width: 130px;
  cursor: ${(p) => (p.$isEmpty ? 'default' : 'pointer')};
  transition: all 0.2s ease;
  box-shadow: ${(p) =>
    p.$isActive ? `0 0 0 3px ${p.$color}30, 0 4px 12px ${p.$color}20` : '0 1px 4px rgba(0,0,0,0.08)'};

  &:hover {
    transform: ${(p) => (p.$isEmpty ? 'none' : 'translateY(-1px)')};
    box-shadow: ${(p) =>
      p.$isEmpty ? 'none' : `0 4px 12px ${p.$color}30`};
  }
`;

const NodeTitle = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
`;

const NodeNumber = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  font-family: monospace;
`;

const StatusBadge = styled.span<{ $color: string }>`
  display: inline-block;
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 9999px;
  background: ${(p) => p.$color}20;
  color: ${(p) => p.$color};
  margin-top: 4px;
  text-transform: capitalize;
`;

const LineageNodeComponent: React.FC<{ data: LineageNodeData }> = ({ data }) => {
  const color = getStatusColor(data.status);
  const Icon = ENTITY_ICONS[data.entityType] ?? FileText;

  return (
    <NodeWrapper $color={color} $isActive={data.isActive} $isEmpty={data.isEmpty}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Icon size={14} />
        <NodeTitle>{data.label}</NodeTitle>
      </div>
      {!data.isEmpty && (
        <>
          <NodeNumber>{data.subtitle}</NodeNumber>
          <StatusBadge $color={color}>{data.status}</StatusBadge>
        </>
      )}
      {data.isEmpty && (
        <NodeNumber style={{ fontStyle: 'italic' }}>Not yet created</NodeNumber>
      )}
    </NodeWrapper>
  );
};

const nodeTypes = { lineageNode: LineageNodeComponent };

// ============================================================================
// Graph builder
// ============================================================================

const ENTITY_LABELS: Record<string, string> = {
  inquiry: 'Inquiry',
  supplier_purchase_order: 'Supplier PO',
  sales_order: 'Sales Order',
  carrier_purchase_order: 'Carrier PO',
};

function buildGraph(
  chain: LineageChain,
  currentStep: string
): { nodes: Node<LineageNodeData>[]; edges: Edge[] } {
  const entities = [
    { key: 'inquiry', data: chain.inquiry },
    { key: 'supplier_purchase_order', data: chain.supplier_purchase_order },
    { key: 'sales_order', data: chain.sales_order },
    { key: 'carrier_purchase_order', data: chain.carrier_purchase_order },
  ];

  const spacing = 220;
  const nodes: Node<LineageNodeData>[] = entities.map((entity, i) => ({
    id: entity.key,
    type: 'lineageNode',
    position: { x: i * spacing, y: 60 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: {
      label: ENTITY_LABELS[entity.key] || entity.key,
      entityType: entity.key,
      entityId: entity.data?.id ?? '',
      status: entity.data?.status ?? '',
      subtitle: entity.data?.number ?? '',
      isActive: currentStep.toLowerCase().includes(entity.key.replace('_', '')),
      isEmpty: entity.data === null,
    },
  }));

  const edges: Edge[] = [];
  for (let i = 0; i < entities.length - 1; i++) {
    edges.push({
      id: `${entities[i].key}-${entities[i + 1].key}`,
      source: entities[i].key,
      target: entities[i + 1].key,
      type: 'smoothstep',
      animated: entities[i + 1].data === null,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: {
        stroke: entities[i + 1].data ? 'rgb(var(--color-text-secondary))' : 'rgb(var(--color-border))',
        strokeWidth: 2,
      },
    });
  }

  return { nodes, edges };
}

// ============================================================================
// Main Component
// ============================================================================

export const TradeLineageFlow: React.FC<TradeLineageFlowProps> = ({
  inquiryId,
  onNodeClick,
  compact = false,
  className,
}) => {
  const { data, isLoading, error } = useQuery({
    queryKey: withTenantQueryKey('trade-lineage', inquiryId),
    queryFn: async () => {
      const res = await businessApi.get(`/inquiries/${inquiryId}/lineage/`);
      return res.data as LineageChain;
    },
    enabled: !!inquiryId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    return buildGraph(data, data.current_step);
  }, [data]);

  const handleNodeClick = (_: React.MouseEvent, node: Node<LineageNodeData>) => {
    if (node.data.isEmpty || !onNodeClick) return;
    onNodeClick(node.data.entityType, node.data.entityId);
  };

  if (isLoading) {
    return (
      <FlowContainer $compact={compact} className={className}>
        <LoadingContainer>
          <Loader2 size={16} className="animate-spin" />
          Loading lineage…
        </LoadingContainer>
      </FlowContainer>
    );
  }

  if (error) {
    return (
      <FlowContainer $compact={compact} className={className}>
        <ErrorContainer>
          <AlertCircle size={16} />
          Failed to load lineage
        </ErrorContainer>
      </FlowContainer>
    );
  }

  if (!data) {
    return (
      <FlowContainer $compact={compact} className={className}>
        <EmptyContainer>No lineage data available</EmptyContainer>
      </FlowContainer>
    );
  }

  return (
    <FlowContainer $compact={compact} className={className}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={!compact}
        panOnDrag={!compact}
        zoomOnScroll={!compact}
        proOptions={{ hideAttribution: true }}
      >
        {!compact && <Controls showInteractive={false} />}
        <Background gap={20} size={1} />
      </ReactFlow>
    </FlowContainer>
  );
};

export default TradeLineageFlow;
