/**
 * Form Process Node Component (formerly Form Multi-Step Container)
 * 
 * REFACTORED: Single ReactFlow Architecture (Option A)
 * - No nested MiniReactFlow (removed)
 * - Acts as a React Flow 'group' node
 * - Children render in main ReactFlow with parentId
 * - Expand/collapse controls child visibility via hidden property
 * 
 * Based on: https://reactflow.dev/examples/grouping/sub-flows
 * 
 * Created: 2026-02-06
 * Refactored: 2026-02-12 - Single ReactFlow architecture
 * Renamed: 2026-02-14 - Phase 2: FormMultiStepContainer → FormProcess
 */
import React, { useState, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import { NodeProps, Node, Edge, NodeToolbar, Position, useReactFlow, useNodes, useEdges } from '@xyflow/react';
import { BaseNode, BaseNodeData } from './BaseNode';
import { getNodeTypeDefinition } from '../nodeTypes';
import { ChevronDown, ChevronRight, LogIn, Edit2, Trash2, Plus, Copy } from 'lucide-react';
import { calculateStepOrder, getStepLabel } from '../utils/stepOrderingUtils'; // Phase B.1
import { useFlowEditorNodeActions } from '../context';
// REMOVED: import { MiniReactFlow } from '../NestedContainer/MiniReactFlow';

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

export interface FormProcessNodeProps extends NodeProps<Node<ContainerNodeData>> {  
  // REFACTORED: No longer need drop handlers (handled by main ReactFlow)
  // No longer need allNodes/allEdges props (use hooks directly)
}

// ============================================================================
// Styled Components
// ============================================================================

const ContainerWrapper = styled.div<{ isExpanded: boolean }>`
  position: relative;
  min-width: ${props => props.isExpanded ? '800px' : '320px'};
  min-height: ${props => props.isExpanded ? '500px' : 'auto'};
  max-width: ${props => props.isExpanded ? 'none' : '400px'};
  
  /* Phase B: Visual containment for sub-flows pattern */
  /* Keep background opaque so the container is not transparent on the canvas */
  background: rgb(var(--color-surface));
  
  /* FIX: Ensure border always renders, even when collapsed */
  border-width: 2px;
  border-style: ${props => props.isExpanded ? 'dashed' : 'solid'};
  border-color: ${props => props.isExpanded 
    ? 'rgba(var(--color-primary), 0.4)' 
    : 'rgba(var(--color-primary), 0.6)'};
  
  border-radius: 12px;
  box-shadow: 
    0 4px 12px rgba(var(--color-overlay), 0.12),
    0 0 0 4px rgba(var(--color-primary), 0.15);
  
  /* FIX: Smooth transition but preserve border */
  transition: 
    min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    min-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-style 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  position: relative;
  overflow: visible; /* Allow child nodes to render inside visually */
  padding: ${props => props.isExpanded ? '0' : '0'}; /* Padding handled by body */
  
  /* Phase B: Group indicator when expanded */
  ${props => props.isExpanded && `
    &::after {
      content: 'Form Process Container';
      position: absolute;
      top: 8px;
      right: 12px;
      font-size: 10px;
      font-weight: 500;
      color: rgba(var(--color-primary), 0.5);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      pointer-events: none;
    }
  `}
  
  &:hover {
    box-shadow: 
      0 6px 16px rgba(var(--color-overlay), 0.18),
      0 0 0 4px rgba(var(--color-primary), 0.25);
  }
  
  &.selected {
    border-color: ${props => props.isExpanded 
      ? 'rgba(var(--color-primary), 0.6)' 
      : 'rgb(var(--color-primary))'};
    box-shadow: 
      0 8px 20px rgba(var(--color-overlay), 0.25),
      0 0 0 4px rgba(var(--color-primary), 0.4);
  }
  
  &.drag-over {
    border-color: rgb(var(--color-success));
    border-style: ${props => props.isExpanded ? 'dashed' : 'solid'};
    box-shadow: 
      0 8px 20px rgba(var(--color-success), 0.3),
      0 0 0 4px rgba(var(--color-success), 0.4);
    background: rgba(var(--color-success), 0.08);
  }
`;

const ContainerHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  /* Solid color header like regular nodes */
  background: rgb(var(--color-primary));
  border-bottom: none;
  border-radius: 10px 10px 0 0;
  cursor: grab;
  user-select: none;
  color: rgb(var(--color-text-inverse));
  overflow: hidden; /* Contain header styling within rounded corners */
  
  &:hover {
    background: rgb(var(--color-primary-hover));
  }

  &:active {
    cursor: grabbing;
  }
`;

const ExpandIcon = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--color-text-inverse)); /* White icon for solid header */
  transition: transform 0.2s ease;
  border: none;
  background: transparent;
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background: rgba(var(--color-header-background), 0.16);
  }
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
    font-weight: 700;
    color: rgba(var(--color-header-background), 0.98);
    line-height: 1.3;
  }
  
  p {
    margin: 4px 0 0;
    font-size: 12px;
    color: rgba(var(--color-header-background), 0.85);
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
    ? 'rgba(var(--color-header-background), 0.3)' 
    : 'rgba(var(--color-header-background), 0.2)'};
  color: rgb(var(--color-text-inverse));
`;

const ContainerBody = styled.div<{ isExpanded: boolean }>`
  padding: ${props => props.isExpanded ? '16px' : '12px 16px'};
  display: ${props => props.isExpanded ? 'block' : 'none'};
  min-height: ${props => props.isExpanded ? '350px' : 'auto'};
  min-width: 300px;
  position: relative;
  overflow: ${props => props.isExpanded ? 'visible' : 'hidden'};
  
`;

/* Phase B: Visual area for child nodes */
const ChildNodesArea = styled.div`
  position: relative;
  min-height: 300px;
  border-radius: 8px;
  border: 1px dashed rgba(var(--color-primary), 0.2);
  background: rgba(var(--color-header-background), 0.02);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 16px;
  padding: 24px;
  
  &:empty::before {
    content: 'Drag nodes here to add steps to this form process';
    color: rgba(var(--color-primary), 0.4);
    font-size: 13px;
    text-align: center;
    font-style: italic;
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
    background: rgba(var(--color-primary), 0.1);
    border: 1px dashed rgba(var(--color-primary), 0.3);
    border-radius: 6px;
    font-size: 12px;
    color: rgb(var(--color-primary));
    font-weight: 500;
  }
`;

const ConfigButton = styled.button`
  width: 100%;
  padding: 10px;
  margin-top: 12px;
  background: linear-gradient(135deg, rgb(var(--color-primary)), rgb(var(--color-primary-active)));
  color: rgb(var(--color-text-inverse));
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
    box-shadow: 0 4px 12px rgba(var(--color-primary), 0.3);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const ToolbarCard = styled.div`
  display: flex;
  gap: 4px;
  background: rgb(var(--color-surface));
  padding: 6px;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border));
  box-shadow: 0 4px 12px rgba(var(--color-overlay), 0.15);
  z-index: 50;
`;

const ToolbarBtn = styled.button<{ $danger?: boolean }>`
  padding: 6px;
  border-radius: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: ${(props) => (props.$danger ? 'rgb(var(--color-error))' : 'rgb(var(--color-text-secondary))')};
  transition: all 0.15s ease;

  &:hover {
    background: ${(props) =>
      props.$danger ? 'rgba(var(--color-error), 0.1)' : 'rgba(var(--color-primary), 0.1)'};
    color: ${(props) => (props.$danger ? 'rgb(var(--color-error))' : 'rgb(var(--color-primary))')};
  }
`;

/* Phase B.1: Step List Components */
const StepList = styled.div`
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const StepItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(var(--color-header-background), 0.05);
  border-radius: 6px;
  border: 1px solid rgba(var(--color-primary), 0.2);
  font-size: 12px;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(var(--color-primary), 0.08);
    border-color: rgba(var(--color-primary), 0.3);
  }
`;

const StepNumber = styled.div`
  min-width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(var(--color-primary), 0.2);
  color: rgb(var(--color-primary));
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 11px;
`;

const StepNodeInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  
  .node-label {
    font-weight: 500;
    color: rgb(var(--color-text-primary));
  }
  
  .node-type {
    font-size: 10px;
    color: rgb(var(--color-text-secondary));
    text-transform: capitalize;
  }
`;

const EnterButton = styled.button`
  width: 100%;
  padding: 10px;
  margin-top: 8px;
  background: rgba(var(--color-info), 0.15);
  color: rgb(var(--color-info));
  border: 1px solid rgba(var(--color-info), 0.3);
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
    background: rgba(var(--color-info), 0.25);
    border-color: rgba(var(--color-info), 0.5);
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

// ============================================================================
// Component
// ============================================================================

/**
 * Form Process Node Component
 * 
 * REFACTORED: Single ReactFlow Architecture (Option A)
 * - Acts as a React Flow 'group' node (no nested ReactFlow)
 * - Children render in main ReactFlow with parentId set to this node's id
 * - Expand/collapse toggles child visibility via hidden property
 * - Uses React Flow's official grouping pattern
 */
export const FormProcessNode = React.memo<FormProcessNodeProps>(({
  id,
  data,
  selected,
}) => {
  const nodeActions = useFlowEditorNodeActions();
  const [isExpanded, setIsExpanded] = useState(data.isExpanded ?? true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  
  // Use hooks to access all nodes/edges
  const allNodes = useNodes();
  const allEdges = useEdges();
  const { setNodes } = useReactFlow();
  
  const nodeDef =
    getNodeTypeDefinition('formProcess') ??
    ({
      id: 'formProcess',
      name: 'Form Process',
      category: 'form',
      icon: '📚',
      color: 'rgb(var(--color-primary))',
      description: 'Multi-step form container',
      maxInputs: 1,
      maxOutputs: 1,
    } as any);
  
  // Calculate statistics from child nodes
  const stats = useMemo(() => {
    // Query child nodes via parentId property (React Flow v12 pattern)
    const childNodes = allNodes.filter(node => node.parentId === id);
    
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
      const tenantFormId = (node.data as any)?.tenantFormId;
      if (typeof tenantFormId === 'string' && tenantFormId.length > 0) {
        formRefs.add(tenantFormId);
      }
    });
    
    // Phase B.1: Calculate step ordering
    const stepOrder = calculateStepOrder(id, allNodes, allEdges);
    
    return {
      nodeCount,
      nodeTypes,
      formRefs: formRefs.size,
      hasNodes: nodeCount > 0,
      childNodes,
      childEdges,
      stepOrder, // Phase B.1: Map of node ID to step number
    };
  }, [id, allNodes, allEdges]);
  
  const isConfigured = data.configured || stats.hasNodes;
  
  // Handle collapsing/expanding - toggle child node visibility
  const handleHeaderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    
    // Toggle visibility of child nodes using React Flow's hidden property
    setNodes(currentNodes => 
      currentNodes.map(node => 
        node.parentId === id
          ? { ...node, hidden: !newExpandedState } // Hide if collapsed, show if expanded
          : node
      )
    );
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
  const handleAddStep = (data as any).onAddStepInsideForm ?? (() => nodeActions.addStepInsideForm(id));
  const handleDuplicate = (data as any).onDuplicate ?? (() => nodeActions.duplicateNode(id));
  const handleEdit = data.onEdit ?? (() => nodeActions.editNode(id));
  const handleDelete = data.onDelete ?? (() => nodeActions.deleteNode(id));
  const handleTitleChange =
    ((data as any).onTitleChange as ((newTitle: string) => void) | undefined) ??
    ((newTitle: string) => nodeActions.changeNodeTitle(id, newTitle));
  
  // Get node type statistics for display
  const nodeTypeEntries = Object.entries(stats.nodeTypes).sort((a, b) => b[1] - a[1]);
  
  return (
    <>
      <NodeToolbar isVisible={!!selected} position={Position.Top}>
        <ToolbarCard className="nodrag">
          <ToolbarBtn
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!isExpanded) {
                setIsExpanded(true);
                setNodes((current) =>
                  current.map((n) => (n.parentId === id ? { ...n, hidden: false } : n))
                );
              }
              handleAddStep();
            }}
            title="Add step"
          >
            <Plus size={16} />
          </ToolbarBtn>
          <ToolbarBtn
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDuplicate();
            }}
            title="Duplicate"
          >
            <Copy size={16} />
          </ToolbarBtn>
          <ToolbarBtn
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit();
            }}
            title="Edit"
          >
            <Edit2 size={16} />
          </ToolbarBtn>
          <ToolbarBtn
            type="button"
            $danger
            onClick={(e) => {
              e.stopPropagation();
              void handleDelete();
            }}
            title="Delete"
          >
            <Trash2 size={16} />
          </ToolbarBtn>
        </ToolbarCard>
      </NodeToolbar>

      {/* Container custom UI */}
      <ContainerWrapper 
          isExpanded={isExpanded}
          className={`pm-node ${selected ? 'selected is-selected' : ''} ${data.isDropTarget ? 'drag-over' : ''}`}
        >
          <ContainerHeader>
            <ExpandIcon
              type="button"
              className="nodrag"
              onClick={(e) => {
                if (isEditingTitle) {
                  e.stopPropagation();
                  return;
                }
                handleHeaderClick(e);
              }}
              aria-label={isExpanded ? 'Collapse container' : 'Expand container'}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </ExpandIcon>
            
            <ContainerIcon>
              {nodeDef.icon}
            </ContainerIcon>
            
            <ContainerTitle>
              {isEditingTitle ? (
                <input
                   className="nodrag"
                   value={draftTitle}
                   onChange={(e) => setDraftTitle(e.target.value)}
                   onBlur={() => {
                     const currentTitle = String((data as any).title || data.containerName || data.label || '').trim();
                     const next = draftTitle.trim();
                     if (next && next !== currentTitle) handleTitleChange(next);
                     setIsEditingTitle(false);
                   }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      (e.target as HTMLInputElement).blur();
                    } else if (e.key === 'Escape') {
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    fontWeight: 700,
                    fontSize: '16px',
                    borderRadius: 8,
                    border: '1px solid rgba(var(--color-header-background), 0.45)',
                    padding: '6px 8px',
                    background: 'rgba(var(--color-header-background), 0.16)',
                    color: 'rgb(var(--color-primary-foreground))',
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
               ) : (
                 <h3
                   onDoubleClick={(e) => {
                     e.stopPropagation();
                     setDraftTitle(String((data as any).title || data.containerName || data.label || ''));
                     setIsEditingTitle(true);
                   }}
                   style={{ cursor: 'text' }}
                 >
                  {(data as any).title || data.containerName || data.label || 'Unnamed Container'}
                </h3>
              )}
              {data.containerDescription && (
                <p>{data.containerDescription}</p>
              )}
            </ContainerTitle>
            
            <StatusBadge type={isConfigured ? 'configured' : 'draft'}>
              {isConfigured ? 'Active' : 'Draft'}
            </StatusBadge>
          </ContainerHeader>
          
          {/* Container Body - Show statistics and controls */}
          <ContainerBody isExpanded={isExpanded}>
            {isExpanded ? (
              // EXPANDED: Show stats and hint that children are visible on canvas
              <div style={{ padding: '16px' }}>
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
                  
                  {nodeTypeEntries.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Node Types:</span>
                      {nodeTypeEntries.slice(0, 3).map(([type, count]) => (
                        <div key={type} style={{ 
                          fontSize: '11px', 
                          marginTop: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}>
                          <span>{type}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Phase B.1: Step Order List */}
                  {stats.hasNodes && stats.stepOrder.size > 0 && (
                    <StepList>
                      <div style={{ 
                        fontSize: '11px', 
                        opacity: 0.7,
                        marginBottom: '4px',
                        fontWeight: 600,
                      }}>
                        Execution Order:
                      </div>
                      {Array.from(stats.stepOrder.entries())
                        .sort((a, b) => a[1] - b[1]) // Sort by step number
                        .slice(0, 5) // Show max 5 steps
                        .map(([nodeId, stepNum]) => {
                          const childNode = stats.childNodes.find(n => n.id === nodeId);
                          if (!childNode) return null;
                          
                          return (
                            <StepItem key={nodeId}>
                              <StepNumber>{stepNum}</StepNumber>
                              <StepNodeInfo>
                                <div className="node-label">
                                  {String((childNode.data as any)?.label ?? 'Unnamed Node')}
                                </div>
                                <div className="node-type">
                                  {childNode.type || 'unknown'}
                                </div>
                              </StepNodeInfo>
                            </StepItem>
                          );
                        })}
                      {stats.stepOrder.size > 5 && (
                        <div style={{ 
                          fontSize: '11px', 
                          color: 'rgba(var(--color-primary), 0.6)',
                          textAlign: 'center',
                          marginTop: '4px',
                        }}>
                          +{stats.stepOrder.size - 5} more steps
                        </div>
                      )}
                    </StepList>
                  )}
                  
                  {stats.hasNodes ? (
                    <div style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      background: 'rgba(var(--color-info), 0.1)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: 'rgb(var(--color-info))',
                    }}>
                      ℹ️ Child nodes are visible on the main canvas
                    </div>
                  ) : (
                    <EmptyState>
                      <div className="icon">📦</div>
                      <div className="message">
                        This container is empty.<br />
                        Drag nodes here to group them into a sequential flow.
                      </div>
                      <div className="drop-hint">
                        💡 Tip: Drag any node from the palette and drop it inside this container
                      </div>
                    </EmptyState>
                  )}
                  
                  <ConfigButton onClick={handleConfigClick} style={{ marginTop: '12px' }}>
                    Configure Container
                  </ConfigButton>
                </div>
            ) : (
              // COLLAPSED: Show compact summary
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
          </ContainerBody>
        </ContainerWrapper>
    </>
  );
});

export default FormProcessNode;
