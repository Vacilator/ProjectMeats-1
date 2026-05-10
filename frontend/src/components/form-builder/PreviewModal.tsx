/**
 * Preview Modal Component
 * 
 * Live preview of the form with test data filling.
 * Shows progress bar, field mocks, and navigation.
 * 
 * Created: 2026-02-21
 * Phase: 4 - FormBuilder Suite
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFormBuilderStore } from './store';

const Overlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(var(--color-overlay), 0.5);
  display: ${props => props.isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 10000;
`;

const Modal = styled.div`
  background: rgb(var(--color-surface));
  border-radius: 12px;
  width: 90vw;
  max-width: 900px;
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
  margin: 0;
`;

const ProgressBar = styled.div`
  height: 4px;
  background: rgb(var(--color-border));
  margin: 0 24px;
`;

const ProgressFill = styled.div<{ progress: number }>`
  height: 100%;
  width: ${props => props.progress}%;
  background: rgb(var(--color-primary));
  transition: width 0.3s;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 32px 24px;
`;

const StepTitle = styled.h2`
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: rgb(var(--color-text-primary));
`;

const StepDescription = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 0 0 32px 0;
`;

const FieldGroup = styled.div`
  margin-bottom: 24px;
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: rgb(var(--color-text-primary));
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  font-size: 14px;
`;

const Footer = styled.div`
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const NavButton = styled.button`
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgb(var(--color-surface-hover));
  color: rgb(var(--color-text-primary));
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StepIndicator = styled.div`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
`;

export const PreviewModal: React.FC = () => {
  const { isPreviewModalOpen, steps, closePreviewModal } = useFormBuilderStore();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  
  const currentStep = steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / steps.length) * 100;
  
  const goNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };
  
  const goPrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };
  
  return (
    <Overlay isOpen={isPreviewModalOpen} onClick={closePreviewModal}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Form Preview</Title>
          <button type="button" onClick={closePreviewModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </Header>
        
        <ProgressBar>
          <ProgressFill progress={progress} />
        </ProgressBar>
        
        <Content>
          {currentStep && (
            <>
              <StepTitle>{currentStep.displayTitle || currentStep.name}</StepTitle>
              {currentStep.displayDescription && (
                <StepDescription>{currentStep.displayDescription}</StepDescription>
              )}
              
              {currentStep.fields.map(field => (
                <FieldGroup key={field.id}>
                  <Label>
                    {field.label}
                    {field.required && ' *'}
                  </Label>
                  <Input
                    type={field.type === 'number' ? 'number' : 'text'}
                    placeholder={field.placeholder}
                  />
                </FieldGroup>
              ))}
            </>
          )}
        </Content>
        
        <Footer>
          <NavButton onClick={goPrev} disabled={currentStepIndex === 0}>
            <ChevronLeft size={16} />
            Previous
          </NavButton>
          
          <StepIndicator>
            Step {currentStepIndex + 1} of {steps.length}
          </StepIndicator>
          
          <NavButton onClick={goNext} disabled={currentStepIndex === steps.length - 1}>
            Next
            <ChevronRight size={16} />
          </NavButton>
        </Footer>
      </Modal>
    </Overlay>
  );
};
