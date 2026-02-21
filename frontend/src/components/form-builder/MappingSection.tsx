/**
 * Mapping Section Component
 * 
 * Manages field mappings for data inheritance.
 * Provides Auto-Map functionality (Phase 5).
 * 
 * Created: 2026-02-21
 * Phase: 4 - FormBuilder Suite
 */

import React from 'react';
import styled from 'styled-components';
import { X, Zap } from 'lucide-react';
import { useFormBuilderStore } from './store';

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
  margin: 0;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const EmptyMessage = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
`;

const AutoMapButton = styled.button`
  width: 100%;
  padding: 12px 16px;
  background: rgb(var(--color-primary));
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  &:hover {
    opacity: 0.9;
  }
`;

const Footer = styled.div`
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const Button = styled.button`
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  border: none;
  cursor: pointer;
  background: rgb(var(--color-surface-hover));
  color: rgb(var(--color-text-primary));
`;

export const MappingSection: React.FC = () => {
  const { isMappingModalOpen, activeStepId, closeMappingModal, autoMapFields } = useFormBuilderStore();
  
  const handleAutoMap = () => {
    if (activeStepId) {
      autoMapFields(activeStepId);
    }
  };
  
  return (
    <Overlay isOpen={isMappingModalOpen} onClick={closeMappingModal}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Field Mappings</Title>
          <button onClick={closeMappingModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </Header>
        
        <Content>
          <AutoMapButton onClick={handleAutoMap}>
            <Zap size={16} />
            Auto-Map Fields
          </AutoMapButton>
          
          <EmptyMessage>
            Auto-Map algorithm will be implemented in Phase 5.
            It will intelligently match fields from previous steps based on name similarity and type compatibility.
          </EmptyMessage>
        </Content>
        
        <Footer>
          <Button onClick={closeMappingModal}>Close</Button>
        </Footer>
      </Modal>
    </Overlay>
  );
};
