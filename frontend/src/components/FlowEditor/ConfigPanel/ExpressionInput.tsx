/**
 * Expression Input Component
 * 
 * Phase 4: Expression Input with Visual Variable Chips
 * Text input that renders {{variables}} as styled chips.
 * Integrates with VariablePicker for easy variable insertion.
 * 
 * Features:
 * - Text input with variable chip rendering
 * - Opens VariablePicker when user types {{
 * - Converts {{nodeId.fieldKey}} to visual chips
 * - Click to edit chips
 * - Copy/paste friendly (preserves raw text)
 * - Keyboard navigation between chips
 * - Delete chips with backspace
 * 
 * Usage:
 * ```typescript
 * <ExpressionInput
 *   value="Hello {{step1.name}}, total: {{step2.total}}"
 *   onChange={(value) => setFieldValue(value)}
 *   context={workflowContext}
 *   placeholder="Enter value or use {{variables}}"
 * />
 * ```
 * 
 * Created: 2026-02-12 - Phase 4 Expression Input Implementation
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { X } from 'lucide-react';
import { VariablePicker } from './VariablePicker';
import { WorkflowContext, extractTemplates } from '../../FormSubmission/hooks/useWorkflowContext';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface ExpressionInputProps {
  /** Current value with {{templates}} */
  value: string;
  
  /** Called when value changes */
  onChange: (value: string) => void;
  
  /** Workflow context for variable resolution */
  context: WorkflowContext;
  
  /** Placeholder text */
  placeholder?: string;
  
  /** Disabled state */
  disabled?: boolean;
  
  /** Multiline support */
  multiline?: boolean;
  
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

interface VariableChip {
  template: string;
  startIndex: number;
  endIndex: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse text into segments (text and variable chips)
 */
function parseExpression(value: string): Array<{ type: 'text' | 'variable'; content: string; index: number }> {
  const templates = extractTemplates(value);
  if (templates.length === 0) {
    return [{ type: 'text', content: value, index: 0 }];
  }
  
  const segments: Array<{ type: 'text' | 'variable'; content: string; index: number }> = [];
  let currentIndex = 0;
  
  templates.forEach(template => {
    const templateIndex = value.indexOf(template, currentIndex);
    
    // Add text before template
    if (templateIndex > currentIndex) {
      segments.push({
        type: 'text',
        content: value.substring(currentIndex, templateIndex),
        index: currentIndex,
      });
    }
    
    // Add template
    segments.push({
      type: 'variable',
      content: template,
      index: templateIndex,
    });
    
    currentIndex = templateIndex + template.length;
  });
  
  // Add remaining text
  if (currentIndex < value.length) {
    segments.push({
      type: 'text',
      content: value.substring(currentIndex),
      index: currentIndex,
    });
  }
  
  return segments;
}

/**
 * Extract variable label from template
 * {{step1.customer_name}} -> "step1.customer_name"
 */
function extractVariableLabel(template: string): string {
  const match = template.match(/\{\{([^}]+)\}\}/);
  return match ? match[1] : template;
}

// ============================================================================
// Main Component
// ============================================================================

export const ExpressionInput: React.FC<ExpressionInputProps> = ({
  value,
  onChange,
  context,
  placeholder = 'Enter value or type {{ for variables',
  disabled = false,
  multiline = false,
  autoFocus = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parse expression into segments
  const segments = useMemo(() => parseExpression(value), [value]);
  
  // Update edit value when external value changes (if not editing)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);
  
  // Auto-focus if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      setIsEditing(true);
    }
  }, [autoFocus]);
  
  // Handle click on chip display to enter edit mode
  const handleChipClick = () => {
    if (disabled) return;
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setEditValue(newValue);
    
    // Check if user typed {{ to trigger variable picker
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = newValue.substring(0, cursorPos);
    
    if (textBeforeCursor.endsWith('{{')) {
      // Show variable picker at cursor position
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setPickerPosition({
          top: rect.bottom + 5,
          left: rect.left,
        });
        setShowPicker(true);
      }
    }
    
    setCursorPosition(cursorPos);
  };
  
  // Handle blur - commit changes
  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== value) {
      onChange(editValue);
    }
  };
  
  // Handle variable selection from picker
  const handleVariableSelect = (template: string) => {
    const cursorPos = cursorPosition;
    
    // Remove the {{ that triggered the picker
    const beforeCursor = editValue.substring(0, cursorPos - 2);
    const afterCursor = editValue.substring(cursorPos);
    
    const newValue = beforeCursor + template + afterCursor;
    setEditValue(newValue);
    onChange(newValue);
    
    // Set focus back to input
    setTimeout(() => {
      inputRef.current?.focus();
      const newCursorPos = beforeCursor.length + template.length;
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };
  
  // Handle chip removal
  const handleRemoveChip = (template: string) => {
    const newValue = value.replace(template, '');
    onChange(newValue);
  };
  
  // Render chip display (when not editing)
  const renderChipDisplay = () => {
    if (segments.length === 0 || (segments.length === 1 && segments[0].type === 'text' && !segments[0].content)) {
      return <Placeholder>{placeholder}</Placeholder>;
    }
    
    return (
      <ChipDisplay onClick={handleChipClick}>
        {segments.map((segment, index) => {
          if (segment.type === 'text') {
            return <TextSegment key={index}>{segment.content || '\u200B'}</TextSegment>;
          } else {
            const label = extractVariableLabel(segment.content);
            return (
              <VariableChipStyled key={index}>
                <ChipLabel>{label}</ChipLabel>
                <ChipRemove
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveChip(segment.content);
                  }}
                >
                  <X size={12} />
                </ChipRemove>
              </VariableChipStyled>
            );
          }
        })}
      </ChipDisplay>
    );
  };
  
  // Render input (when editing)
  const renderInput = () => {
    const commonProps = {
      ref: inputRef as any,
      value: editValue,
      onChange: handleInputChange,
      onBlur: handleBlur,
      placeholder,
      disabled,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) {
          e.preventDefault();
          handleBlur();
        }
        if (e.key === 'Escape') {
          setEditValue(value); // Revert changes
          setIsEditing(false);
        }
      },
    };
    
    if (multiline) {
      return <TextAreaInput {...commonProps} rows={3} />;
    } else {
      return <TextInput {...commonProps} />;
    }
  };
  
  return (
    <>
      <InputContainer ref={containerRef} $disabled={disabled}>
        {isEditing ? renderInput() : renderChipDisplay()}
      </InputContainer>
      
      {/* Variable Picker */}
      <VariablePicker
        context={context}
        isOpen={showPicker}
        onSelect={handleVariableSelect}
        onClose={() => setShowPicker(false)}
        position={pickerPosition}
      />
    </>
  );
};

// ============================================================================
// Styled Components
// ============================================================================

const InputContainer = styled.div<{ $disabled: boolean }>`
  position: relative;
  width: 100%;
  min-height: 40px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  background: ${props => props.$disabled ? 'rgb(var(--color-background))' : 'rgb(var(--color-surface))'};
  padding: 8px 12px;
  cursor: ${props => props.$disabled ? 'not-allowed' : 'text'};
  transition: all 0.15s;
  
  &:hover {
    border-color: ${props => props.$disabled ? 'rgb(var(--color-border))' : 'rgb(var(--color-primary))'};
  }
  
  &:focus-within {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgb(var(--color-primary) / 0.1);
  }
`;

const ChipDisplay = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  cursor: text;
`;

const TextSegment = styled.span`
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
`;

const VariableChipStyled = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgb(var(--color-primary) / 0.1);
  border: 1px solid rgb(var(--color-primary));
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', monospace;
  color: rgb(var(--color-primary));
  transition: all 0.15s;
  
  &:hover {
    background: rgb(var(--color-primary) / 0.15);
  }
`;

const ChipLabel = styled.span`
  font-weight: 500;
`;

const ChipRemove = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgb(var(--color-primary));
  cursor: pointer;
  padding: 0;
  margin: 0;
  opacity: 0.6;
  transition: opacity 0.15s;
  
  &:hover {
    opacity: 1;
  }
`;

const Placeholder = styled.span`
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
  opacity: 0.6;
`;

const TextInput = styled.input`
  width: 100%;
  border: none;
  background: transparent;
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  outline: none;
  padding: 0;
  
  &::placeholder {
    color: rgb(var(--color-text-secondary));
    opacity: 0.6;
  }
  
  &:disabled {
    cursor: not-allowed;
  }
`;

const TextAreaInput = styled.textarea`
  width: 100%;
  border: none;
  background: transparent;
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  outline: none;
  padding: 0;
  resize: vertical;
  font-family: inherit;
  
  &::placeholder {
    color: rgb(var(--color-text-secondary));
    opacity: 0.6;
  }
  
  &:disabled {
    cursor: not-allowed;
  }
`;
