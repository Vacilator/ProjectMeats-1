/**
 * QuickActionsService Tests
 * 
 * Tests for Quick Actions and Form Submission services:
 * - Quick actions CRUD operations
 * - Form submission lifecycle
 * - Cancel token management
 * - Entity options API
 * - Error handling
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('./apiService', () => ({
  apiClient: mockApiClient,
}));

// axios is still used for CancelToken + isCancel
vi.mock('axios', () => {
  return {
    default: {
      CancelToken: {
        source: vi.fn(() => ({
          token: 'mock-cancel-token',
          cancel: vi.fn(),
        })),
      },
      isCancel: vi.fn((err) => err?.__CANCEL__ === true),
    },
  };
});

import {
  quickActionsService,
  formSubmissionService,
  entityOptionsService,
  cancelTokenManager,
  isRequestCancelled,
} from './quickActionsService';

describe('QuickActionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('quickActionsService', () => {
    describe('getQuickActions', () => {
      it('should fetch quick actions', async () => {
        const mockResponse = {
          data: {
            items: [
              { id: 'qa_1', type: 'form', form_id: 'f1', label: 'New Supplier', icon: 'truck', order: 0 },
            ],
          },
        };
        mockApiClient.get.mockResolvedValue(mockResponse);

        const result = await quickActionsService.getQuickActions();

        expect(mockApiClient.get).toHaveBeenCalledWith('/workflows/quick-actions/', {});
        expect(result.items).toHaveLength(1);
        expect(result.items[0].label).toBe('New Supplier');
      });

      it('should support cancel key for request cancellation', async () => {
        const mockResponse = { data: { items: [] } };
        mockApiClient.get.mockResolvedValue(mockResponse);

        await quickActionsService.getQuickActions('fetch-actions');

        expect(mockApiClient.get).toHaveBeenCalledWith(
          '/workflows/quick-actions/',
          expect.objectContaining({ cancelToken: expect.anything() })
        );
      });
    });

    describe('updateQuickActions', () => {
      it('should update quick actions', async () => {
        const items = [
          { id: 'qa_1', type: 'form' as const, form_id: 'f1', label: 'Updated', icon: 'truck', order: 0 },
        ];
        const mockResponse = { data: { success: true, items } };
        mockApiClient.put.mockResolvedValue(mockResponse);

        const result = await quickActionsService.updateQuickActions(items);

        expect(mockApiClient.put).toHaveBeenCalledWith('/workflows/quick-actions/', { items });
        expect(result.success).toBe(true);
      });
    });

    describe('getAvailableForms', () => {
      it('should fetch available forms as array', async () => {
        const mockForms = [
          { id: 'f1', name: 'Supplier Form', description: 'Add supplier', icon: 'truck', status: 'active' },
        ];
        mockApiClient.get.mockResolvedValue({ data: mockForms });

        const result = await quickActionsService.getAvailableForms();

        expect(mockApiClient.get).toHaveBeenCalledWith('/workflows/available-forms/', {});
        expect(result).toEqual(mockForms);
      });

      it('should handle paginated response', async () => {
        const mockForms = [{ id: 'f1', name: 'Form 1' }];
        mockApiClient.get.mockResolvedValue({ data: { results: mockForms } });

        const result = await quickActionsService.getAvailableForms();

        expect(result).toEqual(mockForms);
      });
    });
  });

  describe('formSubmissionService', () => {
    describe('list', () => {
      it('should list form submissions (array response)', async () => {
        const mockSubmissions = [{ id: 'sub_1', form_name: 'Test Form', status: 'draft' }];
        mockApiClient.get.mockResolvedValue({ data: mockSubmissions });

        const result = await formSubmissionService.list();

        expect(mockApiClient.get).toHaveBeenCalledWith('/workflows/form-submissions/', { params: undefined });
        expect(result).toEqual(mockSubmissions);
      });

      it('should list form submissions (paginated response)', async () => {
        const mockSubmissions = [{ id: 'sub_1', form_name: 'Test Form', status: 'draft' }];
        mockApiClient.get.mockResolvedValue({ data: { count: 1, results: mockSubmissions } });

        const result = await formSubmissionService.list();

        expect(result).toEqual(mockSubmissions);
      });

      it('should filter by status', async () => {
        mockApiClient.get.mockResolvedValue({ data: [] });

        await formSubmissionService.list({ status: 'completed' });

        expect(mockApiClient.get).toHaveBeenCalledWith(
          '/workflows/form-submissions/',
          { params: { status: 'completed' } }
        );
      });
    });

    describe('create', () => {
      it('should create a form submission', async () => {
        const mockSubmission = { id: 'sub_1', form: 'f1', status: 'draft' };
        mockApiClient.post.mockResolvedValue({ data: mockSubmission });

        const result = await formSubmissionService.create('f1');

        expect(mockApiClient.post).toHaveBeenCalledWith('/workflows/form-submissions/', { form: 'f1' });
        expect(result.id).toBe('sub_1');
      });
    });

    describe('get', () => {
      it('should get submission details', async () => {
        const mockSubmission = { id: 'sub_1', form_name: 'Test', status: 'in_progress' };
        mockApiClient.get.mockResolvedValue({ data: mockSubmission });

        const result = await formSubmissionService.get('sub_1');

        expect(mockApiClient.get).toHaveBeenCalledWith('/workflows/form-submissions/sub_1/', {});
        expect(result).toEqual(mockSubmission);
      });
    });

    describe('autoSave', () => {
      it('should auto-save a field value', async () => {
        const mockResponse = { data: { success: true, saved_at: '2026-02-01T00:00:00Z' } };
        mockApiClient.post.mockResolvedValue(mockResponse);

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const result = await formSubmissionService.autoSave('sub_1', 'step_1', 'name', 'Test Value');

        expect(mockApiClient.post).toHaveBeenCalledWith(
          '/workflows/form-submissions/sub_1/auto_save/',
          { step_id: 'step_1', field_key: 'name', value: 'Test Value' },
          expect.objectContaining({ cancelToken: expect.anything() })
        );
        expect(result.success).toBe(true);

        consoleSpy.mockRestore();
      });
    });

    describe('completeStep', () => {
      it('should complete a step', async () => {
        const mockResponse = { data: { success: true, step_status: 'completed', next_step_id: 'step_2' } };
        mockApiClient.post.mockResolvedValue(mockResponse);

        const result = await formSubmissionService.completeStep('sub_1', 'step_1');

        expect(mockApiClient.post).toHaveBeenCalledWith(
          '/workflows/form-submissions/sub_1/complete-step/',
          { step_id: 'step_1' }
        );
        expect(result.success).toBe(true);
        expect(result.next_step_id).toBe('step_2');
      });
    });

    describe('submit', () => {
      it('should submit the form', async () => {
        const mockResponse = { data: { success: true, status: 'completed', completed_at: '2026-02-01' } };
        mockApiClient.post.mockResolvedValue(mockResponse);

        const result = await formSubmissionService.submit('sub_1');

        expect(mockApiClient.post).toHaveBeenCalledWith(
          '/workflows/form-submissions/sub_1/submit/',
          { force: undefined }
        );
        expect(result.status).toBe('completed');
      });

      it('should support force submit', async () => {
        mockApiClient.post.mockResolvedValue({ data: { success: true } });

        await formSubmissionService.submit('sub_1', true);

        expect(mockApiClient.post).toHaveBeenCalledWith(
          '/workflows/form-submissions/sub_1/submit/',
          { force: true }
        );
      });
    });

    describe('cancel', () => {
      it('should cancel a submission', async () => {
        mockApiClient.post.mockResolvedValue({ data: { success: true, status: 'cancelled' } });

        const result = await formSubmissionService.cancel('sub_1');

        expect(mockApiClient.post).toHaveBeenCalledWith('/workflows/form-submissions/sub_1/cancel/');
        expect(result.status).toBe('cancelled');
      });
    });

    describe('delete', () => {
      it('should delete a submission', async () => {
        mockApiClient.delete.mockResolvedValue({});

        await formSubmissionService.delete('sub_1');

        expect(mockApiClient.delete).toHaveBeenCalledWith('/workflows/form-submissions/sub_1/');
      });
    });

    describe('uploadFile', () => {
      it('should upload a file', async () => {
        const mockResponse = { data: { id: 'file_1', name: 'test.pdf', url: '/files/test.pdf', size: 1024 } };
        mockApiClient.post.mockResolvedValue(mockResponse);

        const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
        const result = await formSubmissionService.uploadFile('sub_1', 'document', file);

        expect(mockApiClient.post).toHaveBeenCalledWith(
          '/workflows/form-submissions/sub_1/upload/',
          expect.any(FormData),
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        expect(result.id).toBe('file_1');
      });
    });

    describe('deleteFile', () => {
      it('should delete a file', async () => {
        mockApiClient.delete.mockResolvedValue({});

        await formSubmissionService.deleteFile('sub_1', 'file_1');

        expect(mockApiClient.delete).toHaveBeenCalledWith('/workflows/form-submissions/sub_1/files/file_1/');
      });
    });
  });

  describe('entityOptionsService', () => {
    describe('getOptions', () => {
      it('should fetch entity options', async () => {
        const mockResponse = {
          data: {
            entity_type: 'supplier',
            options: [{ value: '1', label: 'Supplier A' }],
            count: 1,
            can_create: true,
            entity_label: 'Supplier',
            total_count: 10,
            has_more: true,
          },
        };
        mockApiClient.get.mockResolvedValue(mockResponse);

        const result = await entityOptionsService.getOptions('supplier');

        expect(mockApiClient.get).toHaveBeenCalledWith('/workflows/entity-options/supplier/', { params: {} });
        expect(result.options).toHaveLength(1);
      });

      it('should support search and limit params', async () => {
        mockApiClient.get.mockResolvedValue({ data: { options: [] } });

        await entityOptionsService.getOptions('supplier', 'test', 10);

        expect(mockApiClient.get).toHaveBeenCalledWith(
          '/workflows/entity-options/supplier/',
          { params: { q: 'test', limit: '10' } }
        );
      });
    });

    describe('searchOptions', () => {
      it('should search options with query', async () => {
        mockApiClient.get.mockResolvedValue({ data: { options: [] } });

        await entityOptionsService.searchOptions('customer', 'acme');

        expect(mockApiClient.get).toHaveBeenCalledWith(
          '/workflows/entity-options/customer/',
          { params: { q: 'acme' } }
        );
      });
    });

    describe('getQuickCreateFields', () => {
      it('should fetch quick create fields', async () => {
        const mockResponse = {
          data: {
            entity_type: 'supplier',
            entity_label: 'Supplier',
            fields: [{ key: 'name', label: 'Name', type: 'text', required: true }],
          },
        };
        mockApiClient.get.mockResolvedValue(mockResponse);

        const result = await entityOptionsService.getQuickCreateFields('supplier');

        expect(mockApiClient.get).toHaveBeenCalledWith('/workflows/quick-create/supplier/');
        expect(result.fields).toHaveLength(1);
      });
    });

    describe('quickCreate', () => {
      it('should quick-create an entity', async () => {
        const mockResponse = {
          data: { success: true, id: '123', value: '123', label: 'New Supplier', entity_type: 'supplier' },
        };
        mockApiClient.post.mockResolvedValue(mockResponse);

        const result = await entityOptionsService.quickCreate('supplier', { name: 'New Supplier' });

        expect(mockApiClient.post).toHaveBeenCalledWith('/workflows/quick-create/supplier/', { name: 'New Supplier' });
        expect(result.label).toBe('New Supplier');
      });
    });
  });

  describe('cancelTokenManager', () => {
    it('should create cancel tokens', () => {
      const source = cancelTokenManager.create('test-key');
      expect(source).toBeDefined();
      expect(source.token).toBeDefined();
    });

    it('should remove token without error', () => {
      cancelTokenManager.create('remove-test');
      cancelTokenManager.remove('remove-test');
      // No error should be thrown
      expect(true).toBe(true);
    });
  });

  describe('isRequestCancelled', () => {
    it('should use axios.isCancel', () => {
      const error = { __CANCEL__: true };
      isRequestCancelled(error);
      expect(axios.isCancel).toHaveBeenCalledWith(error);
    });
  });
});
