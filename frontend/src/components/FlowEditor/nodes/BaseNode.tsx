/**
 * Base Node Component
 * 
 * Foundation for all flow editor nodes.
 * Provides consistent styling, status indicators, and connection handles.
 * 
 * Created: 2026-02-04 - Phase 2.1 Visual Editor Foundation
 * Updated: 2026-02-09 - Added edit/delete controls and expand/collapse (Batch 3)
 */
import React, { useState } from 'react';
import styled from 'styled-components';
import { Handle, Position } from '@xyflow/react';
import { Edit2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { NodeTypeDefinition } from '../nodeTypes';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface BaseNodeData {
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
}

export interface BaseNodeProps {
  id: string;
  data: BaseNodeData;
  selected?: boolean;
  nodeType: NodeTypeDefinition;
}

// ============================================================================
// Styled Components
// ============================================================================

const NodeContainer = styled.div<{ 
  $color: string; 
  $selected: boolean; 
  $status: string;
  $isDirty?: boolean;
}>`
  min-width: 180px;
  background: rgb(var(--color-surface));
  border: 2px solid ${props => {
    if (props.$isDirty) return 'rgb(234, 179, 8)'; // Yellow for dirty (Phase 2)
    if (props.$selected) return props.$color;
    if (props.$status === 'error') return 'rgb(239, 68, 68)';
    return 'rgb(var(--color-border))';
  }};
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: ${props => props.$selected 
    ? '0 4px 12px rgba(0, 0, 0, 0.15)' 
    : '0 2px 6px rgba(0, 0, 0, 0.1)'};
  transition: all 0.2s ease;
  
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
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

const NodeHeader = styled.div<{ $color: string }>`
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

const NodeIcon = styled.span`
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

const StatusIndicator = styled.div<{ $status: string }>`
  position: absolute;
  top: -6px;
  right: -6px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgb(var(--color-surface));
  background: ${props => {
    switch (props.$status) {
      case 'active': return 'rgb(34, 197, 94)'; // green
      case 'error': return 'rgb(239, 68, 68)'; // red
      case 'disabled': return 'rgb(148, 163, 184)'; // gray
      default: return 'rgb(234, 179, 8)'; // yellow (draft)
    }
  }};
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
  width: 10px;
  height: 10px;
  background: ${props => props.$color};
  border: 2px solid rgb(var(--color-surface));
  
  &:hover {
    width: 14px;
    height: 14px;
  }
`;

// Batch 3: Node Controls
const NodeControls = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  opacity: 1; /* Always visible */
  transition: opacity 0.2s ease;
  z-index: 10; /* Ensure buttons appear above other elements */
`;

const ControlButton = styled.button<{ $variant?: 'edit' | 'delete' | 'expand' }>`
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.95);
  color: ${props => {
    if (props.$variant === 'delete') return 'rgb(239, 68, 68)';
    if (props.$variant === 'edit') return 'rgb(var(--color-primary))';
    return 'rgb(var(--color-text-secondary))';
  }};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  
  &:hover {
    transform: scale(1.1);
    background: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  svg {
    width: 14px;
    height: 14px;
  }
`;

const ExpandButton = styled(ControlButton)`
  position: absolute;
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0.8;
  
  &:hover {
    opacity: 1;
    transform: translateX(-50%) scale(1.05);
  }
`;

// ============================================================================
// Component
// ============================================================================

export const BaseNode: React.FC<BaseNodeProps & { children?: React.ReactNode }> = ({
  id,
  data,
  selected = false,
  nodeType,
  children,
}) => {
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
  } = data;
  
  // Phase 2: Determine if node has uncommitted changes
  const isDirty = configStatus === 'dirty';
  
  // Batch 3: Expand/collapse state
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Batch 4: Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(label);

  const showInputHandle = nodeType.maxInputs !== 0;
  const showOutputHandle = nodeType.maxOutputs !== 0;
  
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); // Also prevent default to be extra safe
    console.log('🔘 [BaseNode] Edit button clicked - calling onEdit');
    if (onEdit) onEdit();
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && window.confirm('Delete this node?')) {
      onDelete();
    }
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
    >
      {/* Input Handle */}
      {showInputHandle && (
        <StyledHandle
          type="target"
          position={Position.Top}
          id="input"
          $color={nodeType.color}
        />
      )}

      {/* Status Indicator - REMOVED (confusing yellow dot) */}
      
      {/* Node Controls (Batch 3) */}
      <NodeControls>
        {onEdit && (
          <ControlButton 
            $variant="edit" 
            onClick={handleEdit}
            title="Edit node configuration"
          >
            <Edit2 />
          </ControlButton>
        )}
        {onDelete && (
          <ControlButton 
            $variant="delete" 
            onClick={handleDelete}
            title="Delete node"
          >
            <Trash2 />
          </ControlButton>
        )}
      </NodeControls>

      {/* Header */}
      <NodeHeader $color={nodeType.color}>
        <NodeIcon>{nodeType.icon}</NodeIcon>
        {isEditingTitle ? (
          <NodeTitleInput
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
      
      {/* Expand/Collapse Button (Batch 3) */}
      {(children || config || errorMessage) && (
        <ExpandButton 
          onClick={toggleExpand}
          title={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? <ChevronUp /> : <ChevronDown />}
        </ExpandButton>
      )}

      {/* Output Handle */}
      {showOutputHandle && (
        <StyledHandle
          type="source"
          position={Position.Bottom}
          id="output"
          $color={nodeType.color}
        />
      )}
      
      {/* Error Route Handle (if applicable) */}
      {nodeType.hasErrorRoute && (
        <StyledHandle
          type="source"
          position={Position.Right}
          id="error"
          $color="rgb(239, 68, 68)"
          style={{ top: '50%' }}
        />
      )}
    </NodeContainer>
  );
};

export default BaseNode;
