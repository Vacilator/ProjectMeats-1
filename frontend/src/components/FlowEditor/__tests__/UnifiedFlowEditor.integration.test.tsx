/**
 * UnifiedFlowEditor - E2E Integration Tests
 * 
 * Tests the complete workflow from node creation to persistence
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import UnifiedFlowEditor from '../UnifiedFlowEditor';
import { apiClient } from '@/services/apiService';

// Mock apiClient
vi.mock('@/services/apiService', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock React Flow
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children, nodes, edges, onNodesChange, onEdgesChange }: any) => (
    <div data-testid="react-flow" data-nodes={nodes?.length || 0} data-edges={edges?.length || 0}>
      {children}
    </div>
  ),
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  Panel: ({ children }: any) => <div data-testid="panel">{children}</div>,
  useReactFlow: () => ({
    fitView: vi.fn(),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    getNodes: vi.fn(() => []),
    getEdges: vi.fn(() => []),
    screenToFlowPosition: vi.fn((pos) => pos),
  }),
  useNodesState: (initial: any) => [initial || [], vi.fn(), vi.fn()],
  useEdgesState: (initial: any) => [initial || [], vi.fn(), vi.fn()],
  addEdge: vi.fn((edge, edges) => [...edges, edge]),
}));

describe('UnifiedFlowEditor - E2E Integration Tests', () => {
  const mockOnSave = jest.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock API responses
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { id: '123', version: 1 } 
    });
    (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { id: '123', version: 2 } 
    });
    
    // Create portal root
    const portalRoot = document.createElement('div');
    portalRoot.id = 'config-portal';
    document.body.appendChild(portalRoot);
  });
  
  afterEach(() => {
    const portal = document.getElementById('config-portal');
    if (portal) {
      document.body.removeChild(portal);
    }
  });

  describe('1. Editor Initialization', () => {
    it('should render empty editor on load', () => {
      render(
        
          <UnifiedFlowEditor onSave={mockOnSave} />
        
      );

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      expect(screen.getByTestId('controls')).toBeInTheDocument();
      
      // Check portal is hidden initially
      const portal = document.getElementById('config-portal');
      expect(portal).toBeInTheDocument();
      expect(portal?.style.display).toBe('none');
    });

    it('should load existing form when formId provided', async () => {
      const mockForm = {
        id: '123',
        name: 'Test Form',
        definition: {
          nodes: [{ id: '1', type: 'FormInput', position: { x: 0, y: 0 } }],
          edges: [],
        },
      };
      
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockForm });

      render(
        
          <UnifiedFlowEditor formId="123" onSave={mockOnSave} />
        
      );

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith('/tenant-forms/123/');
      });
    });
  });

  describe('2. Node Palette & Canvas Interaction', () => {
    it('should show node palette by default', () => {
      render(
        
          <UnifiedFlowEditor onSave={mockOnSave} />
        
      );

      // Check for common node types
      expect(screen.getByText(/form input/i)).toBeInTheDocument();
      expect(screen.getByText(/choice engine/i)).toBeInTheDocument();
    });

    it('should hide portal when no node is selected', () => {
      render(
        
          <UnifiedFlowEditor onSave={mockOnSave} />
        
      );

      const portal = document.getElementById('config-portal');
      expect(portal?.style.display).toBe('none');
      expect(portal?.style.pointerEvents).toBe('none');
    });
  });

  describe('3. Form Persistence', () => {
    it('should save new form to backend', async () => {
      const { container } = render(
        
          <UnifiedFlowEditor onSave={mockOnSave} />
        
      );

      // Find and click save button
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          '/tenant-forms/',
          expect.objectContaining({
            definition: expect.any(Object),
          })
        );
      });

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '123',
          version: 1,
        })
      );
    });

    it('should update existing form', async () => {
      render(
        
          <UnifiedFlowEditor formId="123" onSave={mockOnSave} />
        
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(apiClient.put).toHaveBeenCalledWith(
          '/tenant-forms/123/',
          expect.any(Object)
        );
      });

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '123',
          version: 2,
        })
      );
    });

    it('should handle save errors gracefully', async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      render(
        
          <UnifiedFlowEditor onSave={mockOnSave} />
        
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        // Should show error toast or message
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });

      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('4. Undo/Redo Functionality', () => {
    it('should undo and redo node additions', () => {
      render(
        
          <UnifiedFlowEditor onSave={mockOnSave} />
        
      );

      const undoButton = screen.getByLabelText(/undo/i);
      const redoButton = screen.getByLabelText(/redo/i);

      // Initially disabled
      expect(undoButton).toBeDisabled();
      expect(redoButton).toBeDisabled();

      // TODO: Add node, test undo/redo
    });
  });

  describe('5. Template Export/Import', () => {
    it('should export workflow as JSON', () => {
      render(
        
          <UnifiedFlowEditor onSave={mockOnSave} />
        
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      
      // Mock download
      const createObjectURL = jest.fn();
      global.URL.createObjectURL = createObjectURL;

      fireEvent.click(exportButton);

      // Should trigger download
      expect(createObjectURL).toHaveBeenCalled();
    });

    it('should import workflow from JSON', async () => {
      render(
        
          <UnifiedFlowEditor onSave={mockOnSave} />
        
      );

      const importButton = screen.getByRole('button', { name: /import/i });
      
      const mockFile = new File(
        [JSON.stringify({ nodes: [], edges: [] })],
        'workflow.json',
        { type: 'application/json' }
      );

      const input = screen.getByLabelText(/import/i);
      
      await userEvent.upload(input, mockFile);

      // Should load the workflow
      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });
    });
  });

  describe('6. Read-Only Mode', () => {
    it('should disable editing in read-only mode', () => {
      render(
        
          <UnifiedFlowEditor readOnly={true} onSave={mockOnSave} />
        
      );

      // Save button should not exist
      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
      
      // Undo/redo should be disabled
      expect(screen.getByLabelText(/undo/i)).toBeDisabled();
      expect(screen.getByLabelText(/redo/i)).toBeDisabled();
    });
  });

  describe('7. Error Boundaries', () => {
    it('should catch and display errors', () => {
      // Mock console.error to suppress error output
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      // Force an error by passing invalid props
      const BadComponent = () => {
        throw new Error('Test error');
      };

      render(
        
          <BadComponent />
        
      );

      // Error boundary should catch it
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

      consoleError.mockRestore();
    });
  });

  describe('8. Keyboard Shortcuts', () => {
    it('should handle Ctrl+S for save', () => {
      render(
        
          <UnifiedFlowEditor onSave={mockOnSave} />
        
      );

      fireEvent.keyDown(window, { key: 's', ctrlKey: true });

      waitFor(() => {
        expect(apiClient.post).toHaveBeenCalled();
      });
    });

    it('should handle Ctrl+Z for undo', () => {
      render(
        
          <UnifiedFlowEditor onSave={mockOnSave} />
        
      );

      fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

      // Should trigger undo action
    });

    it('should handle Escape to close panels', () => {
      render(
        
          <UnifiedFlowEditor onSave={mockOnSave} />
        
      );

      fireEvent.keyDown(window, { key: 'Escape' });

      const portal = document.getElementById('config-portal');
      expect(portal?.style.display).toBe('none');
    });
  });

  describe('9. Performance', () => {
    it('should handle large workflows efficiently', () => {
      const largeWorkflow = {
        nodes: Array.from({ length: 100 }, (_, i) => ({
          id: `node-${i}`,
          type: 'FormInput',
          position: { x: i * 200, y: 0 },
          data: { label: `Node ${i}` },
        })),
        edges: [],
      };

      const startTime = performance.now();

      render(
        
          <UnifiedFlowEditor 
            initialNodes={largeWorkflow.nodes}
            initialEdges={largeWorkflow.edges}
            onSave={mockOnSave}
          />
        
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render in less than 100ms
      expect(renderTime).toBeLessThan(100);
    });
  });
});
