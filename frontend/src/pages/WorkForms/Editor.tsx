/**
 * WorkForms Editor Page
 * 
 * Visual editor for creating and editing forms/workflows.
 * Phase 4.1.2: Load, edit, and save forms
 * Phase 2.2.1: Editor modes (Wizard, Visual, Expert)
 * Phase 4.2: Role-based permissions (owner/admin/manager/user/readonly)
 * 
 * Created: 2026-02-04 - Phase 2.1 Visual Editor Foundation
 * Updated: 2026-02-04 - Phase 4.1.2 Enhanced with API integration
 * Updated: 2026-02-04 - Phase 2.2.1 Added editor mode system
 * Updated: 2026-02-04 - Phase 4.2 Added permission system
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Node, Edge } from '@xyflow/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wand2, Eye, Code2, Lock, Undo2, Redo2, Download, Upload, Palette, X } from 'lucide-react';
import { UnifiedFlowEditor } from '../../components/FlowEditor';
import { FLOW_TEMPLATES } from '../../components/FlowEditor/templates/flowTemplates';
import { apiClient } from '../../services/apiService';
import { useWorkFormPermissions, canUseEditorMode, getUpgradeMessage } from '../../hooks/useWorkFormPermissions';

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

interface ThemePreset {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    surface: string;
    background: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    success: string;
    warning: string;
    error: string;
  };
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
  flex-wrap: wrap;
  gap: 12px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
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
  flex-wrap: wrap;
  
  @media (max-width: 768px) {
    width: 100%;
    justify-content: space-between;
  }
  
  @media (max-width: 640px) {
    flex-direction: column;
    align-items: stretch;
  }
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
  display: flex;
  align-items: center;
  gap: 6px;
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
  position: relative;
  
  &:hover {
    opacity: 0.9;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
  
  @media (max-width: 640px) {
    width: 100%;
    justify-content: center;
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

const UnsavedIndicator = styled.div<{ $visible: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(234, 179, 8, 0.15);
  color: rgb(234, 179, 8);
  font-size: 12px;
  font-weight: 600;
  border-radius: var(--radius-md);
  opacity: ${props => props.$visible ? 1 : 0};
  transition: opacity 0.3s ease;
  
  &::before {
    content: '●';
    font-size: 16px;
  }
`;

const AutoSaveToggle = styled.button<{ $enabled: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: ${props => props.$enabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(107, 114, 128, 0.1)'};
  color: ${props => props.$enabled ? 'rgb(34, 197, 94)' : 'rgb(107, 114, 128)'};
  border: 1px solid ${props => props.$enabled ? 'rgba(34, 197, 94, 0.3)' : 'rgba(107, 114, 128, 0.3)'};
  border-radius: var(--radius-md);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  &:hover {
    opacity: 0.8;
  }
`;

const SavingIndicator = styled.div<{ $visible: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(var(--color-primary), 0.1);
  color: rgb(var(--color-primary));
  font-size: 12px;
  font-weight: 600;
  border-radius: var(--radius-md);
  opacity: ${props => props.$visible ? 1 : 0};
  transition: opacity 0.3s ease;
  
  &::before {
    content: '';
    width: 12px;
    height: 12px;
    border: 2px solid rgb(var(--color-primary));
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const HistoryControls = styled.div`
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgb(var(--color-background));
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
`;

const HistoryButton = styled.button<{ $disabled: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  background: ${props => props.$disabled ? 'rgb(var(--color-background))' : 'rgb(var(--color-surface))'};
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  color: ${props => props.$disabled ? 'rgba(var(--color-text-secondary), 0.5)' : 'rgb(var(--color-text-primary))'};
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.15s ease;
  
  &:hover:not(:disabled) {
    background: rgb(var(--color-background));
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

const ThemePanel = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 80px;
  right: ${props => props.$isOpen ? '20px' : '-400px'};
  width: 360px;
  max-height: calc(100vh - 100px);
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  
  @media (max-width: 768px) {
    top: 0;
    right: ${props => props.$isOpen ? '0' : '-100%'};
    width: 100%;
    max-width: 100%;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }
`;

const ThemePanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
`;

const ThemePanelTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CloseButton = styled.button`
  padding: 4px;
  background: transparent;
  border: none;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
  
  &:hover {
    background: rgba(var(--color-border), 0.5);
    color: rgb(var(--color-text-primary));
  }
  
  svg {
    width: 20px;
    height: 20px;
  }
`;

const ThemePanelContent = styled.div`
  padding: 20px;
  overflow-y: auto;
  flex: 1;
`;

const ThemeSection = styled.div`
  margin-bottom: 24px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h4`
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const PresetGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;

const PresetCard = styled.button<{ $active: boolean }>`
  padding: 12px;
  background: ${props => props.$active ? 'rgba(var(--color-primary), 0.1)' : 'rgb(var(--color-background))'};
  border: 2px solid ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  
  &:hover {
    border-color: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgba(var(--color-primary), 0.5)'};
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`;

const PresetName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
`;

const PresetDescription = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.4;
`;

const PresetColors = styled.div`
  display: flex;
  gap: 4px;
  margin-top: 8px;
`;

const ColorDot = styled.div<{ $color: string }>`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: ${props => props.$color};
  border: 1px solid rgba(0, 0, 0, 0.1);
`;

const ColorPicker = styled.div`
  display: grid;
  gap: 12px;
`;

const ColorField = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const ColorLabel = styled.label`
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  flex: 1;
`;

const ColorInput = styled.input`
  width: 60px;
  height: 36px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 2px;
  
  &::-webkit-color-swatch-wrapper {
    padding: 2px;
  }
  
  &::-webkit-color-swatch {
    border: none;
    border-radius: 3px;
  }
`;

const ResetButton = styled.button`
  width: 100%;
  padding: 10px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgba(var(--color-border), 0.3);
  }
`;

const ThemeButton = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: ${props => props.$active ? 'rgba(var(--color-primary), 0.1)' : 'rgb(var(--color-surface))'};
  border: 1px solid ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
  color: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-primary))'};
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

const ModeSwitcher = styled.div`
  display: flex;
  gap: 8px;
  padding: 4px;
  background: rgb(var(--color-background));
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  
  @media (max-width: 640px) {
    width: 100%;
    justify-content: space-around;
  }
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
// Theme Presets
// ============================================================================

const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Standard light theme',
    colors: {
      primary: '#667eea',
      surface: '#ffffff',
      background: '#f8fafc',
      border: '#e2e8f0',
      textPrimary: '#2c3e50',
      textSecondary: '#64748b',
      success: '#22c55e',
      warning: '#eab308',
      error: '#ef4444',
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Dark mode theme',
    colors: {
      primary: '#818cf8',
      surface: '#1e293b',
      background: '#0f172a',
      border: '#334155',
      textPrimary: '#f1f5f9',
      textSecondary: '#94a3b8',
      success: '#22c55e',
      warning: '#eab308',
      error: '#ef4444',
    },
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    description: 'Maximum contrast for accessibility',
    colors: {
      primary: '#0066cc',
      surface: '#ffffff',
      background: '#ffffff',
      border: '#000000',
      textPrimary: '#000000',
      textSecondary: '#333333',
      success: '#008000',
      warning: '#ff8800',
      error: '#cc0000',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Cool blue tones',
    colors: {
      primary: '#0891b2',
      surface: '#f0fdfa',
      background: '#ecfeff',
      border: '#99f6e4',
      textPrimary: '#134e4a',
      textSecondary: '#0f766e',
      success: '#14b8a6',
      warning: '#f59e0b',
      error: '#dc2626',
    },
  },
];

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
  const cloneId = searchParams.get('clone'); // For cloning existing forms
  const previewMode = searchParams.get('mode') === 'preview'; // For preview mode
  
  // Phase 4.2: Permissions
  const { permissions, isLoading: permissionsLoading } = useWorkFormPermissions();
  
  // State
  const [status, setStatus] = useState<'draft' | 'active' | 'inactive'>('draft');
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const [flowName, setFlowName] = useState('New Flow');
  const [initialNodes, setInitialNodes] = useState<Node[]>([]);
  const [initialEdges, setInitialEdges] = useState<Edge[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('visual'); // Default to visual mode
  const [isCloneMode, setIsCloneMode] = useState(false); // Track if cloning
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false); // Track unsaved changes
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true); // Auto-save toggle
  
  // Undo/Redo History State
  const [history, setHistory] = useState<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoRedoing, setIsUndoRedoing] = useState(false); // Prevent recording during undo/redo
  
  // Theme State
  const [isThemePanelOpen, setIsThemePanelOpen] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState<string>('default');
  const [customColors, setCustomColors] = useState<ThemePreset['colors']>(THEME_PRESETS[0].colors);
  
  // DEBUG: Log permissions state (MUST be after state declarations)
  useEffect(() => {
    console.log('[Editor DEBUG]', {
      permissionsLoading,
      permissions,
      can_edit: permissions.can_edit,
      readOnly: !permissions.can_edit,
      willRenderEditor: isInitialized && !permissionsLoading,
      timestamp: new Date().toISOString()
    });
  }, [permissions, permissionsLoading, isInitialized]);

  // Load existing form if editing
  const { data: existingForm, isLoading: isLoadingForm } = useQuery<TenantForm>({
    queryKey: ['tenant-form', id],
    queryFn: async () => {
      console.log('[Editor] Loading form with ID:', id);
      const response = await apiClient.get(`/workflows/forms/${id}/`);
      console.log('[Editor] API Response:', response.data);
      console.log('[Editor] Flow Data:', response.data?.flow_data);
      return response.data;
    },
    enabled: !!id,
  });

  // Load form for cloning
  const { data: cloneForm, isLoading: isLoadingCloneForm } = useQuery<TenantForm>({
    queryKey: ['tenant-form-clone', cloneId],
    queryFn: async () => {
      console.log('[Editor] Loading form for cloning with ID:', cloneId);
      const response = await apiClient.get(`/workflows/forms/${cloneId}/`);
      console.log('[Editor] Clone API Response:', response.data);
      console.log('[Editor] Clone Flow Data:', response.data?.flow_data);
      return response.data;
    },
    enabled: !!cloneId,
  });

  // Handle mode switching with validation
  const handleModeSwitch = useCallback((newMode: EditorMode) => {
    // In future: Add validation and warning dialogs if switching would lose features
    // For now: Simple switch
    setEditorMode(newMode);
  }, []);

  // Initialize editor with template or existing form
  useEffect(() => {
    console.log('[Editor] Initialization check:', {
      isInitialized,
      hasCloneForm: !!cloneForm,
      cloneId,
      hasExistingForm: !!existingForm,
      id,
      templateId,
      isLoadingForm,
      isLoadingCloneForm
    });
    
    if (isInitialized) {
      console.log('[Editor] Already initialized, skipping');
      return;
    }

    // Load from cloned form
    if (cloneForm && cloneId) {
      console.log('[Editor] Setting up CLONE mode:', cloneForm);
      setFlowName(`${cloneForm.name} (Copy)`);
      setStatus('draft'); // Always start clones as draft
      setIsCloneMode(true);
      
      if (cloneForm.flow_data) {
        console.log('[Editor] Setting clone nodes/edges:', {
          nodes: cloneForm.flow_data.nodes?.length || 0,
          edges: cloneForm.flow_data.edges?.length || 0
        });
        setInitialNodes(cloneForm.flow_data.nodes || []);
        setInitialEdges(cloneForm.flow_data.edges || []);
      } else {
        console.warn('[Editor] Clone form has NO flow_data!');
      }
      
      setIsInitialized(true);
      console.log('[Editor] ✅ Initialized in CLONE mode from form:', cloneId);
      return;
    }

    // Load from existing form
    if (existingForm && id) {
      console.log('[Editor] Setting up EDIT mode:', existingForm);
      setFlowName(existingForm.name);
      setStatus(existingForm.status as 'draft' | 'active' | 'inactive');
      
      if (existingForm.flow_data) {
        console.log('[Editor] Setting existing nodes/edges:', {
          nodes: existingForm.flow_data.nodes?.length || 0,
          edges: existingForm.flow_data.edges?.length || 0
        });
        setInitialNodes(existingForm.flow_data.nodes || []);
        setInitialEdges(existingForm.flow_data.edges || []);
      } else {
        console.warn('[Editor] Existing form has NO flow_data!');
      }
      
      setIsInitialized(true);
      console.log('[Editor] ✅ Initialized in EDIT mode for form:', id);
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
    if (!id && !templateId && !cloneId) {
      setIsInitialized(true);
      console.log('[Editor] Initialized with BLANK canvas');
    }
  }, [existingForm, cloneForm, id, cloneId, templateId, isInitialized]);

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

      // Clone mode: Always create new (never update the original)
      if (isCloneMode || !id) {
        // Create new
        const response = await apiClient.post('/workflows/forms/', payload);
        return response.data;
      } else {
        // Update existing
        const response = await apiClient.put(`/workflows/forms/${id}/`, payload);
        return response.data;
      }
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh catalog
      queryClient.invalidateQueries({ queryKey: ['tenant-forms'] });
      
      // Show saved indicator
      setShowSavedIndicator(true);
      setTimeout(() => setShowSavedIndicator(false), 2000);

      // If this was a new form or clone, navigate to edit mode
      if ((!id || isCloneMode) && data.id) {
        setIsCloneMode(false); // Exit clone mode after first save
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
      setHasUnsavedChanges(false); // Clear unsaved changes flag
    } catch (error) {
      // Error handled in onError
    } finally {
      setIsSaving(false);
    }
  }, [saveMutation]);

  // Auto-save timer ref
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastNodesRef = useRef<Node[]>(initialNodes);
  const lastEdgesRef = useRef<Edge[]>(initialEdges);

  // Auto-save effect (debounced)
  useEffect(() => {
    return () => {
      // Cleanup timer on unmount
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Handle node/edge changes (triggers auto-save)
  const handleFlowChange = useCallback((nodes: Node[], edges: Edge[]) => {
    // Mark as unsaved if there are changes
    const nodesChanged = JSON.stringify(nodes) !== JSON.stringify(lastNodesRef.current);
    const edgesChanged = JSON.stringify(edges) !== JSON.stringify(lastEdgesRef.current);
    
    if (nodesChanged || edgesChanged) {
      setHasUnsavedChanges(true);
      lastNodesRef.current = nodes;
      lastEdgesRef.current = edges;

      // Trigger auto-save after 3 seconds of inactivity
      if (autoSaveEnabled && id) { // Only auto-save for existing forms
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
        
        autoSaveTimerRef.current = setTimeout(() => {
          console.log('[Editor] Auto-saving...');
          handleSave(nodes, edges);
        }, 3000); // 3 second debounce
      }
    }
  }, [autoSaveEnabled, id, handleSave]);

  // Record state in history (for undo/redo)
  const recordHistory = useCallback((nodes: Node[], edges: Edge[]) => {
    if (isUndoRedoing) return; // Don't record during undo/redo operations
    
    setHistory(prev => {
      // If we're not at the end of history, remove everything after current index
      const newHistory = prev.slice(0, historyIndex + 1);
      
      // Add new state
      newHistory.push({ nodes: [...nodes], edges: [...edges] });
      
      // Limit history to 50 entries
      if (newHistory.length > 50) {
        newHistory.shift();
        return newHistory;
      }
      
      return newHistory;
    });
    
    setHistoryIndex(prev => {
      const newIndex = Math.min(prev + 1, 49); // Max 50 entries (0-49)
      return newIndex;
    });
  }, [isUndoRedoing, historyIndex]);

  // Enhanced handleFlowChange that records history
  const handleFlowChangeWithHistory = useCallback((nodes: Node[], edges: Edge[]) => {
    // Call original flow change handler (auto-save, etc.)
    handleFlowChange(nodes, edges);
    
    // Record in history
    recordHistory(nodes, edges);
  }, [handleFlowChange, recordHistory]);

  // Undo handler
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setIsUndoRedoing(true);
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      
      const state = history[newIndex];
      setInitialNodes(state.nodes);
      setInitialEdges(state.edges);
      setHasUnsavedChanges(true);
      
      // Reset flag after state updates
      setTimeout(() => setIsUndoRedoing(false), 100);
    }
  }, [historyIndex, history]);

  // Redo handler
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setIsUndoRedoing(true);
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      
      const state = history[newIndex];
      setInitialNodes(state.nodes);
      setInitialEdges(state.edges);
      setHasUnsavedChanges(true);
      
      // Reset flag after state updates
      setTimeout(() => setIsUndoRedoing(false), 100);
    }
  }, [historyIndex, history]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z (undo)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      
      // Ctrl+Shift+Z or Cmd+Shift+Z (redo)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
      
      // Alternative: Ctrl+Y or Cmd+Y (redo)
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Initialize history with initial state
  useEffect(() => {
    if (isInitialized && initialNodes.length > 0 && history.length === 0) {
      setHistory([{ nodes: initialNodes, edges: initialEdges }]);
      setHistoryIndex(0);
    }
  }, [isInitialized, initialNodes, initialEdges, history.length]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!id) {
        throw new Error('Cannot publish unsaved form');
      }
      const response = await apiClient.patch(`/workflows/forms/${id}/`, {
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

  // Handle template export
  const handleExportTemplate = useCallback(() => {
    const template = {
      name: flowName,
      description: `Exported on ${new Date().toLocaleDateString()}`,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      nodes: initialNodes,
      edges: initialEdges,
      metadata: {
        nodeCount: initialNodes.length,
        edgeCount: initialEdges.length,
        editorMode: editorMode,
      }
    };

    // Create JSON blob and download
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${flowName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_template.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert('Template exported successfully!');
  }, [flowName, initialNodes, initialEdges, editorMode]);

  // Handle template import
  const handleImportTemplate = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event: any) => {
        try {
          const template = JSON.parse(event.target.result);
          
          // Validate template structure
          if (!template.nodes || !template.edges) {
            throw new Error('Invalid template format: missing nodes or edges');
          }

          // Apply template
          setFlowName(template.name || 'Imported Template');
          setInitialNodes(template.nodes);
          setInitialEdges(template.edges);
          setIsInitialized(true);
          
          // Clear history and start fresh
          setHistory([{ nodes: template.nodes, edges: template.edges }]);
          setHistoryIndex(0);
          setHasUnsavedChanges(true);

          alert(`Template "${template.name}" imported successfully!`);
        } catch (error: any) {
          console.error('Error importing template:', error);
          alert(`Failed to import template: ${error.message}`);
        }
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  }, []);

  // Theme Handlers
  const handleThemeChange = useCallback((themeId: string) => {
    const theme = THEME_PRESETS.find(t => t.id === themeId);
    if (!theme) return;
    
    setActiveThemeId(themeId);
    setCustomColors(theme.colors);
    applyTheme(theme.colors);
  }, []);

  const handleCustomColorChange = useCallback((colorKey: keyof ThemePreset['colors'], value: string) => {
    const newColors = { ...customColors, [colorKey]: value };
    setCustomColors(newColors);
    applyTheme(newColors);
    setActiveThemeId('custom'); // Mark as custom theme
  }, [customColors]);

  const applyTheme = useCallback((colors: ThemePreset['colors']) => {
    const root = document.documentElement;
    
    // Convert hex to RGB for CSS variables
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : '0, 0, 0';
    };
    
    root.style.setProperty('--color-primary', hexToRgb(colors.primary));
    root.style.setProperty('--color-surface', hexToRgb(colors.surface));
    root.style.setProperty('--color-background', hexToRgb(colors.background));
    root.style.setProperty('--color-border', hexToRgb(colors.border));
    root.style.setProperty('--color-text-primary', hexToRgb(colors.textPrimary));
    root.style.setProperty('--color-text-secondary', hexToRgb(colors.textSecondary));
  }, []);

  const handleResetTheme = useCallback(() => {
    handleThemeChange('default');
  }, [handleThemeChange]);

  // Apply default theme on mount
  useEffect(() => {
    const defaultTheme = THEME_PRESETS[0];
    applyTheme(defaultTheme.colors);
  }, [applyTheme]);

  // Focus management for theme panel (accessibility)
  useEffect(() => {
    if (isThemePanelOpen) {
      // Auto-focus first interactive element when panel opens
      const panelElement = document.querySelector('[data-theme-panel]');
      const firstButton = panelElement?.querySelector('button');
      if (firstButton) {
        setTimeout(() => {
          (firstButton as HTMLElement).focus();
        }, 100); // Small delay for animation
      }
    }
  }, [isThemePanelOpen]);

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
          {/* Editor Mode Switcher - Phase 4.2: Permission-aware */}
          <ModeSwitcher>
            {Object.values(EDITOR_MODES).map((mode) => {
              const Icon = mode.icon;
              const isAllowed = canUseEditorMode(permissions, mode.id);
              const isDisabled = !isAllowed || permissionsLoading;
              
              return (
                <ModeButton
                  key={mode.id}
                  $active={editorMode === mode.id}
                  onClick={() => isAllowed && handleModeSwitch(mode.id)}
                  title={isAllowed ? mode.description : getUpgradeMessage('expert_mode', permissions.role)}
                  disabled={isDisabled}
                  style={isDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  {!isAllowed && <Lock style={{ width: 12, height: 12, marginRight: 4 }} />}
                  <Icon />
                  <span>{mode.label}</span>
                </ModeButton>
              );
            })}
          </ModeSwitcher>
          
          {/* Undo/Redo Controls */}
          <HistoryControls>
            <HistoryButton
              $disabled={historyIndex <= 0}
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title={`Undo (Ctrl+Z) - ${historyIndex} actions available`}
            >
              <Undo2 />
            </HistoryButton>
            <HistoryButton
              $disabled={historyIndex >= history.length - 1}
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title={`Redo (Ctrl+Shift+Z) - ${history.length - historyIndex - 1} actions available`}
            >
              <Redo2 />
            </HistoryButton>
          </HistoryControls>
          
          {/* Auto-save toggle */}
          {id && (
            <AutoSaveToggle 
              $enabled={autoSaveEnabled}
              onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
              title={autoSaveEnabled ? 'Auto-save enabled (saves after 3s of inactivity)' : 'Auto-save disabled (manual save only)'}
            >
              {autoSaveEnabled ? '✓ Auto-Save' : 'Manual Save'}
            </AutoSaveToggle>
          )}
          
          {/* Saving indicator */}
          <SavingIndicator $visible={isSaving}>
            Saving...
          </SavingIndicator>
          
          {/* Saved indicator */}
          <SaveIndicator $visible={showSavedIndicator}>
            ✓ Saved
          </SaveIndicator>
          
          {/* Unsaved changes indicator */}
          <UnsavedIndicator $visible={hasUnsavedChanges && !isSaving}>
            Unsaved
          </UnsavedIndicator>
          
          <StatusBadge $status={status}>
            {status === 'active' ? 'Active' : status === 'draft' ? 'Draft' : 'Inactive'}
          </StatusBadge>
          
          {/* Template Export/Import */}
          <ActionButton $variant="secondary" onClick={handleExportTemplate} title="Export as template">
            <Download style={{ width: 16, height: 16 }} />
            Export
          </ActionButton>
          
          <ActionButton $variant="secondary" onClick={handleImportTemplate} title="Import template">
            <Upload style={{ width: 16, height: 16 }} />
            Import
          </ActionButton>
          
          {/* Theme Toggle */}
          <ThemeButton 
            $active={isThemePanelOpen}
            onClick={() => setIsThemePanelOpen(!isThemePanelOpen)}
            title="Customize theme"
          >
            <Palette />
            Theme
          </ThemeButton>
          
          <ActionButton $variant="secondary">
            Preview
          </ActionButton>
          
          {/* Publish button - Phase 4.2: Only for admin/owner */}
          <ActionButton 
            $variant="primary" 
            onClick={handlePublish}
            disabled={!permissions.can_publish || status === 'active' || !id || publishMutation.isPending || permissionsLoading}
            title={!permissions.can_publish ? getUpgradeMessage('publish', permissions.role) : ''}
          >
            {publishMutation.isPending ? 'Publishing...' : status === 'active' ? 'Published' : 'Publish'}
          </ActionButton>
        </HeaderRight>
      </PageHeader>

      <EditorWrapper>
        {isInitialized && !permissionsLoading && (
          <UnifiedFlowEditor
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            onSave={handleSave}
            onChange={handleFlowChangeWithHistory}
            editorMode={editorMode}
            readOnly={previewMode || !permissions.can_edit}
            allowedNodeCategories={permissions.allowed_node_categories}
          />
        )}
        {permissionsLoading && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '400px',
            color: 'rgb(var(--color-text-secondary))'
          }}>
            Loading permissions...
          </div>
        )}
      </EditorWrapper>

      {/* Theme Customization Panel */}
      <ThemePanel $isOpen={isThemePanelOpen} data-theme-panel role="dialog" aria-label="Theme customization">
        <ThemePanelHeader>
          <ThemePanelTitle>
            <Palette aria-hidden="true" />
            Theme Customization
          </ThemePanelTitle>
          <CloseButton 
            onClick={() => setIsThemePanelOpen(false)}
            aria-label="Close theme panel"
          >
            <X aria-hidden="true" />
          </CloseButton>
        </ThemePanelHeader>
        
        <ThemePanelContent>
          <ThemeSection>
            <SectionTitle>Presets</SectionTitle>
            <PresetGrid>
              {THEME_PRESETS.map((preset) => (
                <PresetCard
                  key={preset.id}
                  $active={activeThemeId === preset.id}
                  onClick={() => handleThemeChange(preset.id)}
                >
                  <PresetName>{preset.name}</PresetName>
                  <PresetDescription>{preset.description}</PresetDescription>
                  <PresetColors>
                    <ColorDot $color={preset.colors.primary} title="Primary" />
                    <ColorDot $color={preset.colors.surface} title="Surface" />
                    <ColorDot $color={preset.colors.background} title="Background" />
                  </PresetColors>
                </PresetCard>
              ))}
            </PresetGrid>
          </ThemeSection>
          
          <ThemeSection>
            <SectionTitle>Custom Colors</SectionTitle>
            <ColorPicker>
              <ColorField>
                <ColorLabel htmlFor="color-primary">Primary Color</ColorLabel>
                <ColorInput
                  id="color-primary"
                  type="color"
                  value={customColors.primary}
                  onChange={(e) => handleCustomColorChange('primary', e.target.value)}
                />
              </ColorField>
              
              <ColorField>
                <ColorLabel htmlFor="color-surface">Surface</ColorLabel>
                <ColorInput
                  id="color-surface"
                  type="color"
                  value={customColors.surface}
                  onChange={(e) => handleCustomColorChange('surface', e.target.value)}
                />
              </ColorField>
              
              <ColorField>
                <ColorLabel htmlFor="color-background">Background</ColorLabel>
                <ColorInput
                  id="color-background"
                  type="color"
                  value={customColors.background}
                  onChange={(e) => handleCustomColorChange('background', e.target.value)}
                />
              </ColorField>
              
              <ColorField>
                <ColorLabel htmlFor="color-border">Border</ColorLabel>
                <ColorInput
                  id="color-border"
                  type="color"
                  value={customColors.border}
                  onChange={(e) => handleCustomColorChange('border', e.target.value)}
                />
              </ColorField>
              
              <ColorField>
                <ColorLabel htmlFor="color-text-primary">Text Primary</ColorLabel>
                <ColorInput
                  id="color-text-primary"
                  type="color"
                  value={customColors.textPrimary}
                  onChange={(e) => handleCustomColorChange('textPrimary', e.target.value)}
                />
              </ColorField>
              
              <ColorField>
                <ColorLabel htmlFor="color-text-secondary">Text Secondary</ColorLabel>
                <ColorInput
                  id="color-text-secondary"
                  type="color"
                  value={customColors.textSecondary}
                  onChange={(e) => handleCustomColorChange('textSecondary', e.target.value)}
                />
              </ColorField>
            </ColorPicker>
          </ThemeSection>
          
          <ThemeSection>
            <ResetButton onClick={handleResetTheme}>
              Reset to Default Theme
            </ResetButton>
          </ThemeSection>
        </ThemePanelContent>
      </ThemePanel>
    </PageContainer>
  );
};

export default WorkFormsEditor;
