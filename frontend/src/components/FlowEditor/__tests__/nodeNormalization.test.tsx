/**
 * Unit Tests for Node Normalization
 * 
 * Tests the normalization of nodes loaded from database to ensure
 * they have required maxInputs/maxOutputs properties.
 * 
 * Bug fix: Cannot read properties of undefined (reading 'maxInputs')
 */
import { describe, it, expect } from 'vitest';
import { Node } from '@xyflow/react';

// Import the actual functions from the utility file
import { normalizeNodeData, normalizeNodes } from '../utils/nodeNormalization';

describe('Node Normalization', () => {
  describe('normalizeNodeData', () => {
    it('should add maxInputs and maxOutputs to node without data', () => {
      const node: Node = {
        id: '1',
        type: 'actionEmail',
        position: { x: 0, y: 0 },
      } as Node;
      
      const normalized = normalizeNodeData(node);
      
      expect(normalized.data).toBeDefined();
      expect(normalized.data.maxInputs).toBe(1);
      expect(normalized.data.maxOutputs).toBe(1);
    });
    
    it('should add maxInputs and maxOutputs to node with empty data', () => {
      const node: Node = {
        id: '1',
        type: 'conditionIf',
        position: { x: 0, y: 0 },
        data: {},
      };
      
      const normalized = normalizeNodeData(node);
      
      expect(normalized.data.maxInputs).toBe(1);
      expect(normalized.data.maxOutputs).toBe(2);
    });
    
    it('should preserve existing maxInputs and maxOutputs', () => {
      const node: Node = {
        id: '1',
        type: 'actionEmail',
        position: { x: 0, y: 0 },
        data: {
          maxInputs: 5,
          maxOutputs: 3,
        },
      };
      
      const normalized = normalizeNodeData(node);
      
      expect(normalized.data.maxInputs).toBe(5);
      expect(normalized.data.maxOutputs).toBe(3);
    });
    
    it('should handle trigger nodes (maxInputs: 0)', () => {
      const node: Node = {
        id: '1',
        type: 'triggerManual',
        position: { x: 0, y: 0 },
        data: {},
      };
      
      const normalized = normalizeNodeData(node);
      
      expect(normalized.data.maxInputs).toBe(0);
      expect(normalized.data.maxOutputs).toBe(1);
    });
    
    it('should handle terminal nodes (maxOutputs: 0)', () => {
      const node: Node = {
        id: '1',
        type: 'endSuccess',
        position: { x: 0, y: 0 },
        data: {},
      };
      
      const normalized = normalizeNodeData(node);
      
      expect(normalized.data.maxInputs).toBe(1);
      expect(normalized.data.maxOutputs).toBe(0);
    });
    
    it('should handle unlimited connections (-1)', () => {
      const node: Node = {
        id: '1',
        type: 'conditionSwitch',
        position: { x: 0, y: 0 },
        data: {},
      };
      
      const normalized = normalizeNodeData(node);
      
      expect(normalized.data.maxInputs).toBe(1);
      expect(normalized.data.maxOutputs).toBe(-1); // Unlimited
    });
    
    it('should handle unknown node types with defaults', () => {
      const node: Node = {
        id: '1',
        type: 'unknownType',
        position: { x: 0, y: 0 },
        data: {},
      };
      
      const normalized = normalizeNodeData(node);
      
      // Should not add properties for unknown types
      expect(normalized.data.maxInputs).toBeUndefined();
      expect(normalized.data.maxOutputs).toBeUndefined();
    });
    
    it('should not mutate the original node', () => {
      const node: Node = {
        id: '1',
        type: 'actionEmail',
        position: { x: 0, y: 0 },
        data: { label: 'Original' },
      };
      
      const normalized = normalizeNodeData(node);
      
      // Original node should not be modified
      expect(node.data.maxInputs).toBeUndefined();
      expect(node.data.maxOutputs).toBeUndefined();
      
      // Normalized node should have the properties
      expect(normalized.data.maxInputs).toBe(1);
      expect(normalized.data.maxOutputs).toBe(1);
      
      // Other properties should be preserved
      expect(normalized.data.label).toBe('Original');
    });

    it('should canonicalize legacy form step types to form', () => {
      const node: Node = {
        id: '1',
        type: 'formStepSingleNode',
        position: { x: 0, y: 0 },
        data: { label: 'Legacy Form Step' },
      } as Node;

      const normalized = normalizeNodeData(node);

      expect(normalized.type).toBe('form');
      expect((normalized.data as any).nodeType).toBe('form');
      expect(normalized.data.maxInputs).toBe(1);
      expect(normalized.data.maxOutputs).toBe(1);
      expect((normalized.data as any).label).toBe('Legacy Form Step');
    });

    it('should sync parentId into node.data.parentId', () => {
      const node: Node = {
        id: '1',
        type: 'actionEmail',
        parentId: 'container-1',
        position: { x: 0, y: 0 },
        data: {},
      } as Node;

      const normalized = normalizeNodeData(node);

      expect(normalized.parentId).toBe('container-1');
      expect((normalized.data as any).parentId).toBe('container-1');
      expect(normalized.extent).toBe('parent');
      expect(normalized.expandParent).toBe(true);
    });

    it('should hydrate node.parentId from node.data.parentId', () => {
      const node: Node = {
        id: '1',
        type: 'actionEmail',
        position: { x: 0, y: 0 },
        data: { parentId: 'container-2' },
      } as Node;

      const normalized = normalizeNodeData(node);

      expect(normalized.parentId).toBe('container-2');
      expect((normalized.data as any).parentId).toBe('container-2');
      expect(normalized.extent).toBe('parent');
      expect(normalized.expandParent).toBe(true);
    });
  });
  
  describe('normalizeNodes', () => {
    it('should normalize multiple nodes', () => {
      const nodes: Node[] = [
        {
          id: '1',
          type: 'triggerManual',
          position: { x: 0, y: 0 },
          data: {},
        },
        {
          id: '2',
          type: 'actionEmail',
          position: { x: 100, y: 0 },
          data: {},
        },
        {
          id: '3',
          type: 'endSuccess',
          position: { x: 200, y: 0 },
          data: {},
        },
      ];
      
      const normalized = normalizeNodes(nodes);
      
      expect(normalized).toHaveLength(3);
      expect(normalized[0].data.maxInputs).toBe(0); // trigger
      expect(normalized[0].data.maxOutputs).toBe(1);
      expect(normalized[1].data.maxInputs).toBe(1); // action
      expect(normalized[1].data.maxOutputs).toBe(1);
      expect(normalized[2].data.maxInputs).toBe(1); // terminal
      expect(normalized[2].data.maxOutputs).toBe(0);
    });
    
    it('should handle empty array', () => {
      const nodes: Node[] = [];
      const normalized = normalizeNodes(nodes);
      
      expect(normalized).toHaveLength(0);
    });
    
    it('should handle nodes without type', () => {
      const nodes: Node[] = [
        {
          id: '1',
          position: { x: 0, y: 0 },
          data: { label: 'Test' },
        } as Node,
      ];
      
      const normalized = normalizeNodes(nodes);
      
      // Should not crash
      expect(normalized).toHaveLength(1);
    });
    
    it('should not mutate the original array or nodes', () => {
      const nodes: Node[] = [
        {
          id: '1',
          type: 'actionEmail',
          position: { x: 0, y: 0 },
          data: {},
        },
      ];
      
      const normalized = normalizeNodes(nodes);
      
      // Original nodes should not be modified
      expect(nodes[0].data.maxInputs).toBeUndefined();
      
      // Normalized nodes should have the properties
      expect(normalized[0].data.maxInputs).toBe(1);
    });

    it('should un-parent nodes with missing parent containers', () => {
      const nodes: Node[] = [
        {
          id: 'child-1',
          type: 'form',
          parentId: 'missing-parent',
          hidden: true,
          position: { x: 0, y: 0 },
          data: { parentId: 'missing-parent' },
        } as Node,
      ];

      const normalized = normalizeNodes(nodes);

      expect(normalized[0].parentId).toBeUndefined();
      expect((normalized[0].data as any).parentId).toBeUndefined();
      expect(normalized[0].hidden).toBe(false);
    });

    it('should clear hidden on children when parent is expanded', () => {
      const nodes: Node[] = [
        {
          id: 'parent-1',
          type: 'formProcess',
          position: { x: 0, y: 0 },
          data: { isExpanded: true, containerName: 'Form Process' },
        } as Node,
        {
          id: 'child-1',
          type: 'formStep',
          parentId: 'parent-1',
          hidden: true,
          position: { x: 10, y: 10 },
          data: { parentId: 'parent-1' },
        } as Node,
      ];

      const normalized = normalizeNodes(nodes);
      const child = normalized.find((n) => n.id === 'child-1')!;

      expect(child.type).toBe('form');
      expect(child.hidden).toBe(false);
    });
  });
  
  describe('Bug Fix Validation', () => {
    it('should prevent "Cannot read properties of undefined" error', () => {
      // This simulates the exact scenario that caused the bug:
      // A node loaded from database without maxInputs/maxOutputs
      const problematicNode: Node = {
        id: '1',
        type: 'actionEmail',
        position: { x: 0, y: 0 },
        // No data property at all (as might come from old database records)
      } as Node;
      
      // This should not throw an error
      expect(() => {
        const normalized = normalizeNodeData(problematicNode);
        // Try to access the properties that caused the original error
        const maxInputs = normalized.data?.maxInputs;
        const maxOutputs = normalized.data?.maxOutputs;
        
        expect(maxInputs).toBeDefined();
        expect(maxOutputs).toBeDefined();
      }).not.toThrow();
    });
    
    it('should handle nodes with partial data', () => {
      const node: Node = {
        id: '1',
        type: 'conditionIf',
        position: { x: 0, y: 0 },
        data: {
          label: 'My Condition',
          rules: [],
          // maxInputs and maxOutputs are missing
        },
      };
      
      const normalized = normalizeNodeData(node);
      
      expect(normalized.data.label).toBe('My Condition');
      expect(normalized.data.rules).toEqual([]);
      expect(normalized.data.maxInputs).toBe(1);
      expect(normalized.data.maxOutputs).toBe(2);
    });
  });
});
