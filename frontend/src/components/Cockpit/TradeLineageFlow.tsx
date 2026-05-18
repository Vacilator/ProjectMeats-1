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
import {
  ReactFlow,
  type Node,
  type Edge,
  Controls,
  Background,
  MarkerType,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { businessApi } from '../../services/businessApi';
import { withTenantQueryKey } from '../../utils/queryKeys';
import { entityListPath, entityRecordPath } from '../../utils/entityTypeRegistry';
import {
  FileText,
  ShoppingCart,
  Package,
  Truck,
  ClipboardCheck,
  Receipt,
  AlertCircle,
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
  contact_roles?: LineageContactRole[];
}

interface LineageContactRole {
  role: string;
  role_label: string;
  header: string;
  detail_path?: string | null;
  department?: string | null;
  department_label?: string | null;
  title?: string | null;
  name?: string | null;
  company?: string | null;
  responsibilities?: string[];
}

interface LineageChain {
  inquiry: LineageEntity;
  supplier_purchase_order: LineageEntity | null;
  sales_order: LineageEntity | null;
  carrier_purchase_order: LineageEntity | null;
  fulfillment: LineageEntity | null;
  invoice: LineageEntity | null;
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
  pending: 'rgb(var(--color-warning))',
  in_progress: 'rgb(var(--color-info))',
  sourcing: 'rgb(var(--color-info))',
  quoted: 'rgb(var(--color-primary))',
  ordered: 'rgb(var(--color-success))',
  completed: 'rgb(var(--color-success))',
  approved: 'rgb(var(--color-success))',
  draft: 'rgb(var(--color-text-tertiary))',
  cancelled: 'rgb(var(--color-error))',
  halted: 'rgb(var(--color-error))',
  initiated: 'rgb(var(--color-warning))',
  logistics: 'rgb(var(--color-info))',
};

const getStatusColor = (status: string): string =>
  STATUS_COLORS[status?.toLowerCase()] ?? 'rgb(var(--color-text-tertiary))';

const ENTITY_ICONS: Record<string, React.FC<{ size?: number }>> = {
  inquiry: FileText,
  supplier_purchase_order: ShoppingCart,
  sales_order: Package,
  carrier_purchase_order: Truck,
  fulfillment: ClipboardCheck,
  invoice: Receipt,
};

// ============================================================================
// Styled Components
// ============================================================================

const FlowContainer = styled.div<{ $compact?: boolean }>`
  width: 100%;
  height: ${(p) => (p.$compact ? '240px' : '360px')};
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
  color: rgb(var(--color-error));
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
  [key: string]: unknown;
  label: string;
  entityType: string;
  entityId: string;
  status: string;
  subtitle?: string;
  isActive: boolean;
  isEmpty: boolean;
  aiSuggestion?: string;
  contactRoles?: Array<{
    role: string;
    roleLabel: string;
    header: string;
    detailPath?: string | null;
    departmentLabel?: string | null;
    title?: string | null;
    responsibilities?: string[];
  }>;
}

const NodeWrapper = styled.div<{ $color: string; $isActive: boolean; $isEmpty: boolean }>`
  padding: 10px 14px;
  border-radius: var(--radius-md);
  background: ${(p) => (p.$isEmpty ? 'rgb(var(--color-surface))' : 'rgb(var(--color-surface))')};
  border: 2px solid ${(p) => (p.$isEmpty ? 'rgb(var(--color-border))' : p.$color)};
  opacity: ${(p) => (p.$isEmpty ? 0.5 : 1)};
  min-width: 170px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: ${(p) =>
    p.$isActive ? `0 0 0 3px ${p.$color}30, 0 4px 12px ${p.$color}20` : '0 1px 4px rgba(var(--color-overlay),0.08)'};

  &:hover {
    transform: translateY(-1px);
    box-shadow: ${(p) =>
      p.$isEmpty ? `0 2px 8px rgba(var(--color-primary), 0.15)` : `0 4px 12px ${p.$color}30`};
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

const ContactHeadline = styled.div`
  margin-top: 8px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  color: rgb(var(--color-text-primary));
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

const ContactRoleList = styled.div`
  display: grid;
  gap: 6px;
  margin-top: 8px;
`;

const ContactRoleCard = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: 10px;
  padding: 8px;
  background: rgb(var(--color-background));
  display: grid;
  gap: 6px;
`;

const ContactRoleMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
`;

const ContactRoleBadge = styled.span`
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgb(var(--color-primary) / 0.12);
  color: rgb(var(--color-primary));
`;

const ContactRoleTitle = styled.span`
  font-size: 10px;
  color: rgb(var(--color-text-secondary));
`;

const ResponsibilityList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const ResponsibilityChip = styled.span`
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-secondary));
  border: 1px solid rgb(var(--color-border));
`;

const ContactLinkButton = styled.button`
  justify-self: start;
  border: none;
  background: transparent;
  color: rgb(var(--color-primary));
  font-size: 11px;
  font-weight: 600;
  padding: 0;
  cursor: pointer;
`;

const MoreRolesText = styled.div`
  font-size: 10px;
  color: rgb(var(--color-text-secondary));
`;

const AISuggestionHint = styled.div`
  margin-top: 4px;
  font-size: 10px;
  color: rgb(var(--color-info));
  font-style: italic;
  display: flex;
  align-items: center;
  gap: 3px;
`;

const LineageNodeComponent: React.FC<{ data: LineageNodeData }> = ({ data }) => {
  const navigate = useNavigate();
  const color = getStatusColor(data.status);
  const Icon = ENTITY_ICONS[data.entityType] ?? FileText;
  const visibleRoles = data.contactRoles?.slice(0, 2) ?? [];
  const remainingRoleCount = Math.max((data.contactRoles?.length ?? 0) - visibleRoles.length, 0);

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
          {visibleRoles.length > 0 ? (
            <ContactRoleList>
              {visibleRoles.map((role) => (
                <ContactRoleCard key={`${data.entityType}-${role.role}-${role.header}`}>
                  <ContactRoleMeta>
                    <ContactRoleBadge>{role.departmentLabel ?? role.roleLabel}</ContactRoleBadge>
                    {role.title ? <ContactRoleTitle>{role.title}</ContactRoleTitle> : null}
                  </ContactRoleMeta>
                  <ContactHeadline>{role.header}</ContactHeadline>
                  {role.responsibilities && role.responsibilities.length > 0 ? (
                    <ResponsibilityList>
                      {role.responsibilities.slice(0, 3).map((value) => (
                        <ResponsibilityChip key={value}>{value}</ResponsibilityChip>
                      ))}
                    </ResponsibilityList>
                  ) : null}
                  {role.detailPath ? (
                    <ContactLinkButton
                      type="button"
                      aria-label={`Open contact ${role.roleLabel || ''}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(role.detailPath || '/');
                      }}
                    >
                      Open contact
                    </ContactLinkButton>
                  ) : null}
                </ContactRoleCard>
              ))}
              {remainingRoleCount > 0 ? (
                <MoreRolesText>+{remainingRoleCount} more contact role(s)</MoreRolesText>
              ) : null}
            </ContactRoleList>
          ) : null}
        </>
      )}
      {data.isEmpty && (
        <>
          <NodeNumber style={{ fontStyle: 'italic', cursor: 'pointer', color: 'rgb(var(--color-primary))' }}>
            ➕ Click to create
          </NodeNumber>
          {data.aiSuggestion && (
            <AISuggestionHint>
              💡 {data.aiSuggestion}
            </AISuggestionHint>
          )}
        </>
      )}
      {!data.isEmpty && (
        <NodeNumber style={{ fontStyle: 'italic', cursor: 'pointer', color: 'rgb(var(--color-primary))', marginTop: 4 }}>
          👁 Click to view
        </NodeNumber>
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
  fulfillment: 'Fulfillment',
  invoice: 'Invoice',
};

function buildGraph(
  chain: LineageChain,
  currentStep: string
): { nodes: Node<LineageNodeData>[]; edges: Edge[] } {
  // Generate contextual AI suggestions for empty nodes
  const getSuggestion = (key: string): string | undefined => {
    if (key === 'supplier_purchase_order' && !chain.supplier_purchase_order) {
      const supplier = chain.inquiry?.supplier;
      return supplier
        ? `Create PO for ${supplier}`
        : 'Create PO from inquiry details';
    }
    if (key === 'sales_order' && !chain.sales_order) {
      const customer = chain.inquiry?.customer;
      return customer
        ? `Create SO for ${customer}`
        : 'Create SO linking to inquiry';
    }
    if (key === 'carrier_purchase_order' && !chain.carrier_purchase_order) {
      return 'Create Carrier PO for logistics';
    }
    if (key === 'fulfillment' && !chain.fulfillment) {
      return 'Create fulfillment record';
    }
    if (key === 'invoice' && !chain.invoice) {
      return 'Generate invoice from order';
    }
    return undefined;
  };

  const entities = [
    { key: 'inquiry', data: chain.inquiry },
    { key: 'supplier_purchase_order', data: chain.supplier_purchase_order },
    { key: 'sales_order', data: chain.sales_order },
    { key: 'carrier_purchase_order', data: chain.carrier_purchase_order },
    { key: 'fulfillment', data: chain.fulfillment },
    { key: 'invoice', data: chain.invoice },
  ];

  const spacing = 190;
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
      isActive: (currentStep ?? '').toLowerCase().includes(entity.key.replace('_', '')),
      isEmpty: entity.data === null,
      aiSuggestion: getSuggestion(entity.key),
      contactRoles: Array.isArray(entity.data?.contact_roles)
        ? entity.data.contact_roles.map((role) => ({
            role: role.role,
            roleLabel: role.role_label,
            header: role.header,
            detailPath: role.detail_path,
            departmentLabel: role.department_label,
            title: role.title,
            responsibilities: Array.isArray(role.responsibilities) ? role.responsibilities : [],
          }))
        : [],
    },
  }));

  const edges: Edge[] = [];
  for (let i = 0; i < entities.length - 1; i++) {
    const isNextEmpty = entities[i + 1].data === null;
    const strokeColor = isNextEmpty ? 'rgb(var(--color-border))' : 'rgb(var(--color-text-secondary))';
    edges.push({
      id: `${entities[i].key}-${entities[i + 1].key}`,
      source: entities[i].key,
      target: entities[i + 1].key,
      type: 'smoothstep',
      animated: isNextEmpty,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: strokeColor,
      },
      style: {
        stroke: strokeColor,
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
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: withTenantQueryKey('trade-lineage', inquiryId),
    queryFn: async () => {
      const res = await businessApi.get(`/inquiries/${inquiryId}/lineage/`);
      return res.data as LineageChain;
    },
    enabled: !!inquiryId,
    staleTime: 5_000,
    retry: false,
    refetchInterval: 30_000,
  });

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    return buildGraph(data, data.current_step);
  }, [data]);

  const handleNodeClick = (_: React.MouseEvent, node: Node<LineageNodeData>) => {
    if (onNodeClick) {
      // Always pass through, even for empty nodes (caller can handle creation)
      onNodeClick(node.data.entityType, node.data.entityId);
      return;
    }
    // Default behavior: navigate to entity record detail if it exists
    if (!node.data.isEmpty && node.data.entityId) {
      const detailPath = entityRecordPath(node.data.entityType, node.data.entityId);
      navigate(detailPath);
    } else if (node.data.isEmpty) {
      // Empty node — navigate to creation page
      const createRoute = entityListPath(node.data.entityType);
      if (createRoute) {
        navigate(`${createRoute}?action=create`);
      }
    }
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
        fitViewOptions={{ padding: 0.15, maxZoom: 1.2, minZoom: 0.8 }}
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
