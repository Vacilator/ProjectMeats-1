/**
 * Form Process Group Node Component
 * 
 * Implements React Flow's labeled group + parent-child pattern for multi-step forms.
 * This is the IDEAL container implementation using React Flow's native grouping.
 * 
 * Architecture:
 * - Uses type: 'formProcessGroup' (registered in nodeTypes)
 * - Children have parentId pointing to this group's ID
 * - Children have extent: 'parent' for containment
 * - Group has isGroup: true for React Flow grouping behavior
 * - Resizable container with labeled header
 * - Vertical auto-layout for children
 * - Schema-driven configuration via DynamicConfigPanel
 * 
 * References:
 * - https://reactflow.dev/examples/nodes/draggable-subflow
 * - https://reactflow.dev/examples/layout/sub-flows
 * 
 * Created: 2026-02-19 - Phase E.3
 * 
 * @module FormProcessGroupNode
 */

import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { logger } from '@/utils/logger';

import styled from 'styled-components';
import { Handle, Position, NodeProps, Node, Edge, useReactFlow, useNodes, useEdges } from '@xyflow/react';
import type { BaseNodeData } from './BaseNode';
import { ChevronDown, ChevronRight, Plus, Settings, Save, Check } from 'lucide-react';
import { calculateChildXPosition } from './FormProcessChildWrapper';
import { saveFormProcessGroup } from '../../../services/tenantFormService';
import toast from 'react-hot-toast';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Data structure for Form Process Group Node
 * Extends BaseNodeData with group-specific properties
 */
export interface FormProcessGroupData extends BaseNodeData {
  /** Display name of the form process */
  containerName?: string;
  /** Description of the form process */
  containerDescription?: string;
  /** Whether the group is visually expanded to show children */
  isExpanded?: boolean;
  /** Show progress indicator in runtime */
  showProgressIndicator?: boolean;
  /** Allow users to navigate back to previous steps */
  allowBackNavigation?: boolean;
  /** Allow users to skip optional steps */
  allowSkipSteps?: boolean;
  /** Reference to tenant form */
  tenantFormId?: string;
  /** Reference to tenant workform */
  tenantWorkFormId?: string;
  /** Group flag for React Flow */
  isGroup?: boolean;
  /** Drop target indicator (Phase 3) */
  isDropTarget?: boolean;
  /** Sequential execution order enabled (Phase 3) */
  sequentialExecution?: boolean;
  /** Stable horizontal ordering for page nodes (computed, additive-only) */
  pageOrder?: string[];
  /** Edit handler from UnifiedFlowEditor */
  onEdit?: () => void;
  /** Delete handler from UnifiedFlowEditor */
  onDelete?: () => void;
}

export interface FormProcessGroupNodeProps extends NodeProps<FormProcessGroupData> {}

// ============================================================================
// Styled Components
// ============================================================================

/**
 * Global keyframes animation for spinner
 */
const spinAnimation = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

/**
 * Container wrapper with group styling
 * Adapts size based on expanded/collapsed state
 * Phase 3: Added drop zone indicator
 */
const GroupContainer = styled.div<{ isExpanded: boolean; isDropTarget?: boolean }>`
  ${spinAnimation}

  /* Removed min-width/min-height - sizing is now controlled directly via React Flow style prop */
  width: 100%;
  height: 100%;

  background: ${(props) =>
    props.isDropTarget
      ? 'rgba(var(--color-primary), 0.15)'
      : props.isExpanded
        ? 'rgba(var(--color-primary), 0.03)'
        : 'rgb(var(--color-background-secondary))'};

  border-width: 2px;
  border-style: ${(props) => (props.isExpanded ? 'dashed' : 'solid')};
  border-color: ${(props) =>
    props.isDropTarget ? 'rgba(var(--color-primary), 0.8)' : 'rgba(var(--color-primary), 0.5)'};
  border-radius: 12px;
  overflow: ${(props) => (props.isExpanded ? 'visible' : 'hidden')};
  position: relative;

  box-shadow: ${(props) => {
    if (!props.isExpanded) return 'none';
    return props.isDropTarget
      ? '0 8px 24px rgba(var(--color-primary), 0.3), 0 0 0 6px rgba(var(--color-primary), 0.2)'
      : '0 4px 12px rgba(0, 0, 0, 0.1), 0 0 0 4px rgba(var(--color-primary), 0.1)';
  }};

  &:hover {
    box-shadow: ${(props) => {
      if (!props.isExpanded) return 'none';
      return '0 6px 16px rgba(0, 0, 0, 0.15), 0 0 0 4px rgba(var(--color-primary), 0.2)';
    }};
  }

  /* ONLY transition colors/shadows, NEVER dimensions */
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;

  /* Group label indicator */
  ${(props) =>
    props.isExpanded &&
    `
    &::after {
      content: '${props.isDropTarget ? 'DROP HERE TO ADD' : 'FORM PROCESS GROUP'}';
      position: absolute;
      top: 12px;
      right: 16px;
      font-size: 10px;
      font-weight: 600;
      color: rgba(var(--color-primary), 0.4);
      text-transform: uppercase;
      letter-spacing: 1px;
      pointer-events: none;
      user-select: none;
    }
  `}
`;

/**
 * Labeled header with step count and controls
 */
const GroupHeader = styled.div<{ isExpanded: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: ${props => props.isExpanded 
    ? 'rgba(139, 92, 246, 0.08)' 
    : 'rgba(139, 92, 246, 0.12)'};
  border-bottom: 1px solid rgba(139, 92, 246, 0.2);
  cursor: pointer;
  user-select: none;
  
  &:hover {
    background: rgba(139, 92, 246, 0.15);
  }
  
  transition: background 0.2s ease;
`;

const ExpandIcon = styled.div<{ isExpanded: boolean }>`
  display: flex;
  align-items: center;
  color: rgba(139, 92, 246, 0.7);
  transition: transform 0.2s ease;
  flex-shrink: 0;
`;

const GroupTitle = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const GroupName = styled.div`
  font-weight: 600;
  font-size: 15px;
  color: rgb(var(--color-text-primary));
`;

const GroupMeta = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  display: flex;
  align-items: center;
  gap: 12px;
`;

const StepCount = styled.span<{ hasSteps: boolean }>`
  font-weight: 500;
  color: ${props => props.hasSteps 
    ? 'rgba(139, 92, 246, 0.9)' 
    : 'rgb(var(--color-text-tertiary))'};
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
`;

const IconButton = styled.button<{ variant?: 'primary' | 'default'; isSaving?: boolean }>`
  padding: 6px;
  background: ${props => {
    if (props.variant === 'primary') return 'rgba(139, 92, 246, 0.15)';
    return 'transparent';
  }};
  border: none;
  border-radius: var(--radius-sm);
  color: ${props => 
    props.variant === 'primary' 
      ? 'rgba(139, 92, 246, 0.9)' 
      : 'rgb(var(--color-text-secondary))'
  };
  cursor: ${props => props.isSaving ? 'wait' : 'pointer'};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.15s ease;
  font-size: 12px;
  font-weight: 500;
  opacity: ${props => props.isSaving ? 0.6 : 1};
  
  &:hover {
    background: rgba(139, 92, 246, 0.15);
    color: rgba(139, 92, 246, 0.9);
  }
  
  &:active {
    transform: ${props => props.isSaving ? 'none' : 'scale(0.95)'};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const GroupBody = styled.div<{ isExpanded: boolean }>`
  /* Switch to horizontal track layout for "Book and Pages" paradigm */
  display: ${(props) => (props.isExpanded ? 'flex' : 'none')};
  flex-direction: row;
  align-items: flex-start;
  padding: 20px;
  gap: 40px;
  height: 100%;
  position: relative;
`;

/**
 * Empty state message
 */
const EmptyState = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: rgb(var(--color-text-tertiary));
  font-size: 14px;
  pointer-events: none;
  user-select: none;
  
  svg {
    margin-bottom: 8px;
    opacity: 0.3;
  }
`;

/**
 * Collapsed preview of steps
 */
const CollapsedStepList = styled.div`
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
`;

const StepPreview = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  padding: 6px 8px;
  background: rgba(139, 92, 246, 0.05);
  border-radius: var(--radius-sm);
  border-left: 2px solid rgba(139, 92, 246, 0.3);
`;

/**
 * Sequential execution indicator (Phase 3)
 */
const SequentialIndicator = styled.div<{ enabled: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: ${props => props.enabled 
    ? 'rgba(34, 197, 94, 0.1)' 
    : 'rgba(148, 163, 184, 0.1)'};
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  color: ${props => props.enabled 
    ? 'rgb(34, 197, 94)' 
    : 'rgb(148, 163, 184)'};
  
  svg {
    width: 14px;
    height: 14px;
  }
`;

/**
 * Drop zone overlay (Phase 3)
 */
const DropZoneOverlay = styled.div<{ show: boolean }>`
  position: absolute;
  inset: 0;
  display: ${props => props.show ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  background: rgba(139, 92, 246, 0.1);
  border: 3px dashed rgba(139, 92, 246, 0.5);
  border-radius: 12px;
  pointer-events: none;
  z-index: 10;
  animation: pulse 2s ease-in-out infinite;
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
`;

const DropZoneText = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: rgba(139, 92, 246, 0.9);
  text-align: center;
  padding: 20px;
  background: rgb(var(--color-surface));
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
`;

const VirtualHandle = styled(Handle)<{ $side: 'in' | 'out' }>`
  width: 10px;
  height: 10px;
  border-radius: 4px;
  border: 2px solid rgb(var(--color-surface));
  background: ${(p) => (p.$side === 'in' ? 'rgb(var(--color-primary))' : 'rgb(var(--color-success))')};
  z-index: 30;
`;


// ============================================================================
// Component
// ============================================================================

/**
 * Form Process Group Node
 * 
 * Labeled group container following React Flow's parent-child pattern.
 * Children are positioned with parentId and extent: 'parent'.
 * 
 * @param props - Node props from React Flow
 */
export const FormProcessGroupNode = React.memo<FormProcessGroupNodeProps>((props) => {
  const { id, data } = props;
  const { setNodes, setEdges, updateNodeInternals } = useReactFlow();
  const allNodes = useNodes();
  const allEdges = useEdges();
  
  // Local state for save operations
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Debug logging
  logger.debug('[FormProcessGroup] Rendered with ID:', id, 'Data:', data);
  
  // ============================================================================
  // Derived State
  // ============================================================================
  
  /**
   * Find all child nodes with parentId matching this group's ID
   */
  const childNodes = useMemo(() => {
    const children = allNodes.filter((node) => {
      const anyNode = node as any;
      return (
        anyNode.parentId === id ||
        anyNode.parentNode === id ||
        (node.data as any)?.parentId === id ||
        (node.data as any)?.parentNode === id
      );
    });
    logger.debug('[FormProcessGroup] Children found:', children.length, 'IDs:', children.map((c) => c.id));
    return children;
  }, [allNodes, id]);
  
  const isPageNodeType = (type?: string) =>
    type === 'form' || type === 'formStepSingle' || type === 'formStep' || type === 'formReference';

  const pageNodes = useMemo(() => childNodes.filter((n) => isPageNodeType(n.type)), [childNodes]);
  const pageCount = pageNodes.length;

  const stepCount = childNodes.length;
  const containerName = data.containerName || 'Untitled Form Process';
  const containerDescription = data.containerDescription;
  const isExpanded = data.isExpanded ?? false;

  // Keep React Flow internals in sync when toggling expanded/collapsed state.
  useEffect(() => {
    requestAnimationFrame(() => updateNodeInternals(id));
  }, [id, isExpanded, updateNodeInternals]);
  const isDropTarget = data.isDropTarget ?? false; // Phase 3: Drop zone indicator
  const sequentialExecution = data.sequentialExecution ?? true; // Phase 3: Sequential by default

  const collapsedVirtualHandles = useMemo(() => {
    if (isExpanded) return { incoming: [] as string[], outgoing: [] as string[] };

    const childIdSet = new Set(childNodes.map((n) => n.id));

    const incomingIds = new Set<string>();
    const outgoingIds = new Set<string>();

    allEdges.forEach((e) => {
      const sourceIsChild = childIdSet.has(e.source);
      const targetIsChild = childIdSet.has(e.target);

      // Only care about edges crossing the container boundary.
      if (sourceIsChild && !targetIsChild) outgoingIds.add(e.source);
      if (targetIsChild && !sourceIsChild) incomingIds.add(e.target);
    });

    const orderedChildren = [...childNodes].sort(
      (a, b) => (a.position?.y || 0) - (b.position?.y || 0) || (a.position?.x || 0) - (b.position?.x || 0)
    );

    return {
      incoming: orderedChildren.filter((c) => incomingIds.has(c.id)).map((c) => c.id),
      outgoing: orderedChildren.filter((c) => outgoingIds.has(c.id)).map((c) => c.id),
    };
  }, [allEdges, childNodes, isExpanded]);
  
  logger.debug(`[FormProcessGroup] ${id} rendered with ${stepCount} steps (expanded: ${isExpanded})`);

  
  // ============================================================================
  // Event Handlers
  // ============================================================================
  
  /**
   * Toggle expand/collapse state
   * When collapsed, children are hidden but not removed
   */
  const handleToggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const nextExpanded = !isExpanded;

    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === id) {
          // Default expanded size; a separate effect will auto-fit to children.
          const expandedWidth = Math.max(600, stepCount * 350 + 100);
          return {
            ...node,
            style: {
              ...(node.style || {}),
              width: nextExpanded ? expandedWidth : 320,
              height: nextExpanded ? 320 : 80,
            },
            data: {
              ...node.data,
              isExpanded: nextExpanded,
            },
          };
        }

        // Hide/show children
        if ((node as any).parentId === id || (node as any).parentNode === id) {
          return {
            ...node,
            hidden: !nextExpanded,
          };
        }

        return node;
      })
    );

    requestAnimationFrame(() => {
      if (typeof updateNodeInternals === 'function') {
        updateNodeInternals(id);
      }
    });
  }, [id, isExpanded, setNodes, stepCount, updateNodeInternals]);
  
  /**
   * Save FormProcessGroup as TenantForm to backend
   * Persists form definition and increments version
   */
  const handleSave = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (isSaving) return;
    
    // Validate: Must have at least one form/page step
    if (pageNodes.length === 0) {
      toast.error('Cannot save: Form must have at least one step');
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Find the current node object
      const currentNode = allNodes.find(n => n.id === id);
      if (!currentNode) {
        throw new Error('Node not found');
      }
      
      logger.debug('[FormProcessGroup] Saving to backend:', id);
      
      const result = await saveFormProcessGroup(currentNode, allNodes, allEdges);
      
      logger.debug('[FormProcessGroup] Saved successfully:', result);
      
      // Update node data with tenantFormId and version
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              data: {
                ...node.data,
                tenantFormId: result.tenantFormId,
                version: result.version,
              },
            };
          }
          return node;
        })
      );
      
      setLastSaved(new Date());

      if (typeof data.onSave === 'function') {
        data.onSave();
      }

      toast.success(
        result.created 
          ? `Form saved successfully (v${result.version})` 
          : `Form updated to v${result.version}`,
        { duration: 3000 }
      );
      
    } catch (error: any) {
      logger.error('[FormProcessGroup] Save failed:', error);
      toast.error(`Save failed: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [id, isSaving, pageNodes.length, allNodes, allEdges, setNodes, data]);
  
  /**
   * Auto-layout pages (form nodes) horizontally.
   * Non-form child nodes remain free-positioned inside the container.
   */
  useEffect(() => {
    if (!isExpanded || pageNodes.length === 0) return;

    const existingOrder = Array.isArray(data.pageOrder) ? data.pageOrder : undefined;
    const pageIdSet = new Set(pageNodes.map((n) => n.id));

    const normalizedExisting = existingOrder ? existingOrder.filter((pid) => pageIdSet.has(pid)) : [];
    const missing = pageNodes
      .filter((n) => !normalizedExisting.includes(n.id))
      .sort((a, b) => (a.position?.x || 0) - (b.position?.x || 0) || (a.position?.y || 0) - (b.position?.y || 0))
      .map((n) => n.id);

    const nextOrder = [...normalizedExisting, ...missing];

    const PAGE_START_X = 30;
    const PAGE_ROW_Y = 90;
    const PAGE_SPACING_X = 360;

    const desiredPositions = new Map(
      nextOrder.map((pid, index) => [pid, { x: PAGE_START_X + index * PAGE_SPACING_X, y: PAGE_ROW_Y }])
    );

    const needsOrderUpdate = !existingOrder || JSON.stringify(existingOrder) !== JSON.stringify(nextOrder);
    const needsPositionUpdate = pageNodes.some((n) => {
      const desired = desiredPositions.get(n.id);
      if (!desired) return false;
      return n.position?.x !== desired.x || n.position?.y !== desired.y;
    });

    if (!needsOrderUpdate && !needsPositionUpdate) return;

    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === id) {
          const expandedWidth = Math.max(600, 140 + pageCount * 360);
          return {
            ...node,
            style: {
              ...(node.style || {}),
              width: expandedWidth,
            },
            data: needsOrderUpdate
              ? {
                  ...node.data,
                  pageOrder: nextOrder,
                }
              : node.data,
          };
        }

        const desired = desiredPositions.get(node.id);
        if (desired && node.parentId === id) {
          return {
            ...node,
            position: desired,
          };
        }

        return node;
      })
    );

    requestAnimationFrame(() => updateNodeInternals(id));
  }, [
    id,
    isExpanded,
    pageCount,
    pageNodes.length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(pageNodes.map((n) => n.id).sort()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(data.pageOrder || []),
    setNodes,
    updateNodeInternals,
  ]);
  
  /**
   * Auto-connect pages in sequential order.
   * Only connects page nodes (form / legacy form types) and never deletes manual edges.
   */
  useEffect(() => {
    if (!sequentialExecution || pageNodes.length < 2) return;

    const existingOrder = Array.isArray(data.pageOrder) ? data.pageOrder : undefined;
    const pageIdSet = new Set(pageNodes.map((n) => n.id));

    const normalizedExisting = existingOrder ? existingOrder.filter((pid) => pageIdSet.has(pid)) : [];
    const missing = pageNodes
      .filter((n) => !normalizedExisting.includes(n.id))
      .sort((a, b) => (a.position?.x || 0) - (b.position?.x || 0) || (a.position?.y || 0) - (b.position?.y || 0))
      .map((n) => n.id);

    const orderedPageIds = [...normalizedExisting, ...missing];

    setEdges((prevEdges) => {
      const isThisAutoEdge = (edge: Edge) =>
        edge.data?.auto === true && edge.data?.containerId === id && edge.data?.kind === 'pageSequence';

      const prevAutoEdges = prevEdges.filter(isThisAutoEdge);
      const preservedEdges = prevEdges.filter((e) => !isThisAutoEdge(e));

      const nextAutoEdges: Edge[] = [];
      for (let i = 0; i < orderedPageIds.length - 1; i++) {
        const sourceId = orderedPageIds[i];
        const targetId = orderedPageIds[i + 1];

        // Don’t auto-generate an edge if a manual edge already exists.
        const manualExists = preservedEdges.some(
          (e) => e.source === sourceId && e.target === targetId && e.data?.auto !== true
        );
        if (manualExists) continue;

        nextAutoEdges.push({
          id: `auto-page-${id}-${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
          type: 'smoothstep',
          animated: true,
          data: {
            auto: true,
            containerId: id,
            kind: 'pageSequence',
          },
          style: {
            stroke: 'rgba(139, 92, 246, 0.6)',
            strokeWidth: 2,
          },
        });
      }

      const prevIds = new Set(prevAutoEdges.map((e) => e.id));
      const nextIds = new Set(nextAutoEdges.map((e) => e.id));
      const same = prevIds.size === nextIds.size && [...nextIds].every((x) => prevIds.has(x));

      if (same) return prevEdges;

      logger.debug(`[FormProcessGroup] Auto-connect: updating ${nextAutoEdges.length} page edges`);
      return [...preservedEdges, ...nextAutoEdges];
    });
  }, [
    id,
    sequentialExecution,
    pageNodes.length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(pageNodes.map((n) => ({ id: n.id, x: n.position?.x, y: n.position?.y }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(data.pageOrder || []),
    setEdges,
  ]);
  
  /**
   * Add new page to this group.
   * Creates a `form` node as a child; page nodes are laid out horizontally.
   */
  const handleAddStep = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      const newPageIndex = pageCount;
      const newPageId = `page-${Date.now()}`;

      const newPage: Node = {
        id: newPageId,
        type: 'form',
        position: {
          x: calculateChildXPosition(newPageIndex),
          y: 90,
        },
        data: {
          stepTitle: `Page ${newPageIndex + 1}`,
          label: `Page ${newPageIndex + 1}`,
          fields: [],
        },
        parentId: id,
        extent: 'parent' as const,
        expandParent: true,
        draggable: true,
      };

      setNodes((nodes) => [...nodes, newPage]);
    },
    [id, pageCount, setNodes]
  );
  
  /**
   * Open configuration panel
   * Should trigger NodeConfigPanelWithShadow with formProcess schema
   */
  const handleConfigure = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Call the onEdit handler passed from UnifiedFlowEditor
    if (typeof data.onEdit === 'function') {
      data.onEdit();
    }
  }, [data]);
  
  // ============================================================================
  // Auto-resize container to fit children (especially vertical)
  // ============================================================================

  const childBoundsKey = useMemo(
    () =>
      JSON.stringify(
        childNodes
          .map((n) => ({
            id: n.id,
            x: n.position?.x ?? 0,
            y: n.position?.y ?? 0,
            w: (n as any).measured?.width ?? n.width ?? 220,
            h: (n as any).measured?.height ?? n.height ?? 140,
          }))
          .sort((a, b) => a.id.localeCompare(b.id))
      ),
    [childNodes]
  );

  useEffect(() => {
    if (!isExpanded) return;

    const HEADER_HEIGHT = 56;
    const PADDING_X = 60;
    const PADDING_Y = 120;

    const pageWidthBaseline = Math.max(600, 140 + pageCount * 360);

    const childBoxes = childNodes.map((n) => {
      const measured = (n as any).measured;
      const w = measured?.width ?? n.width ?? 220;
      const h = measured?.height ?? n.height ?? 140;
      const x = n.position?.x ?? 0;
      const y = n.position?.y ?? 0;
      return { x, y, w, h };
    });

    const maxRight = childBoxes.length ? Math.max(...childBoxes.map((b) => b.x + b.w)) : 0;
    const maxBottom = childBoxes.length ? Math.max(...childBoxes.map((b) => b.y + b.h)) : 0;

    const desiredWidth = Math.max(pageWidthBaseline, maxRight + PADDING_X);
    const desiredHeight = Math.max(240, HEADER_HEIGHT + maxBottom + PADDING_Y);

    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== id) return node;

        const currentW = Number((node.style as any)?.width ?? node.width ?? 0);
        const currentH = Number((node.style as any)?.height ?? node.height ?? 0);

        const nextW = Math.round(desiredWidth);
        const nextH = Math.round(desiredHeight);

        if (currentW === nextW && currentH === nextH) return node;

        return {
          ...node,
          style: {
            ...(node.style || {}),
            width: nextW,
            height: nextH,
          },
        };
      })
    );

    requestAnimationFrame(() => updateNodeInternals(id));
  }, [childBoundsKey, id, isExpanded, pageCount, setNodes, updateNodeInternals]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <GroupContainer 
      isExpanded={isExpanded} 
      isDropTarget={isDropTarget}
      data-node-id={id}
      data-node-type="formProcessGroup"
    >
      {/* Always-available handles so the container can connect to other nodes */}
      <Handle
        type="target"
        position={Position.Left}
        id="group:in"
        aria-label="Incoming connection"
        style={{ top: 42, zIndex: 40, background: 'rgb(var(--color-primary))' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="group:out"
        aria-label="Outgoing connection"
        style={{ top: 42, zIndex: 40, background: 'rgb(var(--color-success))' }}
      />

      {/* Virtual handles when collapsed: edges to hidden children are proxied to these handles */}
      {!isExpanded && (
        <>
          {collapsedVirtualHandles.incoming.map((childId, idx) => (
            <VirtualHandle
              key={`vh-in-${childId}`}
              id={`vh:in:${childId}`}
              type="target"
              position={Position.Left}
              $side="in"
              style={{ top: 58 + idx * 18 }}
            />
          ))}
          {collapsedVirtualHandles.outgoing.map((childId, idx) => (
            <VirtualHandle
              key={`vh-out-${childId}`}
              id={`vh:out:${childId}`}
              type="source"
              position={Position.Right}
              $side="out"
              style={{ top: 58 + idx * 18 }}
            />
          ))}
        </>
      )}

      {/* Phase 3: Drop zone overlay */}
      <DropZoneOverlay show={isDropTarget && isExpanded}>
        <DropZoneText>
          📦 Drop any node here<br/>
          <small style={{ fontSize: '12px', opacity: 0.7 }}>
            Forms, Actions, Logic, Wait states...
          </small>
        </DropZoneText>
      </DropZoneOverlay>
      
      <GroupHeader isExpanded={isExpanded} onClick={handleToggleExpand}>
        <ExpandIcon isExpanded={isExpanded}>
          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </ExpandIcon>
        
        <GroupTitle>
          <GroupName>{containerName}</GroupName>
          <GroupMeta>
            <StepCount hasSteps={stepCount > 0}>
              {stepCount} {stepCount === 1 ? 'step' : 'steps'}
            </StepCount>
            {containerDescription && (
              <span>• {containerDescription.slice(0, 40)}{containerDescription.length > 40 ? '...' : ''}</span>
            )}
            {/* Phase 3: Sequential execution indicator */}
            <SequentialIndicator enabled={sequentialExecution}>
              ▶ Sequential
            </SequentialIndicator>
          </GroupMeta>
        </GroupTitle>
        
        <HeaderActions onClick={(e) => e.stopPropagation()}>
          <IconButton 
            onClick={handleSave} 
            title={data.tenantFormId ? `Save (v${data.version || 1})` : 'Save to database'}
            variant="primary"
            isSaving={isSaving}
            disabled={isSaving || childNodes.length === 0}
          >
            {isSaving ? (
              <>
                <div style={{ 
                  width: '14px', 
                  height: '14px', 
                  border: '2px solid rgba(139, 92, 246, 0.3)',
                  borderTopColor: 'rgba(139, 92, 246, 0.9)',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite'
                }} />
                <span>Saving...</span>
              </>
            ) : lastSaved ? (
              <>
                <Check size={14} />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>Save</span>
              </>
            )}
          </IconButton>
          <IconButton onClick={handleAddStep} title="Add step">
            <Plus size={16} />
          </IconButton>
          <IconButton onClick={handleConfigure} title="Configure">
            <Settings size={16} />
          </IconButton>
        </HeaderActions>
      </GroupHeader>
      
      {isExpanded ? (
        <GroupBody isExpanded={isExpanded}>
          {stepCount === 0 && (
            <EmptyState>
              <Plus size={48} />
              <div>Drop form steps here or click + to add</div>
            </EmptyState>
          )}
          {/* Children render here automatically via React Flow's parent-child system */}
        </GroupBody>
      ) : (
        <>
          {stepCount > 0 && (
            <CollapsedStepList>
              {childNodes
                .sort((a, b) => a.position.x - b.position.x) // Sort by X position for flow order
                .slice(0, 5)
                .map((child, index) => (
                  <StepPreview key={child.id}>
                    <span style={{ 
                      display: 'inline-block',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'rgba(139, 92, 246, 0.2)',
                      color: 'rgb(139, 92, 246)',
                      fontSize: '11px',
                      fontWeight: 600,
                      lineHeight: '20px',
                      textAlign: 'center',
                      marginRight: '8px',
                    }}>
                      {index + 1}
                    </span>
                    {(child.data as any).label || 'Untitled'}
                  </StepPreview>
                ))}
              {stepCount > 5 && (
                <StepPreview>+ {stepCount - 5} more steps</StepPreview>
              )}
              {/* Version indicator */}
              {data.tenantFormId && data.version && (
                <div style={{
                  marginTop: '8px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  color: 'rgba(139, 92, 246, 0.7)',
                  textAlign: 'center',
                  borderTop: '1px solid rgba(139, 92, 246, 0.1)',
                }}>
                  Saved: v{data.version} • ID: {data.tenantFormId.slice(0, 8)}...
                  {lastSaved && (
                    <span style={{ marginLeft: '4px', opacity: 0.6 }}>
                      ({new Date(lastSaved).toLocaleTimeString()})
                    </span>
                  )}
                </div>
              )}
            </CollapsedStepList>
          )}
        </>
      )}
    </GroupContainer>
  );
});

// Export type for use in nodeTypes registry
export default FormProcessGroupNode;
