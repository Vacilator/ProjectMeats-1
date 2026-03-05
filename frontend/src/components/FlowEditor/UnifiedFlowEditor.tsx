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
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { debounce } from 'lodash';
import Editor from '@monaco-editor/react';
import { useQuery } from '@tanstack/react-query';
import { adminClient } from '../../services/apiService';
import toast, { Toaster } from 'react-hot-toast'; // Phase 8.1
import * as Sentry from '@sentry/react'; // Error tracking
import { logger } from '../../utils/logger'; // Centralized logging
import { isTypingInInput } from './utils/keyboardUtils'; // Phase 4
import Joyride from 'react-joyride'; // Gap Analysis Phase 1.1
import { useRenderPerformance } from '../../utils/performance'; // Phase 7.5
import { 
  useOnboardingTour, 
  workflowEditorTourSteps, 
  tourStyles 
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
  Code2, 
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
  Map, // Sprint 1 Task 1.3: Minimap toggle
  Settings, // Sprint 1 Task 1.4: Background & Grid settings
} from 'lucide-react';

import {
  FormNode,
  FormStepSingleNode,
  FormReferenceNode,
  FormProcessNode,
  FormProcessGroupNode,
  TriggerNode,
  ConditionIfNode,
  ActionNode,
  WaitStateNode,
  DocumentNode,
  UtilityNode,
  TerminalNode,
} from './nodes';
import { CustomEdge, ConditionalEdge, ErrorEdge, SuccessEdge } from './edges';
import { FormBuilder } from '../form-builder';
import { useFormBuilder } from './hooks/useFormBuilder';
import { ValidationDrawer } from './components/ValidationDrawer';
import { DryRunDebugger } from './components/DryRunDebugger';
import { validateWorkflow, type ValidationResult } from './utils/validationEngine';
import { NODE_TYPE_REGISTRY, NodeCategory, CATEGORY_LABELS, CATEGORY_ORDER, getNodeTypeDefinition } from './nodeTypes';
import { calculateContainerLayout, autoConnectSequentialSteps } from './utils/containerLayout'; // Phase 3-4
import { NodeContextMenu, useContextMenu } from './NodeContextMenu'; // Phase E.3
import { EnhancedContextMenu, useEnhancedContextMenu } from './components/EnhancedContextMenu'; // Phase 2: UI/UX
import { saveWorkflow, loadWorkflow, listWorkflows, deleteWorkflow, type WorkflowListItem } from './utils/workflowPersistence'; // Phase 7, 8.3
import { workformsApi } from '../../services/workformsApi'; // Task 2: Ghost Node Deletion
import { sortNodesTopologically } from './utils/nodeSorting'; // Phase 2 Critical Fix
import { normalizeNodeData, normalizeNodes } from './utils/nodeNormalization'; // Fix test imports
import { NodeConfigPanelWithShadow, TabbedConfigPanelWithShadow } from './ConfigPanel';
import { getLayoutedElements, alignNodesHorizontally, alignNodesVertically, distributeNodesHorizontally, distributeNodesVertically } from './utils/autoLayout'; // Phase 2: UI/UX
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'; // Phase 2: UI/UX

// FormBuilder Context Provider (2026-02-21 Comprehensive Enhancements)
import { FormBuilderProvider } from '../../contexts/FormBuilderContext';

// Error Boundary (2026-02-21 Comprehensive Enhancements)
import { ErrorBoundary } from './ErrorBoundary';
// NUCLEAR CLEANUP: All hardcoded panels removed - DynamicConfigPanel is now the ONLY renderer
import { FormStepConfigPanel } from './ConfigPanel/FormStepConfigPanel'; // Phase 7: Re-enabled for Smart Auto-Map
// import { FormFieldConfigPanel } from './ConfigPanel/FormFieldConfigPanel';
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
import { FlowPreviewModal } from './Modals/FlowPreviewModal'; // Phase 1: Hybrid Functionality
import { DataMappingPanel } from './ConfigPanel/DataMappingPanel'; // Phase 1: Hybrid Functionality

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export type EditorMode = 'wizard' | 'visual' | 'expert';

interface UnifiedFlowEditorProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onSave?: (nodes: Node[], edges: Edge[]) => void;
  onChange?: (nodes: Node[], edges: Edge[]) => void; // Track changes for auto-save
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
  height: ${props => props.$isFullscreen ? '100vh' : '600px'};
  background: rgb(var(--color-background));
  border: ${props => props.$isFullscreen ? 'none' : '1px solid rgb(var(--color-border))'};
  border-radius: ${props => props.$isFullscreen ? '0' : 'var(--radius-lg)'};
  overflow: hidden;
  position: ${props => props.$isFullscreen ? 'fixed' : 'relative'};
  top: ${props => props.$isFullscreen ? '0' : 'auto'};
  left: ${props => props.$isFullscreen ? '0' : 'auto'};
  right: ${props => props.$isFullscreen ? '0' : 'auto'};
  bottom: ${props => props.$isFullscreen ? '0' : 'auto'};
  z-index: ${props => props.$isFullscreen ? '9990' : 'auto'};
  
  /* Phase 7.2: Smart Snapping - Connection Line Animation */
  @keyframes dash {
    to {
      stroke-dashoffset: -10;
    }
  }
  
  /* Phase 7.2: Smart Snapping - Visual Connection Indicators */
  .react-flow__connection-path {
    stroke: #667eea !important;
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
  .react-flow__node[data-type="formMultiStepContainer"] {
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
  overflow: hidden;
`;

const NodePalette = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  width: 220px;
  max-height: calc(100% - 24px);
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgb(var(--color-text-tertiary));
  padding: 40px;
  text-align: center;
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

const Toolbar = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  z-index: 10;
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
  top: 12px;
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
const staticNodeTypes: NodeTypes = {
  // Form nodes (Phase E - 2026-02-19)
  form: FormNode,  // NEW: Primary form node name
  formStepSingle: FormStepSingleNode,  // Backward compatibility
  formProcess: FormProcessNode,
  formProcessGroup: FormProcessGroupNode,
  // Backward compatibility aliases
  formStep: FormStepSingleNode,  // Deprecated
  formMultiStepContainer: FormProcessNode,  // Deprecated
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

// Static edge types (no useMemo needed - these are constant)
const staticEdgeTypes: EdgeTypes = {
  custom: CustomEdge,
  conditional: ConditionalEdge,
  error: ErrorEdge,
  success: SuccessEdge,
  default: CustomEdge, // Fallback to custom for untyped edges
};

// ============================================================================
// Error Boundary for Config Panel
// ============================================================================

class ConfigPanelErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('[Config Panel] Error caught:', error, errorInfo);
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
  onSave,
  onChange, // Track changes for auto-save
  readOnly = false,
  editorMode = 'visual',
  allowedNodeCategories, // Phase 4.2: Permission-based filtering
}) => {
  // Normalize nodes to ensure all have required properties (maxInputs, maxOutputs)
  const normalizedInitialNodes = useMemo(() => normalizeNodes(initialNodes), [initialNodes]);
  
  const [nodes, setNodes, onNodesChangeBase] = useNodesState(normalizedInitialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeIdCounter, setNodeIdCounter] = useState(normalizedInitialNodes.length + 1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Keep ref to current nodes for stable callbacks
  const nodesRef = useRef<Node[]>(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  
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
            if (removedContainerIds.includes(n.parentNode || '')) {
              // Calculate absolute position before unparenting
              const parent = nds.find(p => p.id === n.parentNode);
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
                parentNode: undefined,
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
    // Ensure portal exists with complete styling
    let portal = document.getElementById('config-portal');
    if (!portal) {
      logger.debug('[Portal] Creating config-portal element with full styling');
      portal = document.createElement('div');
      portal.id = 'config-portal';
      portal.style.cssText = `
        position: fixed;
        right: 0;
        top: 0;
        width: min(450px, 100vw);
        height: 100vh;
        overflow-y: auto;
        background: #fff;
        z-index: 1000;
        box-shadow: -4px 0 12px rgba(0,0,0,0.1);
        display: none;
        pointer-events: none;
      `;
      document.body.appendChild(portal);
    }
    
    return () => {
      // Cleanup on unmount (only if empty)
      const portal = document.getElementById('config-portal');
      if (portal && portal.childNodes.length === 0) {
        logger.debug('[Portal] Removing empty config-portal element');
        document.body.removeChild(portal);
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
          background: #fff;
          z-index: 1000;
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
      const orphanedNodes = normalizedInitialNodes.filter(
        n => n.data?.containerNodeId && !containerIds.has(n.data.containerNodeId)
      );
      
      if (orphanedNodes.length > 0) {
        logger.warn(
          `[Container Restore] Found ${orphanedNodes.length} orphaned nodes (referencing missing containers)`,
          orphanedNodes.map(n => n.id)
        );
        
        // Clean up orphaned nodes by removing their containerNodeId
        setNodes((nds) => nds.map(n => {
          if (n.data?.containerNodeId && !containerIds.has(n.data.containerNodeId)) {
            const cleanedData = { ...n.data };
            delete cleanedData.containerNodeId;
            logger.debug(`[Container Restore] Cleaned orphaned node ${n.id}`);
            return { ...n, data: cleanedData };
          }
          return n;
        }));
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
            if (node.data?.formId) {
              formReferences.push(node.data.formId);
            }
            if (node.data?.tenantFormId) {
              formReferences.push(node.data.tenantFormId);
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
      logger.debug('[Phase 6] Deprecated nodes detected:', uniqueTypes, foundDeprecated.length);
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
      const stored = localStorage.getItem('flow_editor_mode');
      return (stored as EditorMode) || 'visual';
    } catch {
      return 'visual';
    }
  });
  
  // Use prop if provided, otherwise use internal state
  const activeEditorMode = editorMode !== undefined ? editorMode : internalEditorMode;
  
  // Persist mode preference only if not controlled by prop
  useEffect(() => {
    if (editorMode === undefined) {
      localStorage.setItem('flow_editor_mode', internalEditorMode);
    }
  }, [internalEditorMode, editorMode]);
  
  // ============================================================================
  // Fullscreen State & Handlers (Phase 0: WF-ENH-2026-Q1)
  // ============================================================================
  
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('workforms_fullscreen_enabled');
      return stored === 'true';
    } catch {
      return false;
    }
  });
  
  const toggleFullscreen = useCallback(() => {
    const newFullscreenState = !isFullscreen;
    setIsFullscreen(newFullscreenState);
    localStorage.setItem('workforms_fullscreen_enabled', newFullscreenState ? 'true' : 'false');
  }, [isFullscreen]);
  
  // ESC key handler for CSS-based fullscreen exit
  // 🔧 Portal Container Creation (2026-02-24: Permanent Fix)
  useEffect(() => {
    let portalRoot = document.getElementById('config-portal-root');
    
    if (!portalRoot) {
      portalRoot = document.createElement('div');
      portalRoot.id = 'config-portal-root';
      portalRoot.style.cssText = 'position: fixed; top: 0; right: 0; bottom: 0; z-index: 10000; pointer-events: none;';
      document.body.appendChild(portalRoot);
      logger.debug('[UnifiedFlowEditor] ✅ Portal root created');
    }
    
    return () => {
      const root = document.getElementById('config-portal-root');
      if (root) {
        document.body.removeChild(root);
        logger.debug('[UnifiedFlowEditor] 🧹 Portal root cleaned up');
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
  const selectedNodeForDebug = useMemo(() => 
    nodes.find(n => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );
  
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
      
      // Ctrl/Cmd + S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      
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
    filteredNodes = filteredNodes.filter(nodeType => !nodeType.hidden);
    logger.debug('[NodePalette] After hidden filtering:', filteredNodes.length);
    
    // Step 1: Filter by editor mode
    if (activeEditorMode === 'wizard') {
      // Wizard mode: Limited to basic form creation nodes
      filteredNodes = filteredNodes.filter(nodeType => 
        ['formStep', 'formField', 'conditionIf', 'actionEmail', 'endSuccess'].includes(nodeType.id)
      );
    } else if (activeEditorMode === 'visual') {
      // Visual mode: Most nodes except advanced features
      filteredNodes = filteredNodes.filter(nodeType => 
        !['customCode', 'apiRequest', 'subflow'].includes(nodeType.id)
      );
    }
    // Expert mode: All nodes (no filtering by mode)
    
    logger.debug('[NodePalette] After mode filtering:', filteredNodes.length);
    
    // Step 2: Filter by permission categories (if restricted)
    if (allowedNodeCategories && allowedNodeCategories.length > 0) {
      filteredNodes = filteredNodes.filter(nodeType => 
        allowedNodeCategories.includes(nodeType.category)
      );
      logger.debug('[NodePalette] After permission filtering:', filteredNodes.length);
    }
    
    logger.debug('[NodePalette] Final available nodes:', filteredNodes.length);
    logger.debug('[NodePalette] Available node IDs:', filteredNodes.map(n => n.id));
    
    return filteredNodes;
  }, [activeEditorMode, allowedNodeCategories]);

  // ============================================================================
  // Enhanced Palette Features State
  // ============================================================================
  
  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<NodeCategory>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);
  
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
  const [isPaletteVisible, setIsPaletteVisible] = useState(true);

  // Configuration Panel
  // NOTE: selectedNode and selectedNodeId moved to top of component to fix TDZ
  
  // FormStep specialized configuration (Phase 4.2.B Integration)
  const [formStepModalOpen, setFormStepModalOpen] = useState(false);
  const [selectedFormStep, setSelectedFormStep] = useState<Node | null>(null);
  const [editingField, setEditingField] = useState<any | null>(null);
  
  // FormField specialized configuration (Phase 1 of Navigation Fix Plan)
  const [formFieldModalOpen, setFormFieldModalOpen] = useState(false);
  const [selectedFormField, setSelectedFormField] = useState<Node | null>(null);
  
  // Section specialized configuration (Phase 1 Task 1.2 of Navigation Fix Plan)
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<Node | null>(null);
  
  // Document/Upload specialized configuration (Phase 1 Task 1.3 of Navigation Fix Plan)
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Node | null>(null);
  
  // Create Record action configuration (Phase 2 Task 2.2)
  const [createRecordModalOpen, setCreateRecordModalOpen] = useState(false);
  const [selectedCreateRecord, setSelectedCreateRecord] = useState<Node | null>(null);
  
  // Form Reference configuration (Phase 3 Task 3.3)
  const [formReferenceModalOpen, setFormReferenceModalOpen] = useState(false);
  const [selectedFormReference, setSelectedFormReference] = useState<Node | null>(null);
  
  // Container configuration (Phase 4.3)
  const [containerModalOpen, setContainerModalOpen] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<Node | null>(null);
  
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
    enabled: formStepModalOpen || !!editingField, // Only fetch when needed
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
  // Expert Mode State (Phase 2.2 Batch 2)
  // ============================================================================
  
  const [jsonCode, setJsonCode] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  // ============================================================================
  // Template Selector State (Phase 2.5 Integration)
  // ============================================================================
  
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  
  // ============================================================================
  // Workflow Persistence State (Phase 7)
  // ============================================================================
  
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | undefined>(undefined);
  const [currentWorkflowName, setCurrentWorkflowName] = useState<string>('Untitled Workflow');
  const [currentWorkflowDescription, setCurrentWorkflowDescription] = useState<string>(''); // Phase 8.2
  const [currentWorkflowStatus, setCurrentWorkflowStatus] = useState<'draft' | 'active' | 'archived'>('draft'); // Phase 8.2
  const [workflowList, setWorkflowList] = useState<WorkflowListItem[]>([]);
  const [isLoadMenuOpen, setIsLoadMenuOpen] = useState(false);
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

  // Sync nodes/edges to JSON when entering Expert Mode or when data changes
  useEffect(() => {
    if (activeEditorMode === 'expert') {
      const flowData = {
        nodes,
        edges,
        metadata: {
          version: '1.0',
          created: new Date().toISOString(),
          lastModified: lastSyncTime?.toISOString() || new Date().toISOString(),
        }
      };
      setJsonCode(JSON.stringify(flowData, null, 2));
    }
  }, [activeEditorMode, nodes, edges, lastSyncTime]);
  
  // Validate and apply JSON changes
  const handleJsonChange = useCallback((value: string | undefined) => {
    if (!value) return;
    
    setJsonCode(value);
    
    try {
      const parsed = JSON.parse(value);
      
      // Validate structure
      if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
        throw new Error('Invalid format: "nodes" array is required');
      }
      if (!parsed.edges || !Array.isArray(parsed.edges)) {
        throw new Error('Invalid format: "edges" array is required');
      }
      
      // Clear error if valid
      setJsonError(null);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }, []);
  
  // Apply JSON to visual mode
  const applyJsonToVisual = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonCode);
      
      if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
        throw new Error('Invalid format: "nodes" array is required');
      }
      if (!parsed.edges || !Array.isArray(parsed.edges)) {
        throw new Error('Invalid format: "edges" array is required');
      }
      
      // CRITICAL: Sort nodes to ensure parent-before-child ordering
      const sortedNodes = sortNodesTopologically(parsed.nodes);
      setNodes(sortedNodes);
      setEdges(parsed.edges);
      setLastSyncTime(new Date());
      setJsonError(null);
      
      // Switch to visual mode to see changes
      setInternalEditorMode('visual');
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Failed to apply JSON');
    }
  }, [jsonCode, setNodes, setEdges]);
  
  // Export flow as JSON file
  const exportJson = useCallback(() => {
    const flowData = {
      nodes,
      edges,
      metadata: {
        version: '1.0',
        exported: new Date().toISOString(),
      }
    };
    
    const blob = new Blob([JSON.stringify(flowData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [nodes, edges]);
  
  // Import JSON file
  const importJson = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);
          
          if (!parsed.nodes || !parsed.edges) {
            throw new Error('Invalid workflow file format');
          }
          
          // CRITICAL: Sort nodes to ensure parent-before-child ordering
          const sortedNodes = sortNodesTopologically(parsed.nodes);
          setNodes(sortedNodes);
          setEdges(parsed.edges);
          setLastSyncTime(new Date());
          setJsonError(null);
          setInternalEditorMode('visual');
        } catch (err) {
          setJsonError(err instanceof Error ? err.message : 'Failed to import file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setNodes, setEdges]);
  
  // Copy JSON to clipboard
  const copyJsonToClipboard = useCallback(() => {
    navigator.clipboard.writeText(jsonCode);
  }, [jsonCode]);

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
  
  const wizardAddNode = useCallback((nodeType: string) => {
    const newNode = {
      id: `node-${nodeIdCounter}`,
      type: nodeType,
      position: { x: 250 + (wizardState.addedNodeCount * 200), y: 100 },
      data: { label: NODE_TYPE_REGISTRY[nodeType]?.label || 'New Node' },
    };
    
    setNodes((nds) => [...nds, newNode]);
    setNodeIdCounter((c) => c + 1);
    setWizardState(prev => ({ 
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
  }, [nodeIdCounter, wizardState.addedNodeCount, nodes, setNodes, setEdges]);
  
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
    // Debounce history tracking to avoid too many snapshots
    const timer = setTimeout(() => {
      const currentState = { nodes, edges };
      const lastState = history[historyIndex];
      
      // Only add to history if state actually changed
      if (JSON.stringify(currentState) !== JSON.stringify(lastState)) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(currentState);
        
        // Keep max 50 history states
        if (newHistory.length > 50) {
          newHistory.shift();
        } else {
          setHistoryIndex(prev => prev + 1);
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
  const getNodeMaxConnections = useCallback((node: Node): { maxInputs: number; maxOutputs: number } => {
    // First try to get from node data
    if (node.data && typeof node.data.maxInputs !== 'undefined' && typeof node.data.maxOutputs !== 'undefined') {
      return {
        maxInputs: node.data.maxInputs,
        maxOutputs: node.data.maxOutputs,
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
  const isValidConnection = useCallback((connection: Connection) => {
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
      
      // Phase 6.1: Container isolation validation (HIGHEST PRIORITY)
      // Block connections from child node to external node
      if (sourceNode.parentNode && !targetNode.parentNode) {
        logger.warn('[Connection] ❌ Cannot connect child node to external node (container isolation)');
        toast.error('Cannot connect nodes across container boundaries', {
          duration: 4000,
          icon: '🚫',
        });
        Sentry.captureMessage('Container isolation: child → external blocked', {
          level: 'info',
          extra: { sourceNode: sourceNode.id, targetNode: targetNode.id },
        });
        return;
      }
      
      // Block connections from external node to child node
      if (!sourceNode.parentNode && targetNode.parentNode) {
        logger.warn('[Connection] ❌ Cannot connect external node to child node (container isolation)');
        toast.error('Cannot connect nodes across container boundaries', {
          duration: 4000,
          icon: '🚫',
        });
        Sentry.captureMessage('Container isolation: external → child blocked', {
          level: 'info',
          extra: { sourceNode: sourceNode.id, targetNode: targetNode.id },
        });
        return;
      }
      
      // Block connections between nodes in different containers
      if (sourceNode.parentNode && targetNode.parentNode && sourceNode.parentNode !== targetNode.parentNode) {
        logger.warn('[Connection] ❌ Cannot connect nodes from different containers');
        toast.error('Cannot connect nodes between different containers', {
          duration: 4000,
          icon: '🚫',
        });
        Sentry.captureMessage('Container isolation: different containers blocked', {
          level: 'info',
          extra: { 
            sourceNode: sourceNode.id, 
            targetNode: targetNode.id,
            sourceContainer: sourceNode.parentNode,
            targetContainer: targetNode.parentNode,
          },
        });
        return;
      }
      
      logger.debug('[Connection] ✅ Container isolation check passed');
      
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
    for (const node of deletedNodes) {
      // Check if this is a container node with a tenantFormId
      if (node.type === 'formMultiStepContainer' && node.data.tenantFormId) {
        try {
          const result = await workformsApi.decrementFormUsage(node.data.tenantFormId);
          logger.debug(`[Ghost Cleanup] ✅ Decremented usage for container: ${result.usage_count} remaining`);
          
          if (result.can_delete) {
            logger.debug('[Ghost Cleanup] 🗑️ Form is now orphaned (usage_count=0). Will be cleaned up by background task.');
          }
        } catch (error) {
          logger.error('[Ghost Cleanup] ❌ Failed to decrement usage:', error);
        }
      }
    }
  }, []);

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
    const containerNodes = nodes.filter(node => 
      node.type === 'formMultiStepContainer' || 
      node.type === 'formProcessGroup' ||
      node.type === 'formProcess'
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
      const isContainerNode = type === 'formMultiStepContainer' || type === 'formProcessGroup';
      const defaultDimensions = isContainerNode
        ? { width: 600, height: 400 } // Larger for containers
        : undefined; // Let React Flow calculate for regular nodes

      const newNode: Node = {
        id: `node-${nodeIdCounter}`,
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
      
      // Phase 3: FormProcessGroup as true React Flow group container (2026-02-21)
      if (type === 'formProcessGroup') {
        newNode.style = {
          width: 600,  // Default width for group container
          height: 400, // Default height for child nodes
        };
        newNode.data = {
          ...newNode.data,
          isExpanded: true, // Default to expanded so children are visible
          isGroup: true, // Mark as group for React Flow
        };
        // Enable React Flow group behavior
        (newNode as any).type = 'formProcessGroup'; // Explicit type for React Flow
      }
      
      // Phase 1.4: If dropping into a container, set parent-child relationship
      if (targetContainer) {
        logger.debug(`[Container] Setting up parent-child relationship with container ${targetContainer.id}`);
        
        // Phase 1.4: Don't allow containers to be nested
        const isContainerType = type === 'formMultiStepContainer' || 
                               type === 'formProcessGroup' || 
                               type === 'formProcess';
        
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
          
          // Don't call setNodes here - batch all updates into ONE call below to avoid race conditions
          setNodeIdCounter((prev) => prev + 1);
          
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
      const updatedNodes = nodes.concat(newNode);
      setNodes(updatedNodes);
      setNodeIdCounter((prev) => prev + 1);
      
      // Mark drop as succeeded
      dropSucceededRef.current = true;
      
      // Auto-connect to nearby node if found (only for main canvas drops)
      let updatedEdges = edges;
      if (nearby && !targetContainer) {
        const newEdge = {
          id: `edge-${nearby.id}-${newNode.id}`,
          source: nearby.id,
          target: newNode.id,
          type: 'custom',
        };
        updatedEdges = [...edges, newEdge];
        setEdges(updatedEdges);
      }
      
      // Clear nearby node state
      setNearbyNode(null);
    },
    [nodeIdCounter, setNodes, reactFlowInstance, nodes, edges, findNearbyNode, setEdges, findContainerAtPosition]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    logger.debug('🔵 [onDragOver] Event received');
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // ============================================================================
  // Dynamic Node Types (Phase: Container Drop Handler Fix)
  // ============================================================================
  
  /**
   * NodeTypes definition
   * 
   * REFACTORED: Single ReactFlow architecture
   * - Container nodes no longer need custom props
   * - Children render on main canvas with parentId
   * - Uses React Flow's official grouping pattern
   */
  const nodeTypes = useMemo<NodeTypes>(() => ({
    ...staticNodeTypes,
    // Container node no longer needs custom props with single-ReactFlow architecture
  }), []);

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
    if (node.parentId && (node.type === 'formStep' || node.type === 'formReference')) {
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
        if (layoutResult.containerWidth > (container.style?.width || 400) || 
            layoutResult.containerHeight > (container.style?.height || 300)) {
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === container.id) {
                return {
                  ...n,
                  style: {
                    ...n.style,
                    width: Math.max(layoutResult.containerWidth, n.style?.width || 400),
                    height: Math.max(layoutResult.containerHeight, n.style?.height || 300),
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
    const isContainerNode = node.type === 'formMultiStepContainer' || 
                           node.type === 'formProcessGroup' || 
                           node.type === 'formProcess';
    
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
              delete updatedNode.parentNode;
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
  // Save Handler
  // ============================================================================
  
  const handleSaveImpl = useCallback(() => {
    logger.debug('[FlowEditor] Quick save triggered');
    
    // SAFETY: Validate state before save
    if (!nodes || !edges) {
      logger.error('[FlowEditor] Cannot save: nodes or edges undefined');
      toast.error('Cannot save workflow: Invalid state');
      return;
    }
    
    toast.success('Workflow saved');
    
    if (onSave) {
      try {
        // Log container information for debugging (Phase E)
        const containerNodes = nodes.filter(n => n.type === 'formMultiStepContainer');
        const nodesInContainers = nodes.filter(n => n.parentNode); // Phase E: Using React Flow parentNode
        
        logger.debug('[Save] Workflow saved with container state:');
        logger.debug(`  - ${containerNodes.length} container(s)`);
        logger.debug(`  - ${nodesInContainers.length} node(s) in containers`);
        
        if (containerNodes.length > 0) {
          containerNodes.forEach(container => {
            const childNodes = nodes.filter(n => n.parentId === container.id); // Phase E: Using parentNode
            logger.debug(`  - Container ${container.id}: ${childNodes.length} nodes`);
          });
        }
        
        onSave(nodes, edges);
        logger.debug('Flow saved successfully!');
        setHasUnsavedChanges(false);
      } catch (error) {
        logger.error('[FlowEditor] Save failed:', error);
        toast.error('Failed to save workflow');
      }
    }
  }, [nodes, edges, onSave]);
  
  // Populate forward ref (CRITICAL: Must be after useCallback definition)
  handleSaveRef.current = handleSaveImpl;
  
  // Alias for keyboard shortcut (now points to the forward ref wrapper)
  const handleQuickSave = handleSave;

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
    const containerNodes = nodes.filter(
      n => n.type === 'formMultiStepContainer'
    );
    
    for (const container of containerNodes) {
      // Get child nodes
      const childNodes = nodes.filter(n => n.parentId === container.id);
      
      // Check for at least one form step
      const formSteps = childNodes.filter(
        n => n.type === 'formStep' || n.type === 'formReference'
      );
      
      if (formSteps.length === 0) {
        errors.push(
          `Container "${container.data.label || container.id}" must have at least one form step`
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
  const handleSaveWorkflow = useCallback(async () => {
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
    
    // Show loading toast
    const loadingToast = toast.loading(
      currentWorkflowId ? 'Updating workflow...' : 'Creating workflow...'
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
        currentWorkflowStatus // Phase 8.2: Use status from state
      );
      
      // Update current workflow ID if this was a new workflow
      if (!currentWorkflowId) {
        setCurrentWorkflowId(savedWorkflow.id);
      }
      
      setHasUnsavedChanges(false);
      logger.debug('✅ Workflow saved:', savedWorkflow.name);
      
      // Show success toast
      toast.success(
        `Workflow "${savedWorkflow.name}" ${currentWorkflowId ? 'updated' : 'created'} successfully!`,
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
  }, [nodes, edges, currentWorkflowId, currentWorkflowName, isSaving, reactFlowInstance, validateContainers, currentWorkflowDescription, currentWorkflowStatus]);
  
  /**
   * Auto-layout: Apply dagre layout to all nodes
   * Phase 2: UI/UX Enhancements
   */
  const handleAutoLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      { direction: 'TB', nodeSpacing: 60, rankSpacing: 120 }
    );
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

    const { nodes: layoutedSelected } = getLayoutedElements(
      selectedNodes,
      relevantEdges,
      { direction: 'TB' }
    );

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
  useKeyboardShortcuts({
    onSave: handleSaveWorkflow,
    onLayout: handleAutoLayout,
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
  
  const fitView = useCallback(() => {
    if (reactFlowInstance?.fitView) {
      reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
    }
  }, [reactFlowInstance]);
  
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
        event.preventDefault();
        zoomTo(1);
        return;
      }
      
      // 2: Zoom to 50%
      if (event.key === '2' && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        event.preventDefault();
        zoomTo(0.5);
        return;
      }
      
      // 3: Fit view (same as F)
      if (event.key === '3' && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
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
    alert(`Successfully migrated ${nodesToMigrate.length} deprecated node(s) to modern format!\n\nPlease review the migrated nodes and save your workflow.`);
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
      logger.debug('[Selection] Node selected (border highlight only):', node.type, node.id);
      
      // Track selected node ID for keyboard shortcuts and debugging
      setSelectedNodeId(node.id);
      
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
      setSelectedFormField(null);
      setSelectedSection(null);
      setSelectedDocument(null);
      setSelectedCreateRecord(null);
      setSelectedFormReference(null);
      setSelectedContainer(null);
      setFormStepModalOpen(false);
      setFormFieldModalOpen(false);
      setSectionModalOpen(false);
      setDocumentModalOpen(false);
      setCreateRecordModalOpen(false);
      setFormReferenceModalOpen(false);
      setContainerModalOpen(false);
    }
  }, []);
  
  // Batch 3: Handler to open modal from Edit button
  // IMPORTANT: This is the ONLY place modals should be opened (except programmatic saves)
  const handleNodeEdit = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    logger.debug('✏️ [EDIT BUTTON] Opening config panel for:', node.type, nodeId);
    
    // Close all legacy modals first
    setFormStepModalOpen(false);
    setFormFieldModalOpen(false);
    setSectionModalOpen(false);
    setDocumentModalOpen(false);
    setCreateRecordModalOpen(false);
    setFormReferenceModalOpen(false);
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
        logger.debug('✏️ [EDIT BUTTON] Opening Container modal');
        setSelectedContainer(node);
        setContainerModalOpen(true);
        break;
        
      case 'formReference':
        logger.debug('✏️ [EDIT BUTTON] Setting FormReference data');
        setSelectedFormReference(node);
        break;
        
      case 'formField':
        logger.debug('✏️ [EDIT BUTTON] Setting FormField data');
        setSelectedFormField(node);
        break;
        
      case 'formSection':
      case 'section':
        logger.debug('✏️ [EDIT BUTTON] Setting Section data');
        setSelectedSection(node);
        break;
        
      case 'formFileUpload':
      case 'document':
      case 'upload':
        logger.debug('✏️ [EDIT BUTTON] Setting Document data');
        setSelectedDocument(node);
        break;
        
      case 'action':
        const actionType = node.data.actionType;
        if (actionType === 'createRecord') {
          logger.debug('✏️ [EDIT BUTTON] Opening CreateRecord modal');
          setSelectedCreateRecord(node);
          setCreateRecordModalOpen(true);
        } else {
          setSelectedNode(node);
        }
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
      
      // Force check that DOM element exists
      setTimeout(() => {
        const portalElement = document.querySelector('[class*="RightSidebar"]');
        if (portalElement) {
          logger.debug('[Modal State] ✅ Portal element found in DOM');
        } else {
          logger.error('[Modal State] ❌ Portal element NOT found in DOM - render issue!');
        }
      }, 100);
    } else {
      logger.debug('[Modal State] Config panel closed (selectedNode is null)');
    }
  }, [selectedNode]);
  
  // Handler for direct node clicks (opens config panel) - debounced to prevent double-triggers
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    event.stopPropagation();
    event.preventDefault();
    
    logger.debug('[handleNodeClick] Node clicked, opening config:', {
      nodeType: node.type,
      nodeId: node.id,
      timestamp: new Date().toISOString()
    });
    
    // Short timeout to prevent double-triggers and allow event to fully propagate
    setTimeout(() => {
      handleNodeEdit(node.id);
    }, 50);
  }, [handleNodeEdit]);
  
  // Batch 3: Handler to delete node from Delete button
  const handleNodeDeleteImpl = useCallback(async (nodeId: string) => {
    // SAFETY: Validate state before deletion
    if (!nodes || nodes.length === 0) {
      toast.error('Cannot delete node: Invalid state');
      return;
    }
    
    const nodeToDelete = nodes.find(n => n.id === nodeId);
    if (!nodeToDelete) {
      toast.warning('Node not found');
      return;
    }
    
    try {
      // Phase 2: Decrement usage_count when formProcess node is deleted
      if (nodeToDelete.type === 'formProcess' || nodeToDelete.type === 'formMultiStepContainer') {
        const tenantFormId = nodeToDelete.data?.tenantFormId;
        
        if (tenantFormId) {
          try {
            await adminClient.post(`/api/system/forms/${tenantFormId}/decrement-usage/`);
          } catch (error) {
            logger.error('Failed to decrement form usage count:', error);
            // Continue with deletion even if API call fails
          }
        }
        
        // If deleting a container, also remove its children
        const childNodeIds = new Set(
          nodes.filter(n => n.parentId === nodeId).map(n => n.id)
        );
        
        if (childNodeIds.size > 0) {
          setNodes(nds => nds.filter(n => 
            n.id !== nodeId && !childNodeIds.has(n.id)
          ));
        } else {
          setNodes(nds => nds.filter(n => n.id !== nodeId));
        }
      } else {
        // Remove node normally
        setNodes(nds => nds.filter(n => n.id !== nodeId));
      }
      
      // Remove connected edges
      setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
      
      // Clear selections if deleted node was selected
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null);
      }
      
      setHasUnsavedChanges(true);
      toast.success('Node deleted');
      logger.debug('[UnifiedFlowEditor] Node deleted successfully:', nodeId);
    } catch (error) {
      logger.error('[FlowEditor] Delete failed:', error);
      toast.error('Failed to delete node');
    }
  }, [nodes, selectedNode, setNodes, setEdges]);
  
  // Populate forward ref (CRITICAL: Must be after useCallback definition)
  handleNodeDeleteRef.current = handleNodeDeleteImpl;
  
  // Batch 4: Handler to update node title
  const handleNodeTitleChange = useCallback((nodeId: string, newTitle: string) => {
    logger.debug('[UnifiedFlowEditor] Updating node title:', nodeId, newTitle);
    
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
    
    return {
      formId: node.data.formId,
      formName: node.data.formName || node.data.stepTitle || node.data.label || 'Untitled Form',
      entityType: node.data.entityType || 'supplier',
      fields: node.data.fields || [],
      mode: node.data.formId ? 'existing' : 'new',
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
  const convertNodeDataToContainerData = useCallback((node: Node): ContainerData | undefined => {
    if (!node.data) return undefined;
    
    return {
      workflowId: node.data.tenantWorkFormId,
      containerName: node.data.containerName || node.data.label || 'Unnamed Container',
      containerDescription: node.data.containerDescription,
      mode: node.data.tenantWorkFormId ? 'existing' : 'new',
      showProgressIndicator: node.data.showProgressIndicator ?? true,
      allowBackNavigation: node.data.allowBackNavigation ?? true,
      allowSkipSteps: node.data.allowSkipSteps ?? false,
      autoAdvance: node.data.autoAdvance ?? false,
      confirmOnExit: node.data.confirmOnExit ?? true,
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
    
    // Find all FormStep nodes before the current one
    const currentNode = nodes.find(n => n.id === currentNodeId);
    if (!currentNode) return allFields;
    
    // Simple heuristic: nodes with lower Y position are "before" current node
    const previousNodes = nodes.filter(n => 
      n.type === 'formStep' && 
      n.id !== currentNodeId &&
      n.position.y < currentNode.position.y
    );
    
    // Extract fields from previous FormStep nodes
    previousNodes.forEach(node => {
      const fields = node.data.fields || [];
      fields.forEach((field: any) => {
        allFields.push({
          ...field,
          stepTitle: node.data.stepTitle || node.data.label || 'Unnamed Step',
        });
      });
    });
    
    return allFields;
  }, [nodes]);
  
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
      const nodeDef = getNodeTypeDefinition(node.type);
      
      // Ensure node has proper type mapping
      const reactFlowType = getReactFlowNodeType(node.type);
      
      // Merge default data + template data + registry metadata
      const defaultData = getDefaultNodeData(node.type);
      
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
    
    // Update node ID counter based on loaded nodes
    const maxId = Math.max(
      0,
      ...template.nodes.map(n => {
        const match = n.id.match(/node-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
    );
    setNodeIdCounter(maxId + 1);
    
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
    
    // Reset node ID counter
    setNodeIdCounter(1);
    
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
    let searchResults: typeof NODE_TYPE_REGISTRY[string][] = availableNodeTypes;
    
    if (query) {
      const fuse = new Fuse(availableNodeTypes, {
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
  }, [searchQuery, activeFilters, availableNodeTypes]);

  // ============================================================================
  // Get Favorite & Recent Nodes
  // ============================================================================
  
  const favoriteNodesList = useMemo(() => {
    return favorites
      .map(id => NODE_TYPE_REGISTRY[id])
      .filter(Boolean);
  }, [favorites]);

  const recentNodesList = useMemo(() => {
    return recentNodes
      .map(id => NODE_TYPE_REGISTRY[id])
      .filter(Boolean);
  }, [recentNodes]);
  
  // Batch 3: Inject edit/delete handlers into node data
  // Batch 4: Also inject title change handler
  const nodesWithHandlers = useMemo(() => {
    return nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onEdit: () => handleNodeEdit(node.id),
        onDelete: () => handleNodeDelete(node.id),
        onTitleChange: (newTitle: string) => handleNodeTitleChange(node.id, newTitle),
      },
    }));
  }, [nodes, handleNodeEdit, handleNodeDelete, handleNodeTitleChange]);

  return (
    <EditorContainer $isFullscreen={isFullscreen}>
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
      
      {/* Node Palette - Visual & Expert Modes Only */}
      {!readOnly && isPaletteVisible && (activeEditorMode === 'visual' || activeEditorMode === 'expert') && (
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
              {(Object.keys(CATEGORY_LABELS) as NodeCategory[]).map(category => {
                const isActive = activeFilters.has(category);
                const categoryColor = {
                  trigger: '#10b981',
                  form: '#3b82f6',
                  logic: '#f59e0b',
                  action: '#8b5cf6',
                  wait: '#ef4444',
                  document: '#06b6d4',
                  utility: '#64748b',
                  terminal: '#059669',
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
          {CATEGORY_ORDER.map(category => {
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
            onClick={handleSaveWorkflow} 
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
        </Toolbar>
      )}

      {/* Viewport Controls */}
      <ViewportToolbar>
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
        <ViewportButton onClick={toggleFullscreen} title={isFullscreen ? "Exit Fullscreen (ESC)" : "Enter Fullscreen"}>
          {isFullscreen ? <Minimize2 /> : <Maximize2 />}
        </ViewportButton>
        <div style={{ width: '1px', height: '20px', background: 'rgb(var(--color-border))' }} />
        <ViewportButton onClick={fitView} title="Fit to View (F)">
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
          title={isMinimapVisible ? "Hide Minimap (M)" : "Show Minimap (M)"}
          style={isMinimapVisible ? {
            background: 'rgb(var(--color-primary))',
            color: 'white',
            borderColor: 'rgb(var(--color-primary))'
          } : {}}
        >
          <Map />
        </ViewportButton>
        <div style={{ width: '1px', height: '20px', background: 'rgb(var(--color-border))' }} />
        <ViewportButton onClick={() => setIsHelpModalOpen(true)} title="Help & Keyboard Shortcuts (?)">
          <HelpCircle />
        </ViewportButton>
      </ViewportToolbar>
      
      {/* Mode Selector (Phase 2.2) - Only show if not controlled by prop */}
      {editorMode === undefined && (
        <ModeSelectorContainer>
          <ModeButton
            $active={activeEditorMode === 'wizard'}
            onClick={() => setInternalEditorMode('wizard')}
            title="Wizard Mode - Guided step-by-step creation"
          >
            <Wand2 />
            Wizard
          </ModeButton>
          <ModeButton
            $active={activeEditorMode === 'visual'}
            onClick={() => setInternalEditorMode('visual')}
            title="Visual Mode - Drag-and-drop canvas"
          >
            <Eye />
            Visual
          </ModeButton>
          <ModeButton
            $active={activeEditorMode === 'expert'}
            onClick={() => setInternalEditorMode('expert')}
            title="Expert Mode - JSON code editor"
          >
            <Code2 />
            Expert
          </ModeButton>
        </ModeSelectorContainer>
      )}

      {/* React Flow Canvas - Visual Mode */}
      {activeEditorMode === 'visual' && (
        <ReactFlow
        nodes={nodesWithHandlers}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        isValidConnection={isValidConnection}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={handleCloseMenu}
        onSelectionChange={handleSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={staticEdgeTypes}
        // Phase 7.5: Performance optimizations for 1000+ nodes
        onlyRenderVisibleElements={nodes.length > 100}
        elevateNodesOnSelect={nodes.length < 200}
        maxZoom={4}
        minZoom={0.1}
        defaultEdgeOptions={{ 
          type: 'custom',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: '#94a3b8',
          },
        }}
        connectionLineStyle={{
          stroke: '#667eea',
          strokeWidth: 3,
          strokeDasharray: '5,5',
          animation: 'dash 0.5s linear infinite',
        }}
        connectionLineType="smoothstep"
        fitView
        snapToGrid={snapToGrid}
        snapGrid={[gridSize, gridSize]}
        connectionRadius={20}
      >
        <Background variant={backgroundVariant} gap={20} size={1} />
        {isMinimapVisible && (
          <MiniMap 
            nodeColor={(node) => {
              const registry = NODE_TYPE_REGISTRY[node.type];
              return registry?.color || '#94a3b8';
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
            <EmptyIcon>📋</EmptyIcon>
            <EmptyTitle>Start Building Your Flow</EmptyTitle>
            <EmptyText>
              Drag nodes from the left panel onto the canvas to create your workflow or form.
              <br />
              Connect nodes to define the flow logic.
              <br /><br />
              <strong>Keyboard Shortcuts:</strong>
              <br />
              Tab: Toggle palette | /: Search | Del: Delete selected
              <br />
              Ctrl+Z: Undo | Ctrl+Y: Redo | Ctrl+S: Save
              <br />
              F: Fit view | 1: 100% | 2: 50% | Ctrl+A: Select all | Esc: Deselect
              <br />
              Ctrl+Shift+H/V: Distribute | Ctrl+Shift+L/R/T/B: Align edges | Ctrl+Shift+X/Y: Center
            </EmptyText>
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
      </ReactFlow>
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
        />
      )}
      
      
      {/* Wizard Mode - Typeform-inspired (Phase 2.2 Batch 3) */}
      {activeEditorMode === 'wizard' && (
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
                          <WizardNodeLabel>{nodeConfig.label}</WizardNodeLabel>
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
      
      {/* Expert Mode - JSON Editor (Phase 2.2 Batch 2) */}
      {activeEditorMode === 'expert' && (
        <ExpertModeContainer>
          <ExpertModeToolbar>
            <ToolbarSection>
              <ExpertToolbarButton onClick={applyJsonToVisual} disabled={!!jsonError}>
                <CheckCircle />
                Apply to Visual
              </ExpertToolbarButton>
              <ExpertToolbarButton onClick={exportJson}>
                <Download />
                Export
              </ExpertToolbarButton>
              <ExpertToolbarButton onClick={importJson}>
                <Upload />
                Import
              </ExpertToolbarButton>
              <ExpertToolbarButton onClick={copyJsonToClipboard}>
                <Copy />
                Copy
              </ExpertToolbarButton>
            </ToolbarSection>
            <ToolbarSection>
              {lastSyncTime && (
                <span style={{ fontSize: '12px', color: 'rgb(var(--color-text-tertiary))' }}>
                  Last sync: {lastSyncTime.toLocaleTimeString()}
                </span>
              )}
            </ToolbarSection>
          </ExpertModeToolbar>
          
          {jsonError && (
            <StatusMessage $type="error">
              <AlertCircle style={{ width: '14px', height: '14px', display: 'inline', marginRight: '6px' }} />
              {jsonError}
            </StatusMessage>
          )}
          
          {!jsonError && lastSyncTime && (
            <StatusMessage $type="success">
              <CheckCircle style={{ width: '14px', height: '14px', display: 'inline', marginRight: '6px' }} />
              Valid JSON - Ready to apply
            </StatusMessage>
          )}
          
          <EditorWrapper>
            <Editor
              height="100%"
              defaultLanguage="json"
              value={jsonCode}
              onChange={handleJsonChange}
              theme="vs-dark"
              options={{
                minimap: { enabled: true },
                fontSize: 13,
                lineNumbers: 'on',
                rulers: [80, 120],
                wordWrap: 'on',
                formatOnPaste: true,
                formatOnType: true,
                automaticLayout: true,
                scrollBeyondLastLine: false,
                tabSize: 2,
              }}
            />
          </EditorWrapper>
        </ExpertModeContainer>
      )}

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
      
      {/* FormField Configuration Modal - Direct Selection (Phase 1 of Navigation Fix Plan) */}
      <SidePanel
        isOpen={formFieldModalOpen && !!selectedFormField}
        onClose={() => {
          setFormFieldModalOpen(false);
          setSelectedFormField(null);
        }}
      >
        {selectedFormField && (
          <FormFieldConfigPanel
            field={selectedFormField.data}
            onChange={(updatedFieldData) => {
              handleNodeUpdate(selectedFormField.id, updatedFieldData);
              setFormFieldModalOpen(false);
              setSelectedFormField(null);
            }}
            onClose={() => {
              setFormFieldModalOpen(false);
              setSelectedFormField(null);
            }}
            availableFields={getPreviousStepFields(selectedFormField.id)}
            tenantLists={tenantLists}
            currentNodeId={selectedFormField.id} // Pass currentNodeId for upstream inheritance
          />
        )}
      </SidePanel>
      
      {/* Section Configuration Modal - Direct Selection (Phase 1 Task 1.2) */}
      <SidePanel
        isOpen={sectionModalOpen && !!selectedSection}
        onClose={() => {
          setSectionModalOpen(false);
          setSelectedSection(null);
        }}
      >
        {selectedSection && (
          <SectionConfigPanel
            section={selectedSection.data}
            onChange={(updatedSectionData) => {
              handleNodeUpdate(selectedSection.id, updatedSectionData);
              setSectionModalOpen(false);
              setSelectedSection(null);
            }}
            onClose={() => {
              setSectionModalOpen(false);
              setSelectedSection(null);
            }}
            availableFields={getPreviousStepFields(selectedSection.id)}
          />
        )}
      </SidePanel>
      
      {/* Document Configuration Modal - Direct Selection (Phase 1 Task 1.3) */}
      <SidePanel
        isOpen={documentModalOpen && !!selectedDocument}
        onClose={() => {
          setDocumentModalOpen(false);
          setSelectedDocument(null);
        }}
      >
        {selectedDocument && (
          <DocumentConfigPanel
            document={selectedDocument.data}
            onChange={(updatedDocumentData) => {
              handleNodeUpdate(selectedDocument.id, updatedDocumentData);
              setDocumentModalOpen(false);
              setSelectedDocument(null);
            }}
            onClose={() => {
              setDocumentModalOpen(false);
              setSelectedDocument(null);
            }}
            availableFields={getPreviousStepFields(selectedDocument.id)}
          />
        )}
      </SidePanel>
      
      {/* Create Record Action Configuration Modal (Phase 2 Task 2.2) */}
      <SidePanel
        isOpen={createRecordModalOpen && !!selectedCreateRecord}
        onClose={() => {
          setCreateRecordModalOpen(false);
          setSelectedCreateRecord(null);
        }}
      >
        {selectedCreateRecord && (
          <CreateRecordConfigPanel
            node={selectedCreateRecord}
            onUpdate={(nodeId, data) => {
              handleNodeUpdate(nodeId, data);
              setCreateRecordModalOpen(false);
              setSelectedCreateRecord(null);
            }}
            onClose={() => {
              setCreateRecordModalOpen(false);
              setSelectedCreateRecord(null);
            }}
          />
        )}
      </SidePanel>
      
      {/* Form Reference Configuration Modal (Phase 3 Task 3.3) */}
      {formReferenceModalOpen && selectedFormReference && (
        <FormReferenceConfigPanel
          node={selectedFormReference}
          onUpdate={(nodeId, data) => {
            handleNodeUpdate(nodeId, data);
            setFormReferenceModalOpen(false);
            setSelectedFormReference(null);
          }}
          onClose={() => {
            setFormReferenceModalOpen(false);
            setSelectedFormReference(null);
          }}
        />
      )}
      
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
            availableFields={selectedFormStep?.data?.fields || []}
            tenantLists={tenantLists}
            currentNodeId={selectedFormStep?.id} // Pass currentNodeId for upstream inheritance
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
        <HelpModal onClose={() => setIsHelpModalOpen(false)} />
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
        callback={handleTourCallback}
        continuous
        showProgress
        showSkipButton
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
  // Map node type IDs to React Flow node component names
  
  // CRITICAL: Check for container BEFORE generic 'form' check
  // Bug fix: formMultiStepContainer was being caught by startsWith('form')
  if (nodeTypeId === 'formMultiStepContainer') return 'formMultiStepContainer';
  
  if (nodeTypeId.startsWith('trigger')) return 'trigger';
  if (nodeTypeId.startsWith('form')) return 'formStep';
  if (nodeTypeId.startsWith('condition')) return 'condition';
  if (nodeTypeId.startsWith('action')) return 'action';
  if (nodeTypeId.startsWith('wait')) return 'waitState';
  if (nodeTypeId.startsWith('document')) return 'document';
  if (nodeTypeId.startsWith('utility')) return 'utility';
  if (nodeTypeId.startsWith('terminal')) return 'terminal';
  if (nodeTypeId.startsWith('end')) return 'terminal'; // Map 'endSuccess', 'endError' to terminal
  
  // Log unknown type for debugging
  logger.warn(`Unknown node type: ${nodeTypeId}, defaulting to action`);
  
  // Default to action
  return 'action';
}

function getDefaultNodeData(nodeTypeId: string): Record<string, any> {
  // Return default data based on node type
  const nodeDef = NODE_TYPE_REGISTRY[nodeTypeId];
  
  if (nodeTypeId.startsWith('trigger')) {
    const triggerType = nodeTypeId.replace('trigger', '').toLowerCase();
    return { 
      triggerType: triggerType || 'manual',
      maxInputs: nodeDef?.maxInputs || 0,
      maxOutputs: nodeDef?.maxOutputs || 1,
    };
  }
  
  if (nodeTypeId.startsWith('form')) {
    // Special handling for multi-step container
    if (nodeTypeId === 'formMultiStepContainer') {
      return {
        fields: [],
        containerName: 'New Container',
        isExpanded: true,
        childNodes: [],
        maxInputs: nodeDef?.maxInputs || 1,
        maxOutputs: nodeDef?.maxOutputs || 1,
      };
    }
    
    return { 
      fields: [],
      maxInputs: nodeDef?.maxInputs || 1,
      maxOutputs: nodeDef?.maxOutputs || 2,
    };
  }
  
  if (nodeTypeId.startsWith('condition')) {
    return { 
      rules: [], 
      logicalOperator: 'AND',
      maxInputs: nodeDef?.maxInputs || 1,
      maxOutputs: nodeDef?.maxOutputs || 2,
    };
  }
  
  if (nodeTypeId.startsWith('action')) {
    const actionType = nodeTypeId.replace('action', '');
    const typeMap: Record<string, string> = {
      'Email': 'email',
      'Notify': 'notify',
      'CreateRecord': 'createRecord',
      'UpdateRecord': 'updateRecord',
      'DeleteRecord': 'deleteRecord',
      'HTTP': 'http',
      'Script': 'script',
    };
    return { 
      actionType: typeMap[actionType] || 'email',
      maxInputs: nodeDef?.maxInputs || 1,
      maxOutputs: nodeDef?.maxOutputs || 2,
    };
  }
  
  if (nodeTypeId.startsWith('wait')) {
    const waitType = nodeTypeId.replace('wait', '').toLowerCase();
    return {
      waitType: waitType || 'approval',
      maxInputs: nodeDef?.maxInputs || 1,
      maxOutputs: nodeDef?.maxOutputs || 2,
    };
  }
  
  if (nodeTypeId.startsWith('document')) {
    const docType = nodeTypeId.replace('document', '').toLowerCase();
    return {
      documentType: docType || 'generate',
      maxInputs: nodeDef?.maxInputs || 1,
      maxOutputs: nodeDef?.maxOutputs || 2,
    };
  }
  
  if (nodeTypeId.startsWith('utility')) {
    const utilType = nodeTypeId.replace('utility', '').toLowerCase();
    return {
      utilityType: utilType || 'transform',
      maxInputs: nodeDef?.maxInputs || 1,
      maxOutputs: nodeDef?.maxOutputs || 1,
    };
  }
  
  if (nodeTypeId.startsWith('terminal')) {
    const termType = nodeTypeId.replace('terminal', '').toLowerCase();
    return {
      terminalType: termType || 'success',
      maxInputs: nodeDef?.maxInputs || 1,
      maxOutputs: nodeDef?.maxOutputs || 0,
    };
  }
  
  return {
    maxInputs: nodeDef?.maxInputs || 1,
    maxOutputs: nodeDef?.maxOutputs || 1,
  };
}

// ============================================================================
// Export with Provider
// ============================================================================

export const UnifiedFlowEditor: React.FC<UnifiedFlowEditorProps> = (props) => {
  // Handler for node data updates from FormBuilder
  const handleNodeDataUpdate = useCallback((nodeId: string, updates: any) => {
    logger.debug('[UnifiedFlowEditor] Node data updated from FormBuilder:', { nodeId, updates });
    // This will be called by FormBuilder context when data changes
    // The actual state update happens inside UnifiedFlowEditorInner via setNodes
  }, []);

  return (
    <ErrorBoundary 
      componentName="Workforms Editor"
      onError={(error, errorInfo) => {
        logger.error('[UnifiedFlowEditor] Critical error:', { error, errorInfo });
      }}
    >
      <ReactFlowProvider>
        <FormBuilderProvider onNodeDataUpdate={handleNodeDataUpdate}>
          <UnifiedFlowEditorInner {...props} />
        </FormBuilderProvider>
      </ReactFlowProvider>
    </ErrorBoundary>
  );
};

export default UnifiedFlowEditor;
