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
 * Created: 2026-02-04 - Phase 2.1 Visual Editor Foundation
 * Updated: 2026-02-04 - Phase 2.1 Batch 2 (Added Wait, Document, Utility, Terminal nodes)
 * Updated: 2026-02-04 - Phase 2.1 Batch 3 (Enhanced palette, keyboard shortcuts, undo/redo)
 */
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import styled from 'styled-components';
import Editor from '@monaco-editor/react';
import { useQuery } from '@tanstack/react-query';
import { adminClient } from '../../services/apiService';
import toast, { Toaster } from 'react-hot-toast'; // Phase 8.1
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
} from 'lucide-react';

import {
  FormStepNode,
  FormReferenceNode,
  FormMultiStepContainerNode,
  TriggerNode,
  ConditionIfNode,
  ActionNode,
  WaitStateNode,
  DocumentNode,
  UtilityNode,
  TerminalNode,
} from './nodes';
import { CustomEdge } from './edges';
import { NODE_TYPE_REGISTRY, NodeCategory, CATEGORY_LABELS, CATEGORY_ORDER } from './nodeTypes';
import { calculateContainerLayout, autoConnectSequentialSteps } from './utils/containerLayout'; // Phase 3-4
import { saveWorkflow, loadWorkflow, listWorkflows, deleteWorkflow, type WorkflowListItem } from './utils/workflowPersistence'; // Phase 7, 8.3
import { NodeConfigPanel } from './ConfigPanel';
import { FormStepConfigPanel } from './ConfigPanel/FormStepConfigPanel';
import { FormFieldConfigPanel } from './ConfigPanel/FormFieldConfigPanel';
import { SectionConfigPanel } from './ConfigPanel/SectionConfigPanel';
import { DocumentConfigPanel } from './ConfigPanel/DocumentConfigPanel';
import { CreateRecordConfigPanel } from './ConfigPanel/CreateRecordConfigPanel';
import { FormReferenceConfigPanel } from './ConfigPanel/FormReferenceConfigPanel';
import { HelpModal } from './HelpModal'; // Workform Editor Enhancements
import { TemplateSelector } from './templates/TemplateSelector';
import { FlowTemplate } from './templates/flowTemplates';
import { SidePanel } from './SidePanel';
import { EntityFormStepModal, type FormStepData } from './Modals/EntityFormStepModal';
import { FormMultiStepContainerModal, type ContainerData } from './Modals/FormMultiStepContainerModal';
import { WorkflowManagementModal, type WorkflowMetadata } from './Modals/WorkflowManagementModal'; // Phase 8.2
import { PreviewPanel } from './panels/PreviewPanel';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export type EditorMode = 'wizard' | 'visual' | 'expert';

interface UnifiedFlowEditorProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onSave?: (nodes: Node[], edges: Edge[]) => void;
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
  
  /* Phase 8.4: Smooth animations for node layout changes */
  .react-flow__node {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                opacity 0.2s ease;
  }
  
  .react-flow__node.dragging {
    transition: none !important;
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
  top: 12px;
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
  top: 12px;
  right: 12px;
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

// ============================================================================
// Node & Edge Type Mapping
// ============================================================================

const nodeTypes: NodeTypes = {
  formStep: FormStepNode,
  formReference: FormReferenceNode,
  formMultiStepContainer: FormMultiStepContainerNode,
  trigger: TriggerNode,
  condition: ConditionIfNode,
  action: ActionNode,
  waitState: WaitStateNode,
  document: DocumentNode,
  utility: UtilityNode,
  terminal: TerminalNode,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

// ============================================================================
// Component
// ============================================================================

const UnifiedFlowEditorInner: React.FC<UnifiedFlowEditorProps> = ({
  initialNodes = [],
  initialEdges = [],
  onSave,
  readOnly = false,
  editorMode = 'visual',
  allowedNodeCategories, // Phase 4.2: Permission-based filtering
}) => {
  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeIdCounter, setNodeIdCounter] = useState(initialNodes.length + 1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Phase E: Wrap onNodesChange to handle container deletion
  const onNodesChange = useCallback((changes: any[]) => {
    // Check if any containers are being removed
    const removedNodeIds = changes
      .filter(change => change.type === 'remove')
      .map(change => change.id);
    
    if (removedNodeIds.length > 0) {
      const removedContainerIds = removedNodeIds.filter(id => 
        nodes.find(n => n.id === id && n.type === 'formMultiStepContainer')
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
              
              console.log(`[Container] Unparenting node ${n.id} from deleted container`);
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
  }, [nodes, setNodes, onNodesChangeBase]);
  
  // React Flow instance for viewport controls
  const reactFlowInstance = useReactFlow();
  
  // ============================================================================
  // Container State Restoration (Phase 4 Batch 5)
  // ============================================================================
  
  /**
   * Rebuild container statistics when workflow is loaded
   * This ensures container nodes show correct counts even if statistics
   * weren't persisted or became stale. Also cleans up orphaned nodes.
   */
  useEffect(() => {
    if (initialNodes && initialNodes.length > 0) {
      // Find all container nodes
      const containerNodes = initialNodes.filter(
        n => n.type === 'formMultiStepContainer'
      );
      
      const containerIds = new Set(containerNodes.map(c => c.id));
      
      // Check for orphaned nodes (containerNodeId pointing to non-existent container)
      const orphanedNodes = initialNodes.filter(
        n => n.data?.containerNodeId && !containerIds.has(n.data.containerNodeId)
      );
      
      if (orphanedNodes.length > 0) {
        console.warn(
          `[Container Restore] Found ${orphanedNodes.length} orphaned nodes (referencing missing containers)`,
          orphanedNodes.map(n => n.id)
        );
        
        // Clean up orphaned nodes by removing their containerNodeId
        setNodes((nds) => nds.map(n => {
          if (n.data?.containerNodeId && !containerIds.has(n.data.containerNodeId)) {
            const cleanedData = { ...n.data };
            delete cleanedData.containerNodeId;
            console.log(`[Container Restore] Cleaned orphaned node ${n.id}`);
            return { ...n, data: cleanedData };
          }
          return n;
        }));
      }
      
      if (containerNodes.length > 0) {
        console.log(`[Container Restore] Found ${containerNodes.length} containers, rebuilding statistics...`);
        
        // Rebuild statistics for each container
        containerNodes.forEach(container => {
          // Count child nodes
          const childNodes = initialNodes.filter(
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
          
          console.log(`[Container Restore] Container ${container.id}: ${childNodes.length} nodes`);
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
      console.log('[Phase 6] Deprecated nodes detected:', uniqueTypes, foundDeprecated.length);
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
  
  // Filter available node types based on editor mode AND permissions (Phase 4.2)
  const availableNodeTypes = useMemo(() => {
    let filteredNodes = Object.values(NODE_TYPE_REGISTRY);
    
    console.log('[NodePalette] Total nodes in registry:', filteredNodes.length);
    console.log('[NodePalette] Editor mode:', activeEditorMode);
    console.log('[NodePalette] Allowed categories:', allowedNodeCategories);
    
    // Step 0: Filter out hidden/deprecated nodes (Phase 6)
    filteredNodes = filteredNodes.filter(nodeType => !nodeType.hidden);
    console.log('[NodePalette] After hidden filtering:', filteredNodes.length);
    
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
    
    console.log('[NodePalette] After mode filtering:', filteredNodes.length);
    
    // Step 2: Filter by permission categories (if restricted)
    if (allowedNodeCategories && allowedNodeCategories.length > 0) {
      filteredNodes = filteredNodes.filter(nodeType => 
        allowedNodeCategories.includes(nodeType.category)
      );
      console.log('[NodePalette] After permission filtering:', filteredNodes.length);
    }
    
    console.log('[NodePalette] Final available nodes:', filteredNodes.length);
    console.log('[NodePalette] Available node IDs:', filteredNodes.map(n => n.id));
    
    return filteredNodes;
  }, [activeEditorMode, allowedNodeCategories]);

  // ============================================================================
  // Enhanced Palette Features State
  // ============================================================================
  
  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Favorites & Recent
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentNodes, setRecentNodes] = useState<string[]>([]);
  
  // Category collapse state
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  
  // Undo/Redo history
  const [history, setHistory] = useState<HistoryState[]>([{ nodes: initialNodes, edges: initialEdges }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isPaletteVisible, setIsPaletteVisible] = useState(true);

  // Configuration Panel
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  
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
  const [workflowSearchQuery, setWorkflowSearchQuery] = useState(''); // Phase 8.3
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false); // Phase 8.3
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowListItem | null>(null); // Phase 8.3
  const [isDeleting, setIsDeleting] = useState(false); // Phase 8.3
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false); // Phase 8.6
  
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
      
      setNodes(parsed.nodes);
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
          
          setNodes(parsed.nodes);
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
    const suggestions = {
      form: ['trigger', 'formStep', 'action', 'condition'],
      workflow: ['trigger', 'condition', 'action', 'wait'],
      approval: ['trigger', 'wait', 'condition', 'action'],
      document: ['trigger', 'formStep', 'document', 'action'],
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
      console.error('Failed to load editor preferences:', e);
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
  
  // Real-time connection validation for React Flow
  const isValidConnection = useCallback((connection: Connection) => {
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    
    if (!sourceNode || !targetNode) return false;
    
    // Type-aware validation
    const typeCheck = isValidConnectionType(sourceNode.type || '', targetNode.type || '');
    if (!typeCheck.valid) {
      return false;
    }
    
    // Check max outputs on source
    const sourceOutputs = edges.filter(e => e.source === connection.source);
    const sourceMaxOutputs = sourceNode.data.maxOutputs || Infinity;
    if (sourceOutputs.length >= sourceMaxOutputs) {
      return false;
    }
    
    // Check max inputs on target
    const targetInputs = edges.filter(e => e.target === connection.target);
    const targetMaxInputs = targetNode.data.maxInputs || Infinity;
    if (targetInputs.length >= targetMaxInputs) {
      return false;
    }
    
    return true;
  }, [nodes, edges, isValidConnectionType]);
  
  const onConnect = useCallback(
    (params: Connection) => {
      // Validate connection based on node constraints
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);
      
      if (!sourceNode || !targetNode) return;
      
      // Phase 6.1: Container isolation validation (HIGHEST PRIORITY)
      // Block connections from child node to external node
      if (sourceNode.parentNode && !targetNode.parentNode) {
        console.warn('[Connection] ❌ Cannot connect child node to external node (container isolation)');
        // TODO: Show user-friendly error toast
        return;
      }
      
      // Block connections from external node to child node
      if (!sourceNode.parentNode && targetNode.parentNode) {
        console.warn('[Connection] ❌ Cannot connect external node to child node (container isolation)');
        // TODO: Show user-friendly error toast
        return;
      }
      
      // Block connections between nodes in different containers
      if (sourceNode.parentNode && targetNode.parentNode && sourceNode.parentNode !== targetNode.parentNode) {
        console.warn('[Connection] ❌ Cannot connect nodes from different containers');
        // TODO: Show user-friendly error toast
        return;
      }
      
      console.log('[Connection] ✅ Container isolation check passed');
      
      // Type-aware validation
      const typeCheck = isValidConnectionType(sourceNode.type || '', targetNode.type || '');
      if (!typeCheck.valid) {
        console.warn(`Invalid connection: ${typeCheck.reason}`);
        // TODO: Show toast notification to user
        return;
      }
      
      // Check max outputs on source
      const sourceOutputs = edges.filter(e => e.source === params.source);
      const sourceMaxOutputs = sourceNode.data.maxOutputs || Infinity;
      if (sourceOutputs.length >= sourceMaxOutputs) {
        console.warn(`Node ${sourceNode.data.label} has reached max outputs (${sourceMaxOutputs})`);
        return;
      }
      
      // Check max inputs on target
      const targetInputs = edges.filter(e => e.target === params.target);
      const targetMaxInputs = targetNode.data.maxInputs || Infinity;
      if (targetInputs.length >= targetMaxInputs) {
        console.warn(`Node ${targetNode.data.label} has reached max inputs (${targetMaxInputs})`);
        return;
      }
      
      setEdges((eds) => addEdge(params, eds));
    },
    [nodes, edges, setEdges, isValidConnectionType]
  );

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
   */
  const findContainerAtPosition = useCallback((position: { x: number; y: number }) => {
    // Get all container nodes
    const containerNodes = nodes.filter(node => node.type === 'formMultiStepContainer');
    
    console.log('[Container] =================================');
    console.log('[Container] Looking for containers at position:', position);
    console.log('[Container] Total containers on canvas:', containerNodes.length);
    console.log('[Container] Container types found:', containerNodes.map(n => ({ id: n.id, type: n.type, measured: !!n.measured })));
    
    if (containerNodes.length === 0) {
      console.log('[Container] ❌ No containers exist on canvas');
      return null;
    }
    
    // Manual bounding box detection
    for (const container of containerNodes) {
      // CRITICAL: Use measured dimensions if available (React Flow has calculated them)
      // Otherwise fall back to style or defaults
      const containerWidth = container.measured?.width || 
                            (typeof container.style?.width === 'number' ? container.style.width : 
                             typeof container.width === 'number' ? container.width : 400);
      const containerHeight = container.measured?.height || 
                             (typeof container.style?.height === 'number' ? container.style.height : 
                              typeof container.height === 'number' ? container.height : 300);
      
      // Calculate bounding box
      const bounds = {
        left: container.position.x,
        right: container.position.x + containerWidth,
        top: container.position.y,
        bottom: container.position.y + containerHeight,
      };
      
      console.log(`[Container] Checking container ${container.id}:`);
      console.log(`[Container]   Type: ${container.type}`);
      console.log(`[Container]   Position: (${container.position.x}, ${container.position.y})`);
      console.log(`[Container]   Measured: ${!!container.measured} (width: ${container.measured?.width}, height: ${container.measured?.height})`);
      console.log(`[Container]   Style: ${container.style?.width}x${container.style?.height}`);
      console.log(`[Container]   Using dimensions: ${containerWidth}x${containerHeight}`);
      console.log(`[Container]   Bounds: left=${bounds.left}, right=${bounds.right}, top=${bounds.top}, bottom=${bounds.bottom}`);
      console.log(`[Container]   Drop point: x=${position.x}, y=${position.y}`);
      
      // Check if drop position is within bounds
      if (
        position.x >= bounds.left &&
        position.x <= bounds.right &&
        position.y >= bounds.top &&
        position.y <= bounds.bottom
      ) {
        console.log(`[Container] ✅ Found container: ${container.id} (manual bounding box hit)`);
        console.log(`[Container]   Drop is within bounds: x in [${bounds.left}, ${bounds.right}], y in [${bounds.top}, ${bounds.bottom}]`);
        return container;
      } else {
        const xInBounds = position.x >= bounds.left && position.x <= bounds.right;
        const yInBounds = position.y >= bounds.top && position.y <= bounds.bottom;
        console.log(`[Container] ❌ Drop position outside container ${container.id}`);
        console.log(`[Container]   X ${xInBounds ? '✓' : '✗'} (${position.x} vs [${bounds.left}, ${bounds.right}])`);
        console.log(`[Container]   Y ${yInBounds ? '✓' : '✗'} (${position.y} vs [${bounds.top}, ${bounds.bottom}])`);
      }
    }
    
    console.log('[Container] ❌ No containers at drop position');
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
    
    console.log('[DEBUG] Drag coordinates:', {
      clientX: event.clientX,
      clientY: event.clientY,
      boundsLeft: reactFlowBounds.left,
      boundsTop: reactFlowBounds.top,
      relativeX: event.clientX - reactFlowBounds.left,
      relativeY: event.clientY - reactFlowBounds.top,
    });
    
    const flowPosition = reactFlowInstance.screenToFlowPosition({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });
    
    console.log('[DEBUG] Flow position after transform:', flowPosition);
    
    // Snap to alignment
    const snappedPosition = {
      x: Math.round(flowPosition.x / 15) * 15,
      y: Math.round(flowPosition.y / 15) * 15,
    };
    
    console.log('[DEBUG] Snapped position:', snappedPosition);
    
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
  }, [setNodes]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow-nodetype');
      if (!type) return;
      
      // Clear drag state
      setIsDragging(false);
      setDragNodeType(null);
      setDragPosition(null);
      setAlignmentGuides({ horizontal: [], vertical: [] });

      // CRITICAL FIX: Use the ReactFlow wrapper element, not currentTarget
      // currentTarget can be the wrong element causing coordinate offset
      const reactFlowWrapper = document.querySelector('.react-flow') as HTMLElement;
      if (!reactFlowWrapper) {
        console.error('[Container] ❌ Could not find React Flow wrapper');
        return;
      }
      
      const reactFlowBounds = reactFlowWrapper.getBoundingClientRect();
      
      console.log('[DEBUG] Drop event coordinates:', {
        clientX: event.clientX,
        clientY: event.clientY,
        boundsLeft: reactFlowBounds.left,
        boundsTop: reactFlowBounds.top,
        boundsWidth: reactFlowBounds.width,
        boundsHeight: reactFlowBounds.height,
      });
      
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });
      
      console.log('[DEBUG] Calculated flow position:', position);
      
      // Snap to grid (15x15)
      position.x = Math.round(position.x / 15) * 15;
      position.y = Math.round(position.y / 15) * 15;
      
      console.log('[DEBUG] Snapped position:', position);
      
      // Phase 1.4: Check if dropping into a container
      const targetContainer = findContainerAtPosition(position);
      
      if (targetContainer) {
        console.log(`[Container] ✅ Detected drop into container ${targetContainer.id} at position`, position);
        
        // Phase 1.3: Ensure container is expanded
        if (!targetContainer.data.isExpanded) {
          console.log(`[Container] Auto-expanding collapsed container ${targetContainer.id}`);
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
        }
      } else {
        console.log(`[Container] No container detected at position`, position);
      }
      
      // Check for nearby node to auto-connect
      const nearby = findNearbyNode(position);

      const newNode: Node = {
        id: `node-${nodeIdCounter}`,
        type: getReactFlowNodeType(type),
        position,
        data: {
          label: NODE_TYPE_REGISTRY[type]?.name || 'New Node',
          status: 'draft',
          ...getDefaultNodeData(type),
        },
      };
      
      // Phase 2.3: Container nodes no longer need childNodes/childEdges arrays
      if (type === 'formMultiStepContainer') {
        newNode.style = {
          width: 400,
          height: 300,
        };
        newNode.data = {
          ...newNode.data,
          // Phase 2.3: REMOVED childNodes and childEdges initialization
          // Children are now queried via parentNode property
          onEnterContainer: (containerId: string) => {
            console.log(`[Container] onEnterContainer callback triggered for ${containerId}`);
            // This will be handled by the parent editor
          },
        };
      }
      
      // Phase 1.4: If dropping into a container, set parent-child relationship
      if (targetContainer) {
        console.log(`[Container] Setting up parent-child relationship with container ${targetContainer.id}`);
        
        // Phase 1.4: Don't allow containers to be nested
        if (type === 'formMultiStepContainer') {
          console.log('[Container] ⚠️  Cannot nest containers inside containers - dropping on main canvas instead');
          // Fall through to main canvas drop
        } else {
          // Phase 1.4: Set up React Flow native parent-child relationship
          console.log(`[Container] Adding node ${newNode.id} as child of container ${targetContainer.id}`);
          
          // Calculate position relative to container
          newNode.position = {
            x: position.x - targetContainer.position.x,
            y: position.y - targetContainer.position.y,
          };
          
          // Phase 1.4: Set parentNode property (React Flow native)
          newNode.parentNode = targetContainer.id;
          
          // Phase 1.4: Constrain node movement to parent bounds
          newNode.extent = 'parent';
          
          // Phase 1.4: Auto-expand parent if node dropped near edge
          newNode.expandParent = true;
          
          console.log(`[Container] ✅ Node configured:`, {
            id: newNode.id,
            parentNode: newNode.parentNode,
            position: newNode.position,
            extent: newNode.extent,
          });
          
          // Add node to main state
          const updatedNodes = nodes.concat(newNode);
          setNodes(updatedNodes);
          setNodeIdCounter((prev) => prev + 1);
          
          // Phase 3.3: Trigger auto-layout for container
          console.log(`[Container] Triggering auto-layout for container ${targetContainer.id}`);
          const layoutResult = calculateContainerLayout(
            targetContainer.id,
            updatedNodes,
            edges
          );
          
          // Apply layout changes
          setNodes(layoutResult.nodes);
          
          // Phase 3.3: Update container dimensions if needed
          if (layoutResult.containerWidth > 400 || layoutResult.containerHeight > 300) {
            setNodes((nds) =>
              nds.map((n) => {
                if (n.id === targetContainer.id) {
                  return {
                    ...n,
                    style: {
                      ...n.style,
                      width: layoutResult.containerWidth,
                      height: layoutResult.containerHeight,
                    },
                  };
                }
                return n;
              })
            );
          }
          
          // Phase 4: Trigger auto-connection for form steps
          if (type === 'formStep' || type === 'formReference') {
            console.log(`[Container] Triggering auto-connection for container ${targetContainer.id}`);
            const connectionResult = autoConnectSequentialSteps(
              targetContainer.id,
              layoutResult.nodes,
              edges
            );
            
            // Apply connection changes
            setEdges(connectionResult.edges);
            console.log(`[Container] ✅ Auto-connection complete`);
          }
          
          // Clear nearby node state and return early (no auto-connect for container drops)
          setNearbyNode(null);
          
          // Phase 1.2: Clear drop target indicator
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === targetContainer.id && n.data.isDropTarget) {
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
          
          return; // Don't continue to main canvas drop
        }
      }
      
      // Normal drop on main canvas
      const updatedNodes = nodes.concat(newNode);
      setNodes(updatedNodes);
      setNodeIdCounter((prev) => prev + 1);
      
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
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // ============================================================================
  // Container Drag-Drop Logic (Phase 4.4)
  // ============================================================================
  
  /**
   * Phase 5: Handle node drag stop - detect reordering within container
   * Phase 1-4: Handle dragging nodes in/out of containers
   */
  const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
    // Phase 5: If node is inside a container and it's a form step, trigger re-layout
    if (node.parentNode && (node.type === 'formStep' || node.type === 'formReference')) {
      const container = nodes.find(n => n.id === node.parentNode);
      
      if (container) {
        console.log(`[DragStop] Triggering re-layout for container ${container.id} after node ${node.id} dragged`);
        
        // Re-calculate layout (reorders nodes based on new x-position)
        const layoutResult = calculateContainerLayout(container.id, nodes, edges);
        setNodes(layoutResult.nodes);
        
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
        
        console.log(`[DragStop] ✅ Re-layout and re-connection complete`);
        return;
      }
    }
    
    // Phase 1-4: Original logic - Handle dragging node in/out of container
    // Calculate absolute position (in case node is inside a parent)
    const absolutePosition = node.parentNode
      ? {
          x: node.position.x + (nodes.find(n => n.id === node.parentNode)?.position.x || 0),
          y: node.position.y + (nodes.find(n => n.id === node.parentNode)?.position.y || 0),
        }
      : node.position;
    
    const container = findContainerAtPosition(absolutePosition);
    
    // Check if node's parent container changed
    const currentParentId = node.parentNode;
    const newParentId = container?.id || null;
    
    // Prevent containers from being nested in other containers
    if (node.type === 'formMultiStepContainer' && newParentId) {
      console.log('[Container] Cannot nest containers inside containers');
      return;
    }
    
    if (currentParentId !== newParentId) {
      setNodes((nds) =>
        nds.map((n) => {
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
                updatedNode.parentNode = newParentId;
                updatedNode.extent = 'parent';
                console.log(`[Container] Node ${node.id} added to container ${newParentId}`);
              }
            } else if (currentParentId) {
              // Node is being removed from container
              updatedNode.position = absolutePosition;
              delete updatedNode.parentNode;
              delete updatedNode.extent;
              console.log(`[Container] Node ${node.id} removed from container`);
            }
            
            return updatedNode;
          }
          return n;
        })
      );
      
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
      const childNodes = nds.filter(n => n.parentNode === containerId);
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
    console.log(`[Align] Distributed ${selectedNodes.length} nodes horizontally`);
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
    console.log(`[Align] Distributed ${selectedNodes.length} nodes vertically`);
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
    console.log(`[Align] Aligned ${selectedNodes.length} nodes to left (x=${minX})`);
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
    console.log(`[Align] Aligned ${selectedNodes.length} nodes to right (x=${maxX})`);
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
    console.log(`[Align] Aligned ${selectedNodes.length} nodes to top (y=${minY})`);
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
    console.log(`[Align] Aligned ${selectedNodes.length} nodes to bottom (y=${maxY})`);
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
    console.log(`[Align] Aligned ${selectedNodes.length} nodes to center X (x=${avgX.toFixed(0)})`);
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
    console.log(`[Align] Aligned ${selectedNodes.length} nodes to center Y (y=${avgY.toFixed(0)})`);
  }, [nodes, setNodes]);

  // ============================================================================
  // Save Handler
  // ============================================================================
  
  const handleSave = useCallback(() => {
    if (onSave) {
      // Log container information for debugging (Phase E)
      const containerNodes = nodes.filter(n => n.type === 'formMultiStepContainer');
      const nodesInContainers = nodes.filter(n => n.parentNode); // Phase E: Using React Flow parentNode
      
      console.log('[Save] Workflow saved with container state:');
      console.log(`  - ${containerNodes.length} container(s)`);
      console.log(`  - ${nodesInContainers.length} node(s) in containers`);
      
      if (containerNodes.length > 0) {
        containerNodes.forEach(container => {
          const childNodes = nodes.filter(n => n.parentNode === container.id); // Phase E: Using parentNode
          console.log(`  - Container ${container.id}: ${childNodes.length} nodes`);
        });
      }
      
      onSave(nodes, edges);
      console.log('Flow saved successfully!');
      setHasUnsavedChanges(false);
    }
  }, [nodes, edges, onSave]);

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
      const childNodes = nodes.filter(n => n.parentNode === container.id);
      
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
      console.warn('⚠️ Validation errors:', validation.errors);
      return;
    }
    
    setIsSaving(true);
    
    // Show loading toast
    const loadingToast = toast.loading(
      currentWorkflowId ? 'Updating workflow...' : 'Creating workflow...'
    );
    
    try {
      // Get current viewport
      const viewport = reactFlowInstance.getViewport();
      
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
      console.log('✅ Workflow saved:', savedWorkflow.name);
      
      // Show success toast
      toast.success(
        `Workflow "${savedWorkflow.name}" ${currentWorkflowId ? 'updated' : 'created'} successfully!`,
        { id: loadingToast }
      );
    } catch (error) {
      console.error('❌ Failed to save workflow:', error);
      
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
      
      // Update editor state
      setNodes(loadedWorkflow.workflow_definition.nodes || []);
      setEdges(loadedWorkflow.workflow_definition.edges || []);
      setCurrentWorkflowId(loadedWorkflow.id);
      setCurrentWorkflowName(loadedWorkflow.name);
      setCurrentWorkflowDescription(loadedWorkflow.description || ''); // Phase 8.2
      setCurrentWorkflowStatus(loadedWorkflow.status as 'draft' | 'active' | 'archived'); // Phase 8.2
      setHasUnsavedChanges(false);
      
      // Restore viewport if saved
      if (loadedWorkflow.workflow_definition.viewport && reactFlowInstance) {
        reactFlowInstance.setViewport(loadedWorkflow.workflow_definition.viewport);
      }
      
      // Close load menu
      setIsLoadMenuOpen(false);
      
      console.log('✅ Workflow loaded:', loadedWorkflow.name);
      
      // Show success toast
      toast.success(
        `Workflow "${loadedWorkflow.name}" loaded successfully!`,
        { id: loadingToast }
      );
    } catch (error) {
      console.error('❌ Failed to load workflow:', error);
      
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
          console.error('❌ Failed to fetch workflow list:', error);
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
      console.error('❌ Failed to delete workflow:', error);
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
    reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
  }, [reactFlowInstance]);
  
  const zoomIn = useCallback(() => {
    reactFlowInstance.zoomIn({ duration: 300 });
  }, [reactFlowInstance]);
  
  const zoomOut = useCallback(() => {
    reactFlowInstance.zoomOut({ duration: 300 });
  }, [reactFlowInstance]);
  
  const zoomTo = useCallback((level: number) => {
    reactFlowInstance.zoomTo(level, { duration: 300 });
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
        event.preventDefault();
        if (isPaletteVisible && searchInputRef.current) {
          searchInputRef.current.focus();
        }
        return;
      }
      
      // Delete/Backspace: Delete selected nodes
      if ((event.key === 'Delete' || event.key === 'Backspace') && 
          event.target === document.body) {
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
    console.log('[Phase 6] Starting migration of deprecated nodes...');
    
    const DEPRECATED_TYPES = ['formField', 'formSection'];
    const nodesToMigrate = nodes.filter(node => DEPRECATED_TYPES.includes(node.type || ''));
    
    if (nodesToMigrate.length === 0) {
      console.log('[Phase 6] No deprecated nodes to migrate');
      return;
    }
    
    const newNodes = nodes.map(node => {
      if (!DEPRECATED_TYPES.includes(node.type || '')) {
        return node; // Keep non-deprecated nodes as-is
      }
      
      console.log(`[Phase 6] Migrating ${node.type} node:`, node.id);
      
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
    
    console.log(`[Phase 6] Migration complete: ${nodesToMigrate.length} nodes migrated`);
    
    // Show success message
    alert(`Successfully migrated ${nodesToMigrate.length} deprecated node(s) to modern format!\n\nPlease review the migrated nodes and save your workflow.`);
  }, [nodes, setNodes]);

  // ============================================================================
  // Node Selection & Configuration
  // ============================================================================

  const handleSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    // Open config panel when a single node is selected
    const selectedNodes = params.nodes || [];
    if (selectedNodes.length === 1) {
      const node = selectedNodes[0];
      
      console.log('[UnifiedFlowEditor] Node selected:', node.type, node);
      
      // Close all modals first
      setFormStepModalOpen(false);
      setFormFieldModalOpen(false);
      setSectionModalOpen(false);
      setDocumentModalOpen(false);
      setCreateRecordModalOpen(false);
      setFormReferenceModalOpen(false);
      setContainerModalOpen(false);
      setSelectedNode(null);
      setSelectedFormStep(null);
      setSelectedFormField(null);
      setSelectedSection(null);
      setSelectedDocument(null);
      setSelectedCreateRecord(null);
      setSelectedFormReference(null);
      setSelectedContainer(null);
      
      // Route to appropriate config panel based on node type
      switch (node.type) {
        case 'formStep':
          console.log('[UnifiedFlowEditor] Opening FormStep modal');
          setSelectedFormStep(node);
          setFormStepModalOpen(true);
          break;
        
        case 'formMultiStepContainer':
          console.log('[UnifiedFlowEditor] Opening Container modal');
          setSelectedContainer(node);
          setContainerModalOpen(true);
          break;
          
        case 'formReference':
          console.log('[UnifiedFlowEditor] Opening FormReference modal');
          setSelectedFormReference(node);
          setFormReferenceModalOpen(true);
          break;
          
        case 'formField':
          console.log('[UnifiedFlowEditor] Opening FormField modal');
          setSelectedFormField(node);
          setFormFieldModalOpen(true);
          break;
          
        case 'formSection':
        case 'section':
          console.log('[UnifiedFlowEditor] Opening Section modal');
          setSelectedSection(node);
          setSectionModalOpen(true);
          break;
          
        case 'formFileUpload':
        case 'document':
        case 'upload':
          console.log('[UnifiedFlowEditor] Opening Document modal');
          setSelectedDocument(node);
          setDocumentModalOpen(true);
          break;
          
        case 'action':
          // Route to specialized action config based on actionType
          const actionType = node.data.actionType;
          if (actionType === 'createRecord') {
            console.log('[UnifiedFlowEditor] Opening CreateRecord action modal');
            setSelectedCreateRecord(node);
            setCreateRecordModalOpen(true);
          } else {
            // Fall through to generic config for other action types
            console.log('[UnifiedFlowEditor] Opening generic config panel for action');
            setSelectedNode(node);
          }
          break;
          
        default:
          console.log('[UnifiedFlowEditor] Opening generic config panel');
          setSelectedNode(node);
      }
    } else {
      // Clear all selections
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
    console.log(`Node ${nodeId} updated:`, newData);
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
    
    console.log('[UnifiedFlowEditor] Saving EntityFormStep:', formData);
    
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
    
    console.log('[UnifiedFlowEditor] Saving Container:', containerData);
    
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
    console.log(`Testing node ${nodeId} with sample data...`);
    // Test runner logic will be implemented in future batch
  }, []);

  // ============================================================================
  // Template Selection Handler (Phase 2.5 Integration)
  // ============================================================================
  
  const handleTemplateSelect = useCallback((template: FlowTemplate) => {
    console.log('[Template] Selected:', template.name);
    
    // Map template nodes to proper React Flow node types
    const mappedNodes = template.nodes.map(node => {
      // Ensure node has proper type mapping
      const reactFlowType = getReactFlowNodeType(node.type);
      return {
        ...node,
        type: reactFlowType, // Override with React Flow node type
        data: {
          ...node.data,
          label: node.data.label || node.type, // Ensure label exists
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
      reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
    }, 100);
  }, [setNodes, setEdges, reactFlowInstance]);

  const handleStartBlank = useCallback(() => {
    console.log('[Template] Starting blank canvas');
    
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
  // Filter Nodes by Search Query
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
    
    // Filter by available node types based on editor mode
    availableNodeTypes.forEach(node => {
      // Filter by search query
      if (query && !node.name.toLowerCase().includes(query) && 
          !node.description.toLowerCase().includes(query)) {
        return;
      }
      
      grouped[node.category].push(node);
    });

    return grouped;
  }, [searchQuery, availableNodeTypes]);

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
        <NodePalette>
          <PaletteTitle>Add Nodes</PaletteTitle>
          
          {/* Search Input */}
          <SearchInput
            ref={searchInputRef}
            type="text"
            placeholder="Search nodes... (press / to focus)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          
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
        <Toolbar>
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
          
          <div style={{ width: '1px', height: '20px', background: 'rgb(var(--color-border))' }} />
          <ToolbarButton 
            onClick={() => setIsPreviewVisible(!isPreviewVisible)} 
            title={isPreviewVisible ? "Hide Preview" : "Show Preview"}
            style={isPreviewVisible ? { 
              background: 'rgb(var(--color-primary))', 
              color: 'white',
              borderColor: 'rgb(var(--color-primary))'
            } : {}}
          >
            <Eye size={14} style={{ marginRight: '4px' }} />
            {isPreviewVisible ? 'Hide Preview' : 'Show Preview'}
          </ToolbarButton>
        </Toolbar>
      )}

      {/* Viewport Controls */}
      <ViewportToolbar>
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
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={handleSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ 
          type: 'custom',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: '#94a3b8',
          },
        }}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
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

      {/* Configuration Panel */}
      <NodeConfigPanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onUpdate={handleNodeUpdate}
        onTest={handleNodeTest}
      />
      
      {/* Template Selector Modal (Phase 2.5 Integration) */}
      <TemplateSelector
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSelectTemplate={handleTemplateSelect}
        onStartBlank={handleStartBlank}
      />
      
      {/* EntityFormStep Configuration Modal (Phase 3 - WF-ENH-2026-Q1) */}
      <EntityFormStepModal
        isOpen={formStepModalOpen && !!selectedFormStep}
        onClose={() => {
          setFormStepModalOpen(false);
          setSelectedFormStep(null);
        }}
        onSave={handleEntityFormStepSave}
        initialData={selectedFormStep ? convertNodeDataToFormStepData(selectedFormStep) : undefined}
        nodeId={selectedFormStep?.id}
      />
      
      {/* FormMultiStepContainer Configuration Modal (Phase 4.3) */}
      <FormMultiStepContainerModal
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
    </EditorContainer>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

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
  console.warn(`Unknown node type: ${nodeTypeId}, defaulting to action`);
  
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
  return (
    <ReactFlowProvider>
      <UnifiedFlowEditorInner {...props} />
    </ReactFlowProvider>
  );
};

export default UnifiedFlowEditor;
