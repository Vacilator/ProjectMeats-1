/**
 * Option Lists Management Page
 * 
 * Manages SystemChoiceList and SystemChoiceItem from the system configuration app.
 * 
 * Features:
 * - View all system choice lists (e.g., protein_type, payment_terms, etc.)
 * - System-defined items (locked, cannot be modified by tenants)
 * - Tenant-customizable items (can add/edit/remove)
 * - Clear indication of which lists are extensible vs system-locked
 * 
 * Created: 2026-02-04
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { 
  Plus, Edit2, Trash2, Lock, Unlock, Globe, Building, 
  Search, ChevronDown, ChevronUp
} from 'lucide-react';
import { adminClient } from '../../../services/apiService';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface SystemChoiceList {
  id: string;
  slug: string;
  name: string;
  description: string;
  model_field_path: string;
  is_extensible: boolean;
  is_reorderable: boolean;
  items_count: number;
  created_at: string;
  updated_at: string;
}

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

// ============================================================================
// Styled Components (following ProjectMeats design system)
// ============================================================================

const PageContainer = styled.div`
  padding: 24px;
  max-width: 1600px;
  margin: 0 auto;
`;

const PageHeader = styled.div`
  margin-bottom: 32px;
`;

const PageTitle = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0 0 8px 0;
`;

const PageDescription = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 0;
`;

const SearchBar = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
`;

const SearchIconWrapper = styled.div`
  position: relative;
  flex: 1;
  
  svg {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: rgb(var(--color-text-tertiary));
    width: 18px;
    height: 18px;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px 12px 10px 40px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface));
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const ListsGrid = styled.div`
  display: grid;
  gap: 16px;
`;

const ListCard = styled.div<{ $expanded: boolean }>`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all 0.2s ease;
  
  ${props => props.$expanded && `
    border-color: rgb(var(--color-primary));
    box-shadow: 0 2px 8px rgba(var(--color-primary), 0.1);
  `}
`;

const ListHeader = styled.div`
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background 0.15s ease;
  
  &:hover {
    background: rgba(var(--color-primary), 0.02);
  }
`;

const ListHeaderLeft = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16px;
`;

const ListIcon = styled.div<{ $locked: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.$locked 
    ? 'rgba(239, 68, 68, 0.1)' 
    : 'rgba(34, 197, 94, 0.1)'};
  color: ${props => props.$locked ? 'rgb(239, 68, 68)' : 'rgb(34, 197, 94)'};
  
  svg {
    width: 20px;
    height: 20px;
  }
`;

const ListInfo = styled.div`
  flex: 1;
`;

const ListName = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 4px 0;
`;

const ListMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

const ListBadge = styled.span<{ $type: 'system' | 'extensible' | 'count' }>`
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  
  ${props => props.$type === 'system' && `
    background: rgba(239, 68, 68, 0.1);
    color: rgb(239, 68, 68);
  `}
  
  ${props => props.$type === 'extensible' && `
    background: rgba(34, 197, 94, 0.1);
    color: rgb(34, 197, 94);
  `}
  
  ${props => props.$type === 'count' && `
    background: rgba(var(--color-primary), 0.1);
    color: rgb(var(--color-primary));
  `}
`;

const ExpandIcon = styled.div<{ $expanded: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  svg {
    width: 18px;
    height: 18px;
    color: rgb(var(--color-text-secondary));
  }
  
  ${props => props.$expanded && `
    background: rgba(var(--color-primary), 0.1);
    
    svg {
      color: rgb(var(--color-primary));
    }
  `}
`;

const ListContent = styled.div<{ $expanded: boolean }>`
  max-height: ${props => props.$expanded ? '1000px' : '0'};
  overflow: hidden;
  transition: max-height 0.3s ease;
  border-top: ${props => props.$expanded ? '1px solid rgb(var(--color-border))' : 'none'};
`;

const ItemsContainer = styled.div`
  padding: 20px;
`;

const ItemsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const ItemsTitle = styled.h4`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const AddItemButton = styled.button`
  padding: 6px 12px;
  background: transparent;
  color: rgb(var(--color-primary));
  border: 1px solid rgb(var(--color-primary));
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
  
  &:hover:not(:disabled) {
    background: rgba(var(--color-primary), 0.1);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  svg {
    width: 14px;
    height: 14px;
  }
`;

const ItemsList = styled.div`
  display: grid;
  gap: 8px;
`;

const ItemRow = styled.div<{ $isSystem: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: ${props => props.$isSystem 
    ? 'rgba(var(--color-surface), 0.5)' 
    : 'rgb(var(--color-background))'};
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
  
  &:hover {
    border-color: ${props => props.$isSystem 
      ? 'rgb(var(--color-border))' 
      : 'rgb(var(--color-primary))'};
  }
`;

const ItemLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
`;

const ItemIcon = styled.div<{ $isSystem: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.$isSystem 
    ? 'rgba(239, 68, 68, 0.1)' 
    : 'rgba(34, 197, 94, 0.1)'};
  
  svg {
    width: 12px;
    height: 12px;
    color: ${props => props.$isSystem ? 'rgb(239, 68, 68)' : 'rgb(34, 197, 94)'};
  }
`;

const ItemDetails = styled.div`
  flex: 1;
`;

const ItemLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const ItemValue = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  font-family: 'Courier New', monospace;
`;

const ItemActions = styled.div`
  display: flex;
  gap: 4px;
`;

const IconButton = styled.button`
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  transition: all 0.15s ease;
  
  &:hover:not(:disabled) {
    background: rgba(var(--color-primary), 0.1);
    color: rgb(var(--color-primary));
  }
  
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  svg {
    width: 14px;
    height: 14px;
  }
`;

const EmptyState = styled.div`
  padding: 48px 20px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
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

const OptionListsPage: React.FC = () => {
  const [lists, setLists] = useState<SystemChoiceList[]>([]);
  const [expandedList, setExpandedList] = useState<string | null>(null);
  const [listItems, setListItems] = useState<Record<string, SystemChoiceItem[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState<string | null>(null);

  // Load all choice lists on mount
  useEffect(() => {
    loadChoiceLists();
  }, []);

  const loadChoiceLists = async () => {
    setLoading(true);
    try {
      const response = await adminClient.get('/system/choice-lists/');
      setLists(response.data);
    } catch (error) {
      console.error('Failed to load choice lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadListItems = async (slug: string) => {
    setLoadingItems(slug);
    try {
      const response = await adminClient.get(`/system/choice-lists/${slug}/items/`);
      setListItems(prev => ({ ...prev, [slug]: response.data }));
    } catch (error) {
      console.error(`Failed to load items for ${slug}:`, error);
    } finally {
      setLoadingItems(null);
    }
  };

  const handleToggleExpand = (slug: string) => {
    if (expandedList === slug) {
      setExpandedList(null);
    } else {
      setExpandedList(slug);
      if (!listItems[slug]) {
        loadListItems(slug);
      }
    }
  };

  // Filter lists by search query
  const filteredLists = lists.filter(list => 
    list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    list.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    list.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>📋 Option Lists</PageTitle>
        <PageDescription>
          Manage system-wide choice lists for dropdown fields. System lists are locked and cannot be modified by tenants, while extensible lists allow tenant customizations.
        </PageDescription>
      </PageHeader>

      <SearchBar>
        <SearchIconWrapper>
          <Search />
          <SearchInput
            type="text"
            placeholder="Search option lists by name, slug, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </SearchIconWrapper>
      </SearchBar>

      {loading ? (
        <LoadingState>Loading option lists...</LoadingState>
      ) : filteredLists.length === 0 ? (
        <EmptyState>
          {searchQuery ? 'No option lists match your search.' : 'No option lists found.'}
        </EmptyState>
      ) : (
        <ListsGrid>
          {filteredLists.map(list => {
            const isExpanded = expandedList === list.slug;
            const items = listItems[list.slug] || [];
            const isLoadingItems = loadingItems === list.slug;

            return (
              <ListCard key={list.id} $expanded={isExpanded}>
                <ListHeader onClick={() => handleToggleExpand(list.slug)}>
                  <ListHeaderLeft>
                    <ListIcon $locked={!list.is_extensible}>
                      {list.is_extensible ? <Unlock /> : <Lock />}
                    </ListIcon>
                    
                    <ListInfo>
                      <ListName>{list.name}</ListName>
                      <ListMeta>
                        <code>{list.slug}</code>
                        <span>•</span>
                        {!list.is_extensible && (
                          <>
                            <ListBadge $type="system">System Locked</ListBadge>
                            <span>•</span>
                          </>
                        )}
                        {list.is_extensible && (
                          <>
                            <ListBadge $type="extensible">Tenant Customizable</ListBadge>
                            <span>•</span>
                          </>
                        )}
                        <ListBadge $type="count">{list.items_count} items</ListBadge>
                      </ListMeta>
                    </ListInfo>
                  </ListHeaderLeft>
                  
                  <ExpandIcon $expanded={isExpanded}>
                    {isExpanded ? <ChevronUp /> : <ChevronDown />}
                  </ExpandIcon>
                </ListHeader>

                <ListContent $expanded={isExpanded}>
                  <ItemsContainer>
                    <ItemsHeader>
                      <ItemsTitle>
                        {list.model_field_path || 'Choice Items'}
                      </ItemsTitle>
                      <AddItemButton 
                        disabled={!list.is_extensible}
                        title={list.is_extensible ? 'Add custom item' : 'System list - cannot add items'}
                      >
                        <Plus /> Add Item
                      </AddItemButton>
                    </ItemsHeader>

                    {isLoadingItems ? (
                      <LoadingState>Loading items...</LoadingState>
                    ) : items.length === 0 ? (
                      <EmptyState>No items in this list</EmptyState>
                    ) : (
                      <ItemsList>
                        {items.map(item => (
                          <ItemRow key={item.id} $isSystem={item.is_system_defined}>
                            <ItemLeft>
                              <ItemIcon $isSystem={item.is_system_defined}>
                                {item.is_system_defined ? <Globe /> : <Building />}
                              </ItemIcon>
                              
                              <ItemDetails>
                                <ItemLabel>{item.label}</ItemLabel>
                                <ItemValue>{item.value}</ItemValue>
                              </ItemDetails>
                            </ItemLeft>

                            <ItemActions>
                              <IconButton 
                                disabled={item.is_system_defined}
                                title={item.is_system_defined ? 'System item - cannot edit' : 'Edit item'}
                              >
                                <Edit2 />
                              </IconButton>
                              <IconButton 
                                disabled={item.is_system_defined}
                                title={item.is_system_defined ? 'System item - cannot delete' : 'Delete item'}
                              >
                                <Trash2 />
                              </IconButton>
                            </ItemActions>
                          </ItemRow>
                        ))}
                      </ItemsList>
                    )}
                  </ItemsContainer>
                </ListContent>
              </ListCard>
            );
          })}
        </ListsGrid>
      )}
    </PageContainer>
  );
};

export default OptionListsPage;
