/**
 * Unified Flow Editor Component
 * 
 * Single visual editor combining Forms + Workflows.
 * Industry-best UX inspired by Make/n8n/Zapier/Typeform.
 * 
 * Features:
 * - Node-based graph editor using React Flow
 * - 30+ node types (triggers, forms, logic, actions, waits, documents)
 * - Drag-and-drop from node palette
 * - Visual debugging with error routes
 * - Smooth zoom/pan with minimap
 * - Connection validation
 * - Undo/redo history
 * - Keyboard shortcuts
 * 
 * React Flow Best Practices Applied (2026-02-21):
 * ✅ All node components wrapped in React.memo for performance
 * ✅ All edge components wrapped in React.memo
 * ✅ nodeTypes and staticEdgeTypes objects are static (no useMemo needed for constants)
 * ✅ All callbacks use useCallback with correct dependencies
 * ✅ ARIA labels on all Handle components for accessibility
 * ✅ Snap-to-grid enabled (15x15 grid) for smooth dragging
 * ✅ TypeScript strict typing with NodeProps<T> for all nodes
 * 
 * Created: 2026-02-04 - Phase 2.1 Visual Editor Foundation
 * Updated: 2026-02-04 - Phase 2.1 Batch 2 (Added Wait, Document, Utility, Terminal nodes)
 * Updated: 2026-02-04 - Phase 2.1 Batch 3 (Enhanced palette, keyboard shortcuts, undo/redo)
 * Updated: 2026-02-21 - Applied React Flow best practices + consolidated duplicates
 */
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { debounce } from 'lodash';
import { showAlert } from '@/utils/uiDialogs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminClient } from '../../services/apiService';
import toast, { Toaster } from 'react-hot-toast'; // Phase 8.1
import * as Sentry from '@sentry/react'; // Error tracking
import { logger } from '../../utils/logger'; // Centralized logging
import { isTypingInInput } from './utils/keyboardUtils'; // Phase 4
import { Joyride } from 'react-joyride'; // Gap Analysis Phase 1.1
import { useRenderPerformance } from '../../utils/performance'; // Phase 7.5
import { 
  useOnboardingTour,
  workflowEditorTourSteps,
  tourOptions,
  tourStyles,
} from './hooks/useOnboardingTour'; // Gap Analysis Phase 1.1
import {
  ReactFlow,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  ReactFlowProvider,
  NodeTypes,
  EdgeTypes,
  OnSelectionChangeParams,
  useReactFlow,
  MarkerType,
  ConnectionLineType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './UnifiedFlowEditor.responsive.css'; // Gap Analysis Phase 1.2
import { 
  Star, 
  Search as SearchIcon, 
  ChevronDown, 
  Undo2, 
  Redo2, 
  Maximize2, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  Wand2, 
  Eye, 
  Bug,
 
  Download, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Copy, 
  ArrowRight, 
  Sparkles, 
  Plus,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignEndVertical,
  AlignCenterHorizontal,
  AlignCenterVertical,
  X,
  Save,
  FolderOpen,
  Trash2, // Phase 8.3
  HelpCircle, // Workform Editor Enhancements
  Play, // Task 1: Workflow Execution
  Map as MapIcon, // Sprint 1 Task 1.3: Minimap toggle
  Settings, // Sprint 1 Task 1.4: Background & Grid settings
} from 'lucide-react';

import {
  FormNode,
  FormProcessNode,
  FormProcessContainerNode,
  FormStepNode,
  FormStepSingleNode,
  FormReferenceNode,
  SmartWorkFormNode,
  TriggerNode,
  ConditionIfNode,
  ActionNode,
  WaitStateNode,
  DocumentNode,
  UtilityNode,
  TerminalNode,
  LoopNode,
} from './nodes';
import { CustomEdge, ConditionalEdge, ErrorEdge, SuccessEdge, InsertNodeEdge, EnhancedConnectionEdge } from './edges';
import { FormBuilder } from '../form-builder';
import { useFormBuilder } from './hooks/useFormBuilder';
import { ValidationDrawer } from './components/ValidationDrawer';
import { AISuggestionsPanel } from './components/AISuggestionsPanel';
import { validateWorkflow, type ValidationResult } from './utils/validationEngine';
import { NODE_TYPE_REGISTRY, NodeCategory, CATEGORY_LABELS, CATEGORY_ORDER, getNodeTypeDefinition } from './nodeTypes';
import type { FormStepData } from './Modals/EntityFormStepModal';
import { schemaRegistry } from './config/schemaRegistry';
import { calculateContainerLayout, autoConnectSequentialSteps, LAYOUT_CONSTANTS } from './utils/containerLayout'; // Phase 3-4
import { NodeContextMenu, useContextMenu } from './NodeContextMenu'; // Phase E.3
import { EnhancedContextMenu, useEnhancedContextMenu } from './components/EnhancedContextMenu'; // Phase 2: UI/UX
import { saveWorkflow, loadWorkflow, listWorkflows, deleteWorkflow, type WorkflowListItem } from './utils/workflowPersistence'; // Phase 7, 8.3
import { workformsApi } from '../../services/workformsApi'; // Task 2: Ghost Node Deletion
import { sortNodesTopologically } from './utils/nodeSorting'; // Phase 2 Critical Fix
import { normalizeNodeData, normalizeNodes } from './utils/nodeNormalization'; // Fix test imports
import {
  NodeConfigPanelWithShadow,
  TabbedConfigPanelWithShadow,
  FormStepConfigPanel,
  FormFieldConfigPanel,
} from './ConfigPanel';
import { getLayoutedElements, alignNodesHorizontally, alignNodesVertically, distributeNodesHorizontally, distributeNodesVertically } from './utils/autoLayout'; // Phase 2: UI/UX
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'; // Phase 2: UI/UX
import { useCollaboration } from './hooks/useCollaboration'; // Phase 9.2
import { getCurrentTenant } from '../../config/runtime';

// FormBuilder Context Provider (2026-02-21 Comprehensive Enhancements)
import { FormBuilderProvider } from '../../contexts/FormBuilderContext';

// FlowEditor Context Provider (Phase E.1)
import { FlowEditorProvider, useFlowEditor } from './context';

// Error Boundary (2026-02-21 Comprehensive Enhancements)
import { ErrorBoundary } from './ErrorBoundary';
// NUCLEAR CLEANUP: All hardcoded panels removed - DynamicConfigPanel is now the ONLY renderer
// import { SectionConfigPanel } from './ConfigPanel/SectionConfigPanel';
// import { DocumentConfigPanel } from './ConfigPanel/DocumentConfigPanel';
// import { CreateRecordConfigPanel } from './ConfigPanel/CreateRecordConfigPanel';
// import { FormReferenceConfigPanel } from './ConfigPanel/FormReferenceConfigPanel';
import Fuse from 'fuse.js'; // PROMPT 2: Added fuzzy search
import { HelpModal } from './HelpModal'; // Workform Editor Enhancements
import { TemplateSelector } from './templates/TemplateSelector';
import { FlowTemplate, FLOW_TEMPLATES } from './templates/flowTemplates';
import { SidePanel } from './SidePanel';
import { FormProcessModal, type ContainerData } from './Modals/FormProcessModal';
import { WorkflowManagementModal, type WorkflowMetadata } from './Modals/WorkflowManagementModal'; // Phase 8.2
import { WorkflowExecutionModal } from '../FormSubmission/WorkflowExecutionModal'; // Task 1: Integration
import { PreviewPanel } from './panels/PreviewPanel';
import { DryRunDebuggerPanel } from './panels/DryRunDebuggerPanel';
import { FlowPreviewModal } from './Modals/FlowPreviewModal'; // Phase 1: Hybrid Functionality
import { DataMappingPanel } from './ConfigPanel/DataMappingPanel'; // Phase 1: Hybrid Functionality

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export type EditorMode = 'wizard' | 'visual' | 'expert'; // 'expert' is deprecated (JSON editor removed)

interface UnifiedFlowEditorProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  /** Optional initial viewport (e.g., loaded workflow_definition.viewport) */
  initialViewport?: { x: number; y: number; zoom: number };

  /**
   * Legacy callback (deprecated): saving is now handled internally via tenant-workforms persistence.
   */
  onSave?: (nodes: Node[], edges: Edge[]) => void;

  onChange?: (nodes: Node[], edges: Edge[]) => void; // Track changes for auto-save

  /**
   * Optional initial workflow metadata (used when embedding the editor in a route-driven page).
   */
  initialWorkflowId?: string;
  initialWorkflowName?: string;
  initialWorkflowDescription?: string;
  initialWorkflowStatus?: 'draft' | 'active' | 'archived';
  onWorkflowSaved?: (workflow: { id: string; name: string; status?: 'draft' | 'active' | 'archived' }) => void;

  readOnly?: boolean;
  editorMode?: EditorMode;
  allowedNodeCategories?: string[]; // Phase 4.2: Filter nodes by permission
}

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

interface FavoritesState {
  nodeTypeIds: string[];
  lastUsed: string[];
}

// ⚠️ PROMPT 2: Nuclear Cleanup Complete - Enable Full Dynamic Mode
const ENABLE_FULL_DYNAMIC_MODE = true;

// ============================================================================
// Styled Components
// ============================================================================

const EditorContainer = styled.div<{ $isFullscreen?: boolean }>`
  width: 100%;
  height: ${(props) => (props.$isFullscreen ? '100vh' : '100%')};
  min-height: ${(props) => (props.$isFullscreen ? '100vh' : '640px')};

  position: ${(props) => (props.$isFullscreen ? 'fixed' : 'relative')};
  top: ${(props) => (props.$isFullscreen ? '0' : 'auto')};
  left: ${(props) => (props.$isFullscreen ? '0' : 'auto')};
  right: ${(props) => (props.$isFullscreen ? '0' : 'auto')};
  bottom: ${(props) => (props.$isFullscreen ? '0' : 'auto')};
  z-index: ${(props) => (props.$isFullscreen ? '9990' : 'auto')};

  overflow: hidden; /* Prevent page scroll / blank bottom space */
  background: rgb(var(--color-bg-layout));
  display: flex;
  flex-direction: column;

  border: ${(props) => (props.$isFullscreen ? 'none' : '1px solid rgb(var(--color-border))')};
  border-radius: ${(props) => (props.$isFullscreen ? '0' : 'var(--radius-lg)')};
  
  /* Phase 7.2: Smart Snapping - Connection Line Animation */
  @keyframes dash {
    to {
      stroke-dashoffset: -10;
    }
  }
  
  /* Phase 7.2: Smart Snapping - Visual Connection Indicators */
  .react-flow__connection-path {
    stroke: rgb(var(--color-primary)) !important;
    stroke-width: 3 !important;
    stroke-dasharray: 5, 5;
    animation: dash 0.5s linear infinite;
    filter: drop-shadow(0 0 4px rgba(102, 126, 234, 0.4));
  }
  
  /* Phase 7.2: Enhanced snap feedback */
  .react-flow__node.dragging {
    box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3) !important;
    transform: scale(1.02);
    transition: none !important; /* Override smooth animation during drag */
  }
  
  /* Phase 7.2: Grid alignment indicator */
  .react-flow__node.snapped {
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.5) !important;
  }
  
  /* Phase 8.4: Smooth animations for node layout changes */
  .react-flow__node {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                opacity 0.2s ease;
  }
  
  .react-flow__edge {
    transition: opacity 0.2s ease;
  }
  
  /* Animate container expand/collapse */
  .react-flow__node[data-type="formMultiStepContainer"],
  .react-flow__node[data-type="formProcess"],
  .react-flow__node[data-type="formProcessGroup"],
  .react-flow__node[data-type="formBook"] {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                width 0.3s ease,
                height 0.3s ease,
                opacity 0.2s ease;
  }
`;

// ============================================================================
// Right Sidebar for Config Panel (Phase E)
// ============================================================================

const RightSidebar = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 400px;
  background: rgb(var(--color-surface));
  border-left: 1px solid rgb(var(--color-border));
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  z-index: 10000;
  display: ${props => props.$isOpen ? 'flex' : 'none'} !important;
  opacity: ${props => props.$isOpen ? '1' : '0'} !important;
  visibility: ${props => props.$isOpen ? 'visible' : 'hidden'} !important;
  transform: translateX(${props => props.$isOpen ? '0' : '100%'});
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
  flex-direction: column;
  overflow: hidden;
  pointer-events: ${props => props.$isOpen ? 'auto' : 'none'};
`;

// ============================================================================
// Deprecation Banner Components (Phase 6.1)
// ============================================================================

const DeprecationBanner = styled.div`
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  width: calc(100% - 40px);
  max-width: 800px;
  background: rgb(255, 243, 205);
  border: 1px solid rgb(234, 179, 8);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideDown 0.3s ease-out;
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
`;

const BannerIcon = styled.div`
  flex-shrink: 0;
  color: rgb(234, 179, 8);
  display: flex;
  align-items: center;
`;

const BannerContent = styled.div`
  flex: 1;
`;

const BannerTitle = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: rgb(120, 53, 15);
  margin-bottom: 4px;
`;

const BannerMessage = styled.div`
  font-size: 13px;
  color: rgb(146, 64, 14);
  line-height: 1.4;
`;

const BannerActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const MigrateButton = styled.button`
  padding: 6px 12px;
  background: rgb(234, 179, 8);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  
  &:hover {
    background: rgb(202, 138, 4);
  }
`;

const CloseButton = styled.button`
  padding: 4px;
  background: transparent;
  color: rgb(146, 64, 14);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s ease;
  
  &:hover {
    opacity: 0.7;
  }
  
  svg {
    width: 18px;
    height: 18px;
  }
`;

// ============================================================================
// Mode Selector Components (Phase 2.2)
// ============================================================================

const ModeSelectorContainer = styled.div`
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  gap: 4px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  padding: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
`;

const ModeButton = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  color: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  background: ${props => props.$active ? 'rgba(var(--color-primary), 0.1)' : 'transparent'};
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  
  &:hover {
    background: ${props => props.$active ? 'rgba(var(--color-primary), 0.15)' : 'rgb(var(--color-surface-hover))'};
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

// ============================================================================
// Expert Mode Components (Phase 2.2 Batch 2)
// ============================================================================

const ExpertModeContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgb(var(--color-background));
`;

const ExpertModeToolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgb(var(--color-surface));
  border-bottom: 1px solid rgb(var(--color-border));
`;

const ToolbarSection = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const ExpertToolbarButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgb(var(--color-surface-hover));
    border-color: rgb(var(--color-primary));
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  svg {
    width: 14px;
    height: 14px;
  }
`;

const StatusMessage = styled.div<{ $type?: 'success' | 'error' | 'info' }>`
  padding: 8px 12px;
  font-size: 12px;
  background: ${props => {
    if (props.$type === 'success') return 'rgba(var(--color-success), 0.1)';
    if (props.$type === 'error') return 'rgba(var(--color-error), 0.1)';
    return 'rgba(var(--color-info), 0.1)';
  }};
  color: ${props => {
    if (props.$type === 'success') return 'rgb(var(--color-success))';
    if (props.$type === 'error') return 'rgb(var(--color-error))';
    return 'rgb(var(--color-info))';
  }};
  border-left: 3px solid ${props => {
    if (props.$type === 'success') return 'rgb(var(--color-success))';
    if (props.$type === 'error') return 'rgb(var(--color-error))';
    return 'rgb(var(--color-info))';
  }};
  margin: 8px 16px;
  border-radius: var(--radius-sm);
`;

// ============================================================================
// Wizard Mode Styled Components (Phase 2.2 Batch 3)
// ============================================================================

const WizardContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
  background: linear-gradient(135deg, rgb(var(--color-background)) 0%, rgb(var(--color-surface)) 100%);
`;

const WizardCard = styled.div`
  max-width: 600px;
  width: 100%;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  padding: 48px;
  text-align: center;
`;

const WizardIcon = styled.div`
  font-size: 48px;
  margin-bottom: 24px;
  animation: float 3s ease-in-out infinite;
  
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
`;

const WizardTitle = styled.h2`
  font-size: 28px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0 0 12px 0;
`;

const WizardDescription = styled.p`
  font-size: 16px;
  color: rgb(var(--color-text-secondary));
  margin: 0 0 32px 0;
  line-height: 1.6;
`;

const WizardInput = styled.input`
  width: 100%;
  padding: 14px 16px;
  font-size: 16px;
  border: 2px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  margin-bottom: 24px;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 4px rgba(var(--color-primary), 0.1);
  }
  
  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const FlowTypeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 32px;
`;

const FlowTypeCard = styled.button<{ $selected: boolean }>`
  padding: 24px;
  border: 2px solid ${props => props.$selected ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  background: ${props => props.$selected ? 'rgba(var(--color-primary), 0.05)' : 'rgb(var(--color-background))'};
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const FlowTypeIcon = styled.div`
  font-size: 32px;
  margin-bottom: 12px;
`;

const FlowTypeLabel = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
`;

const FlowTypeDesc = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.4;
`;

const SuggestedNodesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 32px;
`;

const SuggestedNodeCard = styled.button`
  padding: 16px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-background));
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 12px;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgb(var(--color-surface));
    transform: translateX(4px);
  }
`;

const NodeIconCircle = styled.div<{ $color: string }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${props => props.$color};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
`;

const WizardNodeInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const WizardNodeLabel = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 2px;
`;

const WizardNodeDesc = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
`;

const WizardActions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
`;

const WizardButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'ghost' }>`
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  
  ${props => {
    if (props.$variant === 'primary') {
      return `
        background: rgb(var(--color-primary));
        color: white;
        border: none;
        
        &:hover {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(var(--color-primary), 0.3);
        }
        
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
      `;
    } else if (props.$variant === 'secondary') {
      return `
        background: rgb(var(--color-surface));
        color: rgb(var(--color-text-primary));
        border: 1px solid rgb(var(--color-border));
        
        &:hover {
          border-color: rgb(var(--color-primary));
          background: rgb(var(--color-background));
        }
      `;
    } else {
      return `
        background: transparent;
        color: rgb(var(--color-text-secondary));
        border: none;
        
        &:hover {
          color: rgb(var(--color-text-primary));
          background: rgba(var(--color-border), 0.5);
        }
      `;
    }
  }}
`;

const WizardProgress = styled.div`
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 32px;
`;

const ProgressDot = styled.div<{ $active: boolean; $completed: boolean }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${props => {
    if (props.$completed) return 'rgb(var(--color-success))';
    if (props.$active) return 'rgb(var(--color-primary))';
    return 'rgb(var(--color-border))';
  }};
  transition: all 0.2s ease;
`;

const EditorWrapper = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
`;

const NodePalette = styled.div`
  position: absolute;
  top: 64px; /* Increased from 12px to clear the top Toolbar */
  left: 12px;
  width: 220px;
  max-height: calc(100% - 120px); /* Decreased to clear the bottom ViewportToolbar */
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  z-index: 10;
`;

const PaletteHeader = styled.div`
  padding: 12px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
  position: sticky;
  top: 0;
  z-index: 1;
`;

const PaletteTitle = styled.div`
  font-weight: 600;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 6px 10px;
  font-size: 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  outline: none;
  transition: border-color 0.2s ease;
  
  &:focus {
    border-color: rgb(var(--color-primary));
  }
  
  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const CategoryFilters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
  padding: 8px 0;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const FilterChip = styled.button<{ $active?: boolean; $color?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 600;
  border: 1px solid ${props => props.$active ? props.$color || 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  background: ${props => props.$active ? (props.$color ? `${props.$color}22` : 'rgb(var(--color-primary) / 0.1)') : 'transparent'};
  color: ${props => props.$active ? (props.$color || 'rgb(var(--color-primary))') : 'rgb(var(--color-text-secondary))'};
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  outline: none;
  white-space: nowrap;
  
  &:hover {
    border-color: ${props => props.$color || 'rgb(var(--color-primary))'};
    background: ${props => props.$color ? `${props.$color}22` : 'rgb(var(--color-primary) / 0.1)'};
    color: ${props => props.$color || 'rgb(var(--color-primary))'};
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

const PaletteCategory = styled.div<{ $collapsed?: boolean }>`
  border-bottom: 1px solid rgb(var(--color-border));
  
  &:last-child {
    border-bottom: none;
  }
`;

const CategoryHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
  
  &:hover {
    background: rgb(var(--color-surface-hover));
  }
`;

const CategoryTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const CategoryTitle = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const CategoryBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 600;
  color: rgb(var(--color-text-tertiary));
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 10px;
`;

const CollapseIcon = styled.span<{ $collapsed?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  transform: ${props => props.$collapsed ? 'rotate(-90deg)' : 'rotate(0deg)'};
  transition: transform 0.2s ease;
`;

const CategoryContent = styled.div<{ $collapsed?: boolean }>`
  padding: ${props => props.$collapsed ? '0 12px' : '0 12px 12px 12px'};
  max-height: ${props => props.$collapsed ? '0' : '1000px'};
  overflow: hidden;
  transition: max-height 0.3s ease, padding 0.3s ease;
`;

const NodeItem = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  margin-bottom: 6px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-left: 3px solid ${props => props.$color};
  border-radius: var(--radius-sm);
  cursor: grab;
  transition: all 0.15s ease;
  position: relative;
  
  &:hover {
    background: rgb(var(--color-surface));
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  }
  
  &:active {
    cursor: grabbing;
  }
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const FavoriteButton = styled.button<{ $isFavorite?: boolean }>`
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: ${props => props.$isFavorite ? 'rgb(234, 179, 8)' : 'rgb(var(--color-text-tertiary))'};
  opacity: ${props => props.$isFavorite ? '1' : '0'};
  transition: opacity 0.2s ease, color 0.2s ease;
  
  ${NodeItem}:hover & {
    opacity: 1;
  }
  
  &:hover {
    color: rgb(234, 179, 8);
    transform: scale(1.1);
  }
`;

const NodeIcon = styled.span`
  font-size: 18px;
  line-height: 1;
`;

const NodeInfo = styled.div`
  flex: 1;
  min-width: 0;
  padding-right: 20px; /* Space for favorite button */
`;

const NodeName = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const NodeDesc = styled.div`
  font-size: 10px;
  color: rgb(var(--color-text-tertiary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
`;

const EmptyState = styled.div`
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgb(var(--color-text-tertiary));
  padding: 40px;
  text-align: center;

  /* ReactFlow's pane can sit above generic children; keep the overlay visible,
     but only make the content clickable (so canvas can still be panned). */
  pointer-events: none;

  & > * {
    pointer-events: auto;
  }
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
`;

const EmptyTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: rgb(var(--color-text-primary));
`;

const EmptyText = styled.div`
  font-size: 13px;
  line-height: 1.6;
`;

const EmptyActions = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 16px;
  flex-wrap: wrap;
  justify-content: center;
`;

const EmptyPrimaryButton = styled.button`
  padding: 10px 16px;
  background: rgb(var(--color-primary));
  border: 1px solid rgb(var(--color-primary));
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 700;
  color: white;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    filter: brightness(1.05);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const EmptySecondaryButton = styled.button`
  padding: 10px 16px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const Toolbar = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  left: 12px; /* Anchor left to allow full width wrapping */
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  z-index: 10;
  pointer-events: none; /* Let canvas clicks pass through empty flex space */

  & > * {
    pointer-events: auto; /* Re-enable clicks on the actual buttons */
  }
`;

const ToolbarButton = styled.button`
  padding: 8px 16px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  
  &:hover {
    background: rgb(var(--color-primary));
    color: white;
    border-color: rgb(var(--color-primary));
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const LoadMenuContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const LoadMenuDropdown = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 350px;
  max-width: 450px;
  max-height: 500px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  display: flex;
  flex-direction: column;
  
  /* Phase 8.4: Smooth slide-in animation */
  animation: slideIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: top right;
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
`;

const LoadMenuHeader = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
`;

const WorkflowSearchInput = styled.input`
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  transition: all 0.15s ease;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.1);
  }
  
  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
`;

const LoadMenuList = styled.div`
  overflow-y: auto;
  max-height: 400px;
`;

const LoadMenuItem = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  transition: background 0.15s ease;
  
  &:hover {
    background: rgb(var(--color-background));
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const LoadMenuItemContent = styled.div`
  flex: 1;
  min-width: 0;
  cursor: pointer;
`;

const LoadMenuItemTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const LoadMenuItemMeta = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const DeleteButton = styled.button`
  padding: 6px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgb(239, 68, 68);
    color: rgb(239, 68, 68);
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

const LoadMenuEmpty = styled.div`
  padding: 24px 16px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
`;

const ConfirmModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  backdrop-filter: blur(4px);
  
  /* Phase 8.4: Smooth fade-in animation */
  animation: fadeIn 0.2s ease;
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const ConfirmContent = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 400px;
  padding: 24px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  
  /* Phase 8.4: Smooth scale-in animation */
  animation: scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  
  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
`;

const ConfirmTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 8px 0;
`;

const ConfirmMessage = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 0 0 20px 0;
  line-height: 1.5;
`;

const ConfirmActions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
`;

const ConfirmButton = styled.button<{ $variant?: 'danger' | 'secondary' }>`
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.$variant === 'danger' ? 'white' : 'rgb(var(--color-text-primary))'};
  background: ${props => props.$variant === 'danger' ? 'rgb(239, 68, 68)' : 'transparent'};
  border: 1px solid ${props => props.$variant === 'danger' ? 'rgb(239, 68, 68)' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: ${props => props.$variant === 'danger' ? 'rgb(220, 38, 38)' : 'rgb(var(--color-background))'};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// ============================================================================
// Keyboard Shortcuts Help Modal (Phase 8.6)
// ============================================================================

const KeyboardShortcutsModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10002;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease;
`;

const KeyboardShortcutsContent = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  animation: scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
`;

const KeyboardShortcutsHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const KeyboardShortcutsTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const KeyboardShortcutsBody = styled.div`
  padding: 24px;
`;

const ShortcutSection = styled.div`
  margin-bottom: 24px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const ShortcutSectionTitle = styled.h4`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
`;

const ShortcutList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ShortcutItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgb(var(--color-background));
  border-radius: var(--radius-md);
`;

const ShortcutLabel = styled.span`
  font-size: 14px;
  color: rgb(var(--color-text-primary));
`;

const ShortcutKeys = styled.div`
  display: flex;
  gap: 4px;
`;

const ShortcutKey = styled.kbd`
  padding: 2px 8px;
  font-size: 12px;
  font-family: monospace;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
`;

const ViewportToolbar = styled.div`
  position: absolute;
  bottom: 12px;
  left: 12px;
  display: flex;
  gap: 8px;
  z-index: 15; /* Increased from 5 to ensure visibility above other elements */
`;

const ViewportButton = styled.button`
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgb(var(--color-background));
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

const AlignmentToolbar = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 15;
  
  /* Hide when no nodes selected */
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  
  &.visible {
    opacity: 1;
    pointer-events: all;
  }
`;

const AlignmentButton = styled.button`
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgb(var(--color-background));
    color: rgb(var(--color-primary));
  }
  
  &:active {
    background: rgb(var(--color-primary));
    color: white;
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

const DragGhost = styled.div<{ $color?: string }>`
  position: fixed;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.6;
  padding: 12px 16px;
  background: ${props => props.$color || 'rgb(var(--color-primary))'};
  color: white;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  transform: translate(-50%, -50%);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &::before {
    content: '✨';
    font-size: 16px;
  }
`;

const AlignmentGuide = styled.div<{ $orientation: 'horizontal' | 'vertical'; $position: number }>`
  position: absolute;
  ${props => props.$orientation === 'horizontal' ? `
    left: 0;
    right: 0;
    top: ${props.$position}px;
    height: 1px;
  ` : `
    top: 0;
    bottom: 0;
    left: ${props.$position}px;
    width: 1px;
  `}
  background: rgb(var(--color-primary));
  opacity: 0.6;
  z-index: 5;
  pointer-events: none;
`;

// Sprint 1 Task 1.4: Background & Grid Settings Panel
const SettingsPanel = styled.div`
  position: absolute;
  bottom: 60px; /* FIX: Changed from top: 12px to pop up above the toolbar */
  left: 12px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  padding: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 200px;
`;

const SettingGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const SettingLabel = styled.label`
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const SettingRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PatternButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 6px 10px;
  background: ${props => props.$active ? 'rgb(var(--color-primary))' : 'transparent'};
  color: ${props => props.$active ? 'white' : 'rgb(var(--color-text-primary))'};
  border: 1px solid ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-background))'};
    border-color: rgb(var(--color-primary));
  }
`;

const GridSizeInput = styled.input`
  flex: 1;
  padding: 6px 8px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  color: rgb(var(--color-text-primary));
  font-size: 12px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const ToggleSwitch = styled.button<{ $active: boolean }>`
  width: 40px;
  height: 20px;
  background: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border: none;
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  transition: background 0.15s ease;
  
  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: ${props => props.$active ? '22px' : '2px'};
    width: 16px;
    height: 16px;
    background: white;
    border-radius: 50%;
    transition: left 0.15s ease;
  }
`;

// ============================================================================
// Node & Edge Type Mapping
// ============================================================================

// Static node types (not containers that need node access)
// NOTE: React.memo() node components type as NamedExoticComponent which is not assignable to
// React.ComponentType under strict NodeTypes. Keep a loose registry and cast at the ReactFlow boundary.
type AnyNodeComponent = React.ComponentType<any>;

const staticNodeTypes: Record<string, AnyNodeComponent> = {
  // Form nodes (Phase E - 2026-02-19)
  form: FormStepNode, // Form Step (Page)
  formStepSingle: FormStepSingleNode, // Backward compatibility

  // Form Process: non-purple container renderer with toolbar (Add Step + Edit)
  formProcessContainer: FormProcessContainerNode,

  // Render-time "+" button node for Form Process containers

  smartWorkForm: SmartWorkFormNode,

  // Backward compatibility aliases
  formStep: FormStepSingleNode, // Deprecated

  // Other nodes
  formReference: FormReferenceNode,
  trigger: TriggerNode,
  condition: ConditionIfNode,
  action: ActionNode,
  waitState: WaitStateNode,
  document: DocumentNode,
  utility: UtilityNode,
  terminal: TerminalNode,
};

// Dynamically build the full registry map statically ONCE outside the component.
// This avoids TDZ / initialization crashes seen when building nodeTypes inside hooks.
const dynamicNodeTypes: Record<string, AnyNodeComponent> = { ...staticNodeTypes };
Object.keys(NODE_TYPE_REGISTRY).forEach((typeId) => {
  if (dynamicNodeTypes[typeId]) return;

  if (typeId.startsWith('trigger')) dynamicNodeTypes[typeId] = TriggerNode;
  else if (typeId.startsWith('action')) dynamicNodeTypes[typeId] = ActionNode;
  else if (typeId.startsWith('condition') || typeId === 'parallelPath') dynamicNodeTypes[typeId] = ConditionIfNode;
  else if (typeId.startsWith('loop')) dynamicNodeTypes[typeId] = LoopNode;
  else if (typeId.startsWith('wait') || typeId.startsWith('timer') || typeId.startsWith('pending')) dynamicNodeTypes[typeId] = WaitStateNode;
  else if (typeId.startsWith('document')) dynamicNodeTypes[typeId] = DocumentNode;
  else if (typeId.startsWith('terminal') || typeId.startsWith('end')) dynamicNodeTypes[typeId] = TerminalNode;
  else if (typeId.startsWith('form')) dynamicNodeTypes[typeId] = FormStepSingleNode;
  else dynamicNodeTypes[typeId] = UtilityNode;
});


// Static edge types (no useMemo needed - these are constant)
const staticEdgeTypes = {
  custom: CustomEdge,
  conditional: ConditionalEdge,
  error: ErrorEdge,
  success: SuccessEdge,
  enhanced: EnhancedConnectionEdge,
  step: EnhancedConnectionEdge, // Use enhanced edge UX (toolbar, hitbox) with step routing
  insert: InsertNodeEdge,
  default: CustomEdge, // Fallback to custom for untyped edges
} as unknown as EdgeTypes;

// Phase 9.4: Render-time execution tracing (no mutations to saved workflow graph)
const DebugAwareReactFlow: React.FC<React.ComponentProps<typeof ReactFlow>> = (props) => {
  const { debug } = useFlowEditor();

  const decoratedNodes = useMemo(() => {
    const nodes = (props.nodes || []) as Node[];
    if (!debug.isActive) return nodes;

    const executed = new Set(debug.executedNodeIds);
    const activeId = debug.activeNodeId;

    return nodes.map((n) => {
      const isActive = activeId === n.id;
      const isExecuted = executed.has(n.id);
      if (isActive || isExecuted) return n;

      return {
        ...n,
        style: {
          ...(n.style || {}),
          opacity: 0.28,
        },
      };
    });
  }, [props.nodes, debug.isActive, debug.activeNodeId, debug.executedNodeIds]);

  const decoratedEdges = useMemo(() => {
    const edges = (props.edges || []) as Edge[];
    if (!debug.isActive) return edges;

    const executed = new Set(debug.executedNodeIds);
    const activeId = debug.activeNodeId;
    const prevId = debug.previousNodeId;

    return edges.map((e) => {
      const isActiveHop = Boolean(prevId && activeId && e.source === prevId && e.target === activeId);

      if (isActiveHop) {
        return {
          ...e,
          animated: true,
          data: { ...(e.data || {}), animated: true },
          style: {
            ...(e.style || {}),
            stroke: 'rgb(var(--color-primary))',
            strokeWidth: 3,
            opacity: 1,
          },
        };
      }

      const targetExecuted = executed.has(e.target);
      const targetIsActive = activeId === e.target;

      if (targetExecuted || targetIsActive) return e;

      return {
        ...e,
        animated: false,
        data: { ...(e.data || {}), animated: false },
        style: {
          ...(e.style || {}),
          opacity: 0.22,
        },
      };
    });
  }, [props.edges, debug.isActive, debug.activeNodeId, debug.previousNodeId, debug.executedNodeIds]);

  const { nodes: _n, edges: _e, ...rest } = props;

  return (
    <ReactFlow
      {...rest}
      nodes={decoratedNodes}
      edges={decoratedEdges}
    />
  );
};

// ============================================================================
// Error Boundary for Config Panel
// ============================================================================

class ConfigPanelErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state: { hasError: boolean; error: Error | null } = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('[Config Panel] Error caught', {
      component: 'ConfigPanelErrorBoundary',
      metadata: { componentStack: errorInfo.componentStack },
    }, error);

    // Send to Sentry for monitoring
    Sentry.captureException(error, {
      extra: {
        context: 'ConfigPanelErrorBoundary',
        componentStack: errorInfo.componentStack,
        errorMessage: error.message,
      },
    });
  }

  render() { 
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          background: 'rgb(var(--color-error) / 0.1)',
          borderRadius: '8px',
          margin: '20px'
        }}>
          <h3 style={{ color: 'rgb(var(--color-error))', marginBottom: '10px' }}>
            Panel Error
          </h3>
          <p style={{ color: 'rgb(var(--color-text-secondary))', marginBottom: '15px' }}>
            {this.state.error?.message || 'Unknown error occurred'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: '8px 16px',
              background: 'rgb(var(--color-primary))',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry?
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// Component
// ============================================================================

const UnifiedFlowEditorInner: React.FC<UnifiedFlowEditorProps> = ({
  initialNodes = [],
  initialEdges = [],
  initialViewport,
  onSave,
  onChange, // Track changes for auto-save
  initialWorkflowId,
  initialWorkflowName,
  initialWorkflowDescription,
  initialWorkflowStatus,
  onWorkflowSaved,
  readOnly = false,
  editorMode = 'visual',
  allowedNodeCategories, // Phase 4.2: Permission-based filtering
}) => {
  // Normalize nodes to ensure all have required properties (maxInputs, maxOutputs)
  const normalizedInitialNodes = useMemo(() => normalizeNodes(initialNodes), [initialNodes]);
  
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node<any>>(
    normalizedInitialNodes as unknown as Node<any>[]
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<any>>(initialEdges as unknown as Edge<any>[]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const generateNodeId = useCallback(() => {
    return `node-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  }, []);

  const queryClient = useQueryClient();
  
  // Keep ref to current nodes for stable callbacks
  const nodesRef = useRef<Node[]>(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Keep ref to current edges for stable callbacks
  const edgesRef = useRef<Edge[]>(edges);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Initial Form Process alignment: force child steps to align horizontally on load
  const didInitialFormProcessLayoutRef = useRef(false);
  useEffect(() => {
    if (didInitialFormProcessLayoutRef.current) return;
    if (nodes.length === 0) return;

    didInitialFormProcessLayoutRef.current = true;

    const containerNodes = nodes.filter((n) =>
      isFormProcessContainerType(((n.data as any)?.nodeType as string | undefined) || n.type)
    );
    if (containerNodes.length === 0) return;

    let nextNodes = nodes;
    let nextEdges = edges;

    for (const container of containerNodes) {
      const layoutResult = calculateContainerLayout(container.id, nextNodes, nextEdges);
      const connectionResult = autoConnectSequentialSteps(container.id, layoutResult.nodes, nextEdges);

      nextNodes = layoutResult.nodes.map((n) => {
        if (n.id !== container.id) return n;
        return {
          ...n,
          style: {
            ...(n.style || {}),
            width: Math.max(layoutResult.containerWidth, (n.style as any)?.width || 600),
            height: Math.max(layoutResult.containerHeight, (n.style as any)?.height || 400),
          },
        };
      });
      nextEdges = connectionResult.edges;
    }

    setNodes(sortNodesTopologically(nextNodes));
    setEdges(nextEdges);
  }, [edges, nodes, setEdges, setNodes]);

  // Dynamic FormProcess alignment: when steps are added/removed, re-stack all internal pages vertically.
  // This is intentionally NOT persisted as a migration; it only updates node positions and container sizing.
  const containerChildSignatureRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!didInitialFormProcessLayoutRef.current) return;

    const isPageNodeType = (type?: string) =>
      type === 'form' || type === 'formReference' || type === 'formStepSingle' || type === 'formStep';

    const containerNodes = nodes.filter((n) =>
      isFormProcessContainerType(((n.data as any)?.nodeType as string | undefined) || n.type)
    );
    if (containerNodes.length === 0) return;

    let nextNodes = nodes;
    let nextEdges = edges;
    let didChange = false;

    for (const container of containerNodes) {
      const pages = nextNodes.filter((n) => n.parentId === container.id && isPageNodeType(n.type));
      const signature = pages
        .map((p) => String(p.id))
        .sort()
        .join('|');

      const prevSig = containerChildSignatureRef.current.get(container.id);
      if (prevSig === undefined) {
        containerChildSignatureRef.current.set(container.id, signature);
        continue;
      }

      if (prevSig === signature) continue;

      const layoutResult = calculateContainerLayout(container.id, nextNodes, nextEdges);
      const connectionResult = autoConnectSequentialSteps(container.id, layoutResult.nodes, nextEdges);

      nextNodes = layoutResult.nodes.map((n) => {
        if (n.id !== container.id) return n;
        return {
          ...n,
          style: {
            ...(n.style || {}),
            width: Math.max(layoutResult.containerWidth, (n.style as any)?.width || 600),
            height: Math.max(layoutResult.containerHeight, (n.style as any)?.height || 400),
          },
        };
      });

      nextEdges = connectionResult.edges;
      containerChildSignatureRef.current.set(container.id, signature);
      didChange = true;
    }

    if (!didChange) return;

    setNodes(sortNodesTopologically(nextNodes));
    setEdges(nextEdges);
  }, [edges, nodes, setEdges, setNodes]);
  
  // Selected node state (moved here to fix TDZ - used in useMemo at line ~1917)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  
  // Track last notified state to prevent infinite loops
  const lastNotifiedStateRef = useRef<string>('');
  
  // Trigger onChange when nodes or edges change (with infinite loop protection)
  useEffect(() => {
    if (!onChange || nodes.length === 0) return;
    
    // Serialize current state for comparison
    const currentState = JSON.stringify({ nodes, edges });
    
    // Only call onChange if state actually changed
    if (currentState !== lastNotifiedStateRef.current) {
      lastNotifiedStateRef.current = currentState;
      onChange(nodes, edges);
    }
  }, [nodes, edges, onChange]);
  
  // Phase 7.5: Performance monitoring - log when node count exceeds thresholds
  useEffect(() => {
    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    
    if (nodeCount > 1000) {
      logger.warn(`[Performance] Large workflow detected: ${nodeCount} nodes, ${edgeCount} edges`);
    } else if (nodeCount > 500) {
      console.info(`[Performance] Medium workflow: ${nodeCount} nodes, ${edgeCount} edges`);
    }
    
    // Measure performance of large workflows
    if (nodeCount > 100) {
      const startTime = performance.now();
      // Force a re-render measurement on next frame
      requestAnimationFrame(() => {
        const renderTime = performance.now() - startTime;
        if (renderTime > 100) {
          logger.warn(`[Performance] Slow render with ${nodeCount} nodes: ${renderTime.toFixed(2)}ms`);
        }
      });
    }
  }, [nodes.length, edges.length]);
  
  // Phase E: Wrap onNodesChange to handle container deletion (stable with ref)
  const onNodesChange = useCallback((changes: any[]) => {
    // Check if any containers are being removed
    const removedNodeIds = changes
      .filter(change => change.type === 'remove')
      .map(change => change.id);
    
    if (removedNodeIds.length > 0) {
      const removedContainerIds = removedNodeIds.filter(id => 
        nodesRef.current.find(n => n.id === id && n.type === 'formMultiStepContainer')
      );
      
      if (removedContainerIds.length > 0) {
        // Unparent all children of deleted containers
        setNodes((nds) =>
          nds.map((n) => {
            if (removedContainerIds.includes(n.parentId || '')) {
              // Calculate absolute position before unparenting
              const parent = nds.find(p => p.id === n.parentId);
              const absolutePosition = parent
                ? {
                    x: n.position.x + parent.position.x,
                    y: n.position.y + parent.position.y,
                  }
                : n.position;
              
              logger.debug(`[Container] Unparenting node ${n.id} from deleted container`);
              return {
                ...n,
                position: absolutePosition,
                parentId: undefined,
                extent: undefined,
              };
            }
            return n;
          })
        );
      }
    }
    
    // Apply the original changes
    onNodesChangeBase(changes);
  }, [setNodes, onNodesChangeBase]);
  
  // React Flow instance for viewport controls
  const { setCenter: reactFlowSetCenter, ...reactFlowInstance } = useReactFlow();
  
  // ============================================================================
  // CONFIG PANEL PORTAL - Enhanced with full styling (2026-02-24)
  // ============================================================================
  useEffect(() => {
    // Ensure portal exists with complete styling.
    // Portal containers are expected to exist statically in frontend/index.html.
    let portal = document.getElementById('config-portal');
    let created = false;

    if (!portal) {
      logger.warn('[Portal] Missing #config-portal - creating dynamically as fallback');
      portal = document.createElement('div');
      portal.id = 'config-portal';
      document.body.appendChild(portal);
      created = true;
    }

    portal.style.cssText = `
      position: fixed;
      right: 0;
      top: 0;
      width: min(450px, 100vw);
      height: 100vh;
      overflow-y: auto;
      background: rgb(var(--color-surface));
      /* Must sit above fullscreen canvas (EditorContainer uses z-index: 9990) */
      z-index: 10050;
      box-shadow: -4px 0 12px rgba(0,0,0,0.1);
      display: none;
      pointer-events: none;
    `;

    return () => {
      // Cleanup only if we created it dynamically.
      if (created) {
        const el = document.getElementById('config-portal');
        if (el) {
          document.body.removeChild(el);
          logger.debug('[Portal] Removed dynamically-created config-portal element');
        }
      }
    };
  }, []); // Run once on mount
  
  // ============================================================================
  // PORTAL MOUNT GUARD - Re-create if missing when panel opens
  // ============================================================================
  const [portalKey, setPortalKey] = useState(Date.now());
  
  useEffect(() => {
    const portal = document.getElementById('config-portal');
    
    if (selectedNode !== null) {
      if (!portal) {
        logger.warn('[Portal] Portal missing when panel opened - recreating');
        const newPortal = document.createElement('div');
        newPortal.id = 'config-portal';
        newPortal.style.cssText = `
          position: fixed;
          right: 0;
          top: 0;
          width: min(450px, 100vw);
          height: 100vh;
          overflow-y: auto;
          background: rgb(var(--color-surface));
          /* Must sit above fullscreen canvas (EditorContainer uses z-index: 9990) */
          z-index: 10050;
          box-shadow: -4px 0 12px rgba(0,0,0,0.1);
          display: flex;
          pointer-events: auto;
        `;
        document.body.appendChild(newPortal);
        setPortalKey(Date.now()); // Force re-render
        logger.debug('[Portal] Portal mounted and visible');
      } else {
        // Show portal when node is selected
        portal.style.display = 'flex';
        portal.style.pointerEvents = 'auto';
        logger.debug('[Portal] Portal shown');
      }
    } else {
      // Hide portal when no node is selected
      if (portal) {
        portal.style.display = 'none';
        portal.style.pointerEvents = 'none';
        logger.debug('[Portal] Portal hidden');
      }
    }
  }, [selectedNode]);
  
  // ============================================================================
  // Container State Restoration (Phase 4 Batch 5)
  // ============================================================================
  
  /**
   * Rebuild container statistics when workflow is loaded
   * This ensures container nodes show correct counts even if statistics
   * weren't persisted or became stale. Also cleans up orphaned nodes.
   */
  useEffect(() => {
    if (normalizedInitialNodes && normalizedInitialNodes.length > 0) {
      // Find all container nodes
      const containerNodes = normalizedInitialNodes.filter(
        n => n.type === 'formMultiStepContainer'
      );
      
      const containerIds = new Set(containerNodes.map(c => c.id));
      
      // Check for orphaned nodes (containerNodeId pointing to non-existent container)
      const orphanedNodes = normalizedInitialNodes.filter((n) => {
        const containerNodeId = (n.data as any)?.containerNodeId;
        return typeof containerNodeId === 'string' && !containerIds.has(containerNodeId);
      });
      
      if (orphanedNodes.length > 0) {
        logger.warn(
          `[Container Restore] Found ${orphanedNodes.length} orphaned nodes (referencing missing containers)`,
          orphanedNodes.map(n => n.id)
        );
        
        // Clean up orphaned nodes by removing their containerNodeId
        setNodes((nds) =>
          nds.map((n) => {
            const containerNodeId = (n.data as any)?.containerNodeId;
            if (typeof containerNodeId === 'string' && !containerIds.has(containerNodeId)) {
              const cleanedData = { ...(n.data as any) };
              delete cleanedData.containerNodeId;
              logger.debug(`[Container Restore] Cleaned orphaned node ${n.id}`);
              return { ...n, data: cleanedData };
            }
            return n;
          })
        );
      }
      
      if (containerNodes.length > 0) {
        logger.debug(`[Container Restore] Found ${containerNodes.length} containers, rebuilding statistics...`);
        
        // Rebuild statistics for each container
        containerNodes.forEach(container => {
          // Count child nodes
          const childNodes = normalizedInitialNodes.filter(
            n => n.data?.containerNodeId === container.id
          );
          
          const nodeTypeBreakdown: Record<string, number> = {};
          const formReferences: string[] = [];
          
          childNodes.forEach(node => {
            const nodeType = node.type || 'unknown';
            nodeTypeBreakdown[nodeType] = (nodeTypeBreakdown[nodeType] || 0) + 1;
            
            // Collect form references
            const formId = (node.data as any)?.formId;
            if (typeof formId === 'string') {
              formReferences.push(formId);
            }
            const tenantFormId = (node.data as any)?.tenantFormId;
            if (typeof tenantFormId === 'string') {
              formReferences.push(tenantFormId);
            }
          });
          
          // Update container data
          setNodes((nds) => nds.map(n => {
            if (n.id === container.id) {
              return {
                ...n,
                data: {
                  ...n.data,
                  nodeCount: childNodes.length,
                  nodeTypeBreakdown,
                  formReferences: [...new Set(formReferences)],
                  childNodes: childNodes.map(c => c.id),
                },
              };
            }
            return n;
          }));
          
          logger.debug(`[Container Restore] Container ${container.id}: ${childNodes.length} nodes`);
        });
      }
    }
  }, []); // Only run on mount

  // ============================================================================
  // Deprecated Node Detection (Phase 6.1)
  // ============================================================================
  
  /**
   * Detect deprecated nodes in the workflow
   * - formField: Old individual field node (replaced by formStep)
   * - formSection: Old section node (replaced by formStep)
   */
  useEffect(() => {
    const DEPRECATED_TYPES = ['formField', 'formSection'];
    const foundDeprecated = nodes.filter(node => DEPRECATED_TYPES.includes(node.type || ''));
    
    if (foundDeprecated.length > 0) {
      const uniqueTypes = [...new Set(foundDeprecated.map(n => n.type))];
      setHasDeprecatedNodes(true);
      setDeprecatedNodeTypes(uniqueTypes as string[]);
      logger.debug('[Phase 6] Deprecated nodes detected', {
        types: uniqueTypes,
        count: foundDeprecated.length,
      });
    } else {
      setHasDeprecatedNodes(false);
      setDeprecatedNodeTypes([]);
    }
  }, [nodes]);

  // ============================================================================
  // Editor Mode State & Filtering
  // ============================================================================
  
  // Note: Editor mode can be passed as prop or managed internally
  // If passed as prop, it overrides the internal state (controlled component)
  const [internalEditorMode, setInternalEditorMode] = useState<EditorMode>(() => {
    try {
      const stored = (localStorage.getItem('flow_editor_mode') as EditorMode | null) || 'visual';
      // Phase 7 hardening: retire Expert Mode (JSON editor) but tolerate stored values.
      return stored === 'expert' ? 'visual' : stored;
    } catch {
      return 'visual';
    }
  });
  
  // Use prop if provided, otherwise use internal state
  const activeEditorMode = editorMode !== undefined ? editorMode : internalEditorMode;
  const normalizedEditorMode: EditorMode = activeEditorMode === 'expert' ? 'visual' : activeEditorMode;
  
  // Persist mode preference only if not controlled by prop
  useEffect(() => {
    if (editorMode === undefined) {
      // Never persist deprecated Expert Mode
      localStorage.setItem('flow_editor_mode', internalEditorMode === 'expert' ? 'visual' : internalEditorMode);
    }
  }, [internalEditorMode, editorMode]);
  
  // ============================================================================
  // Fullscreen State & Handlers (Phase 0: WF-ENH-2026-Q1)
  // ============================================================================
  
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('workforms_fullscreen_enabled');
      return stored === 'true';
    } catch {
      return false;
    }
  });

  const toggleFullscreen = useCallback(async () => {
    const next = !isFullscreen;

    // Prefer native browser fullscreen when available; fall back to CSS fullscreen.
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      const el = editorContainerRef.current;
      if (next && el && typeof (el as any).requestFullscreen === 'function') {
        await (el as any).requestFullscreen();
        return;
      }
    } catch (err) {
      logger.warn('[UnifiedFlowEditor] Fullscreen API failed, falling back to CSS fullscreen', err);
    }

    setIsFullscreen(next);
    localStorage.setItem('workforms_fullscreen_enabled', next ? 'true' : 'false');
  }, [isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      localStorage.setItem('workforms_fullscreen_enabled', active ? 'true' : 'false');
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  // ESC key handler for CSS-based fullscreen exit
  // 🔧 Portal Container Creation (2026-02-24: Permanent Fix)
  useEffect(() => {
    let portalRoot = document.getElementById('config-portal-root');
    let created = false;

    if (!portalRoot) {
      portalRoot = document.createElement('div');
      portalRoot.id = 'config-portal-root';
      document.body.appendChild(portalRoot);
      created = true;
      logger.warn('[UnifiedFlowEditor] Missing #config-portal-root - created dynamically');
    }

    portalRoot.style.cssText = 'position: fixed; top: 0; right: 0; bottom: 0; z-index: 10000; pointer-events: none;';

    return () => {
      if (created) {
        const root = document.getElementById('config-portal-root');
        if (root) {
          document.body.removeChild(root);
          logger.debug('[UnifiedFlowEditor] 🧹 Removed dynamically-created portal root');
        }
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        localStorage.setItem('workforms_fullscreen_enabled', 'false');
      }
    };
    
    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when in fullscreen
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);
  
  // ============================================================================
  // Context Menu (Phase E.3)
  // ============================================================================
  
  const { menu, handleNodeContextMenu, handleCloseMenu } = useContextMenu();
  
  // Close context menu when clicking anywhere
  useEffect(() => {
    if (menu) {
      const handleClick = () => handleCloseMenu();
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [menu, handleCloseMenu]);
  
  // ============================================================================
  // FormBuilder Integration (Phase 6)
  // ============================================================================
  
  const {
    isOpen: isFormBuilderOpen,
    editingNodeId,
    openFormBuilder,
    closeFormBuilder,
    saveFormBuilder
  } = useFormBuilder();
  
  // REMOVED: Old window.dispatchEvent listener (2026-02-21)
  // Now using FormBuilderContext from provider wrapper
  // See: FormBuilderContext.tsx and DynamicConfigPanel.tsx for new pattern
  
  // ============================================================================
  // Validation Engine (Phase 7)
  // ============================================================================
  
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: true,
    issues: [],
    errorCount: 0,
    warningCount: 0,
    infoCount: 0,
  });
  const [showValidationDrawer, setShowValidationDrawer] = useState(false);
  
  // Run validation whenever nodes or edges change
  useEffect(() => {
    const result = validateWorkflow(nodes, edges);
    setValidationResult(result);
    
    // Auto-show drawer if there are errors
    if (result.errorCount > 0 && !showValidationDrawer) {
      setShowValidationDrawer(true);
    }
  }, [nodes, edges]);
  
  const handleNavigateToNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNodeId(nodeId);
      // Center on node with animation
      reactFlowSetCenter(node.position.x + 100, node.position.y + 50, { duration: 800, zoom: 1.2 });
    }
  }, [nodes, reactFlowSetCenter]);
  
  // ============================================================================
  // Dry Run Debugger (Phase 7)
  // ============================================================================
  
  const [showDebugger, setShowDebugger] = useState(false);

  const [isAISuggestionsVisible, setIsAISuggestionsVisible] = useState(() => {
    try {
      return localStorage.getItem('workforms_ai_suggestions_visible') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleAISuggestionsVisible = useCallback(() => {
    setIsAISuggestionsVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('workforms_ai_suggestions_visible', next ? 'true' : 'false');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const selectedNodeForDebug = useMemo(() => {
    const selected = nodes.find((n) => n.id === selectedNodeId) || null;
    if (selected) return selected;

    const entry = nodes.find((n) => {
      const nodeTypeId = (((n.data as any)?.nodeType as string | undefined) ?? n.type ?? '').toString();
      const def = getNodeTypeDefinition(nodeTypeId);
      return def?.category === 'trigger' || nodeTypeId.startsWith('trigger');
    });

    return entry || nodes[0] || null;
  }, [nodes, selectedNodeId]);

  // ============================================================================
  // Onboarding Tour (Gap Analysis Phase 1.1)
  // ============================================================================
  
  const {
    run: runTour,
    stepIndex: tourStepIndex,
    steps: tourSteps,
    handleJoyrideCallback: handleTourCallback,
    startTour,
    resetTour,
  } = useOnboardingTour({
    name: 'workflow-editor',
    steps: workflowEditorTourSteps,
    autoStart: true, // Auto-start for first-time users
  });
  
  // ============================================================================
  // CRITICAL: Forward declarations for handlers used in early useEffects
  // These prevent TDZ (Temporal Dead Zone) errors in keyboard shortcuts
  // Full implementations are defined later in the file
  // ============================================================================
  
  // Forward ref for handleSave (full implementation at line ~3760)
  // SAFETY: Using forward ref pattern to prevent TDZ issues in early useEffect hooks
  const handleSaveRef = useRef<(() => void) | null>(null);
  const handleSave = useCallback(() => {
    if (handleSaveRef.current) {
      handleSaveRef.current();
    } else {
      logger.warn('[FlowEditor] handleSave called before initialization');
    }
  }, []);
  
  // Forward ref for handleNodeDelete (full implementation at line ~4527)
  // SAFETY: Using forward ref pattern to prevent TDZ issues in keyboard shortcuts
  const handleNodeDeleteRef = useRef<((nodeId: string) => Promise<void>) | null>(null);
  const handleNodeDelete = useCallback(async (nodeId: string) => {
    if (handleNodeDeleteRef.current) {
      await handleNodeDeleteRef.current(nodeId);
    } else {
      logger.warn('[FlowEditor] handleNodeDelete called before initialization');
    }
  }, []);
  
  // ============================================================================
  // Keyboard Shortcuts (Phase 7)
  // ============================================================================
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput(e)) return;
      
      // Ctrl/Cmd + Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        // Undo will be handled by React Flow's internal history
        logger.debug('[Keyboard] Undo requested');
      }
      
      // Ctrl/Cmd + Shift + Z: Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        logger.debug('[Keyboard] Redo requested');
      }
      
      // Ctrl/Cmd + P: Toggle palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setIsPaletteVisible(prev => !prev);
      }
      
      // Ctrl/Cmd + D: Toggle debugger
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        setShowDebugger(prev => !prev);
      }
      
      // Delete: Delete selected node
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          e.preventDefault();
          handleNodeDelete(selectedNodeId);
        }
      }
      
      // Escape: Close all modals
      if (e.key === 'Escape') {
        setShowValidationDrawer(false);
        setShowDebugger(false);
        setIsPaletteVisible(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, handleNodeDelete, handleSave]);
  
  // Filter available node types based on editor mode AND permissions (Phase 4.2)
  const availableNodeTypes = useMemo(() => {
    let filteredNodes = Object.values(NODE_TYPE_REGISTRY);

    logger.debug('[NodePalette] Total nodes in registry:', filteredNodes.length);
    logger.debug('[NodePalette] Editor mode:', activeEditorMode);
    logger.debug('[NodePalette] Allowed categories:', allowedNodeCategories);

    // Step 0: Filter out hidden/deprecated nodes (Phase 6)
    filteredNodes = filteredNodes.filter((nodeType) => !nodeType.hidden);
    logger.debug('[NodePalette] After hidden filtering:', filteredNodes.length);

    // Step 1: Filter by editor mode
    if (activeEditorMode === 'wizard') {
      // Wizard mode: Limited to basic form creation nodes
      filteredNodes = filteredNodes.filter((nodeType) =>
        ['formStep', 'formField', 'conditionIf', 'actionEmail', 'endSuccess'].includes(nodeType.id)
      );
    } else if (activeEditorMode === 'visual') {
      // Visual mode: Most nodes except advanced features
      filteredNodes = filteredNodes.filter((nodeType) => !['customCode', 'apiRequest', 'subflow'].includes(nodeType.id));
    }

    logger.debug('[NodePalette] After mode filtering:', filteredNodes.length);

    // Step 2: Filter by permission categories (if restricted)
    if (allowedNodeCategories && allowedNodeCategories.length > 0) {
      filteredNodes = filteredNodes.filter((nodeType) => allowedNodeCategories.includes(nodeType.category));
      logger.debug('[NodePalette] After permission filtering:', filteredNodes.length);
    }

    logger.debug('[NodePalette] Final available nodes:', filteredNodes.length);
    logger.debug('[NodePalette] Available node IDs:', filteredNodes.map((n) => n.id));

    return filteredNodes;
  }, [activeEditorMode, allowedNodeCategories]);

  // Palette gating UX:
  // - Blank canvas: show ONLY Trigger nodes (forces a clear entrypoint)
  // - Once a Trigger exists: hide Triggers + End Points; show the rest
  const hasTriggerOnCanvas = useMemo(() => {
    return nodes.some((n) => {
      const nodeTypeId = (((n.data as any)?.nodeType as string | undefined) ?? n.type ?? '').toString();
      const def = getNodeTypeDefinition(nodeTypeId);
      return def?.category === 'trigger';
    });
  }, [nodes]);

  const paletteNodeTypes = useMemo(() => {
    const isBlankCanvas = nodes.length === 0;

    if (isBlankCanvas) {
      return availableNodeTypes.filter((nt) => nt.category === 'trigger');
    }

    if (hasTriggerOnCanvas) {
      return availableNodeTypes.filter((nt) => nt.category !== 'trigger' && nt.category !== 'terminal');
    }

    // Non-blank but no trigger (e.g., legacy/imported flows): keep everything except End Points.
    return availableNodeTypes.filter((nt) => nt.category !== 'terminal');
  }, [availableNodeTypes, hasTriggerOnCanvas, nodes.length]);

  const paletteNodeTypeIdSet = useMemo(() => {
    return new Set(paletteNodeTypes.map((n) => n.id));
  }, [paletteNodeTypes]);

  const paletteCategories = useMemo(() => {
    const set = new Set<NodeCategory>();
    paletteNodeTypes.forEach((n) => set.add(n.category));
    return set;
  }, [paletteNodeTypes]);


  // ============================================================================
  // Enhanced Palette Features State
  // ============================================================================
  
  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<NodeCategory>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // If canvas state changes (blank → trigger-added), clear any active filters that no longer apply.
  useEffect(() => {
    setActiveFilters((prev) => {
      const next = new Set(Array.from(prev).filter((c) => paletteCategories.has(c)));
      return next.size === prev.size ? prev : next;
    });
  }, [paletteCategories]);
  
  // Toggle category filter
  const toggleCategoryFilter = useCallback((category: NodeCategory) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      if (newFilters.has(category)) {
        newFilters.delete(category);
      } else {
        newFilters.add(category);
      }
      return newFilters;
    });
  }, []);
  
  // Favorites & Recent
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentNodes, setRecentNodes] = useState<string[]>([]);
  
  // Category collapse state
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  
  // Undo/Redo history
  const [history, setHistory] = useState<HistoryState[]>([{ nodes: normalizedInitialNodes, edges: initialEdges }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Phase 9.5: Local clipboard (nodes only per spec)
  const [clipboardData, setClipboardData] = useState<Node[]>([]);
  const [isPaletteVisible, setIsPaletteVisible] = useState(true);
  const [pendingInsertEdgeId, setPendingInsertEdgeId] = useState<string | null>(null);
  const [pendingInsertAnchorNodeId, setPendingInsertAnchorNodeId] = useState<string | null>(null);

  // Inline insertion: listen for "+" edge events to open palette with context
  useEffect(() => {
    const openPaletteForEdge = (edgeId: string | null) => {
      setPendingInsertEdgeId(edgeId);
      setPendingInsertAnchorNodeId(null);
      setIsPaletteVisible(true);
      requestAnimationFrame(() => searchInputRef.current?.focus());
    };

    const openPaletteForNode = (nodeId: string | null) => {
      setPendingInsertEdgeId(null);
      setPendingInsertAnchorNodeId(nodeId);
      setSelectedNodeId(nodeId);
      setSelectedNode(null);
      setIsPaletteVisible(true);
      requestAnimationFrame(() => searchInputRef.current?.focus());
    };

    const handleOpenPalette = (event: Event) => {
      const detail = (event as CustomEvent<{ insertOnEdgeId?: string; anchorNodeId?: string }>).detail;
      if (detail?.anchorNodeId) {
        openPaletteForNode(detail.anchorNodeId);
        return;
      }
      openPaletteForEdge(detail?.insertOnEdgeId || null);
    };

    const handleInsertNodeBetween = (event: Event) => {
      const detail = (event as CustomEvent<{ edgeId?: string }>).detail;
      openPaletteForEdge(detail?.edgeId || null);
    };

    window.addEventListener('pm:openNodePalette', handleOpenPalette as EventListener);
    window.addEventListener('insert-node-between', handleInsertNodeBetween as EventListener);

    return () => {
      window.removeEventListener('pm:openNodePalette', handleOpenPalette as EventListener);
      window.removeEventListener('insert-node-between', handleInsertNodeBetween as EventListener);
    };
  }, []);

  // Configuration Panel
  // NOTE: selectedNode and selectedNodeId moved to top of component to fix TDZ
  
  // FormStep specialized configuration (Phase 4.2.B Integration) - For nested field editing
  const [selectedFormStep, setSelectedFormStep] = useState<Node<any> | null>(null);
  const [formStepModalOpen, setFormStepModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<any | null>(null);
  
  // Container configuration (Phase 4.3) - FormProcess special handling
  const [containerModalOpen, setContainerModalOpen] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<Node<any> | null>(null);
  
  // Preview panel (Phase 5.1)
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  
  // Sprint 1 Task 1.3: Minimap toggle
  const [isMinimapVisible, setIsMinimapVisible] = useState(true);
  
  // Sprint 1 Task 1.4: Background & Grid controls
  const [backgroundVariant, setBackgroundVariant] = useState<BackgroundVariant>(BackgroundVariant.Dots);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(15);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  
  // Deprecated node detection (Phase 6.1)
  const [hasDeprecatedNodes, setHasDeprecatedNodes] = useState(false);
  const [deprecatedNodeTypes, setDeprecatedNodeTypes] = useState<string[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  
  // Fetch tenant lists for dropdown options (Phase 4.2.B Integration)
  const { data: tenantLists = [] } = useQuery({
    queryKey: ['workflows', 'tenant-lists'],
    queryFn: async () => {
      const response = await adminClient.get('/workflows/lists/');
      return response.data.results || response.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!editingField, // Only fetch when needed
  });

  // Fetch system choice lists for dropdown options (SystemChoiceList)
  const { data: systemChoiceLists = [] } = useQuery({
    queryKey: ['system', 'choice-lists'],
    queryFn: async () => {
      const response = await adminClient.get('/system/choice-lists/');
      const raw = response.data as unknown;
      if (Array.isArray(raw)) return raw;
      if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        if (Array.isArray(obj.results)) return obj.results;
      }
      return [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!editingField,
  });
  
  // Drag-drop state for ghost preview and smart snapping
  const [isDragging, setIsDragging] = useState(false);
  const [dragNodeType, setDragNodeType] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoveredContainerId, setHoveredContainerId] = useState<string | null>(null); // Phase E: Drop zone feedback
  
  // Phase E: Update container nodes with hover state for visual feedback
  useEffect(() => {
    if (isDragging) {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === 'formMultiStepContainer') {
            return {
              ...n,
              data: {
                ...n.data,
                isDropTarget: n.id === hoveredContainerId,
              },
            };
          }
          return n;
        })
      );
    }
  }, [hoveredContainerId, isDragging, setNodes]);
  
  // Alignment guides state
  const [alignmentGuides, setAlignmentGuides] = useState<{
    horizontal: number[];
    vertical: number[];
  }>({ horizontal: [], vertical: [] });
  
  // Proximity detection state
  const [nearbyNode, setNearbyNode] = useState<Node | null>(null);
  
  // Track drag start position to detect significant movement
  const dragStartPositionRef = useRef<{ nodeId: string; x: number; y: number } | null>(null);
  
  // Track if a drop succeeded to prevent onDragEnd from undoing changes
  const dropSucceededRef = useRef(false);
  
  // ============================================================================
  // Expert Mode (Deprecated)
  // ============================================================================
  // Legacy JSON editor removed in Phase 7 hardening.
  // Raw JSON escape hatch remains available via TabbedConfigPanel → Advanced → Developer Mode.
  
  // ============================================================================
  // Template Selector State (Phase 2.5 Integration)
  // ============================================================================
  
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  
  // ============================================================================
  // Workflow Persistence State (Phase 7)
  // ============================================================================
  
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | undefined>(initialWorkflowId);
  const [currentWorkflowName, setCurrentWorkflowName] = useState<string>(
    initialWorkflowName || 'Untitled Workflow'
  );
  const [currentWorkflowDescription, setCurrentWorkflowDescription] = useState<string>(
    initialWorkflowDescription || ''
  ); // Phase 8.2
  const [currentWorkflowStatus, setCurrentWorkflowStatus] = useState<'draft' | 'active' | 'archived'>(
    initialWorkflowStatus || 'draft'
  ); // Phase 8.2
  const [workflowList, setWorkflowList] = useState<WorkflowListItem[]>([]);
  const [isLoadMenuOpen, setIsLoadMenuOpen] = useState(false);

  // Keep workflow metadata in sync when the parent route/page swaps the loaded workflow.
  useEffect(() => {
    if (initialWorkflowId !== undefined) setCurrentWorkflowId(initialWorkflowId);
    if (initialWorkflowName !== undefined) setCurrentWorkflowName(initialWorkflowName || 'Untitled Workflow');
    if (initialWorkflowDescription !== undefined) setCurrentWorkflowDescription(initialWorkflowDescription || '');
    if (initialWorkflowStatus !== undefined)
      setCurrentWorkflowStatus(initialWorkflowStatus || 'draft');
  }, [initialWorkflowId, initialWorkflowName, initialWorkflowDescription, initialWorkflowStatus]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false); // Phase 8.2
  const [workflowModalMode, setWorkflowModalMode] = useState<'create' | 'edit'>('create'); // Phase 8.2
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false); // Workform Batch 2
  const [workflowSearchQuery, setWorkflowSearchQuery] = useState(''); // Phase 8.3
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false); // Phase 8.3
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowListItem | null>(null); // Phase 8.3
  const [isDeleting, setIsDeleting] = useState(false); // Phase 8.3
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false); // Phase 8.6
  const [isExecutionModalOpen, setIsExecutionModalOpen] = useState(false); // Task 1: Workflow Execution
  const [isFlowPreviewOpen, setIsFlowPreviewOpen] = useState(false); // Phase 1: Hybrid Functionality

  // ============================================================================
  // Phase 9.2: Collaboration & Presence
  // ============================================================================

  const tenantId = getCurrentTenant() ?? '';
  const { presence: collabPresence, sendCursor: collabSendCursor, sendSelection: collabSendSelection } =
    useCollaboration({ workflowId: currentWorkflowId, tenantId });

  const collabSendCursorDebounced = useMemo(
    () => debounce((cursor: { x: number; y: number }) => collabSendCursor(cursor), 30),
    [collabSendCursor]
  );

  useEffect(() => {
    return () => {
      collabSendCursorDebounced.cancel();
    };
  }, [collabSendCursorDebounced]);

  // ============================================================================
  // Wizard Mode State (Phase 2.2 Batch 3)
  // ============================================================================

  type WizardStep = 'welcome' | 'flow-type' | 'add-nodes' | 'preview' | 'complete';
  type FlowType = 'form' | 'workflow' | 'approval' | 'document';

  interface WizardState {
    currentStep: WizardStep;
    flowType: FlowType | null;
    flowName: string;
    flowDescription: string;
    suggestedNodes: string[];
    addedNodeCount: number;
  }

  const [wizardState, setWizardState] = useState<WizardState>({
    currentStep: 'welcome',
    flowType: null,
    flowName: '',
    flowDescription: '',
    suggestedNodes: [],
    addedNodeCount: 0,
  });

  // Reset wizard when entering wizard mode
  useEffect(() => {
    if (activeEditorMode === 'wizard' && wizardState.currentStep !== 'welcome') {
      // Only reset if switching from another mode, not on initial load
      setWizardState({
        currentStep: 'welcome',
        flowType: null,
        flowName: '',
        flowDescription: '',
        suggestedNodes: [],
        addedNodeCount: 0,
      });
    }
  }, [activeEditorMode]);
  
  // Auto-load template in wizard mode when canvas is empty (Task 3)
  useEffect(() => {
    if (activeEditorMode === 'wizard' && nodes.length === 0) {
      // Find the Simple Contact Form template
      const simpleContactTemplate = FLOW_TEMPLATES.find(t => t.id === 'simple-contact-form');
      if (simpleContactTemplate) {
        // Load the template nodes and edges
        setNodes(simpleContactTemplate.nodes);
        setEdges(simpleContactTemplate.edges);
        
        logger.debug('[Wizard Mode] Auto-loaded Simple Contact Form template');
      }
    }
  }, [activeEditorMode, nodes.length, setNodes, setEdges]);

  // Expert Mode JSON editor removed (Phase 7 hardening).

  // ============================================================================
  // Wizard Mode Functions (Phase 2.2 Batch 3)
  // ============================================================================
  
  const wizardNextStep = useCallback(() => {
    const { currentStep, flowType } = wizardState;
    
    if (currentStep === 'welcome') {
      setWizardState(prev => ({ ...prev, currentStep: 'flow-type' }));
    } else if (currentStep === 'flow-type' && flowType) {
      // Generate suggested nodes based on flow type
      const suggestions = getNodeSuggestionsForFlowType(flowType);
      setWizardState(prev => ({ 
        ...prev, 
        currentStep: 'add-nodes',
        suggestedNodes: suggestions,
      }));
    } else if (currentStep === 'add-nodes') {
      setWizardState(prev => ({ ...prev, currentStep: 'preview' }));
    } else if (currentStep === 'preview') {
      setWizardState(prev => ({ ...prev, currentStep: 'complete' }));
    }
  }, [wizardState]);
  
  const wizardPrevStep = useCallback(() => {
    const { currentStep } = wizardState;
    
    if (currentStep === 'flow-type') {
      setWizardState(prev => ({ ...prev, currentStep: 'welcome' }));
    } else if (currentStep === 'add-nodes') {
      setWizardState(prev => ({ ...prev, currentStep: 'flow-type' }));
    } else if (currentStep === 'preview') {
      setWizardState(prev => ({ ...prev, currentStep: 'add-nodes' }));
    }
  }, [wizardState]);
  
  const setWizardFlowType = useCallback((type: FlowType) => {
    setWizardState(prev => ({ ...prev, flowType: type }));
  }, []);
  
  const setWizardFlowName = useCallback((name: string) => {
    setWizardState(prev => ({ ...prev, flowName: name }));
  }, []);
  
  const wizardAddNode = useCallback(
    (nodeType: string) => {
      const newNodeId = generateNodeId();
      const newNode = {
        id: newNodeId,
        type: nodeType,
        position: { x: 250 + wizardState.addedNodeCount * 200, y: 100 },
        data: { label: NODE_TYPE_REGISTRY[nodeType]?.name || 'New Node' },
      };

      setNodes((nds) => [...nds, newNode]);
      setWizardState((prev) => ({
        ...prev,
        addedNodeCount: prev.addedNodeCount + 1,
      }));

      // Auto-connect to previous node if exists
      if (nodes.length > 0 && wizardState.addedNodeCount > 0) {
        const prevNode = nodes[nodes.length - 1];
        const newEdge: Edge = {
          id: `edge-${prevNode.id}-${newNode.id}`,
          source: prevNode.id,
          target: newNode.id,
        };
        setEdges((eds) => [...eds, newEdge]);
      }
    },
    [generateNodeId, wizardState.addedNodeCount, nodes, setNodes, setEdges]
  );
  
  const getNodeSuggestionsForFlowType = (flowType: FlowType): string[] => {
    // Use actual NODE_TYPE_REGISTRY IDs instead of generic names
    const suggestions = {
      form: ['triggerManual', 'formStep', 'actionEmail', 'conditionBranch'],
      workflow: ['triggerManual', 'conditionBranch', 'actionEmail', 'waitApproval'],
      approval: ['triggerManual', 'waitApproval', 'conditionBranch', 'actionNotify'],
      document: ['triggerManual', 'formStep', 'documentGenerate', 'actionEmail'],
    };
    return suggestions[flowType] || [];
  };
  
  const wizardSwitchToVisual = useCallback(() => {
    setInternalEditorMode('visual');
    setWizardState({
      currentStep: 'welcome',
      flowType: null,
      flowName: '',
      flowDescription: '',
      suggestedNodes: [],
      addedNodeCount: 0,
    });
  }, []);

  // ============================================================================
  // LocalStorage: Load favorites, recents, collapsed on mount
  // ============================================================================
  
  useEffect(() => {
    try {
      const storedFavorites = localStorage.getItem('flow_editor_favorites');
      if (storedFavorites) {
        setFavorites(JSON.parse(storedFavorites));
      }
      
      const storedRecent = localStorage.getItem('flow_editor_recent');
      if (storedRecent) {
        setRecentNodes(JSON.parse(storedRecent));
      }
      
      const storedCollapsed = localStorage.getItem('flow_editor_collapsed_categories');
      if (storedCollapsed) {
        setCollapsedCategories(new Set(JSON.parse(storedCollapsed)));
      }
    } catch (e) {
      logger.error('Failed to load editor preferences:', e);
    }
  }, []);

  // ============================================================================
  // Favorites: Toggle favorite status
  // ============================================================================
  
  const toggleFavorite = useCallback((nodeTypeId: string) => {
    setFavorites(prev => {
      const newFavorites = prev.includes(nodeTypeId)
        ? prev.filter(id => id !== nodeTypeId)
        : [...prev, nodeTypeId];
      
      localStorage.setItem('flow_editor_favorites', JSON.stringify(newFavorites));
      return newFavorites;
    });
  }, []);

  // ============================================================================
  // Recent Nodes: Track on drag
  // ============================================================================
  
  const addToRecent = useCallback((nodeTypeId: string) => {
    setRecentNodes(prev => {
      const filtered = prev.filter(id => id !== nodeTypeId);
      const newRecent = [nodeTypeId, ...filtered].slice(0, 5); // Keep last 5
      
      localStorage.setItem('flow_editor_recent', JSON.stringify(newRecent));
      return newRecent;
    });
  }, []);

  // ============================================================================
  // Category Collapse: Toggle category
  // ============================================================================
  
  const toggleCategoryCollapse = useCallback((category: NodeCategory) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      
      localStorage.setItem('flow_editor_collapsed_categories', JSON.stringify([...newSet]));
      return newSet;
    });
  }, []);

  // ============================================================================
  // Undo/Redo: Track history
  // ============================================================================
  
  useEffect(() => {
    const sanitizeForClone = (value: unknown): unknown => {
      if (!value || typeof value !== 'object') return value;
      if (Array.isArray(value)) return value.map(sanitizeForClone);

      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (typeof v === 'function') continue;
        out[k] = sanitizeForClone(v);
      }
      return out;
    };

    // Debounce history tracking to avoid too many snapshots
    const timer = setTimeout(() => {
      const sanitizedCurrentState = {
        nodes: nodes.map((n) => ({
          ...n,
          data: sanitizeForClone(n.data) as any,
        })),
        edges: edges.map((e) => ({ ...e })),
      };

      // Use structuredClone to avoid shallow-reference mutation bugs
      // (deep changes inside node.data must produce stable history snapshots).
      const currentState = structuredClone(sanitizedCurrentState) as HistoryState;
      const lastState = history[historyIndex];

      // Only add to history if state actually changed
      if (JSON.stringify(currentState) !== JSON.stringify(lastState)) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(currentState);

        // Keep max 50 history states (strict cap)
        if (newHistory.length > 50) {
          newHistory.shift();
          setHistoryIndex(49);
        } else {
          setHistoryIndex((prev) => prev + 1);
        }

        setHistory(newHistory);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [nodes, edges]); // Only track when nodes or edges change

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      setNodes(state.nodes);
      setEdges(state.edges);
      setHistoryIndex(newIndex);
    }
  }, [historyIndex, history, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      setNodes(state.nodes);
      setEdges(state.edges);
      setHistoryIndex(newIndex);
    }
  }, [historyIndex, history, setNodes, setEdges]);

  // ============================================================================
  // Connection Validation
  // ============================================================================
  
  // Define connection compatibility rules
  const isValidConnectionType = useCallback((sourceType: string, targetType: string): { valid: boolean; reason?: string } => {
    // Triggers can only be at the start (no inputs)
    if (targetType.startsWith('trigger')) {
      return { valid: false, reason: 'Triggers cannot have incoming connections' };
    }
    
    // Terminal nodes (success/error) can only be at the end (no outputs)
    if (sourceType.startsWith('terminal')) {
      return { valid: false, reason: 'Terminal nodes cannot have outgoing connections' };
    }
    
    // Document nodes should typically connect to actions or conditions
    if (sourceType.startsWith('document') && targetType.startsWith('trigger')) {
      return { valid: false, reason: 'Documents cannot connect to triggers' };
    }
    
    // Wait states should not connect to triggers
    if (sourceType.startsWith('wait') && targetType.startsWith('trigger')) {
      return { valid: false, reason: 'Wait states cannot connect to triggers' };
    }
    
    // All other connections are valid
    return { valid: true };
  }, []);
  
  // Helper function to safely get max connections from node data or type definition
  const getNodeMaxConnections = useCallback((node: Node<any>): { maxInputs: number; maxOutputs: number } => {
    // First try to get from node data
    const data = node.data as any;
    if (data && typeof data.maxInputs === 'number' && typeof data.maxOutputs === 'number') {
      return {
        maxInputs: data.maxInputs,
        maxOutputs: data.maxOutputs,
      };
    }
    
    // Fall back to node type definition
    const nodeType = node.type || '';
    const nodeDef = NODE_TYPE_REGISTRY[nodeType];
    
    if (nodeDef) {
      return {
        maxInputs: nodeDef.maxInputs ?? 1,
        maxOutputs: nodeDef.maxOutputs ?? 1,
      };
    }
    
    // Default fallback
    return {
      maxInputs: 1,
      maxOutputs: 1,
    };
  }, []);
  
  // Real-time connection validation for React Flow
  const isValidConnection = useCallback((connection: Connection | Edge) => {
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    
    if (!sourceNode || !targetNode) {
      toast.error('Cannot connect: one or both nodes not found', {
        duration: 2500,
        icon: '❌',
      });
      return false;
    }
    
    // Type-aware validation
    const typeCheck = isValidConnectionType(sourceNode.type || '', targetNode.type || '');
    if (!typeCheck.valid) {
      // This already shows a toast in the earlier code (lines 3009-3063)
      return false;
    }
    
    // Check max outputs on source
    const sourceOutputs = edges.filter(e => e.source === connection.source);
    const { maxOutputs: sourceMaxOutputs } = getNodeMaxConnections(sourceNode);
    if (sourceMaxOutputs !== -1 && sourceOutputs.length >= sourceMaxOutputs) {
      const sourceLabel = sourceNode.data?.label || 'Source node';
      toast.error(`${sourceLabel} has reached its maximum of ${sourceMaxOutputs} output connection${sourceMaxOutputs > 1 ? 's' : ''}`, {
        duration: 3000,
        icon: '⚠️',
      });
      return false;
    }
    
    // Check max inputs on target
    const targetInputs = edges.filter(e => e.target === connection.target);
    const { maxInputs: targetMaxInputs } = getNodeMaxConnections(targetNode);
    if (targetMaxInputs !== -1 && targetInputs.length >= targetMaxInputs) {
      const targetLabel = targetNode.data?.label || 'Target node';
      toast.error(`${targetLabel} has reached its maximum of ${targetMaxInputs} input connection${targetMaxInputs > 1 ? 's' : ''}`, {
        duration: 3000,
        icon: '⚠️',
      });
      return false;
    }
    
    return true;
  }, [nodes, edges, isValidConnectionType, getNodeMaxConnections]);
  
  const onConnect = useCallback(
    (params: Connection) => {
      // Validate connection based on node constraints
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);
      
      if (!sourceNode || !targetNode) return;
      
      // Phase 10: WYSIWYG Form Flow
      // Container boundaries are permeable: allow edges to leave/re-enter containers.
      // Type-aware validation
      const typeCheck = isValidConnectionType(sourceNode.type || '', targetNode.type || '');
      if (!typeCheck.valid) {
        logger.warn(`Invalid connection: ${typeCheck.reason}`);
        toast.error(`Invalid connection: ${typeCheck.reason}`, {
          duration: 5000,
          icon: '⚠️',
        });
        Sentry.captureMessage('Invalid connection type', {
          level: 'info',
          extra: { 
            sourceType: sourceNode.type, 
            targetType: targetNode.type,
            reason: typeCheck.reason,
          },
        });
        return;
      }
      
      // Check max outputs on source
      const sourceOutputs = edges.filter(e => e.source === params.source);
      const { maxOutputs: sourceMaxOutputs } = getNodeMaxConnections(sourceNode);
      if (sourceMaxOutputs !== -1 && sourceOutputs.length >= sourceMaxOutputs) {
        const label = sourceNode.data?.label || `Node ${sourceNode.id}`;
        logger.warn(`Node ${label} has reached max outputs (${sourceMaxOutputs})`);
        return;
      }
      
      // Check max inputs on target
      const targetInputs = edges.filter(e => e.target === params.target);
      const { maxInputs: targetMaxInputs } = getNodeMaxConnections(targetNode);
      if (targetMaxInputs !== -1 && targetInputs.length >= targetMaxInputs) {
        const label = targetNode.data?.label || `Node ${targetNode.id}`;
        logger.warn(`Node ${label} has reached max inputs (${targetMaxInputs})`);
        return;
      }
      
      setEdges((eds) => addEdge(params, eds));
    },
    [nodes, edges, setEdges, isValidConnectionType, getNodeMaxConnections]
  );

  // ============================================================================
  // Task 2: Ghost Node Deletion Handler
  // ============================================================================
  
  const onNodesDelete = useCallback(async (deletedNodes: Node[]) => {
    const deletedIds = new Set<string>(deletedNodes.map((n) => n.id));

    // If a container is deleted, include all descendants (parentId chain) so we can clean edges robustly.
    const snapshot = nodesRef.current;
    const queue = Array.from(deletedIds);

    while (queue.length > 0) {
      const parentId = queue.pop()!;
      for (const n of snapshot) {
        if (n.parentId === parentId && !deletedIds.has(n.id)) {
          deletedIds.add(n.id);
          queue.push(n.id);
        }
      }
    }

    // Aggressive edge cleanup: remove any edge referencing any deleted node (parents or children)
    setEdges((eds) => eds.filter((e) => !deletedIds.has(e.source) && !deletedIds.has(e.target)));

    // Ghost cleanup
    for (const node of deletedNodes) {
      const tenantFormId = node.data?.tenantFormId;
      if (node.type === 'formMultiStepContainer' && typeof tenantFormId === 'string' && tenantFormId.length > 0) {
        try {
          const result = await workformsApi.decrementFormUsage(tenantFormId);
          logger.debug(`[Ghost Cleanup] ✅ Decremented usage for container: ${result.usage_count} remaining`);

          if (result.can_delete) {
            logger.debug('[Ghost Cleanup] 🗑️ Form is now orphaned (usage_count=0). Will be cleaned up by background task.');
          }
        } catch (error) {
          logger.error('[Ghost Cleanup] ❌ Failed to decrement usage:', error);
        }
      }
    }
  }, [setEdges]);

  // ============================================================================
  // Drag & Drop Handlers
  // ============================================================================
  
  // Helper: Find nearby node for auto-connect
  const findNearbyNode = useCallback((position: { x: number; y: number }, threshold = 100) => {
    for (const node of nodes) {
      const dx = Math.abs(node.position.x - position.x);
      const dy = Math.abs(node.position.y - position.y);
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < threshold) {
        return node;
      }
    }
    return null;
  }, [nodes]);
  
  // Helper: Detect alignment with existing nodes
  const detectAlignment = useCallback((position: { x: number; y: number }, tolerance = 5) => {
    const horizontalGuides: number[] = [];
    const verticalGuides: number[] = [];
    
    nodes.forEach(node => {
      // Check horizontal alignment (Y coordinate)
      if (Math.abs(node.position.y - position.y) < tolerance) {
        horizontalGuides.push(node.position.y);
      }
      
      // Check vertical alignment (X coordinate)
      if (Math.abs(node.position.x - position.x) < tolerance) {
        verticalGuides.push(node.position.x);
      }
    });
    
    // Remove duplicates
    return {
      horizontal: Array.from(new Set(horizontalGuides)),
      vertical: Array.from(new Set(verticalGuides)),
    };
  }, [nodes]);
  
  const onDragStart = useCallback((event: React.DragEvent, nodeTypeId: string) => {
    event.dataTransfer.setData('application/reactflow-nodetype', nodeTypeId);
    event.dataTransfer.effectAllowed = 'move';

    // Reset drop succeeded flag when starting a new drag
    dropSucceededRef.current = false;

    // Track drag state for ghost preview
    setIsDragging(true);
    setDragNodeType(nodeTypeId);

    // Track as recently used
    addToRecent(nodeTypeId);
  }, [addToRecent]);

  const applyAutoLayoutImmediate = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nextNodes, nextEdges, {
        direction: 'TB',
        nodeSpacing: 60,
        rankSpacing: 120,
      });

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setHasUnsavedChanges(true);
    },
    [setNodes, setEdges]
  );

  const handleClickToAddNode = useCallback(
    (nodeTypeId: string) => {
      if (readOnly) return;

      addToRecent(nodeTypeId);

      const insertEdge = pendingInsertEdgeId ? edges.find((e) => e.id === pendingInsertEdgeId) : null;

      const isNewContainer = isFormProcessContainerType(nodeTypeId);

      const newNodeId = generateNodeId();
      const reactFlowType = getReactFlowNodeType(nodeTypeId);

      // Ensure default dimensions upfront (prevents React Flow dimension errors)
      const defaultDimensions = isNewContainer ? { width: 600, height: 400 } : undefined;

      const newNode: Node = {
        id: newNodeId,
        type: reactFlowType,
        position: { x: 0, y: 0 },
        ...(defaultDimensions && { style: defaultDimensions }),
        data: {
          label: NODE_TYPE_REGISTRY[nodeTypeId]?.name || 'New Node',
          status: 'draft',
          ...getDefaultNodeData(nodeTypeId),
        },
        selected: true,
      };

      // Form Process: keep container semantics in node.data.nodeType, render as STANDARD React Flow default node
      if (isNewContainer) {
        newNode.style = {
          width: 600,
          height: 400,
        };
        newNode.data = {
          ...newNode.data,
          nodeType: 'formProcess',
          isExpanded: true,
          isGroup: true,
        };
      }

      const spawnDefaultFormPages = (parentId: string) => {
        const page1Id = generateNodeId();
        const page2Id = generateNodeId();

        const makePage = (id: string, index: number): Node => ({
          id,
          type: 'form',
          parentId,
          extent: 'parent',
          expandParent: true,
          position: { x: 50 + index * 350, y: 80 },
          draggable: false,
          data: {
            label: `Page ${index + 1}`,
            status: 'draft',
            fields: [],
            ...getDefaultNodeData('form'),
          },
          selected: index === 0,
        });

        return { pageNodes: [makePage(page1Id, 0), makePage(page2Id, 1)], pageIds: [page1Id, page2Id] };
      };

      const selectOnly = (ns: Node[], selectedId: string) => ns.map((n) => ({ ...n, selected: n.id === selectedId }));

      // If we're in "insert between edge" mode, split the target edge
      if (insertEdge) {
        const sourceNode = nodes.find((n) => n.id === insertEdge.source);
        const targetNode = nodes.find((n) => n.id === insertEdge.target);

        if (sourceNode && targetNode) {
          const sharedParentId =
            sourceNode.parentId && sourceNode.parentId === targetNode.parentId ? sourceNode.parentId : undefined;

          if (sharedParentId) {
            newNode.parentId = sharedParentId;
            newNode.extent = 'parent';
            newNode.expandParent = true;
          }

          newNode.position = {
            x: (sourceNode.position.x + targetNode.position.x) / 2,
            y: (sourceNode.position.y + targetNode.position.y) / 2,
          };
        }

        const nextEdges: Edge[] = [
          ...edges.filter((e) => e.id !== insertEdge.id),
          {
            id: `edge-${insertEdge.source}-${newNodeId}`,
            source: insertEdge.source,
            target: newNodeId,
            type: 'insert',
          },
          {
            id: `edge-${newNodeId}-${insertEdge.target}`,
            source: newNodeId,
            target: insertEdge.target,
            type: 'insert',
          },
        ];

        const nodesToAdd: Node[] = [newNode];
        let selectedId = newNodeId;

        if (isNewContainer) {
          const { pageNodes, pageIds } = spawnDefaultFormPages(newNodeId);
          nodesToAdd.push(...pageNodes);
          selectedId = pageIds[0];
        }

        const nextNodes = selectOnly([...nodes, ...nodesToAdd], selectedId);

        setPendingInsertEdgeId(null);
        setPendingInsertAnchorNodeId(null);
        setSelectedNodeId(selectedId);
        setSelectedNode(null);

        if (isNewContainer) {
          const layoutResult = calculateContainerLayout(newNodeId, nextNodes, nextEdges);
          const connectionResult = autoConnectSequentialSteps(newNodeId, layoutResult.nodes, nextEdges);
          const finalNodes = sortNodesTopologically(
            layoutResult.nodes.map((n) => {
              if (n.id !== newNodeId) return n;
              return {
                ...n,
                style: {
                  ...(n.style || {}),
                  width: Math.max(layoutResult.containerWidth, (n.style as any)?.width || 600),
                  height: Math.max(layoutResult.containerHeight, (n.style as any)?.height || 400),
                },
              };
            })
          );
          setNodes(finalNodes);
          setEdges(connectionResult.edges);
          setHasUnsavedChanges(true);
        } else {
          applyAutoLayoutImmediate(nextNodes, nextEdges);
        }
        return;
      }

      // Otherwise, insert directly below the selected node (or the bottom-most node)
      const selectedById = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) || null : null;
      const pendingAnchor = pendingInsertAnchorNodeId ? nodes.find((n) => n.id === pendingInsertAnchorNodeId) || null : null;
      const bottomMost = [...nodes]
        .filter((n) => !n.hidden)
        .sort((a, b) => (b.position?.y ?? 0) - (a.position?.y ?? 0))[0];

      const anchor = pendingAnchor || selectedNode || selectedById || nodes.find((n) => n.selected) || bottomMost || null;

      if (anchor) {
        // Preserve container context if inserting within a group
        if (anchor.parentId) {
          newNode.parentId = anchor.parentId;
          newNode.extent = 'parent';
          newNode.expandParent = true;
        }

        newNode.position = {
          x: anchor.position.x,
          y: anchor.position.y + 150,
        };

        const nextEdges: Edge[] = [
          ...edges,
          {
            id: `edge-${anchor.id}-${newNodeId}`,
            source: anchor.id,
            target: newNodeId,
            type: 'insert',
          },
        ];

        const nodesToAdd: Node[] = [newNode];
        let selectedId = newNodeId;

        if (isNewContainer) {
          const { pageNodes, pageIds } = spawnDefaultFormPages(newNodeId);
          nodesToAdd.push(...pageNodes);
          selectedId = pageIds[0];
        }

        const nextNodes = selectOnly([...nodes, ...nodesToAdd], selectedId);

        setSelectedNodeId(selectedId);
        setSelectedNode(null);

        if (isNewContainer) {
          const layoutResult = calculateContainerLayout(newNodeId, nextNodes, nextEdges);
          const connectionResult = autoConnectSequentialSteps(newNodeId, layoutResult.nodes, nextEdges);
          const finalNodes = sortNodesTopologically(
            layoutResult.nodes.map((n) => {
              if (n.id !== newNodeId) return n;
              return {
                ...n,
                style: {
                  ...(n.style || {}),
                  width: Math.max(layoutResult.containerWidth, (n.style as any)?.width || 600),
                  height: Math.max(layoutResult.containerHeight, (n.style as any)?.height || 400),
                },
              };
            })
          );
          setNodes(finalNodes);
          setEdges(connectionResult.edges);
          setHasUnsavedChanges(true);
        } else {
          applyAutoLayoutImmediate(nextNodes, nextEdges);
        }
      } else {
        const nextEdges: Edge[] = [...edges];

        const nodesToAdd: Node[] = [newNode];
        let selectedId = newNodeId;

        if (isNewContainer) {
          const { pageNodes, pageIds } = spawnDefaultFormPages(newNodeId);
          nodesToAdd.push(...pageNodes);
          selectedId = pageIds[0];
        }

        const nextNodes = selectOnly([...nodes, ...nodesToAdd], selectedId);

        setPendingInsertAnchorNodeId(null);
        setSelectedNodeId(selectedId);
        setSelectedNode(null);

        if (isNewContainer) {
          const layoutResult = calculateContainerLayout(newNodeId, nextNodes, nextEdges);
          const connectionResult = autoConnectSequentialSteps(newNodeId, layoutResult.nodes, nextEdges);
          const finalNodes = sortNodesTopologically(
            layoutResult.nodes.map((n) => {
              if (n.id !== newNodeId) return n;
              return {
                ...n,
                style: {
                  ...(n.style || {}),
                  width: Math.max(layoutResult.containerWidth, (n.style as any)?.width || 600),
                  height: Math.max(layoutResult.containerHeight, (n.style as any)?.height || 400),
                },
              };
            })
          );
          setNodes(finalNodes);
          setEdges(connectionResult.edges);
          setHasUnsavedChanges(true);
        } else {
          applyAutoLayoutImmediate(nextNodes, nextEdges);
        }
      }
    },
    [
      readOnly,
      addToRecent,
      pendingInsertEdgeId,
      pendingInsertAnchorNodeId,
      edges,
      nodes,
      generateNodeId,
      selectedNode,
      selectedNodeId,
      applyAutoLayoutImmediate,
    ]
  );

  // ============================================================================
  // Container Detection Helper (Phase E)
  // ============================================================================
  
  /**
   * Detect if a position is inside a container node
   * HOTFIX 2026-02-09: Reverted to manual bounding box detection
   * 
   * Root Cause: getIntersectingNodes() was returning 0 nodes even when containers exist
   * Console logs showed "Intersecting nodes found: 0" every time
   * Manual bounding box is more reliable and predictable
   * 
   * Enhanced logging added for debugging container detection issues
   */
  const findContainerAtPosition = useCallback((position: { x: number; y: number }) => {
    logger.debug('[Container] =================================');
    logger.debug('[Container] Looking for containers at position:', position);
    
    // Get all container nodes (support both formMultiStepContainer and formProcessGroup)
    const containerNodes = nodes.filter((node) =>
      isFormProcessContainerType(((node.data as any)?.nodeType as string | undefined) || node.type)
    );
    
    logger.debug('[Container] Total nodes on canvas:', nodes.length);
    logger.debug('[Container] Container nodes found:', containerNodes.length);
    
    if (containerNodes.length === 0) {
      logger.debug('[Container] ❌ No containers on canvas');
      return null;
    }
    
    // Manual bounding box detection
    for (const container of containerNodes) {
      // CRITICAL: Use measured dimensions if available (React Flow has calculated them)
      // For expanded containers, measured dimensions are much larger than style dimensions
      // Otherwise fall back to style or defaults
      const containerWidth = container.measured?.width || 
                            (typeof container.style?.width === 'number' ? container.style.width : 
                             typeof container.width === 'number' ? container.width : 600);
      const containerHeight = container.measured?.height || 
                             (typeof container.style?.height === 'number' ? container.style.height : 
                              typeof container.height === 'number' ? container.height : 400);
      
      // Use actual dimensions - don't inflate hit box
      // Container should only capture drops that are VISUALLY inside it
      
      // Calculate bounding box
      const bounds = {
        left: container.position.x,
        right: container.position.x + containerWidth,
        top: container.position.y,
        bottom: container.position.y + containerHeight, // Use actual dimensions
      };
      
      logger.debug(`[Container] Checking ${container.id}:`, {
        type: container.type,
        position: container.position,
        dimensions: { width: containerWidth, height: containerHeight },
        bounds: bounds,
        isExpanded: container.data?.isExpanded,
      });
      
      // Check if drop position is within bounds
      if (
        position.x >= bounds.left &&
        position.x <= bounds.right &&
        position.y >= bounds.top &&
        position.y <= bounds.bottom
      ) {
        logger.debug(`[Container] ✅ Found matching container: ${container.id}`);
        return container;
      } else {
        logger.debug(`[Container] ❌ Position outside ${container.id} bounds`);
      }
    }
    
    logger.debug('[Container] ❌ No container matched at position');
    return null;
  }, [nodes]);

  const handleAddNodeFromAISuggestion = useCallback(
    (nodeTypeId: string, position?: { x: number; y: number }) => {
      if (readOnly) return;

      // Container creation is complex (pages, layout, etc.) — route through the existing click-to-add flow.
      if (!position || isFormProcessContainerType(nodeTypeId)) {
        handleClickToAddNode(nodeTypeId);
        return;
      }

      const snapped = {
        x: Math.round(position.x / 15) * 15,
        y: Math.round(position.y / 15) * 15,
      };

      const newNodeId = generateNodeId();
      const reactFlowType = getReactFlowNodeType(nodeTypeId);

      const selected = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) || null : null;
      const nearby = findNearbyNode(snapped);
      const anchor = selected || nearby;

      const newNode: Node = {
        id: newNodeId,
        type: reactFlowType,
        position: snapped,
        data: {
          label: NODE_TYPE_REGISTRY[nodeTypeId]?.name || 'New Node',
          status: 'draft',
          ...getDefaultNodeData(nodeTypeId),
        },
        selected: true,
      };

      // Prefer the selected node's container context.
      if (selected?.parentId) {
        newNode.parentId = selected.parentId;
        newNode.extent = 'parent';
        newNode.expandParent = true;
      } else {
        const targetContainer = findContainerAtPosition(snapped);
        if (targetContainer) {
          newNode.parentId = targetContainer.id;
          newNode.extent = 'parent';
          newNode.expandParent = true;
        }
      }

      const selectOnly = (ns: Node[], id: string) => ns.map((n) => ({ ...n, selected: n.id === id }));

      const nextNodes = selectOnly([...nodes, newNode], newNodeId);
      const nextEdges: Edge[] = anchor
        ? [
            ...edges,
            {
              id: `edge-${anchor.id}-${newNodeId}`,
              source: anchor.id,
              target: newNodeId,
              type: 'insert',
            },
          ]
        : [...edges];

      setSelectedNodeId(newNodeId);
      setSelectedNode(null);
      setNodes(nextNodes);
      setEdges(nextEdges);
      setHasUnsavedChanges(true);
    },
    [
      readOnly,
      edges,
      nodes,
      selectedNodeId,
      generateNodeId,
      handleClickToAddNode,
      findNearbyNode,
      findContainerAtPosition,
      setEdges,
      setNodes,
      setSelectedNodeId,
      setSelectedNode,
      setHasUnsavedChanges,
    ]
  );
  
  const onDrag = useCallback((event: React.DragEvent) => {
    if (event.clientX === 0 && event.clientY === 0) return; // Ignore end event
    
    // Update drag ghost position
    setDragPosition({ x: event.clientX, y: event.clientY });
    
    // CRITICAL FIX: Use the ReactFlow wrapper element, not currentTarget
    const reactFlowWrapper = document.querySelector('.react-flow') as HTMLElement;
    if (!reactFlowWrapper) return;
    
    const reactFlowBounds = reactFlowWrapper.getBoundingClientRect();
    
    logger.debug('[DEBUG] Drag coordinates:', {
      clientX: event.clientX,
      clientY: event.clientY,
      boundsLeft: reactFlowBounds.left,
      boundsTop: reactFlowBounds.top,
      relativeX: event.clientX - reactFlowBounds.left,
      relativeY: event.clientY - reactFlowBounds.top,
    });
    
    // FIX: screenToFlowPosition expects ABSOLUTE screen coordinates
    // It handles viewport transformation internally - do NOT subtract bounds
    if (!reactFlowInstance?.screenToFlowPosition) {
      logger.error('[onDragOver] reactFlowInstance not ready');
      return;
    }
    const flowPosition = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    
    logger.debug('[DEBUG] Flow position after transform:', flowPosition);
    
    // Snap to alignment
    const snappedPosition = {
      x: Math.round(flowPosition.x / 15) * 15,
      y: Math.round(flowPosition.y / 15) * 15,
    };
    
    logger.debug('[DEBUG] Snapped position:', snappedPosition);
    
    // Detect alignment guides
    const guides = detectAlignment(snappedPosition);
    setAlignmentGuides(guides);
    
    // Detect nearby node for auto-connect
    const nearby = findNearbyNode(snappedPosition);
    setNearbyNode(nearby);
    
    // Phase 1.2: Detect if hovering over a container for visual feedback
    const hoveredContainer = findContainerAtPosition(snappedPosition);
    setHoveredContainerId(hoveredContainer?.id || null);
    
    // Phase 1.2: Update container nodes with drop target indicator
    if (hoveredContainer) {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === hoveredContainer.id) {
            return {
              ...n,
              data: {
                ...n.data,
                isDropTarget: true, // Visual feedback flag
              },
            };
          }
          // Clear drop target flag from other containers
          if (n.type === 'formMultiStepContainer' && n.data.isDropTarget) {
            return {
              ...n,
              data: {
                ...n.data,
                isDropTarget: false,
              },
            };
          }
          return n;
        })
      );
    } else {
      // Clear all drop target indicators when not hovering
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === 'formMultiStepContainer' && n.data.isDropTarget) {
            return {
              ...n,
              data: {
                ...n.data,
                isDropTarget: false,
              },
            };
          }
          return n;
        })
      );
    }
  }, [reactFlowInstance, detectAlignment, findNearbyNode, findContainerAtPosition, setNodes]);
  
  const onDragEnd = useCallback(() => {
    // Clear drag state
    setIsDragging(false);
    setDragNodeType(null);
    setDragPosition(null);
    setAlignmentGuides({ horizontal: [], vertical: [] });
    setNearbyNode(null);
    setHoveredContainerId(null);
    
    // Phase 1.2: Clear all drop target indicators
    // CRITICAL FIX: Skip setNodes if drop succeeded to prevent race condition
    // If drop succeeded, the onDrop handler already cleaned up drop targets
    if (!dropSucceededRef.current) {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === 'formMultiStepContainer' && n.data.isDropTarget) {
            return {
              ...n,
              data: {
                ...n.data,
                isDropTarget: false,
              },
            };
          }
          return n;
        })
      );
    }
  }, [setNodes]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      logger.debug('🎯 [onDrop] DROP EVENT FIRED - Single ReactFlow');
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow-nodetype');
      logger.debug('🎯 [onDrop] Node type:', type);
      
      if (!type) {
        logger.error('[onDrop] No node type found in dataTransfer');
        return;
      }
      
      // Clear drag state
      setIsDragging(false);
      setDragNodeType(null);
      setDragPosition(null);
      setAlignmentGuides({ horizontal: [], vertical: [] });

      // CRITICAL FIX: Use the ReactFlow wrapper element, not currentTarget
      // currentTarget can be the wrong element causing coordinate offset
      const reactFlowWrapper = document.querySelector('.react-flow') as HTMLElement;
      if (!reactFlowWrapper) {
        logger.error('[onDrop] Could not find React Flow wrapper');
        return;
      }
      
      // FIX: screenToFlowPosition expects ABSOLUTE screen coordinates
      // It handles viewport transformation internally - do NOT subtract bounds
      if (!reactFlowInstance?.screenToFlowPosition) {
        logger.error('[onDrop] reactFlowInstance not ready');
        toast.error('Editor not ready. Please try again.');
        return;
      }
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      // Fix #2: VALIDATE position before creating node (prevents React Flow normalization errors)
      if (!position || typeof position.x !== 'number' || typeof position.y !== 'number' || 
          isNaN(position.x) || isNaN(position.y)) {
        logger.error('[onDrop] Invalid position calculated:', position);
        toast.error('Failed to add node: Invalid position');
        return;
      }
      
      // Snap to grid (15x15)
      position.x = Math.round(position.x / 15) * 15;
      position.y = Math.round(position.y / 15) * 15;
      
      // Phase 1.4: Check if dropping into a container
      const targetContainer = findContainerAtPosition(position);
      
      if (targetContainer) {
        logger.debug(`[Container] ✅ Detected drop into container ${targetContainer.id}`);
        
        // Phase 1.3: Ensure container is expanded
        if (!targetContainer.data.isExpanded) {
          logger.debug(`[Container] Expanding collapsed container ${targetContainer.id}`);
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === targetContainer.id) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    isExpanded: true,
                  },
                };
              }
              return n;
            })
          );
        } else {
          logger.debug(`[Container] Container ${targetContainer.id} already expanded`);
        }
      } else {
        logger.debug(`[Container] No container detected at position`, position);
        logger.debug(`[Container] Node will be added to main canvas`);
      }
      
      // Check for nearby node to auto-connect
      const nearby = findNearbyNode(position);
      
      // Fix #2: Ensure default dimensions upfront (prevents React Flow dimension errors)
      const isContainerNode = isFormProcessContainerType(type);
      const defaultDimensions = isContainerNode
        ? { width: 600, height: 400 } // Larger for containers
        : undefined; // Let React Flow calculate for regular nodes

      const newNodeId = generateNodeId();
      const newNode: Node = {
        id: newNodeId,
        type: getReactFlowNodeType(type),
        position,
        ...(defaultDimensions && { style: defaultDimensions }), // Only set if defined
        data: {
          label: NODE_TYPE_REGISTRY[type]?.name || 'New Node',
          status: 'draft',
          ...getDefaultNodeData(type),
        },
      };
      
      // Phase 2.3: Container nodes no longer need childNodes/childEdges arrays
      if (type === 'formMultiStepContainer') {
        newNode.style = {
          width: 600,  // Larger default width for expanded state
          height: 400, // Larger default height for child nodes
        };
        newNode.data = {
          ...newNode.data,
          isExpanded: true, // Default to expanded so children are visible
          // Removed childNodes/childEdges - children queried via parentId
          onEnterContainer: (containerId: string) => {
            logger.debug(`[Container] onEnterContainer callback triggered for ${containerId}`);
            // This will be handled by the parent editor
          },
        };
      }
      
      // Form Process: keep container semantics in node.data.nodeType, render as STANDARD React Flow default node
      if (isFormProcessContainerType(type)) {
        newNode.style = {
          width: 600, // Default width for group container
          height: 400, // Default height for child nodes
        };
        newNode.data = {
          ...newNode.data,
          nodeType: 'formProcess',
          isExpanded: true, // Default to expanded so children are visible
          isGroup: true, // Mark as group for React Flow
        };
      }
      
      // Phase 1.4: If dropping into a container, set parent-child relationship
      if (targetContainer) {
        logger.debug(`[Container] Setting up parent-child relationship with container ${targetContainer.id}`);
        
        // Phase 1.4: Don't allow containers to be nested
        const isContainerType = isFormProcessContainerType(type);
        
        if (isContainerType) {
          logger.debug(`[Container] ❌ Cannot nest containers - node type ${type} will be added to main canvas`);
          // Fall through to main canvas drop - don't allow nested containers
        } else {
          logger.debug(`[Container] Adding node ${newNode.id} as child of container ${targetContainer.id}`);
          
          // Phase 1.4: Set up React Flow native parent-child relationship
          
          // Calculate position relative to container
          const relativePosition = {
            x: position.x - targetContainer.position.x,
            y: position.y - targetContainer.position.y,
          };
          
          logger.debug(`[Container] Position - Absolute: (${position.x}, ${position.y}), Relative: (${relativePosition.x}, ${relativePosition.y})`);
          
          newNode.position = relativePosition;
          
          // Phase 1.4: Set parentId property (React Flow v12+ native grouping)
          newNode.parentId = targetContainer.id;
          
          // Phase 1.4: Constrain node movement to parent bounds
          newNode.extent = 'parent';
          
          // Phase 1.4: Auto-expand parent if node dropped near edge
          newNode.expandParent = true;
          
          // REFACTORED: Child nodes are hidden ONLY if container is collapsed
          // When expanded, children render on main canvas (single-ReactFlow pattern)
          const isParentExpanded = targetContainer.data?.isExpanded ?? true;
          newNode.hidden = !isParentExpanded; // Hidden when collapsed, visible when expanded
          
          logger.debug(`[Container] ✅ Node configured:`, {
            nodeId: newNode.id,
            parentId: newNode.parentId,
            relativePosition: newNode.position,
            extent: newNode.extent,
            expandParent: newNode.expandParent,
            hidden: newNode.hidden,
          });
          
          // Add node to main state
          // CRITICAL: Parent nodes must come before their children in the array
          // React Flow requirement: "Parent nodes must be in front of their child nodes"
          // Find parent index and insert child right after it
          const parentIndex = nodes.findIndex((n) => n.id === targetContainer.id);
          logger.debug(`[Container] Inserting node at index ${parentIndex + 1} (after parent)`);
          
          const updatedNodes = [
            ...nodes.slice(0, parentIndex + 1),
            newNode,
            ...nodes.slice(parentIndex + 1),
          ];
          
          // Phase 3.3: Trigger auto-layout for container
          logger.debug(`[Container] Triggering auto-layout for container ${targetContainer.id}`);
          const layoutResult = calculateContainerLayout(
            targetContainer.id,
            updatedNodes,
            edges
          );
          
          logger.debug(`[Layout] Result:`, {
            containerWidth: layoutResult.containerWidth,
            containerHeight: layoutResult.containerHeight,
            childrenCount: layoutResult.nodes.filter(n => n.parentId === targetContainer.id).length,
          });
          
          // Phase 3.3: Apply layout, container dimensions, AND clear drop target in SINGLE setNodes call
          // CRITICAL: Multiple setNodes calls can cause race conditions with parent/child rendering
          const finalNodes = layoutResult.nodes.map((n) => {
            if (n.id === targetContainer.id) {
              // Apply both dimension changes AND clear drop target flag
              const updates: any = {
                ...n,
                data: {
                  ...n.data,
                  isDropTarget: false, // Clear drop target indicator
                },
              };
              
              // Apply dimension changes if needed
              if (layoutResult.containerWidth > 400 || layoutResult.containerHeight > 300) {
                updates.style = {
                  ...n.style,
                  width: layoutResult.containerWidth,
                  height: layoutResult.containerHeight,
                };
              }
              
              return updates;
            }
            return n;
          });
          
          // CRITICAL: Sort nodes to ensure parent-before-child ordering
          // React Flow requires parents to appear before children in the array
          const sortedNodes = sortNodesTopologically(finalNodes);
          setNodes(sortedNodes);
          
          // Phase 4: Trigger auto-connection for form steps
          if (type === 'formStep' || type === 'formReference') {
            const connectionResult = autoConnectSequentialSteps(
              targetContainer.id,
              finalNodes, // Use finalNodes (already has drop target cleared)
              edges
            );
            
            // Apply connection changes
            setEdges(connectionResult.edges);
          }
          
          // Clear nearby node state and return early (no auto-connect for container drops)
          setNearbyNode(null);
          
          // Mark drop as succeeded to prevent onDragEnd from undoing changes
          dropSucceededRef.current = true;
          
          return; // Don't continue to main canvas drop
        }
      }
      
      // Normal drop on main canvas
      const insertEdge = pendingInsertEdgeId ? edges.find((e) => e.id === pendingInsertEdgeId) : null;

      if (insertEdge) {
        const sourceNode = nodes.find((n) => n.id === insertEdge.source);
        const targetNode = nodes.find((n) => n.id === insertEdge.target);

        if (sourceNode && targetNode) {
          newNode.position = {
            x: (sourceNode.position.x + targetNode.position.x) / 2,
            y: (sourceNode.position.y + targetNode.position.y) / 2,
          };
        }
      }

      const nodesToAdd: Node[] = [newNode];
      const edgesToAdd: Edge[] = [];

      // Auto-spawn TWO default Form Steps inside a new Form Process container
      // (Validation requires 2 steps minimum; this keeps the node immediately usable.)
      if (isContainerNode) {
        const page1Id = generateNodeId();
        const page2Id = generateNodeId();

        const makePage = (id: string, index: number): Node => ({
          id,
          type: 'form',
          parentId: newNode.id,
          extent: 'parent',
          expandParent: true,
          position: {
            x: LAYOUT_CONSTANTS.START_X,
            y: LAYOUT_CONSTANTS.STEP_Y + index * LAYOUT_CONSTANTS.STEP_SPACING,
          },
          draggable: false,
          style: { width: LAYOUT_CONSTANTS.STEP_W, height: LAYOUT_CONSTANTS.STEP_H, overflow: 'hidden' },
          data: {
            label: `Page ${index + 1}`,
            status: 'draft',
            fields: [],
            ...getDefaultNodeData('form'),
          },
        });

        nodesToAdd.push(makePage(page1Id, 0), makePage(page2Id, 1));
      }

      const updatedNodes = nodes.concat(nodesToAdd);

      // Mark drop as succeeded
      dropSucceededRef.current = true;

      // Auto-connect to nearby node if found (only for main canvas drops)
      let updatedEdges = edges;
      if (insertEdge && !targetContainer) {
        updatedEdges = edges.filter((e) => e.id !== insertEdge.id);
        updatedEdges = [
          ...updatedEdges,
          {
            id: `edge-${insertEdge.source}-${newNode.id}`,
            source: insertEdge.source,
            target: newNode.id,
            type: 'insert',
          },
          {
            id: `edge-${newNode.id}-${insertEdge.target}`,
            source: newNode.id,
            target: insertEdge.target,
            type: 'insert',
          },
        ];
        setPendingInsertEdgeId(null);
      } else if (nearby && !targetContainer) {
        const newEdge = {
          id: `edge-${nearby.id}-${newNode.id}`,
          source: nearby.id,
          target: newNode.id,
          type: 'insert',
        };
        updatedEdges = [...edges, newEdge];
      }

      updatedEdges = [...updatedEdges, ...edgesToAdd];

      if (isContainerNode) {
        // Force horizontal child alignment within the container
        const layoutResult = calculateContainerLayout(newNode.id, updatedNodes, updatedEdges);
        const connectionResult = autoConnectSequentialSteps(newNode.id, layoutResult.nodes, updatedEdges);

        const finalNodes = sortNodesTopologically(
          layoutResult.nodes.map((n) => {
            if (n.id !== newNode.id) return n;
            return {
              ...n,
              style: {
                ...(n.style || {}),
                width: Math.max(layoutResult.containerWidth, (n.style as any)?.width || 600),
                height: Math.max(layoutResult.containerHeight, (n.style as any)?.height || 400),
              },
            };
          })
        );

        setNodes(finalNodes);
        setEdges(connectionResult.edges);
        setHasUnsavedChanges(true);
      } else {
        setNodes(updatedNodes);
        setEdges(updatedEdges);
        setHasUnsavedChanges(true);
      }

      // Clear nearby node state
      setNearbyNode(null);
      setPendingInsertEdgeId(null);
    },
    [
      generateNodeId,
      setNodes,
      reactFlowInstance,
      nodes,
      edges,
      findNearbyNode,
      setEdges,
      findContainerAtPosition,
      pendingInsertEdgeId,
      applyAutoLayoutImmediate,
    ]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    logger.debug('🔵 [onDragOver] Event received');
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // ============================================================================
  // Container Drag-Drop Logic (Phase 4.4)
  // ============================================================================
  
  /**
   * Track drag start to detect significant movement
   * Phase 5: Prevent unnecessary re-layouts during minor adjustments
   */
  const onNodeDragStart = useCallback((_event: React.MouseEvent, node: Node) => {
    // Close context menu if open
    handleCloseMenu();
    
    // Store initial position for comparison on drag stop
    dragStartPositionRef.current = {
      nodeId: node.id,
      x: node.position.x,
      y: node.position.y,
    };
    logger.debug(`[DragStart] Tracking node ${node.id} at position (${node.position.x}, ${node.position.y})`);
  }, [handleCloseMenu]);
  
  /**
   * Phase 5: Handle node drag stop - detect reordering within container
   * Phase 1-4: Handle dragging nodes in/out of containers
   * 
   * OPTIMIZATION: Only trigger auto-layout if position changed significantly
   */
  const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
    // Phase 5: If node is inside a container and it's a form step, check for significant movement
    if (node.parentId && (node.type === 'form' || node.type === 'formStep' || node.type === 'formStepSingle' || node.type === 'formReference')) {
      // Check if position changed significantly (more than 30px horizontally)
      const dragStart = dragStartPositionRef.current;
      const SIGNIFICANT_MOVEMENT_THRESHOLD = 30; // pixels
      
      if (dragStart && dragStart.nodeId === node.id) {
        const deltaX = Math.abs(node.position.x - dragStart.x);
        const deltaY = Math.abs(node.position.y - dragStart.y);
        
        if (deltaX < SIGNIFICANT_MOVEMENT_THRESHOLD && deltaY < SIGNIFICANT_MOVEMENT_THRESHOLD) {
          logger.debug(`[DragStop] Skipping re-layout - movement too small (deltaX: ${deltaX}, deltaY: ${deltaY})`);
          dragStartPositionRef.current = null;
          return; // Don't trigger layout for minor adjustments
        }
        
        logger.debug(`[DragStop] Significant movement detected (deltaX: ${deltaX}, deltaY: ${deltaY})`);
      }
      
      const container = nodes.find(n => n.id === node.parentId);
      
      if (container) {
        logger.debug(`[DragStop] Triggering re-layout for container ${container.id} after node ${node.id} dragged`);
        
        // Re-calculate layout (reorders nodes based on new x-position)
        const layoutResult = calculateContainerLayout(container.id, nodes, edges);
        
        // CRITICAL: Sort nodes to ensure parent-before-child ordering
        const sortedNodes = sortNodesTopologically(layoutResult.nodes);
        setNodes(sortedNodes);
        
        // Update container dimensions if needed
        const currentWidth = typeof container.style?.width === 'number'
          ? container.style.width
          : typeof container.style?.width === 'string'
            ? Number(container.style.width) || 400
            : 400;
        const currentHeight = typeof container.style?.height === 'number'
          ? container.style.height
          : typeof container.style?.height === 'string'
            ? Number(container.style.height) || 300
            : 300;

        if (layoutResult.containerWidth > currentWidth || layoutResult.containerHeight > currentHeight) {
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === container.id) {
                return {
                  ...n,
                  style: {
                    ...n.style,
                    width: Math.max(
                      layoutResult.containerWidth,
                      typeof n.style?.width === 'number'
                        ? n.style.width
                        : typeof n.style?.width === 'string'
                          ? Number(n.style.width) || 400
                          : 400
                    ),
                    height: Math.max(
                      layoutResult.containerHeight,
                      typeof n.style?.height === 'number'
                        ? n.style.height
                        : typeof n.style?.height === 'string'
                          ? Number(n.style.height) || 300
                          : 300
                    ),
                  },
                };
              }
              return n;
            })
          );
        }
        
        // Re-connect sequential steps
        const connectionResult = autoConnectSequentialSteps(container.id, layoutResult.nodes, edges);
        setEdges(connectionResult.edges);
        
        logger.debug(`[DragStop] ✅ Re-layout and re-connection complete`);
      }
    }
    
    // Clear drag start tracking
    dragStartPositionRef.current = null;
    
    // Phase 1-4: Original logic - Handle dragging node in/out of container
    // Calculate absolute position (in case node is inside a parent)
    const absolutePosition = node.parentId
      ? {
          x: node.position.x + (nodes.find(n => n.id === node.parentId)?.position.x || 0),
          y: node.position.y + (nodes.find(n => n.id === node.parentId)?.position.y || 0),
        }
      : node.position;
    
    const container = findContainerAtPosition(absolutePosition);
    
    // Check if node's parent container changed
    const currentParentId = node.parentId;
    const newParentId = container?.id || null;
    
    // Prevent containers from being nested in other containers
    const isContainerNode = isFormProcessContainerType(((node.data as any)?.nodeType as string | undefined) || node.type);
    
    if (isContainerNode && newParentId) {
      logger.debug('[Container] Cannot nest containers inside containers');
      return;
    }
    
    if (currentParentId !== newParentId) {
      setNodes((nds) => {
        const updatedNodes = nds.map((n) => {
          if (n.id === node.id) {
            const updatedNode = { ...n };
            
            if (newParentId) {
              // Node is being added to a container
              const containerNode = nds.find(cn => cn.id === newParentId);
              if (containerNode) {
                // Convert position to be relative to parent
                updatedNode.position = {
                  x: absolutePosition.x - containerNode.position.x,
                  y: absolutePosition.y - containerNode.position.y,
                };
                updatedNode.parentId = newParentId;
                updatedNode.extent = 'parent';
                logger.debug(`[Container] Node ${node.id} added to container ${newParentId}`);
              }
            } else if (currentParentId) {
              // Node is being removed from container
              updatedNode.position = absolutePosition;
              delete (updatedNode as any).parentId;
              delete updatedNode.extent;
              logger.debug(`[Container] Node ${node.id} removed from container`);
            }
            
            return updatedNode;
          }
          return n;
        });
        
        // CRITICAL: Sort nodes to ensure parent-before-child ordering
        return sortNodesTopologically(updatedNodes);
      });
      
      // Update container stats
      if (newParentId) {
        updateContainerStats(newParentId);
      }
      if (currentParentId) {
        updateContainerStats(currentParentId);
      }
      
      setHasUnsavedChanges(true);
    }
  }, [nodes, edges, setNodes, setEdges, findContainerAtPosition]);
  
  /**
   * Update container node statistics (Phase E - Updated for parentNode)
   */
  const updateContainerStats = useCallback((containerId: string) => {
    setNodes((nds) => {
      // Count nodes in this container using React Flow's parentNode property
      const childNodes = nds.filter(n => n.parentId === containerId);
      const nodeTypeBreakdown: Record<string, number> = {};
      const formReferences: string[] = [];
      
      childNodes.forEach(node => {
        const nodeType = node.type || 'unknown';
        nodeTypeBreakdown[nodeType] = (nodeTypeBreakdown[nodeType] || 0) + 1;
        
        // Collect form references
        if (node.data?.formId) {
          formReferences.push(node.data.formId);
        }
        if (node.data?.tenantFormId) {
          formReferences.push(node.data.tenantFormId);
        }
      });
      
      return nds.map((n) => {
        if (n.id === containerId) {
          return {
            ...n,
            data: {
              ...n.data,
              nodeCount: childNodes.length,
              nodeTypeBreakdown,
              formReferences: [...new Set(formReferences)],
              childNodes: childNodes.map(c => c.id),
            },
          };
        }
        return n;
      });
    });
  }, [setNodes]);
  
  /**
   * Validate if node can be added to container
   */
  const canAddToContainer = useCallback((nodeType: string): boolean => {
    // Triggers cannot be inside containers
    const invalidTypes = ['triggerManual', 'triggerSchedule', 'triggerWebhook', 'triggerEvent', 'triggerForm'];
    return !invalidTypes.includes(nodeType);
  }, []);

  // ============================================================================
  // Node Alignment Tools (Phase 4 Batch 6)
  // ============================================================================
  
  /**
   * Align selected nodes horizontally (distribute along x-axis)
   */
  const alignHorizontal = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length < 2) return;
    
    // Sort by x position
    const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalWidth = last.position.x - first.position.x;
    const spacing = totalWidth / (sorted.length - 1);
    
    setNodes((nds) =>
      nds.map((n) => {
        const index = sorted.findIndex(s => s.id === n.id);
        if (index !== -1 && index !== 0 && index !== sorted.length - 1) {
          return {
            ...n,
            position: {
              ...n.position,
              x: first.position.x + (spacing * index),
            },
          };
        }
        return n;
      })
    );
    
    setHasUnsavedChanges(true);
    logger.debug(`[Align] Distributed ${selectedNodes.length} nodes horizontally`);
  }, [nodes, setNodes]);
  
  /**
   * Align selected nodes vertically (distribute along y-axis)
   */
  const alignVertical = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length < 2) return;
    
    // Sort by y position
    const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalHeight = last.position.y - first.position.y;
    const spacing = totalHeight / (sorted.length - 1);
    
    setNodes((nds) =>
      nds.map((n) => {
        const index = sorted.findIndex(s => s.id === n.id);
        if (index !== -1 && index !== 0 && index !== sorted.length - 1) {
          return {
            ...n,
            position: {
              ...n.position,
              y: first.position.y + (spacing * index),
            },
          };
        }
        return n;
      })
    );
    
    setHasUnsavedChanges(true);
    logger.debug(`[Align] Distributed ${selectedNodes.length} nodes vertically`);
  }, [nodes, setNodes]);
  
  /**
   * Align selected nodes to the left (align x to leftmost node)
   */
  const alignLeft = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length < 2) return;
    
    const minX = Math.min(...selectedNodes.map(n => n.position.x));
    
    setNodes((nds) =>
      nds.map((n) => {
        if (n.selected) {
          return {
            ...n,
            position: { ...n.position, x: minX },
          };
        }
        return n;
      })
    );
    
    setHasUnsavedChanges(true);
    logger.debug(`[Align] Aligned ${selectedNodes.length} nodes to left (x=${minX})`);
  }, [nodes, setNodes]);
  
  /**
   * Align selected nodes to the right (align x to rightmost node)
   */
  const alignRight = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length < 2) return;
    
    const maxX = Math.max(...selectedNodes.map(n => n.position.x));
    
    setNodes((nds) =>
      nds.map((n) => {
        if (n.selected) {
          return {
            ...n,
            position: { ...n.position, x: maxX },
          };
        }
        return n;
      })
    );
    
    setHasUnsavedChanges(true);
    logger.debug(`[Align] Aligned ${selectedNodes.length} nodes to right (x=${maxX})`);
  }, [nodes, setNodes]);
  
  /**
   * Align selected nodes to the top (align y to topmost node)
   */
  const alignTop = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length < 2) return;
    
    const minY = Math.min(...selectedNodes.map(n => n.position.y));
    
    setNodes((nds) =>
      nds.map((n) => {
        if (n.selected) {
          return {
            ...n,
            position: { ...n.position, y: minY },
          };
        }
        return n;
      })
    );
    
    setHasUnsavedChanges(true);
    logger.debug(`[Align] Aligned ${selectedNodes.length} nodes to top (y=${minY})`);
  }, [nodes, setNodes]);
  
  /**
   * Align selected nodes to the bottom (align y to bottommost node)
   */
  const alignBottom = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length < 2) return;
    
    const maxY = Math.max(...selectedNodes.map(n => n.position.y));
    
    setNodes((nds) =>
      nds.map((n) => {
        if (n.selected) {
          return {
            ...n,
            position: { ...n.position, y: maxY },
          };
        }
        return n;
      })
    );
    
    setHasUnsavedChanges(true);
    logger.debug(`[Align] Aligned ${selectedNodes.length} nodes to bottom (y=${maxY})`);
  }, [nodes, setNodes]);
  
  /**
   * Align selected nodes to center horizontally
   */
  const alignCenterX = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length < 2) return;
    
    const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length;
    
    setNodes((nds) =>
      nds.map((n) => {
        if (n.selected) {
          return {
            ...n,
            position: { ...n.position, x: avgX },
          };
        }
        return n;
      })
    );
    
    setHasUnsavedChanges(true);
    logger.debug(`[Align] Aligned ${selectedNodes.length} nodes to center X (x=${avgX.toFixed(0)})`);
  }, [nodes, setNodes]);
  
  /**
   * Align selected nodes to center vertically
   */
  const alignCenterY = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length < 2) return;
    
    const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length;
    
    setNodes((nds) =>
      nds.map((n) => {
        if (n.selected) {
          return {
            ...n,
            position: { ...n.position, y: avgY },
          };
        }
        return n;
      })
    );
    
    setHasUnsavedChanges(true);
    logger.debug(`[Align] Aligned ${selectedNodes.length} nodes to center Y (y=${avgY.toFixed(0)})`);
  }, [nodes, setNodes]);

  // ============================================================================
  // Save Handler (Legacy compatibility)
  // ============================================================================
  // NOTE: The editor persists workflows via `handleSaveWorkflow` (tenant-workforms).
  // `handleSaveRef` remains as a stable indirection for keyboard/UI triggers.

  // ============================================================================
  // Phase 7: Workflow Persistence Handlers
  // ============================================================================
  
  /**
   * Validate workflow containers (Phase 8.5)
   * Must be declared before handleSaveWorkflow to avoid TDZ error
   */
  const validateContainers = useCallback((): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Find all container nodes
    const containerNodes = nodes.filter((n) =>
      isFormProcessContainerType(((n.data as any)?.nodeType as string | undefined) || n.type)
    );
    
    for (const container of containerNodes) {
      // Get child nodes
      const childNodes = nodes.filter(n => n.parentId === container.id);
      
      // Check for form/page steps in the container.
      const formSteps = childNodes.filter((n) =>
        ['form', 'formStepSingle', 'formStep', 'formReference'].includes(n.type || '')
      );

      const minSteps = 2;
      if (formSteps.length < minSteps) {
        errors.push(
          `Container "${container.data.label || container.id}" must have at least ${minSteps} step(s)`
        );
      }
      
      // Check for orphaned nodes (nodes without connections)
      for (const child of childNodes) {
        const hasIncoming = edges.some(e => e.target === child.id);
        const hasOutgoing = edges.some(e => e.source === child.id);
        
        // Skip first node (can have no incoming)
        const isFirstStep = formSteps[0]?.id === child.id;
        
        if (!hasIncoming && !hasOutgoing && !isFirstStep) {
          errors.push(
            `Node "${child.data.label || child.id}" in container "${container.data.label || container.id}" is not connected`
          );
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  }, [nodes, edges]);
  
  /**
   * Save workflow to backend
   */
  const handleSaveWorkflow = useCallback(async (opts?: { status?: 'draft' | 'active' | 'archived' }) => {
    if (isSaving) return; // Prevent double-save
    
    // Phase 8.5: Validate containers before saving
    const validation = validateContainers();
    if (!validation.valid) {
      // Show validation errors
      const errorMessage = 'Validation failed:\n' + validation.errors.join('\n');
      toast.error(errorMessage, { duration: 5000 });
      logger.warn('⚠️ Validation errors:', validation.errors);
      return;
    }
    
    setIsSaving(true);
    
    const statusToSave = opts?.status ?? currentWorkflowStatus;

    // Show loading toast
    const loadingToast = toast.loading(
      statusToSave === 'active'
        ? (currentWorkflowId ? 'Publishing workflow...' : 'Publishing new workflow...')
        : (currentWorkflowId ? 'Updating workflow...' : 'Creating workflow...')
    );
    
    try {
      // Get current viewport
      const viewport = reactFlowInstance?.getViewport() || { x: 0, y: 0, zoom: 1 };
      
      // Save workflow (create or update)
      const savedWorkflow = await saveWorkflow(
        currentWorkflowName,
        nodes,
        edges,
        viewport,
        currentWorkflowId, // Undefined = create new, string = update existing
        currentWorkflowDescription, // Phase 8.2: Use description from state
        statusToSave // Phase 8.2: Use status from action (save vs publish)
      );
      
      // Update current workflow ID if this was a new workflow
      if (!currentWorkflowId) {
        setCurrentWorkflowId(savedWorkflow.id);
      }

      setCurrentWorkflowStatus((savedWorkflow.status as 'draft' | 'active' | 'archived') || statusToSave);
      onWorkflowSaved?.({
        id: savedWorkflow.id,
        name: savedWorkflow.name,
        status: (savedWorkflow.status as 'draft' | 'active' | 'archived') || statusToSave,
      });

      // Refresh any UI surfaces that list available forms/workforms.
      queryClient.invalidateQueries({ queryKey: ['tenant-forms'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-workforms'] });
      
      setHasUnsavedChanges(false);
      logger.debug('✅ Workflow saved:', savedWorkflow.name);
      
      const verb = statusToSave === 'active'
        ? 'published'
        : (currentWorkflowId ? 'updated' : 'created');

      // Show success toast
      toast.success(
        `Workflow "${savedWorkflow.name}" ${verb} successfully!`,
        { id: loadingToast }
      );
    } catch (error) {
      logger.error('❌ Failed to save workflow:', error);
      
      // Show error toast
      toast.error(
        `Failed to save workflow: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { id: loadingToast }
      );
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, currentWorkflowId, currentWorkflowName, isSaving, reactFlowInstance, validateContainers, currentWorkflowDescription, currentWorkflowStatus, onWorkflowSaved, queryClient]);

  const handlePublishWorkflow = useCallback(async () => {
    if (validationResult.errorCount > 0) {
      setShowValidationDrawer(true);
      toast.error('Fix validation errors before publishing.');
      return;
    }

    await handleSaveWorkflow({ status: 'active' });
  }, [handleSaveWorkflow, validationResult.errorCount]);

  // Populate forward ref now that the real save handler exists.
  handleSaveRef.current = () => {
    void handleSaveWorkflow();
  };
  
  /**
   * Auto-layout: Apply dagre layout to all nodes
   * Phase 2: UI/UX Enhancements
   */
  const handleAutoLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, {
      direction: 'TB',
      nodeSpacing: 60,
      rankSpacing: 120,
    });
    setNodes(layoutedNodes);
    setHasUnsavedChanges(true);
    toast.success('Layout applied successfully');
  }, [nodes, edges, setNodes]);

  /**
   * Auto-layout selected nodes only
   */
  const handleAutoLayoutSelected = useCallback(() => {
    const selectedNodeIds = nodes.filter(n => n.selected).map(n => n.id);
    if (selectedNodeIds.length < 2) {
      toast.error('Select at least 2 nodes to layout');
      return;
    }

    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    const relevantEdges = edges.filter(
      e => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
    );

    const { nodes: layoutedSelected } = getLayoutedElements(selectedNodes, relevantEdges, {
      direction: 'TB',
    });

    // Merge layouted nodes back
    const updatedNodes = nodes.map(node => {
      const layouted = layoutedSelected.find(n => n.id === node.id);
      return layouted || node;
    });

    setNodes(updatedNodes);
    setHasUnsavedChanges(true);
    toast.success(`Layouted ${selectedNodeIds.length} nodes`);
  }, [nodes, edges, setNodes]);

  /**
   * Align selected nodes
   */
  const handleAlignHorizontal = useCallback((alignment: 'left' | 'center' | 'right') => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length < 2) {
      toast.error('Select at least 2 nodes to align');
      return;
    }

    const aligned = alignNodesHorizontally(selectedNodes, alignment);
    const updatedNodes = nodes.map(node => {
      const alignedNode = aligned.find(n => n.id === node.id);
      return alignedNode || node;
    });

    setNodes(updatedNodes);
    setHasUnsavedChanges(true);
  }, [nodes, setNodes]);

  const handleAlignVertical = useCallback((alignment: 'top' | 'middle' | 'bottom') => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length < 2) {
      toast.error('Select at least 2 nodes to align');
      return;
    }

    const aligned = alignNodesVertically(selectedNodes, alignment);
    const updatedNodes = nodes.map(node => {
      const alignedNode = aligned.find(n => n.id === node.id);
      return alignedNode || node;
    });

    setNodes(updatedNodes);
    setHasUnsavedChanges(true);
  }, [nodes, setNodes]);

  /**
   * Distribute selected nodes
   */
  const handleDistributeHorizontal = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length < 3) {
      toast.error('Select at least 3 nodes to distribute');
      return;
    }

    const distributed = distributeNodesHorizontally(selectedNodes);
    const updatedNodes = nodes.map(node => {
      const distributedNode = distributed.find(n => n.id === node.id);
      return distributedNode || node;
    });

    setNodes(updatedNodes);
    setHasUnsavedChanges(true);
  }, [nodes, setNodes]);

  const handleDistributeVertical = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length < 3) {
      toast.error('Select at least 3 nodes to distribute');
      return;
    }

    const distributed = distributeNodesVertically(selectedNodes);
    const updatedNodes = nodes.map(node => {
      const distributedNode = distributed.find(n => n.id === node.id);
      return distributedNode || node;
    });

    setNodes(updatedNodes);
    setHasUnsavedChanges(true);
  }, [nodes, setNodes]);

  /**
   * Setup keyboard shortcuts
   * Phase 2: UI/UX Enhancements
   */
  const handleCopySelection = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected);
    if (selectedNodes.length === 0) return;

    // Store a safe snapshot (we re-clone on paste anyway)
    setClipboardData(selectedNodes.map((n) => ({ ...n, selected: false })));
    toast.success(`Copied ${selectedNodes.length} node(s)`);
  }, [nodes]);

  const handlePasteSelection = useCallback(() => {
    if (!clipboardData.length) return;

    const safeClone = <T,>(value: T): T => {
      try {
        return structuredClone(value);
      } catch {
        if (value && typeof value === 'object') return { ...(value as any) };
        return value;
      }
    };

    const createId = () => {
      const cryptoObj = globalThis.crypto;
      if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
        return cryptoObj.randomUUID();
      }
      return uuidv4();
    };
    const idMap = new Map<string, string>();

    for (const n of clipboardData) {
      idMap.set(n.id, createId());
    }

    const pastedNodes = clipboardData.map((node) => {
      const newId = idMap.get(node.id) || createId();
      const cloned = safeClone(node);

      const oldParentId = (cloned as any).parentId as string | undefined;
      const newParentId = oldParentId ? idMap.get(oldParentId) : undefined;
      const keepParent = Boolean(oldParentId && newParentId);

      const next: Node = {
        ...cloned,
        id: newId,
        selected: true,
        position: {
          x: (cloned.position?.x ?? 0) + 50,
          y: (cloned.position?.y ?? 0) + 50,
        },
        data: safeClone((cloned as any).data),
      };

      if (keepParent) {
        (next as any).parentId = newParentId;
        next.extent = 'parent';
        (next as any).expandParent = true;
        next.hidden = false;
      } else {
        delete (next as any).parentId;
        next.extent = undefined;
        delete (next as any).expandParent;
        next.hidden = false;
      }

      // Ensure legacy parentNode is not carried forward
      delete (next as any).parentNode;

      return next;
    });

    const sortedPasted = sortNodesTopologically(pastedNodes);

    setNodes((nds) => {
      const cleared = nds.map((n) => ({ ...n, selected: false }));
      return [...cleared, ...sortedPasted];
    });

    setSelectedNodeId(sortedPasted[0]?.id ?? null);
    setSelectedNode(null);

    toast.success(`Pasted ${sortedPasted.length} node(s)`);
  }, [clipboardData, setNodes, setSelectedNodeId, setSelectedNode]);

  useKeyboardShortcuts({
    onSave: handleSaveWorkflow,
    onLayout: handleAutoLayout,
    onCopy: handleCopySelection,
    onPaste: handlePasteSelection,
    onUndo: () => {
      if (historyIndex > 0) {
        const prevState = history[historyIndex - 1];
        setNodes(prevState.nodes);
        setEdges(prevState.edges);
        setHistoryIndex(historyIndex - 1);
      }
    },
    onRedo: () => {
      if (historyIndex < history.length - 1) {
        const nextState = history[historyIndex + 1];
        setNodes(nextState.nodes);
        setEdges(nextState.edges);
        setHistoryIndex(historyIndex + 1);
      }
    },
  });
  
  /**
   * Load workflow from backend
   */
  const handleLoadWorkflow = useCallback(async (workflowId: string) => {
    if (isLoading) return; // Prevent double-load
    
    setIsLoading(true);
    
    // Show loading toast
    const loadingToast = toast.loading('Loading workflow...');
    
    try {
      // Load workflow data
      const loadedWorkflow = await loadWorkflow(workflowId);
      
      // CRITICAL: Sort nodes to ensure parent-before-child ordering
      const sortedNodes = sortNodesTopologically(loadedWorkflow.workflow_definition.nodes || []);
      
      // Update editor state
      setNodes(sortedNodes);
      setEdges(loadedWorkflow.workflow_definition.edges || []);
      setCurrentWorkflowId(loadedWorkflow.id);
      setCurrentWorkflowName(loadedWorkflow.name);
      setCurrentWorkflowDescription(loadedWorkflow.description || ''); // Phase 8.2
      setCurrentWorkflowStatus(loadedWorkflow.status as 'draft' | 'active' | 'archived'); // Phase 8.2
      setHasUnsavedChanges(false);
      
      // Restore viewport if saved
      if (loadedWorkflow.workflow_definition.viewport && reactFlowInstance?.setViewport) {
        reactFlowInstance.setViewport(loadedWorkflow.workflow_definition.viewport);
      }
      
      // Close load menu
      setIsLoadMenuOpen(false);
      
      logger.debug('✅ Workflow loaded:', loadedWorkflow.name);
      
      // Show success toast
      toast.success(
        `Workflow "${loadedWorkflow.name}" loaded successfully!`,
        { id: loadingToast }
      );
    } catch (error) {
      logger.error('❌ Failed to load workflow:', error);
      
      // Show error toast
      toast.error(
        `Failed to load workflow: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { id: loadingToast }
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, reactFlowInstance, setNodes, setEdges]);
  
  /**
   * Fetch workflow list when load menu is opened
   */
  useEffect(() => {
    if (isLoadMenuOpen) {
      setWorkflowSearchQuery(''); // Reset search when opening
      listWorkflows()
        .then(workflows => {
          setWorkflowList(workflows);
        })
        .catch(error => {
          logger.error('❌ Failed to fetch workflow list:', error);
          setWorkflowList([]);
          toast.error('Failed to load workflow list');
        });
    }
  }, [isLoadMenuOpen]);
  
  /**
   * Filter workflows by search query (Phase 8.3)
   */
  const filteredWorkflows = useMemo(() => {
    if (!workflowSearchQuery.trim()) {
      return workflowList;
    }
    
    const query = workflowSearchQuery.toLowerCase();
    return workflowList.filter(workflow => 
      workflow.name.toLowerCase().includes(query) ||
      workflow.description?.toLowerCase().includes(query) ||
      workflow.status.toLowerCase().includes(query)
    );
  }, [workflowList, workflowSearchQuery]);
  
  /**
   * Handle delete workflow button click (Phase 8.3)
   */
  const handleDeleteClick = useCallback((workflow: WorkflowListItem, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering load
    setWorkflowToDelete(workflow);
    setDeleteConfirmOpen(true);
  }, []);
  
  /**
   * Confirm and delete workflow (Phase 8.3)
   */
  const handleConfirmDelete = useCallback(async () => {
    if (!workflowToDelete || isDeleting) return;
    
    setIsDeleting(true);
    
    try {
      await deleteWorkflow(workflowToDelete.id);
      
      // Remove from list
      setWorkflowList(prev => prev.filter(w => w.id !== workflowToDelete.id));
      
      // Close confirmation
      setDeleteConfirmOpen(false);
      setWorkflowToDelete(null);
      
      toast.success(`Workflow "${workflowToDelete.name}" deleted successfully`);
    } catch (error) {
      logger.error('❌ Failed to delete workflow:', error);
      toast.error(`Failed to delete workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  }, [workflowToDelete, isDeleting]);
  
  /**
   * Prompt for workflow name when creating new workflow
   */
  const handleNewWorkflow = useCallback(() => {
    // Phase 8.2: Open workflow management modal instead of prompt()
    setWorkflowModalMode('create');
    setIsWorkflowModalOpen(true);
  }, []);
  
  /**
   * Handle workflow modal save (Phase 8.2)
   */
  const handleWorkflowModalSave = useCallback((metadata: WorkflowMetadata) => {
    setCurrentWorkflowName(metadata.name);
    setCurrentWorkflowDescription(metadata.description || '');
    setCurrentWorkflowStatus(metadata.status);
    setCurrentWorkflowId(undefined); // Clear ID to create new workflow on next save
    setHasUnsavedChanges(true);
    
    toast.success(`Workflow "${metadata.name}" ready to create. Click Save to persist it.`);
  }, []);
  
  /**
   * Close load menu when clicking outside
   */
  useEffect(() => {
    if (!isLoadMenuOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const isLoadMenuClick = target.closest('[data-load-menu]');
      if (!isLoadMenuClick) {
        setIsLoadMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isLoadMenuOpen]);
  
  /**
   * Keyboard shortcuts listener (Phase 8.6)
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // "?" key - Show keyboard shortcuts
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (isTypingInInput(e)) return;
        e.preventDefault();
        setShowKeyboardShortcuts(true);
      }
      
      // ESC key - Close modals
      if (e.key === 'Escape') {
        setShowKeyboardShortcuts(false);
        setDeleteConfirmOpen(false);
      }
      
      // Ctrl+S / Cmd+S - Save workflow
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveWorkflow();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveWorkflow]);

  // ============================================================================
  // Viewport Controls
  // ============================================================================
  
  const fitView = useCallback(
    (opts?: { padding?: number; duration?: number; maxZoom?: number }) => {
      if (reactFlowInstance?.fitView) {
        reactFlowInstance.fitView({
          padding: opts?.padding ?? 0.28,
          duration: opts?.duration ?? 300,
          maxZoom: opts?.maxZoom ?? 1.1,
        } as any);
      }
    },
    [reactFlowInstance]
  );

  const didApplyInitialViewportRef = useRef(false);

  // On first load: restore saved viewport (if provided) else fit-to-content.
  useEffect(() => {
    if (didApplyInitialViewportRef.current) return;
    if (!reactFlowInstance) return;

    const hasGraph = nodes.length > 0 || edges.length > 0;
    if (!hasGraph) return;

    didApplyInitialViewportRef.current = true;

    requestAnimationFrame(() => {
      if (initialViewport && reactFlowInstance?.setViewport) {
        reactFlowInstance.setViewport(initialViewport);
        return;
      }

      fitView({ padding: 0.32, duration: 350, maxZoom: 1.05 });

      // Nudge the fitted view so the default left palette doesn't occlude the first nodes.
      if (isPaletteVisible && reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
        const vp = reactFlowInstance.getViewport();
        reactFlowInstance.setViewport({ ...vp, x: vp.x + 140 });
      }
    });
  }, [edges.length, fitView, initialViewport, isPaletteVisible, nodes.length, reactFlowInstance]);
  
  const zoomIn = useCallback(() => {
    if (reactFlowInstance?.zoomIn) {
      reactFlowInstance.zoomIn({ duration: 300 });
    }
  }, [reactFlowInstance]);
  
  const zoomOut = useCallback(() => {
    if (reactFlowInstance?.zoomOut) {
      reactFlowInstance.zoomOut({ duration: 300 });
    }
  }, [reactFlowInstance]);
  
  const zoomTo = useCallback((level: number) => {
    if (reactFlowInstance?.zoomTo) {
      reactFlowInstance.zoomTo(level, { duration: 300 });
    }
  }, [reactFlowInstance]);
  
  const selectAll = useCallback(() => {
    setNodes(nds => nds.map(node => ({ ...node, selected: true })));
  }, [setNodes]);
  
  const deselectAll = useCallback(() => {
    setNodes(nds => nds.map(node => ({ ...node, selected: false })));
  }, [setNodes]);

  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Tab: Toggle palette visibility
      if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setIsPaletteVisible(prev => !prev);
        return;
      }
      
      // /: Focus search (if palette visible)
      if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
        if (isTypingInInput(event)) return; // Phase 4: Prevent when typing in input
        event.preventDefault();
        if (isPaletteVisible && searchInputRef.current) {
          searchInputRef.current.focus();
        }
        return;
      }
      
      // Delete/Backspace: Delete selected nodes
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (isTypingInInput(event)) return; // Phase 4: Prevent when typing in input
        event.preventDefault();
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length > 0) {
          setNodes(nds => nds.filter(n => !n.selected));
          setEdges(eds => eds.filter(e => 
            !selectedNodes.find(n => n.id === e.source || n.id === e.target)
          ));
        }
        return;
      }
      
      // Ctrl+Z / Cmd+Z: Undo
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      
      // Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z: Redo
      if ((event.ctrlKey || event.metaKey) && 
          (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault();
        redo();
        return;
      }
      
      // Ctrl+S / Cmd+S: Save workflow (Phase 7)
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleSaveWorkflow(); // Phase 7: Save to backend
        return;
      }
      
      // Alignment shortcuts (Phase 4 Batch 6)
      // Ctrl+Shift+H: Align horizontal (distribute X)
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'H') {
        event.preventDefault();
        alignHorizontal();
        return;
      }
      
      // Ctrl+Shift+V: Align vertical (distribute Y)
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'V') {
        event.preventDefault();
        alignVertical();
        return;
      }
      
      // Ctrl+Shift+L: Align left
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'L') {
        event.preventDefault();
        alignLeft();
        return;
      }
      
      // Ctrl+Shift+R: Align right
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'R') {
        event.preventDefault();
        alignRight();
        return;
      }
      
      // Ctrl+Shift+T: Align top
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'T') {
        event.preventDefault();
        alignTop();
        return;
      }
      
      // Ctrl+Shift+B: Align bottom
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'B') {
        event.preventDefault();
        alignBottom();
        return;
      }
      
      // Ctrl+Shift+X: Center horizontally
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'X') {
        event.preventDefault();
        alignCenterX();
        return;
      }
      
      // Ctrl+Shift+Y: Center vertically
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'Y') {
        event.preventDefault();
        alignCenterY();
        return;
      }
      
      // F: Fit to view
      if (event.key === 'f' && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        if (isTypingInInput(event)) return;
        event.preventDefault();
        fitView();
        return;
      }
      
      // M: Toggle minimap (Sprint 1 Task 1.3)
      if (event.key === 'm' && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        if (isTypingInInput(event)) return; // Don't toggle while typing
        event.preventDefault();
        setIsMinimapVisible(prev => !prev);
        return;
      }
      
      // 1: Zoom to 100%
      if (event.key === '1' && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        if (isTypingInInput(event)) return;
        event.preventDefault();
        zoomTo(1);
        return;
      }
      
      // 2: Zoom to 50%
      if (event.key === '2' && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        if (isTypingInInput(event)) return;
        event.preventDefault();
        zoomTo(0.5);
        return;
      }
      
      // 3: Fit view (same as F)
      if (event.key === '3' && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        if (isTypingInInput(event)) return;
        event.preventDefault();
        fitView();
        return;
      }
      
      // Ctrl+A / Cmd+A: Select all
      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault();
        selectAll();
        return;
      }
      
      // Escape: Deselect all / Cancel drag
      if (event.key === 'Escape') {
        event.preventDefault();
        
        // If dragging, cancel the drag
        if (isDragging) {
          setIsDragging(false);
          setDragNodeType(null);
          setDragPosition(null);
          return;
        }
        
        // Otherwise deselect all
        deselectAll();
        setSelectedNode(null);
        return;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isPaletteVisible, 
    nodes, 
    undo, 
    redo, 
    handleSave, 
    setNodes, 
    setEdges, 
    fitView, 
    zoomTo, 
    selectAll, 
    deselectAll, 
    setSelectedNode, 
    isDragging,
    isMinimapVisible, // Sprint 1 Task 1.3
    alignHorizontal,
    alignVertical,
    alignLeft,
    alignRight,
    alignTop,
    alignBottom,
    alignCenterX,
    alignCenterY,
  ]);

  // ============================================================================
  // Deprecated Node Migration (Phase 6.4)
  // ============================================================================
  
  /**
   * Migrate deprecated nodes to modern equivalents
   * - formField → formStep with single field
   * - formSection → formStep with section styling
   */
  const handleMigrateDeprecatedNodes = useCallback(() => {
    logger.debug('[Phase 6] Starting migration of deprecated nodes...');
    
    const DEPRECATED_TYPES = ['formField', 'formSection'];
    const nodesToMigrate = nodes.filter(node => DEPRECATED_TYPES.includes(node.type || ''));
    
    if (nodesToMigrate.length === 0) {
      logger.debug('[Phase 6] No deprecated nodes to migrate');
      return;
    }
    
    const newNodes = nodes.map(node => {
      if (!DEPRECATED_TYPES.includes(node.type || '')) {
        return node; // Keep non-deprecated nodes as-is
      }
      
      logger.debug(`[Phase 6] Migrating ${node.type} node:`, node.id);
      
      // Convert to formStep
      if (node.type === 'formField') {
        // Single field → formStep with one field
        return {
          ...node,
          type: 'formStep',
          data: {
            ...node.data,
            label: node.data?.label || 'Migrated Step',
            description: node.data?.description || 'Migrated from old form field',
            fields: node.data?.field ? [node.data.field] : [],
            _migrated: true,
            _originalType: 'formField',
          },
        };
      }
      
      if (node.type === 'formSection') {
        // Section → formStep with section header
        return {
          ...node,
          type: 'formStep',
          data: {
            ...node.data,
            label: node.data?.label || 'Migrated Section',
            description: node.data?.description || 'Migrated from old form section',
            fields: node.data?.fields || [],
            showSectionHeader: true,
            _migrated: true,
            _originalType: 'formSection',
          },
        };
      }
      
      return node;
    });
    
    setNodes(newNodes);
    setBannerDismissed(true);
    
    logger.debug(`[Phase 6] Migration complete: ${nodesToMigrate.length} nodes migrated`);
    
    // Show success message
    showAlert({
      type: 'success',
      title: 'Migration complete',
      content: `Successfully migrated ${nodesToMigrate.length} deprecated node(s) to modern format!\n\nPlease review the migrated nodes and save your workflow.`,
    });
  }, [nodes, setNodes]);

  // ============================================================================
  // Node Selection & Configuration
  // ============================================================================

  const handleSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    // FIX: Do NOT auto-open modals on selection
    // Modals ONLY open when user clicks Edit (pencil) button
    const selectedNodes = params.nodes || [];
    if (selectedNodes.length === 1) {
      const node = selectedNodes[0];
      logger.debug('[Selection] Node selected (border highlight only)', { nodeType: node.type, nodeId: node.id });
      
      // Track selected node ID for keyboard shortcuts and debugging
      setSelectedNodeId(node.id);

      // Phase 9.2: Broadcast collaborative selection
      collabSendSelection([node.id]);
      
      // DO NOT call setSelectedNode(node) here!
      // That triggers NodeConfigPanel to open automatically.
      // Selection only provides visual feedback (border).
      // User must explicitly click Edit button to open configuration.
      
    } else {
      logger.debug('[Selection] Cleared selection');
      // Clear all selections when nothing selected
      setSelectedNodeId(null);
      setSelectedNode(null);
      setSelectedFormStep(null);
      setSelectedContainer(null);
      setContainerModalOpen(false);

      // Phase 9.2: Broadcast cleared selection
      collabSendSelection([]);
    }
  }, [collabSendSelection]);
  
  // Batch 3: Handler to open modal from Edit button
  // IMPORTANT: This is the ONLY place modals should be opened (except programmatic saves)
  const handleNodeEdit = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    logger.debug('✏️ [EDIT BUTTON] Opening config panel for', { nodeType: node.type, nodeId });
    
    // Close container modal (only legacy modal remaining)
    setContainerModalOpen(false);
    
    // FORCE CONFIG PANEL OPEN: Set selectedNode to trigger TabbedConfigPanelWithShadow
    // This is the universal config panel that handles ALL node types dynamically with tabbed interface
    setSelectedNode(node);
    setSelectedNodeId(nodeId);
    
    // Force re-render by adding a key change if needed
    // The portal will remount with the new node
    logger.debug('[handleNodeEdit] Config panel state updated:', {
      nodeId,
      nodeType: node.type,
      selectedNodeSet: true,
      timestamp: new Date().toISOString()
    });
    
    // Route to appropriate specific config panel based on node type (legacy support)
    // These are backup modals - primary config is via DynamicConfigPanel
    switch (node.type) {
      case 'formStep':
        logger.debug('✏️ [EDIT BUTTON] Setting FormStep data');
        setSelectedFormStep(node);
        break;
      
      case 'formMultiStepContainer':
      case 'formProcess': {
        // Phase 7 Stabilization: these node types are deprecated.
        // Migrate in-memory to the canonical Form Process Group node.
        logger.debug('✏️ [EDIT BUTTON] Migrating legacy container to formBook');

        const migratedNode = {
          ...node,
          type: 'formBook',
          data: {
            ...(node.data || {}),
            // Ensure group semantics are enabled
            isGroup: true,
          },
        };

        setNodes((nds) => nds.map((n) => (n.id === node.id ? migratedNode : n)));
        setSelectedNode(migratedNode);
        // Do NOT open legacy modal
        break;
      }
        
      case 'formReference':
      case 'formField':
      case 'formSection':
      case 'section':
      case 'formFileUpload':
      case 'document':
      case 'upload':
      case 'action':
        logger.debug('✏️ [EDIT BUTTON] Using TabbedConfigPanel/DynamicConfigPanel for:', node.type);
        // Route all node types through the main panel (TabbedConfigPanel wraps DynamicConfigPanel)
        // selectedNode already set at the beginning of this function
        break;
        
      default:
        logger.debug('✏️ [EDIT BUTTON] Using DynamicConfigPanel for:', node.type);
        // selectedNode already set at the beginning of this function
        break;
    }
  }, [nodes]);
  
  // Debug: Log modal state changes to diagnose visibility issues
  useEffect(() => {
    if (selectedNode) {
      logger.debug('[Modal State] Config panel SHOULD be visible:', {
        nodeId: selectedNode.id,
        nodeType: selectedNode.type,
        hasData: !!selectedNode.data,
        dataKeys: Object.keys(selectedNode.data || {}),
        timestamp: new Date().toISOString()
      });
      
      // Force check that portal container exists
      setTimeout(() => {
        const portal = document.getElementById('config-portal');
        const hasChildren = !!portal && portal.childNodes.length > 0;

        if (portal) {
          logger.debug('[Modal State] ✅ Portal container present', { hasChildren });
        } else {
          logger.error('[Modal State] ❌ Missing #config-portal in DOM - config panel cannot render');
        }
      }, 100);
    } else {
      logger.debug('[Modal State] Config panel closed (selectedNode is null)');
    }
  }, [selectedNode]);
  
  
  // Batch 3: Handler to delete node from Delete button
  const handleNodeDeleteImpl = useCallback(async (nodeId: string) => {
    // SAFETY: Validate state before deletion
    if (!nodes || nodes.length === 0) {
      toast.error('Cannot delete node: Invalid state');
      return;
    }

    const nodeToDelete = nodes.find((n) => n.id === nodeId);
    if (!nodeToDelete) {
      toast.error('Node not found');
      return;
    }

    // Include descendants so edges can be cleaned in one pass.
    const idsToDelete = new Set<string>([nodeId]);
    const queue = [nodeId];

    while (queue.length > 0) {
      const parentId = queue.pop()!;
      for (const n of nodes) {
        if (n.parentId === parentId && !idsToDelete.has(n.id)) {
          idsToDelete.add(n.id);
          queue.push(n.id);
        }
      }
    }

    try {
      // Phase 2: Decrement usage_count when formProcess node is deleted
      if (nodeToDelete.type === 'formProcess' || nodeToDelete.type === 'formMultiStepContainer') {
        const tenantFormId = nodeToDelete.data?.tenantFormId;

        if (typeof tenantFormId === 'string' && tenantFormId.length > 0) {
          try {
            await adminClient.post(`/api/system/forms/${tenantFormId}/decrement-usage/`);
          } catch (error) {
            logger.error('Failed to decrement form usage count:', error);
            // Continue with deletion even if API call fails
          }
        }
      }

      setNodes((nds) => nds.filter((n) => !idsToDelete.has(n.id)));
      setEdges((eds) => eds.filter((e) => !idsToDelete.has(e.source) && !idsToDelete.has(e.target)));

      // Clear selections if deleted node was selected
      if (selectedNode?.id && idsToDelete.has(selectedNode.id)) {
        setSelectedNode(null);
      }

      setHasUnsavedChanges(true);
      toast.success('Node deleted');
      logger.debug('[UnifiedFlowEditor] Node deleted successfully:', { nodeId, deletedCount: idsToDelete.size });
    } catch (error) {
      logger.error('[FlowEditor] Delete failed:', error);
      toast.error('Failed to delete node');
    }
  }, [nodes, selectedNode, setNodes, setEdges]);
  
  // Populate forward ref (CRITICAL: Must be after useCallback definition)
  handleNodeDeleteRef.current = handleNodeDeleteImpl;
  
  // Batch 4: Handler to update node title
  const handleNodeTitleChange = useCallback((nodeId: string, newTitle: string) => {
    logger.debug('[UnifiedFlowEditor] Updating node title', { nodeId, newTitle });
    
    setNodes(nds => 
      nds.map(node => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              label: newTitle,
            },
          };
        }
        return node;
      })
    );
    
    setHasUnsavedChanges(true);
  }, [setNodes]);

  const handleNodeUpdate = useCallback((nodeId: string, newData: Record<string, any>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, ...newData },
          };
        }
        return node;
      })
    );
    logger.debug(`Node ${nodeId} updated:`, newData);
    setHasUnsavedChanges(true);
  }, [setNodes]);

  const handleNodeDataUpdate = useCallback((nodeId: string, updates: any) => {
    logger.debug('[UnifiedFlowEditor] Syncing FormBuilder updates:', { nodeId, updates });
    handleNodeUpdate(nodeId, updates);
  }, [handleNodeUpdate]);

  const duplicateNode = useCallback((nodeId: string) => {
    const snapshot = nodesRef.current;
    const edgesSnapshot = edgesRef.current;

    const original = snapshot.find((n) => n.id === nodeId);
    if (!original) return;

    const generateId = (prefix: string) => {
      const uuid =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? (crypto as any).randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return `${prefix}-${uuid}`;
    };

    const stripFunctions = (value: any): any => {
      if (Array.isArray(value)) return value.map(stripFunctions);
      if (!value || typeof value !== 'object') return value;

      const out: any = {};
      for (const [k, v] of Object.entries(value)) {
        if (typeof v === 'function') continue;
        out[k] = stripFunctions(v);
      }
      return out;
    };

    const safeClone = <T,>(value: T): T => {
      try {
        return structuredClone(value);
      } catch {
        return JSON.parse(JSON.stringify(value));
      }
    };

    const isContainer = original.type === 'formProcessGroup';

    const toCloneIds: string[] = [original.id];
    if (isContainer) {
      const queue = [original.id];
      const seen = new Set<string>(toCloneIds);

      while (queue.length > 0) {
        const parentId = queue.pop()!;
        for (const n of snapshot) {
          if (n.parentId === parentId && !seen.has(n.id)) {
            seen.add(n.id);
            toCloneIds.push(n.id);
            queue.push(n.id);
          }
        }
      }
    }

    const idMap = new Map<string, string>();
    for (const oldId of toCloneIds) {
      const prefix = oldId === original.id && isContainer ? 'container' : 'node';
      idMap.set(oldId, generateId(prefix));
    }

    const clonedNodes: Node[] = [];
    for (const oldId of toCloneIds) {
      const src = snapshot.find((n) => n.id === oldId);
      if (!src) continue;

      const sanitized = stripFunctions(src);
      const cloned = safeClone(sanitized) as Node;

      // Ensure fresh IDs, positions, and no selection carryover
      cloned.id = idMap.get(oldId)!;
      cloned.selected = false;
      (cloned as any).dragging = false;
      delete (cloned as any).measured;

      cloned.position = {
        x: src.position.x + 50,
        y: src.position.y + 50,
      };

      if (src.parentId) {
        cloned.parentId = idMap.get(src.parentId) ?? src.parentId;
      }

      // Ensure duplicated children re-parent to the duplicated container
      if (isContainer && src.parentId === original.id) {
        cloned.parentId = idMap.get(original.id)!;
      }

      clonedNodes.push(cloned);
    }

    // Clone internal edges when duplicating a container
    const clonedEdges: Edge[] = [];
    if (isContainer) {
      const cloneIdSet = new Set(toCloneIds);
      const internalEdges = edgesSnapshot.filter(
        (e) => cloneIdSet.has(e.source) && cloneIdSet.has(e.target)
      );

      for (const e of internalEdges) {
        const sanitized = stripFunctions(e);
        const cloned = safeClone(sanitized) as Edge;

        cloned.id = generateId('edge');
        cloned.source = idMap.get(e.source) ?? e.source;
        cloned.target = idMap.get(e.target) ?? e.target;
        (cloned as any).selected = false;

        clonedEdges.push(cloned);
      }
    }

    setNodes((nds) => [...nds, ...clonedNodes]);
    if (clonedEdges.length > 0) {
      setEdges((eds) => [...eds, ...clonedEdges]);
    }
    setHasUnsavedChanges(true);
  }, [setEdges, setNodes]);

  // Phase 4.2.B: FormStep-specific handlers
  const handleFormStepUpdate = useCallback((updatedStepData: any) => {
    if (!selectedFormStep) return;
    
    handleNodeUpdate(selectedFormStep.id, updatedStepData);
    setFormStepModalOpen(false);
    setSelectedFormStep(null);
  }, [selectedFormStep, handleNodeUpdate]);
  
  // Convert node data to EntityFormStepModal format (Phase 3 - WF-ENH-2026-Q1)
  const convertNodeDataToFormStepData = useCallback((node: Node): FormStepData | undefined => {
    if (!node.data) return undefined;

    const data = node.data as any;

    const formId: string | undefined = typeof data.formId === 'string' ? data.formId : undefined;

    return {
      formId,
      formName: String(data.formName || data.stepTitle || data.label || 'Untitled Form'),
      entityType: String(data.entityType || 'supplier'),
      fields: Array.isArray(data.fields) ? data.fields : [],
      mode: formId ? 'existing' : 'new',
    };
  }, []);
  
  // Handle EntityFormStepModal save (Phase 3 - WF-ENH-2026-Q1)
  const handleEntityFormStepSave = useCallback((formData: FormStepData) => {
    if (!selectedFormStep) return;
    
    logger.debug('[UnifiedFlowEditor] Saving EntityFormStep:', formData);
    
    // Update node data with form configuration
    const updatedNodeData = {
      ...selectedFormStep.data,
      formId: formData.formId,
      formName: formData.formName,
      stepTitle: formData.formName,
      label: formData.formName,
      entityType: formData.entityType,
      fields: formData.fields,
      mode: formData.mode,
      // Visual metadata for the node
      configured: true,
      fieldCount: formData.fields.length,
    };
    
    handleNodeUpdate(selectedFormStep.id, updatedNodeData);
    setFormStepModalOpen(false);
    setSelectedFormStep(null);
  }, [selectedFormStep, handleNodeUpdate]);
  
  // Convert node data to ContainerData format (Phase 4.3)
  const convertNodeDataToContainerData = useCallback((node: Node<any>): ContainerData | undefined => {
    if (!node.data) return undefined;

    const data = node.data as any;
    const workflowId: string | undefined = typeof data.tenantWorkFormId === 'string' ? data.tenantWorkFormId : undefined;

    return {
      workflowId,
      containerName: String(data.containerName || data.label || 'Unnamed Container'),
      containerDescription:
        typeof data.containerDescription === 'string' ? data.containerDescription : undefined,
      mode: workflowId ? 'existing' : 'new',
      showProgressIndicator: typeof data.showProgressIndicator === 'boolean' ? data.showProgressIndicator : true,
      allowBackNavigation: typeof data.allowBackNavigation === 'boolean' ? data.allowBackNavigation : true,
      allowSkipSteps: typeof data.allowSkipSteps === 'boolean' ? data.allowSkipSteps : false,
      autoAdvance: typeof data.autoAdvance === 'boolean' ? data.autoAdvance : false,
      confirmOnExit: typeof data.confirmOnExit === 'boolean' ? data.confirmOnExit : true,
    };
  }, []);
  
  // Handle container modal save (Phase 4.3)
  const handleContainerSave = useCallback((containerData: ContainerData) => {
    if (!selectedContainer) return;
    
    logger.debug('[UnifiedFlowEditor] Saving Container:', containerData);
    
    // Update node data with container configuration
    const updatedNodeData = {
      ...selectedContainer.data,
      tenantWorkFormId: containerData.workflowId,
      containerName: containerData.containerName,
      containerDescription: containerData.containerDescription,
      label: containerData.containerName,
      mode: containerData.mode,
      showProgressIndicator: containerData.showProgressIndicator,
      allowBackNavigation: containerData.allowBackNavigation,
      allowSkipSteps: containerData.allowSkipSteps,
      autoAdvance: containerData.autoAdvance,
      confirmOnExit: containerData.confirmOnExit,
      // Visual metadata for the node
      configured: true,
    };
    
    handleNodeUpdate(selectedContainer.id, updatedNodeData);
    setContainerModalOpen(false);
    setSelectedContainer(null);
  }, [selectedContainer, handleNodeUpdate]);
  
  // Get previous step fields for conditional logic
  const getPreviousStepFields = useCallback((currentNodeId: string) => {
    const allFields: any[] = [];

    const currentNode = nodes.find((n) => n.id === currentNodeId);
    if (!currentNode) return allFields;

    // Phase 11: Use true graph traversal instead of Y-coordinate heuristics.
    // Trace ancestors by following incoming edges (target -> source).
    const upstreamNodeIds = new Set<string>();
    const visited = new Set<string>();
    const queue: string[] = [currentNodeId];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const incoming = edges.filter((e) => e.target === nodeId);
      for (const e of incoming) {
        if (!upstreamNodeIds.has(e.source)) {
          upstreamNodeIds.add(e.source);
          queue.push(e.source);
        }
      }
    }

    const upstreamFormNodes = nodes.filter(
      (n) =>
        upstreamNodeIds.has(n.id) &&
        (n.type === 'formStep' || n.type === 'formStepSingle' || n.type === 'form')
    );

    upstreamFormNodes.forEach((node) => {
      const fields = Array.isArray((node.data as any)?.fields) ? (node.data as any).fields : [];
      fields.forEach((field: any) => {
        allFields.push({
          ...field,
          stepTitle: node.data?.stepTitle || node.data?.label || 'Unnamed Step',
        });
      });
    });

    return allFields;
  }, [nodes, edges]);
  
  const handleAddField = useCallback(() => {
    // Create new blank field and open field editor
    const newField = {
      id: `field_${Date.now()}`,
      label: 'New Field',
      type: 'text',
      required: false,
      placeholder: '',
      validationRules: [],
    };
    setEditingField(newField);
  }, []);
  
  const handleEditField = useCallback((field: any) => {
    setEditingField(field);
  }, []);
  
  const handleFieldUpdate = useCallback((updatedField: any) => {
    if (!selectedFormStep) return;
    
    const currentFields = selectedFormStep.data.fields || [];
    const fieldIndex = currentFields.findIndex((f: any) => f.id === updatedField.id);
    
    let newFields;
    if (fieldIndex >= 0) {
      // Update existing field
      newFields = currentFields.map((f: any) => 
        f.id === updatedField.id ? updatedField : f
      );
    } else {
      // Add new field
      newFields = [...currentFields, updatedField];
    }
    
    // Update the FormStep node with new fields
    handleNodeUpdate(selectedFormStep.id, { fields: newFields });
    
    // Update selectedFormStep state for immediate UI update
    setSelectedFormStep(prev => prev ? {
      ...prev,
      data: { ...prev.data, fields: newFields }
    } : null);
    
    setEditingField(null);
  }, [selectedFormStep, handleNodeUpdate]);

  const handleNodeTest = useCallback((nodeId: string) => {
    logger.debug(`Testing node ${nodeId} with sample data...`);
    // Test runner logic will be implemented in future batch
  }, []);

  // ============================================================================
  // Template Selection Handler (Phase 2.5 Integration)
  // ============================================================================
  
  const handleTemplateSelect = useCallback((template: FlowTemplate) => {
    logger.debug('[Template] Selected:', template.name);
    
    // Map template nodes to proper React Flow node types with full metadata
    const mappedNodes = template.nodes.map(node => {
      // Get node definition from registry for metadata (color, icon, etc.)
      const rawType = node.type ?? '';

      const nodeDef = getNodeTypeDefinition(rawType);

      // Ensure node has proper type mapping
      const reactFlowType = getReactFlowNodeType(rawType);

      // Merge default data + template data + registry metadata
      const defaultData = getDefaultNodeData(rawType);
      
      return {
        ...node,
        type: reactFlowType, // Override with React Flow node type
        data: {
          ...defaultData,      // Default node data (fields, actions, etc.)
          ...node.data,        // Template-specific data
          label: node.data.label || nodeDef?.name || node.type, // Ensure label exists
          // Add registry metadata for proper styling
          color: nodeDef?.color,
          icon: nodeDef?.icon,
          category: nodeDef?.category,
          description: nodeDef?.description,
        }
      };
    });
    
    // Load template nodes and edges into canvas
    setNodes(mappedNodes);
    setEdges(template.edges);
    
    // Reset history with template as initial state
    const newHistory: HistoryState[] = [{
      nodes: mappedNodes,
      edges: template.edges
    }];
    setHistory(newHistory);
    setHistoryIndex(0);
    
    // Close modal
    setIsTemplateModalOpen(false);
    
    // Fit view to show full template
    setTimeout(() => {
      if (reactFlowInstance?.fitView) {
        reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
      }
    }, 100);
  }, [setNodes, setEdges, reactFlowInstance]);

  const handleStartBlank = useCallback(() => {
    logger.debug('[Template] Starting blank canvas');
    
    // Clear canvas
    setNodes([]);
    setEdges([]);
    
    // Reset history
    setHistory([{ nodes: [], edges: [] }]);
    setHistoryIndex(0);
    
    // Close modal
    setIsTemplateModalOpen(false);
  }, [setNodes, setEdges]);

  // ============================================================================
  // Filter Nodes by Search Query (with Fuzzy Search - PROMPT 3)
  // ============================================================================
  
  const filteredNodesByCategory = useMemo(() => {
    const grouped: Record<NodeCategory, typeof NODE_TYPE_REGISTRY[string][]> = {
      trigger: [],
      form: [],
      logic: [],
      action: [],
      wait: [],
      document: [],
      utility: [],
      terminal: [],
    };

    const query = searchQuery.toLowerCase().trim();
    const hasActiveFilters = activeFilters.size > 0;
    
    // PROMPT 3: Use Fuse.js for fuzzy search
    let searchResults: typeof NODE_TYPE_REGISTRY[string][] = paletteNodeTypes;
    
    if (query) {
      const fuse = new Fuse(paletteNodeTypes, {
        keys: ['name', 'description', 'category'],
        threshold: 0.3, // 0 = exact match, 1 = match anything
        includeScore: true,
      });
      
      const fuseResults = fuse.search(query);
      searchResults = fuseResults.map(result => result.item);
    }
    
    // Filter by available node types based on editor mode and search
    searchResults.forEach(node => {
      // Filter by active category filters (if any)
      if (hasActiveFilters && !activeFilters.has(node.category)) {
        return;
      }
      
      grouped[node.category].push(node);
    });

    return grouped;
  }, [searchQuery, activeFilters, paletteNodeTypes]);

  // ============================================================================
  // Get Favorite & Recent Nodes
  // ============================================================================
  
  const favoriteNodesList = useMemo(() => {
    return favorites
      .map((id) => NODE_TYPE_REGISTRY[id])
      .filter(Boolean)
      .filter((n) => paletteNodeTypeIdSet.has(n.id));
  }, [favorites, paletteNodeTypeIdSet]);

  const recentNodesList = useMemo(() => {
    return recentNodes
      .map((id) => NODE_TYPE_REGISTRY[id])
      .filter(Boolean)
      .filter((n) => paletteNodeTypeIdSet.has(n.id));
  }, [recentNodes, paletteNodeTypeIdSet]);

  const lastNodeIdSet = useMemo(() => {
    const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
    const outgoingWithinScope = new Set<string>();

    edges.forEach((e) => {
      const sourceNode = nodeById.get(e.source);
      const targetNode = nodeById.get(e.target);
      if (!sourceNode || !targetNode) return;

      const sourceScope = sourceNode.parentId ?? '__root__';
      const targetScope = targetNode.parentId ?? '__root__';

      if (sourceScope !== targetScope) return;
      outgoingWithinScope.add(sourceNode.id);
    });

    const sinks = new Set<string>();
    nodes.forEach((n) => {
      if (n.hidden) return;
      if (!outgoingWithinScope.has(n.id)) sinks.add(n.id);
    });

    return sinks;
  }, [edges, nodes]);

  // React Flow Sub-flows reference: https://reactflow.dev/examples/nodes/sub-flows
  // We treat Form containers as true parent nodes (parentId + extent:'parent') and insert pages within that scope.
  const addFormStepInsideContainer = useCallback(
    (containerId: string, afterNodeId?: string) => {
      setNodes((prev) => {
        const nodeById = new Map(prev.map((n) => [n.id, n] as const));
        const container = nodeById.get(containerId);
        if (!container) return prev;

        const isPageNodeType = (type?: string) =>
          type === 'form' || type === 'formStepSingle' || type === 'formStep' || type === 'formReference';

        const pageNodes = prev.filter((n) => n.parentId === containerId && isPageNodeType(n.type));
        const pageIdSet = new Set(pageNodes.map((n) => n.id));

        const existingOrder = Array.isArray((container.data as any)?.pageOrder)
          ? (((container.data as any).pageOrder as string[]) || [])
          : [];

        const normalizedExisting = existingOrder.filter((pid) => pageIdSet.has(pid));
        const missing = pageNodes
          .filter((n) => !normalizedExisting.includes(n.id))
          .sort((a, b) => (a.position?.x || 0) - (b.position?.x || 0) || (a.position?.y || 0) - (b.position?.y || 0))
          .map((n) => n.id);

        const baseOrder = [...normalizedExisting, ...missing];
        const insertIndex = afterNodeId && baseOrder.includes(afterNodeId) ? baseOrder.indexOf(afterNodeId) + 1 : baseOrder.length;

        const containerType = ((container.data as any)?.nodeType as string | undefined) || container.type;
        const enforceStrictPages = isFormProcessContainerType(containerType);

        const newPageId = `page-${uuidv4()}`;
        const nextOrder = [...baseOrder.slice(0, insertIndex), newPageId, ...baseOrder.slice(insertIndex)];

        const newPageNumber = insertIndex + 1;
        const newPage: Node = {
          id: newPageId,
          type: 'form',
          position: enforceStrictPages
            ? {
                x: LAYOUT_CONSTANTS.START_X,
                y: LAYOUT_CONSTANTS.STEP_Y + insertIndex * LAYOUT_CONSTANTS.STEP_SPACING,
              }
            : {
                x: LAYOUT_CONSTANTS.START_X + insertIndex * LAYOUT_CONSTANTS.STEP_SPACING,
                y: LAYOUT_CONSTANTS.STEP_Y,
              },
          style: enforceStrictPages ? { width: 320, height: 320, overflow: 'hidden' } : undefined,
          data: {
            stepTitle: `Page ${newPageNumber}`,
            label: `Page ${newPageNumber}`,
            fields: [],
            order: insertIndex,
          },
          parentId: containerId,
          extent: 'parent',
          expandParent: true,
          draggable: enforceStrictPages ? false : true,
        };

        const nextNodes = prev.map((n) => {
          if (n.id === containerId) {
            return {
              ...n,
              data: {
                ...(n.data || {}),
                pageOrder: nextOrder,
                isExpanded: true,
              },
            };
          }

          if (n.parentId !== containerId) return n;

          const isPageNodeType = (type?: string) =>
            type === 'form' || type === 'formStepSingle' || type === 'formStep' || type === 'formReference';
          if (!isPageNodeType(n.type)) return n;

          const idx = nextOrder.indexOf(n.id);
          if (idx === -1) return n;

          return {
            ...n,
            position: enforceStrictPages
              ? {
                  x: LAYOUT_CONSTANTS.START_X,
                  y: LAYOUT_CONSTANTS.STEP_Y + idx * LAYOUT_CONSTANTS.STEP_SPACING,
                }
              : {
                  x: LAYOUT_CONSTANTS.START_X + idx * LAYOUT_CONSTANTS.STEP_SPACING,
                  y: LAYOUT_CONSTANTS.STEP_Y,
                },
            draggable: enforceStrictPages ? false : n.draggable,
            style: enforceStrictPages
              ? {
                  ...(n.style || {}),
                  width: 320,
                  height: 320,
                  overflow: 'hidden',
                }
              : n.style,
            data: {
              ...(n.data || {}),
              order: idx,
            },
          };
        });

        return [...nextNodes, newPage];
      });
    },
    [setNodes]
  );
  
  const handleMoveNode = useCallback(
    (nodeId: string, direction: -1 | 1) => {
      if (readOnly) return;

      const current = nodes.find((n) => n.id === nodeId);
      if (!current) return;

      const currentY = current.position?.y ?? 0;
      const parentKey = current.parentId ?? null;

      const siblings = nodes.filter((n) => {
        if (n.id === nodeId) return false;
        if (String(n.id).startsWith('__virtual:')) return false;
        return (n.parentId ?? null) === parentKey;
      });

      const candidates = siblings.filter((n) => {
        const dy = n.position?.y ?? 0;
        return direction === -1 ? dy < currentY : dy > currentY;
      });

      if (candidates.length === 0) return;

      const target =
        direction === -1
          ? candidates.reduce((best, n) => ((n.position?.y ?? 0) > (best.position?.y ?? 0) ? n : best))
          : candidates.reduce((best, n) => ((n.position?.y ?? 0) < (best.position?.y ?? 0) ? n : best));

      const targetY = target.position?.y ?? 0;

      const isPrimaryFlowEdge = (e: Edge): boolean => {
        if (e.sourceHandle && e.sourceHandle !== 'output') return false;
        if (e.targetHandle && e.targetHandle !== 'input') return false;
        if (e.sourceHandle === 'error') return false;
        if (e.type === 'errorEdge' || e.type === 'error') return false;
        return true;
      };

      const rewireAdjacentSwap = (prevEdges: Edge[], aboveId: string, belowId: string): Edge[] => {
        const link = prevEdges.find(
          (e) => isPrimaryFlowEdge(e) && e.source === aboveId && e.target === belowId
        );
        if (!link) return prevEdges;

        const incomingToAbove = prevEdges.find(
          (e) => isPrimaryFlowEdge(e) && e.target === aboveId && e.source !== belowId
        );

        const outgoingFromBelow = prevEdges.find(
          (e) => isPrimaryFlowEdge(e) && e.source === belowId && e.target !== aboveId
        );

        return prevEdges.map((e) => {
          if (incomingToAbove && e.id === incomingToAbove.id) {
            return { ...e, target: belowId };
          }
          if (e.id === link.id) {
            return { ...e, source: belowId, target: aboveId };
          }
          if (outgoingFromBelow && e.id === outgoingFromBelow.id) {
            return { ...e, source: aboveId };
          }
          return e;
        });
      };

      setHasUnsavedChanges(true);

      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === current.id) {
            return {
              ...n,
              position: {
                ...(n.position || { x: 0, y: 0 }),
                y: targetY,
              },
            } as Node;
          }
          if (n.id === target.id) {
            return {
              ...n,
              position: {
                ...(n.position || { x: 0, y: 0 }),
                y: currentY,
              },
            } as Node;
          }
          return n;
        })
      );

      const above = currentY < targetY ? current : target;
      const below = currentY < targetY ? target : current;

      setEdges((prevEdges) => rewireAdjacentSwap(prevEdges, String(above.id), String(below.id)));
    },
    [readOnly, nodes, setHasUnsavedChanges, setNodes, setEdges]
  );

  // Batch 3: Inject edit/delete handlers into node data
  // Batch 4: Also inject title change handler
  const nodesWithHandlers = useMemo(() => {
    const nodeById = new Map(nodes.map((n) => [n.id, n] as const));

    const isFormContainerNode = (n?: Node) =>
      !!n && isFormProcessContainerType(((n.data as any)?.nodeType as string | undefined) || n.type);

    return nodes.map((node) => {
      const data = node.data ?? {};

      const onEdit =
        typeof (data as any).onEdit === 'function'
          ? (data as any).onEdit
          : () => handleNodeEdit(node.id);

      const onDelete =
        typeof (data as any).onDelete === 'function'
          ? (data as any).onDelete
          : () => handleNodeDelete(node.id);

      const onSave =
        typeof (data as any).onSave === 'function'
          ? (data as any).onSave
          : () => handleSaveWorkflow();

      const onTitleChange =
        typeof (data as any).onTitleChange === 'function'
          ? (data as any).onTitleChange
          : (newTitle: string) => handleNodeTitleChange(node.id, newTitle);

      const onInsertAfter =
        typeof (data as any).onInsertAfter === 'function'
          ? (data as any).onInsertAfter
          : () => {
              window.dispatchEvent(
                new CustomEvent('pm:openNodePalette', {
                  detail: { anchorNodeId: node.id },
                })
              );
            };

      const parent = node.parentId ? nodeById.get(node.parentId) : undefined;
      const parentIsFormContainer = isFormContainerNode(parent);
      const nodeIsFormContainer = isFormContainerNode(node);

      const onAddStepInsideForm =
        typeof (data as any).onAddStepInsideForm === 'function'
          ? (data as any).onAddStepInsideForm
          : () => {
              if (nodeIsFormContainer) {
                addFormStepInsideContainer(node.id);
                return;
              }
              if (parentIsFormContainer && node.parentId) {
                addFormStepInsideContainer(node.parentId, node.id);
                return;
              }
              onInsertAfter();
            };

      return {
        ...node,
        data: {
          ...data,
          onEdit,
          onDelete,
          onSave,
          onTitleChange,
          onInsertAfter,
          onAddStepInsideForm,
          onMoveUp: () => handleMoveNode(node.id, -1),
          onMoveDown: () => handleMoveNode(node.id, 1),
          isLastInWorkflow: lastNodeIdSet.has(node.id),
        },
      };
    });
  }, [addFormStepInsideContainer, handleNodeDelete, handleNodeEdit, handleNodeTitleChange, handleSaveWorkflow, lastNodeIdSet, nodes]);

  // Render-time edge virtualization: when a form process group is collapsed, edges to hidden child nodes
  // are re-targeted to virtual handles on the container boundary so connectivity remains visible.
  const edgesForCanvas = useMemo(() => {
    const nodeById = new Map(nodesWithHandlers.map((n) => [n.id, n] as const));

    const containerByHiddenChild = new Map<string, string>();
    nodesWithHandlers.forEach((n) => {
      if (!n.parentId) return;
      const parent = nodeById.get(n.parentId);
      const parentCollapsed = parent && (parent.data as any)?.isExpanded === false;
      if (!parentCollapsed) return;
      if (!n.hidden) return;
      containerByHiddenChild.set(n.id, n.parentId);
    });

    if (containerByHiddenChild.size === 0) return edges;

    const derived: Edge[] = [];

    edges.forEach((e) => {
      const sourceContainer = containerByHiddenChild.get(e.source);
      const targetContainer = containerByHiddenChild.get(e.target);

      if (!sourceContainer && !targetContainer) {
        derived.push(e);
        return;
      }

      // Internal edges inside the same collapsed container don’t need to render.
      if (sourceContainer && targetContainer && sourceContainer === targetContainer) {
        return;
      }

      const virtualEdge: Edge = {
        ...e,
        id: `${e.id}::vh`,
        ...(sourceContainer ? { source: sourceContainer, sourceHandle: `vh:out:${e.source}` } : {}),
        ...(targetContainer ? { target: targetContainer, targetHandle: `vh:in:${e.target}` } : {}),
        data: {
          ...(e.data || {}),
          virtual: {
            sourceContainer,
            targetContainer,
            originalSource: e.source,
            originalTarget: e.target,
          },
        },
      };

      // Edge where both ends are hidden but in different collapsed containers → container-to-container.
      if (sourceContainer && targetContainer) {
        (virtualEdge as any).source = sourceContainer;
        (virtualEdge as any).target = targetContainer;
        (virtualEdge as any).sourceHandle = `vh:out:${e.source}`;
        (virtualEdge as any).targetHandle = `vh:in:${e.target}`;
      }

      derived.push(virtualEdge);
    });

    return derived;
  }, [edges, nodesWithHandlers]);

  // Add-from-palette only: no in-canvas "+" nodes.
  const nodesForCanvas = useMemo(() => nodesWithHandlers, [nodesWithHandlers]);

  return (
    <FormBuilderProvider onNodeDataUpdate={handleNodeDataUpdate}>
    <FlowEditorProvider
      tenantLists={tenantLists}
      systemChoiceLists={systemChoiceLists}
      availableFields={selectedFormStep?.data?.fields || []}
      currentNodeId={selectedFormStep?.id || null}
    >
      <EditorContainer ref={editorContainerRef} $isFullscreen={isFullscreen}>
      {/* Deprecation Banner (Phase 6.1) */}
      {hasDeprecatedNodes && !bannerDismissed && (
        <DeprecationBanner>
          <BannerIcon>
            <AlertCircle size={20} />
          </BannerIcon>
          <BannerContent>
            <BannerTitle>Deprecated Nodes Detected</BannerTitle>
            <BannerMessage>
              This workflow contains {nodes.filter(n => ['formField', 'formSection'].includes(n.type || '')).length} deprecated node(s) 
              ({deprecatedNodeTypes.join(', ')}). Click "Migrate Now" to update to the modern format.
            </BannerMessage>
          </BannerContent>
          <BannerActions>
            <MigrateButton onClick={handleMigrateDeprecatedNodes}>
              Migrate Now
            </MigrateButton>
            <CloseButton onClick={() => setBannerDismissed(true)} title="Dismiss">
              <X />
            </CloseButton>
          </BannerActions>
        </DeprecationBanner>
      )}
      
      {/* Node Palette - Visual Mode */}
      {!readOnly && isPaletteVisible && normalizedEditorMode === 'visual' && (
        <NodePalette className="node-palette" data-tour="node-palette">
          <PaletteHeader>
            <PaletteTitle>Add Nodes</PaletteTitle>
            
            {/* Search Input */}
            <SearchInput
              ref={searchInputRef}
              type="text"
              placeholder="Search nodes... (press / to focus)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
            
            {/* Category Filters */}
            <CategoryFilters>
              {CATEGORY_ORDER.filter((category) => paletteCategories.has(category)).map((category) => {
                const isActive = activeFilters.has(category);
                const categoryColor = {
                  trigger: 'rgb(var(--color-success))',
                  form: 'rgb(var(--color-primary))',
                  logic: 'rgb(var(--color-warning))',
                  action: 'rgb(var(--color-info))',
                  wait: 'rgb(var(--color-error))',
                  document: 'rgb(var(--color-info))',
                  utility: 'rgb(var(--color-text-secondary))',
                  terminal: 'rgb(var(--color-success))',
                }[category];

                return (
                  <FilterChip
                    key={category}
                    $active={isActive}
                    $color={categoryColor}
                    onClick={() => toggleCategoryFilter(category)}
                    title={`Filter by ${CATEGORY_LABELS[category]}`}
                  >
                    {CATEGORY_LABELS[category]}
                  </FilterChip>
                );
              })}
            </CategoryFilters>
          </PaletteHeader>
          
          {/* Favorites Section */}
          {favoriteNodesList.length > 0 && (
            <PaletteCategory>
              <CategoryHeader onClick={() => toggleCategoryCollapse('favorites' as NodeCategory)}>
                <CategoryTitleRow>
                  <CategoryTitle>⭐ Favorites</CategoryTitle>
                  <CategoryBadge>{favoriteNodesList.length}</CategoryBadge>
                </CategoryTitleRow>
                <CollapseIcon $collapsed={collapsedCategories.has('favorites' as NodeCategory)}>
                  <ChevronDown size={14} />
                </CollapseIcon>
              </CategoryHeader>
              <CategoryContent $collapsed={collapsedCategories.has('favorites' as NodeCategory)}>
                {favoriteNodesList.map(node => (
                  <NodeItem
                    key={node.id}
                    $color={node.color}
                    draggable
                    onClick={() => handleClickToAddNode(node.id)}
                    onDragStart={(e) => onDragStart(e, node.id)}
                    onDrag={onDrag}
                    onDragEnd={onDragEnd}
                    title={node.description} // Full description on hover
                  >
                    <NodeIcon>{node.icon}</NodeIcon>
                    <NodeInfo>
                      <NodeName>{node.name}</NodeName>
                      <NodeDesc>{node.description.substring(0, 40)}...</NodeDesc>
                    </NodeInfo>
                    <FavoriteButton
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(node.id);
                      }}
                      $isFavorite={true}
                    >
                      <Star size={12} fill="currentColor" />
                    </FavoriteButton>
                  </NodeItem>
                ))}
              </CategoryContent>
            </PaletteCategory>
          )}
          
          {/* Recent Nodes Section */}
          {recentNodesList.length > 0 && (
            <PaletteCategory>
              <CategoryHeader onClick={() => toggleCategoryCollapse('recent' as NodeCategory)}>
                <CategoryTitleRow>
                  <CategoryTitle>🕒 Recent</CategoryTitle>
                  <CategoryBadge>{recentNodesList.length}</CategoryBadge>
                </CategoryTitleRow>
                <CollapseIcon $collapsed={collapsedCategories.has('recent' as NodeCategory)}>
                  <ChevronDown size={14} />
                </CollapseIcon>
              </CategoryHeader>
              <CategoryContent $collapsed={collapsedCategories.has('recent' as NodeCategory)}>
                {recentNodesList.map(node => (
                  <NodeItem
                    key={node.id}
                    $color={node.color}
                    draggable
                    onClick={() => handleClickToAddNode(node.id)}
                    onDragStart={(e) => onDragStart(e, node.id)}
                    onDrag={onDrag}
                    onDragEnd={onDragEnd}
                    title={node.description} // Full description on hover
                  >
                    <NodeIcon>{node.icon}</NodeIcon>
                    <NodeInfo>
                      <NodeName>{node.name}</NodeName>
                      <NodeDesc>{node.description.substring(0, 40)}...</NodeDesc>
                    </NodeInfo>
                    <FavoriteButton
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(node.id);
                      }}
                      $isFavorite={favorites.includes(node.id)}
                    >
                      <Star size={12} fill={favorites.includes(node.id) ? 'currentColor' : 'none'} />
                    </FavoriteButton>
                  </NodeItem>
                ))}
              </CategoryContent>
            </PaletteCategory>
          )}
          
          {/* Category-Based Nodes */}
          {CATEGORY_ORDER.filter((category) => paletteCategories.has(category)).map((category) => {
            const categoryNodes = filteredNodesByCategory[category];
            if (categoryNodes.length === 0) return null;
            
            const isCollapsed = collapsedCategories.has(category);
            
            return (
              <PaletteCategory key={category} $collapsed={isCollapsed}>
                <CategoryHeader onClick={() => toggleCategoryCollapse(category)}>
                  <CategoryTitleRow>
                    <CategoryTitle>{CATEGORY_LABELS[category]}</CategoryTitle>
                    <CategoryBadge>{categoryNodes.length}</CategoryBadge>
                  </CategoryTitleRow>
                  <CollapseIcon $collapsed={isCollapsed}>
                    <ChevronDown size={14} />
                  </CollapseIcon>
                </CategoryHeader>
                <CategoryContent $collapsed={isCollapsed}>
                  {categoryNodes.map(node => (
                    <NodeItem
                      key={node.id}
                      $color={node.color}
                      draggable
                      onClick={() => handleClickToAddNode(node.id)}
                      onDragStart={(e) => onDragStart(e, node.id)}
                      onDrag={onDrag}
                      onDragEnd={onDragEnd}
                      title={node.description} // Full description on hover
                    >
                      <NodeIcon>{node.icon}</NodeIcon>
                      <NodeInfo>
                        <NodeName>{node.name}</NodeName>
                        <NodeDesc>{node.description.substring(0, 40)}...</NodeDesc>
                      </NodeInfo>
                      <FavoriteButton
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(node.id);
                        }}
                        $isFavorite={favorites.includes(node.id)}
                      >
                        <Star size={12} fill={favorites.includes(node.id) ? 'currentColor' : 'none'} />
                      </FavoriteButton>
                    </NodeItem>
                  ))}
                </CategoryContent>
              </PaletteCategory>
            );
          })}
          
          {/* No Results Message */}
          {searchQuery && Object.values(filteredNodesByCategory).every(arr => arr.length === 0) && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'rgb(var(--color-text-tertiary))' }}>
              No nodes found for "{searchQuery}"
            </div>
          )}
        </NodePalette>
      )}

      {/* Toolbar */}
      {!readOnly && (
        <Toolbar data-tour="toolbar">
          <ToolbarButton 
            onClick={() => setIsTemplateModalOpen(true)}
            title="Browse Templates"
            style={{ fontWeight: 600, color: 'rgb(var(--color-primary))' }}
          >
            <Sparkles size={14} style={{ marginRight: '4px' }} />
            Use Template
          </ToolbarButton>
          <div style={{ width: '1px', height: '20px', background: 'rgb(var(--color-border))' }} />
          <ToolbarButton 
            onClick={undo} 
            disabled={historyIndex === 0}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={14} style={{ marginRight: '4px' }} />
            Undo
          </ToolbarButton>
          <ToolbarButton 
            onClick={redo} 
            disabled={historyIndex >= history.length - 1}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={14} style={{ marginRight: '4px' }} />
            Redo
          </ToolbarButton>
          
          {/* Phase 7: Workflow Persistence Buttons */}
          <div style={{ width: '1px', height: '20px', background: 'rgb(var(--color-border))' }} />
          <ToolbarButton 
            onClick={handleNewWorkflow} 
            title="New Workflow"
          >
            <Plus size={14} style={{ marginRight: '4px' }} />
            New
          </ToolbarButton>
          <LoadMenuContainer data-load-menu>
            <ToolbarButton 
              onClick={() => setIsLoadMenuOpen(!isLoadMenuOpen)} 
              title="Load Workflow"
              disabled={isLoading}
            >
              <FolderOpen size={14} style={{ marginRight: '4px' }} />
              Load
              <ChevronDown size={12} style={{ marginLeft: '4px' }} />
            </ToolbarButton>
            {isLoadMenuOpen && (
              <LoadMenuDropdown data-load-menu>
                {/* Phase 8.3: Search input */}
                <LoadMenuHeader>
                  <WorkflowSearchInput
                    type="text"
                    placeholder="Search workflows..."
                    value={workflowSearchQuery}
                    onChange={(e) => setWorkflowSearchQuery(e.target.value)}
                    autoFocus
                  />
                </LoadMenuHeader>
                
                <LoadMenuList>
                  {filteredWorkflows.length === 0 ? (
                    <LoadMenuEmpty>
                      {isLoading ? 'Loading workflows...' : workflowSearchQuery ? 'No workflows match your search' : 'No workflows found'}
                    </LoadMenuEmpty>
                  ) : (
                    filteredWorkflows.map(workflow => (
                      <LoadMenuItem key={workflow.id}>
                        <LoadMenuItemContent onClick={() => handleLoadWorkflow(workflow.id)}>
                          <LoadMenuItemTitle>{workflow.name}</LoadMenuItemTitle>
                          <LoadMenuItemMeta>
                            <span>{workflow.node_count} nodes</span>
                            <span>{workflow.status}</span>
                            <span>{new Date(workflow.updated_at).toLocaleDateString()}</span>
                          </LoadMenuItemMeta>
                        </LoadMenuItemContent>
                        <DeleteButton
                          onClick={(e) => handleDeleteClick(workflow, e)}
                          title="Delete workflow"
                        >
                          <Trash2 />
                        </DeleteButton>
                      </LoadMenuItem>
                    ))
                  )}
                </LoadMenuList>
              </LoadMenuDropdown>
            )}
          </LoadMenuContainer>
          <ToolbarButton 
            onClick={() => handleSaveWorkflow()} 
            title="Save Workflow (Ctrl+S)"
            disabled={isSaving}
            style={hasUnsavedChanges ? {
              background: 'rgb(var(--color-primary))',
              color: 'white',
              borderColor: 'rgb(var(--color-primary))'
            } : {}}
          >
            <Save size={14} style={{ marginRight: '4px' }} />
            {isSaving ? 'Saving...' : 'Save'}
          </ToolbarButton>

          <ToolbarButton
            onClick={handlePublishWorkflow}
            title={
              currentWorkflowStatus === 'active'
                ? 'Workflow is published'
                : (validationResult.errorCount > 0
                    ? 'Fix validation errors before publishing'
                    : 'Publish Workflow')
            }
            disabled={
              isSaving ||
              nodes.length === 0 ||
              currentWorkflowStatus === 'active' ||
              validationResult.errorCount > 0
            }
            style={currentWorkflowStatus !== 'active' ? {
              background: 'rgb(var(--color-success) / 0.12)',
              color: 'rgb(var(--color-success))',
              borderColor: 'rgb(var(--color-success) / 0.35)',
              fontWeight: 700,
            } : {}}
          >
            <CheckCircle size={14} style={{ marginRight: '4px' }} />
            {currentWorkflowStatus === 'active' ? 'Published' : 'Publish'}
          </ToolbarButton>
          
          {/* Task 1: Workflow Execution Integration */}
          <div style={{ width: '1px', height: '20px', background: 'rgb(var(--color-border))' }} />
          <ToolbarButton 
            onClick={() => setIsExecutionModalOpen(true)}
            title="Test Workflow Execution"
            style={{ 
              fontWeight: 600, 
              color: 'rgb(34, 197, 94)', // Success green
              borderColor: 'rgb(34, 197, 94, 0.3)'
            }}
            disabled={nodes.length === 0}
          >
            <Play size={14} style={{ marginRight: '4px' }} />
            Test Workflow
          </ToolbarButton>
          
          {/* Phase 1: Flow Preview Integration */}
          <ToolbarButton 
            onClick={() => setIsFlowPreviewOpen(true)}
            title="Run Flow Preview"
            style={{ 
              fontWeight: 600, 
              color: 'rgb(139, 92, 246)', // Purple accent
              borderColor: 'rgb(139, 92, 246, 0.3)'
            }}
            disabled={nodes.length === 0}
          >
            <Eye size={14} style={{ marginRight: '4px' }} />
            Preview Flow
          </ToolbarButton>
          
          {/* Phase 9.5: Debugger */}
          <ToolbarButton
            onClick={() => setShowDebugger((prev) => !prev)}
            title="Toggle Debugger (Ctrl+D)"
            disabled={nodes.length === 0}
            style={{
              fontWeight: 600,
              color: 'rgb(var(--color-primary))',
            }}
          >
            <Bug size={14} style={{ marginRight: '4px' }} />
            Debugger
          </ToolbarButton>

          {/* Phase 2: Auto-Layout */}
          <div style={{ width: '1px', height: '20px', background: 'rgb(var(--color-border))' }} />
          <ToolbarButton 
            onClick={handleAutoLayout}
            title="Auto-Layout All Nodes (Ctrl+L)"
            disabled={nodes.length === 0}
          >
            <AlignVerticalDistributeCenter size={14} style={{ marginRight: '4px' }} />
            Layout
          </ToolbarButton>

          <div style={{ width: '1px', height: '20px', background: 'rgb(var(--color-border))' }} />
          <ToolbarButton onClick={toggleFullscreen} title={isFullscreen ? 'Exit Fullscreen (ESC)' : 'Enter Fullscreen'}>
            {(isFullscreen || !!document.fullscreenElement) ? (
              <Minimize2 size={14} style={{ marginRight: '4px' }} />
            ) : (
              <Maximize2 size={14} style={{ marginRight: '4px' }} />
            )}
            Fullscreen
          </ToolbarButton>
        </Toolbar>
      )}

      {/* Viewport Controls */}
      <ViewportToolbar>
        {/* NEW: Explicit Node Palette Toggle */}
        {!readOnly && normalizedEditorMode === 'visual' && (
          <>
            <ViewportButton 
              onClick={() => setIsPaletteVisible(!isPaletteVisible)} 
              title={isPaletteVisible ? 'Hide Node Palette (Tab)' : 'Show Node Palette (Tab)'}
              style={isPaletteVisible ? {
                background: 'rgb(var(--color-primary))',
                color: 'white',
                borderColor: 'rgb(var(--color-primary))'
              } : {}}
            >
              <Plus />
            </ViewportButton>
            <ViewportButton
              onClick={toggleAISuggestionsVisible}
              title={isAISuggestionsVisible ? 'Hide AI Suggestions' : 'Show AI Suggestions'}
              style={isAISuggestionsVisible ? {
                background: 'rgb(var(--color-primary))',
                color: 'white',
                borderColor: 'rgb(var(--color-primary))'
              } : {}}
            >
              <Sparkles />
            </ViewportButton>
            <div style={{ width: '1px', height: '20px', background: 'rgb(var(--color-border))' }} />
          </>
        )}
        <ViewportButton 
          onClick={() => setIsSettingsPanelOpen(!isSettingsPanelOpen)} 
          title="Canvas Settings (Grid, Background)"
          style={isSettingsPanelOpen ? {
            background: 'rgb(var(--color-primary))',
            color: 'white',
            borderColor: 'rgb(var(--color-primary))'
          } : {}}
        >
          <Settings />
        </ViewportButton>
        <div style={{ width: '1px', height: '20px', background: 'rgb(var(--color-border))' }} />
        <ViewportButton onClick={() => fitView({ padding: 0.2, duration: 300 })} title="Fit to View (F)">
          <Maximize2 />
        </ViewportButton>
        <ViewportButton onClick={zoomIn} title="Zoom In">
          <ZoomIn />
        </ViewportButton>
        <ViewportButton onClick={zoomOut} title="Zoom Out">
          <ZoomOut />
        </ViewportButton>
        <div style={{ width: '1px', height: '20px', background: 'rgb(var(--color-border))' }} />
        <ViewportButton 
          onClick={() => setIsMinimapVisible(!isMinimapVisible)} 
          title={isMinimapVisible ? 'Hide Minimap (M)' : 'Show Minimap (M)'}
          style={isMinimapVisible ? {
            background: 'rgb(var(--color-primary))',
            color: 'white',
            borderColor: 'rgb(var(--color-primary))'
          } : {}}
        >
          <MapIcon />
        </ViewportButton>
        <div style={{ width: '1px', height: '20px', background: 'rgb(var(--color-border))' }} />
        {/* FIX: Wired Help button directly to Keyboard Shortcuts state */}
        <ViewportButton onClick={() => setShowKeyboardShortcuts(true)} title="Help & Keyboard Shortcuts (?)">
          <HelpCircle />
        </ViewportButton>
      </ViewportToolbar>
      
      {/* Mode Selector (Phase 2.2) - Only show if not controlled by prop */}
      {editorMode === undefined && (
        <ModeSelectorContainer>
          <ModeButton
            $active={normalizedEditorMode === 'wizard'}
            onClick={() => setInternalEditorMode('wizard')}
            title="Wizard Mode - Guided step-by-step creation"
          >
            <Wand2 />
            Wizard
          </ModeButton>
          <ModeButton
            $active={normalizedEditorMode === 'visual'}
            onClick={() => setInternalEditorMode('visual')}
            title="Visual Mode - Drag-and-drop canvas"
          >
            <Eye />
            Visual
          </ModeButton>
        </ModeSelectorContainer>
      )}

      <EditorWrapper>
      {/* React Flow Canvas - Visual Mode */}
      {normalizedEditorMode === 'visual' && (
        <DebugAwareReactFlow
        style={{ width: '100%', height: '100%' }}
        nodes={nodesForCanvas}
        edges={edgesForCanvas}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        nodesDraggable={true}
        nodesConnectable={false}
        isValidConnection={isValidConnection}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={handleCloseMenu}
        onPaneMouseMove={(event) => {
          if (!currentWorkflowId) return;
          if (!reactFlowInstance?.screenToFlowPosition) return;

          const pos = reactFlowInstance.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });

          collabSendCursorDebounced(pos);
        }}
        onSelectionChange={handleSelectionChange}
        nodeTypes={dynamicNodeTypes as unknown as NodeTypes}
        edgeTypes={staticEdgeTypes as unknown as EdgeTypes}
        // Phase 7.5/9: Always render only visible elements for large-editor performance
        onlyRenderVisibleElements={true}
        elevateNodesOnSelect={nodes.length < 200}
        maxZoom={4}
        minZoom={0.1}
        defaultEdgeOptions={{
          // Step edges with larger markers + wider interaction area.
          // NOTE: edgeTypes.step maps to EnhancedConnectionEdge to preserve toolbars/hitbox.
          type: 'step',
          style: { fill: 'none', strokeWidth: 3, stroke: 'rgb(var(--color-text-secondary))' },
          interactionWidth: 28,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 24,
            height: 24,
            color: 'rgb(var(--color-text-secondary))',
          },
        }}
        connectionLineStyle={{
          fill: 'none',
          stroke: 'rgb(var(--color-text-secondary))',
          strokeWidth: 3,
          strokeDasharray: '5,5',
          animation: 'dash 0.5s linear infinite',
        }}
        connectionLineType={ConnectionLineType.SmoothStep}
        snapToGrid={snapToGrid}
        snapGrid={[gridSize, gridSize]}
        connectionRadius={20}
      >
        <Background variant={backgroundVariant} gap={20} size={1} />

        {/* Phase 9.2: Live cursors overlay */}
        {collabPresence.length > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 50,
            }}
            aria-hidden="true"
          >
            {collabPresence.map((u) => {
              if (!u.cursor) return null;

              const viewport = reactFlowInstance?.getViewport?.() || { x: 0, y: 0, zoom: 1 };
              const left = u.cursor.x * viewport.zoom + viewport.x;
              const top = u.cursor.y * viewport.zoom + viewport.y;
              const color = u.color || 'rgb(var(--color-primary))';

              return (
                <div
                  key={u.userId}
                  style={{
                    position: 'absolute',
                    transform: `translate(${left}px, ${top}px)`,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 3l7.5 18 2-7 7-2L4 3z"
                      fill={color}
                      opacity={0.9}
                    />
                  </svg>
                  <div
                    style={{
                      marginTop: -2,
                      padding: '2px 6px',
                      borderRadius: 999,
                      background: 'rgb(var(--color-surface))',
                      border: `1px solid ${color}`,
                      color: 'rgb(var(--color-text-primary))',
                      fontSize: 11,
                      fontWeight: 600,
                      display: 'inline-block',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {u.name || 'User'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {isMinimapVisible && (
          <MiniMap 
            nodeColor={(node) => {
              const type = node.type;
              const registry = type ? NODE_TYPE_REGISTRY[type] : undefined;
              return registry?.color || 'rgb(var(--color-text-tertiary))';
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid rgb(var(--color-border))',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}
            pannable
            zoomable
          />
        )}
        
        {/* Sprint 1 Task 1.4: Canvas Settings Panel */}
        {isSettingsPanelOpen && (
          <SettingsPanel>
            <SettingGroup>
              <SettingLabel>Background Pattern</SettingLabel>
              <SettingRow>
                <PatternButton 
                  $active={backgroundVariant === BackgroundVariant.Dots}
                  onClick={() => setBackgroundVariant(BackgroundVariant.Dots)}
                >
                  Dots
                </PatternButton>
                <PatternButton 
                  $active={backgroundVariant === BackgroundVariant.Lines}
                  onClick={() => setBackgroundVariant(BackgroundVariant.Lines)}
                >
                  Lines
                </PatternButton>
                <PatternButton 
                  $active={backgroundVariant === BackgroundVariant.Cross}
                  onClick={() => setBackgroundVariant(BackgroundVariant.Cross)}
                >
                  Cross
                </PatternButton>
              </SettingRow>
            </SettingGroup>
            
            <SettingGroup>
              <SettingLabel>Snap to Grid</SettingLabel>
              <SettingRow>
                <span style={{ flex: 1, fontSize: '12px', color: 'rgb(var(--color-text-primary))' }}>
                  {snapToGrid ? 'Enabled' : 'Disabled'}
                </span>
                <ToggleSwitch 
                  $active={snapToGrid}
                  onClick={() => setSnapToGrid(!snapToGrid)}
                />
              </SettingRow>
            </SettingGroup>
            
            <SettingGroup>
              <SettingLabel>Grid Size (px)</SettingLabel>
              <SettingRow>
                <GridSizeInput 
                  type="number"
                  min="5"
                  max="50"
                  step="5"
                  value={gridSize}
                  onChange={(e) => setGridSize(Math.max(5, Math.min(50, parseInt(e.target.value) || 15)))}
                />
              </SettingRow>
            </SettingGroup>
          </SettingsPanel>
        )}
        
        {/* Empty State */}
        {nodes.length === 0 && (
          <EmptyState>
            <EmptyIcon>⚡</EmptyIcon>
            <EmptyTitle>Start with a Trigger</EmptyTitle>
            <EmptyText>
              Every workflow needs a clear entry point.
              <br />
              Pick how this flow starts, then add your steps.
              <br />
              <br />
              Tip: Press <strong>/</strong> to search the palette.
            </EmptyText>
            <EmptyActions>
              <EmptyPrimaryButton
                onClick={() => {
                  handleClickToAddNode('triggerManual');
                }}
              >
                + Add Manual Trigger
              </EmptyPrimaryButton>
              <EmptySecondaryButton
                onClick={() => {
                  setIsTemplateModalOpen(true);
                }}
              >
                Use Template
              </EmptySecondaryButton>
              <EmptySecondaryButton
                onClick={() => {
                  setIsPaletteVisible(true);
                  setSearchQuery('');
                  setTimeout(() => searchInputRef.current?.focus(), 0);
                }}
              >
                Browse Triggers
              </EmptySecondaryButton>
            </EmptyActions>
          </EmptyState>
        )}
        
        {/* Alignment Toolbar (Phase 4 Batch 6) - Shows when 2+ nodes selected */}
        <AlignmentToolbar className={nodes.filter(n => n.selected).length >= 2 ? 'visible' : ''}>
          <AlignmentButton onClick={alignLeft} title="Align Left (Ctrl+Shift+L)">
            <AlignLeft />
          </AlignmentButton>
          <AlignmentButton onClick={alignCenterX} title="Align Center X (Ctrl+Shift+X)">
            <AlignCenterHorizontal />
          </AlignmentButton>
          <AlignmentButton onClick={alignRight} title="Align Right (Ctrl+Shift+R)">
            <AlignRight />
          </AlignmentButton>
          
          <div style={{ width: '1px', height: '24px', background: 'rgb(var(--color-border))', margin: '0 4px' }} />
          
          <AlignmentButton onClick={alignTop} title="Align Top (Ctrl+Shift+T)">
            <AlignStartVertical />
          </AlignmentButton>
          <AlignmentButton onClick={alignCenterY} title="Align Center Y (Ctrl+Shift+Y)">
            <AlignCenterVertical />
          </AlignmentButton>
          <AlignmentButton onClick={alignBottom} title="Align Bottom (Ctrl+Shift+B)">
            <AlignEndVertical />
          </AlignmentButton>
          
          <div style={{ width: '1px', height: '24px', background: 'rgb(var(--color-border))', margin: '0 4px' }} />
          
          <AlignmentButton onClick={alignHorizontal} title="Distribute Horizontal (Ctrl+Shift+H)">
            <AlignHorizontalDistributeCenter />
          </AlignmentButton>
          <AlignmentButton onClick={alignVertical} title="Distribute Vertical (Ctrl+Shift+V)">
            <AlignVerticalDistributeCenter />
          </AlignmentButton>
        </AlignmentToolbar>
      </DebugAwareReactFlow>
      )}
      
      {/* Phase E.3: Context Menu */}
      {menu && (
        <NodeContextMenu
          node={menu.node}
          x={menu.x}
          y={menu.y}
          onClose={handleCloseMenu}
          onEdit={(nodeId) => {
            handleCloseMenu();
            handleNodeEdit(nodeId);
          }}
          onDuplicate={(nodeId) => {
            handleCloseMenu();
            duplicateNode(nodeId);
          }}
          onDelete={async (nodeId) => {
            handleCloseMenu();
            await handleNodeDelete(nodeId);
          }}
        />
      )}
      
      
      {/* Wizard Mode - Typeform-inspired (Phase 2.2 Batch 3) */}
      {normalizedEditorMode === 'wizard' && (
        <WizardContainer>
          <WizardCard>
            {/* Progress Indicator */}
            <WizardProgress>
              <ProgressDot $active={wizardState.currentStep === 'welcome'} $completed={false} />
              <ProgressDot $active={wizardState.currentStep === 'flow-type'} $completed={wizardState.flowType !== null} />
              <ProgressDot $active={wizardState.currentStep === 'add-nodes'} $completed={wizardState.addedNodeCount > 0} />
              <ProgressDot $active={wizardState.currentStep === 'preview'} $completed={false} />
            </WizardProgress>

            {/* Step 1: Welcome */}
            {wizardState.currentStep === 'welcome' && (
              <>
                <WizardIcon>🪄</WizardIcon>
                <WizardTitle>Let's build your flow!</WizardTitle>
                <WizardDescription>
                  I'll guide you step-by-step to create your custom form or workflow.
                  You can switch to Visual Editor anytime if you prefer.
                </WizardDescription>
                <WizardInput
                  type="text"
                  placeholder="Give your flow a name..."
                  value={wizardState.flowName}
                  onChange={(e) => setWizardFlowName(e.target.value)}
                  autoFocus
                />
                <WizardActions>
                  <WizardButton $variant="ghost" onClick={wizardSwitchToVisual}>
                    Switch to Visual Editor
                  </WizardButton>
                  <WizardButton 
                    $variant="primary" 
                    onClick={wizardNextStep}
                    disabled={!wizardState.flowName.trim()}
                  >
                    Get Started <ArrowRight size={16} />
                  </WizardButton>
                </WizardActions>
              </>
            )}

            {/* Step 2: Flow Type Selection */}
            {wizardState.currentStep === 'flow-type' && (
              <>
                <WizardIcon>🎯</WizardIcon>
                <WizardTitle>What type of flow is this?</WizardTitle>
                <WizardDescription>
                  This helps me suggest the right building blocks for your needs.
                </WizardDescription>
                
                <FlowTypeGrid>
                  <FlowTypeCard 
                    $selected={wizardState.flowType === 'form'}
                    onClick={() => setWizardFlowType('form')}
                  >
                    <FlowTypeIcon>📝</FlowTypeIcon>
                    <FlowTypeLabel>Form</FlowTypeLabel>
                    <FlowTypeDesc>Collect information from users</FlowTypeDesc>
                  </FlowTypeCard>
                  
                  <FlowTypeCard 
                    $selected={wizardState.flowType === 'workflow'}
                    onClick={() => setWizardFlowType('workflow')}
                  >
                    <FlowTypeIcon>⚙️</FlowTypeIcon>
                    <FlowTypeLabel>Workflow</FlowTypeLabel>
                    <FlowTypeDesc>Automate business processes</FlowTypeDesc>
                  </FlowTypeCard>
                  
                  <FlowTypeCard 
                    $selected={wizardState.flowType === 'approval'}
                    onClick={() => setWizardFlowType('approval')}
                  >
                    <FlowTypeIcon>✅</FlowTypeIcon>
                    <FlowTypeLabel>Approval</FlowTypeLabel>
                    <FlowTypeDesc>Multi-step approval process</FlowTypeDesc>
                  </FlowTypeCard>
                  
                  <FlowTypeCard 
                    $selected={wizardState.flowType === 'document'}
                    onClick={() => setWizardFlowType('document')}
                  >
                    <FlowTypeIcon>📄</FlowTypeIcon>
                    <FlowTypeLabel>Document</FlowTypeLabel>
                    <FlowTypeDesc>Generate PDF documents</FlowTypeDesc>
                  </FlowTypeCard>
                </FlowTypeGrid>
                
                <WizardActions>
                  <WizardButton $variant="secondary" onClick={wizardPrevStep}>
                    Back
                  </WizardButton>
                  <WizardButton 
                    $variant="primary" 
                    onClick={wizardNextStep}
                    disabled={!wizardState.flowType}
                  >
                    Continue <ArrowRight size={16} />
                  </WizardButton>
                </WizardActions>
              </>
            )}

            {/* Step 3: Add Nodes */}
            {wizardState.currentStep === 'add-nodes' && (
              <>
                <WizardIcon>✨</WizardIcon>
                <WizardTitle>Add building blocks</WizardTitle>
                <WizardDescription>
                  Based on your {wizardState.flowType} flow, here are some recommended components.
                  Click to add them to your flow.
                </WizardDescription>
                
                <SuggestedNodesGrid>
                  {wizardState.suggestedNodes.map((nodeType) => {
                    const nodeConfig = NODE_TYPE_REGISTRY[nodeType];
                    if (!nodeConfig) return null;
                    
                    return (
                      <SuggestedNodeCard
                        key={nodeType}
                        onClick={() => wizardAddNode(nodeType)}
                      >
                        <NodeIconCircle $color={nodeConfig.color}>
                          {nodeConfig.icon}
                        </NodeIconCircle>
                        <WizardNodeInfo>
                          <WizardNodeLabel>{nodeConfig.name}</WizardNodeLabel>
                          <WizardNodeDesc>{nodeConfig.description?.slice(0, 40)}...</WizardNodeDesc>
                        </WizardNodeInfo>
                        <Plus size={16} />
                      </SuggestedNodeCard>
                    );
                  })}
                </SuggestedNodesGrid>
                
                {wizardState.addedNodeCount > 0 && (
                  <div style={{ 
                    padding: '12px', 
                    background: 'rgba(var(--color-success), 0.1)', 
                    borderRadius: 'var(--radius-md)',
                    color: 'rgb(var(--color-success))',
                    marginBottom: '24px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    justifyContent: 'center'
                  }}>
                    <Sparkles size={16} />
                    {wizardState.addedNodeCount} node{wizardState.addedNodeCount !== 1 ? 's' : ''} added to your flow!
                  </div>
                )}
                
                <WizardActions>
                  <WizardButton $variant="secondary" onClick={wizardPrevStep}>
                    Back
                  </WizardButton>
                  <WizardButton 
                    $variant="primary" 
                    onClick={wizardNextStep}
                    disabled={wizardState.addedNodeCount === 0}
                  >
                    Preview Flow <ArrowRight size={16} />
                  </WizardButton>
                </WizardActions>
              </>
            )}

            {/* Step 4: Preview & Complete */}
            {wizardState.currentStep === 'preview' && (
              <>
                <WizardIcon>🎉</WizardIcon>
                <WizardTitle>Your flow is ready!</WizardTitle>
                <WizardDescription>
                  <strong>{wizardState.flowName}</strong> has been created with {wizardState.addedNodeCount} node{wizardState.addedNodeCount !== 1 ? 's' : ''}.
                  <br /><br />
                  Switch to Visual Editor to see your flow on the canvas and customize it further.
                </WizardDescription>
                
                <WizardActions>
                  <WizardButton $variant="secondary" onClick={wizardPrevStep}>
                    Add More Nodes
                  </WizardButton>
                  <WizardButton $variant="primary" onClick={wizardSwitchToVisual}>
                    <Eye size={16} />
                    Open in Visual Editor
                  </WizardButton>
                </WizardActions>
              </>
            )}
          </WizardCard>
        </WizardContainer>
      )}

      {!readOnly && normalizedEditorMode === 'visual' && (
        <AISuggestionsPanel
          nodes={nodes}
          edges={edges}
          selectedNodeId={selectedNodeId ?? undefined}
          onAddNode={handleAddNodeFromAISuggestion}
          isVisible={isAISuggestionsVisible}
        />
      )}

      </EditorWrapper>

      {/* Drag Ghost Preview */}
      {isDragging && dragPosition && dragNodeType && (
        <DragGhost
          style={{ 
            left: dragPosition.x, 
            top: dragPosition.y,
            boxShadow: nearbyNode ? '0 0 0 3px rgba(var(--color-success), 0.5)' : '0 8px 24px rgba(0, 0, 0, 0.2)',
          }}
          $color={NODE_TYPE_REGISTRY[dragNodeType]?.color}
        >
          {NODE_TYPE_REGISTRY[dragNodeType]?.icon}
          {NODE_TYPE_REGISTRY[dragNodeType]?.name}
          {nearbyNode && <span style={{ marginLeft: '8px' }}>🔗</span>}
        </DragGhost>
      )}

      {/* Configuration Panel with Shadow State (Phase 2) - Portal Rendered */}
      {/* 🔧 2026-02-24: Use dedicated portal root for reliable rendering */}
      {selectedNode !== null && (() => {
        const portal = document.getElementById('config-portal');
        
        if (!portal) {
          logger.error('[UnifiedFlowEditor] ❌ Portal NOT found - panel will not render');
          return null;
        }
        
        logger.debug('[UnifiedFlowEditor] ✅ Rendering config panel:', {
          nodeId: selectedNode.id,
          nodeType: selectedNode.type,
          portalExists: true,
          portalKey
        });
        
        return createPortal(
          <ConfigPanelErrorBoundary>
            <TabbedConfigPanelWithShadow
              key={`panel-content-${selectedNode.id}-${portalKey}`}
              node={selectedNode}
              nodes={nodes}
              edges={edges}
              setNodes={setNodes}
              setEdges={setEdges}
              onClose={() => {
                logger.debug('[Tabbed Config Panel] Closing panel for node:', selectedNode.id);
                setSelectedNode(null);
              }}
              onUpdate={handleNodeUpdate}
              onTest={handleNodeTest}
              onSelectNode={(nodeId) => {
                const node = nodes.find(n => n.id === nodeId);
                if (node) {
                  logger.debug('[Tabbed Config Panel] Switching to node:', nodeId);
                  setSelectedNode(node);
                }
              }}
            />
          </ConfigPanelErrorBoundary>,
          portal
        );
      })()}
      
      {/* Template Selector Modal (Phase 2.5 Integration) */}
      <TemplateSelector
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSelectTemplate={handleTemplateSelect}
        onStartBlank={handleStartBlank}
      />
      
      {/* 
        NUCLEAR CLEANUP: All hardcoded config panels removed
        NodeConfigPanelWithShadow (DynamicConfigPanel) is now the ONLY renderer
        These SidePanel modals are no longer needed - all config handled by the main panel
      
      {/* FormStep Configuration Panel (using SidePanel instead of EntityFormStepModal) */}
      {/* <SidePanel
        isOpen={formStepModalOpen && !!selectedFormStep}
        onClose={() => {
          setFormStepModalOpen(false);
          setSelectedFormStep(null);
        }}
      >
        {selectedFormStep && (
          <FormStepConfigPanel
            step={selectedFormStep.data}
            nodeId={selectedFormStep.id}
            onChange={(updatedStepData) => {
              handleNodeUpdate(selectedFormStep.id, updatedStepData);
              setFormStepModalOpen(false);
              setSelectedFormStep(null);
            }}
            onClose={() => {
              setFormStepModalOpen(false);
              setSelectedFormStep(null);
            }}
            availableFields={getPreviousStepFields(selectedFormStep.id)}
          />
        )}
      </SidePanel> */}
      
      {/* FormMultiStepContainer Configuration Modal (Phase 4.3) - KEEPING THIS */}
      <FormProcessModal
        isOpen={containerModalOpen && !!selectedContainer}
        onClose={() => {
          setContainerModalOpen(false);
          setSelectedContainer(null);
        }}
        onSave={handleContainerSave}
        initialData={selectedContainer ? convertNodeDataToContainerData(selectedContainer) : undefined}
        nodeId={selectedContainer?.id}
      />
      
      {/* Workflow Management Modal (Phase 8.2) */}
      <WorkflowManagementModal
        isOpen={isWorkflowModalOpen}
        onClose={() => setIsWorkflowModalOpen(false)}
        onSave={handleWorkflowModalSave}
        initialData={{
          name: currentWorkflowName,
          description: currentWorkflowDescription,
          status: currentWorkflowStatus,
        }}
        mode={workflowModalMode}
      />
      
      {/* BATCH 1 CLEANUP COMPLETE: All hardcoded config panels removed.
           Configuration now flows through:
           1. handleNodeEdit() → setSelectedNode()
           2. TabbedConfigPanel wraps DynamicConfigPanel
           3. DynamicConfigPanel renders schema-driven UI for all 51 node types
           
           Remaining specialized panels:
           - FormFieldConfigPanel (nested editing within FormStep)
           - ContainerConfigPanel (FormProcess special handling)
      */}
      
      {/* FormField Configuration Modal (nested) - From within FormStep */}
      <SidePanel
        isOpen={!!editingField}
        onClose={() => setEditingField(null)}
      >
        {editingField && (
          <FormFieldConfigPanel
            field={editingField}
            onChange={handleFieldUpdate}
            onClose={() => setEditingField(null)}
          />
        )}
      </SidePanel>
      
      {/* Preview Panel (Phase 5.1) */}
      <PreviewPanel
        nodes={nodes}
        isVisible={isPreviewVisible}
        onClose={() => setIsPreviewVisible(false)}
      />
      
      {/* Phase 8.1: Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgb(var(--color-surface))',
            color: 'rgb(var(--color-text-primary))',
            border: '1px solid rgb(var(--color-border))',
          },
          success: {
            iconTheme: {
              primary: 'rgb(34, 197, 94)', // green-500
              secondary: 'white',
            },
          },
          error: {
            iconTheme: {
              primary: 'rgb(239, 68, 68)', // red-500
              secondary: 'white',
            },
          },
          loading: {
            iconTheme: {
              primary: 'rgb(var(--color-primary))',
              secondary: 'white',
            },
          },
        }}
      />
      
      {/* Phase 8.3: Delete Confirmation Modal */}
      {deleteConfirmOpen && workflowToDelete && (
        <ConfirmModal onClick={() => !isDeleting && setDeleteConfirmOpen(false)}>
          <ConfirmContent onClick={(e) => e.stopPropagation()}>
            <ConfirmTitle>Delete Workflow?</ConfirmTitle>
            <ConfirmMessage>
              Are you sure you want to delete "<strong>{workflowToDelete.name}</strong>"? 
              This action cannot be undone.
            </ConfirmMessage>
            <ConfirmActions>
              <ConfirmButton
                $variant="secondary"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </ConfirmButton>
              <ConfirmButton
                $variant="danger"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </ConfirmButton>
            </ConfirmActions>
          </ConfirmContent>
        </ConfirmModal>
      )}
      
      {/* Phase 7/9.5: Dry Run Debugger Panel */}
      <DryRunDebuggerPanel
        isVisible={showDebugger}
        selectedNode={selectedNodeForDebug}
        onClose={() => setShowDebugger(false)}
      />

      {/* Phase 8.6: Keyboard Shortcuts Help Modal */}
      {showKeyboardShortcuts && (
        <KeyboardShortcutsModal onClick={() => setShowKeyboardShortcuts(false)}>
          <KeyboardShortcutsContent onClick={(e) => e.stopPropagation()}>
            <KeyboardShortcutsHeader>
              <KeyboardShortcutsTitle>Keyboard Shortcuts</KeyboardShortcutsTitle>
              <button
                onClick={() => setShowKeyboardShortcuts(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'rgb(var(--color-text-secondary))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                }}
              >
                <X />
              </button>
            </KeyboardShortcutsHeader>
            <KeyboardShortcutsBody>
              <ShortcutSection>
                <ShortcutSectionTitle>General</ShortcutSectionTitle>
                <ShortcutList>
                  <ShortcutItem>
                    <ShortcutLabel>Show keyboard shortcuts</ShortcutLabel>
                    <ShortcutKeys>
                      <ShortcutKey>?</ShortcutKey>
                    </ShortcutKeys>
                  </ShortcutItem>
                  <ShortcutItem>
                    <ShortcutLabel>Close modal</ShortcutLabel>
                    <ShortcutKeys>
                      <ShortcutKey>ESC</ShortcutKey>
                    </ShortcutKeys>
                  </ShortcutItem>
                </ShortcutList>
              </ShortcutSection>
              
              <ShortcutSection>
                <ShortcutSectionTitle>Workflow</ShortcutSectionTitle>
                <ShortcutList>
                  <ShortcutItem>
                    <ShortcutLabel>Save workflow</ShortcutLabel>
                    <ShortcutKeys>
                      <ShortcutKey>Ctrl</ShortcutKey>
                      <ShortcutKey>S</ShortcutKey>
                    </ShortcutKeys>
                  </ShortcutItem>
                  <ShortcutItem>
                    <ShortcutLabel>New workflow</ShortcutLabel>
                    <ShortcutKeys>
                      <ShortcutKey>Ctrl</ShortcutKey>
                      <ShortcutKey>N</ShortcutKey>
                    </ShortcutKeys>
                  </ShortcutItem>
                </ShortcutList>
              </ShortcutSection>
              
              <ShortcutSection>
                <ShortcutSectionTitle>Canvas</ShortcutSectionTitle>
                <ShortcutList>
                  <ShortcutItem>
                    <ShortcutLabel>Select all nodes</ShortcutLabel>
                    <ShortcutKeys>
                      <ShortcutKey>Ctrl</ShortcutKey>
                      <ShortcutKey>A</ShortcutKey>
                    </ShortcutKeys>
                  </ShortcutItem>
                  <ShortcutItem>
                    <ShortcutLabel>Delete selected nodes</ShortcutLabel>
                    <ShortcutKeys>
                      <ShortcutKey>Delete</ShortcutKey>
                    </ShortcutKeys>
                  </ShortcutItem>
                  <ShortcutItem>
                    <ShortcutLabel>Undo</ShortcutLabel>
                    <ShortcutKeys>
                      <ShortcutKey>Ctrl</ShortcutKey>
                      <ShortcutKey>Z</ShortcutKey>
                    </ShortcutKeys>
                  </ShortcutItem>
                  <ShortcutItem>
                    <ShortcutLabel>Redo</ShortcutLabel>
                    <ShortcutKeys>
                      <ShortcutKey>Ctrl</ShortcutKey>
                      <ShortcutKey>Y</ShortcutKey>
                    </ShortcutKeys>
                  </ShortcutItem>
                  <ShortcutItem>
                    <ShortcutLabel>Fit view</ShortcutLabel>
                    <ShortcutKeys>
                      <ShortcutKey>Ctrl</ShortcutKey>
                      <ShortcutKey>0</ShortcutKey>
                    </ShortcutKeys>
                  </ShortcutItem>
                </ShortcutList>
              </ShortcutSection>
            </KeyboardShortcutsBody>
          </KeyboardShortcutsContent>
        </KeyboardShortcutsModal>
      )}
      
      {/* Task 1: Workflow Execution Integration */}
      {isExecutionModalOpen && currentWorkflowId && (
        <WorkflowExecutionModal
          isOpen={isExecutionModalOpen}
          onClose={() => setIsExecutionModalOpen(false)}
          workflow={{
            id: currentWorkflowId,
            name: currentWorkflowName || 'Untitled Workflow',
            nodes,
            edges,
          }}
        />
      )}
      
      {/* Phase 1: Flow Preview Modal */}
      {isFlowPreviewOpen && (
        <FlowPreviewModal
          isOpen={isFlowPreviewOpen}
          onClose={() => setIsFlowPreviewOpen(false)}
        />
      )}

      {/* Help Modal (Workform Batch 2) */}
      {isHelpModalOpen && (
        <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
      )}

      {/* FormBuilder Modal (Phase 6) */}
      {isFormBuilderOpen && editingNodeId && (
        <FormBuilder
          isOpen={isFormBuilderOpen}
          onClose={closeFormBuilder}
          onSave={saveFormBuilder}
          nodeId={editingNodeId}
        />
      )}
      
      {/* Onboarding Tour (Gap Analysis Phase 1.1) */}
      <Joyride
        steps={tourSteps}
        run={runTour}
        stepIndex={tourStepIndex}
        onEvent={handleTourCallback}
        continuous
        options={tourOptions}
        styles={tourStyles}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip tour',
        }}
      />
      </EditorContainer>
    </FlowEditorProvider>
    </FormBuilderProvider>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Legacy exports for backward compatibility.
 * These functions are now in utils/nodeNormalization.ts
 * 
 * @deprecated Import from utils/nodeNormalization.ts instead
 */
export { normalizeNodeData, normalizeNodes } from './utils/nodeNormalization';

function getReactFlowNodeType(nodeTypeId: string): string {
  // Force all triggers to use the rich Unified Trigger node & schema
  if (nodeTypeId.startsWith('trigger')) return 'trigger';

  // Form Process: render containers as a dedicated non-purple container node
  if (isFormProcessContainerType(nodeTypeId)) return 'formProcessContainer';

  // Preserve specific types for all other nodes so their specific schemas load
  return nodeTypeId;
}

/** Returns true for all Form Process container node type IDs (current + legacy). */
function isFormProcessContainerType(nodeType: string | undefined | null): boolean {
  return (
    nodeType === 'formBook' ||
    nodeType === 'formProcessGroup' ||
    nodeType === 'formProcess' ||
    nodeType === 'formMultiStepContainer'
  );
}

function getDefaultNodeData(nodeTypeId: string): Record<string, any> {
  const nodeDef = NODE_TYPE_REGISTRY[nodeTypeId];
  const resolvedType = getReactFlowNodeType(nodeTypeId);

  let defaults: Record<string, any> = {
    nodeType: nodeTypeId, // preserve original specific type for metadata
    maxInputs: nodeDef?.maxInputs ?? 1,
    maxOutputs: nodeDef?.maxOutputs ?? 1,
  };

  // Unified trigger defaults (driving triggerSchema conditionals)
  if (resolvedType === 'trigger') {
    const triggerMap: Record<string, string> = {
      triggerManual: 'manual',
      triggerSchedule: 'schedule',
      triggerWebhook: 'webhook',
      triggerEvent: 'event',
      triggerForm: 'formSubmit',
    };
    const mappedType = triggerMap[nodeTypeId] || 'manual';

    // Used by unified trigger schema dropdown + section conditionals
    defaults.type = mappedType;

    // Used by the visual TriggerNode component (kept for backward compatibility)
    defaults.triggerType = mappedType;

    // Triggers are entrypoints
    defaults.maxInputs = 0;
  }

  // Special handling for containers
  if (isFormProcessContainerType(nodeTypeId)) {
    defaults.fields = [];
    defaults.containerName = 'New Container';
    defaults.isExpanded = true;
    defaults.childNodes = [];
  }

  // Preserve behavior expected by base node components
  if (nodeTypeId.startsWith('condition')) {
    defaults.rules = defaults.rules ?? [];
    defaults.logicalOperator = defaults.logicalOperator ?? 'AND';
  }

  if (nodeTypeId.startsWith('action')) {
    const actionType = nodeTypeId.replace('action', '');
    const typeMap: Record<string, string> = {
      Email: 'email',
      Notify: 'notify',
      CreateRecord: 'createRecord',
      UpdateRecord: 'updateRecord',
      DeleteRecord: 'deleteRecord',
      HTTP: 'http',
      Script: 'script',
    };
    defaults.actionType = typeMap[actionType] || defaults.actionType || 'email';
  }

  if (nodeTypeId.startsWith('wait')) {
    const waitType = nodeTypeId.replace('wait', '').toLowerCase();
    defaults.waitType = defaults.waitType || waitType || 'approval';
  }

  if (nodeTypeId.startsWith('document')) {
    const docType = nodeTypeId.replace('document', '').toLowerCase();
    defaults.documentType = defaults.documentType || docType || 'generate';
  }

  if (nodeTypeId.startsWith('utility')) {
    const utilType = nodeTypeId.replace('utility', '').toLowerCase();
    defaults.utilityType = defaults.utilityType || utilType || 'transform';
  }

  if (nodeTypeId.startsWith('terminal') || nodeTypeId.startsWith('end')) {
    const termType = nodeTypeId.replace('terminal', '').replace('end', '').toLowerCase();
    defaults.terminalType = defaults.terminalType || termType || 'success';
    defaults.maxOutputs = 0;
  }

  // Auto-extract defaults from schema to fix DynamicConfigPanel visibility conditions
  try {
    if (schemaRegistry.hasSchema(resolvedType)) {
      const schema = schemaRegistry.getSchema(resolvedType);
      schema.sections.forEach((section) => {
        section.fields.forEach((field) => {
          if (field.defaultValue !== undefined && defaults[field.id] === undefined) {
            defaults[field.id] = field.defaultValue;
          }
        });
      });
    }
  } catch {
    logger.warn(`Could not extract schema defaults for ${resolvedType}`);
  }

  return defaults;
}

// ============================================================================
// Export with Provider
// ============================================================================

export const UnifiedFlowEditor: React.FC<UnifiedFlowEditorProps> = (props) => {
  return (
    <ErrorBoundary 
      componentName="Workforms Editor"
      onError={(error, errorInfo) => {
        logger.error('[UnifiedFlowEditor] Critical error:', { error, errorInfo });
      }}
    >
      <ReactFlowProvider>
        <UnifiedFlowEditorInner {...props} />
      </ReactFlowProvider>
    </ErrorBoundary>
  );
};

export default UnifiedFlowEditor;
