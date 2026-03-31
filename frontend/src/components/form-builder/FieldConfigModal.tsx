/**
 * Field Configuration Modal
 * 
 * Modal for adding/editing form fields with auto-populate suggestions.
 * Provides comprehensive field configuration options.
 * 
 * Created: 2026-02-21
 * Phase: 4 - FormBuilder Suite
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { showAlert } from '@/utils/uiDialogs';
import { X, Save, Sparkles, TrendingUp } from 'lucide-react';
import { FormField, FieldType, ValidationType, AutoPopulateSuggestion } from './types';
import { useFormBuilderStore } from './store';
import { generateAutoPopulateSuggestions } from '../FlowEditor/utils/autoPopulateEngine';
import { Variable } from '../FlowEditor/components/VariablePicker';

/**
 * Styled Components
 */
const Overlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${props => props.isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 10000;
`;

const Modal = styled.div`
  background: rgb(var(--color-surface));
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90vw;
  max-width: 700px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Title = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  padding: 8px;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  
  &:hover {
    background: rgb(var(--color-surface-hover));
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

const RequiredMark = styled.span`
  color: rgb(239, 68, 68);
  margin-left: 4px;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  min-height: 80px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const Checkbox = styled.input`
  margin-right: 8px;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
`;

const HelpText = styled.p`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  margin: 6px 0 0 0;
`;

const SuggestionBox = styled.div`
  margin-top: 12px;
  padding: 12px;
  border: 1px solid rgba(var(--color-primary), 0.3);
  border-radius: 8px;
  background: rgba(var(--color-primary), 0.05);
`;

const SuggestionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgb(var(--color-primary));
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 12px;
`;

const SuggestionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SuggestionItem = styled.button`
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  background: rgb(var(--color-surface));
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.05);
  }
`;

const SuggestionItemHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
`;

const SuggestionFieldName = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  font-family: 'Courier New', monospace;
`;

const SuggestionScore = styled.span<{ confidence: string }>`
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background: ${props => {
    if (props.confidence === 'high') return 'rgba(34, 197, 94, 0.15)';
    if (props.confidence === 'medium') return 'rgba(234, 179, 8, 0.15)';
    return 'rgba(var(--color-primary), 0.15)';
  }};
  color: ${props => {
    if (props.confidence === 'high') return 'rgb(34, 197, 94)';
    if (props.confidence === 'medium') return 'rgb(234, 179, 8)';
    return 'rgb(var(--color-primary))';
  }};
`;

const SuggestionReason = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const Footer = styled.div`
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  
  ${props => props.variant === 'primary' ? `
    background: rgb(var(--color-primary));
    color: white;
    
    &:hover {
      opacity: 0.9;
    }
  ` : `
    background: rgb(var(--color-surface-hover));
    color: rgb(var(--color-text-primary));
    border: 1px solid rgb(var(--color-border));
    
    &:hover {
      background: rgb(var(--color-surface-active));
    }
  `}
`;

/**
 * Field types with labels
 */
const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiSelect', label: 'Multi-Select' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'checkbox', label: 'Checkboxes' },
  { value: 'file', label: 'File Upload' },
  { value: 'signature', label: 'Signature' },
  { value: 'rating', label: 'Rating' },
  { value: 'slider', label: 'Slider' }
];

/**
 * Generate unique ID
 */
const generateId = () => `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * FieldConfigModal Component
 */
export const FieldConfigModal: React.FC = () => {
  const {
    isFieldModalOpen,
    activeStepId,
    editingField,
    closeFieldModal,
    saveField,
    steps
  } = useFormBuilderStore();
  
  // Field state
  const [fieldData, setFieldData] = useState<FormField>({
    id: generateId(),
    type: 'text',
    label: '',
    placeholder: '',
    helpText: '',
    required: false,
    validation: [],
    width: 'full'
  });
  
  // Suggestions state
  const [suggestions, setSuggestions] = useState<AutoPopulateSuggestion[]>([]);
  const [availableVariables, setAvailableVariables] = useState<Variable[]>([]);
  
  // Load editing field
  useEffect(() => {
    if (editingField) {
      setFieldData(editingField);
    } else {
      setFieldData({
        id: generateId(),
        type: 'text',
        label: '',
        placeholder: '',
        helpText: '',
        required: false,
        validation: [],
        width: 'full'
      });
    }
  }, [editingField, isFieldModalOpen]);
  
  // Generate suggestions when field label changes
  useEffect(() => {
    if (!fieldData.label || !activeStepId) {
      setSuggestions([]);
      return;
    }
    
    // Mock available variables (in real implementation, get from upstream nodes)
    const mockVariables: Variable[] = [
      {
        id: 'var1',
        name: 'customerName',
        displayName: 'Customer Name',
        type: 'text',
        nodeId: 'node1',
        nodeName: 'Customer Info',
        nodeType: 'form',
        path: 'step1.customerName',
        sampleValue: 'John Doe'
      },
      {
        id: 'var2',
        name: 'email',
        displayName: 'Email Address',
        type: 'email',
        nodeId: 'node1',
        nodeName: 'Customer Info',
        nodeType: 'form',
        path: 'step1.email',
        sampleValue: 'john@example.com'
      },
      {
        id: 'var3',
        name: 'phone',
        displayName: 'Phone Number',
        type: 'phone',
        nodeId: 'node1',
        nodeName: 'Customer Info',
        nodeType: 'form',
        path: 'step1.phone',
        sampleValue: '+1234567890'
      }
    ];
    
    setAvailableVariables(mockVariables);
    
    // Generate suggestions
    const newSuggestions = generateAutoPopulateSuggestions(
      fieldData,
      mockVariables,
      3
    );
    
    setSuggestions(newSuggestions);
  }, [fieldData.label, fieldData.type, activeStepId]);
  
  const handleSave = () => {
    if (!activeStepId) return;
    if (!fieldData.label.trim()) {
      showAlert({ type: 'warning', title: 'Validation', content: 'Field label is required' });
      return;
    }
    
    saveField(activeStepId, fieldData);
  };
  
  const handleChange = (key: keyof FormField, value: any) => {
    setFieldData(prev => ({ ...prev, [key]: value }));
  };
  
  // Apply suggestion
  const handleApplySuggestion = (suggestion: AutoPopulateSuggestion) => {
    const sourceVariable = availableVariables.find(
      v => v.path === suggestion.sourceField
    );
    
    if (sourceVariable) {
      setFieldData(prev => ({
        ...prev,
        autoPopulate: {
          enabled: true,
          sourceStep: suggestion.sourceStep,
          sourceField: suggestion.sourceField,
          mode: 'copy'
        }
      }));
    }
  };
  
  return (
    <Overlay isOpen={isFieldModalOpen} onClick={closeFieldModal}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>{editingField ? 'Edit Field' : 'Add Field'}</Title>
          <CloseButton onClick={closeFieldModal}>
            <X size={20} />
          </CloseButton>
        </Header>
        
        <Content>
          <FormGroup>
            <Label htmlFor="field-label">
              Field Label
              <RequiredMark>*</RequiredMark>
            </Label>
            <Input
              id="field-label"
              type="text"
              value={fieldData.label}
              onChange={(e) => handleChange('label', e.target.value)}
              placeholder="e.g., Customer Name"
            />
          </FormGroup>
          
          <FormGroup>
            <Label htmlFor="field-type">Field Type</Label>
            <Select
              id="field-type"
              value={fieldData.type}
              onChange={(e) => handleChange('type', e.target.value as FieldType)}
            >
              {FIELD_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </FormGroup>
          
          <FormGroup>
            <Label htmlFor="field-placeholder">Placeholder</Label>
            <Input
              id="field-placeholder"
              type="text"
              value={fieldData.placeholder || ''}
              onChange={(e) => handleChange('placeholder', e.target.value)}
              placeholder="e.g., Enter your name..."
            />
          </FormGroup>
          
          <FormGroup>
            <Label htmlFor="field-help">Help Text</Label>
            <TextArea
              id="field-help"
              value={fieldData.helpText || ''}
              onChange={(e) => handleChange('helpText', e.target.value)}
              placeholder="Optional help text for users..."
            />
          </FormGroup>
          
          <FormGroup>
            <CheckboxLabel>
              <Checkbox
                type="checkbox"
                checked={fieldData.required}
                onChange={(e) => handleChange('required', e.target.checked)}
              />
              Required field
            </CheckboxLabel>
          </FormGroup>
          
          <FormGroup>
            <Label htmlFor="field-width">Field Width</Label>
            <Select
              id="field-width"
              value={fieldData.width || 'full'}
              onChange={(e) => handleChange('width', e.target.value)}
            >
              <option value="full">Full Width</option>
              <option value="half">Half Width</option>
              <option value="third">Third Width</option>
            </Select>
          </FormGroup>
          
          {suggestions.length > 0 && (
            <SuggestionBox>
              <SuggestionHeader>
                <Sparkles size={16} />
                Smart Auto-Populate Suggestions
              </SuggestionHeader>
              <SuggestionList>
                {suggestions.map((suggestion, index) => (
                  <SuggestionItem
                    key={index}
                    onClick={() => handleApplySuggestion(suggestion)}
                  >
                    <SuggestionItemHeader>
                      <SuggestionFieldName>
                        {suggestion.sourceField}
                      </SuggestionFieldName>
                      <SuggestionScore confidence={suggestion.confidence}>
                        <TrendingUp size={10} style={{ marginRight: '4px', display: 'inline' }} />
                        {suggestion.score}% match
                      </SuggestionScore>
                    </SuggestionItemHeader>
                    <SuggestionReason>{suggestion.reason}</SuggestionReason>
                  </SuggestionItem>
                ))}
              </SuggestionList>
            </SuggestionBox>
          )}
        </Content>
        
        <Footer>
          <Button onClick={closeFieldModal}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>
            <Save size={16} />
            Save Field
          </Button>
        </Footer>
      </Modal>
    </Overlay>
  );
};
