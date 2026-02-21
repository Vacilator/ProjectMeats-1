/**
 * Form Reference Config Panel
 * 
 * Configuration panel for FormReference nodes.
 * Allows selecting a form from the library and configuring prefill data.
 * 
 * Created: 2026-02-05 - Phase 3 Task 3.3
 * Part of: WORKFORMS_NAVIGATION_FIX_PLAN Phase 3
 */
import React, { useState } from 'react';
import styled from 'styled-components';
import { X, FileText, Edit, Eye, ExternalLink } from 'lucide-react';
import {
  PanelOverlay,
  Panel,
  PanelHeader,
  PanelTitle,
  CloseButton,
  PanelContent,
  FormField,
  Label,
  PrimaryButton,
  EmptyState as SharedEmptyState,
  EmptyIcon as SharedEmptyIcon,
  EmptyText as SharedEmptyText,
} from './shared/StyledComponents';
import FormSelectorModal from '../../WorkForms/FormSelectorModal';
import type { FormDefinition } from '../../form-builder';
import type { Node } from '@xyflow/react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface FormReferenceConfigPanelProps {
  node: Node;
  onUpdate: (nodeId: string, data: any) => void;
  onClose: () => void;
}

// ============================================================================
// Styled Components
// ============================================================================



const Panel = styled.div`
  background: rgb(var(--color-surface));
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  animation: slideUp 0.3s;
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;













const FormCard = styled.div`
  padding: 16px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  background: rgb(var(--color-background));
`;

const FormHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
`;

const FormIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgba(var(--color-primary), 0.1);
  color: rgb(var(--color-primary));
`;

const FormDetails = styled.div`
  flex: 1;
`;

const FormName = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const FormDescription = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  margin-top: 2px;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
  background: transparent;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(var(--color-primary), 0.05);
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
  }
`;







const SelectButton = styled.button`
  padding: 8px 16px;
  background: rgb(var(--color-primary));
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    opacity: 0.9;
  }
`;

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
`;

const HelpText = styled.p`
  margin: 8px 0 0 0;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.4;
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
`;

const Button = styled.button<{ $variant?: 'primary' }>`
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.$variant === 'primary' ? `
    background: rgb(var(--color-primary));
    color: white;
    &:hover { opacity: 0.9; }
  ` : `
    background: transparent;
    color: rgb(var(--color-text-secondary));
    border: 1px solid rgb(var(--color-border));
    &:hover { background: rgb(var(--color-background)); }
  `}
`;

// ============================================================================
// Form Reference Config Panel Component
// ============================================================================

export const FormReferenceConfigPanel: React.FC<FormReferenceConfigPanelProps> = ({
  node,
  onUpdate,
  onClose,
}) => {
  const [showFormSelector, setShowFormSelector] = useState(false);
  const [localData, setLocalData] = useState({
    formId: node.data.formId,
    formName: node.data.formName,
    formDescription: node.data.formDescription,
    fieldCount: node.data.fieldCount || 0,
    sectionCount: node.data.sectionCount || 0,
    allowEdit: node.data.allowEdit || false,
    prefillData: node.data.prefillData || {},
  });
  
  const hasForm = localData.formId && localData.formName;
  
  const handleFormSelect = (form: FormDefinition) => {
    setLocalData({
      ...localData,
      formId: form.id,
      formName: form.name,
      formDescription: form.description,
      fieldCount: form.sections.reduce((acc, s) => acc + s.fields.length, 0),
      sectionCount: form.sections.length,
    });
    setShowFormSelector(false);
  };
  
  const handleToggleAllowEdit = () => {
    setLocalData({
      ...localData,
      allowEdit: !localData.allowEdit,
    });
  };
  
  const handleSave = () => {
    onUpdate(node.id, localData);
    onClose();
  };
  
  return (
    <>
      <PanelOverlay onClick={onClose}>
        <Panel onClick={(e) => e.stopPropagation()}>
          <PanelHeader>
            <PanelTitle>Configure Form Reference</PanelTitle>
            <CloseButton onClick={onClose}>
              <X size={20} />
            </CloseButton>
          </PanelHeader>
          
          <PanelContent>
            <FormField>
              <Label>Selected Form</Label>
              {hasForm ? (
                <FormCard>
                  <FormHeader>
                    <FormIcon>
                      <FileText size={20} />
                    </FormIcon>
                    <FormDetails>
                      <FormName>{localData.formName}</FormName>
                      {localData.formDescription && (
                        <FormDescription>{localData.formDescription}</FormDescription>
                      )}
                    </FormDetails>
                  </FormHeader>
                  <div style={{ fontSize: '13px', color: 'rgb(var(--color-text-secondary))' }}>
                    {localData.sectionCount} sections • {localData.fieldCount} fields
                  </div>
                  <ActionButtons>
                    <ActionButton onClick={() => setShowFormSelector(true)}>
                      <ExternalLink size={14} />
                      Change Form
                    </ActionButton>
                  </ActionButtons>
                </FormCard>
              ) : (
                <SharedEmptyState>
                  <SharedEmptyIcon>📋</SharedEmptyIcon>
                  <SharedEmptyText>No form selected</SharedEmptyText>
                  <SelectButton onClick={() => setShowFormSelector(true)}>
                    Select a Form
                  </SelectButton>
                </SharedEmptyState>
              )}
            </FormField>
            
            {hasForm && (
              <FormField>
                <CheckboxLabel>
                  <Checkbox
                    type="checkbox"
                    checked={localData.allowEdit}
                    onChange={handleToggleAllowEdit}
                  />
                  <span>Allow users to edit form responses</span>
                </CheckboxLabel>
                <HelpText>
                  When enabled, users can modify their submitted data before final submission.
                </HelpText>
              </FormField>
            )}
          </PanelContent>
          
          <Footer>
            <Button onClick={onClose}>Cancel</Button>
            <Button $variant="primary" onClick={handleSave}>
              Save Configuration
            </Button>
          </Footer>
        </Panel>
      </PanelOverlay>
      
      <FormSelectorModal
        isOpen={showFormSelector}
        onClose={() => setShowFormSelector(false)}
        onSelect={handleFormSelect}
        currentFormId={localData.formId}
      />
    </>
  );
};

export default FormReferenceConfigPanel;
