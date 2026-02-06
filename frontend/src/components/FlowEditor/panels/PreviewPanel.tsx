/**
 * Preview Panel Component
 * 
 * Live preview of form as it's being built in the WorkForms editor.
 * Shows real-time rendering of form fields, validation, and user experience.
 * 
 * Phase 5 Batch 1-3 of WF-ENH-2026-Q1
 * Created: 2026-02-06
 * Enhanced: 2026-02-06 (Batch 2 - Advanced field types, auto-updates)
 * Enhanced: 2026-02-06 (Batch 3 - Test data injection)
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { Node } from '@xyflow/react';
import { X, Smartphone, Monitor, Tablet, RefreshCw, Eye, TestTube2, Eraser } from 'lucide-react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface PreviewPanelProps {
  nodes: Node[];
  isVisible: boolean;
  onClose: () => void;
}

type ViewportSize = 'mobile' | 'tablet' | 'desktop';

// ============================================================================
// Styled Components
// ============================================================================

const PanelOverlay = styled.div<{ $isVisible: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: ${props => props.$isVisible ? '450px' : '0'};
  background: rgb(var(--color-background));
  border-left: 1px solid rgb(var(--color-border));
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  transition: width 0.3s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const PanelTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CloseButton = styled.button`
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgb(var(--color-background));
    color: rgb(var(--color-text-primary));
  }
`;

const ViewportControls = styled.div`
  display: flex;
  gap: 4px;
  padding: 12px 20px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
`;

const ViewportButton = styled.button<{ $active: boolean }>`
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: ${props => props.$active ? 'rgb(var(--color-primary))' : 'transparent'};
  border: 1px solid ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-sm);
  color: ${props => props.$active ? 'white' : 'rgb(var(--color-text-secondary))'};
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-background))'};
    color: ${props => props.$active ? 'white' : 'rgb(var(--color-text-primary))'};
    border-color: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  }
  
  svg {
    width: 14px;
    height: 14px;
  }
`;

const PreviewContent = styled.div`
  flex: 1;
  overflow-y: auto;
  background: rgb(var(--color-background-secondary));
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
`;

const PreviewViewport = styled.div<{ $size: ViewportSize }>`
  width: ${props => {
    switch (props.$size) {
      case 'mobile': return '375px';
      case 'tablet': return '768px';
      case 'desktop': return '100%';
      default: return '100%';
    }
  }};
  max-width: 100%;
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 24px;
  transition: width 0.3s ease;
`;

const PreviewForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FormField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FieldLabel = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const FieldInput = styled.input`
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface));
  transition: all 0.15s ease;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
  
  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const FieldTextarea = styled.textarea`
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface));
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  transition: all 0.15s ease;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
  
  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const FieldSelect = styled.select`
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface));
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const FieldHelpText = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: rgb(var(--color-text-secondary));
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
`;

const EmptyText = styled.p`
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
`;

const RefreshButton = styled.button`
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgb(var(--color-background));
    color: rgb(var(--color-text-primary));
    border-color: rgb(var(--color-border));
  }
  
  svg {
    width: 14px;
    height: 14px;
  }
`;

// ============================================================================
// Component
// ============================================================================

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  nodes,
  isVisible,
  onClose,
}) => {
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [refreshKey, setRefreshKey] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  
  /**
   * Generate test data for a field based on its type
   */
  const generateTestDataForField = useCallback((field: any): any => {
    switch (field.type) {
      case 'text':
        return field.label?.includes('Name') ? 'John Doe' : 
               field.label?.includes('Company') ? 'Acme Corporation' :
               field.label?.includes('Title') ? 'Senior Manager' : 
               'Sample Text';
      
      case 'email':
        return 'john.doe@example.com';
      
      case 'number':
        const min = field.min || 1;
        const max = field.max || 100;
        return Math.floor(Math.random() * (max - min + 1)) + min;
      
      case 'tel':
      case 'phone':
        return '+1 (555) 123-4567';
      
      case 'url':
        return 'https://example.com';
      
      case 'date':
        return new Date().toISOString().split('T')[0];
      
      case 'time':
        return '14:30';
      
      case 'datetime-local':
        return new Date().toISOString().slice(0, 16);
      
      case 'textarea':
        return 'This is a sample multi-line text response. It demonstrates how longer content will appear in the preview.';
      
      case 'select':
      case 'dropdown':
        return field.options && field.options.length > 0 
          ? field.options[0] 
          : '';
      
      case 'radio':
        return field.options && field.options.length > 0 
          ? field.options[0] 
          : '';
      
      case 'checkbox':
      case 'boolean':
        return true;
      
      default:
        return 'Sample value';
    }
  }, []);
  
  /**
   * Fill form with test data
   */
  const handleFillTestData = useCallback(() => {
    const testData: Record<string, any> = {};
    formFields.forEach(field => {
      testData[field.id] = generateTestDataForField(field);
    });
    setFormData(testData);
    console.log('[PreviewPanel] Test data generated:', testData);
  }, [formFields, generateTestDataForField]);
  
  /**
   * Clear all form data
   */
  const handleClearForm = useCallback(() => {
    setFormData({});
    console.log('[PreviewPanel] Form data cleared');
  }, []);
  
  /**
   * Log preview updates when nodes change
   */
  useEffect(() => {
    if (isVisible && nodes.length > 0) {
      console.log('[PreviewPanel] Auto-update: nodes changed', {
        nodeCount: nodes.length,
        formNodes: nodes.filter(n => n.type === 'formStep' || n.type === 'formField').length,
      });
    }
  }, [nodes, isVisible]);
  
  /**
   * Extract form fields from nodes
   * Filters for formField and formStep nodes and extracts their field definitions
   * Auto-updates when nodes change (real-time preview)
   */
  const formFields = useMemo(() => {
    const fields: any[] = [];
    
    // Find all form-related nodes
    nodes.forEach(node => {
      if (node.type === 'formStep' && node.data?.fields) {
        // FormStep node with multiple fields
        node.data.fields.forEach((field: any) => {
          fields.push({
            id: field.id || field.name,
            label: field.label || field.name,
            type: field.type || field.fieldType || 'text',
            placeholder: field.placeholder || '',
            helpText: field.helpText || field.description || '',
            required: field.required || false,
            options: field.options || [],
            min: field.min,
            max: field.max,
            pattern: field.pattern,
            validation: field.validation || {},
          });
        });
      } else if (node.type === 'formField') {
        // Individual FormField node
        fields.push({
          id: node.id,
          label: node.data?.label || 'Untitled Field',
          type: node.data?.fieldType || node.data?.type || 'text',
          placeholder: node.data?.placeholder || '',
          helpText: node.data?.helpText || node.data?.description || '',
          required: node.data?.required || false,
          options: node.data?.options || [],
          min: node.data?.min,
          max: node.data?.max,
          pattern: node.data?.pattern,
          validation: node.data?.validation || {},
        });
      }
    });
    
    return fields;
  }, [nodes, refreshKey]);
  
  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);
  
  const hasFormFields = formFields.length > 0;
  
  return (
    <PanelOverlay $isVisible={isVisible}>
      {/* Header */}
      <PanelHeader>
        <HeaderLeft>
          <PanelTitle>
            <Eye size={18} />
            Live Preview
          </PanelTitle>
        </HeaderLeft>
        <div style={{ display: 'flex', gap: '8px' }}>
          <RefreshButton 
            onClick={handleFillTestData} 
            title="Fill with Test Data"
            disabled={!hasFormFields}
          >
            <TestTube2 size={14} />
          </RefreshButton>
          <RefreshButton 
            onClick={handleClearForm} 
            title="Clear Form"
            disabled={!hasFormFields}
          >
            <Eraser size={14} />
          </RefreshButton>
          <CloseButton onClick={onClose} title="Close Preview">
            <X />
          </CloseButton>
        </div>
      </PanelHeader>
      
      {/* Viewport Controls */}
      <ViewportControls>
        <ViewportButton
          $active={viewport === 'mobile'}
          onClick={() => setViewport('mobile')}
          title="Mobile View (375px)"
        >
          <Smartphone />
          Mobile
        </ViewportButton>
        <ViewportButton
          $active={viewport === 'tablet'}
          onClick={() => setViewport('tablet')}
          title="Tablet View (768px)"
        >
          <Tablet />
          Tablet
        </ViewportButton>
        <ViewportButton
          $active={viewport === 'desktop'}
          onClick={() => setViewport('desktop')}
          title="Desktop View (100%)"
        >
          <Monitor />
          Desktop
        </ViewportButton>
      </ViewportControls>
      
      {/* Preview Content */}
      <PreviewContent>
        {hasFormFields ? (
          <PreviewViewport $size={viewport}>
            <PreviewForm onSubmit={(e) => e.preventDefault()}>
              {formFields.map((field) => (
                <FormField key={field.id}>
                  <FieldLabel>
                    {field.label}
                    {field.required && <span style={{ color: 'rgb(239, 68, 68)' }}> *</span>}
                  </FieldLabel>
                  
                  {/* Textarea */}
                  {field.type === 'textarea' ? (
                    <FieldTextarea
                      placeholder={field.placeholder}
                      required={field.required}
                      value={formData[field.id] || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, [field.id]: e.target.value }))}
                    />
                  ) : /* Select dropdown */
                  field.type === 'select' || field.type === 'dropdown' ? (
                    <FieldSelect 
                      required={field.required}
                      value={formData[field.id] || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, [field.id]: e.target.value }))}
                    >
                      <option value="">Select an option...</option>
                      {field.options.map((option: string, idx: number) => (
                        <option key={idx} value={option}>
                          {option}
                        </option>
                      ))}
                    </FieldSelect>
                  ) : /* Checkbox */
                  field.type === 'checkbox' || field.type === 'boolean' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id={field.id}
                        checked={formData[field.id] || false}
                        onChange={(e) => setFormData(prev => ({ ...prev, [field.id]: e.target.checked }))}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      {field.helpText && (
                        <label htmlFor={field.id} style={{ cursor: 'pointer', fontSize: '14px' }}>
                          {field.helpText}
                        </label>
                      )}
                    </div>
                  ) : /* Radio buttons */
                  field.type === 'radio' && field.options.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {field.options.map((option: string, idx: number) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="radio"
                            name={field.id}
                            id={`${field.id}-${idx}`}
                            value={option}
                            checked={formData[field.id] === option}
                            onChange={(e) => setFormData(prev => ({ ...prev, [field.id]: e.target.value }))}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                          <label htmlFor={`${field.id}-${idx}`} style={{ cursor: 'pointer', fontSize: '14px' }}>
                            {option}
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : /* Default: text, email, number, date, tel, url, etc. */
                  (
                    <FieldInput
                      type={field.type}
                      placeholder={field.placeholder}
                      required={field.required}
                      min={field.min}
                      max={field.max}
                      pattern={field.pattern}
                      title={field.validation?.message || ''}
                      value={formData[field.id] || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, [field.id]: e.target.value }))}
                    />
                  )}
                  
                  {/* Help text (except for checkbox which shows it inline) */}
                  {field.helpText && field.type !== 'checkbox' && field.type !== 'boolean' && (
                    <FieldHelpText>{field.helpText}</FieldHelpText>
                  )}
                </FormField>
              ))}
            </PreviewForm>
          </PreviewViewport>
        ) : (
          <EmptyState>
            <EmptyIcon>👁️</EmptyIcon>
            <EmptyText>
              No form fields to preview yet.<br />
              Add form steps or form fields to see a live preview.
            </EmptyText>
          </EmptyState>
        )}
      </PreviewContent>
    </PanelOverlay>
  );
};

export default PreviewPanel;
