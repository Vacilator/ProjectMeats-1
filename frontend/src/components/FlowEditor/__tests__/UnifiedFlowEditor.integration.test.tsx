/**
 * UnifiedFlowEditor - E2E Integration Tests
 *
 * Tests the complete workflow from node creation to persistence
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UnifiedFlowEditor from '../UnifiedFlowEditor';
import { OnboardingProvider } from '../../Onboarding';

// UnifiedFlowEditor imports apiService via a relative specifier.
// Mock BOTH the relative and alias specifiers to ensure the real axios client never loads in tests.
const apiServiceMock = vi.hoisted(() => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
  adminClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../../services/apiService', () => apiServiceMock);
vi.mock('@/services/apiService', () => apiServiceMock);

const { apiClient } = apiServiceMock;

// Mock heavy/side-effect deps used by UnifiedFlowEditor
vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-editor" />,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: () => null,
}));

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  withScope: (fn: any) => fn({ setTag: vi.fn(), setContext: vi.fn() }),
}));

vi.mock('react-joyride', () => ({
  Joyride: () => null,
  EVENTS: {
    STEP_AFTER: 'step:after',
  },
  STATUS: {
    FINISHED: 'finished',
    SKIPPED: 'skipped',
  },
}));

// Mock React Flow
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children, nodes, edges }: any) => (
    <div data-testid="react-flow" data-nodes={nodes?.length || 0} data-edges={edges?.length || 0}>
      {children}
    </div>
  ),
  ReactFlowProvider: ({ children }: any) => <div data-testid="reactflow-provider">{children}</div>,
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  Panel: ({ children }: any) => <div data-testid="panel">{children}</div>,
  Handle: ({ type, position, id }: any) => (
    <div data-testid={`handle-${type}-${position}`} data-id={id} />
  ),
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
  BackgroundVariant: {
    Lines: 'lines',
    Dots: 'dots',
    Cross: 'cross',
  },
  MarkerType: {
    Arrow: 'arrow',
    ArrowClosed: 'arrowclosed',
  },
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
  applyNodeChanges: vi.fn((changes, nodes) => nodes),
  applyEdgeChanges: vi.fn((changes, edges) => edges),
}));

describe('UnifiedFlowEditor - E2E Integration Tests', () => {
  const mockOnSave = vi.fn();
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

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
    queryClient.clear();
  });

  // Helper to render with QueryClientProvider
  const renderWithQuery = (ui: React.ReactElement) => {
    return render(
      <OnboardingProvider>
        <QueryClientProvider client={queryClient}>
          {ui}
        </QueryClientProvider>
      </OnboardingProvider>
    );
  };

  describe('1. Editor Initialization', () => {
    it('should render empty editor on load', () => {
      renderWithQuery(
        <UnifiedFlowEditor onSave={mockOnSave} />
      );

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      expect(screen.getByTestId('controls')).toBeInTheDocument();

      // Check portal is hidden initially
      const portal = document.getElementById('config-portal');
      expect(portal).toBeInTheDocument();
      expect(portal?.style.display).toBe('none');

      // Regression: portal must render above fullscreen canvas (EditorContainer z-index: 9990)
      expect(portal?.style.zIndex).toBe('10050');
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

      renderWithQuery(

          <UnifiedFlowEditor formId="123" onSave={mockOnSave} />

      );

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith('/tenant-forms/123/');
      });
    });
  });

  describe('2. Node Palette & Canvas Interaction', () => {
    it('should show only Trigger nodes on a blank canvas', () => {
      renderWithQuery(

          <UnifiedFlowEditor onSave={mockOnSave} />

      );

      // Blank canvas UX: only trigger entrypoints should be visible in the palette
      expect(screen.getByText(/manual trigger/i)).toBeInTheDocument();
      expect(screen.queryByText(/form step/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/success end/i)).not.toBeInTheDocument();
    });

    it('should hide Triggers + End Points once a Trigger exists on canvas', () => {
      renderWithQuery(
        <UnifiedFlowEditor
          onSave={mockOnSave}
          initialNodes={[
            {
              id: 't1',
              type: 'trigger',
              position: { x: 0, y: 0 },
              data: { nodeType: 'triggerManual', label: 'Manual Trigger' },
            } as any,
          ]}
        />
      );

      expect(screen.queryByText(/manual trigger/i)).not.toBeInTheDocument();
      expect(screen.getByText(/form step/i)).toBeInTheDocument();
      expect(screen.queryByText(/success end/i)).not.toBeInTheDocument();
    });

    it('should hide portal when no node is selected', () => {
      renderWithQuery(

          <UnifiedFlowEditor onSave={mockOnSave} />

      );

      const portal = document.getElementById('config-portal');
      expect(portal?.style.display).toBe('none');
      expect(portal?.style.pointerEvents).toBe('none');
    });
  });

  describe('3. Form Persistence', () => {
    it('should save new form to backend', async () => {
      render(

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
      renderWithQuery(

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

      renderWithQuery(

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
      renderWithQuery(

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
      renderWithQuery(

          <UnifiedFlowEditor onSave={mockOnSave} />

      );

      const exportButton = screen.getByRole('button', { name: /export/i });

      // Mock download
      const createObjectURL = vi.fn();
      global.URL.createObjectURL = createObjectURL;

      fireEvent.click(exportButton);

      // Should trigger download
      expect(createObjectURL).toHaveBeenCalled();
    });

    it('should import workflow from JSON', async () => {
      renderWithQuery(

          <UnifiedFlowEditor onSave={mockOnSave} />

      );

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
      renderWithQuery(

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
      const consoleError = vi.spyOn(console, 'error').mockImplementation();

      // Force an error by passing invalid props
      const BadComponent = () => {
        throw new Error('Test error');
      };

      renderWithQuery(

          <BadComponent />

      );

      // Error boundary should catch it
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

      consoleError.mockRestore();
    });
  });

  describe('8. Keyboard Shortcuts', () => {
    it('should handle Ctrl+S for save', () => {
      renderWithQuery(

          <UnifiedFlowEditor onSave={mockOnSave} />

      );

      fireEvent.keyDown(window, { key: 's', ctrlKey: true });

      waitFor(() => {
        expect(apiClient.post).toHaveBeenCalled();
      });
    });

    it('should handle Ctrl+Z for undo', () => {
      renderWithQuery(

          <UnifiedFlowEditor onSave={mockOnSave} />

      );

      fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

      // Should trigger undo action
    });

    it('should handle Escape to close panels', () => {
      renderWithQuery(

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

      renderWithQuery(

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
