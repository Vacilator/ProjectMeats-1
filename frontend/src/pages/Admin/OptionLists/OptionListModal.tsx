/**
 * Option List Edit Modal
 * 
 * Modal for editing system choice list items with inline CRUD operations
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { X, Plus, Save, Trash2, GripVertical, Lock, Globe, Building } from 'lucide-react';
import Modal from '../../../components/Modal/Modal';
import { adminClient } from '../../../services/apiService';

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

const ItemsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
  padding: 4px;
`;

const ItemRow = styled.div<{ $isSystem: boolean; $isDragging?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: ${props => props.$isSystem 
    ? 'rgba(var(--color-surface), 0.5)' 
    : 'rgb(var(--color-background))'};
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
  opacity: ${props => props.$isDragging ? 0.5 : 1};
  
  &:hover {
    border-color: ${props => props.$isSystem 
      ? 'rgb(var(--color-border))' 
      : 'rgb(var(--color-primary))'};
  }
`;

const DragHandle = styled.div<{ $disabled: boolean }>`
  cursor: ${props => props.$disabled ? 'not-allowed' : 'grab'};
  color: ${props => props.$disabled 
    ? 'rgb(var(--color-text-tertiary))' 
    : 'rgb(var(--color-text-secondary))'};
  opacity: ${props => props.$disabled ? 0.3 : 1};
  
  &:active {
    cursor: ${props => props.$disabled ? 'not-allowed' : 'grabbing'};
  }
  
  svg {
    width: 16px;
    height: 16px;
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
  background: ${props => props.$isSystem 
    ? 'rgba(239, 68, 68, 0.1)' 
    : 'rgba(34, 197, 94, 0.1)'};
  
  svg {
    width: 12px;
    height: 12px;
    color: ${props => props.$isSystem ? 'rgb(239, 68, 68)' : 'rgb(34, 197, 94)'};
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
  isOpen,
  onClose,
  onSave,
}) => {
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
      const response = await adminClient.get(`/system/choice-lists/${listSlug}/items/`);
      // Ensure response.data is always an array
      const itemsData = Array.isArray(response.data) ? response.data : [];
      setItems(itemsData);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load items:', error);
      setItems([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    const newItem: SystemChoiceItem = {
      id: `temp-${Date.now()}`,
      choice_list: listSlug,
      tenant: null, // Will be set by backend
      value: '',
      label: '',
      extra_data: {},
      order: items.length,
      is_active: true,
      is_default: false,
      is_system_defined: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setItems([...items, newItem]);
    setHasChanges(true);
  };

  const handleUpdateItem = (id: string, field: 'value' | 'label', value: string) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
    setHasChanges(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return;
    }

    // If it's a new item (not saved yet), just remove from local state
    if (id.startsWith('temp-')) {
      setItems(items.filter(item => item.id !== id));
      setHasChanges(true);
      return;
    }

    // Otherwise, delete from backend
    try {
      await adminClient.delete(`/system/choice-items/${id}/`);
      setItems(items.filter(item => item.id !== id));
      setHasChanges(true);
    } catch (error) {
      console.error('Failed to delete item:', error);
      alert('Failed to delete item. It may still be in use.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Ensure items is an array before processing
      const itemsArray = Array.isArray(items) ? items : [];
      
      // Process items one by one
      const promises = itemsArray
        .filter(item => !item.is_system_defined)
        .map(async (item, index) => {
          const itemData = {
            value: item.value,
            label: item.label,
            order: index,
            is_active: item.is_active,
          };

          if (item.id.startsWith('temp-')) {
            // Create new item
            return adminClient.post(`/system/choice-lists/${listSlug}/items/`, itemData);
          } else {
            // Update existing item
            return adminClient.patch(`/system/choice-items/${item.id}/`, itemData);
          }
        });

      await Promise.all(promises);
      
      setHasChanges(false);
      onSave();
      onClose();
    } catch (error) {
      console.error('Failed to save items:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Discard them?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth="800px">
      <ModalContent>
        <Header>
          <Title>Edit {listName}</Title>
          <CloseButton onClick={handleClose}>
            <X />
          </CloseButton>
        </Header>

        {loading ? (
          <LoadingState>Loading items...</LoadingState>
        ) : (
          <>
            <ItemsList>
              {items.map(item => (
                <ItemRow key={item.id} $isSystem={item.is_system_defined}>
                  <DragHandle $disabled={item.is_system_defined}>
                    <GripVertical />
                  </DragHandle>
                  
                  <ItemIcon $isSystem={item.is_system_defined}>
                    {item.is_system_defined ? <Globe /> : <Building />}
                  </ItemIcon>
                  
                  <ItemInputs>
                    <Input
                      type="text"
                      placeholder="Value (e.g., 'BEEF')"
                      value={item.value}
                      onChange={(e) => handleUpdateItem(item.id, 'value', e.target.value)}
                      disabled={item.is_system_defined}
                      $readOnly={item.is_system_defined}
                    />
                    <Input
                      type="text"
                      placeholder="Label (e.g., 'Beef')"
                      value={item.label}
                      onChange={(e) => handleUpdateItem(item.id, 'label', e.target.value)}
                      disabled={item.is_system_defined}
                      $readOnly={item.is_system_defined}
                    />
                  </ItemInputs>
                  
                  <DeleteButton
                    onClick={() => handleDeleteItem(item.id)}
                    disabled={item.is_system_defined}
                    title={item.is_system_defined ? 'System item - cannot delete' : 'Delete item'}
                  >
                    {item.is_system_defined ? <Lock /> : <Trash2 />}
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
            >
              <Save /> {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </FooterActions>
        </Footer>
      </ModalContent>
    </Modal>
  );
};
