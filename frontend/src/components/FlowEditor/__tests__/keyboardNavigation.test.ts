/**
 * @fileoverview Tests for keyboard navigation utilities
 * @module FlowEditor/__tests__/keyboardNavigation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleKeyboardNavigation,
  getNodeAriaLabel,
  getKeyboardShortcut,
  type NavigationDirection,
} from '../utils/keyboardNavigation';
import type { Node, Edge } from '@xyflow/react';

describe('keyboardNavigation', () => {
  // Helper to create test nodes
  const createNode = (id: string, x: number, y: number, type = 'default'): Node => ({
    id,
    type,
    position: { x, y },
    data: { label: `Node ${id}` },
  });

  // Helper to create test edges
  const createEdge = (id: string, source: string, target: string): Edge => ({
    id,
    source,
    target,
  });

  describe('handleKeyboardNavigation', () => {
    let nodes: Node[];
    let edges: Edge[];

    beforeEach(() => {
      // Create linear workflow: node1 -> node2 -> node3
      nodes = [
        createNode('node1', 0, 0),
        createNode('node2', 200, 0),
        createNode('node3', 400, 0),
      ];

      edges = [
        createEdge('edge1', 'node1', 'node2'),
        createEdge('edge2', 'node2', 'node3'),
      ];
    });

    describe('Arrow key navigation', () => {
      it('should navigate right via edges', () => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
        const result = handleKeyboardNavigation(event, 'node1', nodes, edges, {
          followEdges: true,
        });

        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe('node2');
        expect(result.action).toBe('select');
      });

      it('should navigate left via edges', () => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
        const result = handleKeyboardNavigation(event, 'node2', nodes, edges, {
          followEdges: true,
        });

        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe('node1');
        expect(result.action).toBe('select');
      });

      it('should use spatial proximity when followEdges is false', () => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
        const result = handleKeyboardNavigation(event, 'node1', nodes, edges, {
          followEdges: false,
        });

        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe('node2'); // Closest to the right
      });

      it('should navigate up/down spatially', () => {
        const verticalNodes = [
          createNode('top', 100, 0),
          createNode('middle', 100, 200),
          createNode('bottom', 100, 400),
        ];

        // Down
        const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        const downResult = handleKeyboardNavigation(downEvent, 'top', verticalNodes, []);

        expect(downResult.focusNodeId).toBe('middle');

        // Up
        const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
        const upResult = handleKeyboardNavigation(upEvent, 'middle', verticalNodes, []);

        expect(upResult.focusNodeId).toBe('top');
      });
    });

    describe('Tab navigation', () => {
      it('should move to next node with Tab', () => {
        const event = new KeyboardEvent('keydown', { key: 'Tab' });
        const result = handleKeyboardNavigation(event, 'node1', nodes, edges);

        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe('node2');
        expect(result.action).toBe('select');
      });

      it('should move to previous node with Shift+Tab', () => {
        const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
        const result = handleKeyboardNavigation(event, 'node2', nodes, edges);

        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe('node1');
        expect(result.action).toBe('select');
      });

      it('should wrap around at end with Tab (if wrapAround enabled)', () => {
        const event = new KeyboardEvent('keydown', { key: 'Tab' });
        const result = handleKeyboardNavigation(event, 'node3', nodes, edges, {
          wrapAround: true,
        });

        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe('node1'); // Wrapped to first
      });

      it('should not wrap when wrapAround is disabled', () => {
        const event = new KeyboardEvent('keydown', { key: 'Tab' });
        const result = handleKeyboardNavigation(event, 'node3', nodes, edges, {
          wrapAround: false,
        });

        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe('node3'); // Stays on last
      });
    });

    describe('Home/End navigation', () => {
      it('should jump to first node with Home', () => {
        const event = new KeyboardEvent('keydown', { key: 'Home' });
        const result = handleKeyboardNavigation(event, 'node3', nodes, edges);

        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe('node1');
        expect(result.action).toBe('select');
      });

      it('should jump to last node with End', () => {
        const event = new KeyboardEvent('keydown', { key: 'End' });
        const result = handleKeyboardNavigation(event, 'node1', nodes, edges);

        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe('node3');
        expect(result.action).toBe('select');
      });
    });

    describe('Enter/Space actions', () => {
      it('should activate node with Enter', () => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        const result = handleKeyboardNavigation(event, 'node1', nodes, edges);

        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe('node1');
        expect(result.action).toBe('activate');
      });

      it('should toggle selection with Space', () => {
        const event = new KeyboardEvent('keydown', { key: ' ' });
        const result = handleKeyboardNavigation(event, 'node1', nodes, edges);

        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe('node1');
        expect(result.action).toBe('select');
      });

      it('should select first node when no node is focused and Enter pressed', () => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        const result = handleKeyboardNavigation(event, null, nodes, edges);

        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe('node1');
        expect(result.action).toBe('select');
      });
    });

    describe('Escape key', () => {
      it('should clear selection with Escape', () => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        const result = handleKeyboardNavigation(event, 'node1', nodes, edges);

        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe(null);
        expect(result.action).toBe('dismiss');
      });
    });

    describe('Vim bindings', () => {
      it('should support h (left) when enabled', () => {
        const event = new KeyboardEvent('keydown', { key: 'h' });
        const result = handleKeyboardNavigation(event, 'node2', nodes, edges, {
          vimBindings: true,
          followEdges: true,
        });

        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe('node1');
      });

      it('should support j (down) when enabled', () => {
        const verticalNodes = [
          createNode('top', 100, 0),
          createNode('bottom', 100, 300),
        ];

        const event = new KeyboardEvent('keydown', { key: 'j' });
        const result = handleKeyboardNavigation(event, 'top', verticalNodes, [], {
          vimBindings: true,
        });

        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe('bottom');
      });

      it('should support k (up) when enabled', () => {
        const verticalNodes = [
          createNode('top', 100, 0),
          createNode('bottom', 100, 300),
        ];

        const event = new KeyboardEvent('keydown', { key: 'k' });
        const result = handleKeyboardNavigation(event, 'bottom', verticalNodes, [], {
          vimBindings: true,
        });

        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe('top');
      });

      it('should support l (right) when enabled', () => {
        const event = new KeyboardEvent('keydown', { key: 'l' });
        const result = handleKeyboardNavigation(event, 'node1', nodes, edges, {
          vimBindings: true,
          followEdges: true,
        });

        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe('node2');
      });

      it('should not respond to vim keys when disabled', () => {
        const event = new KeyboardEvent('keydown', { key: 'h' });
        const result = handleKeyboardNavigation(event, 'node2', nodes, edges, {
          vimBindings: false,
        });

        expect(result.handled).toBe(false);
        expect(result.focusNodeId).toBe(null);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty node array', () => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
        const result = handleKeyboardNavigation(event, null, [], []);

        expect(result.handled).toBe(false);
        expect(result.focusNodeId).toBe(null);
      });

      it('should handle single node', () => {
        const singleNode = [createNode('only', 0, 0)];
        const event = new KeyboardEvent('keydown', { key: 'Tab' });
        const result = handleKeyboardNavigation(event, 'only', singleNode, [], {
          wrapAround: true,
        });

        // Should stay on same node
        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe('only');
      });

      it('should handle disconnected nodes (no edges)', () => {
        const disconnectedNodes = [
          createNode('isolated1', 0, 0),
          createNode('isolated2', 500, 0),
        ];

        const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
        const result = handleKeyboardNavigation(event, 'isolated1', disconnectedNodes, [], {
          followEdges: true,
        });

        // Should fall back to spatial proximity
        expect(result.handled).toBe(true);
        expect(result.focusNodeId).toBe('isolated2');
      });

      it('should ignore unrecognized keys', () => {
        const event = new KeyboardEvent('keydown', { key: 'a' });
        const result = handleKeyboardNavigation(event, 'node1', nodes, edges);

        expect(result.handled).toBe(false);
        expect(result.focusNodeId).toBe(null);
      });
    });
  });

  describe('getNodeAriaLabel', () => {
    const nodes: Node[] = [
      createNode('node1', 0, 0, 'action'),
      createNode('node2', 200, 0, 'condition'),
      createNode('node3', 400, 0, 'terminal'),
    ];

    const edges: Edge[] = [
      createEdge('edge1', 'node1', 'node2'),
      createEdge('edge2', 'node2', 'node3'),
    ];

    it('should generate basic label for node', () => {
      const label = getNodeAriaLabel(nodes[0], nodes, edges);

      expect(label).toContain('action node');
      expect(label).toContain('Node node1');
    });

    it('should include connection count', () => {
      const label = getNodeAriaLabel(nodes[1], nodes, edges);

      expect(label).toContain('1 incoming connection');
      expect(label).toContain('1 outgoing connection');
    });

    it('should pluralize connections correctly', () => {
      const multiEdges = [
        ...edges,
        createEdge('edge3', 'node1', 'node2'),
        createEdge('edge4', 'node2', 'node3'),
      ];

      const label = getNodeAriaLabel(nodes[1], nodes, multiEdges);

      expect(label).toContain('2 incoming connections');
      expect(label).toContain('2 outgoing connections');
    });

    it('should include position in workflow', () => {
      const label = getNodeAriaLabel(nodes[1], nodes, edges);

      expect(label).toContain('Item 2 of 3');
    });

    it('should include selected state', () => {
      const label = getNodeAriaLabel(nodes[0], nodes, edges, { isSelected: true });

      expect(label).toContain('Selected');
    });

    it('should include executing state', () => {
      const label = getNodeAriaLabel(nodes[0], nodes, edges, { isExecuting: true });

      expect(label).toContain('Executing');
    });

    it('should include error state', () => {
      const label = getNodeAriaLabel(nodes[0], nodes, edges, { hasError: true });

      expect(label).toContain('Error');
    });

    it('should handle node with no connections', () => {
      const isolatedNode = createNode('isolated', 0, 0, 'trigger');
      const label = getNodeAriaLabel(isolatedNode, [isolatedNode], []);

      expect(label).toContain('trigger node');
      expect(label).toContain('Item 1 of 1');
      expect(label).not.toContain('incoming connection');
      expect(label).not.toContain('outgoing connection');
    });
  });

  describe('getKeyboardShortcut', () => {
    it('should return correct shortcuts for actions', () => {
      expect(getKeyboardShortcut('activate')).toBe('Enter');
      expect(getKeyboardShortcut('select')).toBe('Space');
      expect(getKeyboardShortcut('next')).toBe('Tab');
      expect(getKeyboardShortcut('previous')).toBe('Shift+Tab');
      expect(getKeyboardShortcut('first')).toBe('Home');
      expect(getKeyboardShortcut('last')).toBe('End');
      expect(getKeyboardShortcut('dismiss')).toBe('Esc');
    });

    it('should adapt Cmd/Ctrl for platform', () => {
      // Note: Current implementation doesn't use cmdOrCtrl, but kept for future
      const macShortcut = getKeyboardShortcut('activate', 'mac');
      const winShortcut = getKeyboardShortcut('activate', 'windows');

      expect(macShortcut).toBe('Enter');
      expect(winShortcut).toBe('Enter');
    });

    it('should return empty string for unknown action', () => {
      const shortcut = getKeyboardShortcut('unknown' as any);
      expect(shortcut).toBe('');
    });
  });
});
