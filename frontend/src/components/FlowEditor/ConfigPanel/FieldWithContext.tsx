/**
 * FieldWithContext Component
 * 
 * Phase 5: Context Inheritance
 * Input field wrapper that adds context data insertion capability.
 * 
 * Features:
 * - Shows "📊" icon to open Context Bubble
 * - Allows inserting {{nodeId.fieldKey}} templates
 * - Visual indicator when field contains template
 * - Resolves and shows preview of resolved value
 * 
 * Usage:
 * ```typescript
 * <FieldWithContext
 *   label="Customer Name"
 *   value={value}
 *   onChange={setValue}
 *   context={workflowContext}
 *   placeholder="Enter name or use data from previous steps"
 * />
 * ```
 * 
 * Created: 2026-02-12 - Phase 5 Context Inheritance Implementation
 */

import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { Database, Eye } from 'lucide-react';
import { WorkflowContext, isTemplate, extractTemplates } from '../../FormSubmission/hooks/useWorkflowContext';
import { ContextBubble } from '../../FormSubmission/ContextBubble';
import {
  Label,
  Input,
  TextArea,
  RequiredIndicator,
} from './shared/StyledComponents';
import { logger } from '@/utils/logger';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface FieldWithContextProps {
  /** Field label */
  label: string;
  
  /** Current value */
  value: string;
  
  /** Change handler */
  onChange: (value: string) => void;
  
  /** Workflow context */
  context?: WorkflowContext;
  
  /** Placeholder text */
  placeholder?: string;
  
  /** Field type */
  type?: 'text' | 'textarea' | 'number' | 'email';
  
  /** Disabled state */
  disabled?: boolean;
  
  /** Required field */
  required?: boolean;
  
  /** Show preview of resolved value */
  showPreview?: boolean;
}

// ============================================================================
// Styled Components
// ============================================================================

const FieldContainer = styled.div`
  margin-bottom: 16px;
`;





const InputWrapper = styled.div<{ $hasTemplate: boolean }>`
  position: relative;
  display: flex;
  align-items: stretch;
  border: 1px solid ${props => 
    props.$hasTemplate 
      ? 'rgb(var(--color-primary))' 
      : 'rgb(var(--color-border))'
  };
  border-radius: var(--radius-md);
  background: rgb(var(--color-surface));
  transition: all 0.2s;
  
  &:focus-within {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;





const ContextButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  background: ${props => props.$active 
    ? 'rgb(var(--color-primary))' 
    : 'transparent'
  };
  border: none;
  border-left: 1px solid rgb(var(--color-border));
  cursor: pointer;
  transition: all 0.2s;
  
  svg {
    width: 16px;
    height: 16px;
    color: ${props => props.$active 
      ? 'white' 
      : 'rgb(var(--color-text-tertiary))'
    };
  }
  
  &:hover {
    background: ${props => props.$active 
      ? 'rgb(var(--color-primary-dark))' 
      : 'rgb(var(--color-surface-hover))'
    };
  }
  
  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const ContextDropdown = styled.div<{ $show: boolean }>`
  display: ${props => props.$show ? 'block' : 'none'};
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  width: 320px;
  max-height: 400px;
  z-index: 1000;
`;

const PreviewContainer = styled.div`
  margin-top: 6px;
  padding: 8px 12px;
  background: rgb(var(--color-surface-hover));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PreviewLabel = styled.span`
  color: rgb(var(--color-text-secondary));
  font-weight: 600;
`;

const PreviewValue = styled.span`
  color: rgb(var(--color-text-primary));
  flex: 1;
  word-break: break-word;
`;

const TemplateTag = styled.span`
  display: inline-block;
  padding: 2px 6px;
  background: rgb(var(--color-primary) / 0.1);
  color: rgb(var(--color-primary));
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  margin-left: 8px;
`;

// ============================================================================
// Component
// ============================================================================

export const FieldWithContext: React.FC<FieldWithContextProps> = ({
  label,
  value,
  onChange,
  context,
  placeholder,
  type = 'text',
  disabled = false,
  required = false,
  showPreview = true,
}) => {
  const [showContextBubble, setShowContextBubble] = useState(false);
  const [resolvedValue, setResolvedValue] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasTemplate = isTemplate(value);
  const templates = hasTemplate ? extractTemplates(value) : [];

  // Resolve value when it changes
  useEffect(() => {
    if (hasTemplate && context) {
      try {
        const resolved = context.resolve(value);
        setResolvedValue(resolved);
      } catch (error) {
        logger.error('[FieldWithContext] Error resolving template:', error);
        setResolvedValue(null);
      }
    } else {
      setResolvedValue(null);
    }
  }, [value, hasTemplate, context]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showContextBubble) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowContextBubble(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showContextBubble]);

  // Handle template insertion
  const handleInsert = (template: string) => {
    // Get current cursor position
    const input = inputRef.current;
    if (!input) return;
    
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const currentValue = value || '';
    
    // Insert template at cursor position
    const newValue = 
      currentValue.substring(0, start) + 
      template + 
      currentValue.substring(end);
    
    onChange(newValue);
    
    // Close dropdown
    setShowContextBubble(false);
    
    // Focus input and set cursor after inserted template
    setTimeout(() => {
      input.focus();
      const newPosition = start + template.length;
      input.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const inputElement = type === 'textarea' ? (
    <TextArea
      ref={inputRef as React.RefObject<HTMLTextAreaElement>}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  ) : (
    <Input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  );

  return (
    <FieldContainer>
      <Label>
        {label}
        {required && <RequiredIndicator>*</RequiredIndicator>}
        {hasTemplate && <TemplateTag>{templates.length} template{templates.length > 1 ? 's' : ''}</TemplateTag>}
      </Label>
      
      <div style={{ position: 'relative' }}>
        <InputWrapper $hasTemplate={hasTemplate}>
          {inputElement}
          
          {context && (
            <ContextButton
              type="button"
              $active={showContextBubble}
              onClick={() => setShowContextBubble(!showContextBubble)}
              disabled={disabled}
              title="Insert data from previous steps"
            >
              <Database />
            </ContextButton>
          )}
        </InputWrapper>
        
        {context && (
          <ContextDropdown $show={showContextBubble} ref={dropdownRef}>
            <ContextBubble
              context={context}
              onInsert={handleInsert}
              position="right"
              compact
            />
          </ContextDropdown>
        )}
      </div>
      
      {showPreview && hasTemplate && resolvedValue !== null && resolvedValue !== undefined && (
        <PreviewContainer>
          <Eye size={14} />
          <PreviewLabel>Preview:</PreviewLabel>
          <PreviewValue>
            {typeof resolvedValue === 'object' 
              ? JSON.stringify(resolvedValue) 
              : String(resolvedValue)
            }
          </PreviewValue>
        </PreviewContainer>
      )}
    </FieldContainer>
  );
};

export default FieldWithContext;
