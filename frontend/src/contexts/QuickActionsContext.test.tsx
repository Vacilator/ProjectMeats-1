/**
 * QuickActionsContext Tests
 * 
 * Tests for Quick Actions context provider including:
 * - Provider setup and context access
 * - Quick actions loading and caching
 * - CRUD operations (add, remove, reorder)
 * - Form submission flow
 * - Editor and modal state management
 * - Error handling
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickActionsProvider, useQuickActions } from './QuickActionsContext';
import { getAvailableWorkForms } from '@/services/workformsApi';
import { quickActionsService, formSubmissionService } from '../services/quickActionsService';
import { showAlert } from '@/utils/uiDialogs';

// Mock services
vi.mock('@/services/workformsApi', () => ({
  getAvailableWorkForms: vi.fn(),
}));

vi.mock('../services/quickActionsService', () => ({
  quickActionsService: {
    getQuickActions: vi.fn(),
    updateQuickActions: vi.fn(),
    getAvailableForms: vi.fn(),
  },
  formSubmissionService: {
    create: vi.fn(),
  },
}));

vi.mock('@/utils/uiDialogs', () => ({
  showAlert: vi.fn(),
  confirmDialog: vi.fn(),
  promptDialog: vi.fn(),
}));

// Test component to access context
const TestConsumer: React.FC<{ onContext?: (ctx: ReturnType<typeof useQuickActions>) => void }> = ({ onContext }) => {
  const ctx = useQuickActions();
  
  if (onContext) {
    onContext(ctx);
  }
  
  return (
    <div>
      <div data-testid="loading">{ctx.isLoading ? 'loading' : 'ready'}</div>
      <div data-testid="error">{ctx.error || 'none'}</div>
      <div data-testid="actions-count">{ctx.quickActions.length}</div>
      <div data-testid="forms-count">{ctx.availableForms.length}</div>
      <div data-testid="editor-open">{ctx.isEditorOpen ? 'yes' : 'no'}</div>
      <div data-testid="modal-open">{ctx.isFormModalOpen ? 'yes' : 'no'}</div>
      <div data-testid="submission">{ctx.activeSubmission?.id || 'none'}</div>
      <button onClick={ctx.openEditor}>Open Editor</button>
      <button onClick={ctx.closeEditor}>Close Editor</button>
      <button onClick={() => ctx.openFormModal('form-1')}>Open Form</button>
      <button onClick={ctx.closeFormModal}>Close Modal</button>
      <button onClick={ctx.refreshQuickActions}>Refresh</button>
      <button onClick={ctx.closeSubmission}>Close Submission</button>
    </div>
  );
};

describe('QuickActionsContext', () => {
  const mockQuickActions = [
    { id: 'qa_1', type: 'form' as const, form_id: 'form-1', label: 'New Supplier', icon: 'truck', order: 0 },
    { id: 'qa_2', type: 'form' as const, form_id: 'form-2', label: 'New Customer', icon: 'user', order: 1 },
  ];

  const mockAvailableForms = [
    { id: 'form-1', name: 'New Supplier', description: 'Add supplier', icon: 'truck', status: 'active', is_default: false, is_quick_action_enabled: true, step_count: 3 },
    { id: 'form-2', name: 'New Customer', description: 'Add customer', icon: 'user', status: 'active', is_default: false, is_quick_action_enabled: true, step_count: 2 },
  ];

  const mockSubmission = {
    id: 'sub-123',
    tenant: 'tenant-1',
    form: 'form-1',
    form_name: 'New Supplier',
    form_description: 'Add supplier',
    form_icon: 'truck',
    status: 'draft' as const,
    current_step: 'step-1',
    current_step_name: 'Basic Info',
    data: {},
    form_snapshot: {},
    step_submissions: [],
    progress: { completed: 0, total: 3, percent: 0 },
    created_by: 1,
    created_by_name: 'Test User',
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    completed_at: null,
  };

  let localStorageMock: { [key: string]: string };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock localStorage
    localStorageMock = { authToken: 'test-token' };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => localStorageMock[key] || null);
    
    // Default mock responses
    vi.mocked(quickActionsService.getQuickActions).mockResolvedValue({ items: mockQuickActions });
    vi.mocked(quickActionsService.getAvailableForms).mockResolvedValue(mockAvailableForms);
    vi.mocked(getAvailableWorkForms).mockResolvedValue([] as any);
    vi.mocked(quickActionsService.updateQuickActions).mockImplementation(async (items) => ({
      success: true,
      items,
    }));
    vi.mocked(formSubmissionService.create).mockResolvedValue(mockSubmission);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Provider Setup', () => {
    it('should render children', async () => {
      render(
        <QuickActionsProvider>
          <div>Child Content</div>
        </QuickActionsProvider>
      );
      
      expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    it('should throw error when useQuickActions is used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => render(<TestConsumer />)).toThrow('useQuickActions must be used within a QuickActionsProvider');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Initialization', () => {
    it('should load quick actions on mount when authenticated', async () => {
      render(
        <QuickActionsProvider>
          <TestConsumer />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      expect(screen.getByTestId('actions-count')).toHaveTextContent('2');
      expect(screen.getByTestId('forms-count')).toHaveTextContent('2');
    });

    it('should load quick actions on mount when authenticated via JWT accessToken', async () => {
      // Token must look like a non-expired JWT for jwtService.getAccessToken() to return it
      const exp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      localStorageMock = { accessToken: `header.${btoa(JSON.stringify({ exp }))}.sig` };

      render(
        <QuickActionsProvider>
          <TestConsumer />
        </QuickActionsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      expect(quickActionsService.getQuickActions).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('actions-count')).toHaveTextContent('2');
    });

    it('should not load when not authenticated', async () => {
      localStorageMock = {}; // No JWT or legacy token
      
      render(
        <QuickActionsProvider>
          <TestConsumer />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      expect(quickActionsService.getQuickActions).not.toHaveBeenCalled();
      expect(screen.getByTestId('actions-count')).toHaveTextContent('0');
    });

    it('should handle load error gracefully', async () => {
      vi.mocked(quickActionsService.getQuickActions).mockRejectedValue(new Error('Network error'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(
        <QuickActionsProvider>
          <TestConsumer />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      expect(screen.getByTestId('error')).toHaveTextContent('Network error');
      
      consoleSpy.mockRestore();
    });

    it('should handle non-array forms response', async () => {
      vi.mocked(quickActionsService.getAvailableForms).mockResolvedValue(
        { results: mockAvailableForms } as any
      );
      
      render(
        <QuickActionsProvider>
          <TestConsumer />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      // Should handle non-array response gracefully (becomes empty array)
      expect(screen.getByTestId('forms-count')).toHaveTextContent('0');
    });
  });

  describe('Refresh Quick Actions', () => {
    it('should refresh data when called', async () => {
      const user = userEvent.setup();
      
      render(
        <QuickActionsProvider>
          <TestConsumer />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      // Initial load
      expect(quickActionsService.getQuickActions).toHaveBeenCalledTimes(1);
      
      // Trigger refresh
      await user.click(screen.getByText('Refresh'));
      
      await waitFor(() => {
        expect(quickActionsService.getQuickActions).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Update Quick Actions', () => {
    it('should update quick actions', async () => {
      let contextRef: ReturnType<typeof useQuickActions>;
      
      render(
        <QuickActionsProvider>
          <TestConsumer onContext={(ctx) => { contextRef = ctx; }} />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      const newActions = [
        { id: 'qa_3', type: 'form' as const, form_id: 'form-3', label: 'New Order', icon: 'shopping-cart', order: 0 },
      ];
      
      await act(async () => {
        await contextRef!.updateQuickActions(newActions);
      });
      
      expect(quickActionsService.updateQuickActions).toHaveBeenCalledWith(newActions);
    });

    it('should handle update error', async () => {
      vi.mocked(quickActionsService.updateQuickActions).mockRejectedValue(new Error('Update failed'));
      
      let contextRef: ReturnType<typeof useQuickActions>;
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(
        <QuickActionsProvider>
          <TestConsumer onContext={(ctx) => { contextRef = ctx; }} />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      // The update throws, but we need to catch it to prevent unhandled rejection
      let thrownError: Error | null = null;
      await act(async () => {
        try {
          await contextRef!.updateQuickActions([]);
        } catch (err) {
          thrownError = err as Error;
        }
      });
      
      expect(thrownError).not.toBeNull();
      expect(thrownError!.message).toBe('Update failed');
      expect(screen.getByTestId('error')).toHaveTextContent('Update failed');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Add Quick Action', () => {
    it('should add a new quick action from available form', async () => {
      let contextRef: ReturnType<typeof useQuickActions>;
      
      render(
        <QuickActionsProvider>
          <TestConsumer onContext={(ctx) => { contextRef = ctx; }} />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      const newForm = {
        id: 'form-3',
        name: 'New Product',
        description: 'Add product',
        icon: 'box',
        status: 'active',
        is_default: false,
        is_quick_action_enabled: true,
        step_count: 4,
      };
      
      await act(async () => {
        await contextRef!.addQuickAction(newForm);
      });
      
      // Should call updateQuickActions with new action added
      expect(quickActionsService.updateQuickActions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ label: 'New Product', icon: 'box' }),
        ])
      );
    });
  });

  describe('Remove Quick Action', () => {
    it('should remove a quick action by id', async () => {
      let contextRef: ReturnType<typeof useQuickActions>;
      
      render(
        <QuickActionsProvider>
          <TestConsumer onContext={(ctx) => { contextRef = ctx; }} />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      await act(async () => {
        await contextRef!.removeQuickAction('qa_1');
      });
      
      // Should call updateQuickActions without the removed action
      expect(quickActionsService.updateQuickActions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'qa_2' }),
        ])
      );
      
      // Should not contain removed action
      const callArgs = vi.mocked(quickActionsService.updateQuickActions).mock.calls[0][0];
      expect(callArgs.find((a: any) => a.id === 'qa_1')).toBeUndefined();
    });
  });

  describe('Reorder Quick Actions', () => {
    it('should reorder quick actions with updated order values', async () => {
      let contextRef: ReturnType<typeof useQuickActions>;
      
      render(
        <QuickActionsProvider>
          <TestConsumer onContext={(ctx) => { contextRef = ctx; }} />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      // Reverse order
      const reordered = [mockQuickActions[1], mockQuickActions[0]];
      
      await act(async () => {
        await contextRef!.reorderQuickActions(reordered);
      });
      
      // Should call updateQuickActions with new order values
      expect(quickActionsService.updateQuickActions).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'qa_2', order: 0 }),
        expect.objectContaining({ id: 'qa_1', order: 1 }),
      ]);
    });
  });

  describe('Form Submission', () => {
    it('should start a form submission', async () => {
      let contextRef: ReturnType<typeof useQuickActions>;
      
      render(
        <QuickActionsProvider>
          <TestConsumer onContext={(ctx) => { contextRef = ctx; }} />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      await act(async () => {
        const submission = await contextRef!.startFormSubmission('form-1');
        expect(submission.id).toBe('sub-123');
      });
      
      expect(formSubmissionService.create).toHaveBeenCalledWith('form-1');
      expect(screen.getByTestId('submission')).toHaveTextContent('sub-123');
      expect(screen.getByTestId('modal-open')).toHaveTextContent('yes');
    });

    it('should close submission', async () => {
      const user = userEvent.setup();
      let contextRef: ReturnType<typeof useQuickActions>;
      
      render(
        <QuickActionsProvider>
          <TestConsumer onContext={(ctx) => { contextRef = ctx; }} />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      // Start submission
      await act(async () => {
        await contextRef!.startFormSubmission('form-1');
      });
      
      expect(screen.getByTestId('submission')).toHaveTextContent('sub-123');
      
      // Close submission
      await user.click(screen.getByText('Close Submission'));
      
      expect(screen.getByTestId('submission')).toHaveTextContent('none');
    });
  });

  describe('Editor State', () => {
    it('should open editor', async () => {
      const user = userEvent.setup();
      
      render(
        <QuickActionsProvider>
          <TestConsumer />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      expect(screen.getByTestId('editor-open')).toHaveTextContent('no');
      
      await user.click(screen.getByText('Open Editor'));
      
      expect(screen.getByTestId('editor-open')).toHaveTextContent('yes');
    });

    it('should close editor', async () => {
      const user = userEvent.setup();
      
      render(
        <QuickActionsProvider>
          <TestConsumer />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      await user.click(screen.getByText('Open Editor'));
      expect(screen.getByTestId('editor-open')).toHaveTextContent('yes');
      
      await user.click(screen.getByText('Close Editor'));
      expect(screen.getByTestId('editor-open')).toHaveTextContent('no');
    });
  });

  describe('Form Modal State', () => {
    it('should open form modal and create submission', async () => {
      const user = userEvent.setup();
      
      render(
        <QuickActionsProvider>
          <TestConsumer />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      await user.click(screen.getByText('Open Form'));
      
      await waitFor(() => {
        expect(screen.getByTestId('modal-open')).toHaveTextContent('yes');
      });
      
      expect(formSubmissionService.create).toHaveBeenCalledWith('form-1');
    });

    it('should handle form modal open error', async () => {
      const user = userEvent.setup();
      vi.mocked(formSubmissionService.create).mockRejectedValue(new Error('Form not found'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(
        <QuickActionsProvider>
          <TestConsumer />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      await user.click(screen.getByText('Open Form'));
      
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Form not found');
      });
      
      expect(vi.mocked(showAlert)).toHaveBeenCalledWith({
        type: 'error',
        title: 'Error',
        content: 'Form not found',
      });
      
      consoleSpy.mockRestore();
    });

    it('should close form modal and clear submission', async () => {
      const user = userEvent.setup();
      
      render(
        <QuickActionsProvider>
          <TestConsumer />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      // Open modal
      await user.click(screen.getByText('Open Form'));
      
      await waitFor(() => {
        expect(screen.getByTestId('modal-open')).toHaveTextContent('yes');
      });
      
      // Close modal
      await user.click(screen.getByText('Close Modal'));
      
      expect(screen.getByTestId('modal-open')).toHaveTextContent('no');
      expect(screen.getByTestId('submission')).toHaveTextContent('none');
    });
  });

  describe('Empty Items Handling', () => {
    it('should handle empty quick actions response', async () => {
      vi.mocked(quickActionsService.getQuickActions).mockResolvedValue({ items: [] });
      
      render(
        <QuickActionsProvider>
          <TestConsumer />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      expect(screen.getByTestId('actions-count')).toHaveTextContent('0');
    });

    it('should handle null items in response', async () => {
      vi.mocked(quickActionsService.getQuickActions).mockResolvedValue({ items: null as any });
      
      render(
        <QuickActionsProvider>
          <TestConsumer />
        </QuickActionsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      // Should default to empty array
      expect(screen.getByTestId('actions-count')).toHaveTextContent('0');
    });
  });
});
