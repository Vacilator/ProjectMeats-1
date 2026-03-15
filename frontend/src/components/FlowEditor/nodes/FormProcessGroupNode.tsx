/**
 * Form Process Group Node Component
 * 
 * Implements React Flow's labeled group + parent-child pattern for multi-step forms.
 * This is the IDEAL container implementation using React Flow's native grouping.
 * 
 * Architecture:
 * - Uses type: 'formProcessGroup' (registered in nodeTypes)
 * - Children have parentId pointing to this group's ID
 * - Children have extent: 'parent' for containment
 * - Group has isGroup: true for React Flow grouping behavior
 * - Resizable container with labeled header
 * - Vertical auto-layout for children
 * - Schema-driven configuration via DynamicConfigPanel
 * 
 * References:
 * - https://reactflow.dev/examples/nodes/draggable-subflow
 * - https://reactflow.dev/examples/layout/sub-flows
 * 
 * Created: 2026-02-19 - Phase E.3
 * 
 * @module FormProcessGroupNode
 */

import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { logger } from '@/utils/logger';

import styled from 'styled-components';
import { NodeProps, Node, Edge, useReactFlow, useNodes, useEdges } from '@xyflow/react';
import { BaseNode, BaseNodeData } from './BaseNode';
import { ChevronDown, ChevronRight, Plus, Settings, Save, Check } from 'lucide-react';
import { autoLayoutChildren, calculateChildYPosition } from './FormProcessChildWrapper';
import { saveFormProcessGroup } from '../../../services/tenantFormService';
import toast from 'react-hot-toast';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Data structure for Form Process Group Node
 * Extends BaseNodeData with group-specific properties
 */
export interface FormProcessGroupData extends BaseNodeData {
  /** Display name of the form process */
  containerName?: string;
  /** Description of the form process */
  containerDescription?: string;
  /** Whether the group is visually expanded to show children */
  isExpanded?: boolean;
  /** Show progress indicator in runtime */
  showProgressIndicator?: boolean;
  /** Allow users to navigate back to previous steps */
  allowBackNavigation?: boolean;
  /** Allow users to skip optional steps */
  allowSkipSteps?: boolean;
  /** Reference to tenant form */
  tenantFormId?: string;
  /** Reference to tenant workform */
  tenantWorkFormId?: string;
  /** Group flag for React Flow */
  isGroup?: boolean;
  /** Drop target indicator (Phase 3) */
  isDropTarget?: boolean;
  /** Sequential execution order enabled (Phase 3) */
  sequentialExecution?: boolean;
  /** Edit handler from UnifiedFlowEditor */
  onEdit?: () => void;
  /** Delete handler from UnifiedFlowEditor */
  onDelete?: () => void;
}

export interface FormProcessGroupNodeProps extends NodeProps<FormProcessGroupData> {}

// ============================================================================
// Styled Components
// ============================================================================

/**
 * Global keyframes animation for spinner
 */
const spinAnimation = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

/**
 * Container wrapper with group styling
 * Adapts size based on expanded/collapsed state
 * Phase 3: Added drop zone indicator
 */
const GroupContainer = styled.div<{ isExpanded: boolean; stepCount: number; isDropTarget?: boolean }>`
  ${spinAnimation}
  
  min-width: ${props => props.isExpanded ? '600px' : '280px'};
  min-height: ${props => props.isExpanded ? `${Math.max(400, props.stepCount * 120 + 80)}px` : 'auto'};
  max-width: ${props => props.isExpanded ? '1200px' : '320px'};
  
  background: ${props => {
    if (props.isDropTarget) return 'rgba(139, 92, 246, 0.15)'; // Highlight when dragging over
    return props.isExpanded 
      ? 'rgba(139, 92, 246, 0.03)' 
      : 'rgb(var(--color-background-secondary))';
  }};
  
  /* FIX: Split border shorthand to prevent disappearing during collapse */
  border-width: 2px;
  border-style: ${props => props.isExpanded ? 'dashed' : 'solid'};
  border-color: ${props => 
    props.isDropTarget ? 'rgba(139, 92, 246, 0.8)' : 'rgba(139, 92, 246, 0.5)'
  };
  border-radius: 12px;
  overflow: ${props => props.isExpanded ? 'visible' : 'hidden'};
  position: relative;
  
  box-shadow: ${props => {
    if (!props.isExpanded) return 'none';
    return props.isDropTarget
      ? '0 8px 24px rgba(139, 92, 246, 0.3), 0 0 0 6px rgba(139, 92, 246, 0.2)'
      : '0 4px 12px rgba(0, 0, 0, 0.1), 0 0 0 4px rgba(139, 92, 246, 0.1)';
  }};
  
  /* FIX: Only transition specific properties, not all */
  transition: 
    min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    min-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-style 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    box-shadow: ${props => {
      if (!props.isExpanded) return 'none';
      return '0 6px 16px rgba(0, 0, 0, 0.15), 0 0 0 4px rgba(139, 92, 246, 0.2)';
    }};
  }
  
  /* Group label indicator */
  ${props => props.isExpanded && `
    &::after {
      content: '${props.isDropTarget ? 'DROP HERE TO ADD' : 'FORM PROCESS GROUP'}';
      position: absolute;
      top: 12px;
      right: 16px;
      font-size: 10px;
      font-weight: 600;
      color: rgba(139, 92, 246, 0.4);
      text-transform: uppercase;
      letter-spacing: 1px;
      pointer-events: none;
      user-select: none;
    }
  `}
`;

/**
 * Labeled header with step count and controls
 */
const GroupHeader = styled.div<{ isExpanded: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: ${props => props.isExpanded 
    ? 'rgba(139, 92, 246, 0.08)' 
    : 'rgba(139, 92, 246, 0.12)'};
  border-bottom: 1px solid rgba(139, 92, 246, 0.2);
  cursor: pointer;
  user-select: none;
  
  &:hover {
    background: rgba(139, 92, 246, 0.15);
  }
  
  transition: background 0.2s ease;
`;

const ExpandIcon = styled.div<{ isExpanded: boolean }>`
  display: flex;
  align-items: center;
  color: rgba(139, 92, 246, 0.7);
  transition: transform 0.2s ease;
  flex-shrink: 0;
`;

const GroupTitle = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const GroupName = styled.div`
  font-weight: 600;
  font-size: 15px;
  color: rgb(var(--color-text-primary));
`;

const GroupMeta = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  display: flex;
  align-items: center;
  gap: 12px;
`;

const StepCount = styled.span<{ hasSteps: boolean }>`
  font-weight: 500;
  color: ${props => props.hasSteps 
    ? 'rgba(139, 92, 246, 0.9)' 
    : 'rgb(var(--color-text-tertiary))'};
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
`;

const IconButton = styled.button<{ variant?: 'primary' | 'default'; isSaving?: boolean }>`
  padding: 6px;
  background: ${props => {
    if (props.variant === 'primary') return 'rgba(139, 92, 246, 0.15)';
    return 'transparent';
  }};
  border: none;
  border-radius: var(--radius-sm);
  color: ${props => 
    props.variant === 'primary' 
      ? 'rgba(139, 92, 246, 0.9)' 
      : 'rgb(var(--color-text-secondary))'
  };
  cursor: ${props => props.isSaving ? 'wait' : 'pointer'};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.15s ease;
  font-size: 12px;
  font-weight: 500;
  opacity: ${props => props.isSaving ? 0.6 : 1};
  
  &:hover {
    background: rgba(139, 92, 246, 0.15);
    color: rgba(139, 92, 246, 0.9);
  }
  
  &:active {
    transform: ${props => props.isSaving ? 'none' : 'scale(0.95)'};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

/**
 * Body area for children (when expanded)
 * With smooth CSS transition animation
 */
const GroupBody = styled.div<{ isExpanded: boolean }>`
  padding: ${props => props.isExpanded ? '20px' : '0'};
  min-height: ${props => props.isExpanded ? '300px' : '0'};
  max-height: ${props => props.isExpanded ? '2000px' : '0'};
  position: relative;
  display: block;
  overflow: hidden;
  opacity: ${props => props.isExpanded ? 1 : 0};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
`;

/**
 * Empty state message
 */
const EmptyState = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: rgb(var(--color-text-tertiary));
  font-size: 14px;
  pointer-events: none;
  user-select: none;
  
  svg {
    margin-bottom: 8px;
    opacity: 0.3;
  }
`;

/**
 * Collapsed preview of steps
 */
const CollapsedStepList = styled.div`
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
`;

const StepPreview = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  padding: 6px 8px;
  background: rgba(139, 92, 246, 0.05);
  border-radius: var(--radius-sm);
  border-left: 2px solid rgba(139, 92, 246, 0.3);
`;

/**
 * Sequential execution indicator (Phase 3)
 */
const SequentialIndicator = styled.div<{ enabled: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: ${props => props.enabled 
    ? 'rgba(34, 197, 94, 0.1)' 
    : 'rgba(148, 163, 184, 0.1)'};
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  color: ${props => props.enabled 
    ? 'rgb(34, 197, 94)' 
    : 'rgb(148, 163, 184)'};
  
  svg {
    width: 14px;
    height: 14px;
  }
`;

/**
 * Drop zone overlay (Phase 3)
 */
const DropZoneOverlay = styled.div<{ show: boolean }>`
  position: absolute;
  inset: 0;
  display: ${props => props.show ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  background: rgba(139, 92, 246, 0.1);
  border: 3px dashed rgba(139, 92, 246, 0.5);
  border-radius: 12px;
  pointer-events: none;
  z-index: 10;
  animation: pulse 2s ease-in-out infinite;
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
`;

const DropZoneText = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: rgba(139, 92, 246, 0.9);
  text-align: center;
  padding: 20px;
  background: rgb(var(--color-surface));
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
`;


// ============================================================================
// Component
// ============================================================================

/**
 * Form Process Group Node
 * 
 * Labeled group container following React Flow's parent-child pattern.
 * Children are positioned with parentId and extent: 'parent'.
 * 
 * @param props - Node props from React Flow
 */
export const FormProcessGroupNode = React.memo<FormProcessGroupNodeProps>((props) => {
  const { id, data, selected } = props;
  const { setNodes, setEdges } = useReactFlow();
  const allNodes = useNodes();
  const allEdges = useEdges();
  
  // Local state for save operations
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Debug logging
  logger.debug('[FormProcessGroup] Rendered with ID:', id, 'Data:', data);
  
  // ============================================================================
  // Derived State
  // ============================================================================
  
  /**
   * Find all child nodes with parentId matching this group's ID
   */
  const childNodes = useMemo(() => {
    const children = allNodes.filter(node => node.parentId === id);
    logger.debug('[FormProcessGroup] Children found:', children.length, 'IDs:', children.map(c => c.id));
    return children;
  }, [allNodes, id]);
  
  const stepCount = childNodes.length;
  const containerName = data.containerName || 'Untitled Form Process';
  const containerDescription = data.containerDescription;
  const isExpanded = data.isExpanded ?? false;
  const isDropTarget = data.isDropTarget ?? false; // Phase 3: Drop zone indicator
  const sequentialExecution = data.sequentialExecution ?? true; // Phase 3: Sequential by default
  
  logger.debug(`[FormProcessGroup] ${id} rendered with ${stepCount} steps (expanded: ${isExpanded})`);

  
  // ============================================================================
  // Event Handlers
  // ============================================================================
  
  /**
   * Toggle expand/collapse state
   * When collapsed, children are hidden but not removed
   */
  const handleToggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === id) {
          const newExpanded = !isExpanded;
          const expandedHeight = Math.max(400, stepCount * 120 + 80);

          return {
            ...node,
            // IMPORTANT: React Flow can cache measured node width/height.
            // When collapsing, explicitly shrink the wrapper so the expanded outline/shadow
            // doesn't remain visible at the old dimensions.
            style: {
              ...(node.style || {}),
              width: newExpanded ? 600 : 280,
              height: newExpanded ? expandedHeight : undefined,
            },
            data: {
              ...node.data,
              isExpanded: newExpanded,
            },
          };
        }
        // Hide/show children
        if (node.parentId === id) {
          return {
            ...node,
            hidden: isExpanded, // Will hide when collapsing (isExpanded is currently true)
          };
        }
        return node;
      })
    );
  }, [id, isExpanded, setNodes]);
  
  /**
   * Save FormProcessGroup as TenantForm to backend
   * Persists form definition and increments version
   */
  const handleSave = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (isSaving) return;
    
    // Validate: Must have at least one child step
    if (childNodes.length === 0) {
      toast.error('Cannot save: Form must have at least one step');
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Find the current node object
      const currentNode = allNodes.find(n => n.id === id);
      if (!currentNode) {
        throw new Error('Node not found');
      }
      
      logger.debug('[FormProcessGroup] Saving to backend:', id);
      
      const result = await saveFormProcessGroup(currentNode, allNodes, allEdges);
      
      logger.debug('[FormProcessGroup] Saved successfully:', result);
      
      // Update node data with tenantFormId and version
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              data: {
                ...node.data,
                tenantFormId: result.tenantFormId,
                version: result.version,
              },
            };
          }
          return node;
        })
      );
      
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      
      toast.success(
        result.created 
          ? `Form saved successfully (v${result.version})` 
          : `Form updated to v${result.version}`,
        { duration: 3000 }
      );
      
    } catch (error: any) {
      logger.error('[FormProcessGroup] Save failed:', error);
      toast.error(`Save failed: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [id, isSaving, childNodes.length, allNodes, allEdges, setNodes]);
  
  /**
   * Auto-layout children when they change
   * Triggers vertical re-positioning when steps are added/removed/reordered
   */
  useEffect(() => {
    if (!isExpanded || childNodes.length === 0) return;
    
    // Apply auto-layout to children
    const layoutedChildren = autoLayoutChildren(childNodes);
    
    setNodes((nodes) =>
      nodes.map((node) => {
        const layouted = layoutedChildren.find((child) => child.id === node.id);
        if (layouted && node.parentId === id) {
          return {
            ...node,
            position: layouted.position,
          };
        }
        return node;
      })
    );
  }, [childNodes.length, id, isExpanded]); // Only trigger on count/visibility change
  
  /**
   * Auto-connect children in sequential order (Phase 3)
   * Creates edges between consecutive child nodes based on Y position
   * 
   * FIX: Prevents infinite loop by memoizing edge IDs and only updating when needed
   */
  useEffect(() => {
    if (!sequentialExecution || childNodes.length < 2) return;
    
    // Sort children by Y position (top to bottom execution order)
    const sortedChildren = [...childNodes].sort((a, b) => a.position.y - b.position.y);
    
    // Generate expected edge IDs for this configuration
    const expectedEdgeIds = new Set<string>();
    for (let i = 0; i < sortedChildren.length - 1; i++) {
      const edgeId = `${sortedChildren[i].id}-to-${sortedChildren[i + 1].id}`;
      expectedEdgeIds.add(edgeId);
    }
    
    // Check current edges to see if update is needed (prevents infinite loop)
    const childIds = new Set(sortedChildren.map(c => c.id));
    const currentAutoEdges = allEdges.filter(edge => 
      childIds.has(edge.source) && childIds.has(edge.target)
    );
    const currentEdgeIds = new Set(currentAutoEdges.map(e => e.id));
    
    // Only update if the edge configuration changed
    const needsUpdate = 
      expectedEdgeIds.size !== currentEdgeIds.size ||
      [...expectedEdgeIds].some(id => !currentEdgeIds.has(id));
    
    if (!needsUpdate) {
      logger.debug(`[FormProcessGroup] Auto-connect: edges already correct, skipping update`);
      return;
    }
    
    logger.debug(`[FormProcessGroup] Auto-connect: updating ${expectedEdgeIds.size} edges`);
    
    // Create edges between consecutive nodes
    const newEdges: Edge[] = [];
    for (let i = 0; i < sortedChildren.length - 1; i++) {
      const sourceNode = sortedChildren[i];
      const targetNode = sortedChildren[i + 1];
      const edgeId = `${sourceNode.id}-to-${targetNode.id}`;
      
      newEdges.push({
        id: edgeId,
        source: sourceNode.id,
        target: targetNode.id,
        type: 'smoothstep',
        animated: true,
        style: { 
          stroke: 'rgba(139, 92, 246, 0.6)',
          strokeWidth: 2,
        },
        label: `Step ${i + 1} → ${i + 2}`,
        labelStyle: {
          fill: 'rgb(139, 92, 246)',
          fontWeight: 600,
          fontSize: 11,
        },
        labelBgStyle: {
          fill: 'rgb(var(--color-surface))',
        },
      });
    }
    
    if (newEdges.length > 0) {
      setEdges((edges) => {
        // Remove old auto-generated edges between these children
        const filteredEdges = edges.filter(edge => {
          const isAutoEdge = childIds.has(edge.source) && childIds.has(edge.target);
          return !isAutoEdge;
        });
        return [...filteredEdges, ...newEdges];
      });
    }
  }, [
    // CRITICAL: Only depend on node count and positions, NOT allEdges
    // Depending on allEdges causes infinite loop: update edges → allEdges changes → useEffect runs → update edges...
    childNodes.length,
    sequentialExecution,
    // Memoize child positions to detect actual changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(childNodes.map(c => ({ id: c.id, y: c.position.y }))),
    setEdges
  ]);
  
  /**
   * Add new step to this group
   * Creates a formStepSingle node as child
   */
  const handleAddStep = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Create new step node at calculated position
    const newStepId = `step-${Date.now()}`;
    const newStep: Node = {
      id: newStepId,
      type: 'formStepSingle',
      position: { 
        x: 20, 
        y: calculateChildYPosition(stepCount) // Use auto-layout calculation
      },
      data: {
        label: `Step ${stepCount + 1}`,
        formFields: [],
      },
      parentId: id,
      extent: 'parent' as const, // Constrain to parent bounds
      draggable: true,
    };
    
    setNodes((nodes) => [...nodes, newStep]);
  }, [id, stepCount, setNodes]);
  
  /**
   * Open configuration panel
   * Should trigger NodeConfigPanelWithShadow with formProcess schema
   */
  const handleConfigure = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Call the onEdit handler passed from UnifiedFlowEditor
    if (typeof data.onEdit === 'function') {
      data.onEdit();
    }
  }, [data]);
  
  // ============================================================================
  // Render
  // ============================================================================
  
  return (
    <GroupContainer 
      isExpanded={isExpanded} 
      stepCount={stepCount}
      isDropTarget={isDropTarget}
      data-node-id={id}
      data-node-type="formProcessGroup"
    >
      {/* Phase 3: Drop zone overlay */}
      <DropZoneOverlay show={isDropTarget && isExpanded}>
        <DropZoneText>
          📦 Drop any node here<br/>
          <small style={{ fontSize: '12px', opacity: 0.7 }}>
            Forms, Actions, Logic, Wait states...
          </small>
        </DropZoneText>
      </DropZoneOverlay>
      
      <GroupHeader isExpanded={isExpanded} onClick={handleToggleExpand}>
        <ExpandIcon isExpanded={isExpanded}>
          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </ExpandIcon>
        
        <GroupTitle>
          <GroupName>{containerName}</GroupName>
          <GroupMeta>
            <StepCount hasSteps={stepCount > 0}>
              {stepCount} {stepCount === 1 ? 'step' : 'steps'}
            </StepCount>
            {containerDescription && (
              <span>• {containerDescription.slice(0, 40)}{containerDescription.length > 40 ? '...' : ''}</span>
            )}
            {/* Phase 3: Sequential execution indicator */}
            <SequentialIndicator enabled={sequentialExecution}>
              ▶ Sequential
            </SequentialIndicator>
          </GroupMeta>
        </GroupTitle>
        
        <HeaderActions onClick={(e) => e.stopPropagation()}>
          <IconButton 
            onClick={handleSave} 
            title={data.tenantFormId ? `Save (v${data.version || 1})` : 'Save to database'}
            variant="primary"
            isSaving={isSaving}
            disabled={isSaving || childNodes.length === 0}
          >
            {isSaving ? (
              <>
                <div style={{ 
                  width: '14px', 
                  height: '14px', 
                  border: '2px solid rgba(139, 92, 246, 0.3)',
                  borderTopColor: 'rgba(139, 92, 246, 0.9)',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite'
                }} />
                <span>Saving...</span>
              </>
            ) : lastSaved ? (
              <>
                <Check size={14} />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>Save</span>
              </>
            )}
          </IconButton>
          <IconButton onClick={handleAddStep} title="Add step">
            <Plus size={16} />
          </IconButton>
          <IconButton onClick={handleConfigure} title="Configure">
            <Settings size={16} />
          </IconButton>
        </HeaderActions>
      </GroupHeader>
      
      {isExpanded ? (
        <GroupBody isExpanded={isExpanded}>
          {stepCount === 0 && (
            <EmptyState>
              <Plus size={48} />
              <div>Drop form steps here or click + to add</div>
            </EmptyState>
          )}
          {/* Children render here automatically via React Flow's parent-child system */}
        </GroupBody>
      ) : (
        <>
          {stepCount > 0 && (
            <CollapsedStepList>
              {childNodes
                .sort((a, b) => a.position.y - b.position.y) // Sort by Y position for flow order
                .slice(0, 5)
                .map((child, index) => (
                  <StepPreview key={child.id}>
                    <span style={{ 
                      display: 'inline-block',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'rgba(139, 92, 246, 0.2)',
                      color: 'rgb(139, 92, 246)',
                      fontSize: '11px',
                      fontWeight: 600,
                      lineHeight: '20px',
                      textAlign: 'center',
                      marginRight: '8px',
                    }}>
                      {index + 1}
                    </span>
                    {(child.data as any).label || 'Untitled'}
                  </StepPreview>
                ))}
              {stepCount > 5 && (
                <StepPreview>+ {stepCount - 5} more steps</StepPreview>
              )}
              {/* Version indicator */}
              {data.tenantFormId && data.version && (
                <div style={{
                  marginTop: '8px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  color: 'rgba(139, 92, 246, 0.7)',
                  textAlign: 'center',
                  borderTop: '1px solid rgba(139, 92, 246, 0.1)',
                }}>
                  Saved: v{data.version} • ID: {data.tenantFormId.slice(0, 8)}...
                  {lastSaved && (
                    <span style={{ marginLeft: '4px', opacity: 0.6 }}>
                      ({new Date(lastSaved).toLocaleTimeString()})
                    </span>
                  )}
                </div>
              )}
            </CollapsedStepList>
          )}
        </>
      )}
    </GroupContainer>
  );
});

// Export type for use in nodeTypes registry
export default FormProcessGroupNode;
