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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Star, Search as SearchIcon, ChevronDown, Undo2, Redo2, Maximize2, ZoomIn, ZoomOut, Wand2, Eye, Code2, Download, Upload, CheckCircle, AlertCircle, Copy } from 'lucide-react';

import {
  FormStepNode,
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
import { NodeConfigPanel } from './ConfigPanel';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface UnifiedFlowEditorProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onSave?: (nodes: Node[], edges: Edge[]) => void;
  readOnly?: boolean;
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

const EditorContainer = styled.div`
  width: 100%;
  height: 600px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;
  position: relative;
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

const ViewportToolbar = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  z-index: 5;
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
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeIdCounter, setNodeIdCounter] = useState(initialNodes.length + 1);
  
  // React Flow instance for viewport controls
  const reactFlowInstance = useReactFlow();

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
  
  // Drag-drop state for ghost preview and smart snapping
  const [isDragging, setIsDragging] = useState(false);
  const [dragNodeType, setDragNodeType] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Alignment guides state
  const [alignmentGuides, setAlignmentGuides] = useState<{
    horizontal: number[];
    vertical: number[];
  }>({ horizontal: [], vertical: [] });
  
  // Proximity detection state
  const [nearbyNode, setNearbyNode] = useState<Node | null>(null);
  
  // ============================================================================
  // Editor Mode State (Phase 2.2)
  // ============================================================================
  
  type EditorMode = 'visual' | 'wizard' | 'expert';
  const [editorMode, setEditorMode] = useState<EditorMode>(() => {
    try {
      const stored = localStorage.getItem('flow_editor_mode');
      return (stored as EditorMode) || 'visual';
    } catch {
      return 'visual';
    }
  });
  
  // Persist mode preference
  useEffect(() => {
    localStorage.setItem('flow_editor_mode', editorMode);
  }, [editorMode]);
  
  // ============================================================================
  // Expert Mode State (Phase 2.2 Batch 2)
  // ============================================================================
  
  const [jsonCode, setJsonCode] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  // Sync nodes/edges to JSON when entering Expert Mode or when data changes
  useEffect(() => {
    if (editorMode === 'expert') {
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
  }, [editorMode, nodes, edges, lastSyncTime]);
  
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
      setEditorMode('visual');
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
          setEditorMode('visual');
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
  
  const onDrag = useCallback((event: React.DragEvent) => {
    if (event.clientX === 0 && event.clientY === 0) return; // Ignore end event
    
    // Update drag ghost position
    setDragPosition({ x: event.clientX, y: event.clientY });
    
    // Detect alignment and proximity during drag
    const reactFlowBounds = event.currentTarget.getBoundingClientRect();
    const flowPosition = reactFlowInstance.screenToFlowPosition({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });
    
    // Snap to alignment
    const snappedPosition = {
      x: Math.round(flowPosition.x / 15) * 15,
      y: Math.round(flowPosition.y / 15) * 15,
    };
    
    // Detect alignment guides
    const guides = detectAlignment(snappedPosition);
    setAlignmentGuides(guides);
    
    // Detect nearby node for auto-connect
    const nearby = findNearbyNode(snappedPosition);
    setNearbyNode(nearby);
  }, [reactFlowInstance, detectAlignment, findNearbyNode]);
  
  const onDragEnd = useCallback(() => {
    // Clear drag state
    setIsDragging(false);
    setDragNodeType(null);
    setDragPosition(null);
    setAlignmentGuides({ horizontal: [], vertical: [] });
    setNearbyNode(null);
  }, []);

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

      // Get React Flow bounds and calculate position
      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });
      
      // Snap to grid (15x15)
      position.x = Math.round(position.x / 15) * 15;
      position.y = Math.round(position.y / 15) * 15;
      
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
      
      const updatedNodes = nodes.concat(newNode);
      setNodes(updatedNodes);
      setNodeIdCounter((prev) => prev + 1);
      
      // Auto-connect to nearby node if found
      let updatedEdges = edges;
      if (nearby) {
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
    [nodeIdCounter, setNodes, reactFlowInstance, nodes, edges, findNearbyNode, setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // ============================================================================
  // Save Handler
  // ============================================================================
  
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(nodes, edges);
      console.log('Flow saved successfully!');
    }
  }, [nodes, edges, onSave]);

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
      
      // Ctrl+S / Cmd+S: Save
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleSave();
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
  }, [isPaletteVisible, nodes, undo, redo, handleSave, setNodes, setEdges, fitView, zoomTo, selectAll, deselectAll, setSelectedNode, isDragging]);

  // ============================================================================
  // Node Selection & Configuration
  // ============================================================================

  const handleSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    // Open config panel when a single node is selected
    const selectedNodes = params.nodes || [];
    if (selectedNodes.length === 1) {
      setSelectedNode(selectedNodes[0]);
    } else {
      setSelectedNode(null);
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
  }, [setNodes]);

  const handleNodeTest = useCallback((nodeId: string) => {
    console.log(`Testing node ${nodeId} with sample data...`);
    // Test runner logic will be implemented in future batch
  }, []);

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
    
    Object.values(NODE_TYPE_REGISTRY).forEach(node => {
      // Filter by search query
      if (query && !node.name.toLowerCase().includes(query) && 
          !node.description.toLowerCase().includes(query)) {
        return;
      }
      
      grouped[node.category].push(node);
    });

    return grouped;
  }, [searchQuery]);

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
    <EditorContainer>
      {/* Node Palette - Visual Mode Only */}
      {!readOnly && isPaletteVisible && editorMode === 'visual' && (
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
          <ToolbarButton onClick={handleSave} title="Save Flow (Ctrl+S)">
            Save Flow
          </ToolbarButton>
        </Toolbar>
      )}

      {/* Viewport Controls */}
      <ViewportToolbar>
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
      
      {/* Mode Selector (Phase 2.2) */}
      <ModeSelectorContainer>
        <ModeButton
          $active={editorMode === 'wizard'}
          onClick={() => setEditorMode('wizard')}
          title="Wizard Mode - Guided step-by-step creation"
        >
          <Wand2 />
          Wizard
        </ModeButton>
        <ModeButton
          $active={editorMode === 'visual'}
          onClick={() => setEditorMode('visual')}
          title="Visual Mode - Drag-and-drop canvas"
        >
          <Eye />
          Visual
        </ModeButton>
        <ModeButton
          $active={editorMode === 'expert'}
          onClick={() => setEditorMode('expert')}
          title="Expert Mode - JSON code editor"
        >
          <Code2 />
          Expert
        </ModeButton>
      </ModeSelectorContainer>

      {/* React Flow Canvas - Visual Mode */}
      {editorMode === 'visual' && (
        <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onSelectionChange={handleSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'custom' }}
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
            </EmptyText>
          </EmptyState>
        )}
      </ReactFlow>
      )}
      
      {/* Wizard Mode Placeholder (Phase 2.2 - Batch 3) */}
      {editorMode === 'wizard' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          fontSize: '14px',
          color: 'rgb(var(--color-text-secondary))'
        }}>
          🪄 Wizard Mode - Coming in Batch 3!
        </div>
      )}
      
      {/* Expert Mode - JSON Editor (Phase 2.2 Batch 2) */}
      {editorMode === 'expert' && (
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
    </EditorContainer>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

function getReactFlowNodeType(nodeTypeId: string): string {
  // Map node type IDs to React Flow node component names
  if (nodeTypeId.startsWith('trigger')) return 'trigger';
  if (nodeTypeId.startsWith('form')) return 'formStep';
  if (nodeTypeId.startsWith('condition')) return 'condition';
  if (nodeTypeId.startsWith('action')) return 'action';
  if (nodeTypeId.startsWith('wait')) return 'waitState';
  if (nodeTypeId.startsWith('document')) return 'document';
  if (nodeTypeId.startsWith('utility')) return 'utility';
  if (nodeTypeId.startsWith('terminal')) return 'terminal';
  
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
