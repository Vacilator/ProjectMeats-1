/**
 * Form Builder Component
 * 
 * Main FormBuilder modal with tabs for Steps, Settings, and Preview.
 * Manages form creation and editing with Zustand store.
 * 
 * Created: 2026-02-21
 * Phase: 4 - FormBuilder Suite
 */

import React, { useEffect } from 'react';
import styled from 'styled-components';
import { X, Save, Eye, Settings as SettingsIcon, Layers } from 'lucide-react';
import { useFormBuilderStore } from './store';
import { StepCard } from './StepCard';
import { FieldConfigModal } from './FieldConfigModal';
import { RuleBuilderModal } from './RuleBuilderModal';
import { MappingSection } from './MappingSection';
import { PreviewModal } from './PreviewModal';

/**
 * Props for FormBuilder
 */
interface FormBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: any) => void;
  initialData?: any;
  nodeId?: string;
}

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
  z-index: 9999;
  animation: fadeIn 0.2s ease-in-out;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const Modal = styled.div`
  background: rgb(var(--color-surface));
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90vw;
  max-width: 1200px;
  height: 85vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease-out;
  
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

const Header = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`;

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Title = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 0;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'ghost' }>`
  padding: ${props => props.variant === 'ghost' ? '8px' : '10px 16px'};
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  
  ${props => {
    if (props.variant === 'primary') {
      return `
        background: rgb(var(--color-primary));
        color: white;
        
        &:hover {
          opacity: 0.9;
        }
      `;
    } else if (props.variant === 'ghost') {
      return `
        background: transparent;
        color: rgb(var(--color-text-secondary));
        
        &:hover {
          background: rgb(var(--color-surface-hover));
        }
      `;
    } else {
      return `
        background: rgb(var(--color-surface-hover));
        color: rgb(var(--color-text-primary));
        border: 1px solid rgb(var(--color-border));
        
        &:hover {
          background: rgb(var(--color-surface-active));
        }
      `;
    }
  }}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Tabs = styled.div`
  display: flex;
  gap: 4px;
  padding: 0 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  flex-shrink: 0;
`;

const Tab = styled.button<{ active: boolean }>`
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: ${props => props.active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid ${props => props.active ? 'rgb(var(--color-primary))' : 'transparent'};
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover {
    color: rgb(var(--color-primary));
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const StepsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const AddStepButton = styled.button`
  padding: 16px;
  border: 2px dashed rgb(var(--color-border));
  border-radius: 8px;
  background: transparent;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.05);
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  
  svg {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }
  
  h3 {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: rgb(var(--color-text-primary));
  }
  
  p {
    font-size: 14px;
    margin: 0;
  }
`;

const SettingsContent = styled.div`
  max-width: 600px;
  
  label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: rgb(var(--color-text-primary));
    margin-bottom: 8px;
  }
  
  input, textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid rgb(var(--color-border));
    border-radius: 8px;
    background: rgb(var(--color-surface));
    color: rgb(var(--color-text-primary));
    font-size: 14px;
    margin-bottom: 20px;
    
    &:focus {
      outline: none;
      border-color: rgb(var(--color-primary));
    }
  }
  
  textarea {
    min-height: 100px;
    resize: vertical;
  }
`;

/**
 * FormBuilder Component
 */
export const FormBuilder: React.FC<FormBuilderProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  nodeId
}) => {
  const {
    formName,
    formDescription,
    steps,
    activeTab,
    isDirty,
    setFormName,
    setFormDescription,
    setActiveTab,
    addStep,
    loadForm,
    resetForm,
    getFormData,
    openPreviewModal
  } = useFormBuilderStore();
  
  // Load initial data when modal opens
  useEffect(() => {
    if (isOpen && initialData) {
      loadForm(initialData);
    } else if (isOpen && !initialData) {
      resetForm();
    }
  }, [isOpen, initialData, loadForm, resetForm]);
  
  // Handle save
  const handleSave = () => {
    const formData = getFormData();
    onSave(formData);
    onClose();
  };
  
  // Handle close with unsaved changes
  const handleClose = () => {
    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmed) return;
    }
    onClose();
  };
  
  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'steps':
        return (
          <StepsContainer>
            {steps.map(step => (
              <StepCard key={step.id} step={step} />
            ))}
            <AddStepButton onClick={addStep}>
              + Add Step
            </AddStepButton>
          </StepsContainer>
        );
        
      case 'settings':
        return (
          <SettingsContent>
            <div>
              <label htmlFor="form-name">Form Name</label>
              <input
                id="form-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Enter form name..."
              />
            </div>
            
            <div>
              <label htmlFor="form-description">Description</label>
              <textarea
                id="form-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe the purpose of this form..."
              />
            </div>
          </SettingsContent>
        );
        
      case 'preview':
        return (
          <EmptyState>
            <Eye />
            <h3>Preview Mode</h3>
            <p>Preview functionality will be available in the Preview Modal.</p>
            <Button
              variant="primary"
              onClick={openPreviewModal}
              style={{ marginTop: '20px' }}
            >
              <Eye size={16} />
              Open Preview
            </Button>
          </EmptyState>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <>
      <Overlay isOpen={isOpen} onClick={handleClose}>
        <Modal onClick={(e) => e.stopPropagation()}>
          <Header>
            <HeaderLeft>
              <Title>{formName || 'Untitled Form'}</Title>
              <Subtitle>
                {steps.length} step{steps.length !== 1 ? 's' : ''} • 
                {' '}{steps.reduce((sum, step) => sum + step.fields.length, 0)} fields
              </Subtitle>
            </HeaderLeft>
            
            <HeaderRight>
              <Button variant="secondary" onClick={openPreviewModal}>
                <Eye size={16} />
                Preview
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={!isDirty}>
                <Save size={16} />
                Save
              </Button>
              <Button variant="ghost" onClick={handleClose}>
                <X size={20} />
              </Button>
            </HeaderRight>
          </Header>
          
          <Tabs>
            <Tab active={activeTab === 'steps'} onClick={() => setActiveTab('steps')}>
              <Layers size={16} />
              Steps
            </Tab>
            <Tab active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
              <SettingsIcon size={16} />
              Settings
            </Tab>
            <Tab active={activeTab === 'preview'} onClick={() => setActiveTab('preview')}>
              <Eye size={16} />
              Preview
            </Tab>
          </Tabs>
          
          <Content>
            {renderTabContent()}
          </Content>
        </Modal>
      </Overlay>
      
      {/* Modals */}
      <FieldConfigModal />
      <RuleBuilderModal />
      <MappingSection />
      <PreviewModal />
    </>
  );
};
