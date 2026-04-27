/**
 * Insert Variable Button Component
 * 
 * Phase C.3.1: Reusable button for inserting variables into text fields
 * Opens VariablePickerWithUpstream popover when clicked.
 * 
 * Features:
 * - Icon button with tooltip
 * - Auto-positioning of picker near button
 * - Integration with VariablePickerWithUpstream
 * - Callback for variable insertion
 * 
 * Usage:
 * ```typescript
 * <InsertVariableButton
 *   currentNodeId={node.id}
 *   nodes={nodes}
 *   edges={edges}
 *   onInsert={(template) => {
 *     setFieldValue(prev => prev + template);
 *   }}
 *   fieldTypeFilter={['string', 'email']} // Optional
 * />
 * ```
 * 
 * Created: 2026-02-17 - Phase C.3.1 Config Panel Integration
 */

import React, { useState, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { Node, Edge } from '@xyflow/react';
import { Code2, Info } from 'lucide-react';
import { VariablePickerWithUpstream } from './VariablePickerWithUpstream';
import { UpstreamVariable } from '../hooks/useUpstreamVariables';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface InsertVariableButtonProps {
  /** Current node ID */
  currentNodeId: string;
  
  /** All nodes in workflow */
  nodes: Node[];
  
  /** All edges in workflow */
  edges: Edge[];
  
  /** Called when user selects a variable */
  onInsert: (template: string, variable: UpstreamVariable) => void;
  
  /** Optional field type filter */
  fieldTypeFilter?: UpstreamVariable['fieldType'][];
  
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost';
  
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  
  /** Show text label */
  showLabel?: boolean;
  
  /** Custom button text */
  label?: string;
  
  /** Disabled state */
  disabled?: boolean;
  
  /** Tooltip text */
  tooltip?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const ButtonContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const Button = styled.button<{ 
  $variant: 'primary' | 'secondary' | 'ghost';
  $size: 'sm' | 'md' | 'lg';
  $hasLabel: boolean;
}>`
  display: inline-flex;
  align-items: center;
  gap: ${props => props.$hasLabel ? '6px' : '0'};
  padding: ${props => {
    if (props.$size === 'sm') return props.$hasLabel ? '4px 8px' : '4px';
    if (props.$size === 'lg') return props.$hasLabel ? '10px 16px' : '10px';
    return props.$hasLabel ? '6px 12px' : '6px';
  }};
  border-radius: var(--radius-md);
  font-size: ${props => {
    if (props.$size === 'sm') return '12px';
    if (props.$size === 'lg') return '15px';
    return '13px';
  }};
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid;
  
  ${props => {
    if (props.$variant === 'primary') {
      return `
        background: rgb(var(--color-primary));
        border-color: rgb(var(--color-primary));
        color: rgb(var(--color-text-inverse));
        
        &:hover:not(:disabled) {
          background: rgb(var(--color-primary-hover));
          border-color: rgb(var(--color-primary-hover));
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(var(--color-primary), 0.3);
        }
      `;
    }
    
    if (props.$variant === 'secondary') {
      return `
        background: rgb(var(--color-surface));
        border-color: rgb(var(--color-border));
        color: rgb(var(--color-text-primary));
        
        &:hover:not(:disabled) {
          background: rgb(var(--color-surface-hover));
          border-color: rgb(var(--color-primary));
        }
      `;
    }
    
    // ghost
    return `
      background: transparent;
      border-color: transparent;
      color: rgb(var(--color-text-secondary));
      
      &:hover:not(:disabled) {
        background: rgb(var(--color-surface-hover));
        color: rgb(var(--color-primary));
      }
    `;
  }}
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

const Tooltip = styled.div<{ $visible: boolean }>`
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 10px;
  background: rgb(var(--color-text-primary));
  color: rgb(var(--color-surface));
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  pointer-events: none;
  opacity: ${props => props.$visible ? 1 : 0};
  visibility: ${props => props.$visible ? 'visible' : 'hidden'};
  transition: opacity 0.2s, visibility 0.2s;
  z-index: 10002;
  
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: rgb(var(--color-text-primary));
  }
`;

// ============================================================================
// Main Component
// ============================================================================

export const InsertVariableButton: React.FC<InsertVariableButtonProps> = ({
  currentNodeId,
  nodes,
  edges,
  onInsert,
  fieldTypeFilter,
  variant = 'secondary',
  size = 'md',
  showLabel = false,
  label = 'Insert Variable',
  disabled = false,
  tooltip = 'Insert variable from previous step',
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Calculate picker position relative to button
  const getPickerPosition = useCallback(() => {
    if (!buttonRef.current) {
      return { top: 100, left: 200 };
    }
    
    const rect = buttonRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + 8, // 8px below button
      left: Math.max(rect.left, 20), // At least 20px from left edge
    };
  }, []);
  
  const handleClick = () => {
    if (!disabled) {
      setIsPickerOpen(true);
      setShowTooltip(false);
    }
  };
  
  const handleInsert = (template: string, variable: UpstreamVariable) => {
    onInsert(template, variable);
    setIsPickerOpen(false);
  };
  
  const handleClose = () => {
    setIsPickerOpen(false);
  };
  
  return (
    <ButtonContainer>
      <Button
        ref={buttonRef}
        type="button"
        $variant={variant}
        $size={size}
        $hasLabel={showLabel}
        disabled={disabled}
        onClick={handleClick}
        onMouseEnter={() => !isPickerOpen && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label={label}
      >
        <Code2 size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
        {showLabel && <span>{label}</span>}
      </Button>
      
      {tooltip && (
        <Tooltip $visible={showTooltip && !isPickerOpen}>
          {tooltip}
        </Tooltip>
      )}
      
      <VariablePickerWithUpstream
        currentNodeId={currentNodeId}
        nodes={nodes}
        edges={edges}
        isOpen={isPickerOpen}
        onSelect={handleInsert}
        onClose={handleClose}
        position={getPickerPosition()}
        fieldTypeFilter={fieldTypeFilter}
      />
    </ButtonContainer>
  );
};

export default InsertVariableButton;
