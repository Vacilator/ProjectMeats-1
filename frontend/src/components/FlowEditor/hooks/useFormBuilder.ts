/**
 * Use Form Builder Hook
 * 
 * Hook to manage FormBuilder modal state and integration with flow nodes.
 * Handles opening, closing, and saving form data to node configuration.
 * 
 * Created: 2026-02-21
 * Phase: 6 - Deep Integration
 */

import { useState, useCallback } from 'react';
import { Node, useReactFlow } from '@xyflow/react';
import { useFormBuilderStore } from '../../form-builder/store';

/**
 * Hook return type
 */
interface UseFormBuilderReturn {
  /** Whether FormBuilder modal is open */
  isOpen: boolean;
  /** Currently editing node ID */
  editingNodeId: string | null;
  /** Open FormBuilder for a node */
  openFormBuilder: (node: Node) => void;
  /** Close FormBuilder */
  closeFormBuilder: () => void;
  /** Save FormBuilder data to node */
  saveFormBuilder: (formData: any) => void;
}

/**
 * Hook to manage FormBuilder integration
 */
export function useFormBuilder(): UseFormBuilderReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const { setNodes, getNode } = useReactFlow();
  const { loadForm, resetForm } = useFormBuilderStore();
  
  /**
   * Open FormBuilder for a node
   */
  const openFormBuilder = useCallback((node: Node) => {
    // Load existing form data if present
    if (node.data?.formData) {
      loadForm(node.data.formData);
    } else {
      // Initialize with node name
      resetForm();
      loadForm({
        name: node.data?.label || node.data?.name || 'Untitled Form',
        description: node.data?.description || '',
        steps: []
      });
    }
    
    setEditingNodeId(node.id);
    setIsOpen(true);
  }, [loadForm, resetForm]);
  
  /**
   * Close FormBuilder
   */
  const closeFormBuilder = useCallback(() => {
    setIsOpen(false);
    setEditingNodeId(null);
  }, []);
  
  /**
   * Save FormBuilder data to node
   */
  const saveFormBuilder = useCallback((formData: any) => {
    if (!editingNodeId) return;
    
    const node = getNode(editingNodeId);
    if (!node) return;
    
    // Update node with form data
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id === editingNodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              formData,
              // Update label from form name
              label: formData.name || n.data.label,
              // Store summary for quick reference
              fieldCount: formData.steps?.reduce(
                (sum: number, step: any) => sum + (step.fields?.length || 0),
                0
              ) || 0,
              stepCount: formData.steps?.length || 0
            }
          };
        }
        return n;
      })
    );
    
    closeFormBuilder();
  }, [editingNodeId, getNode, setNodes, closeFormBuilder]);
  
  return {
    isOpen,
    editingNodeId,
    openFormBuilder,
    closeFormBuilder,
    saveFormBuilder
  };
}
