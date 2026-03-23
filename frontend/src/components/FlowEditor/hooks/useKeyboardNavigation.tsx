import { useCallback, useEffect } from 'react';
import { useReactFlow, Node, Edge } from '@xyflow/react';

/**
 * Custom hook for keyboard navigation and accessibility in React Flow
 * Implements WCAG 2.1 keyboard navigation standards
 */
export const useKeyboardNavigation = (
  nodes: Node[],
  edges: Edge[],
  onNodesChange: (changes: any[]) => void
) => {
  const reactFlowInstance = useReactFlow();

  /**
   * Handle arrow key navigation between nodes
   * WCAG 2.1.1: Keyboard accessible
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Only handle if focus is on canvas or a node
      const target = event.target as HTMLElement;
      const isCanvasFocused = 
        target.classList.contains('react-flow') ||
        target.classList.contains('react-flow__pane') ||
        target.closest('.react-flow__node');

      if (!isCanvasFocused) return;

      const selectedNodes = nodes.filter(node => node.selected);
      
      // If no nodes selected, select first node on Tab
      if (selectedNodes.length === 0 && event.key === 'Tab') {
        event.preventDefault();
        if (nodes.length > 0) {
          const firstNode = nodes[0];
          onNodesChange([
            {
              id: firstNode.id,
              type: 'select',
              selected: true
            }
          ]);
          // Focus the node element
          setTimeout(() => {
            const nodeElement = document.querySelector(
              `[data-id="${firstNode.id}"]`
            ) as HTMLElement;
            nodeElement?.focus();
          }, 0);
        }
        return;
      }

      if (selectedNodes.length === 0) return;

      const currentNode = selectedNodes[0];
      let nextNode: Node | null = null;

      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          event.preventDefault();
          
          // Find nearest node in the direction
          const direction = event.key.replace('Arrow', '').toLowerCase();
          nextNode = findNearestNode(currentNode, nodes, direction);
          
          if (nextNode) {
            // Deselect current, select next
            onNodesChange([
              {
                id: currentNode.id,
                type: 'select',
                selected: false
              },
              {
                id: nextNode.id,
                type: 'select',
                selected: true
              }
            ]);
            
            // Focus and scroll into view
            setTimeout(() => {
              const nodeElement = document.querySelector(
                `[data-id="${nextNode.id}"]`
              ) as HTMLElement;
              if (nodeElement) {
                nodeElement.focus();
                nodeElement.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center'
                });
              }
            }, 0);
          }
          break;

        case 'Delete':
        case 'Backspace':
          event.preventDefault();
          // Delete selected nodes
          if (selectedNodes.length > 0) {
            const deleteChanges = selectedNodes.map(node => ({
              id: node.id,
              type: 'remove'
            }));
            onNodesChange(deleteChanges);
          }
          break;

        case 'Escape':
          event.preventDefault();
          // Deselect all nodes
          const deselectChanges = selectedNodes.map(node => ({
            id: node.id,
            type: 'select',
            selected: false
          }));
          onNodesChange(deselectChanges);
          break;

        case 'Enter':
        case ' ':
          event.preventDefault();
          // Trigger node edit (emit custom event that parent can listen to)
          if (selectedNodes.length === 1) {
            const editEvent = new CustomEvent('node-edit-requested', {
              detail: { nodeId: currentNode.id }
            });
            window.dispatchEvent(editEvent);
          }
          break;

        default:
          break;
      }
    },
    [nodes, onNodesChange]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    handleKeyDown
  };
};

/**
 * Find the nearest node in a given direction
 */
function findNearestNode(
  currentNode: Node,
  allNodes: Node[],
  direction: string
): Node | null {
  const currentX = currentNode.position.x;
  const currentY = currentNode.position.y;

  // Filter nodes based on direction
  let candidateNodes = allNodes.filter(node => {
    if (node.id === currentNode.id) return false;

    switch (direction) {
      case 'up':
        return node.position.y < currentY;
      case 'down':
        return node.position.y > currentY;
      case 'left':
        return node.position.x < currentX;
      case 'right':
        return node.position.x > currentX;
      default:
        return false;
    }
  });

  if (candidateNodes.length === 0) return null;

  // Find the closest node
  candidateNodes.sort((a, b) => {
    const distA = Math.sqrt(
      Math.pow(a.position.x - currentX, 2) +
      Math.pow(a.position.y - currentY, 2)
    );
    const distB = Math.sqrt(
      Math.pow(b.position.x - currentX, 2) +
      Math.pow(b.position.y - currentY, 2)
    );
    return distA - distB;
  });

  return candidateNodes[0];
}

/**
 * Hook to announce changes to screen readers
 * WCAG 4.1.3: Status messages
 */
export const useAriaAnnouncements = () => {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.getElementById('aria-announcer');
    if (announcer) {
      announcer.setAttribute('aria-live', priority);
      announcer.textContent = message;
      
      // Clear after 1 second
      setTimeout(() => {
        announcer.textContent = '';
      }, 1000);
    }
  }, []);

  return { announce };
};
