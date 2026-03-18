/**
 * FlowEditorContext
 * 
 * Phase E.1: Foundation - Step 3/4 (Centralized State Management)
 * 
 * Provides centralized state management for the FlowEditor to eliminate prop drilling
 * and create a single source of truth for editor state.
 * 
 * Features:
 * - Selected node/edge management
 * - Modal state management (8 modal types)
 * - Editor mode (wizard, visual, expert)
 * - UI settings (palette, preview, minimap, grid)
 * - History management
 * - Fullscreen state
 * 
 * Usage:
 * ```typescript
 * // In parent (UnifiedFlowEditor)
 * <FlowEditorProvider initialMode="visual">
 *   <YourComponents />
 * </FlowEditorProvider>
 * 
 * // In child components
 * const { selectedNode, selectNode, openModal, mode } = useFlowEditor();
 * ```
 * 
 * Created: 2026-02-17 - Phase E.1 FlowEditor Refactoring
 */
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Node, Edge } from '@xyflow/react';

// ============================================================================
// TYPES
// ============================================================================

export type EditorMode = 'wizard' | 'visual' | 'expert';

export type ModalType = 
  | 'formStep'
  | 'formField'
  | 'section'
  | 'document'
  | 'createRecord'
  | 'formReference'
  | 'container'
  | 'settings';

export interface ModalState {
  type: ModalType;
  isOpen: boolean;
  node: Node | null;
}

export interface UISettings {
  isPaletteVisible: boolean;
  isPreviewVisible: boolean;
  isMinimapVisible: boolean;
  isFullscreen: boolean;
  snapToGrid: boolean;
  gridSize: number;
}

export interface DebugSessionState {
  isActive: boolean;
  activeNodeId: string | null;
  previousNodeId: string | null;
  executedNodeIds: string[];
}

export interface FlowEditorContextValue {
  // Selected elements
  selectedNode: Node | null;
  selectedEdge: Edge | null;

  // Actions for selection
  selectNode: (node: Node | null) => void;
  selectEdge: (edge: Edge | null) => void;
  clearSelection: () => void;

  // Editor mode
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;

  // Modal management
  modals: Record<ModalType, ModalState>;
  openModal: (type: ModalType, node?: Node) => void;
  closeModal: (type: ModalType) => void;
  closeAllModals: () => void;
  isModalOpen: (type: ModalType) => boolean;

  // UI settings
  ui: UISettings;
  togglePalette: () => void;
  togglePreview: () => void;
  toggleMinimap: () => void;
  toggleFullscreen: () => void;
  setSnapToGrid: (snap: boolean) => void;
  setGridSize: (size: number) => void;

  // Phase 9.4: Debug session state (ephemeral, render-time decorations)
  debug: DebugSessionState;
  startDebugSession: (startNodeId?: string | null) => void;
  stopDebugSession: () => void;
  resetDebugSession: () => void;
  setDebugActiveNodeId: (nodeId: string | null) => void;
  markNodeExecuted: (nodeId: string) => void;
  markNodesExecuted: (nodeIds: string[]) => void;

  // History
  canUndo: boolean;
  canRedo: boolean;

  // Unsaved changes
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;

  // Config panel context (Phase E.1): eliminate prop drilling for panel-specific data
  tenantLists: Array<{ id: string; name: string }>;
  availableFields: Array<{ key: string; label: string; type: string }>;
  currentNodeId: string | null;
}

// ============================================================================
// CONTEXT
// ============================================================================

const FlowEditorContext = createContext<FlowEditorContextValue | undefined>(undefined);

// ============================================================================
// PROVIDER PROPS
// ============================================================================

export interface FlowEditorProviderProps {
  children: ReactNode;
  initialMode?: EditorMode;
  onModeChange?: (mode: EditorMode) => void;
  onSelectionChange?: (node: Node | null, edge: Edge | null) => void;

  // Config panel context
  tenantLists?: Array<{ id: string; name: string }>;
  availableFields?: Array<{ key: string; label: string; type: string }>;
  currentNodeId?: string | null;
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export const FlowEditorProvider: React.FC<FlowEditorProviderProps> = ({
  children,
  initialMode = 'visual',
  onModeChange,
  onSelectionChange,
  tenantLists = [],
  availableFields = [],
  currentNodeId = null,
}) => {
  // ---------------------------------------------------------------------------
  // SELECTION STATE
  // ---------------------------------------------------------------------------
  
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  
  const selectNode = useCallback((node: Node | null) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    onSelectionChange?.(node, null);
  }, [onSelectionChange]);
  
  const selectEdge = useCallback((edge: Edge | null) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    onSelectionChange?.(null, edge);
  }, [onSelectionChange]);
  
  const clearSelection = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
    onSelectionChange?.(null, null);
  }, [onSelectionChange]);
  
  // ---------------------------------------------------------------------------
  // EDITOR MODE
  // ---------------------------------------------------------------------------
  
  const [mode, setModeInternal] = useState<EditorMode>(() => {
    // Try to restore from localStorage
    const stored = localStorage.getItem('flow_editor_mode');
    if (stored === 'wizard' || stored === 'visual' || stored === 'expert') {
      return stored;
    }
    return initialMode;
  });
  
  const setMode = useCallback((newMode: EditorMode) => {
    setModeInternal(newMode);
    localStorage.setItem('flow_editor_mode', newMode);
    onModeChange?.(newMode);
  }, [onModeChange]);
  
  // ---------------------------------------------------------------------------
  // MODAL STATE
  // ---------------------------------------------------------------------------
  
  const [modals, setModals] = useState<Record<ModalType, ModalState>>({
    formStep: { type: 'formStep', isOpen: false, node: null },
    formField: { type: 'formField', isOpen: false, node: null },
    section: { type: 'section', isOpen: false, node: null },
    document: { type: 'document', isOpen: false, node: null },
    createRecord: { type: 'createRecord', isOpen: false, node: null },
    formReference: { type: 'formReference', isOpen: false, node: null },
    container: { type: 'container', isOpen: false, node: null },
    settings: { type: 'settings', isOpen: false, node: null },
  });
  
  const openModal = useCallback((type: ModalType, node?: Node) => {
    setModals(prev => ({
      ...prev,
      [type]: { type, isOpen: true, node: node || null },
    }));
  }, []);
  
  const closeModal = useCallback((type: ModalType) => {
    setModals(prev => ({
      ...prev,
      [type]: { ...prev[type], isOpen: false },
    }));
  }, []);
  
  const closeAllModals = useCallback(() => {
    setModals({
      formStep: { type: 'formStep', isOpen: false, node: null },
      formField: { type: 'formField', isOpen: false, node: null },
      section: { type: 'section', isOpen: false, node: null },
      document: { type: 'document', isOpen: false, node: null },
      createRecord: { type: 'createRecord', isOpen: false, node: null },
      formReference: { type: 'formReference', isOpen: false, node: null },
      container: { type: 'container', isOpen: false, node: null },
      settings: { type: 'settings', isOpen: false, node: null },
    });
  }, []);
  
  const isModalOpen = useCallback((type: ModalType) => {
    return modals[type].isOpen;
  }, [modals]);
  
  // ---------------------------------------------------------------------------
  // UI SETTINGS
  // ---------------------------------------------------------------------------
  
  const [ui, setUI] = useState<UISettings>(() => ({
    isPaletteVisible: true,
    isPreviewVisible: false,
    isMinimapVisible: true,
    isFullscreen: (() => {
      const stored = localStorage.getItem('flow_editor_fullscreen');
      return stored === 'true';
    })(),
    snapToGrid: true,
    gridSize: 15,
  }));
  
  const togglePalette = useCallback(() => {
    setUI(prev => ({ ...prev, isPaletteVisible: !prev.isPaletteVisible }));
  }, []);
  
  const togglePreview = useCallback(() => {
    setUI(prev => ({ ...prev, isPreviewVisible: !prev.isPreviewVisible }));
  }, []);
  
  const toggleMinimap = useCallback(() => {
    setUI(prev => ({ ...prev, isMinimapVisible: !prev.isMinimapVisible }));
  }, []);
  
  const toggleFullscreen = useCallback(() => {
    setUI(prev => {
      const newFullscreen = !prev.isFullscreen;
      localStorage.setItem('flow_editor_fullscreen', String(newFullscreen));
      return { ...prev, isFullscreen: newFullscreen };
    });
  }, []);
  
  const setSnapToGrid = useCallback((snap: boolean) => {
    setUI(prev => ({ ...prev, snapToGrid: snap }));
  }, []);
  
  const setGridSize = useCallback((size: number) => {
    setUI(prev => ({ ...prev, gridSize: size }));
  }, []);
  
  // ---------------------------------------------------------------------------
  // PHASE 9.4: DEBUG SESSION STATE
  // ---------------------------------------------------------------------------

  const [debug, setDebug] = useState<DebugSessionState>({
    isActive: false,
    activeNodeId: null,
    previousNodeId: null,
    executedNodeIds: [],
  });

  const startDebugSession = useCallback((startNodeId?: string | null) => {
    setDebug({
      isActive: true,
      activeNodeId: startNodeId ?? null,
      previousNodeId: null,
      executedNodeIds: [],
    });
  }, []);

  const stopDebugSession = useCallback(() => {
    setDebug({
      isActive: false,
      activeNodeId: null,
      previousNodeId: null,
      executedNodeIds: [],
    });
  }, []);

  const resetDebugSession = useCallback(() => {
    setDebug((prev) => ({
      ...prev,
      previousNodeId: null,
      executedNodeIds: [],
    }));
  }, []);

  const setDebugActiveNodeId = useCallback((nodeId: string | null) => {
    setDebug((prev) => ({
      ...prev,
      previousNodeId: prev.activeNodeId,
      activeNodeId: nodeId,
    }));
  }, []);

  const markNodeExecuted = useCallback((nodeId: string) => {
    setDebug((prev) => {
      if (prev.executedNodeIds.includes(nodeId)) return prev;
      return { ...prev, executedNodeIds: [...prev.executedNodeIds, nodeId] };
    });
  }, []);

  const markNodesExecuted = useCallback((nodeIds: string[]) => {
    setDebug((prev) => {
      if (nodeIds.length === 0) return prev;
      const merged = new Set(prev.executedNodeIds);
      nodeIds.forEach((id) => merged.add(id));
      return { ...prev, executedNodeIds: Array.from(merged) };
    });
  }, []);

  // ---------------------------------------------------------------------------
  // HISTORY (Placeholder - actual history managed by UnifiedFlowEditor)
  // ---------------------------------------------------------------------------

  const [canUndo] = useState(false);
  const [canRedo] = useState(false);

  // ---------------------------------------------------------------------------
  // UNSAVED CHANGES
  // ---------------------------------------------------------------------------

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // ---------------------------------------------------------------------------
  // CONTEXT VALUE
  // ---------------------------------------------------------------------------
  
  const value: FlowEditorContextValue = {
    // Selection
    selectedNode,
    selectedEdge,
    selectNode,
    selectEdge,
    clearSelection,

    // Mode
    mode,
    setMode,

    // Modals
    modals,
    openModal,
    closeModal,
    closeAllModals,
    isModalOpen,

    // UI
    ui,
    togglePalette,
    togglePreview,
    toggleMinimap,
    toggleFullscreen,
    setSnapToGrid,
    setGridSize,

    // Phase 9.4 Debug
    debug,
    startDebugSession,
    stopDebugSession,
    resetDebugSession,
    setDebugActiveNodeId,
    markNodeExecuted,
    markNodesExecuted,

    // History
    canUndo,
    canRedo,

    // Unsaved changes
    hasUnsavedChanges,
    setHasUnsavedChanges,

    // Config panel context
    tenantLists,
    availableFields,
    currentNodeId,
  };
  
  return (
    <FlowEditorContext.Provider value={value}>
      {children}
    </FlowEditorContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to access FlowEditor context
 * 
 * @throws Error if used outside FlowEditorProvider
 * 
 * @example
 * ```typescript
 * const { selectedNode, selectNode, openModal } = useFlowEditor();
 * 
 * // Select a node
 * selectNode(node);
 * 
 * // Open a modal
 * openModal('formStep', node);
 * 
 * // Check if modal is open
 * if (isModalOpen('settings')) { ... }
 * ```
 */
export function useFlowEditor(): FlowEditorContextValue {
  const context = useContext(FlowEditorContext);
  
  if (!context) {
    throw new Error('useFlowEditor must be used within FlowEditorProvider');
  }
  
  return context;
}

// ============================================================================
// EXPORT
// ============================================================================

export default FlowEditorContext;
