/**
 * System Choice Manager
 * 
 * Admin UI for managing SystemChoiceList (Tier 1 system-wide defaults).
 * Allows superadmins to create/edit choice lists and items.
 * 
 * Features:
 * - CRUD operations for SystemChoiceList
 * - Manage SystemChoiceItem entries
 * - Set display order, enabled/disabled state
 * - Configure list properties (extensible, reorderable)
 * 
 * Phase 3: Tiered Choice Engine
 * Created: 2026-02-23
 * 
 * @module SystemChoiceManager
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import {
  Plus, Edit2, Trash2, Save, GripVertical, Eye, EyeOff,
  Search, Filter
} from 'lucide-react';
import { Modal as AntModal } from 'antd';
import { apiClient } from '../../services/apiService';
import { confirmDialog } from '@/utils/uiDialogs';
import { logger } from '@/utils/logger';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface SystemChoiceList {
  id: string;
  slug: string;
  label: string;
  description?: string;
  category: string;
  is_extensible: boolean;
  is_reorderable: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

interface SystemChoiceItem {
  id: string;
  choice_list: string;
  value: string;
  label: string;
  display_order: number;
  metadata?: Record<string, any>;
  is_active: boolean;
  parent_item?: string;
  created_at: string;
}

interface SystemChoiceManagerProps {
  /** Initial filter by category */
  initialCategory?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export const SystemChoiceManager: React.FC<SystemChoiceManagerProps> = ({
  initialCategory,
}) => {
  const [choiceLists, setChoiceLists] = useState<SystemChoiceList[]>([]);
  const [selectedList, setSelectedList] = useState<SystemChoiceList | null>(null);
  const [items, setItems] = useState<SystemChoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(initialCategory || 'all');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<Partial<SystemChoiceList> | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<SystemChoiceItem> | null>(null);

  /**
   * Load choice lists
   */
  const loadChoiceLists = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/system/choice-lists/');
      setChoiceLists(response.data.results || response.data);
    } catch (error) {
      logger.error('Failed to load choice lists', { component: 'SystemChoiceManager' }, error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load items for a choice list
   */
  const loadItems = useCallback(async (listId: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.get(`/system/choice-lists/${listId}/items/?limit=1000`);
      const raw = response.data as any;
      const data = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
      setItems(data);
    } catch (error) {
      logger.error('Failed to load items', { component: 'SystemChoiceManager' }, error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Initial load
   */
  useEffect(() => {
    loadChoiceLists();
  }, [loadChoiceLists]);

  /**
   * Load items when list is selected
   */
  useEffect(() => {
    if (selectedList) {
      loadItems(selectedList.slug);
    } else {
      setItems([]);
    }
  }, [selectedList, loadItems]);

  /**
   * Filter choice lists
   */
  const filteredLists = useMemo(() => {
    return choiceLists.filter((list) => {
      const matchesSearch = !searchQuery || 
        list.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        list.slug.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || list.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [choiceLists, searchQuery, categoryFilter]);

  /**
   * Get unique categories
   */
  const categories = useMemo(() => {
    const cats = new Set(choiceLists.map(list => list.category));
    return Array.from(cats).sort();
  }, [choiceLists]);

  /**
   * Create/Update choice list
   */
  const handleSaveList = useCallback(async () => {
    if (!editingList) return;

    try {
      if (editingList.id) {
        // Update
        await apiClient.patch(`/system/choice-lists/${editingList.id}/`, editingList);
      } else {
        // Create
        await apiClient.post('/system/choice-lists/', editingList);
      }

      await loadChoiceLists();
      setIsEditModalOpen(false);
      setEditingList(null);
    } catch (error) {
      logger.error('Failed to save list', { component: 'SystemChoiceManager' }, error);
    }
  }, [editingList, loadChoiceLists]);

  /**
   * Delete choice list
   */
  const handleDeleteList = useCallback(async (listId: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete choice list?',
      content: 'Are you sure you want to delete this choice list?',
      okText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await apiClient.delete(`/system/choice-lists/${listId}/`);
      await loadChoiceLists();
      if (selectedList?.id === listId) {
        setSelectedList(null);
      }
    } catch (error) {
      logger.error('Failed to delete list', { component: 'SystemChoiceManager' }, error);
    }
  }, [loadChoiceLists, selectedList]);

  /**
   * Create/Update item
   */
  const handleSaveItem = useCallback(async () => {
    if (!editingItem || !selectedList) return;

    try {
      const itemData = {
        ...editingItem,
        choice_list: selectedList.id,
      };

      if (editingItem.id) {
        // Update
        await apiClient.patch(`/system/choice-items/${editingItem.id}/`, itemData);
      } else {
        // Create
        await apiClient.post('/system/choice-items/', itemData);
      }

      await loadItems(selectedList.slug);
      setIsItemModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      logger.error('Failed to save item', { component: 'SystemChoiceManager' }, error);
    }
  }, [editingItem, selectedList, loadItems]);

  /**
   * Delete item
   */
  const handleDeleteItem = useCallback(async (itemId: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete item?',
      content: 'Are you sure you want to delete this item?',
      okText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await apiClient.delete(`/system/choice-items/${itemId}/`);
      if (selectedList) {
        await loadItems(selectedList.slug);
      }
    } catch (error) {
      logger.error('Failed to delete item', { component: 'SystemChoiceManager' }, error);
    }
  }, [selectedList, loadItems]);

  /**
   * Toggle item active state
   */
  const handleToggleItemActive = useCallback(async (item: SystemChoiceItem) => {
    try {
      await apiClient.patch(`/system/choice-items/${item.id}/`, {
        is_active: !item.is_active,
      });
      if (selectedList) {
        await loadItems(selectedList.slug);
      }
    } catch (error) {
      logger.error('Failed to toggle item', { component: 'SystemChoiceManager' }, error);
    }
  }, [selectedList, loadItems]);

  /**
   * Render choice list card
   */
  const renderListCard = useCallback((list: SystemChoiceList) => {
    const isSelected = selectedList?.id === list.id;

    return (
      <ListCard
        key={list.id}
        $isSelected={isSelected}
        onClick={() => setSelectedList(list)}
      >
        <ListCardHeader>
          <ListCardTitle>{list.label}</ListCardTitle>
          <ListCardActions onClick={(e) => e.stopPropagation()}>
            <IconButton
              title="Edit list"
              onClick={() => {
                setEditingList(list);
                setIsEditModalOpen(true);
              }}
            >
              <Edit2 size={16} />
            </IconButton>
            <IconButton
              title="Delete list"
              onClick={() => handleDeleteList(list.id)}
            >
              <Trash2 size={16} />
            </IconButton>
          </ListCardActions>
        </ListCardHeader>

        <ListCardMeta>
          <MetaBadge $color="blue">{list.category}</MetaBadge>
          <MetaBadge $color="gray">{list.item_count || 0} items</MetaBadge>
          {list.is_extensible && <MetaBadge $color="green">Extensible</MetaBadge>}
          {list.is_reorderable && <MetaBadge $color="purple">Reorderable</MetaBadge>}
        </ListCardMeta>

        {list.description && (
          <ListCardDescription>{list.description}</ListCardDescription>
        )}

        <ListCardFooter>
          <CodeTag>{list.slug}</CodeTag>
        </ListCardFooter>
      </ListCard>
    );
  }, [selectedList, handleDeleteList]);

  /**
   * Render item row
   */
  const renderItemRow = useCallback((item: SystemChoiceItem) => {
    return (
      <ItemRow key={item.id} $isActive={item.is_active}>
        <ItemDragHandle title="Drag to reorder">
          <GripVertical size={16} />
        </ItemDragHandle>

        <ItemContent>
          <ItemLabel>{item.label}</ItemLabel>
          <ItemValue>{item.value}</ItemValue>
        </ItemContent>

        <ItemActions>
          <IconButton
            title={item.is_active ? 'Disable' : 'Enable'}
            onClick={() => handleToggleItemActive(item)}
          >
            {item.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
          </IconButton>
          <IconButton
            title="Edit item"
            onClick={() => {
              setEditingItem(item);
              setIsItemModalOpen(true);
            }}
          >
            <Edit2 size={16} />
          </IconButton>
          <IconButton
            title="Delete item"
            onClick={() => handleDeleteItem(item.id)}
          >
            <Trash2 size={16} />
          </IconButton>
        </ItemActions>
      </ItemRow>
    );
  }, [handleToggleItemActive, handleDeleteItem]);

  return (
    <Container>
      <Header>
        <HeaderLeft>
          <Title>System Choice Manager</Title>
          <Subtitle>Manage global choice lists (Tier 1 defaults)</Subtitle>
        </HeaderLeft>
        <HeaderRight>
          <Button
            $variant="primary"
            onClick={() => {
              setEditingList({
                slug: '',
                label: '',
                category: 'general',
                is_extensible: true,
                is_reorderable: true,
                is_active: true,
              });
              setIsEditModalOpen(true);
            }}
          >
            <Plus size={16} />
            New Choice List
          </Button>
        </HeaderRight>
      </Header>

      <Toolbar>
        <SearchBox>
          <Search size={16} />
          <SearchInput
            placeholder="Search choice lists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </SearchBox>

        <CategoryFilter>
          <Filter size={16} />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </CategoryFilter>
      </Toolbar>

      <Content>
        <LeftPanel>
          <PanelHeader>
            <PanelTitle>Choice Lists ({filteredLists.length})</PanelTitle>
          </PanelHeader>
          <ListsGrid>
            {isLoading ? (
              <LoadingState>Loading...</LoadingState>
            ) : filteredLists.length === 0 ? (
              <EmptyState>No choice lists found</EmptyState>
            ) : (
              filteredLists.map(renderListCard)
            )}
          </ListsGrid>
        </LeftPanel>

        <RightPanel>
          {selectedList ? (
            <>
              <PanelHeader>
                <PanelTitle>{selectedList.label} Items</PanelTitle>
                <Button
                  $variant="primary"
                  onClick={() => {
                    setEditingItem({
                      value: '',
                      label: '',
                      display_order: items.length,
                      is_active: true,
                    });
                    setIsItemModalOpen(true);
                  }}
                >
                  <Plus size={16} />
                  Add Item
                </Button>
              </PanelHeader>

              <ItemsList>
                {items.length === 0 ? (
                  <EmptyState>No items yet. Add the first one!</EmptyState>
                ) : (
                  items.map(renderItemRow)
                )}
              </ItemsList>
            </>
          ) : (
            <EmptyState>Select a choice list to view items</EmptyState>
          )}
        </RightPanel>
      </Content>

      {/* Edit List Modal */}
      <AntModal
        open={isEditModalOpen}
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingList(null);
        }}
        title={editingList?.id ? 'Edit Choice List' : 'New Choice List'}
        footer={
          <ModalFooter>
            <Button
              $variant="secondary"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingList(null);
              }}
            >
              Cancel
            </Button>
            <Button $variant="primary" onClick={handleSaveList}>
              <Save size={16} />
              Save
            </Button>
          </ModalFooter>
        }
        width={720}
        destroyOnHidden
      >
        {editingList && (
          <Form>
            <FormGroup>
              <Label>Slug (unique identifier)</Label>
              <Input
                value={editingList.slug || ''}
                onChange={(e) => setEditingList({ ...editingList, slug: e.target.value })}
                placeholder="e.g., protein_types"
              />
            </FormGroup>

            <FormGroup>
              <Label>Label (display name)</Label>
              <Input
                value={editingList.label || ''}
                onChange={(e) => setEditingList({ ...editingList, label: e.target.value })}
                placeholder="e.g., Protein Types"
              />
            </FormGroup>

            <FormGroup>
              <Label>Category</Label>
              <Input
                value={editingList.category || ''}
                onChange={(e) => setEditingList({ ...editingList, category: e.target.value })}
                placeholder="e.g., product, order, general"
              />
            </FormGroup>

            <FormGroup>
              <Label>Description (optional)</Label>
              <Textarea
                value={editingList.description || ''}
                onChange={(e) => setEditingList({ ...editingList, description: e.target.value })}
                placeholder="Brief description of this choice list"
                rows={3}
              />
            </FormGroup>

            <FormGroup>
              <CheckboxLabel>
                <input
                  type="checkbox"
                  checked={editingList.is_extensible || false}
                  onChange={(e) => setEditingList({ ...editingList, is_extensible: e.target.checked })}
                />
                Extensible (tenants can add custom items)
              </CheckboxLabel>
            </FormGroup>

            <FormGroup>
              <CheckboxLabel>
                <input
                  type="checkbox"
                  checked={editingList.is_reorderable || false}
                  onChange={(e) => setEditingList({ ...editingList, is_reorderable: e.target.checked })}
                />
                Reorderable (tenants can customize display order)
              </CheckboxLabel>
            </FormGroup>

            <FormGroup>
              <CheckboxLabel>
                <input
                  type="checkbox"
                  checked={editingList.is_active !== false}
                  onChange={(e) => setEditingList({ ...editingList, is_active: e.target.checked })}
                />
                Active
              </CheckboxLabel>
            </FormGroup>
          </Form>
        )}
      </AntModal>

      {/* Edit Item Modal */}
      <AntModal
        open={isItemModalOpen}
        onCancel={() => {
          setIsItemModalOpen(false);
          setEditingItem(null);
        }}
        title={editingItem?.id ? 'Edit Item' : 'New Item'}
        footer={
          <ModalFooter>
            <Button
              $variant="secondary"
              onClick={() => {
                setIsItemModalOpen(false);
                setEditingItem(null);
              }}
            >
              Cancel
            </Button>
            <Button $variant="primary" onClick={handleSaveItem}>
              <Save size={16} />
              Save
            </Button>
          </ModalFooter>
        }
        width={640}
        destroyOnHidden
      >
        {editingItem && (
          <Form>
            <FormGroup>
              <Label>Value (internal key)</Label>
              <Input
                value={editingItem.value || ''}
                onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                placeholder="e.g., BEEF"
              />
            </FormGroup>

            <FormGroup>
              <Label>Label (display text)</Label>
              <Input
                value={editingItem.label || ''}
                onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })}
                placeholder="e.g., Beef"
              />
            </FormGroup>

            <FormGroup>
              <Label>Display Order</Label>
              <Input
                type="number"
                value={editingItem.display_order || 0}
                onChange={(e) => setEditingItem({ ...editingItem, display_order: parseInt(e.target.value) })}
              />
            </FormGroup>

            <FormGroup>
              <CheckboxLabel>
                <input
                  type="checkbox"
                  checked={editingItem.is_active !== false}
                  onChange={(e) => setEditingItem({ ...editingItem, is_active: e.target.checked })}
                />
                Active
              </CheckboxLabel>
            </FormGroup>
          </Form>
        )}
      </AntModal>
    </Container>
  );
};

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgb(var(--color-background-primary));
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const HeaderRight = styled.div`
  display: flex;
  gap: 12px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
`;

const Toolbar = styled.div`
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const SearchBox = styled.div`
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;

  svg {
    color: rgb(var(--color-text-tertiary));
  }
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 8px 0;
  background: transparent;
  border: none;
  font-size: 14px;
  color: rgb(var(--color-text-primary));

  &:focus {
    outline: none;
  }
`;

const CategoryFilter = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;

  svg {
    color: rgb(var(--color-text-tertiary));
  }

  select {
    padding: 8px 0;
    background: transparent;
    border: none;
    font-size: 14px;
    color: rgb(var(--color-text-primary));
    cursor: pointer;

    &:focus {
      outline: none;
    }
  }
`;

const Content = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  flex: 1;
  overflow: hidden;
  background: rgb(var(--color-border));
`;

const LeftPanel = styled.div`
  display: flex;
  flex-direction: column;
  background: rgb(var(--color-background-primary));
  overflow: hidden;
`;

const RightPanel = styled.div`
  display: flex;
  flex-direction: column;
  background: rgb(var(--color-background-primary));
  overflow: hidden;
`;

const PanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const PanelTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const ListsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  padding: 24px;
  overflow-y: auto;
`;

const ListCard = styled.div<{ $isSelected: boolean }>`
  padding: 16px;
  background: rgb(var(--color-background-secondary));
  border: 2px solid ${props => props.$isSelected ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const ListCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
`;

const ListCardTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const ListCardActions = styled.div`
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;

  ${ListCard}:hover & {
    opacity: 1;
  }
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgb(var(--color-background-tertiary));
    color: rgb(var(--color-text-primary));
  }
`;

const ListCardMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
`;

const MetaBadge = styled.span<{ $color: string }>`
  padding: 4px 8px;
  background: ${props => {
    switch (props.$color) {
      case 'blue': return 'rgba(var(--color-info), 0.1)';
      case 'green': return 'rgba(var(--color-success), 0.1)';
      case 'purple': return 'rgba(168, 85, 247, 0.1)';
      case 'gray':
      default: return 'rgba(var(--color-neutral), 0.1)';
    }
  }};
  color: ${props => {
    switch (props.$color) {
      case 'blue': return 'rgb(var(--color-info))';
      case 'green': return 'rgb(var(--color-success))';
      case 'purple': return 'rgb(168, 85, 247)';
      case 'gray':
      default: return 'rgb(var(--color-neutral))';
    }
  }};
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
`;

const ListCardDescription = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 12px;
  line-height: 1.5;
`;

const ListCardFooter = styled.div`
  display: flex;
  gap: 8px;
`;

const CodeTag = styled.code`
  padding: 4px 8px;
  background: rgb(var(--color-background-tertiary));
  color: rgb(var(--color-text-tertiary));
  font-size: 12px;
  font-family: 'Courier New', monospace;
  border-radius: 4px;
`;

const ItemsList = styled.div`
  display: flex;
  flex-direction: column;
  padding: 16px 24px;
  gap: 8px;
  overflow-y: auto;
`;

const ItemRow = styled.div<{ $isActive: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  opacity: ${props => props.$isActive ? 1 : 0.5};
  transition: all 0.2s;

  &:hover {
    border-color: rgb(var(--color-primary));
  }
`;

const ItemDragHandle = styled.div`
  color: rgb(var(--color-text-tertiary));
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
`;

const ItemContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ItemLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const ItemValue = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  font-family: 'Courier New', monospace;
`;

const ItemActions = styled.div`
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;

  ${ItemRow}:hover & {
    opacity: 1;
  }
`;

const LoadingState = styled.div`
  grid-column: 1 / -1;
  padding: 48px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
`;

const EmptyState = styled.div`
  grid-column: 1 / -1;
  padding: 48px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
`;

const Button = styled.button<{ $variant: 'primary' | 'secondary' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: ${props => props.$variant === 'primary' ? 'rgb(var(--color-primary))' : 'rgb(var(--color-background-secondary))'};
  color: ${props => props.$variant === 'primary' ? 'white' : 'rgb(var(--color-text-primary))'};
  border: 1px solid ${props => props.$variant === 'primary' ? 'transparent' : 'rgb(var(--color-border))'};
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const Input = styled.input`
  padding: 10px 12px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const Textarea = styled.textarea`
  padding: 10px 12px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  transition: all 0.2s;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  cursor: pointer;

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
`;

export default SystemChoiceManager;
