/**
 * Option Lists Management Page
 *
 * Manages SystemChoiceList and SystemChoiceItem from the system configuration app.
 */
import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  Building,
  ChevronDown,
  ChevronUp,
  Edit2,
  Globe,
  Lock,
  Search,
  Unlock,
} from 'lucide-react';
import { apiClient } from '@/services/apiService';
import { AdminGuard, AdminPage, EmptyState, LoadingSkeleton } from '@/components/Admin';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { OptionListModal } from './OptionListModal';

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

const OptionListsPage: React.FC = () => {
  const toast = useToast();
  const { permissions } = useAdminPermissions();
  const canEdit = permissions.can_manage_option_lists;
  const canView = canEdit || permissions.role === 'manager' || permissions.role === 'owner' || permissions.role === 'admin' || permissions.role === 'superuser';

  const [lists, setLists] = useState<SystemChoiceList[]>([]);
  const [expandedList, setExpandedList] = useState<string | null>(null);
  const [listItems, setListItems] = useState<Record<string, SystemChoiceItem[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState<string | null>(null);
  const [editingList, setEditingList] = useState<SystemChoiceList | null>(null);

  useEffect(() => {
    if (!canView) return;
    loadChoiceLists();
  }, [canView]);

  const loadChoiceLists = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/system/choice-lists/');
      const raw = response.data as any;
      const data = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
      setLists(data);
    } catch (error) {
      console.error('Failed to load choice lists:', error);
      toast.error('Failed to load option lists');
      setLists([]);
    } finally {
      setLoading(false);
    }
  };

  const loadListItems = async (slug: string) => {
    setLoadingItems(slug);
    try {
      const response = await apiClient.get(`/system/choice-lists/${slug}/items/`);
      const itemsData = Array.isArray(response.data) ? response.data : [];
      setListItems((prev) => ({ ...prev, [slug]: itemsData }));
    } catch (error) {
      console.error(`Failed to load items for ${slug}:`, error);
      toast.error('Failed to load option list items');
      setListItems((prev) => ({ ...prev, [slug]: [] }));
    } finally {
      setLoadingItems(null);
    }
  };

  const handleToggleExpand = (slug: string) => {
    if (expandedList === slug) {
      setExpandedList(null);
      return;
    }

    setExpandedList(slug);
    if (!listItems[slug]) {
      loadListItems(slug);
    }
  };

  const handleEditList = (list: SystemChoiceList, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    setEditingList(list);
  };

  const handleModalClose = () => {
    setEditingList(null);
  };

  const handleModalSave = () => {
    if (editingList) {
      loadListItems(editingList.slug);
    }
    loadChoiceLists();
  };

  const filteredLists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return lists;

    return lists.filter((list) => {
      const name = (list.name || '').toLowerCase();
      const slug = (list.slug || '').toLowerCase();
      const desc = (list.description || '').toLowerCase();
      return name.includes(q) || slug.includes(q) || desc.includes(q);
    });
  }, [lists, searchQuery]);

  return (
    <AdminPage
      title="Option Lists"
      description="Manage choice lists used across dropdown fields. System lists are locked; extensible lists support tenant overrides."
      icon="📋"
      headerExtras={
        <SearchBar>
          <SearchIconWrapper>
            <Search aria-hidden="true" />
            <SearchInput
              type="text"
              placeholder="Search by name, slug, or description…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search option lists"
            />
          </SearchIconWrapper>
        </SearchBar>
      }
    >
      <AdminGuard
        feature="option_lists"
        allow={(p) => p.can_manage_option_lists || p.role === 'manager'}
        loadingFallback={<LoadingSkeleton type="card" rows={2} />}
      >
        {loading ? (
        <LoadingSkeleton type="card" rows={3} />
      ) : filteredLists.length === 0 ? (
        <EmptyState
          icon="📋"
          title={searchQuery ? 'No matches' : 'No option lists'}
          message={searchQuery ? 'No option lists match your search.' : 'No option lists were returned.'}
        />
        ) : (
          <ListsGrid>
          {filteredLists.map((list) => {
            const isExpanded = expandedList === list.slug;
            const items = listItems[list.slug] || [];
            const isLoadingItems = loadingItems === list.slug;

            return (
              <ListCard key={list.id} $expanded={isExpanded}>
                <ListHeader
                  onClick={() => handleToggleExpand(list.slug)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleToggleExpand(list.slug);
                    }
                  }}
                  aria-expanded={isExpanded}
                >
                  <ListHeaderLeft>
                    <ListIcon $locked={!list.is_extensible} aria-hidden="true">
                      {list.is_extensible ? <Unlock /> : <Lock />}
                    </ListIcon>

                    <ListInfo>
                      <ListName>{list.name}</ListName>
                      <ListMeta>
                        <code>{list.slug}</code>
                        <span aria-hidden="true">•</span>
                        <ListBadge $type={list.is_extensible ? 'extensible' : 'system'}>
                          {list.is_extensible ? 'Tenant Customizable' : 'System Locked'}
                        </ListBadge>
                        <span aria-hidden="true">•</span>
                        <ListBadge $type="count">{list.items_count} items</ListBadge>
                      </ListMeta>
                    </ListInfo>
                  </ListHeaderLeft>

                  <ExpandIcon $expanded={isExpanded} aria-hidden="true">
                    {isExpanded ? <ChevronUp /> : <ChevronDown />}
                  </ExpandIcon>
                </ListHeader>

                <ListContent $expanded={isExpanded}>
                  <ItemsContainer>
                    <ItemsHeader>
                      <ItemsTitle>{list.model_field_path || 'Choice Items'}</ItemsTitle>
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleEditList(list, e)}
                          title={list.is_extensible ? 'Edit items' : 'View items'}
                        >
                          <Edit2 size={14} /> {list.is_extensible ? 'Edit Items' : 'View Items'}
                        </Button>
                      )}
                    </ItemsHeader>

                    {isLoadingItems ? (
                      <LoadingRows>
                        <LoadingSkeleton type="list" rows={4} />
                      </LoadingRows>
                    ) : items.length === 0 ? (
                      <EmptyState icon="🗂️" title="No items" message="This list currently has no items." />
                    ) : (
                      <ItemsList>
                        {items.map((item) => (
                          <ItemRow key={item.id} $isSystem={item.is_system_defined}>
                            <ItemLeft>
                              <ItemIcon $isSystem={item.is_system_defined} aria-hidden="true">
                                {item.is_system_defined ? <Globe /> : <Building />}
                              </ItemIcon>

                              <ItemDetails>
                                <ItemLabel>{item.label}</ItemLabel>
                                <ItemValue>{item.value}</ItemValue>
                              </ItemDetails>
                            </ItemLeft>

                            <ItemBadges>
                              {item.is_system_defined ? (
                                <Badge $tone="system">System</Badge>
                              ) : (
                                <Badge $tone="tenant">Tenant</Badge>
                              )}
                              {item.is_default && <Badge $tone="default">Default</Badge>}
                              {!item.is_active && <Badge $tone="inactive">Inactive</Badge>}
                            </ItemBadges>
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
      </AdminGuard>

      {editingList && (
        <OptionListModal
          listSlug={editingList.slug}
          listName={editingList.name}
          isExtensible={editingList.is_extensible}
          isReorderable={editingList.is_reorderable}
          isOpen={true}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}
    </AdminPage>
  );
};

// Styled Components

const SearchBar = styled.div`
  display: flex;
  gap: 12px;
`;

const SearchIconWrapper = styled.div`
  position: relative;
  flex: 1;

  svg {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: rgb(var(--color-text-secondary));
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
    border-color: rgba(var(--color-primary), 0.8);
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.12);
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

  ${(props) =>
    props.$expanded &&
    `
    border-color: rgba(var(--color-primary), 0.45);
    box-shadow: var(--shadow-md);
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

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: -2px;
  }
`;

const ListHeaderLeft = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
`;

const ListIcon = styled.div<{ $locked: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(props) =>
    props.$locked ? 'rgba(var(--color-danger), 0.12)' : 'rgba(var(--color-success), 0.12)'};
  color: ${(props) => (props.$locked ? 'rgb(var(--color-danger))' : 'rgb(var(--color-success))')};

  svg {
    width: 20px;
    height: 20px;
  }
`;

const ListInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ListName = styled.h3`
  font-size: 16px;
  font-weight: 650;
  color: rgb(var(--color-text-primary));
  margin: 0 0 4px 0;
`;

const ListMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  flex-wrap: wrap;

  code {
    font-family: var(--font-mono);
    font-size: 12px;
    background: rgba(var(--color-text-secondary), 0.10);
    color: rgb(var(--color-text-primary));
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }
`;

const ListBadge = styled.span<{ $type: 'system' | 'extensible' | 'count' }>`
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;

  ${(props) =>
    props.$type === 'system' &&
    `
    background: rgba(var(--color-danger), 0.12);
    color: rgb(var(--color-danger));
  `}

  ${(props) =>
    props.$type === 'extensible' &&
    `
    background: rgba(var(--color-success), 0.12);
    color: rgb(var(--color-success));
  `}

  ${(props) =>
    props.$type === 'count' &&
    `
    background: rgba(var(--color-primary), 0.12);
    color: rgb(var(--color-primary));
  `}
`;

const ExpandIcon = styled.div<{ $expanded: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  svg {
    width: 18px;
    height: 18px;
    color: rgb(var(--color-text-secondary));
  }

  ${(props) =>
    props.$expanded &&
    `
    background: rgba(var(--color-primary), 0.12);

    svg {
      color: rgb(var(--color-primary));
    }
  `}
`;

const ListContent = styled.div<{ $expanded: boolean }>`
  max-height: ${(props) => (props.$expanded ? '1200px' : '0')};
  overflow: hidden;
  transition: max-height 0.3s ease;
  border-top: ${(props) => (props.$expanded ? '1px solid rgb(var(--color-border))' : 'none')};
`;

const ItemsContainer = styled.div`
  padding: 18px 20px 20px;
`;

const ItemsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
`;

const ItemsTitle = styled.h4`
  font-size: 14px;
  font-weight: 650;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const LoadingRows = styled.div`
  padding: 10px 0;
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
  background: ${(props) => (props.$isSystem ? 'rgba(var(--color-surface), 0.55)' : 'rgb(var(--color-background))')};
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  transition: all 0.15s ease;

  &:hover {
    border-color: ${(props) => (props.$isSystem ? 'rgb(var(--color-border))' : 'rgba(var(--color-primary), 0.55)')};
  }
`;

const ItemLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
`;

const ItemIcon = styled.div<{ $isSystem: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(props) => (props.$isSystem ? 'rgba(var(--color-info), 0.12)' : 'rgba(var(--color-success), 0.12)')};

  svg {
    width: 12px;
    height: 12px;
    color: ${(props) => (props.$isSystem ? 'rgb(var(--color-info))' : 'rgb(var(--color-success))')};
  }
`;

const ItemDetails = styled.div`
  flex: 1;
  min-width: 0;
`;

const ItemLabel = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const ItemValue = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ItemBadges = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
`;

const Badge = styled.span<{ $tone: 'system' | 'tenant' | 'default' | 'inactive' }>`
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 650;

  ${(props) =>
    props.$tone === 'system' &&
    `
      background: rgba(var(--color-info), 0.12);
      color: rgb(var(--color-info));
    `}

  ${(props) =>
    props.$tone === 'tenant' &&
    `
      background: rgba(var(--color-success), 0.12);
      color: rgb(var(--color-success));
    `}

  ${(props) =>
    props.$tone === 'default' &&
    `
      background: rgba(var(--color-primary), 0.12);
      color: rgb(var(--color-primary));
    `}

  ${(props) =>
    props.$tone === 'inactive' &&
    `
      background: rgba(var(--color-danger), 0.12);
      color: rgb(var(--color-danger));
    `}
`;

export default OptionListsPage;
