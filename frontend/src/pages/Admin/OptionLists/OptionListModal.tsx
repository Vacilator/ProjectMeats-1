/**
 * Option List Edit Modal
 * 
 * Modal for editing system choice list items with inline CRUD operations
 */
import React, { useState, useEffect } from 'react';
import { Skeleton } from 'antd';
import styled from 'styled-components';
import { X, Plus, Save, Trash2, ChevronUp, ChevronDown, Lock, Globe, Building } from 'lucide-react';
import Modal from '@/components/Modal/Modal';
import { apiClient } from '@/services/apiService';
import { confirmDialog } from '@/utils/uiDialogs';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface SystemChoiceItem {
  id: string;
  choice_list: string;
  tenant: string | null;
  value: string;
  label: string;
  extra_data: Record<string, any>;
  order: number;
  is_active: boolean;
  is_default: boolean;
  is_system_defined: boolean;
  created_at: string;
  updated_at: string;
}

interface OptionListModalProps {
  listSlug: string;
  listName: string;
  isExtensible: boolean;
  isReorderable: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

// ============================================================================
// Styled Components
// ============================================================================

const ModalContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const Title = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const CloseButton = styled.button`
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  transition: all 0.15s ease;
  
  &:hover {
    background: rgba(var(--color-danger), 0.1);
    color: rgb(var(--color-danger));
  }
  
  svg {
    width: 18px;
    height: 18px;
  }
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const ItemsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
  padding: 4px;
`;

const ItemRow = styled.div<{ $isSystem: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: ${(props) => (props.$isSystem ? 'rgba(var(--color-surface), 0.5)' : 'rgb(var(--color-background))')};
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
  
  &:hover {
    border-color: ${(props) => (props.$isSystem ? 'rgb(var(--color-border))' : 'rgba(var(--color-primary), 0.65)')};
  }
`;

const ReorderControls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ReorderButton = styled.button`
  width: 28px;
  height: 28px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    border-color: rgba(var(--color-primary), 0.55);
    color: rgb(var(--color-primary));
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

const ItemIcon = styled.div<{ $isSystem: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${(props) =>
    props.$isSystem ? 'rgba(var(--color-danger), 0.12)' : 'rgba(var(--color-success), 0.12)'};
  
  svg {
    width: 12px;
    height: 12px;
    color: ${(props) => (props.$isSystem ? 'rgb(var(--color-danger))' : 'rgb(var(--color-success))')};
  }
`;

const ItemInputs = styled.div`
  display: flex;
  flex: 1;
  gap: 12px;
`;

const Input = styled.input<{ $readOnly?: boolean }>`
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  background: ${props => props.$readOnly 
    ? 'rgba(var(--color-surface), 0.5)' 
    : 'rgb(var(--color-surface))'};
  flex: 1;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const DeleteButton = styled.button`
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  transition: all 0.15s ease;
  flex-shrink: 0;
  
  &:hover:not(:disabled) {
    background: rgba(var(--color-danger), 0.1);
    color: rgb(var(--color-danger));
  }
  
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

const AddButton = styled.button`
  width: 100%;
  padding: 12px;
  background: transparent;
  color: rgb(var(--color-primary));
  border: 2px dashed rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.15s ease;
  
  &:hover:not(:disabled) {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.05);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid rgb(var(--color-border));
`;

const InfoText = styled.p`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  margin: 0;
`;

const FooterActions = styled.div`
  display: flex;
  gap: 12px;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.15s ease;
  
  ${props => props.$variant === 'primary' && `
    background: rgb(var(--color-primary));
    color: white;
    
    &:hover:not(:disabled) {
      opacity: 0.9;
    }
  `}
  
  ${props => props.$variant === 'secondary' && `
    background: transparent;
    color: rgb(var(--color-text-secondary));
    border: 1px solid rgb(var(--color-border));
    
    &:hover:not(:disabled) {
      border-color: rgb(var(--color-text-secondary));
      color: rgb(var(--color-text-primary));
    }
  `}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

const LoadingState = styled.div`
  padding: 48px 20px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
`;

// ============================================================================
// Main Component
// ============================================================================

export const OptionListModal: React.FC<OptionListModalProps> = ({
  listSlug,
  listName,
  isExtensible,
  isReorderable,
  isOpen,
  onClose,
  onSave,
}) => {
  const toast = useToast();
  const [items, setItems] = useState<SystemChoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen, listSlug]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/system/choice-lists/${listSlug}/items/?limit=1000`);
      const raw = response.data as any;
      const itemsData = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
      setItems(itemsData);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load items:', error);
      toast.error('Failed to load option list items');
      setItems([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    if (!isExtensible) return;

    const systemItems = items.filter((i) => i.is_system_defined);
    const tenantItems = items.filter((i) => !i.is_system_defined);

    const newItem: SystemChoiceItem = {
      id: `temp-${Date.now()}`,
      choice_list: listSlug,
      tenant: null, // Will be set by backend
      value: '',
      label: '',
      extra_data: {},
      order: tenantItems.length,
      is_active: true,
      is_default: false,
      is_system_defined: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setItems([...systemItems, ...tenantItems, newItem]);
    setHasChanges(true);
  };

  const handleUpdateItem = (id: string, field: 'value' | 'label', value: string) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    setHasChanges(true);
  };

  const moveTenantItem = (fromIndex: number, toIndex: number) => {
    if (!isExtensible || !isReorderable) return;

    const systemItems = items.filter((i) => i.is_system_defined);
    const tenantItems = items.filter((i) => !i.is_system_defined);

    if (toIndex < 0 || toIndex >= tenantItems.length) return;

    const item = tenantItems[fromIndex];
    if (!item) return;

    const nextTenant = [...tenantItems];
    nextTenant.splice(fromIndex, 1);
    nextTenant.splice(toIndex, 0, item);

    setItems([...systemItems, ...nextTenant]);
    setHasChanges(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (!isExtensible) return;

    const confirmed = await confirmDialog({
      title: 'Delete item?',
      content: 'Are you sure you want to delete this item?',
      okText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });

    if (!confirmed) return;

    // If it's a new item (not saved yet), just remove from local state
    if (id.startsWith('temp-')) {
      setItems(items.filter(item => item.id !== id));
      setHasChanges(true);
      return;
    }

    // Otherwise, delete from backend
    try {
      await apiClient.delete(`/system/choice-items/${id}/`);
      setItems(items.filter(item => item.id !== id));
      setHasChanges(true);
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error('Failed to delete item. It may still be in use.');
    }
  };

  const validateTenantItems = (tenantItems: SystemChoiceItem[], systemItems: SystemChoiceItem[]) => {
    const errors: string[] = [];
    const systemValues = new Set(systemItems.map((i) => i.value.trim().toLowerCase()).filter(Boolean));
    const seenTenantValues = new Set<string>();

    for (const item of tenantItems) {
      const value = item.value.trim();
      const label = item.label.trim();

      if (!value || !label) {
        errors.push('All custom items must have both a Value and a Label.');
        break;
      }

      const normalized = value.toLowerCase();
      if (systemValues.has(normalized)) {
        errors.push(`Custom value "${value}" conflicts with a system item.`);
        break;
      }

      if (seenTenantValues.has(normalized)) {
        errors.push(`Duplicate custom value "${value}".`);
        break;
      }

      seenTenantValues.add(normalized);
    }

    return errors;
  };

  const handleSave = async () => {
    if (!isExtensible) return;

    const itemsArray = Array.isArray(items) ? items : [];
    const systemItems = itemsArray.filter((i) => i.is_system_defined);
    const tenantItems = itemsArray.filter((i) => !i.is_system_defined);

    const validation = validateTenantItems(tenantItems, systemItems);
    if (validation.length > 0) {
      toast.error(validation[0]);
      return;
    }

    setSaving(true);
    try {
      const baseOrder = systemItems.reduce((max, i) => Math.max(max, i.order), -1) + 1;

      const promises = tenantItems.map(async (item, index) => {
        const itemData = {
          value: item.value,
          label: item.label,
          order: baseOrder + index,
          is_active: item.is_active,
        };

        if (item.id.startsWith('temp-')) {
          return apiClient.post(`/system/choice-lists/${listSlug}/items/`, itemData);
        }

        return apiClient.patch(`/system/choice-items/${item.id}/`, itemData);
      });

      await Promise.all(promises);

      toast.success('Option list updated');
      setHasChanges(false);
      onSave();
      onClose();
    } catch (error) {
      console.error('Failed to save items:', error);
      toast.error('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    void (async () => {
      if (hasChanges) {
        const confirmed = await confirmDialog({
          title: 'Discard changes?',
          content: 'You have unsaved changes. Discard them?',
          okText: 'Discard',
          cancelText: 'Keep editing',
          danger: true,
        });
        if (confirmed) {
          onClose();
        }
      } else {
        onClose();
      }
    })();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Option List" maxWidth="800px">
      <ModalContent>
        <Header>
          <Title>Edit {listName}</Title>
          <CloseButton onClick={handleClose}>
            <X />
          </CloseButton>
        </Header>

        {loading ? (
          <LoadingState>
            <Skeleton active paragraph={{ rows: 8 }} />
          </LoadingState>
        ) : (
          <>
            <SectionTitle>System items</SectionTitle>
            <ItemsList>
              {items
                .filter((i) => i.is_system_defined)
                .map((item) => (
                  <ItemRow key={item.id} $isSystem={true}>
                    <ReorderControls>
                      <ReorderButton type="button" disabled aria-label="Move item up" title="System items cannot be reordered">
                        <ChevronUp />
                      </ReorderButton>
                      <ReorderButton type="button" disabled aria-label="Move item down" title="System items cannot be reordered">
                        <ChevronDown />
                      </ReorderButton>
                    </ReorderControls>

                    <ItemIcon $isSystem={true}>
                      <Globe />
                    </ItemIcon>

                    <ItemInputs>
                      <Input
                        type="text"
                        value={item.value}
                        disabled
                        $readOnly
                        aria-label="System item value"
                      />
                      <Input
                        type="text"
                        value={item.label}
                        disabled
                        $readOnly
                        aria-label="System item label"
                      />
                    </ItemInputs>

                    <DeleteButton disabled title="System item - cannot delete">
                      <Lock />
                    </DeleteButton>
                  </ItemRow>
                ))}
            </ItemsList>

            <SectionTitle>Custom items</SectionTitle>
            <ItemsList>
              {items
                .filter((i) => !i.is_system_defined)
                .map((item, index, tenantItems) => (
                  <ItemRow key={item.id} $isSystem={false}>
                    <ReorderControls>
                      <ReorderButton
                        type="button"
                        onClick={() => moveTenantItem(index, index - 1)}
                        disabled={!isExtensible || !isReorderable || index === 0 || saving}
                        aria-label="Move item up"
                        title={!isReorderable ? 'Reordering disabled for this list' : 'Move up'}
                      >
                        <ChevronUp />
                      </ReorderButton>
                      <ReorderButton
                        type="button"
                        onClick={() => moveTenantItem(index, index + 1)}
                        disabled={!isExtensible || !isReorderable || index === tenantItems.length - 1 || saving}
                        aria-label="Move item down"
                        title={!isReorderable ? 'Reordering disabled for this list' : 'Move down'}
                      >
                        <ChevronDown />
                      </ReorderButton>
                    </ReorderControls>

                    <ItemIcon $isSystem={false}>
                      <Building />
                    </ItemIcon>

                    <ItemInputs>
                      <Input
                        type="text"
                        placeholder="Value (e.g., 'WAGYU')"
                        value={item.value}
                        onChange={(e) => handleUpdateItem(item.id, 'value', e.target.value)}
                        disabled={!isExtensible || saving}
                        $readOnly={!isExtensible}
                      />
                      <Input
                        type="text"
                        placeholder="Label (e.g., 'Wagyu')"
                        value={item.label}
                        onChange={(e) => handleUpdateItem(item.id, 'label', e.target.value)}
                        disabled={!isExtensible || saving}
                        $readOnly={!isExtensible}
                      />
                    </ItemInputs>

                    <DeleteButton
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={!isExtensible || saving}
                      title={!isExtensible ? 'This list is locked' : 'Delete item'}
                    >
                      <Trash2 />
                    </DeleteButton>
                  </ItemRow>
                ))}
            </ItemsList>

            {isExtensible && (
              <AddButton onClick={handleAddItem} disabled={saving}>
                <Plus /> Add Custom Item
              </AddButton>
            )}
          </>
        )}

        <Footer>
          <InfoText>
            {isExtensible 
              ? 'You can add custom items to this list. System items cannot be modified.'
              : 'This list is system-locked and cannot be modified.'}
          </InfoText>
          <FooterActions>
            <Button $variant="secondary" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              $variant="primary"
              onClick={handleSave}
              disabled={!hasChanges || saving || !isExtensible}
              title={!isExtensible ? 'This list is system-locked' : undefined}
            >
              <Save /> {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </FooterActions>
        </Footer>
      </ModalContent>
    </Modal>
  );
};
