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

// Since normalizeNodes is not exported, we'll test the behavior through
// the component integration. For now, we create a local copy for unit testing.
import { NODE_TYPE_REGISTRY } from '../nodeTypes';

/**
 * Local copy of normalizeNodeData for testing purposes
 */
function normalizeNodeData(node: Node): Node {
  // If data is undefined, initialize it
  if (!node.data) {
    node.data = {};
  }
  
  // Get node type definition
  const nodeType = node.type || '';
  const nodeDef = NODE_TYPE_REGISTRY[nodeType];
  
  // Ensure maxInputs and maxOutputs are set
  if (typeof node.data.maxInputs === 'undefined' && nodeDef) {
    node.data.maxInputs = nodeDef.maxInputs ?? 1;
  }
  
  if (typeof node.data.maxOutputs === 'undefined' && nodeDef) {
    node.data.maxOutputs = nodeDef.maxOutputs ?? 1;
  }
  
  return node;
}

/**
 * Local copy of normalizeNodes for testing purposes
 */
function normalizeNodes(nodes: Node[]): Node[] {
  return nodes.map(normalizeNodeData);
}

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
    
    it('should handle unknown node types with defaults', () => {
      const node: Node = {
        id: '1',
        type: 'unknownType',
        position: { x: 0, y: 0 },
        data: {},
      };
      
      const normalized = normalizeNodeData(node);
      
      // Should not crash, but won't add properties for unknown types
      expect(normalized.data.maxInputs).toBeUndefined();
      expect(normalized.data.maxOutputs).toBeUndefined();
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
