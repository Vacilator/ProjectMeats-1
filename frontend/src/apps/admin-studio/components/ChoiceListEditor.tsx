import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  configService,
  type SystemChoiceList,
} from '../../../services/configService';
import { businessApi } from '@/services/businessApi';
import { confirmDialog } from '@/utils/uiDialogs';
import { logger } from '@/utils/logger';

interface ChoiceListEditorProps {
  listSlug?: string;
  onClose?: () => void;
}

interface EditingItem {
  id?: number;
  value: string;
  label: string;
  is_active: boolean;
  sort_order: number;
  is_new?: boolean;
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

export const ChoiceListEditor: React.FC<ChoiceListEditorProps> = ({
  listSlug,
  onClose,
}) => {
  const [choiceLists, setChoiceLists] = useState<SystemChoiceList[]>([]);
  const [selectedList, setSelectedList] = useState<SystemChoiceList | null>(null);
  const [items, setItems] = useState<EditingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Avoid stale closures in global keyboard listeners.
  // (The keyboard shortcut effect intentionally does not depend on `items`.)
  const handleSaveRef = useRef<(() => Promise<void>) | null>(null);
  const handleAddItemRef = useRef<(() => void) | null>(null);

  // Load choice lists on mount
  const loadChoiceLists = useCallback(async () => {
    try {
      setLoading(true);
      const lists = await configService.getChoiceLists();
      setChoiceLists(lists);

      // If a specific slug was provided, select it
      if (listSlug) {
        const list = lists.find((l) => l.slug === listSlug);
        if (list) {
          setSelectedList(list);
          loadItems(list.slug);
        }
      }
    } catch (err) {
      logger.error('Error loading choice lists:', err);
      setError('Failed to load choice lists');
    } finally {
      setLoading(false);
    }
  }, [listSlug]);

  const loadItems = async (slug: string) => {
    try {
      setLoading(true);
      const list = await configService.getChoiceList(slug);
      setSelectedList(list);
      
      const editingItems: EditingItem[] = (list.items || []).map((item) => ({
        id: item.id,
        value: item.value,
        label: item.label,
        is_active: item.is_active,
        sort_order: item.sort_order,
      }));
      
      setItems(editingItems.sort((a, b) => a.sort_order - b.sort_order));
      setHasChanges(false);
      setError(null);
    } catch (err) {
      logger.error('Error loading items:', err);
      setError('Failed to load choice items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChoiceLists();
  }, [loadChoiceLists]);

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
        if (selectedList && hasChanges && !saving) {
          void handleSaveRef.current?.();
        }
      }
      // Ctrl/Cmd + N: Add new item
      else if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (selectedList) {
          handleAddItemRef.current?.();
        }
      }
      // Escape: Close editor or deselect
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
  }, [selectedList, hasChanges, saving, onClose]);

  const handleSelectList = async (list: SystemChoiceList) => {
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
    loadItems(list.slug);
  };

  const handleAddItem = () => {
    setItems((prevItems) => {
      const newItem: EditingItem = {
        value: '',
        label: '',
        is_active: true,
        sort_order: prevItems.length,
        is_new: true,
      };
      return [...prevItems, newItem];
    });
    setHasChanges(true);
  };

  // Keep ref pointing at the latest implementation for keyboard shortcuts.
  handleAddItemRef.current = handleAddItem;

  const handleItemChange = (index: number, field: keyof EditingItem, value: string | boolean | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-populate label from value if label is empty
    if (field === 'value' && !newItems[index].label) {
      newItems[index].label = String(value);
    }
    
    setItems(newItems);
    setHasChanges(true);
  };

  const handleDeleteItem = async (index: number) => {
    const item = items[index];
    if (item.id) {
      const ok = await confirmDialog({
        title: 'Delete choice?',
        content: `Delete "${item.label}"? This cannot be undone.`,
        okText: 'Delete',
        cancelText: 'Cancel',
        danger: true,
      });
      if (!ok) return;
    }

    const newItems = items.filter((_, i) => i !== index);
    // Recalculate sort orders
    newItems.forEach((item, i) => {
      item.sort_order = i;
    });

    setItems(newItems);
    setHasChanges(true);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newItems = [...items];
    const draggedItem = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);

    // Update sort orders
    newItems.forEach((item, i) => {
      item.sort_order = i;
    });

    setItems(newItems);
    setDraggedIndex(index);
    setHasChanges(true);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = async () => {
    if (!selectedList) return;

    // Validate items
    const emptyValues = items.filter((item) => !item.value.trim());
    if (emptyValues.length > 0) {
      setError('All items must have a value');
      return;
    }

    // Check for duplicate values
    const values = items.map((i) => i.value.toLowerCase());
    const duplicates = values.filter((v, i) => values.indexOf(v) !== i);
    if (duplicates.length > 0) {
      setError(`Duplicate values found: ${[...new Set(duplicates)].join(', ')}`);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Save each item
      for (const item of items) {
        if (item.is_new) {
          // Create new item
          await businessApi.post(`/system/choice-lists/${selectedList.id}/items/`, {
            value: item.value,
            label: item.label || item.value,
            is_active: item.is_active,
            sort_order: item.sort_order,
          });
        } else if (item.id) {
          // Update existing item
          await businessApi.patch(`/system/choice-items/${item.id}/`, {
            value: item.value,
            label: item.label,
            is_active: item.is_active,
            sort_order: item.sort_order,
          });
        }
      }

      // Clear cache and reload
      configService.clearCache();
      await loadItems(selectedList.slug);

      setSuccessMessage('Changes saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setHasChanges(false);
    } catch (err: unknown) {
      logger.error('Error saving items:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save changes';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Keep ref pointing at the latest implementation for keyboard shortcuts.
  handleSaveRef.current = handleSave;

  const handleExportJson = () => {
    if (!selectedList) return;

    const exportData = {
      slug: selectedList.slug,
      name: selectedList.name,
      items: items.map((item) => ({
        value: item.value,
        label: item.label,
        is_active: item.is_active,
        sort_order: item.sort_order,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedList.slug}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const importedItems = data.items || data;

        if (!Array.isArray(importedItems)) {
          throw new Error('Invalid JSON format');
        }

        const newItems: EditingItem[] = importedItems.map((item: { value: string; label?: string; is_active?: boolean }, index: number) => ({
          value: item.value,
          label: item.label || item.value,
          is_active: item.is_active !== false,
          sort_order: index,
          is_new: true,
        }));

        setItems([...items, ...newItems]);
        setHasChanges(true);
        setSuccessMessage(`Imported ${newItems.length} items`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        logger.warn('Choice list JSON import failed', { err });
        setError('Failed to parse JSON file');
      }
    };
    input.click();
  };

  const filteredLists = choiceLists.filter(
    (list) =>
      list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      list.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && !selectedList) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'rgb(var(--color-primary))' }} />
      </div>
    );
  }

  return (
    <div className="flex h-full" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
      {/* Sidebar - List Selection */}
      <div className="w-72 border-r flex flex-col" style={{ background: 'rgb(var(--color-bg-primary))' }}>
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'rgb(var(--color-text-primary))' }}>📋 Choice Lists</h2>
          <input
            type="text"
            placeholder="Search lists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredLists.map((list) => (
            <button type="button"
              key={list.id}
              onClick={() => void handleSelectList(list)}
              className={`w-full text-left p-3 border-b hover:bg-[rgb(var(--color-bg-secondary))] transition-colors ${
                selectedList?.id === list.id ? 'border-l-4' : ''
              }`}
              style={selectedList?.id === list.id ? { background: 'rgb(var(--color-info-bg))', borderLeftColor: 'rgb(var(--color-primary))' } : undefined}
            >
              <div className="font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>{list.name}</div>
              <div className="text-xs font-mono" style={{ color: 'rgb(var(--color-text-tertiary))' }}>{list.slug}</div>
              <div className="flex gap-2 mt-1">
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    background: list.is_extensible ? 'rgb(var(--color-warning-bg))' : 'rgb(var(--color-info-bg))',
                    color: list.is_extensible ? 'rgb(var(--color-warning))' : 'rgb(var(--color-primary))',
                  }}
                >
                  {list.is_extensible ? '🏢' : '🔒'}
                </span>
                {list.is_reorderable && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgb(var(--color-bg-tertiary))', color: 'rgb(var(--color-text-secondary))' }}>
                    ↕️
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content - Item Editor */}
      <div className="flex-1 flex flex-col">
        {selectedList ? (
          <>
            {/* Header */}
            <div className="border-b p-4" style={{ background: 'rgb(var(--color-bg-primary))' }}>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>{selectedList.name}</h1>
                  <p className="text-sm font-mono" style={{ color: 'rgb(var(--color-text-tertiary))' }}>{selectedList.slug}</p>
                  {selectedList.description && (
                    <p className="text-sm mt-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>{selectedList.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={handleImportJson}
                    className="px-3 py-1.5 text-sm rounded hover:bg-[rgb(var(--color-bg-quaternary))] transition-colors" style={{ background: 'rgb(var(--color-bg-tertiary))', color: 'rgb(var(--color-text-secondary))' }}
                  >
                    📥 Import
                  </button>
                  <button type="button"
                    onClick={handleExportJson}
                    className="px-3 py-1.5 text-sm rounded hover:bg-[rgb(var(--color-bg-quaternary))] transition-colors" style={{ background: 'rgb(var(--color-bg-tertiary))', color: 'rgb(var(--color-text-secondary))' }}
                  >
                    📤 Export
                  </button>
                  {onClose && (
                    <button type="button"
                      onClick={onClose}
                      className="px-3 py-1.5 text-sm rounded hover:bg-[rgb(var(--color-bg-quaternary))] transition-colors" style={{ background: 'rgb(var(--color-bg-tertiary))', color: 'rgb(var(--color-text-secondary))' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
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

            {/* Items Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full rounded-lg shadow-sm border" style={{ background: 'rgb(var(--color-bg-primary))' }}>
                <thead>
                  <tr className="text-left text-sm font-medium" style={{ background: 'rgb(var(--color-bg-secondary))', color: 'rgb(var(--color-text-secondary))' }}>
                    <th className="px-4 py-3 w-10" />
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Label</th>
                    <th className="px-4 py-3 w-24 text-center">Active</th>
                    <th className="px-4 py-3 w-20 text-center">Order</th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr
                      key={item.id || `new-${index}`}
                      draggable={selectedList.is_reorderable}
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`border-t hover:bg-[rgb(var(--color-bg-secondary))] transition-colors ${
                        draggedIndex === index ? 'opacity-50' : ''
                      }`}
                      style={{
                        background: draggedIndex === index ? 'rgb(var(--color-info-bg))' : item.is_new ? 'rgb(var(--color-success-bg))' : undefined,
                      }}
                    >
                      <td className="px-4 py-2 cursor-move" style={{ color: 'rgb(var(--color-text-quaternary))' }}>
                        {selectedList.is_reorderable && '⋮⋮'}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={item.value}
                          onChange={(e) => handleItemChange(index, 'value', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm font-mono focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
                          placeholder="value"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => handleItemChange(index, 'label', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
                          placeholder="Display label"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={item.is_active}
                          onChange={(e) => handleItemChange(index, 'is_active', e.target.checked)}
                          className="w-4 h-4 rounded focus:ring-[rgb(var(--color-primary))]" style={{ color: 'rgb(var(--color-primary))' }}
                        />
                      </td>
                      <td className="px-4 py-2 text-center text-sm" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                        {item.sort_order}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button type="button"
                          onClick={() => void handleDeleteItem(index)}
                          className="hover:text-[rgb(var(--color-error))] text-sm" style={{ color: 'rgb(var(--color-error))' }}
                          title="Delete item"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                        No items. Click "Add Item" to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Actions */}
            <div className="border-t p-4 flex justify-between items-center" style={{ background: 'rgb(var(--color-bg-primary))' }}>
              <button type="button"
                onClick={handleAddItem}
                className="px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-quaternary))] transition-colors text-sm font-medium" style={{ background: 'rgb(var(--color-bg-tertiary))', color: 'rgb(var(--color-text-secondary))' }}
              >
                + Add Item
                <KeyboardShortcut keys="⌘N" />
              </button>
              <div className="flex gap-3 items-center">
                {hasChanges && (
                  <span className="text-sm" style={{ color: 'rgb(var(--color-warning))' }}>● Unsaved changes</span>
                )}
                <button type="button"
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
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
            <div className="text-center">
              <div className="text-4xl mb-4">📋</div>
              <p className="text-lg">Select a choice list to edit</p>
              <p className="text-sm mt-2">Choose from the sidebar on the left</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChoiceListEditor;
