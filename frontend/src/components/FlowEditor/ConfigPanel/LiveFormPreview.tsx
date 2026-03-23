/**
 * Live Form Preview Component
 * 
 * Real-time preview of form configuration showing exactly what users will see.
 * Updates instantly as user edits fields, validations, and conditional logic.
 * 
 * Created: 2026-02-24
 * Phase: Visual Config Panel Enhancement
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { FormField, ValidationRule } from '../../form-builder/types';
import { Eye, AlertCircle, CheckCircle, Info } from 'lucide-react';

// ============================================================================
// Component Props
// ============================================================================

export interface LiveFormPreviewProps {
  /** Fields to preview */
  fields: FormField[];
  
  /** Form title */
  title?: string;
  
  /** Form description */
  description?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  height: 100%;
  overflow-y: auto;
  background: rgb(var(--color-surface-hover));
`;

const PreviewHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgb(var(--color-surface));
  border-radius: 8px;
  border: 1px dashed rgb(var(--color-border));
`;

const PreviewTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PreviewCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;

const FormTitle = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px 0;
`;

const FormDescription = styled.p`
  font-size: 14px;
  color: #666;
  margin: 0 0 24px 0;
  line-height: 1.6;
`;

const FieldsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FieldWrapper = styled.div<{ width?: string }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: ${props => {
    if (props.width === 'half') return '48%';
    if (props.width === 'third') return '32%';
    return '100%';
  }};
`;

const FieldLabel = styled.label`
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const RequiredStar = styled.span`
  color: #ef4444;
`;

const HelpText = styled.span`
  font-size: 12px;
  color: #666;
  font-weight: 400;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const Input = styled.input`
  padding: 10px 12px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  color: #1a1a1a;
  transition: all 0.2s;
  
  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
  
  &::placeholder {
    color: #9ca3af;
  }
`;

const Textarea = styled.textarea`
  padding: 10px 12px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  color: #1a1a1a;
  min-height: 100px;
  resize: vertical;
  font-family: inherit;
  transition: all 0.2s;
  
  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
  
  &::placeholder {
    color: #9ca3af;
  }
`;

const Select = styled.select`
  padding: 10px 12px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  color: #1a1a1a;
  cursor: pointer;
  transition: all 0.2s;
  
  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
`;

const CheckboxGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const RadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #1a1a1a;
  
  input {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
`;

const RadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #1a1a1a;
  
  input {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
`;

const FileInput = styled.div`
  padding: 32px;
  border: 2px dashed #e5e7eb;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: #6366f1;
    background: rgba(99, 102, 241, 0.05);
  }
`;

const ValidationHint = styled.div<{ type: 'error' | 'info' }>`
  font-size: 12px;
  color: ${props => props.type === 'error' ? '#ef4444' : '#6366f1'};
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 48px 24px;
  color: #9ca3af;
  
  svg {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    opacity: 0.3;
  }
  
  p {
    font-size: 14px;
    margin: 0;
  }
`;

// ============================================================================
// Helper Functions
// ============================================================================

const renderFieldInput = (field: FormField): React.ReactNode => {
  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'number':
    case 'date':
    case 'datetime':
      return (
        <Input
          type={field.type === 'datetime' ? 'datetime-local' : field.type}
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
          disabled
        />
      );
      
    case 'textarea':
      return (
        <Textarea
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
          disabled
        />
      );
      
    case 'select':
      return (
        <Select disabled>
          <option value="">Select an option</option>
          {(field.options || []).map((option, idx) => (
            <option key={idx} value={option}>{option}</option>
          ))}
        </Select>
      );
      
    case 'multiSelect':
      return (
        <Select multiple disabled style={{ minHeight: '120px' }}>
          {(field.options || []).map((option, idx) => (
            <option key={idx} value={option}>{option}</option>
          ))}
        </Select>
      );
      
    case 'radio':
      return (
        <RadioGroup>
          {(field.options || []).map((option, idx) => (
            <RadioLabel key={idx}>
              <input type="radio" name={field.id} value={option} disabled />
              {option}
            </RadioLabel>
          ))}
        </RadioGroup>
      );
      
    case 'checkbox':
      return (
        <CheckboxGroup>
          {(field.options || []).map((option, idx) => (
            <CheckboxLabel key={idx}>
              <input type="checkbox" value={option} disabled />
              {option}
            </CheckboxLabel>
          ))}
        </CheckboxGroup>
      );
      
    case 'file':
      return (
        <FileInput>
          📎 Click to upload or drag and drop
        </FileInput>
      );
      
    case 'signature':
      return (
        <div style={{ 
          border: '2px solid #e5e7eb', 
          borderRadius: '8px', 
          padding: '24px', 
          textAlign: 'center',
          background: '#f9fafb'
        }}>
          ✍️ Signature pad will appear here
        </div>
      );
      
    case 'rating':
      return (
        <div style={{ fontSize: '24px' }}>
          ⭐⭐⭐⭐⭐
        </div>
      );
      
    case 'slider':
      return (
        <input type="range" style={{ width: '100%' }} disabled />
      );
      
    default:
      return <Input type="text" placeholder="Unknown field type" disabled />;
  }
};

const getValidationHints = (field: FormField): React.ReactNode[] => {
  const hints: React.ReactNode[] = [];
  
  if (field.required) {
    hints.push(
      <ValidationHint key="required" type="info">
        <Info size={12} />
        This field is required
      </ValidationHint>
    );
  }
  
  const validationRules: ValidationRule[] = Array.isArray((field as any).validation)
    ? (field as any).validation
    : ((field as any).validation ? [(field as any).validation] : []);

  validationRules.forEach((rule, idx) => {
    if (rule.type === 'minLength') {
      hints.push(
        <ValidationHint key={`min-${idx}`} type="info">
          <Info size={12} />
          Minimum {rule.value} characters
        </ValidationHint>
      );
    } else if (rule.type === 'maxLength') {
      hints.push(
        <ValidationHint key={`max-${idx}`} type="info">
          <Info size={12} />
          Maximum {rule.value} characters
        </ValidationHint>
      );
    } else if (rule.type === 'min') {
      hints.push(
        <ValidationHint key={`min-val-${idx}`} type="info">
          <Info size={12} />
          Minimum value: {rule.value}
        </ValidationHint>
      );
    } else if (rule.type === 'max') {
      hints.push(
        <ValidationHint key={`max-val-${idx}`} type="info">
          <Info size={12} />
          Maximum value: {rule.value}
        </ValidationHint>
      );
    }
  });
  
  return hints;
};

// ============================================================================
// Main Component
// ============================================================================

export const LiveFormPreview: React.FC<LiveFormPreviewProps> = ({
  fields,
  title = 'Form Preview',
  description,
}) => {
  return (
    <Container>
      <PreviewHeader>
        <Eye size={16} />
        <PreviewTitle>Live Preview</PreviewTitle>
      </PreviewHeader>
      
      {fields.length === 0 ? (
        <EmptyState>
          <AlertCircle />
          <p>Add fields to see the preview</p>
        </EmptyState>
      ) : (
        <PreviewCard>
          {title && <FormTitle>{title}</FormTitle>}
          {description && <FormDescription>{description}</FormDescription>}
          
          <FieldsContainer>
            {fields.map(field => (
              <FieldWrapper key={field.id} width={field.width}>
                <FieldLabel>
                  {field.label}
                  {field.required && <RequiredStar>*</RequiredStar>}
                  {field.helpText && (
                    <HelpText>
                      <Info size={12} />
                      {field.helpText}
                    </HelpText>
                  )}
                </FieldLabel>
                
                {renderFieldInput(field)}
                
                {getValidationHints(field)}
              </FieldWrapper>
            ))}
          </FieldsContainer>
        </PreviewCard>
      )}
    </Container>
  );
};
