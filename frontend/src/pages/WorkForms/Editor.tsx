/**
 * WorkForms Editor Page
 * 
 * Visual editor for creating and editing forms/workflows.
 * Uses the UnifiedFlowEditor component.
 * 
 * Created: 2026-02-04 - Phase 2.1 Visual Editor Foundation
 */
import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';
import { Node, Edge } from '@xyflow/react';
import { UnifiedFlowEditor } from '../../components/FlowEditor';

// ============================================================================
// Styled Components
// ============================================================================

const PageContainer = styled.div`
  padding: 20px;
  min-height: calc(100vh - 60px);
`;

const PageHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const BackButton = styled.button`
  padding: 8px 12px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgb(var(--color-background));
  }
`;

const PageTitle = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const StatusBadge = styled.span<{ $status: string }>`
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  background: ${props => {
    switch (props.$status) {
      case 'published': return 'rgba(34, 197, 94, 0.2)';
      case 'draft': return 'rgba(234, 179, 8, 0.2)';
      default: return 'rgba(148, 163, 184, 0.2)';
    }
  }};
  color: ${props => {
    switch (props.$status) {
      case 'published': return 'rgb(34, 197, 94)';
      case 'draft': return 'rgb(234, 179, 8)';
      default: return 'rgb(148, 163, 184)';
    }
  }};
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  padding: 8px 16px;
  background: ${props => 
    props.$variant === 'primary' 
      ? 'rgb(var(--color-primary))' 
      : 'rgb(var(--color-surface))'};
  border: 1px solid ${props => 
    props.$variant === 'primary' 
      ? 'rgb(var(--color-primary))' 
      : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
  color: ${props => 
    props.$variant === 'primary' 
      ? 'white' 
      : 'rgb(var(--color-text-primary))'};
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    opacity: 0.9;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EditorWrapper = styled.div`
  background: rgb(var(--color-surface));
  border-radius: var(--radius-lg);
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
`;

const SaveIndicator = styled.div<{ $visible: boolean }>`
  padding: 8px 16px;
  background: rgba(34, 197, 94, 0.9);
  color: white;
  font-size: 13px;
  font-weight: 600;
  border-radius: var(--radius-md);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  opacity: ${props => props.$visible ? 1 : 0};
  transition: opacity 0.3s ease;
`;

// ============================================================================
// Component
// ============================================================================

export const WorkFormsEditor: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  
  // State
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const [flowName, setFlowName] = useState(id ? 'Existing Flow' : 'New Flow');

  // For now, start with empty canvas (we'll add loading from API later)
  const [initialNodes] = useState<Node[]>([]);
  const [initialEdges] = useState<Edge[]>([]);

  // Handle save
  const handleSave = useCallback(async (nodes: Node[], edges: Edge[]) => {
    setIsSaving(true);
    
    try {
      // TODO: Call API to save flow
      console.log('Saving flow:', { nodes, edges });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Show saved indicator
      setShowSavedIndicator(true);
      setTimeout(() => setShowSavedIndicator(false), 2000);
      
      // TODO: Handle response and update state
    } catch (error) {
      console.error('Error saving flow:', error);
      // TODO: Show error notification
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Handle publish
  const handlePublish = useCallback(() => {
    setStatus('published');
    // TODO: Call API to publish flow
  }, []);

  // Handle back
  const handleBack = useCallback(() => {
    navigate('/workforms/catalog');
  }, [navigate]);

  return (
    <PageContainer>
      <PageHeader>
        <HeaderLeft>
          <BackButton onClick={handleBack}>
            ← Back
          </BackButton>
          <div>
            <PageTitle>{flowName}</PageTitle>
          </div>
        </HeaderLeft>
        
        <HeaderRight>
          <SaveIndicator $visible={showSavedIndicator}>
            ✓ Saved
          </SaveIndicator>
          
          <StatusBadge $status={status}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </StatusBadge>
          
          <ActionButton $variant="secondary">
            Preview
          </ActionButton>
          
          <ActionButton 
            $variant="primary" 
            onClick={handlePublish}
            disabled={status === 'published'}
          >
            {status === 'published' ? 'Published' : 'Publish'}
          </ActionButton>
        </HeaderRight>
      </PageHeader>

      <EditorWrapper>
        <UnifiedFlowEditor
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          onSave={handleSave}
        />
      </EditorWrapper>
    </PageContainer>
  );
};

export default WorkFormsEditor;
