/**
 * Form Multi-Step Container Node Component
 * * Phase 4.3: FIX VISUAL DUPLICATION
 * - Removed MiniReactFlow from 'Expanded' state (fixes ghost nodes & blocked buttons)
 * - Added MiniReactFlow to 'Collapsed' state (restores preview)
 * - Added pointer-events: none to MiniFlowWrapper (prevents click interception)
 * * Created: 2026-02-06
 * Updated: 2026-02-10
 */
import React, { useState, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import { NodeProps, Node, Edge, useReactFlow, useNodes, useEdges } from '@xyflow/react';
import { BaseNode, BaseNodeData } from './BaseNode';
import { getNodeTypeDefinition } from '../nodeTypes';
import { ChevronDown, ChevronRight, LogIn } from 'lucide-react';
import { MiniReactFlow } from '../NestedContainer/MiniReactFlow';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface ContainerNodeData extends BaseNodeData {
  containerName?: string;
  containerDescription?: string;
  isExpanded?: boolean;
  showProgressIndicator?: boolean;
  allowBackNavigation?: boolean;
  allowSkipSteps?: boolean;
  tenantFormId?: string;
  tenantWorkFormId?: string;
  
  // Callbacks for parent communication
  onEnterContainer?: (containerId: string) => void;
  
  // Statistics
  nodeCount?: number;
  nodeTypeBreakdown?: Record<string, number>;
  formReferences?: string[];
  
  // Phase 1.2: Drop target indicator
  isDropTarget?: boolean;
}

export interface FormMultiStepContainerNodeProps extends NodeProps<ContainerNodeData> {
  // Phase: Container Child Node Discovery Fix
  // Explicit props to receive full node/edge arrays from parent
  allNodes?: Node[];
  allEdges?: Edge[];
}

// ============================================================================
// Styled Components
// ============================================================================

const ContainerWrapper = styled.div<{ isExpanded: boolean }>`
  min-width: ${props => props.isExpanded ? '400px' : '280px'};
  background: ${props => props.isExpanded 
    ? 'transparent' 
    : 'rgba(var(--color-background-secondary), 0.95)'};
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
  /* Allow clicks to pass through to child nodes */
  pointer-events: none;
  position: relative;
  
  /* Re-enable pointer events only for interactive elements */
  button, a, input {
    pointer-events: auto;
  }
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
  pointer-events: auto;
  
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
  position: relative;
  z-index: 20; 
  
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
  position: relative;
  z-index: 20; 
  
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
  pointer-events: none; /* Crucial: Prevents clicking on mini-nodes */
`;

// ============================================================================
// Component
// ============================================================================

/**
 * Form Multi-Step Container Node Component
 * Renders a container that holds multiple form steps in a sequential workflow.
 * 
 * Phase: Container Child Node Discovery Fix
 * - Now receives allNodes and allEdges as explicit props
 * - Fallback to useNodes()/useEdges() hooks for backwards compatibility
 * - This fixes bug where hidden child nodes weren't being found
 */
export const FormMultiStepContainerNode: React.FC<FormMultiStepContainerNodeProps> = ({
  id,
  data,
  selected,
  allNodes: propsAllNodes,  // New: Explicitly passed from parent
  allEdges: propsAllEdges,  // New: Explicitly passed from parent
}) => {
  const [isExpanded, setIsExpanded] = useState(data.isExpanded ?? true);
  
  // Use reactive hooks as fallback (backwards compatibility)
  const hookNodes = useNodes();
  const hookEdges = useEdges();
  const { setNodes } = useReactFlow();
  
  // Prefer props over hooks (fixes child discovery bug)
  const allNodes = propsAllNodes ?? hookNodes;
  const allEdges = propsAllEdges ?? hookEdges;
  
  // Debug: Log node source and counts
  React.useEffect(() => {
    const source = propsAllNodes ? 'props' : 'hooks';
    const total = allNodes.length;
    const hidden = allNodes.filter(n => n.hidden).length;
    const children = allNodes.filter(n => n.parentId === id).length;
    
    console.group(`[Container ${id}] Node Discovery (${source})`);
    console.log('Total nodes:', total);
    console.log('Hidden nodes:', hidden);
    console.log('My children:', children);
    console.log('Source:', source);
    console.groupEnd();
  }, [allNodes, propsAllNodes, id]);
  
  const nodeDef = getNodeTypeDefinition('formMultiStepContainer');
  
  // Calculate statistics from React Flow state
  const stats = useMemo(() => {
    console.log(`[Container ${id}] Recalculating stats. Total nodes in flow:`, allNodes.length);
    
    // Query child nodes via parentId property
    const childNodes = allNodes.filter(node => node.parentId === id);
    
    console.log(`[Container ${id}] Found ${childNodes.length} child nodes:`, childNodes.map(n => ({
      id: n.id,
      type: n.type,
      hidden: n.hidden,
      parentId: n.parentId,
    })));
    
    // Query edges between child nodes
    const childNodeIds = new Set(childNodes.map(n => n.id));
    const childEdges = allEdges.filter(edge => 
      childNodeIds.has(edge.source) && childNodeIds.has(edge.target)
    );
    
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
      childEdges,
    };
  }, [id, allNodes, allEdges]);
  
  const isConfigured = data.configured || stats.hasNodes;
  
  // Handle collapsing/expanding logic
  const handleHeaderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    
    // Phase 4.5: No need to toggle hidden state - child nodes are ALWAYS hidden
    // They are rendered in MiniReactFlow whether collapsed or expanded
  };
  
  const handleConfigClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // This will be handled by UnifiedFlowEditor's onNodeClick handler
  };
  
  const handleEnterContainer = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (data.onEnterContainer) {
      data.onEnterContainer(id);
    }
  }, [id, data]);
  
  // Get node type statistics for display
  const nodeTypeEntries = Object.entries(stats.nodeTypes).sort((a, b) => b[1] - a[1]);
  
  return (
    <BaseNode 
      id={id} 
      data={data} 
      selected={selected}
      nodeType={nodeDef}
    >
      {/* Container custom UI */}
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
          
          {/* COLLAPSED STATE: Show Mini-Map Preview */}
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
              {/* Only show MiniMap when collapsed as a preview */}
              {stats.hasNodes && (
                <MiniFlowWrapper>
                    <MiniReactFlow
                      containerId={id}
                      nodes={stats.childNodes}
                      edges={stats.childEdges}
                      containerHeight={150} // Smaller height for preview
                    />
                </MiniFlowWrapper>
              )}
            </ContainerSummary>
          )}
          
          {/* EXPANDED STATE: Show interactive MiniReactFlow */}
          {isExpanded && (
            <ContainerBody isExpanded={isExpanded}>
              {stats.hasNodes ? (
                <>
                  {/* Interactive mini canvas when expanded */}
                  <div style={{ 
                    width: '100%',
                    height: '400px',
                    position: 'relative',
                  }}>
                    <MiniReactFlow
                      containerId={id}
                      nodes={stats.childNodes}
                      edges={stats.childEdges}
                      containerHeight={400}
                      interactive={true}
                      onNodeClick={handleNodeClick}
                      onNodesChange={handleNodesChange}
                    />
                  </div>
                  
                  {/* Compact summary at the bottom */}
                  <div style={{ 
                    position: 'absolute', 
                    bottom: '16px', 
                    left: '16px', 
                    right: '16px',
                    background: 'rgba(var(--color-background-secondary), 0.95)',
                    borderRadius: '8px',
                    padding: '12px',
                    pointerEvents: 'auto',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  }}>
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
                    
                    <EnterButton onClick={handleEnterContainer} style={{ marginTop: '8px', marginBottom: '0' }}>
                      <LogIn />
                      Enter Container to Edit
                    </EnterButton>
                    
                    <ConfigButton onClick={handleConfigClick} style={{ marginTop: '8px' }}>
                      Configure Container
                    </ConfigButton>
                  </div>
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
    </BaseNode>
  );
};

export default FormMultiStepContainerNode;
