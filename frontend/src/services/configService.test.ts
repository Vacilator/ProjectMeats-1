/**
 * Tests for Config Service
 *
 * @module services/configService.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from './apiService';

// Mock apiClient
vi.mock('./apiService', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// Import after mocking
import {
  configService,
  clearConfigCache,
  getTenantConfigs,
  getTenantConfigsByCategory,
  createTenantConfig,
  updateTenantConfig,
  deleteTenantConfig,
  resolveConfig,
  resolveConfigs,
  getChoiceList,
  getChoiceItems,
  getChoiceOptions,
  getFieldSchemas,
  getVisibleFields,
  getRequiredFields,
  isFeatureEnabled,
  getFeatureFlags,
  getThemeConfig,
  getBusinessRules,
  TenantConfig,
  SystemChoiceList,
  SystemFieldSchema,
} from './configService';

describe('configService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearConfigCache();
  });

  afterEach(() => {
    clearConfigCache();
  });

  // ===========================================================================
  // Tenant Config Tests
  // ===========================================================================

  describe('getTenantConfigs', () => {
    it('should fetch tenant configs', async () => {
      const mockConfigs: TenantConfig[] = [
        {
          id: '1',
          key: 'ui.theme.primary_color',
          value: '#667eea',
          category: 'UI',
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ];

      vi.mocked(apiClient.get).mockResolvedValue({
        data: { results: mockConfigs },
      });

      const result = await getTenantConfigs();

      expect(apiClient.get).toHaveBeenCalledWith('/system/tenant-configs/');
      expect(result).toEqual(mockConfigs);
    });

    it('should cache tenant configs', async () => {
      const mockConfigs: TenantConfig[] = [
        {
          id: '1',
          key: 'test.key',
          value: 'test',
          category: 'OTHER',
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ];

      vi.mocked(apiClient.get).mockResolvedValue({
        data: { results: mockConfigs },
      });

      // First call
      await getTenantConfigs();
      // Second call should use cache
      await getTenantConfigs();

      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTenantConfigsByCategory', () => {
    it('should fetch configs grouped by category', async () => {
      const mockByCategory = {
        UI: [{ id: '1', key: 'ui.color', value: 'blue', category: 'UI' }],
        BUSINESS: [],
        FEATURES: [],
        INTEGRATIONS: [],
        OTHER: [],
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockByCategory });

      const result = await getTenantConfigsByCategory();

      expect(apiClient.get).toHaveBeenCalledWith(
        '/system/tenant-configs/by_category/'
      );
      expect(result.UI).toHaveLength(1);
    });
  });

  describe('createTenantConfig', () => {
    it('should create a new tenant config', async () => {
      const newConfig = {
        key: 'new.config.key',
        value: 'new value',
        category: 'BUSINESS' as const,
      };
      const createdConfig = {
        id: '123',
        ...newConfig,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: createdConfig });

      const result = await createTenantConfig(newConfig);

      expect(apiClient.post).toHaveBeenCalledWith(
        '/system/tenant-configs/',
        newConfig
      );
      expect(result.id).toBe('123');
    });

    it('should clear cache after creating config', async () => {
      const mockConfigs: TenantConfig[] = [
        {
          id: '1',
          key: 'test',
          value: 'test',
          category: 'OTHER',
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ];

      vi.mocked(apiClient.get).mockResolvedValue({
        data: { results: mockConfigs },
      });
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { id: '2', key: 'new', value: 'new', category: 'OTHER' },
      });

      // Populate cache
      await getTenantConfigs();
      expect(apiClient.get).toHaveBeenCalledTimes(1);

      // Create new config (should clear cache)
      await createTenantConfig({
        key: 'new',
        value: 'new',
        category: 'OTHER',
      });

      // Next call should hit API again
      await getTenantConfigs();
      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateTenantConfig', () => {
    it('should update a tenant config', async () => {
      const updatedConfig = {
        id: '1',
        key: 'updated.key',
        value: 'updated value',
        category: 'UI' as const,
        created_at: '2026-01-01',
        updated_at: '2026-01-02',
      };

      vi.mocked(apiClient.patch).mockResolvedValue({ data: updatedConfig });

      const result = await updateTenantConfig('1', { value: 'updated value' });

      expect(apiClient.patch).toHaveBeenCalledWith('/system/tenant-configs/1/', {
        value: 'updated value',
      });
      expect(result.value).toBe('updated value');
    });
  });

  describe('deleteTenantConfig', () => {
    it('should delete a tenant config', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

      await deleteTenantConfig('123');

      expect(apiClient.delete).toHaveBeenCalledWith(
        '/system/tenant-configs/123/'
      );
    });
  });

  // ===========================================================================
  // Config Resolution Tests
  // ===========================================================================

  describe('resolveConfig', () => {
    it('should resolve config from API', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { value: '#ff0000', source: 'tenant' },
      });

      const result = await resolveConfig<string>('ui.theme.primary_color');

      expect(apiClient.get).toHaveBeenCalledWith('/system/config/resolve/', {
        params: { key: 'ui.theme.primary_color' },
      });
      expect(result.value).toBe('#ff0000');
      expect(result.source).toBe('tenant');
    });

    it('should return default value when config not found', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Not found'));

      const result = await resolveConfig<string>(
        'nonexistent.key',
        'default-value'
      );

      expect(result.value).toBe('default-value');
      expect(result.source).toBe('default');
    });

    it('should cache resolved configs', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { value: 'cached', source: 'system' },
      });

      await resolveConfig('test.key');
      await resolveConfig('test.key');

      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolveConfigs', () => {
    it('should resolve multiple configs', async () => {
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/system/config/resolve/') {
          return Promise.resolve({ data: { value: 'resolved', source: 'system' } });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const result = await resolveConfigs(['key1', 'key2', 'key3']);

      expect(Object.keys(result)).toHaveLength(3);
      expect(result['key1'].value).toBe('resolved');
    });
  });

  // ===========================================================================
  // Choice Lists Tests
  // ===========================================================================

  describe('getChoiceList', () => {
    it('should fetch choice list by slug', async () => {
      const mockChoiceList: SystemChoiceList = {
        id: 1,
        slug: 'protein-types',
        name: 'Protein Types',
        is_extensible: true,
        is_reorderable: true,
        items: [
          {
            id: 1,
            choice_list: 1,
            value: 'beef',
            label: 'Beef',
            is_system: true,
            is_active: true,
            sort_order: 1,
          },
          {
            id: 2,
            choice_list: 1,
            value: 'pork',
            label: 'Pork',
            is_system: true,
            is_active: true,
            sort_order: 2,
          },
        ],
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockChoiceList });

      const result = await getChoiceList('protein-types');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/system/config/choices/protein-types/'
      );
      expect(result.slug).toBe('protein-types');
      expect(result.items).toHaveLength(2);
    });

    it('should cache choice lists', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { id: 1, slug: 'test', name: 'Test', items: [] },
      });

      await getChoiceList('test');
      await getChoiceList('test');

      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getChoiceItems', () => {
    it('should return active items only by default', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          id: 1,
          slug: 'test',
          name: 'Test',
          items: [
            { id: 1, value: 'a', label: 'A', is_active: true, sort_order: 1 },
            { id: 2, value: 'b', label: 'B', is_active: false, sort_order: 2 },
            { id: 3, value: 'c', label: 'C', is_active: true, sort_order: 3 },
          ],
        },
      });

      const result = await getChoiceItems('test');

      expect(result).toHaveLength(2);
      expect(result.map((i) => i.value)).toEqual(['a', 'c']);
    });

    it('should return all items when activeOnly is false', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          id: 1,
          slug: 'test',
          name: 'Test',
          items: [
            { id: 1, value: 'a', label: 'A', is_active: true, sort_order: 1 },
            { id: 2, value: 'b', label: 'B', is_active: false, sort_order: 2 },
          ],
        },
      });

      const result = await getChoiceItems('test', false);

      expect(result).toHaveLength(2);
    });
  });

  describe('getChoiceOptions', () => {
    it('should return sorted options for dropdowns', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          id: 1,
          slug: 'statuses',
          name: 'Statuses',
          items: [
            { id: 3, value: 'c', label: 'C', is_active: true, sort_order: 3 },
            { id: 1, value: 'a', label: 'A', is_active: true, sort_order: 1 },
            { id: 2, value: 'b', label: 'B', is_active: true, sort_order: 2 },
          ],
        },
      });

      const result = await getChoiceOptions('statuses');

      expect(result).toEqual([
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
        { value: 'c', label: 'C' },
      ]);
    });
  });

  // ===========================================================================
  // Field Schema Tests
  // ===========================================================================

  describe('getFieldSchemas', () => {
    it('should fetch field schemas for entity type', async () => {
      const mockSchemas: SystemFieldSchema[] = [
        {
          id: 1,
          entity_type: 'supplier',
          field_name: 'name',
          field_type: 'text',
          label: 'Name',
          is_required: true,
          is_visible: true,
          is_editable: true,
          sort_order: 1,
        },
        {
          id: 2,
          entity_type: 'supplier',
          field_name: 'email',
          field_type: 'email',
          label: 'Email',
          is_required: false,
          is_visible: true,
          is_editable: true,
          sort_order: 2,
        },
      ];

      vi.mocked(apiClient.get).mockResolvedValue({
        data: { results: mockSchemas },
      });

      const result = await getFieldSchemas('supplier');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/system/config/field-schema/supplier/'
      );
      expect(result).toHaveLength(2);
    });

    it('should cache field schemas', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      await getFieldSchemas('customer');
      await getFieldSchemas('customer');

      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getVisibleFields', () => {
    it('should return only visible fields sorted by order', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: [
          { field_name: 'a', is_visible: true, sort_order: 3 },
          { field_name: 'b', is_visible: false, sort_order: 1 },
          { field_name: 'c', is_visible: true, sort_order: 2 },
        ],
      });

      const result = await getVisibleFields('test');

      expect(result).toHaveLength(2);
      expect(result[0].field_name).toBe('c'); // sort_order 2
      expect(result[1].field_name).toBe('a'); // sort_order 3
    });
  });

  describe('getRequiredFields', () => {
    it('should return only required fields', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: [
          { field_name: 'a', is_required: true },
          { field_name: 'b', is_required: false },
          { field_name: 'c', is_required: true },
        ],
      });

      const result = await getRequiredFields('test');

      expect(result).toHaveLength(2);
      expect(result.map((f) => f.field_name)).toEqual(['a', 'c']);
    });
  });

  // ===========================================================================
  // Feature Flags Tests
  // ===========================================================================

  describe('isFeatureEnabled', () => {
    it('should return true for enabled feature', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { value: true, source: 'system' },
      });

      const result = await isFeatureEnabled('ai_assistant.enabled');

      expect(apiClient.get).toHaveBeenCalledWith('/system/config/resolve/', {
        params: { key: 'features.ai_assistant.enabled' },
      });
      expect(result).toBe(true);
    });

    it('should return false for disabled feature', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { value: false, source: 'system' },
      });

      const result = await isFeatureEnabled('disabled_feature');

      expect(result).toBe(false);
    });

    it('should return false when feature not found', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Not found'));

      const result = await isFeatureEnabled('unknown_feature');

      expect(result).toBe(false);
    });
  });

  describe('getFeatureFlags', () => {
    it('should fetch all feature flags', async () => {
      const mockFlags = {
        COCKPIT_V2: true,
        AI_ASSISTANT: false,
        WORKFLOW_ENGINE: true,
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: { flags: mockFlags },
      });

      const result = await getFeatureFlags();

      expect(apiClient.get).toHaveBeenCalledWith('/core/feature-flags/');
      expect(result).toEqual(mockFlags);
    });

    it('should return empty object on error', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Error'));

      const result = await getFeatureFlags();

      expect(result).toEqual({});
    });
  });

  // ===========================================================================
  // UI Helper Tests
  // ===========================================================================

  describe('getThemeConfig', () => {
    it('should fetch theme configuration', async () => {
      vi.mocked(apiClient.get).mockImplementation((url, config) => {
        const key = config?.params?.key;
        if (key === 'ui.theme.primary_color') {
          return Promise.resolve({ data: { value: '#ff0000', source: 'tenant' } });
        }
        if (key === 'ui.theme.secondary_color') {
          return Promise.resolve({ data: { value: '#00ff00', source: 'tenant' } });
        }
        if (key === 'ui.theme.logo_url') {
          return Promise.resolve({ data: { value: '/logo.png', source: 'tenant' } });
        }
        return Promise.reject(new Error('Unknown key'));
      });

      const result = await getThemeConfig();

      expect(result.primaryColor).toBe('#ff0000');
      expect(result.secondaryColor).toBe('#00ff00');
      expect(result.logoUrl).toBe('/logo.png');
    });

    it('should return defaults when config not found', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Not found'));

      const result = await getThemeConfig();

      expect(result.primaryColor).toBe('#667eea');
      expect(result.secondaryColor).toBe('#764ba2');
      expect(result.logoUrl).toBeUndefined();
    });
  });

  describe('getBusinessRules', () => {
    it('should fetch business rules configuration', async () => {
      vi.mocked(apiClient.get).mockImplementation((url, config) => {
        const key = config?.params?.key;
        if (key === 'business.po.auto_approve_threshold') {
          return Promise.resolve({ data: { value: 5000, source: 'tenant' } });
        }
        if (key === 'business.po.require_approval') {
          return Promise.resolve({ data: { value: false, source: 'tenant' } });
        }
        if (key === 'business.currency.default') {
          return Promise.resolve({ data: { value: 'EUR', source: 'tenant' } });
        }
        return Promise.reject(new Error('Unknown key'));
      });

      const result = await getBusinessRules();

      expect(result.poAutoApproveThreshold).toBe(5000);
      expect(result.requirePOApproval).toBe(false);
      expect(result.defaultCurrency).toBe('EUR');
    });
  });

  // ===========================================================================
  // Service Export Tests
  // ===========================================================================

  describe('configService object', () => {
    it('should export all functions', () => {
      expect(configService.getTenantConfigs).toBeDefined();
      expect(configService.getTenantConfigsByCategory).toBeDefined();
      expect(configService.createTenantConfig).toBeDefined();
      expect(configService.updateTenantConfig).toBeDefined();
      expect(configService.deleteTenantConfig).toBeDefined();
      expect(configService.resolveConfig).toBeDefined();
      expect(configService.resolveConfigs).toBeDefined();
      expect(configService.getChoiceList).toBeDefined();
      expect(configService.getChoiceItems).toBeDefined();
      expect(configService.getChoiceOptions).toBeDefined();
      expect(configService.getFieldSchemas).toBeDefined();
      expect(configService.getVisibleFields).toBeDefined();
      expect(configService.getRequiredFields).toBeDefined();
      expect(configService.isFeatureEnabled).toBeDefined();
      expect(configService.getFeatureFlags).toBeDefined();
      expect(configService.getThemeConfig).toBeDefined();
      expect(configService.getBusinessRules).toBeDefined();
      expect(configService.clearCache).toBeDefined();
    });
  });
});
