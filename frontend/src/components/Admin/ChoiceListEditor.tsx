/**
 * ChoiceListEditor Component
 * 
 * Admin UI for viewing and editing system choice lists with tenant customization.
 * 
 * Features:
 * - View system-defined items (read-only)
 * - Add/edit/delete tenant-specific items
 * - Drag-to-reorder support
 * - Disable system items per tenant
 * 
 * Usage:
 *   <ChoiceListEditor choiceListSlug="protein_types" />
 */

import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Trash2,
  Pencil,
  GripVertical,
  EyeOff,
  Eye,
  Check,
  X,
} from 'lucide-react';
import { apiClient } from '@/services/apiService';
import { confirmDialog } from '@/utils/uiDialogs';

interface ChoiceItem {
  id: string;
  value: string;
  label: string;
  order: number;
  is_active: boolean;
  is_default: boolean;
  is_system_defined: boolean;
  extra_data?: Record<string, any>;
}

interface ChoiceList {
  id: string;
  slug: string;
  name: string;
  description: string;
  is_extensible: boolean;
  is_reorderable: boolean;
  items: ChoiceItem[];
}

interface SortableItemProps {
  item: ChoiceItem;
  onEdit: (item: ChoiceItem) => void;
  onDelete: (item: ChoiceItem) => void;
  onToggleVisibility: (item: ChoiceItem) => void;
  isReorderable: boolean;
}

const SortableItem: React.FC<SortableItemProps> = ({
  item,
  onEdit,
  onDelete,
  onToggleVisibility,
  isReorderable,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-3 p-3 border rounded-lg ${
        isDragging ? 'shadow-lg' : 'shadow-sm'
      } ${!item.is_active ? 'opacity-50' : ''}`}
      style={{ ...style, background: 'rgb(var(--color-bg-primary))' }}
    >
      {/* Drag handle */}
      {isReorderable && (
        <button type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing"
          style={{ color: 'rgb(var(--color-text-quaternary))' }}
        >
          <GripVertical className="w-5 h-5" />
        </button>
      )}

      {/* Item info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>{item.label}</span>
          {item.is_default && (
            <span className="px-2 py-0.5 text-xs rounded" style={{ background: 'rgba(var(--color-info), 0.1)', color: 'rgb(var(--color-info))' }}>
              Default
            </span>
          )}
          {item.is_system_defined ? (
            <span className="px-2 py-0.5 text-xs rounded" style={{ background: 'rgb(var(--color-bg-secondary))', color: 'rgb(var(--color-text-secondary))' }}>
              System
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs rounded" style={{ background: 'rgba(var(--color-success), 0.1)', color: 'rgb(var(--color-success))' }}>
              Custom
            </span>
          )}
        </div>
        <div className="text-sm" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
          Value: <code className="px-1 rounded" style={{ background: 'rgb(var(--color-bg-secondary))' }}>{item.value}</code>
        </div>
        {item.extra_data?.description && (
          <div className="text-xs mt-1" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
            {item.extra_data.description}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {item.is_system_defined ? (
          // System items: can only toggle visibility
          <button type="button"
            onClick={() => onToggleVisibility(item)}
            className="p-2 rounded"
            style={{ color: 'rgb(var(--color-text-quaternary))' }}
            title={item.is_active ? 'Hide for tenant' : 'Show for tenant'}
          >
            {item.is_active ? (
              <Eye className="w-5 h-5" />
            ) : (
              <EyeOff className="w-5 h-5" />
            )}
          </button>
        ) : (
          // Tenant items: can edit and delete
          <>
            <button type="button"
              onClick={() => onEdit(item)}
              className="p-2 rounded"
              style={{ color: 'rgb(var(--color-primary))' }}
              title="Edit"
            >
              <Pencil className="w-5 h-5" />
            </button>
            <button type="button"
              onClick={() => onDelete(item)}
              className="p-2 rounded"
              style={{ color: 'rgb(var(--color-error))' }}
              title="Delete"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

interface ChoiceListEditorProps {
  choiceListSlug: string;
}

export const ChoiceListEditor: React.FC<ChoiceListEditorProps> = ({
  choiceListSlug,
}) => {
  const [choiceList, setChoiceList] = useState<ChoiceList | null>(null);
  const [items, setItems] = useState<ChoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<ChoiceItem | null>(null);
  const [newItem, setNewItem] = useState({ value: '', label: '' });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadChoiceList();
  }, [choiceListSlug]);

  const loadChoiceList = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(
        `/system/choice-lists/${choiceListSlug}/`
      );
      setChoiceList(response.data);
      
      // Load items with tenant filtering
      const itemsResponse = await apiClient.get(
        `/system/choice-lists/${choiceListSlug}/items/`
      );
      // Ensure itemsResponse.data is always an array
      const itemsData = Array.isArray(itemsResponse.data) ? itemsResponse.data : [];
      setItems(itemsData);
      setError(null);
    } catch (err: unknown) {
      const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = (resp.data && typeof resp.data === 'object' ? resp.data : {}) as Record<string, unknown>;
      setError((typeof data.error === 'string' ? data.error : '') || 'Failed to load choice list');
      setItems([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !choiceList?.is_reorderable) {
      return;
    }

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    const reorderedItems = arrayMove(items, oldIndex, newIndex);
    setItems(reorderedItems);

    // Update order on server
    try {
      const updates = reorderedItems.map((item, index) => ({
        id: item.id,
        order: (index + 1) * 10,
      }));

      await apiClient.post(
        `/system/choice-lists/${choiceListSlug}/reorder/`,
        { items: updates }
      );
    } catch (err: unknown) {
      setError('Failed to reorder items');
      loadChoiceList(); // Reload to restore original order
    }
  };

  const handleAddItem = async () => {
    if (!newItem.value || !newItem.label) {
      setError('Value and label are required');
      return;
    }

    try {
      await apiClient.post(
        `/system/choice-lists/${choiceListSlug}/items/`,
        {
          value: newItem.value.toUpperCase(),
          label: newItem.label,
          order: (items.length + 1) * 10,
        }
      );
      setNewItem({ value: '', label: '' });
      setIsAddingItem(false);
      loadChoiceList();
    } catch (err: unknown) {
      const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = (resp.data && typeof resp.data === 'object' ? resp.data : {}) as Record<string, unknown>;
      setError((typeof data.error === 'string' ? data.error : '') || 'Failed to add item');
    }
  };

  const handleEditItem = async () => {
    if (!editingItem) return;

    try {
      await apiClient.patch(
        `/system/choice-items/${editingItem.id}/`,
        {
          label: editingItem.label,
          is_active: editingItem.is_active,
        }
      );
      setEditingItem(null);
      loadChoiceList();
    } catch (err: unknown) {
      setError('Failed to update item');
    }
  };

  const handleDeleteItem = async (item: ChoiceItem) => {
    const confirmed = await confirmDialog({
      title: 'Delete item?',
      content: `Delete "${item.label}"?`,
      okText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await apiClient.delete(`/system/choice-items/${item.id}/`);
      loadChoiceList();
    } catch (err: unknown) {
      setError('Failed to delete item');
    }
  };

  const handleToggleVisibility = async (item: ChoiceItem) => {
    // For system items, we need to use choice overrides
    // This is a simplified implementation - full version would use TenantChoiceOverride
    try {
      await apiClient.patch(`/system/choice-items/${item.id}/`, {
        is_active: !item.is_active,
      });
      loadChoiceList();
    } catch (err: unknown) {
      setError('Failed to toggle visibility');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'rgb(var(--color-primary))' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg" style={{ background: 'rgba(var(--color-error), 0.05)', border: '1px solid rgba(var(--color-error), 0.2)' }}>
        <p style={{ color: 'rgb(var(--color-error))' }}>{error}</p>
        <button type="button"
          onClick={loadChoiceList}
          className="mt-2 underline"
          style={{ color: 'rgb(var(--color-error))' }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!choiceList) {
    return (
      <div className="p-4 rounded-lg" style={{ background: 'rgba(var(--color-warning), 0.05)', border: '1px solid rgba(var(--color-warning), 0.2)' }}>
        <p style={{ color: 'rgb(var(--color-warning))' }}>Choice list not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>{choiceList.name}</h2>
          <p className="mt-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>{choiceList.description}</p>
          <div className="flex gap-2 mt-2">
            {choiceList.is_extensible && (
              <span className="px-2 py-1 text-xs rounded" style={{ background: 'rgba(var(--color-success), 0.1)', color: 'rgb(var(--color-success))' }}>
                Extensible
              </span>
            )}
            {choiceList.is_reorderable && (
              <span className="px-2 py-1 text-xs rounded" style={{ background: 'rgba(var(--color-info), 0.1)', color: 'rgb(var(--color-info))' }}>
                Reorderable
              </span>
            )}
          </div>
        </div>

        {choiceList.is_extensible && !isAddingItem && (
          <button type="button"
            onClick={() => setIsAddingItem(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg"
            style={{ background: 'rgb(var(--color-primary))', color: 'rgb(var(--color-text-inverse))' }}
          >
            <Plus className="w-5 h-5" />
            Add Custom Item
          </button>
        )}
      </div>

      {/* Add item form */}
      {isAddingItem && (
        <div className="p-4 border rounded-lg space-y-3" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
          <h3 className="font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>Add Custom Item</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                Value (CODE)
              </label>
              <input
                type="text"
                value={newItem.value}
                onChange={(e) =>
                  setNewItem({ ...newItem, value: e.target.value })
                }
                placeholder="e.g., WAGYU"
                className="w-full px-3 py-2 border rounded-lg"
                style={{ borderColor: 'rgb(var(--color-border))' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                Label (Display)
              </label>
              <input
                type="text"
                value={newItem.label}
                onChange={(e) =>
                  setNewItem({ ...newItem, label: e.target.value })
                }
                placeholder="e.g., Wagyu Beef"
                className="w-full px-3 py-2 border rounded-lg"
                style={{ borderColor: 'rgb(var(--color-border))' }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button"
              onClick={handleAddItem}
              className="flex items-center gap-2 px-4 py-2 rounded-lg"
              style={{ background: 'rgb(var(--color-primary))', color: 'rgb(var(--color-text-inverse))' }}
            >
              <Check className="w-5 h-5" />
              Save
            </button>
            <button type="button"
              onClick={() => {
                setIsAddingItem(false);
                setNewItem({ value: '', label: '' });
              }}
              className="px-4 py-2 rounded-lg"
              style={{ background: 'rgb(var(--color-bg-secondary))', color: 'rgb(var(--color-text-secondary))', border: '1px solid rgb(var(--color-border))' }}
            >
              <X className="w-5 h-5" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit item modal */}
      {editingItem && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(var(--color-overlay), 0.5)' }}>
          <div className="rounded-lg p-6 max-w-md w-full" style={{ background: 'rgb(var(--color-bg-primary))' }}>
            <h3 className="text-lg font-medium mb-4" style={{ color: 'rgb(var(--color-text-primary))' }}>Edit Item</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  Label
                </label>
                <input
                  type="text"
                  value={editingItem.label}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, label: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                  style={{ borderColor: 'rgb(var(--color-border))' }}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button type="button"
                  onClick={handleEditItem}
                  className="flex-1 px-4 py-2 rounded-lg"
                  style={{ background: 'rgb(var(--color-primary))', color: 'rgb(var(--color-text-inverse))' }}
                >
                  Save
                </button>
                <button type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 px-4 py-2 rounded-lg"
                  style={{ background: 'rgb(var(--color-bg-secondary))', color: 'rgb(var(--color-text-secondary))', border: '1px solid rgb(var(--color-border))' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wider" style={{ color: 'rgb(var(--color-text-secondary))' }}>
          Items ({items.length})
        </h3>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                onEdit={setEditingItem}
                onDelete={handleDeleteItem}
                onToggleVisibility={handleToggleVisibility}
                isReorderable={choiceList.is_reorderable}
              />
            ))}
          </SortableContext>
        </DndContext>

        {items.length === 0 && (
          <div className="text-center py-12" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
            No items yet. Add your first custom item above.
          </div>
        )}
      </div>
    </div>
  );
};

export default ChoiceListEditor;
