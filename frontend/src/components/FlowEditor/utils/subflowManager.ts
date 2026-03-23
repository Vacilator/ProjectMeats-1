/**
 * Sub-Flow Manager
 * 
 * Handles export and import of FormProcess containers as reusable templates.
 * Stores templates in localStorage with support for sharing via JSON export/import.
 * 
 * Phase E.3: Schema + Config Integration + Reusability
 * 
 * Created: 2026-02-19
 */

import { Node, Edge } from '@xyflow/react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface SubFlowTemplate {
  /** Unique ID for the template */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of the sub-flow */
  description?: string;
  /** Tags for categorization */
  tags: string[];
  /** Category (e.g., 'onboarding', 'checkout', 'approval') */
  category?: string;
  /** Container node configuration */
  containerNode: Partial<Node>;
  /** Child nodes inside the container */
  childNodes: Partial<Node>[];
  /** Edges connecting children */
  internalEdges: Partial<Edge>[];
  /** Template metadata */
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: string;
    author?: string;
  };
}

export interface SubFlowLibrary {
  templates: Record<string, SubFlowTemplate>;
  version: string;
}

// ============================================================================
// LocalStorage Keys
// ============================================================================

const STORAGE_KEY = 'projectmeats:subflow:library';
const STORAGE_VERSION = '1.0.0';

// ============================================================================
// Sub-Flow Management Functions
// ============================================================================

/**
 * Get the sub-flow library from localStorage
 */
export function getSubFlowLibrary(): SubFlowLibrary {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { templates: {}, version: STORAGE_VERSION };
    }
    
    const library = JSON.parse(stored) as SubFlowLibrary;
    
    // Migrate if version mismatch (future-proofing)
    if (library.version !== STORAGE_VERSION) {
      console.warn('[SubFlow] Library version mismatch, will auto-migrate');
      // Add migration logic here if needed
    }
    
    return library;
  } catch (error) {
    console.error('[SubFlow] Failed to load library:', error);
    return { templates: {}, version: STORAGE_VERSION };
  }
}

/**
 * Save the sub-flow library to localStorage
 */
export function saveSubFlowLibrary(library: SubFlowLibrary): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  } catch (error) {
    console.error('[SubFlow] Failed to save library:', error);
    throw new Error('Failed to save sub-flow library');
  }
}

/**
 * Export a FormProcess container as a reusable template
 * 
 * @param containerNode - The FormProcess group node
 * @param allNodes - All nodes in the workflow
 * @param allEdges - All edges in the workflow
 * @param templateName - Name for the template
 * @param templateDescription - Optional description
 * @param tags - Tags for categorization
 * @param category - Category (e.g., 'onboarding', 'checkout')
 * @returns The created template
 */
export function exportSubFlow(
  containerNode: Node,
  allNodes: Node[],
  allEdges: Edge[],
  templateName: string,
  templateDescription?: string,
  tags: string[] = [],
  category?: string
): SubFlowTemplate {
  // Find all child nodes (nodes with parentId = containerNode.id)
  const childNodes = allNodes.filter(node => node.parentId === containerNode.id);
  
  // Find all edges connecting children (source and target both are children)
  const childNodeIds = new Set(childNodes.map(n => n.id));
  const internalEdges = allEdges.filter(edge => 
    childNodeIds.has(edge.source) && childNodeIds.has(edge.target)
  );
  
  // Create template with relative positions and clean data
  const template: SubFlowTemplate = {
    id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: templateName,
    description: templateDescription,
    tags,
    category,
    containerNode: {
      type: containerNode.type,
      data: containerNode.data,
      // Don't include absolute position - will be set on import
      width: containerNode.width,
      height: containerNode.height,
    },
    childNodes: childNodes.map(node => ({
      type: node.type,
      data: node.data,
      position: node.position, // Relative to container
      width: node.width,
      height: node.height,
      extent: node.extent,
      expandParent: node.expandParent,
    })),
    internalEdges: internalEdges.map(edge => ({
      type: edge.type,
      animated: edge.animated,
      label: edge.label,
      markerEnd: edge.markerEnd,
      // sourceHandle and targetHandle will be recreated
    })),
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };
  
  return template;
}

/**
 * Save a template to the library
 */
export function saveTemplate(template: SubFlowTemplate): void {
  const library = getSubFlowLibrary();
  library.templates[template.id] = template;
  saveSubFlowLibrary(library);
}

/**
 * Import a template into the workflow
 * 
 * @param template - The template to import
 * @param position - Position where the container should be placed
 * @param generateId - Function to generate unique IDs for nodes/edges
 * @returns Object containing new nodes and edges to add to the workflow
 */
export function importSubFlow(
  template: SubFlowTemplate,
  position: { x: number; y: number },
  generateId: () => string
): { nodes: Node[]; edges: Edge[] } {
  // Generate new IDs for container and children
  const containerNewId = generateId();
  const childIdMap = new Map<string, string>(); // old ID -> new ID
  
  template.childNodes.forEach((_, index) => {
    childIdMap.set(`child-${index}`, generateId());
  });
  
  // Create container node with new ID and position
  const containerNode: Node = {
    id: containerNewId,
    type: template.containerNode.type!,
    data: {
      ...template.containerNode.data,
      // Ensure group flag is set
      isGroup: true,
    },
    position,
    width: template.containerNode.width,
    height: template.containerNode.height,
  };
  
  // Create child nodes with new IDs and parentId
  const childNodes: Node[] = template.childNodes.map((childTemplate, index) => {
    const newId = childIdMap.get(`child-${index}`)!;
    return {
      id: newId,
      type: childTemplate.type!,
      data: childTemplate.data,
      position: childTemplate.position!,
      parentId: containerNewId,
      extent: childTemplate.extent || 'parent',
      expandParent: childTemplate.expandParent,
      width: childTemplate.width,
      height: childTemplate.height,
    };
  });
  
  // Create edges with new IDs
  const edges: Edge[] = template.internalEdges.map((edgeTemplate, index) => {
    // Map old node IDs to new node IDs
    const sourceIndex = template.childNodes.findIndex((_, i) => i === index);
    const targetIndex = sourceIndex + 1; // Simple sequential connection
    
    const sourceId = childIdMap.get(`child-${sourceIndex}`) || childNodes[0]?.id;
    const targetId = childIdMap.get(`child-${targetIndex}`) || childNodes[1]?.id;
    
    return {
      id: generateId(),
      source: sourceId,
      target: targetId,
      type: edgeTemplate.type,
      animated: edgeTemplate.animated,
      label: edgeTemplate.label,
      markerEnd: edgeTemplate.markerEnd,
    };
  });
  
  return {
    nodes: [containerNode, ...childNodes],
    edges,
  };
}

/**
 * Get all templates from the library
 */
export function getAllTemplates(): SubFlowTemplate[] {
  const library = getSubFlowLibrary();
  return Object.values(library.templates);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): SubFlowTemplate | null {
  const library = getSubFlowLibrary();
  return library.templates[id] || null;
}

/**
 * Delete a template from the library
 */
export function deleteTemplate(id: string): void {
  const library = getSubFlowLibrary();
  delete library.templates[id];
  saveSubFlowLibrary(library);
}

/**
 * Search templates by name, tags, or category
 */
export function searchTemplates(query: string): SubFlowTemplate[] {
  const library = getSubFlowLibrary();
  const lowerQuery = query.toLowerCase();
  
  return Object.values(library.templates).filter(template => 
    template.name.toLowerCase().includes(lowerQuery) ||
    template.description?.toLowerCase().includes(lowerQuery) ||
    template.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
    template.category?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Export template as JSON file
 */
export function exportTemplateToFile(template: SubFlowTemplate): string {
  return JSON.stringify(template, null, 2);
}

/**
 * Import template from JSON file
 */
export function importTemplateFromFile(json: string): SubFlowTemplate {
  try {
    const template = JSON.parse(json) as SubFlowTemplate;
    
    // Validate template structure
    if (!template.id || !template.name || !template.containerNode) {
      throw new Error('Invalid template format');
    }
    
    return template;
  } catch (error) {
    console.error('[SubFlow] Failed to import template:', error);
    throw new Error('Invalid template JSON');
  }
}

/**
 * Duplicate a template with a new ID and name
 */
export function duplicateTemplate(templateId: string, newName: string): SubFlowTemplate | null {
  const original = getTemplateById(templateId);
  if (!original) return null;
  
  const duplicate: SubFlowTemplate = {
    ...original,
    id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: newName,
    metadata: {
      ...original.metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
  
  saveTemplate(duplicate);
  return duplicate;
}

/**
 * Update an existing template
 */
export function updateTemplate(templateId: string, updates: Partial<Omit<SubFlowTemplate, 'id' | 'metadata'>>): void {
  const template = getTemplateById(templateId);
  if (!template) {
    throw new Error('Template not found');
  }
  
  const updated: SubFlowTemplate = {
    ...template,
    ...updates,
    id: template.id, // Preserve ID
    metadata: {
      ...template.metadata,
      updatedAt: new Date().toISOString(),
    },
  };
  
  saveTemplate(updated);
}
