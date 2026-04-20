/**
 * Node Normalization Utilities
 *
 * Utilities for normalizing nodes loaded from database to ensure
 * they have required metadata and consistent parent/child semantics.
 *
 * Extracted from UnifiedFlowEditor to enable testing without
 * importing the main component (which has React hooks).
 *
 * Created: 2026-02-21
 */
import { Node } from '@xyflow/react';
import { NODE_TYPE_REGISTRY } from '../nodeTypes';
import { formatEntityTypeLabel } from './formatEntityTypeLabel';
import {
  getResolvedFormFields,
  isFormBuilderFieldArray,
  isSelectedFieldArray,
  toFormFieldsFromSelectedFields,
} from './formFieldsDualModel';

const LEGACY_FORM_STEP_TYPE_MAP: Record<string, 'form'> = {
  formStep: 'form',
  formStepSingle: 'form',
  formStepSingleNode: 'form',
};

function getDataParentId(node: Node): string | undefined {
  const raw = (node.data as any)?.parentId ?? (node.data as any)?.parent_id;
  if (raw === null || raw === undefined || raw === '') return undefined;
  return String(raw);
}

/**
 * Normalize a single node's data to include maxInputs and maxOutputs.
 *
 * @param node - The node to normalize
 * @returns A new node with normalized data (does not mutate original)
 */
export function normalizeNodeData(node: Node): Node {
  // If node has no type, return as-is
  if (!node.type) {
    return node;
  }

  // Start from a safe copy (and ensure data always exists)
  let next: Node = {
    ...node,
    data: {
      ...(node.data || {}),
    },
  } as Node;

  // --------------------------------------------------------------------------
  // Canonical title normalization: prefer data.title
  // --------------------------------------------------------------------------
  {
    const data: any = next.data || {};

    const existingTitle = data.title;
    const legacyTitle =
      data.name ??
      data.label ??
      data.containerName ??
      data.groupName ??
      data.stepTitle ??
      data.displayTitle;

    const entityFallback = formatEntityTypeLabel(data.entityType ?? data.entity_type);

    const resolvedTitle =
      (typeof existingTitle === 'string' && existingTitle.trim() ? existingTitle : undefined) ??
      (typeof legacyTitle === 'string' && legacyTitle.trim() ? legacyTitle : undefined) ??
      (entityFallback ? entityFallback : undefined);

    if (resolvedTitle) {
      next = {
        ...next,
        data: {
          ...(next.data || {}),
          title: resolvedTitle,
          label: (next.data as any)?.label ?? resolvedTitle,
        },
      } as Node;
    }
  }

  // --------------------------------------------------------------------------
  // ParentId consistency: sync ReactFlow parentId ↔ node.data.parentId
  // --------------------------------------------------------------------------
  const resolvedParentId = next.parentId ?? getDataParentId(next);
  if (resolvedParentId) {
    next = {
      ...next,
      parentId: String(resolvedParentId),
      data: {
        ...(next.data || {}),
        parentId: String(resolvedParentId),
      },
    } as Node;
  }

  // --------------------------------------------------------------------------
  // Normalize legacy form step node types to the unified 'form'
  // --------------------------------------------------------------------------
  const canonicalFormType = LEGACY_FORM_STEP_TYPE_MAP[String(next.type ?? '')];
  if (canonicalFormType) {
    next = {
      ...next,
      type: canonicalFormType,
      data: {
        ...(next.data || {}),
        nodeType: canonicalFormType,
      },
    } as Node;
  }

  // --------------------------------------------------------------------------
  // Form Fields Dual-Model: ensure formFields exists for form-like nodes.
  // --------------------------------------------------------------------------
  if (next.type === 'form') {
    const data: any = next.data || {};

    if (!isFormBuilderFieldArray(data.formFields)) {
      const resolved = getResolvedFormFields(data);
      if (resolved.length > 0) {
        next = { ...next, data: { ...data, formFields: resolved } } as Node;
      } else if (isSelectedFieldArray(data.fields)) {
        next = {
          ...next,
          data: {
            ...data,
            formFields: toFormFieldsFromSelectedFields(data.fields),
          },
        } as Node;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Form Process Lock-In: canonicalize legacy container types
  // --------------------------------------------------------------------------
  // We lock all legacy Form Process / container variants to ONE canonical nodeType
  // (`formProcess`), while rendering them as a STANDARD React Flow default node
  // to avoid the purple custom container regressions.
  if (
    next.type === 'formMultiStepContainer' ||
    next.type === 'formProcess' ||
    next.type === 'formProcessGroup' ||
    next.type === 'formBook'
  ) {
    const canonicalNodeType = 'formProcess';
    const canonicalDef = NODE_TYPE_REGISTRY[canonicalNodeType];

    const existingLabel = (next.data as any)?.label;
    const existingContainerName = (next.data as any)?.containerName;
    const existingTitle = (next.data as any)?.title;

    const resolvedTitle = existingTitle ?? existingLabel ?? existingContainerName ?? 'Form Process';

    return {
      ...next,
      type: 'formProcessContainer',
      data: {
        ...(next.data || {}),
        nodeType: canonicalNodeType,
        title: resolvedTitle,
        label: existingLabel ?? resolvedTitle,
        containerName: existingContainerName ?? resolvedTitle,
        // Ensure group semantics are enabled
        isGroup: true,
        // Ensure required sizing metadata exists for downstream logic
        maxInputs: (next.data as any)?.maxInputs ?? canonicalDef?.maxInputs ?? 1,
        maxOutputs: (next.data as any)?.maxOutputs ?? canonicalDef?.maxOutputs ?? 1,
      },
    };
  }

  // Ensure strict parent bounds for any node that lives inside a container
  if (next.parentId) {
    next = {
      ...next,
      extent: next.extent || 'parent',
      expandParent: next.expandParent ?? true,
    } as Node;
  }

  // --------------------------------------------------------------------------
  // FormReference canonicalization: tenantFormId is the canonical key.
  // Support legacy data.formId by aliasing it to tenantFormId when UUID-like.
  // --------------------------------------------------------------------------
  if (next.type === 'formReference') {
    const data: any = next.data || {};
    const candidate = data.tenantFormId ?? data.formId;
    const uuidLike =
      typeof candidate === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate);

    if (uuidLike) {
      next = {
        ...next,
        data: {
          ...data,
          tenantFormId: data.tenantFormId ?? candidate,
          formId: data.formId ?? candidate,
        },
      } as Node;
    }
  }

  // Get node type definition
  const nodeTypeDef = NODE_TYPE_REGISTRY[next.type ?? ''];

  // If unknown type, return as-is (but keep the parentId normalization)
  if (!nodeTypeDef) {
    return next;
  }

  // Create new node with normalized data
  return {
    ...next,
    data: {
      ...(next.data || {}),
      maxInputs: (next.data as any)?.maxInputs ?? nodeTypeDef.maxInputs ?? 1,
      maxOutputs: (next.data as any)?.maxOutputs ?? nodeTypeDef.maxOutputs ?? 1,
    },
  };
}

/**
 * Normalize an array of nodes.
 *
 * @param nodes - The nodes to normalize
 * @returns A new array of normalized nodes (does not mutate originals)
 */
export function normalizeNodes(nodes: Node[]): Node[] {
  const firstPass = nodes.map(normalizeNodeData);
  const byId = new Map(firstPass.map((n) => [n.id, n] as const));

  // Second pass: ensure we don't strand nodes under missing parents and
  // clear hidden flags when a parent is expanded.
  return firstPass.map((n) => {
    if (!n.parentId) return n;

    const parent = byId.get(n.parentId);

    // Dangling parent relationship: un-parent the node so it doesn't get stuck hidden/off-canvas.
    if (!parent) {
      const nextData = { ...(n.data || {}) } as any;
      delete nextData.parentId;

      return {
        ...n,
        parentId: undefined,
        extent: undefined,
        expandParent: undefined,
        hidden: false,
        data: nextData,
      } as Node;
    }

    const parentExpanded = Boolean((parent.data as any)?.isExpanded);
    if (n.hidden && parentExpanded) {
      return {
        ...n,
        hidden: false,
      } as Node;
    }

    return n;
  });
}
