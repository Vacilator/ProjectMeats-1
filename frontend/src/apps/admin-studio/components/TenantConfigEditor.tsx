import React, { useState, useEffect, useCallback } from 'react';
import {
  configService,
  ConfigCategory,
  ConfigByCategory,
} from '../../../services/configService';
import { confirmDialog } from '@/utils/uiDialogs';
import { logger } from '@/utils/logger';

interface TenantConfigEditorProps {
  onClose?: () => void;
}

interface EditingConfig {
  id?: string;
  key: string;
  value: unknown;
  category: ConfigCategory;
  description: string;
  is_new?: boolean;
  is_modified?: boolean;
}

// Keyboard shortcut display component
const KeyboardShortcut: React.FC<{ keys: string }> = ({ keys }) => (
  <kbd style={{
    display: 'inline-block',
    padding: '0.125rem 0.375rem',
    fontSize: '0.65rem',
    fontFamily: 'monospace',
    backgroundColor: 'rgba(var(--color-overlay), 0.05)',
    border: '1px solid rgba(var(--color-overlay), 0.1)',
    borderRadius: '3px',
    marginLeft: '8px',
  }}>{keys}</kbd>
);

const CATEGORIES: ConfigCategory[] = ['UI', 'BUSINESS', 'FEATURES', 'INTEGRATIONS', 'OTHER'];

const CATEGORY_INFO: Record<ConfigCategory, { icon: string; description: string }> = {
  UI: { icon: '🎨', description: 'User interface settings (themes, layouts, branding)' },
  BUSINESS: { icon: '💼', description: 'Business rules and operational settings' },
  FEATURES: { icon: '🚩', description: 'Feature toggles and functionality flags' },
  INTEGRATIONS: { icon: '🔗', description: 'Third-party integrations and APIs' },
  OTHER: { icon: '📦', description: 'Miscellaneous configurations' },
};

export const TenantConfigEditor: React.FC<TenantConfigEditorProps> = ({ onClose }) => {
  const [configsByCategory, setConfigsByCategory] = useState<ConfigByCategory | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ConfigCategory>('UI');
  const [configs, setConfigs] = useState<EditingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [editingValue, setEditingValue] = useState<string | null>(null);

  const loadConfigs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await configService.getTenantConfigsByCategory();
      setConfigsByCategory(data);
      
      // Load configs for selected category
      const categoryConfigs = data[selectedCategory] || [];
      setConfigs(
        categoryConfigs.map((config) => ({
          id: config.id,
          key: config.key,
          value: config.value,
          category: config.category,
          description: config.description || '',
        }))
      );
      setHasChanges(false);
    } catch (err) {
      logger.error('Error loading configs:', err);
      setError('Failed to load configurations');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Allow Ctrl+S even in inputs
        if (!((e.ctrlKey || e.metaKey) && e.key === 's')) {
          return;
        }
      }

      // Ctrl/Cmd + S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && !saving) {
          handleSave();
        }
      }
      // Ctrl/Cmd + N: Add new config
      else if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleAddConfig();
      }
      // Escape: Close editor
      else if (e.key === 'Escape') {
        if (onClose) {
          void (async () => {
            const ok =
              !hasChanges ||
              (await confirmDialog({
                title: 'Discard unsaved changes?',
                content: 'You have unsaved changes. Discard them?',
                okText: 'Discard',
                cancelText: 'Keep editing',
                danger: true,
              }));
            if (ok) {
              onClose();
            }
          })();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, saving, onClose]);

  const handleCategoryChange = async (category: ConfigCategory) => {
    if (hasChanges) {
      const ok = await confirmDialog({
        title: 'Discard unsaved changes?',
        content: 'You have unsaved changes. Discard them?',
        okText: 'Discard',
        cancelText: 'Keep editing',
        danger: true,
      });
      if (!ok) return;
    }
    setSelectedCategory(category);
    setSearchQuery('');
  };

  const handleAddConfig = () => {
    const newConfig: EditingConfig = {
      key: '',
      value: '',
      category: selectedCategory,
      description: '',
      is_new: true,
    };
    setConfigs([newConfig, ...configs]);
    setHasChanges(true);
  };

  const handleConfigChange = (
    index: number,
    field: keyof EditingConfig,
    value: unknown
  ) => {
    const newConfigs = [...configs];
    newConfigs[index] = { ...newConfigs[index], [field]: value, is_modified: true };
    setConfigs(newConfigs);
    setHasChanges(true);
  };

  const handleValueChange = (index: number, rawValue: string) => {
    // Try to parse as JSON, otherwise keep as string
    let parsedValue: unknown = rawValue;
    try {
      parsedValue = JSON.parse(rawValue);
    } catch {
      // Keep as string if not valid JSON
    }
    handleConfigChange(index, 'value', parsedValue);
  };

  const handleDeleteConfig = async (index: number) => {
    const config = configs[index];
    if (config.id) {
      const ok = await confirmDialog({
        title: 'Delete configuration?',
        content: `Delete "${config.key}"? This cannot be undone.`,
        okText: 'Delete',
        cancelText: 'Cancel',
        danger: true,
      });
      if (!ok) return;

      try {
        await configService.deleteTenantConfig(config.id);
        setSuccessMessage('Config deleted successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        logger.error('Error deleting config:', err);
        setError('Failed to delete config');
        return;
      }
    }
    
    const newConfigs = configs.filter((_, i) => i !== index);
    setConfigs(newConfigs);
    setHasChanges(newConfigs.some((c) => c.is_new || c.is_modified));
  };

  const handleSave = async () => {
    // Validate configs
    const emptyKeys = configs.filter((config) => !config.key.trim());
    if (emptyKeys.length > 0) {
      setError('All configs must have a key');
      return;
    }

    // Check for duplicate keys
    const keys = configs.map((c) => c.key.toLowerCase());
    const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (duplicates.length > 0) {
      setError(`Duplicate keys found: ${[...new Set(duplicates)].join(', ')}`);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      for (const config of configs) {
        if (config.is_new) {
          await configService.createTenantConfig({
            key: config.key,
            value: config.value,
            category: config.category,
            description: config.description,
          });
        } else if (config.is_modified && config.id) {
          await configService.updateTenantConfig(config.id, {
            key: config.key,
            value: config.value,
            category: config.category,
            description: config.description,
          });
        }
      }

      await loadConfigs();
      setSuccessMessage('Changes saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setHasChanges(false);
    } catch (err) {
      logger.error('Error saving configs:', err);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const formatValueForDisplay = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const getValueType = (value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  };

  // Export configs as JSON
  const handleExport = () => {
    const exportData = {
      category: selectedCategory,
      exportedAt: new Date().toISOString(),
      configs: configs.map(c => ({
        key: c.key,
        value: c.value,
        description: c.description,
        category: c.category,
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tenant-config-${selectedCategory.toLowerCase()}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSuccessMessage('Configuration exported successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Import configs from JSON
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        if (!importData.configs || !Array.isArray(importData.configs)) {
          setError('Invalid import file format');
          return;
        }
        
        const importedConfigs: EditingConfig[] = importData.configs.map((c: { key: string; value: unknown; description?: string }) => ({
          key: c.key,
          value: c.value,
          category: selectedCategory,
          description: c.description || '',
          is_new: true,
        }));
        
        setConfigs([...importedConfigs, ...configs]);
        setHasChanges(true);
        setSuccessMessage(`Imported ${importedConfigs.length} configs`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        logger.error('Import error:', err);
        setError('Failed to parse import file');
      }
    };
    input.click();
  };

  const filteredConfigs = configs.filter(
    (config) =>
      config.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(config.value).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryCount = (category: ConfigCategory): number => {
    if (!configsByCategory) return 0;
    return configsByCategory[category]?.length || 0;
  };

  if (loading && !configsByCategory) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'rgb(var(--color-primary))' }} />
      </div>
    );
  }

  return (
    <div className="flex h-full" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
      {/* Sidebar - Category Selection */}
      <div className="w-64 border-r flex flex-col" style={{ background: 'rgb(var(--color-bg-primary))' }}>
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>🔧 Config Categories</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {CATEGORIES.map((category) => {
            const info = CATEGORY_INFO[category];
            return (
              <button
                key={category}
                onClick={() => void handleCategoryChange(category)}
                className={`w-full text-left p-4 border-b hover:bg-[rgb(var(--color-bg-secondary))] transition-colors ${
                  selectedCategory === category ? 'border-l-4' : ''
                }`}
                style={selectedCategory === category ? { background: 'rgb(var(--color-info-bg))', borderLeftColor: 'rgb(var(--color-primary))' } : undefined}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{info.icon}</span>
                    <span className="font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>{category}</span>
                  </div>
                  <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgb(var(--color-bg-tertiary))', color: 'rgb(var(--color-text-secondary))' }}>
                    {getCategoryCount(category)}
                  </span>
                </div>
                <p className="text-xs mt-1 ml-7" style={{ color: 'rgb(var(--color-text-tertiary))' }}>{info.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content - Config Editor */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b p-4" style={{ background: 'rgb(var(--color-bg-primary))' }}>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
                {CATEGORY_INFO[selectedCategory].icon} {selectedCategory} Configuration
              </h1>
              <p className="text-sm mt-1" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                {CATEGORY_INFO[selectedCategory].description}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="px-3 py-1.5 text-sm rounded hover:bg-[rgb(var(--color-bg-quaternary))] transition-colors" style={{ background: 'rgb(var(--color-bg-tertiary))', color: 'rgb(var(--color-text-secondary))' }}
                title="Export configs as JSON"
              >
                📤 Export
              </button>
              <button
                onClick={handleImport}
                className="px-3 py-1.5 text-sm rounded hover:bg-[rgb(var(--color-bg-quaternary))] transition-colors" style={{ background: 'rgb(var(--color-bg-tertiary))', color: 'rgb(var(--color-text-secondary))' }}
                title="Import configs from JSON"
              >
                📥 Import
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-sm rounded hover:bg-[rgb(var(--color-bg-quaternary))] transition-colors" style={{ background: 'rgb(var(--color-bg-tertiary))', color: 'rgb(var(--color-text-secondary))' }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="mt-4">
            <input
              type="text"
              placeholder="Search configs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
            />
          </div>

          {/* Status Messages */}
          {error && (
            <div className="mt-3 p-3 border rounded-lg text-sm" style={{ background: 'rgb(var(--color-error-bg))', borderColor: 'rgb(var(--color-error))', color: 'rgb(var(--color-error))' }}>
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mt-3 p-3 border rounded-lg text-sm" style={{ background: 'rgb(var(--color-success-bg))', borderColor: 'rgb(var(--color-success))', color: 'rgb(var(--color-success))' }}>
              {successMessage}
            </div>
          )}
        </div>

        {/* Config List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {filteredConfigs.map((config, index) => (
              <div
                key={config.id || `new-${index}`}
                className={`border rounded-lg overflow-hidden`}
                style={{
                  background: config.is_new ? 'rgb(var(--color-success-bg))' : 'rgb(var(--color-bg-primary))',
                  borderColor: config.is_new ? 'rgb(var(--color-success))' : config.is_modified ? 'rgb(var(--color-warning))' : undefined,
                }}
              >
                <div className="p-4">
                  {/* Key Row */}
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-text-tertiary))' }}>Key</label>
                      <input
                        type="text"
                        value={config.key}
                        onChange={(e) => handleConfigChange(index, 'key', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
                        placeholder="e.g., ui.theme.primary_color"
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-text-tertiary))' }}>Type</label>
                      <span className="inline-block px-3 py-2 rounded-lg text-sm" style={{ background: 'rgb(var(--color-bg-tertiary))', color: 'rgb(var(--color-text-secondary))' }}>
                        {getValueType(config.value)}
                      </span>
                    </div>
                    <button
                      onClick={() => void handleDeleteConfig(index)}
                      className="mt-5 hover:text-[rgb(var(--color-error))] p-2" style={{ color: 'rgb(var(--color-error))' }}
                      title="Delete config"
                    >
                      🗑️
                    </button>
                  </div>

                  {/* Value Row */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-text-tertiary))' }}>Value</label>
                    {editingValue === (config.id || `new-${index}`) ? (
                      <textarea
                        value={formatValueForDisplay(config.value)}
                        onChange={(e) => handleValueChange(index, e.target.value)}
                        onBlur={() => setEditingValue(null)}
                        className="w-full px-3 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-[rgb(var(--color-primary))] min-h-[100px]"
                        placeholder="Enter value (JSON or string)"
                        autoFocus
                      />
                    ) : (
                      <div
                        onClick={() => setEditingValue(config.id || `new-${index}`)}
                        className="w-full px-3 py-2 border rounded-lg font-mono text-sm cursor-pointer hover:bg-[rgb(var(--color-bg-tertiary))] min-h-[40px]" style={{ background: 'rgb(var(--color-bg-secondary))' }}
                      >
                        <code style={{ color: 'rgb(var(--color-text-primary))' }}>
                          {formatValueForDisplay(config.value) || (
                            <span className="italic" style={{ color: 'rgb(var(--color-text-quaternary))' }}>Click to edit</span>
                          )}
                        </code>
                      </div>
                    )}
                  </div>

                  {/* Description Row */}
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-text-tertiary))' }}>Description</label>
                    <input
                      type="text"
                      value={config.description}
                      onChange={(e) => handleConfigChange(index, 'description', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
                      placeholder="Optional description"
                    />
                  </div>

                  {/* Status badges */}
                  <div className="flex gap-2 mt-3">
                    {config.is_new && (
                      <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgb(var(--color-success-bg))', color: 'rgb(var(--color-success))' }}>
                        New
                      </span>
                    )}
                    {config.is_modified && !config.is_new && (
                      <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgb(var(--color-warning-bg))', color: 'rgb(var(--color-warning))' }}>
                        Modified
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredConfigs.length === 0 && (
              <div className="text-center py-12" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                {searchQuery ? (
                  <p>No configs matching "{searchQuery}"</p>
                ) : (
                  <div>
                    <p className="text-lg mb-2">No configs in this category</p>
                    <p className="text-sm">Click "Add Config" to create one</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t p-4 flex justify-between items-center" style={{ background: 'rgb(var(--color-bg-primary))' }}>
          <button
            onClick={handleAddConfig}
            className="px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-quaternary))] transition-colors text-sm font-medium" style={{ background: 'rgb(var(--color-bg-tertiary))', color: 'rgb(var(--color-text-secondary))' }}
          >
            + Add Config
            <KeyboardShortcut keys="⌘N" />
          </button>
          <div className="flex gap-3 items-center">
            {hasChanges && (
              <span className="text-sm" style={{ color: 'rgb(var(--color-warning))' }}>● Unsaved changes</span>
            )}
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                hasChanges && !saving
                  ? 'text-[rgb(var(--color-text-inverse))] hover:bg-[rgb(var(--color-primary-hover))]'
                  : 'cursor-not-allowed'
              }`}
              style={{
                background: hasChanges && !saving ? 'rgb(var(--color-primary))' : 'rgb(var(--color-bg-quaternary))',
                color: hasChanges && !saving ? undefined : 'rgb(var(--color-text-quaternary))',
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
              <KeyboardShortcut keys="⌘S" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantConfigEditor;
