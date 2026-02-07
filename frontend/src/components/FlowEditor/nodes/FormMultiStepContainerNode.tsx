/**
 * Form Multi-Step Container Node Component
 * 
 * Container node that groups multiple workflow nodes (forms, actions, conditions)
 * into a sequential flow. Displays child nodes in a nested React Flow canvas.
 * 
 * Phase 4.2 of WF-ENH-2026-Q1
 * Created: 2026-02-06
 * Updated: 2026-02-07 - Implemented nested React Flow architecture
 */
import React, { useState, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import { NodeProps, Node, Edge } from '@xyflow/react';
import { BaseNode, BaseNodeData } from './BaseNode';
import { getNodeTypeDefinition } from '../nodeTypes';
import { ChevronDown, ChevronRight, Maximize2, Minimize2, LogIn, ZoomIn } from 'lucide-react';
import { MiniReactFlow } from '../NestedContainer/MiniReactFlow';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface ContainerNodeData extends BaseNodeData {
  containerName?: string;
  containerDescription?: string;
  childNodes?: Node[]; // Array of child nodes stored IN this container
  childEdges?: Edge[]; // Array of edges between child nodes
  isExpanded?: boolean;
  showProgressIndicator?: boolean;
  allowBackNavigation?: boolean;
  allowSkipSteps?: boolean;
  tenantFormId?: string; // If container represents a multi-step form
  tenantWorkFormId?: string; // If container is a saved workflow
  
  // Callbacks for parent communication
  onEnterContainer?: (containerId: string) => void;
  
  // Statistics (auto-calculated)
  nodeCount?: number;
  nodeTypeBreakdown?: Record<string, number>; // {"formStep": 3, "actionEmail": 1, ...}
  formReferences?: string[]; // Array of TenantForm IDs used within
}

export interface FormMultiStepContainerNodeProps extends NodeProps<ContainerNodeData> {}

// ============================================================================
// Styled Components
// ============================================================================

const ContainerWrapper = styled.div<{ isExpanded: boolean }>`
  min-width: ${props => props.isExpanded ? '400px' : '280px'};
  background: rgba(var(--color-background-secondary), 0.95);
  border: 2px solid rgb(139, 92, 246); /* Purple - container color */
  border-radius: 12px;
  box-shadow: 
    0 4px 6px rgba(0, 0, 0, 0.1),
    0 0 0 4px rgba(139, 92, 246, 0.1);
  transition: all 0.2s ease;
  position: relative;
  
  &:hover {
    box-shadow: 
      0 6px 12px rgba(0, 0, 0, 0.15),
      0 0 0 4px rgba(139, 92, 246, 0.2);
  }
  
  &.selected {
    border-color: rgb(139, 92, 246);
    box-shadow: 
      0 8px 16px rgba(0, 0, 0, 0.2),
      0 0 0 4px rgba(139, 92, 246, 0.3);
  }
  
  /* Drop zone indicator when dragging nodes */
  &.drag-over {
    border-color: rgb(34, 197, 94);
    box-shadow: 
      0 8px 16px rgba(34, 197, 94, 0.2),
      0 0 0 4px rgba(34, 197, 94, 0.3);
    background: rgba(34, 197, 94, 0.05);
  }
`;

const ContainerHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05));
  border-bottom: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 10px 10px 0 0;
  cursor: pointer;
  user-select: none;
  
  &:hover {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(139, 92, 246, 0.1));
  }
`;

const ExpandIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(139, 92, 246);
  transition: transform 0.2s ease;
`;

const ContainerIcon = styled.div`
  font-size: 24px;
  line-height: 1;
`;

const ContainerTitle = styled.div`
  flex: 1;
  
  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: rgb(var(--color-text-primary));
    line-height: 1.3;
  }
  
  p {
    margin: 4px 0 0;
    font-size: 12px;
    color: rgb(var(--color-text-secondary));
    line-height: 1.2;
  }
`;

const StatusBadge = styled.div<{ type: 'configured' | 'draft' }>`
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: ${props => props.type === 'configured' 
    ? 'rgba(34, 197, 94, 0.15)' 
    : 'rgba(234, 179, 8, 0.15)'};
  color: ${props => props.type === 'configured'
    ? 'rgb(34, 197, 94)'
    : 'rgb(234, 179, 8)'};
`;

const ContainerBody = styled.div<{ isExpanded: boolean }>`
  padding: ${props => props.isExpanded ? '16px' : '12px 16px'};
  display: ${props => props.isExpanded ? 'block' : 'none'};
  min-height: ${props => props.isExpanded ? '200px' : 'auto'};
  min-width: 300px;
`;

const ContainerSummary = styled.div`
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SummaryRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  
  .label {
    color: rgb(var(--color-text-secondary));
    font-weight: 500;
  }
  
  .value {
    color: rgb(var(--color-text-primary));
    font-weight: 600;
  }
`;

const NodeTypeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
  margin-top: 8px;
`;

const NodeTypeCard = styled.div`
  padding: 8px 12px;
  background: rgba(var(--color-background-tertiary), 0.5);
  border-radius: 6px;
  border: 1px solid rgba(var(--color-border), 0.3);
  
  .type-name {
    font-size: 11px;
    color: rgb(var(--color-text-secondary));
    text-transform: capitalize;
    margin-bottom: 4px;
  }
  
  .type-count {
    font-size: 18px;
    font-weight: 700;
    color: rgb(var(--color-text-primary));
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 24px 16px;
  color: rgb(var(--color-text-secondary));
  
  .icon {
    font-size: 32px;
    margin-bottom: 8px;
    opacity: 0.5;
  }
  
  .message {
    font-size: 13px;
    line-height: 1.5;
  }
  
  .drop-hint {
    margin-top: 12px;
    padding: 8px 12px;
    background: rgba(139, 92, 246, 0.1);
    border: 1px dashed rgba(139, 92, 246, 0.3);
    border-radius: 6px;
    font-size: 12px;
    color: rgb(139, 92, 246);
    font-weight: 500;
  }
`;

const ConfigButton = styled.button`
  width: 100%;
  padding: 10px;
  margin-top: 12px;
  background: linear-gradient(135deg, rgb(139, 92, 246), rgb(109, 40, 217));
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const EnterButton = styled.button`
  width: 100%;
  padding: 10px;
  margin-top: 8px;
  background: rgba(59, 130, 246, 0.15);
  color: rgb(59, 130, 246);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.5);
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

const MiniFlowWrapper = styled.div`
  margin-top: 12px;
  border-radius: 8px;
  overflow: hidden;
`;

// ============================================================================
// Component
// ============================================================================

export const FormMultiStepContainerNode: React.FC<FormMultiStepContainerNodeProps> = ({
  id,
  data,
  selected,
}) => {
  const [isExpanded, setIsExpanded] = useState(data.isExpanded ?? true);
  
  const nodeDef = getNodeTypeDefinition('formMultiStepContainer');
  
  // Calculate statistics
  const stats = useMemo(() => {
    const childNodes = data.childNodes || [];
    const nodeCount = childNodes.length;
    const nodeTypes: Record<string, number> = {};
    const formRefs = new Set<string>();
    
    childNodes.forEach(node => {
      const nodeType = node.type || 'unknown';
      nodeTypes[nodeType] = (nodeTypes[nodeType] || 0) + 1;
      
      // Track form references
      if (node.data?.tenantFormId) {
        formRefs.add(node.data.tenantFormId);
      }
    });
    
    return {
      nodeCount,
      nodeTypes,
      formRefs: formRefs.size,
      hasNodes: nodeCount > 0,
      childNodes,
      childEdges: data.childEdges || [],
    };
  }, [data.childNodes, data.childEdges]);
  
  const isConfigured = data.configured || stats.hasNodes;
  
  const handleHeaderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };
  
  const handleConfigClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // This will be handled by UnifiedFlowEditor's onNodeClick handler
  };
  
  const handleEnterContainer = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onEnterContainer) {
      data.onEnterContainer(id);
    }
  }, [id, data]);
  
  const handleNodesChange = useCallback((updatedNodes: Node[]) => {
    // TODO: Propagate changes back to parent
    console.log('[Container] Child nodes changed:', updatedNodes);
  }, []);
  
  const handleEdgesChange = useCallback((updatedEdges: Edge[]) => {
    // TODO: Propagate changes back to parent
    console.log('[Container] Child edges changed:', updatedEdges);
  }, []);
  
  // Get node type statistics for display
  const nodeTypeEntries = Object.entries(stats.nodeTypes).sort((a, b) => b[1] - a[1]);
  
  return (
    <BaseNode 
      id={id} 
      data={data} 
      selected={selected}
      customContent={
        <ContainerWrapper 
          isExpanded={isExpanded}
          className={`${selected ? 'selected' : ''} ${data.isDropTarget ? 'drag-over' : ''}`}
        >
          <ContainerHeader onClick={handleHeaderClick}>
            <ExpandIcon>
              {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </ExpandIcon>
            
            <ContainerIcon>
              {nodeDef.icon}
            </ContainerIcon>
            
            <ContainerTitle>
              <h3>{data.containerName || data.label || 'Unnamed Container'}</h3>
              {data.containerDescription && (
                <p>{data.containerDescription}</p>
              )}
            </ContainerTitle>
            
            <StatusBadge type={isConfigured ? 'configured' : 'draft'}>
              {isConfigured ? 'Active' : 'Draft'}
            </StatusBadge>
          </ContainerHeader>
          
          {!isExpanded && (
            <ContainerSummary>
              <SummaryRow>
                <span className="label">Nodes:</span>
                <span className="value">{stats.nodeCount}</span>
              </SummaryRow>
              {stats.formRefs > 0 && (
                <SummaryRow>
                  <span className="label">Forms:</span>
                  <span className="value">{stats.formRefs}</span>
                </SummaryRow>
              )}
            </ContainerSummary>
          )}
          
          {isExpanded && (
            <ContainerBody isExpanded={isExpanded}>
              {stats.hasNodes ? (
                <>
                  <SummaryRow>
                    <span className="label">Total Nodes:</span>
                    <span className="value">{stats.nodeCount}</span>
                  </SummaryRow>
                  
                  {stats.formRefs > 0 && (
                    <SummaryRow>
                      <span className="label">Form References:</span>
                      <span className="value">{stats.formRefs}</span>
                    </SummaryRow>
                  )}
                  
                  {/* Mini React Flow Canvas */}
                  <MiniFlowWrapper>
                    <MiniReactFlow
                      nodes={stats.childNodes}
                      edges={stats.childEdges}
                      onNodesChange={handleNodesChange}
                      onEdgesChange={handleEdgesChange}
                      readOnly={false}
                      containerHeight={250}
                    />
                  </MiniFlowWrapper>
                  
                  {nodeTypeEntries.length > 0 && (
                    <>
                      <div style={{ marginTop: '12px', marginBottom: '8px' }}>
                        <span className="label" style={{ fontSize: '12px' }}>
                          Node Breakdown:
                        </span>
                      </div>
                      <NodeTypeGrid>
                        {nodeTypeEntries.slice(0, 4).map(([type, count]) => (
                          <NodeTypeCard key={type}>
                            <div className="type-name">{type.replace(/([A-Z])/g, ' $1').trim()}</div>
                            <div className="type-count">{count}</div>
                          </NodeTypeCard>
                        ))}
                      </NodeTypeGrid>
                    </>
                  )}
                  
                  <EnterButton onClick={handleEnterContainer}>
                    <LogIn />
                    Enter Container to Edit
                  </EnterButton>
                  
                  <ConfigButton onClick={handleConfigClick}>
                    Configure Container
                  </ConfigButton>
                </>
              ) : (
                <EmptyState>
                  <div className="icon">📦</div>
                  <div className="message">
                    This container is empty.<br />
                    Drag nodes here to group them into a sequential flow.
                  </div>
                  <div className="drop-hint">
                    💡 Tip: Drag any node (except triggers) into this container to add it
                  </div>
                  <ConfigButton onClick={handleConfigClick}>
                    Configure Container
                  </ConfigButton>
                </EmptyState>
              )}
            </ContainerBody>
          )}
        </ContainerWrapper>
      }
    />
  );
};

export default FormMultiStepContainerNode;
