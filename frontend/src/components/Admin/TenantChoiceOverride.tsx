/**
 * Tenant Choice Override Manager
 * 
 * UI for managing TenantChoiceOverride (Tier 3 tenant customizations).
 * Allows tenants to disable system items, add custom items, and reorder choices.
 * 
 * Features:
 * - View system default items from Tier 1
 * - Disable unwanted system items
 * - Add tenant-specific custom items
 * - Reorder items (drag-and-drop)
 * - EXTEND vs REPLACE mode
 * 
 * Phase 3: Tiered Choice Engine
 * Created: 2026-02-23
 * 
 * @module TenantChoiceOverride
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import {
  Plus, Save, Eye, EyeOff, GripVertical, X, Settings, Info
} from 'lucide-react';
import { apiClient } from '../../services/apiService';
import Modal from '../Modal/Modal';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface SystemChoiceList {
  id: string;
  slug: string;
  label: string;
  description?: string;
  is_extensible: boolean;
  is_reorderable: boolean;
}

interface SystemChoiceItem {
  id: string;
  value: string;
  label: string;
  display_order: number;
  is_active: boolean;
}

interface TenantOverride {
  id?: string;
  tenant: string;
  choice_list: string;
  disabled_system_items: string[];
  display_config: {
    custom_order?: string[];
    grouping?: Record<string, string[]>;
  };
}

interface TenantChoiceOverrideProps {
  /** Current tenant ID */
  tenantId: string;
}

// ============================================================================
// Main Component
// ============================================================================

export const TenantChoiceOverride: React.FC<TenantChoiceOverrideProps> = ({
  tenantId,
}) => {
  const [choiceLists, setChoiceLists] = useState<SystemChoiceList[]>([]);
  const [selectedList, setSelectedList] = useState<SystemChoiceList | null>(null);
  const [systemItems, setSystemItems] = useState<SystemChoiceItem[]>([]);
  const [tenantOverride, setTenantOverride] = useState<TenantOverride | null>(null);
  const [disabledItems, setDisabledItems] = useState<Set<string>>(new Set());
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddCustomModalOpen, setIsAddCustomModalOpen] = useState(false);
  const [newCustomItem, setNewCustomItem] = useState({ value: '', label: '' });

  /**
   * Load choice lists
   */
  const loadChoiceLists = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/system/choice-lists/');
      setChoiceLists(response.data.results || response.data);
    } catch (error) {
      console.error('[TenantChoiceOverride] Failed to load choice lists:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load system items and tenant override for selected list
   */
  const loadListData = useCallback(async (listId: string) => {
    setIsLoading(true);
    try {
      // Load system items
      const itemsRes = await apiClient.get(`/system/choice-lists/${listId}/items/`);
      setSystemItems(itemsRes.data.filter((item: SystemChoiceItem) => item.is_active));

      // Load tenant override
      try {
        const overrideRes = await apiClient.get(`/system/tenant-overrides/`, {
          params: { choice_list: listId },
        });
        
        const override = overrideRes.data.results?.[0];
        if (override) {
          setTenantOverride(override);
          setDisabledItems(new Set(override.disabled_system_items || []));
          setCustomOrder(override.display_config?.custom_order || []);
        } else {
          setTenantOverride(null);
          setDisabledItems(new Set());
          setCustomOrder([]);
        }
      } catch (error) {
        console.error('[TenantChoiceOverride] No override found:', error);
        setTenantOverride(null);
        setDisabledItems(new Set());
        setCustomOrder([]);
      }
    } catch (error) {
      console.error('[TenantChoiceOverride] Failed to load list data:', error);
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
   * Load data when list is selected
   */
  useEffect(() => {
    if (selectedList) {
      loadListData(selectedList.id);
    } else {
      setSystemItems([]);
      setTenantOverride(null);
      setDisabledItems(new Set());
      setCustomOrder([]);
    }
  }, [selectedList, loadListData]);

  /**
   * Get visible items (respecting disabled state)
   */
  const visibleItems = useMemo(() => {
    return systemItems.filter(item => !disabledItems.has(item.id));
  }, [systemItems, disabledItems]);

  /**
   * Get ordered items
   */
  const orderedItems = useMemo(() => {
    if (customOrder.length === 0) {
      return visibleItems.sort((a, b) => a.display_order - b.display_order);
    }

    const ordered: SystemChoiceItem[] = [];
    const itemMap = new Map(visibleItems.map(item => [item.id, item]));

    // Add items in custom order
    customOrder.forEach(id => {
      const item = itemMap.get(id);
      if (item) {
        ordered.push(item);
        itemMap.delete(id);
      }
    });

    // Add remaining items
    Array.from(itemMap.values())
      .sort((a, b) => a.display_order - b.display_order)
      .forEach(item => ordered.push(item));

    return ordered;
  }, [visibleItems, customOrder]);

  /**
   * Toggle item disabled state
   */
  const handleToggleDisabled = useCallback((itemId: string) => {
    setDisabledItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  /**
   * Move item up in custom order
   */
  const handleMoveUp = useCallback((itemId: string) => {
    const currentIndex = orderedItems.findIndex(item => item.id === itemId);
    if (currentIndex <= 0) return;

    const newOrder = orderedItems.map(item => item.id);
    [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
    setCustomOrder(newOrder);
  }, [orderedItems]);

  /**
   * Move item down in custom order
   */
  const handleMoveDown = useCallback((itemId: string) => {
    const currentIndex = orderedItems.findIndex(item => item.id === itemId);
    if (currentIndex === -1 || currentIndex >= orderedItems.length - 1) return;

    const newOrder = orderedItems.map(item => item.id);
    [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
    setCustomOrder(newOrder);
  }, [orderedItems]);

  /**
   * Add custom item
   */
  const handleAddCustomItem = useCallback(async () => {
    if (!selectedList || !newCustomItem.value || !newCustomItem.label) return;

    try {
      await apiClient.post('/system/choice-items/', {
        choice_list: selectedList.id,
        value: newCustomItem.value,
        label: newCustomItem.label,
        display_order: systemItems.length,
        is_active: true,
      });

      await loadListData(selectedList.id);
      setIsAddCustomModalOpen(false);
      setNewCustomItem({ value: '', label: '' });
    } catch (error) {
      console.error('[TenantChoiceOverride] Failed to add custom item:', error);
    }
  }, [selectedList, newCustomItem, systemItems.length, loadListData]);

  /**
   * Save tenant override
   */
  const handleSave = useCallback(async () => {
    if (!selectedList) return;

    setIsSaving(true);
    try {
      const overrideData: TenantOverride = {
        tenant: tenantId,
        choice_list: selectedList.id,
        disabled_system_items: Array.from(disabledItems),
        display_config: {
          custom_order: customOrder.length > 0 ? customOrder : undefined,
        },
      };

      if (tenantOverride?.id) {
        await apiClient.patch(`/system/tenant-overrides/${tenantOverride.id}/`, overrideData);
      } else {
        await apiClient.post('/system/tenant-overrides/', overrideData);
      }

      await loadListData(selectedList.id);
      alert('Override saved successfully!');
    } catch (error) {
      console.error('[TenantChoiceOverride] Failed to save override:', error);
      alert('Failed to save override');
    } finally {
      setIsSaving(false);
    }
  }, [selectedList, tenantId, disabledItems, customOrder, tenantOverride, loadListData]);

  /**
   * Reset to defaults
   */
  const handleReset = useCallback(() => {
    if (!confirm('Reset to system defaults? This will remove all customizations.')) return;

    setDisabledItems(new Set());
    setCustomOrder([]);
  }, []);

  return (
    <Container>
      <Header>
        <HeaderLeft>
          <Title>Choice Customization</Title>
          <Subtitle>Customize dropdown choices for your organization</Subtitle>
        </HeaderLeft>
        <HeaderRight>
          {selectedList && (
            <>
              <Button $variant="secondary" onClick={handleReset}>
                Reset to Defaults
              </Button>
              <Button $variant="primary" onClick={handleSave} disabled={isSaving}>
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          )}
        </HeaderRight>
      </Header>

      <Content>
        <LeftPanel>
          <PanelHeader>
            <PanelTitle>Available Lists</PanelTitle>
          </PanelHeader>
          <ListsContainer>
            {isLoading ? (
              <LoadingState>Loading...</LoadingState>
            ) : choiceLists.length === 0 ? (
              <EmptyState>No choice lists available</EmptyState>
            ) : (
              choiceLists.map(list => (
                <ListCard
                  key={list.id}
                  $isSelected={selectedList?.id === list.id}
                  onClick={() => setSelectedList(list)}
                >
                  <ListName>{list.label}</ListName>
                  <ListMeta>
                    {list.is_extensible && <Badge $color="green">Can Add Items</Badge>}
                    {list.is_reorderable && <Badge $color="purple">Can Reorder</Badge>}
                  </ListMeta>
                </ListCard>
              ))
            )}
          </ListsContainer>
        </LeftPanel>

        <RightPanel>
          {selectedList ? (
            <>
              <PanelHeader>
                <PanelTitle>{selectedList.label}</PanelTitle>
                {selectedList.is_extensible && (
                  <Button
                    $variant="primary"
                    onClick={() => setIsAddCustomModalOpen(true)}
                  >
                    <Plus size={16} />
                    Add Custom Item
                  </Button>
                )}
              </PanelHeader>

              <InfoBanner>
                <Info size={16} />
                <div>
                  <strong>How it works:</strong> Disable items you don't need. 
                  {selectedList.is_reorderable && ' Reorder items to match your preferences.'}
                  {selectedList.is_extensible && ' Add custom items specific to your organization.'}
                </div>
              </InfoBanner>

              <Stats>
                <StatItem>
                  <StatLabel>System Items</StatLabel>
                  <StatValue>{systemItems.length}</StatValue>
                </StatItem>
                <StatItem>
                  <StatLabel>Disabled</StatLabel>
                  <StatValue>{disabledItems.size}</StatValue>
                </StatItem>
                <StatItem>
                  <StatLabel>Visible</StatLabel>
                  <StatValue>{visibleItems.length}</StatValue>
                </StatItem>
                {customOrder.length > 0 && (
                  <StatItem>
                    <StatLabel>Custom Order</StatLabel>
                    <StatValue>Yes</StatValue>
                  </StatItem>
                )}
              </Stats>

              <ItemsList>
                {orderedItems.map((item, index) => {
                  const isDisabled = disabledItems.has(item.id);

                  return (
                    <ItemRow key={item.id} $isDisabled={isDisabled}>
                      {selectedList.is_reorderable && (
                        <ReorderButtons>
                          <IconButton
                            onClick={() => handleMoveUp(item.id)}
                            disabled={index === 0}
                            title="Move up"
                          >
                            ▲
                          </IconButton>
                          <IconButton
                            onClick={() => handleMoveDown(item.id)}
                            disabled={index === orderedItems.length - 1}
                            title="Move down"
                          >
                            ▼
                          </IconButton>
                        </ReorderButtons>
                      )}

                      <ItemContent>
                        <ItemLabel>{item.label}</ItemLabel>
                        <ItemValue>{item.value}</ItemValue>
                      </ItemContent>

                      <ItemActions>
                        <IconButton
                          onClick={() => handleToggleDisabled(item.id)}
                          title={isDisabled ? 'Enable' : 'Disable'}
                        >
                          {isDisabled ? <EyeOff size={16} /> : <Eye size={16} />}
                        </IconButton>
                      </ItemActions>
                    </ItemRow>
                  );
                })}

                {systemItems.filter(item => disabledItems.has(item.id)).length > 0 && (
                  <>
                    <Divider />
                    <DisabledSection>Disabled Items</DisabledSection>
                    {systemItems
                      .filter(item => disabledItems.has(item.id))
                      .map(item => (
                        <ItemRow key={item.id} $isDisabled={true}>
                          <ItemContent>
                            <ItemLabel>{item.label}</ItemLabel>
                            <ItemValue>{item.value}</ItemValue>
                          </ItemContent>
                          <ItemActions>
                            <IconButton
                              onClick={() => handleToggleDisabled(item.id)}
                              title="Enable"
                            >
                              <EyeOff size={16} />
                            </IconButton>
                          </ItemActions>
                        </ItemRow>
                      ))}
                  </>
                )}
              </ItemsList>
            </>
          ) : (
            <EmptyState>Select a choice list to customize</EmptyState>
          )}
        </RightPanel>
      </Content>

      {/* Add Custom Item Modal */}
      <Modal
        isOpen={isAddCustomModalOpen}
        onClose={() => {
          setIsAddCustomModalOpen(false);
          setNewCustomItem({ value: '', label: '' });
        }}
        title="Add Custom Item"
        footer={
          <ModalFooter>
            <Button
              $variant="secondary"
              onClick={() => {
                setIsAddCustomModalOpen(false);
                setNewCustomItem({ value: '', label: '' });
              }}
            >
              Cancel
            </Button>
            <Button $variant="primary" onClick={handleAddCustomItem}>
              <Plus size={16} />
              Add Item
            </Button>
          </ModalFooter>
        }
      >
        <Form>
          <FormGroup>
            <Label>Value (internal key)</Label>
            <Input
              value={newCustomItem.value}
              onChange={(e) => setNewCustomItem({ ...newCustomItem, value: e.target.value })}
              placeholder="e.g., WAGYU"
            />
          </FormGroup>

          <FormGroup>
            <Label>Label (display text)</Label>
            <Input
              value={newCustomItem.label}
              onChange={(e) => setNewCustomItem({ ...newCustomItem, label: e.target.value })}
              placeholder="e.g., Wagyu Beef"
            />
          </FormGroup>
        </Form>
      </Modal>
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

const Content = styled.div`
  display: grid;
  grid-template-columns: 300px 1fr;
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

const ListsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  overflow-y: auto;
`;

const ListCard = styled.div<{ $isSelected: boolean }>`
  padding: 12px;
  background: ${props => props.$isSelected ? 'rgba(var(--color-primary), 0.1)' : 'rgb(var(--color-background-secondary))'};
  border: 2px solid ${props => props.$isSelected ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: rgb(var(--color-primary));
  }
`;

const ListName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

const ListMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const Badge = styled.span<{ $color: string }>`
  padding: 2px 6px;
  background: ${props => {
    switch (props.$color) {
      case 'green': return 'rgba(34, 197, 94, 0.1)';
      case 'purple': return 'rgba(168, 85, 247, 0.1)';
      default: return 'rgba(107, 114, 128, 0.1)';
    }
  }};
  color: ${props => {
    switch (props.$color) {
      case 'green': return 'rgb(34, 197, 94)';
      case 'purple': return 'rgb(168, 85, 247)';
      default: return 'rgb(107, 114, 128)';
    }
  }};
  font-size: 11px;
  font-weight: 500;
  border-radius: 3px;
`;

const InfoBanner = styled.div`
  display: flex;
  gap: 12px;
  padding: 12px 24px;
  background: rgba(59, 130, 246, 0.1);
  border-bottom: 1px solid rgba(59, 130, 246, 0.2);
  color: rgb(59, 130, 246);
  font-size: 13px;
  line-height: 1.5;

  svg {
    flex-shrink: 0;
    margin-top: 2px;
  }
`;

const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const StatLabel = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const StatValue = styled.div`
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const ItemsList = styled.div`
  display: flex;
  flex-direction: column;
  padding: 16px 24px;
  gap: 8px;
  overflow-y: auto;
`;

const ItemRow = styled.div<{ $isDisabled: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  opacity: ${props => props.$isDisabled ? 0.5 : 1};
  transition: all 0.2s;

  &:hover {
    border-color: rgb(var(--color-primary));
  }
`;

const ReorderButtons = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid rgb(var(--color-border));
  border-radius: 4px;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: rgb(var(--color-background-tertiary));
    color: rgb(var(--color-text-primary));
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
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
`;

const Divider = styled.div`
  height: 1px;
  background: rgb(var(--color-border));
  margin: 16px 0;
`;

const DisabledSection = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
`;

const LoadingState = styled.div`
  padding: 48px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
`;

const EmptyState = styled.div`
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

  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

export default TenantChoiceOverride;
