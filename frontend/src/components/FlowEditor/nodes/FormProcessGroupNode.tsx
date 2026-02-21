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

import React, { useCallback, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { NodeProps, Node, useReactFlow, useNodes } from '@xyflow/react';
import { BaseNode, BaseNodeData } from './BaseNode';
import { ChevronDown, ChevronRight, Plus, Settings } from 'lucide-react';
import { autoLayoutChildren, calculateChildYPosition } from './FormProcessChildWrapper';

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
}

export interface FormProcessGroupNodeProps extends NodeProps<FormProcessGroupData> {}

// ============================================================================
// Styled Components
// ============================================================================

/**
 * Container wrapper with group styling
 * Adapts size based on expanded/collapsed state
 */
const GroupContainer = styled.div<{ isExpanded: boolean; stepCount: number }>`
  min-width: ${props => props.isExpanded ? '600px' : '280px'};
  min-height: ${props => props.isExpanded ? `${Math.max(400, props.stepCount * 120 + 80)}px` : 'auto'};
  max-width: ${props => props.isExpanded ? '1200px' : '320px'};
  
  background: ${props => props.isExpanded 
    ? 'rgba(139, 92, 246, 0.03)' // Light purple tint when expanded
    : 'rgb(var(--color-background-secondary))'};
  
  border: 2px ${props => props.isExpanded ? 'dashed' : 'solid'} rgba(139, 92, 246, 0.5);
  border-radius: 12px;
  overflow: ${props => props.isExpanded ? 'visible' : 'hidden'};
  position: relative;
  
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.1),
    0 0 0 4px rgba(139, 92, 246, 0.1);
  
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    box-shadow: 
      0 6px 16px rgba(0, 0, 0, 0.15),
      0 0 0 4px rgba(139, 92, 246, 0.2);
  }
  
  /* Group label indicator */
  ${props => props.isExpanded && `
    &::after {
      content: 'FORM PROCESS GROUP';
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

const IconButton = styled.button`
  padding: 6px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgba(139, 92, 246, 0.15);
    color: rgba(139, 92, 246, 0.9);
  }
  
  &:active {
    transform: scale(0.95);
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
export const FormProcessGroupNode: React.FC<FormProcessGroupNodeProps> = (props) => {
  const { id, data, selected } = props;
  const { setNodes } = useReactFlow();
  const allNodes = useNodes();
  
  // Debug logging
  console.log('[FormProcessGroup] Rendered with ID:', id, 'Data:', data);
  
  // ============================================================================
  // Derived State
  // ============================================================================
  
  /**
   * Find all child nodes with parentId matching this group's ID
   */
  const childNodes = useMemo(() => {
    const children = allNodes.filter(node => node.parentId === id);
    console.log('[FormProcessGroup] Children found:', children.length, 'IDs:', children.map(c => c.id));
    return children;
  }, [allNodes, id]);
  
  const stepCount = childNodes.length;
  const containerName = data.containerName || 'Untitled Form Process';
  const containerDescription = data.containerDescription;
  const isExpanded = data.isExpanded ?? false;
  
  console.log(`[FormProcessGroup] ${id} rendered with ${stepCount} steps (expanded: ${isExpanded})`);

  
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
          return {
            ...node,
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
    // Configuration handled by BaseNode/UnifiedFlowEditor selection system
    // Clicking this will select the node and open config panel
  }, []);
  
  // ============================================================================
  // Render
  // ============================================================================
  
  return (
    <GroupContainer 
      isExpanded={isExpanded} 
      stepCount={stepCount}
      data-node-id={id}
      data-node-type="formProcessGroup"
    >
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
          </GroupMeta>
        </GroupTitle>
        
        <HeaderActions onClick={(e) => e.stopPropagation()}>
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
              {childNodes.slice(0, 5).map((child, index) => (
                <StepPreview key={child.id}>
                  Step {index + 1}: {(child.data as any).label || 'Untitled'}
                </StepPreview>
              ))}
              {stepCount > 5 && (
                <StepPreview>+ {stepCount - 5} more steps</StepPreview>
              )}
            </CollapsedStepList>
          )}
        </>
      )}
    </GroupContainer>
  );
};

// Export type for use in nodeTypes registry
export default FormProcessGroupNode;
