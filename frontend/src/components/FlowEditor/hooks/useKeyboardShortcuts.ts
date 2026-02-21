/**
 * useKeyboardShortcuts Hook
 * 
 * Comprehensive keyboard shortcut system for FlowEditor.
 * Provides industry-standard shortcuts for common operations.
 * 
 * Features:
 * - Undo/Redo (Ctrl+Z / Ctrl+Y)
 * - Delete (Del / Backspace)
 * - Select All (Ctrl+A)
 * - Copy/Paste (Ctrl+C / Ctrl+V)
 * - Duplicate (Ctrl+D)
 * - Layout (Ctrl+L)
 * - Save (Ctrl+S)
 * - Search (Ctrl+F)
 * 
 * Created: 2026-02-21 - Phase 2: UI/UX Enhancements
 */

import { useEffect, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Node, Edge, useReactFlow } from '@xyflow/react';

export interface KeyboardShortcutsOptions {
  /** Enable undo/redo shortcuts */
  enableHistory?: boolean;
  /** Enable delete shortcuts */
  enableDelete?: boolean;
  /** Enable copy/paste shortcuts */
  enableClipboard?: boolean;
  /** Enable layout shortcuts */
  enableLayout?: boolean;
  /** Enable save shortcut */
  enableSave?: boolean;
  /** Custom handlers */
  onUndo?: () => void;
  onRedo?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onDuplicate?: () => void;
  onLayout?: () => void;
  onSave?: () => void;
  onSearch?: () => void;
}

/**
 * Hook for managing keyboard shortcuts in FlowEditor
 */
export const useKeyboardShortcuts = (options: KeyboardShortcutsOptions = {}) => {
  const {
    enableHistory = true,
    enableDelete = true,
    enableClipboard = true,
    enableLayout = true,
    enableSave = true,
    onUndo,
    onRedo,
    onDelete,
    onCopy,
    onPaste,
    onDuplicate,
    onLayout,
    onSave,
    onSearch,
  } = options;

  const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();

  /**
   * Check if user is typing in an input field
   */
  const isTyping = useCallback(() => {
    const activeElement = document.activeElement;
    const tagName = activeElement?.tagName.toLowerCase();
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      activeElement?.getAttribute('contenteditable') === 'true'
    );
  }, []);

  /**
   * Undo - Ctrl+Z
   */
  useHotkeys(
    'ctrl+z, meta+z',
    (e) => {
      if (isTyping()) return;
      e.preventDefault();
      onUndo?.();
    },
    {
      enabled: enableHistory,
      enableOnFormTags: false,
    },
    [onUndo, isTyping]
  );

  /**
   * Redo - Ctrl+Y or Ctrl+Shift+Z
   */
  useHotkeys(
    'ctrl+y, meta+y, ctrl+shift+z, meta+shift+z',
    (e) => {
      if (isTyping()) return;
      e.preventDefault();
      onRedo?.();
    },
    {
      enabled: enableHistory,
      enableOnFormTags: false,
    },
    [onRedo, isTyping]
  );

  /**
   * Delete - Del or Backspace
   */
  useHotkeys(
    'delete, backspace',
    (e) => {
      if (isTyping()) return;
      e.preventDefault();
      
      if (onDelete) {
        onDelete();
      } else {
        // Default: delete selected nodes and edges
        const nodes = getNodes();
        const edges = getEdges();
        
        const selectedNodeIds = nodes
          .filter((n) => n.selected)
          .map((n) => n.id);
        
        if (selectedNodeIds.length > 0) {
          setNodes((nds) => nds.filter((n) => !n.selected));
          setEdges((eds) =>
            eds.filter(
              (e) =>
                !selectedNodeIds.includes(e.source) &&
                !selectedNodeIds.includes(e.target)
            )
          );
        } else {
          // Delete selected edges
          setEdges((eds) => eds.filter((e) => !e.selected));
        }
      }
    },
    {
      enabled: enableDelete,
      enableOnFormTags: false,
    },
    [onDelete, getNodes, getEdges, setNodes, setEdges, isTyping]
  );

  /**
   * Copy - Ctrl+C
   */
  useHotkeys(
    'ctrl+c, meta+c',
    (e) => {
      if (isTyping()) return;
      e.preventDefault();
      onCopy?.();
    },
    {
      enabled: enableClipboard,
      enableOnFormTags: false,
    },
    [onCopy, isTyping]
  );

  /**
   * Paste - Ctrl+V
   */
  useHotkeys(
    'ctrl+v, meta+v',
    (e) => {
      if (isTyping()) return;
      e.preventDefault();
      onPaste?.();
    },
    {
      enabled: enableClipboard,
      enableOnFormTags: false,
    },
    [onPaste, isTyping]
  );

  /**
   * Duplicate - Ctrl+D
   */
  useHotkeys(
    'ctrl+d, meta+d',
    (e) => {
      if (isTyping()) return;
      e.preventDefault();
      
      if (onDuplicate) {
        onDuplicate();
      } else {
        // Default: duplicate selected nodes
        const nodes = getNodes();
        const selectedNodes = nodes.filter((n) => n.selected);
        
        if (selectedNodes.length > 0) {
          const duplicates = selectedNodes.map((node) => ({
            ...node,
            id: `${node.id}-copy-${Date.now()}`,
            position: {
              x: node.position.x + 50,
              y: node.position.y + 50,
            },
            selected: false,
          }));
          
          setNodes((nds) => [
            ...nds.map((n) => ({ ...n, selected: false })),
            ...duplicates.map((d) => ({ ...d, selected: true })),
          ]);
        }
      }
    },
    {
      enabled: enableClipboard,
      enableOnFormTags: false,
    },
    [onDuplicate, getNodes, setNodes, isTyping]
  );

  /**
   * Auto-layout - Ctrl+L
   */
  useHotkeys(
    'ctrl+l, meta+l',
    (e) => {
      if (isTyping()) return;
      e.preventDefault();
      onLayout?.();
    },
    {
      enabled: enableLayout,
      enableOnFormTags: false,
    },
    [onLayout, isTyping]
  );

  /**
   * Save - Ctrl+S
   */
  useHotkeys(
    'ctrl+s, meta+s',
    (e) => {
      if (isTyping()) return;
      e.preventDefault();
      onSave?.();
    },
    {
      enabled: enableSave,
      enableOnFormTags: false,
    },
    [onSave, isTyping]
  );

  /**
   * Search - Ctrl+F
   */
  useHotkeys(
    'ctrl+f, meta+f',
    (e) => {
      if (isTyping()) return;
      e.preventDefault();
      onSearch?.();
    },
    {
      enableOnFormTags: false,
    },
    [onSearch, isTyping]
  );

  /**
   * Select All - Ctrl+A
   */
  useHotkeys(
    'ctrl+a, meta+a',
    (e) => {
      if (isTyping()) return;
      e.preventDefault();
      setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
      setEdges((eds) => eds.map((e) => ({ ...e, selected: true })));
    },
    {
      enableOnFormTags: false,
    },
    [setNodes, setEdges, isTyping]
  );

  /**
   * Escape - Clear selection and close panels
   */
  useHotkeys(
    'escape',
    () => {
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
      setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
    },
    {
      enableOnFormTags: false,
    },
    [setNodes, setEdges]
  );
};
