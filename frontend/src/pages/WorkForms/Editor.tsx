/**
 * WorkForms Editor Page
 * 
 * Visual editor for creating and editing forms/workflows.
 * Phase 4.1.2: Load, edit, and save forms
 * Phase 2.2.1: Editor modes (Wizard, Visual, Expert)
 * 
 * Created: 2026-02-04 - Phase 2.1 Visual Editor Foundation
 * Updated: 2026-02-04 - Phase 4.1.2 Enhanced with API integration
 * Updated: 2026-02-04 - Phase 2.2.1 Added editor mode system
 */
import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Node, Edge } from '@xyflow/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wand2, Eye, Code2 } from 'lucide-react';
import { UnifiedFlowEditor } from '../../components/FlowEditor';
import { FLOW_TEMPLATES } from '../../components/FlowEditor/templates/flowTemplates';
import { adminClient } from '../../services/apiService';

// ============================================================================
// Types
// ============================================================================

export type EditorMode = 'wizard' | 'visual' | 'expert';

interface EditorModeConfig {
  id: EditorMode;
  label: string;
  icon: React.ComponentType<any>;
  description: string;
  targetUser: string;
  availableNodeTypes: string[];
  features: string[];
}

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

const ModeSwitcher = styled.div`
  display: flex;
  gap: 8px;
  padding: 4px;
  background: rgb(var(--color-background));
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
`;

const ModeButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: ${props => props.$active ? 'rgb(var(--color-primary))' : 'transparent'};
  color: ${props => props.$active ? 'white' : 'rgb(var(--color-text-secondary))'};
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  
  svg {
    width: 16px;
    height: 16px;
  }
  
  &:hover {
    background: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgba(var(--color-primary), 0.1)'};
    color: ${props => props.$active ? 'white' : 'rgb(var(--color-primary))'};
  }
`;

const ModeIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(var(--color-primary), 0.1);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: rgb(var(--color-primary));
  
  svg {
    width: 14px;
    height: 14px;
  }
`;

// ============================================================================
// Editor Mode Configuration
// ============================================================================

const EDITOR_MODES: Record<EditorMode, EditorModeConfig> = {
  wizard: {
    id: 'wizard',
    label: 'Wizard',
    icon: Wand2,
    description: 'Guided, one-step-at-a-time form building (Typeform-style)',
    targetUser: 'Business users, first-time creators',
    availableNodeTypes: ['formStep', 'formField', 'conditionIf', 'actionEmail', 'endSuccess'],
    features: ['guided-setup', 'templates-only', 'auto-connections', 'step-by-step'],
  },
  visual: {
    id: 'visual',
    label: 'Visual',
    icon: Eye,
    description: 'Full drag-drop canvas with visual workflow builder (Make/n8n-style)',
    targetUser: 'Power users, process owners',
    availableNodeTypes: ['*'], // Most nodes
    features: ['drag-drop', 'custom-connections', 'basic-conditions', 'templates'],
  },
  expert: {
    id: 'expert',
    label: 'Expert',
    icon: Code2,
    description: 'Full control with code expressions and API integrations (Salesforce Flow-style)',
    targetUser: 'Developers, automation specialists',
    availableNodeTypes: ['*'], // All nodes
    features: ['code-expressions', 'api-integrations', 'custom-scripts', 'subflows', 'advanced-logic'],
  },
};

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface TenantForm {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'inactive';
  icon: string;
  entity_count: number;
  is_multi_entity: boolean;
  flow_data?: {
    nodes: Node[];
    edges: Edge[];
  };
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Component
// ============================================================================

export const WorkFormsEditor: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template');
  
  // State
  const [status, setStatus] = useState<'draft' | 'active' | 'inactive'>('draft');
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const [flowName, setFlowName] = useState('New Flow');
  const [initialNodes, setInitialNodes] = useState<Node[]>([]);
  const [initialEdges, setInitialEdges] = useState<Edge[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('visual'); // Default to visual mode

  // Load existing form if editing
  const { data: existingForm, isLoading: isLoadingForm } = useQuery<TenantForm>({
    queryKey: ['tenant-form', id],
    queryFn: async () => {
      const response = await adminClient.get(`/admin/workflows/forms/${id}/`);
      return response.data;
    },
    enabled: !!id,
  });

  // Handle mode switching with validation
  const handleModeSwitch = useCallback((newMode: EditorMode) => {
    // In future: Add validation and warning dialogs if switching would lose features
    // For now: Simple switch
    setEditorMode(newMode);
  }, []);

  // Initialize editor with template or existing form
  useEffect(() => {
    if (isInitialized) return;

    // Load from existing form
    if (existingForm && id) {
      setFlowName(existingForm.name);
      setStatus(existingForm.status as 'draft' | 'active' | 'inactive');
      
      if (existingForm.flow_data) {
        setInitialNodes(existingForm.flow_data.nodes || []);
        setInitialEdges(existingForm.flow_data.edges || []);
      }
      
      setIsInitialized(true);
      return;
    }

    // Load from template
    if (templateId && !id) {
      const template = FLOW_TEMPLATES.find(t => t.id === templateId);
      if (template) {
        setFlowName(template.name);
        setInitialNodes(template.nodes);
        setInitialEdges(template.edges);
        setIsInitialized(true);
        return;
      }
    }

    // Blank canvas
    if (!id && !templateId) {
      setIsInitialized(true);
    }
  }, [existingForm, id, templateId, isInitialized]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { nodes: Node[]; edges: Edge[] }) => {
      const payload = {
        name: flowName,
        description: `Flow with ${data.nodes.length} nodes`,
        status: status,
        flow_data: {
          nodes: data.nodes,
          edges: data.edges,
        },
      };

      if (id) {
        // Update existing
        const response = await adminClient.put(`/admin/workflows/forms/${id}/`, payload);
        return response.data;
      } else {
        // Create new
        const response = await adminClient.post('/admin/workflows/forms/', payload);
        return response.data;
      }
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh catalog
      queryClient.invalidateQueries({ queryKey: ['tenant-forms'] });
      
      // Show saved indicator
      setShowSavedIndicator(true);
      setTimeout(() => setShowSavedIndicator(false), 2000);

      // If this was a new form, navigate to edit mode
      if (!id && data.id) {
        navigate(`/workforms/editor/${data.id}`, { replace: true });
      }
    },
    onError: (error: any) => {
      console.error('Error saving flow:', error);
      alert(error.response?.data?.error || 'Failed to save. Please try again.');
    },
  });

  // Handle save
  const handleSave = useCallback(async (nodes: Node[], edges: Edge[]) => {
    setIsSaving(true);
    
    try {
      await saveMutation.mutateAsync({ nodes, edges });
    } catch (error) {
      // Error handled in onError
    } finally {
      setIsSaving(false);
    }
  }, [saveMutation]);

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!id) {
        throw new Error('Cannot publish unsaved form');
      }
      const response = await adminClient.patch(`/admin/workflows/forms/${id}/`, {
        status: 'active',
      });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate queries to refresh catalog
      queryClient.invalidateQueries({ queryKey: ['tenant-forms'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-form', id] });
      
      setStatus('active');
      alert('Form published successfully!');
    },
    onError: (error: any) => {
      console.error('Error publishing flow:', error);
      alert(error.response?.data?.error || 'Failed to publish. Please try again.');
    },
  });

  // Handle publish
  const handlePublish = useCallback(() => {
    if (!id) {
      alert('Please save the form before publishing');
      return;
    }
    publishMutation.mutate();
  }, [id, publishMutation]);

  // Handle back
  const handleBack = useCallback(() => {
    navigate('/workforms/catalog');
  }, [navigate]);

  // Show loading state
  if (id && isLoadingForm) {
    return (
      <PageContainer>
        <div style={{ textAlign: 'center', padding: '4rem', color: 'rgb(var(--color-text-secondary))' }}>
          Loading form...
        </div>
      </PageContainer>
    );
  }

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
          {/* Editor Mode Switcher */}
          <ModeSwitcher>
            {Object.values(EDITOR_MODES).map((mode) => {
              const Icon = mode.icon;
              return (
                <ModeButton
                  key={mode.id}
                  $active={editorMode === mode.id}
                  onClick={() => handleModeSwitch(mode.id)}
                  title={mode.description}
                >
                  <Icon />
                  <span>{mode.label}</span>
                </ModeButton>
              );
            })}
          </ModeSwitcher>
          
          <SaveIndicator $visible={showSavedIndicator}>
            ✓ Saved
          </SaveIndicator>
          
          <StatusBadge $status={status}>
            {status === 'active' ? 'Active' : status === 'draft' ? 'Draft' : 'Inactive'}
          </StatusBadge>
          
          <ActionButton $variant="secondary">
            Preview
          </ActionButton>
          
          <ActionButton 
            $variant="primary" 
            onClick={handlePublish}
            disabled={status === 'active' || !id || publishMutation.isPending}
          >
            {publishMutation.isPending ? 'Publishing...' : status === 'active' ? 'Published' : 'Publish'}
          </ActionButton>
        </HeaderRight>
      </PageHeader>

      <EditorWrapper>
        {isInitialized && (
          <UnifiedFlowEditor
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            onSave={handleSave}
            editorMode={editorMode}
          />
        )}
      </EditorWrapper>
    </PageContainer>
  );
};

export default WorkFormsEditor;
