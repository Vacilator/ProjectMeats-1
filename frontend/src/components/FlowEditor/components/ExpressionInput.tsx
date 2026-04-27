/**
 * Expression Input Component
 * 
 * Input field for expressions with visual variable chips.
 * Features: Clickable chips, delete-as-unit, syntax highlighting.
 * 
 * Created: 2026-02-21
 * Phase: 5 - Smart Features
 */

import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { X, Code } from 'lucide-react';
import { Variable } from './VariablePicker';

/**
 * Props for ExpressionInput
 */
interface ExpressionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variables?: Variable[];
  onVariableClick?: (variable: Variable) => void;
  showSyntaxHelper?: boolean;
  disabled?: boolean;
}

/**
 * Chip representation of a variable in expression
 */
interface Chip {
  id: string;
  variable: Variable;
  startIndex: number;
  endIndex: number;
}

/**
 * Styled Components
 */
const Container = styled.div`
  position: relative;
`;

const InputWrapper = styled.div<{ focused: boolean; disabled?: boolean }>`
  min-height: 42px;
  padding: 8px 12px;
  border: 1px solid ${props => props.focused 
    ? 'rgb(var(--color-primary))' 
    : 'rgb(var(--color-border))'};
  border-radius: 8px;
  background: ${props => props.disabled 
    ? 'rgb(var(--color-surface-hover))' 
    : 'rgb(var(--color-surface))'};
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'text'};
  transition: border-color 0.2s;
  
  &:hover {
    border-color: ${props => props.disabled 
      ? 'rgb(var(--color-border))' 
      : 'rgb(var(--color-primary))'};
  }
`;

const ChipElement = styled.div<{ selected?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: ${props => props.selected 
    ? 'rgb(var(--color-primary))' 
    : 'rgba(var(--color-primary), 0.15)'};
  color: ${props => props.selected 
    ? 'rgb(var(--color-text-inverse))' 
    : 'rgb(var(--color-primary))'};
  border-radius: 4px;
  font-size: 13px;
  font-family: 'Courier New', monospace;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
  
  &:hover {
    background: rgb(var(--color-primary));
    color: rgb(var(--color-text-inverse));
  }
`;

const ChipRemoveButton = styled.button`
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  color: inherit;
  opacity: 0.7;
  
  &:hover {
    opacity: 1;
  }
`;

const HiddenInput = styled.input`
  flex: 1;
  min-width: 100px;
  border: none;
  background: transparent;
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  font-family: 'Courier New', monospace;
  outline: none;
  
  &::placeholder {
    color: rgb(var(--color-text-tertiary));
    font-family: inherit;
  }
  
  &:disabled {
    cursor: not-allowed;
  }
`;

const SyntaxHelper = styled.div`
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(var(--color-primary), 0.05);
  border-radius: 6px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  display: flex;
  align-items: flex-start;
  gap: 8px;
  
  svg {
    flex-shrink: 0;
    margin-top: 2px;
  }
`;

const SyntaxExamples = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const SyntaxExample = styled.code`
  color: rgb(var(--color-primary));
  background: rgb(var(--color-surface));
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
`;

/**
 * Parse expression to find variable references
 * Looks for {{variable.path}} patterns
 */
const parseExpression = (expression: string, variables: Variable[]): Chip[] => {
  const chips: Chip[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let match;
  
  while ((match = regex.exec(expression)) !== null) {
    const path = match[1];
    const variable = variables.find(v => v.path === path);
    
    if (variable) {
      chips.push({
        id: `${variable.id}-${match.index}`,
        variable,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
  }
  
  return chips;
};

/**
 * ExpressionInput Component
 */
export const ExpressionInput: React.FC<ExpressionInputProps> = ({
  value,
  onChange,
  placeholder = 'Enter expression...',
  variables = [],
  onVariableClick,
  showSyntaxHelper = false,
  disabled = false
}) => {
  const [focused, setFocused] = useState(false);
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Parse chips from value
  const chips = parseExpression(value, variables);
  
  // Get display parts (text + chips)
  const getDisplayParts = () => {
    const parts: Array<{ type: 'text' | 'chip'; content: string | Chip }> = [];
    let lastIndex = 0;
    
    chips.forEach(chip => {
      // Add text before chip
      if (chip.startIndex > lastIndex) {
        parts.push({
          type: 'text',
          content: value.substring(lastIndex, chip.startIndex)
        });
      }
      
      // Add chip
      parts.push({
        type: 'chip',
        content: chip
      });
      
      lastIndex = chip.endIndex;
    });
    
    // Add remaining text
    if (lastIndex < value.length) {
      parts.push({
        type: 'text',
        content: value.substring(lastIndex)
      });
    }
    
    return parts;
  };
  
  // Handle chip click
  const handleChipClick = (chip: Chip) => {
    setSelectedChipId(chip.id);
    if (onVariableClick) {
      onVariableClick(chip.variable);
    }
  };
  
  // Handle chip remove
  const handleChipRemove = (chip: Chip, e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = value.substring(0, chip.startIndex) + value.substring(chip.endIndex);
    onChange(newValue);
    setSelectedChipId(null);
  };
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };
  
  // Focus input when container clicked
  const handleContainerClick = () => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  };
  
  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Delete selected chip with backspace
    if (e.key === 'Backspace' && selectedChipId && value.length === 0) {
      const chip = chips.find(c => c.id === selectedChipId);
      if (chip) {
        const newValue = value.substring(0, chip.startIndex) + value.substring(chip.endIndex);
        onChange(newValue);
        setSelectedChipId(null);
      }
    }
  };
  
  const displayParts = getDisplayParts();
  
  return (
    <Container>
      <InputWrapper
        focused={focused}
        disabled={disabled}
        onClick={handleContainerClick}
      >
        {displayParts.map((part, index) => {
          if (part.type === 'chip' && typeof part.content !== 'string') {
            const chip = part.content as Chip;
            return (
              <ChipElement
                key={chip.id}
                selected={selectedChipId === chip.id}
                onClick={() => handleChipClick(chip)}
              >
                {chip.variable.displayName}
                <ChipRemoveButton
                  onClick={(e) => handleChipRemove(chip, e)}
                  title="Remove variable"
                >
                  <X size={12} />
                </ChipRemoveButton>
              </ChipElement>
            );
          }
          
          // For text parts, show in hidden input
          return null;
        })}
        
        <HiddenInput
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={chips.length === 0 ? placeholder : ''}
          disabled={disabled}
        />
      </InputWrapper>
      
      {showSyntaxHelper && (
        <SyntaxHelper>
          <Code size={14} />
          <SyntaxExamples>
            <div>Use variables: <SyntaxExample>{`{{step1.fieldName}}`}</SyntaxExample></div>
            <div>Operators: <SyntaxExample>+</SyntaxExample> <SyntaxExample>-</SyntaxExample> <SyntaxExample>*</SyntaxExample> <SyntaxExample>/</SyntaxExample></div>
            <div>Functions: <SyntaxExample>UPPER()</SyntaxExample> <SyntaxExample>LOWER()</SyntaxExample> <SyntaxExample>TRIM()</SyntaxExample></div>
          </SyntaxExamples>
        </SyntaxHelper>
      )}
    </Container>
  );
};
