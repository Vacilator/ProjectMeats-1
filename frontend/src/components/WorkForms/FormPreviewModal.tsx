/**
 * FormPreviewModal Component
 * 
 * Shows a preview of a form with options to view, edit, or clone.
 * Task 1.4 of WORKFORMS_NAVIGATION_FIX_PLAN
 */

import React from 'react';
import styled from 'styled-components';
import { X, Edit, Eye, Copy, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// TypeScript Interfaces
interface FormPreviewModalProps {
  form: {
    id: string;
    name: string;
    description: string;
    status: 'draft' | 'active' | 'inactive';
    icon: string;
    entity_count: number;
    is_multi_entity: boolean;
    created_at: string;
    updated_at: string;
    flow_data?: {
      nodes: any[];
      edges: any[];
    };
  };
  onClose: () => void;
}

// Styled Components
const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const Modal = styled.div`
  background: rgb(var(--color-surface));
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease-out;

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

const Header = styled.div`
  padding: 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: flex-start;
  gap: 16px;
`;

const FormIcon = styled.div`
  font-size: 40px;
  line-height: 1;
`;

const HeaderContent = styled.div`
  flex: 1;
`;

const FormTitle = styled.h2`
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const FormDescription = styled.p`
  margin: 0 0 12px 0;
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.5;
`;

const StatusBadge = styled.span<{ $status: 'draft' | 'active' | 'inactive' }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: capitalize;
  
  ${props => {
    switch (props.$status) {
      case 'active':
        return 'background: rgb(34, 197, 94, 0.1); color: rgb(34, 197, 94);';
      case 'draft':
        return 'background: rgb(234, 179, 8, 0.1); color: rgb(234, 179, 8);';
      case 'inactive':
        return 'background: rgb(var(--color-border)); color: rgb(var(--color-text-secondary));';
    }
  }}
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
  &:hover {
    background: rgb(var(--color-surface-hover));
    color: rgb(var(--color-text-primary));
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
`;

const InfoCard = styled.div`
  padding: 16px;
  background: rgb(var(--color-background));
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border));
`;

const InfoLabel = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
`;

const InfoValue = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const InfoSubtext = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  margin-top: 4px;
`;

const Section = styled.div`
  margin-bottom: 24px;
`;

const SectionTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
`;

const NodeList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const NodeChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: 16px;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
`;

const Footer = styled.div`
  padding: 20px 24px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const FooterLeft = styled.div`
  display: flex;
  gap: 12px;
`;

const FooterRight = styled.div`
  display: flex;
  gap: 12px;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'outline' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  ${props => {
    switch (props.variant) {
      case 'primary':
        return 'background: rgb(var(--color-primary)); color: white; &:hover { opacity: 0.9; transform: translateY(-1px); }';
      case 'outline':
        return 'background: transparent; color: rgb(var(--color-text-primary)); border: 1px solid rgb(var(--color-border)); &:hover { background: rgb(var(--color-surface-hover)); }';
      default:
        return 'background: rgb(var(--color-surface)); color: rgb(var(--color-text-primary)); border: 1px solid rgb(var(--color-border)); &:hover { background: rgb(var(--color-surface-hover)); }';
    }
  }}
  svg { width: 16px; height: 16px; }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
`;

// Component
export const FormPreviewModal: React.FC<FormPreviewModalProps> = ({ form, onClose }) => {
  const navigate = useNavigate();
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  
  const getNodeTypeName = (nodeType: string): string => {
    const typeMap: Record<string, string> = {
      trigger: 'Trigger', formStep: 'Form Step', formField: 'Form Field', formSection: 'Section',
      formFileUpload: 'File Upload', condition: 'Condition', action: 'Action', waitState: 'Wait', terminal: 'End',
    };
    return typeMap[nodeType] || nodeType;
  };

  const handleEdit = () => navigate(`/workforms/editor/${form.id}`);
  const nodes = form.flow_data?.nodes || [];
  const nodeTypes = [...new Set(nodes.map(n => n.type))];

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Modal>
        <Header>
          <FormIcon>{form.icon || '📋'}</FormIcon>
          <HeaderContent>
            <FormTitle>{form.name}</FormTitle>
            {form.description && <FormDescription>{form.description}</FormDescription>}
            <StatusBadge $status={form.status}>{form.status}</StatusBadge>
          </HeaderContent>
          <CloseButton onClick={onClose}><X size={20} /></CloseButton>
        </Header>
        <Content>
          <InfoGrid>
            <InfoCard>
              <InfoLabel>Workflow Steps</InfoLabel>
              <InfoValue>{form.entity_count}</InfoValue>
              <InfoSubtext>{form.entity_count === 1 ? 'step' : 'steps'} configured</InfoSubtext>
            </InfoCard>
            <InfoCard>
              <InfoLabel>Last Updated</InfoLabel>
              <InfoValue style={{ fontSize: '16px' }}>{formatDate(form.updated_at)}</InfoValue>
              <InfoSubtext>Created {formatDate(form.created_at)}</InfoSubtext>
            </InfoCard>
          </InfoGrid>
          {nodeTypes.length > 0 ? (
            <Section>
              <SectionTitle>Node Types Used</SectionTitle>
              <NodeList>
                {nodeTypes.map((type) => <NodeChip key={type}>{getNodeTypeName(type)}</NodeChip>)}
              </NodeList>
            </Section>
          ) : <EmptyState>This form is empty. Click "Edit" to start building.</EmptyState>}
          <Section>
            <SectionTitle>Multi-Entity Support</SectionTitle>
            <InfoSubtext>
              {form.is_multi_entity ? 'This form supports multiple entities (e.g., multiple products, contacts, etc.)' : 'This form handles single entity submissions only'}
            </InfoSubtext>
          </Section>
        </Content>
        <Footer>
          <FooterLeft>
            <Button variant="outline" onClick={() => console.log('[FormPreview] Preview not yet implemented')}><Eye /> Preview</Button>
            <Button variant="outline" onClick={() => console.log('[FormPreview] Clone not yet implemented')}><Copy /> Clone</Button>
          </FooterLeft>
          <FooterRight>
            <Button variant="secondary" onClick={() => console.log('[FormPreview] Settings not yet implemented')}><Settings /> Settings</Button>
            <Button variant="primary" onClick={handleEdit}><Edit /> Edit</Button>
          </FooterRight>
        </Footer>
      </Modal>
    </Overlay>
  );
};
