/**
 * Connection Validator Tests
 * Phase 7.2: Visual Connection Indicators
 * 
 * Tests for connection validation logic.
 * Created: 2026-02-27
 */

import { Node, Edge } from '@xyflow/react';
import {
  validateConnectionType,
  detectCircularDependency,
  validateNodeConnectivity,
  validateWorkflow,
} from '../connectionValidator';

const createNode = (id: string, type: string): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: {},
});

const createEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
});

describe('connectionValidator', () => {
  describe('validateConnectionType', () => {
    it('should allow trigger to action connection', () => {
      const source = createNode('1', 'trigger');
      const target = createNode('2', 'action');
      const result = validateConnectionType(source, target);
      expect(result.valid).toBe(true);
    });

    it('should reject action to trigger connection', () => {
      const source = createNode('1', 'action');
      const target = createNode('2', 'trigger');
      const result = validateConnectionType(source, target);
      expect(result.valid).toBe(false);
    });
  });

  describe('detectCircularDependency', () => {
    it('should detect simple circular loop', () => {
      const edges: Edge[] = [
        createEdge('e1', '1', '2'),
        createEdge('e2', '2', '3'),
      ];
      const result = detectCircularDependency('3', '1', edges);
      expect(result.valid).toBe(false);
    });

    it('should allow linear workflow', () => {
      const edges: Edge[] = [
        createEdge('e1', '1', '2'),
        createEdge('e2', '2', '3'),
      ];
      const result = detectCircularDependency('3', '4', edges);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateNodeConnectivity', () => {
    it('should allow trigger with no incoming connections', () => {
      const edges: Edge[] = [createEdge('e1', '1', '2')];
      const result = validateNodeConnectivity('1', 'trigger', edges);
      expect(result.valid).toBe(true);
    });
  });
});
