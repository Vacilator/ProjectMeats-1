/**
 * Base Node Component
 * 
 * Foundation for all flow editor nodes.
 * Provides consistent styling, status indicators, and connection handles.
 * 
 * Created: 2026-02-04 - Phase 2.1 Visual Editor Foundation
 * Updated: 2026-02-09 - Added edit/delete controls and expand/collapse (Batch 3)
 * Updated: 2026-02-17 - Added badges, icons, pinning (Sprint 1 Task 1.2)
 * Updated: 2026-02-25 - Agent C Phase 2: Live validation badges (Task polish-live-validation-badges)
 */
import React, { useState } from 'react';
import styled from 'styled-components';
import { Handle, Position, NodeToolbar, useStore } from '@xyflow/react';
import { Edit2, Trash2, ChevronDown, ChevronUp, Lock, Unlock, ArrowUp, ArrowDown } from 'lucide-react';
import { NodeTypeDefinition } from '../nodeTypes';
import type { NodeBadgeStatus } from '../components/NodeBadge';
import { NodeIcon, NodeIconType } from '../components/NodeIcons';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface BaseNodeData extends Record<string, unknown> {
  label?: string;
  status?: 'draft' | 'active' | 'error' | 'disabled';
  stepNumber?: number;
  errorMessage?: string;
  config?: Record<string, any>;
  configStatus?: 'pristine' | 'editing' | 'dirty'; // Phase 2: Shadow state status
  shadowConfig?: Record<string, any>; // Phase 2: Uncommitted changes
  onEdit?: () => void; // Batch 3: Edit handler
  onDelete?: () => void; // Batch 3: Delete handler
  onTitleChange?: (newTitle: string) => void; // Batch 4: Title edit handler
  /** Open the node palette in "insert after this node" context */
  onInsertAfter?: () => void;
  /** Add a step/page inside the nearest Form container (Book) */
  onAddStepInsideForm?: () => void;
  /** Move this node up among siblings (same parentId) */
  onMoveUp?: () => void;
  /** Move this node down among siblings (same parentId) */
  onMoveDown?: () => void;
  /** Whether this node is considered a "sink" in its scope (root or container sub-flow) */
  isLastInWorkflow?: boolean;
  // Phase 9.4: Breakpoints
  hasBreakpoint?: boolean;
  // Sprint 1 Task 1.2: Enhanced visuals
  badge?: { status: NodeBadgeStatus; count?: number; message?: string };
  iconType?: NodeIconType;
  isPinned?: boolean;
  onPin?: () => void;
  errorCount?: number;
  warningCount?: number;
  successCount?: number;
  isProcessing?: boolean;
}

export interface BaseNodeProps {
  id: string;
  data: BaseNodeData;
  selected?: boolean;
  nodeType?: NodeTypeDefinition;
  /** Optional override for the header drag handle class */
  dragHandleClassName?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const NodeContainer = styled.div<{ 
  $color: string; 
  $selected: boolean; 
  $status: string;
  $isDirty?: boolean;
  $isPinned?: boolean;
  $isDragging?: boolean;
}>`
  position: relative;
  min-width: 180px;
  background: rgb(var(--color-surface, 255, 255, 255));
  border: 2px solid ${props => {
    if (props.$isDirty) return 'rgb(234, 179, 8)'; // Yellow for dirty (Phase 2)
    if (props.$selected) return props.$color;
    if (props.$status === 'error') return 'rgb(239, 68, 68)';
    if (props.$isPinned) return 'rgb(99, 102, 241)'; // Indigo for pinned
    return 'rgb(var(--color-border))';
  }};
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: ${props => props.$selected 
    ? '0 4px 12px rgba(0, 0, 0, 0.15)' 
    : '0 2px 6px rgba(0, 0, 0, 0.1)'};
  transition: all 0.2s ease;
  
  /* Drag preview - semi-transparent ghost */
  opacity: ${props => props.$isDragging ? 0.5 : 1};
  
  /* Add pulsing animation for dirty state (Phase 2) */
  ${props => props.$isDirty && `
    animation: dirtyPulse 2s ease-in-out infinite;
    
    @keyframes dirtyPulse {
      0%, 100% {
        box-shadow: 0 2px 6px rgba(234, 179, 8, 0.3);
      }
      50% {
        box-shadow: 0 4px 12px rgba(234, 179, 8, 0.5);
      }
    }
  `}
  
  /* Pinned state indicator */
  ${props => props.$isPinned && `
    &::before {
      content: '';
      position: absolute;
      top: -4px;
      left: -4px;
      right: -4px;
      bottom: -4px;
      border: 2px dashed rgb(99, 102, 241);
      border-radius: var(--radius-lg);
      pointer-events: none;
      opacity: 0.3;
    }
  `}
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

const NodeHeader = styled.div<{ $color: string }>`
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: ${props => props.$color};
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  color: white;
  font-weight: 600;
  font-size: 13px;
`;

const NodeIconWrapper = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 16px;
  line-height: 1;
`;

const NodeTitle = styled.span<{ $editable?: boolean }>`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: ${props => props.$editable ? 'text' : 'default'};
  
  &:hover {
    ${props => props.$editable && `
      text-decoration: underline;
      text-decoration-style: dashed;
    `}
  }
`;

const NodeTitleInput = styled.input`
  flex: 1;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  padding: 2px 6px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  outline: none;
  
  &:focus {
    background: rgba(255, 255, 255, 0.3);
    border-color: white;
  }
`;

const StepNumber = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
`;

const NodeBody = styled.div`
  padding: 12px;
`;

const NodeContent = styled.div`
  color: rgb(var(--color-text-primary));
  font-size: 12px;
`;

const ConfigPreview = styled.div`
  margin-top: 8px;
  padding: 8px;
  background: rgb(var(--color-background));
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
`;

const BreakpointDot = styled.div`
  position: absolute;
  top: -6px;
  left: -6px;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 2px solid rgb(var(--color-surface));
  background: rgb(var(--color-error));
  box-shadow: 0 2px 8px rgba(var(--color-error), 0.35);
  z-index: 12;
`;

const ErrorMessage = styled.div`
  margin-top: 8px;
  padding: 6px 8px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgb(239, 68, 68);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: rgb(239, 68, 68);
`;

const StyledHandle = styled(Handle)<{ $color: string }>`
  width: 14px;
  height: 14px;
  background: ${(props) => props.$color};
  border: 2px solid rgb(var(--color-surface));
  border-radius: 4px;
  cursor: crosshair;
  z-index: 20;

  /* Push handles outside node body to avoid overlapping internal controls */
  &.react-flow__handle-top,
  &[data-handlepos='top'] {
    top: -14px;
  }

  &.react-flow__handle-bottom,
  &[data-handlepos='bottom'] {
    bottom: -14px;
  }

  &:hover {
    transform: scale(1.1);
  }
`;

const ToolbarCard = styled.div`
  display: flex;
  gap: 4px;
  background: rgb(var(--color-surface));
  padding: 6px;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border));
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
`;

const ToolbarBtn = styled.button<{ $danger?: boolean }>`
  padding: 6px;
  border-radius: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: ${(props) => (props.$danger ? 'rgb(239, 68, 68)' : 'rgb(var(--color-text-secondary))')};
  transition: all 0.15s ease;

  &:hover {
    background: ${(props) =>
      props.$danger ? 'rgba(239, 68, 68, 0.1)' : 'rgba(var(--color-primary), 0.1)'};
    color: ${(props) => (props.$danger ? 'rgb(239, 68, 68)' : 'rgb(var(--color-primary))')};
  }
`;

// Button Handle overrides standard dot
const ButtonHandle = styled(Handle)`
  width: 24px;
  height: 24px;
  background: rgb(var(--color-surface));
  border: 2px solid rgb(var(--color-primary));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  transition: transform 0.15s ease, background 0.15s ease;

  &.react-flow__handle-bottom,
  &[data-handlepos='bottom'] {
    bottom: -14px;
  }

  &::after {
    content: '+';
    color: rgb(var(--color-primary));
    font-size: 16px;
    font-weight: bold;
    line-height: 1;
  }

  &:hover {
    transform: scale(1.1);
    background: rgb(var(--color-primary));

    &::after {
      color: white;
    }
  }
`;

const HeaderToggleButton = styled.button`
  width: 24px;
  height: 24px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  background: rgba(255, 255, 255, 0.16);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.95;
  transition: all 0.15s ease;

  &:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.22);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.98);
  }
`;

// ============================================================================
// Component
// ============================================================================

const FALLBACK_NODE_TYPE: NodeTypeDefinition = {
  id: 'unknown',
  name: 'Node',
  category: 'utility',
  icon: '⬛',
  color: 'rgb(var(--color-border))',
  description: 'Unknown node type',
  maxInputs: 1,
  maxOutputs: 1,
};

export const BaseNode: React.FC<BaseNodeProps & { children?: React.ReactNode }> = ({
  id,
  data,
  selected = false,
  nodeType: nodeTypeProp,
  dragHandleClassName,
  children,
}) => {
  const nodeType = nodeTypeProp ?? FALLBACK_NODE_TYPE;
  const {
    label = nodeType.name,
    status = 'draft',
    stepNumber,
    errorMessage,
    config,
    configStatus, // Phase 2: Shadow state status
    shadowConfig, // Phase 2: Uncommitted changes
    onEdit,
    onDelete,
    onTitleChange,
    hasBreakpoint = false,
    // Sprint 1 Task 1.2: Enhanced visuals
    iconType,
    isPinned = false,
    onPin,
  } = data;
  
  // Phase 2: Determine if node has uncommitted changes
  const isDirty = configStatus === 'dirty';
  
  // Batch 3: Expand/collapse state
  const [isExpanded, setIsExpanded] = useState(true);

  const connectionInProcess = useStore((s: any) => Boolean(s.connectionInProcess));

  // Batch 4: Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(label);
  
  // Sprint 1: Drag state
  const [isDragging, setIsDragging] = useState(false);
  
  const headerDragHandleClass = dragHandleClassName ?? 'custom-drag-handle';

  const showInputHandle = nodeType.maxInputs !== 0;
  const showOutputHandle = nodeType.maxOutputs !== 0;

  const showButtonHandle = selected || connectionInProcess || Boolean((data as any)?.isLastInWorkflow);
  const showToolbar = selected;

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPin) onPin();
  };
  
  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };
  
  // Batch 4: Title editing handlers
  const handleTitleDoubleClick = (e: React.MouseEvent) => {
    if (!onTitleChange) return;
    e.stopPropagation();
    setIsEditingTitle(true);
    setEditedTitle(label);
  };
  
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedTitle(e.target.value);
  };
  
  const handleTitleBlur = () => {
    if (onTitleChange && editedTitle !== label) {
      onTitleChange(editedTitle);
    }
    setIsEditingTitle(false);
  };
  
  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleBlur();
    } else if (e.key === 'Escape') {
      setEditedTitle(label);
      setIsEditingTitle(false);
    }
  };
  

  return (
    <NodeContainer 
      $color={nodeType.color} 
      $selected={selected}
      $status={status}
      $isDirty={isDirty}
      $isPinned={isPinned}
      $isDragging={isDragging}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => setIsDragging(false)}

      role="article"
      aria-label={`${nodeType.name} node: ${data.label || 'Untitled'}`}
      aria-selected={selected}
      tabIndex={0}
    >
      {/* Phase 9.4: Breakpoint indicator */}
      {hasBreakpoint && <BreakpointDot title="Breakpoint" />}

      {/* Input Handle */}
      {showInputHandle && (
        <StyledHandle
          type="target"
          position={Position.Top}
          id="input"
          $color={nodeType.color}
          aria-label="Input connection handle"
          style={{
            left: '50%',
          }}
        />
      )}
      

      {/* Status Indicator - REMOVED (confusing yellow dot) */}
      
      <NodeToolbar isVisible={selected} position={Position.Top}>
        <ToolbarCard
          className="nodrag"
          style={{
            opacity: showToolbar ? 1 : 0,
            transform: `translateY(${showToolbar ? 0 : -4}px) scale(${showToolbar ? 1 : 0.98})`,
            pointerEvents: showToolbar ? 'auto' : 'none',
            transition: 'opacity 0.15s ease, transform 0.15s ease',
          }}
        >
          {(data.onMoveUp || data.onMoveDown) && (
            <>
              <ToolbarBtn
                onClick={(e) => {
                  e.stopPropagation();
                  data.onMoveUp?.();
                }}
                title="Move up"
              >
                <ArrowUp size={16} />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={(e) => {
                  e.stopPropagation();
                  data.onMoveDown?.();
                }}
                title="Move down"
              >
                <ArrowDown size={16} />
              </ToolbarBtn>
            </>
          )}
          {data.onEdit && (
            <ToolbarBtn
              onClick={(e) => {
                e.stopPropagation();
                data.onEdit!();
              }}
              title="Edit Node"
            >
              <Edit2 size={16} />
            </ToolbarBtn>
          )}
          {data.onDelete && (
            <ToolbarBtn
              $danger
              onClick={(e) => {
                e.stopPropagation();
                data.onDelete!();
              }}
              title="Delete Node"
            >
              <Trash2 size={16} />
            </ToolbarBtn>
          )}
          {onPin && (
            <ToolbarBtn
              onClick={(e) => {
                e.stopPropagation();
                handlePin(e);
              }}
              title={isPinned ? 'Unlock node (allow drag)' : 'Lock node position (Cmd/Ctrl+L)'}
            >
              {isPinned ? <Lock size={16} /> : <Unlock size={16} />}
            </ToolbarBtn>
          )}
        </ToolbarCard>
      </NodeToolbar>

      {/* Header */}
      <NodeHeader className={headerDragHandleClass} $color={nodeType.color}>
        <NodeIconWrapper>
          {iconType ? (
            <NodeIcon type={iconType} size={16} color="white" />
          ) : (
            nodeType.icon
          )}
        </NodeIconWrapper>
        {isEditingTitle ? (
          <NodeTitleInput
            className="nodrag"
            value={editedTitle}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <NodeTitle 
            $editable={!!onTitleChange}
            onDoubleClick={handleTitleDoubleClick}
            title={onTitleChange ? "Double-click to edit" : undefined}
          >
            {label}
            {isDirty && <span style={{ marginLeft: '4px', fontSize: '16px' }} title="Unsaved changes">*</span>}
          </NodeTitle>
        )}
        {stepNumber && <StepNumber>{stepNumber}</StepNumber>}
        {(children || config || errorMessage) && (
          <HeaderToggleButton
            className="nodrag"
            onClick={toggleExpand}
            title={isExpanded ? 'Collapse' : 'Expand'}
            aria-label={isExpanded ? 'Collapse node content' : 'Expand node content'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </HeaderToggleButton>
        )}
      </NodeHeader>

      {/* Body (collapsible) */}
      {isExpanded && (
        <NodeBody>
          <NodeContent>
            {children || (
              <>
                <div>{nodeType.description}</div>
                
                {config && Object.keys(config).length > 0 && (
                  <ConfigPreview>
                    {Object.entries(config).slice(0, 2).map(([key, value]) => (
                      <div key={key}>
                        <strong>{key}:</strong> {String(value).substring(0, 30)}
                        {String(value).length > 30 ? '...' : ''}
                      </div>
                    ))}
                  </ConfigPreview>
                )}
                
                {errorMessage && (
                  <ErrorMessage>{errorMessage}</ErrorMessage>
                )}
              </>
            )}
          </NodeContent>
        </NodeBody>
      )}
      
      {/* Output Handle */}
      {showOutputHandle && (
        <ButtonHandle
          type="source"
          position={Position.Bottom}
          id="output"
          isConnectable={true}
          aria-label="Output connection handle"
          style={{
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: showButtonHandle ? 1 : 0,
            pointerEvents: showButtonHandle ? 'all' : 'none',
          }}
        />
      )}
      
      {/* Error Route Handle (if applicable) */}
      {nodeType.hasErrorRoute && (
        <StyledHandle
          type="source"
          position={Position.Bottom}
          id="error"
          $color="rgb(239, 68, 68)"
          style={{
            left: '82%',
            transform: 'translateX(-50%)',
            width: '16px',
            height: '16px',
            cursor: 'crosshair',
          }}
          aria-label="Error route connection handle"
        />
      )}
    </NodeContainer>
  );
};

export default BaseNode;
