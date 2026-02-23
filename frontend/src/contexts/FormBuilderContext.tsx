/**
 * FormBuilder Integration Context
 * 
 * Provides type-safe integration between React Flow editor and FormBuilder modal.
 * Replaces fragile window.dispatchEvent pattern with proper React context.
 * 
 * Created: 2026-02-21
 * Phase: Comprehensive Enhancements
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface FormBuilderModalState {
  /** Whether modal is open */
  isOpen: boolean;
  
  /** Node ID being edited */
  nodeId: string | null;
  
  /** Node data (form configuration) */
  nodeData: any | null;
  
  /** Node type (form, formProcessGroup, etc.) */
  nodeType: 'form' | 'formProcessGroup' | string | null;
  
  /** Form ID (if editing existing form) */
  formId?: string | null;
}

export interface FormBuilderActions {
  /** Open FormBuilder for a node */
  openFormBuilder: (params: {
    nodeId: string;
    nodeData: any;
    nodeType: 'form' | 'formProcessGroup' | string;
    formId?: string;
  }) => void;
  
  /** Close FormBuilder */
  closeFormBuilder: () => void;
  
  /** Update node data from FormBuilder */
  updateNodeData: (nodeId: string, updates: any) => void;
  
  /** Check if FormBuilder is open for specific node */
  isEditingNode: (nodeId: string) => boolean;
}

export interface FormBuilderContextValue extends FormBuilderModalState, FormBuilderActions {}

// ============================================================================
// Context
// ============================================================================

const FormBuilderContext = createContext<FormBuilderContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface FormBuilderProviderProps {
  children: ReactNode;
  
  /** Callback when node data is updated from FormBuilder */
  onNodeDataUpdate?: (nodeId: string, updates: any) => void;
}

export const FormBuilderProvider: React.FC<FormBuilderProviderProps> = ({
  children,
  onNodeDataUpdate,
}) => {
  const [state, setState] = useState<FormBuilderModalState>({
    isOpen: false,
    nodeId: null,
    nodeData: null,
    nodeType: null,
    formId: null,
  });

  const openFormBuilder = useCallback((params: {
    nodeId: string;
    nodeData: any;
    nodeType: 'form' | 'formProcessGroup' | string;
    formId?: string;
  }) => {
    console.log('[FormBuilderContext] Opening FormBuilder:', params);
    
    setState({
      isOpen: true,
      nodeId: params.nodeId,
      nodeData: params.nodeData,
      nodeType: params.nodeType,
      formId: params.formId,
    });
  }, []);

  const closeFormBuilder = useCallback(() => {
    console.log('[FormBuilderContext] Closing FormBuilder');
    
    setState({
      isOpen: false,
      nodeId: null,
      nodeData: null,
      nodeType: null,
      formId: null,
    });
  }, []);

  const updateNodeData = useCallback((nodeId: string, updates: any) => {
    console.log('[FormBuilderContext] Updating node data:', { nodeId, updates });
    
    // Update internal state
    setState(prev => ({
      ...prev,
      nodeData: prev.nodeId === nodeId ? { ...prev.nodeData, ...updates } : prev.nodeData,
    }));
    
    // Notify parent (UnifiedFlowEditor) to update React Flow nodes
    if (onNodeDataUpdate) {
      onNodeDataUpdate(nodeId, updates);
    }
  }, [onNodeDataUpdate]);

  const isEditingNode = useCallback((nodeId: string) => {
    return state.isOpen && state.nodeId === nodeId;
  }, [state.isOpen, state.nodeId]);

  const value: FormBuilderContextValue = {
    // State
    isOpen: state.isOpen,
    nodeId: state.nodeId,
    nodeData: state.nodeData,
    nodeType: state.nodeType,
    formId: state.formId,
    
    // Actions
    openFormBuilder,
    closeFormBuilder,
    updateNodeData,
    isEditingNode,
  };

  return (
    <FormBuilderContext.Provider value={value}>
      {children}
    </FormBuilderContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access FormBuilder integration context.
 * 
 * @example
 * ```tsx
 * const { openFormBuilder, closeFormBuilder, isOpen, nodeData } = useFormBuilderContext();
 * 
 * // Open FormBuilder
 * openFormBuilder({ nodeId, nodeData, nodeType: 'form' });
 * 
 * // Close FormBuilder
 * closeFormBuilder();
 * ```
 */
export const useFormBuilderContext = (): FormBuilderContextValue => {
  const context = useContext(FormBuilderContext);
  
  if (!context) {
    throw new Error(
      'useFormBuilderContext must be used within FormBuilderProvider. ' +
      'Wrap your component tree with <FormBuilderProvider>.'
    );
  }
  
  return context;
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if FormBuilder is currently editing a form node.
 */
export const isEditingFormNode = (state: FormBuilderModalState): boolean => {
  return state.isOpen && state.nodeType === 'form';
};

/**
 * Check if FormBuilder is currently editing a form process group.
 */
export const isEditingFormProcessGroup = (state: FormBuilderModalState): boolean => {
  return state.isOpen && state.nodeType === 'formProcessGroup';
};

// ============================================================================
// Exports
// ============================================================================

export default FormBuilderContext;
