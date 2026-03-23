/**
 * SmartSearch Component
 * 
 * Mind-map style search with cascading relational results.
 * Displays entity relationships in chunks (calls, S.O.'s, associates).
 * 
 * Features:
 * - Cascading results (type entity → see relations)
 * - Breadcrumb navigation
 * - Top-5 results per entity type
 * - Relational chunks (recent activity, associates, orders)
 * - Favorites integration
 * 
 * Created: 2026-02-21 - Cockpit Phase 1: Smart Search Foundation
 * 
 * @module SmartSearch
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import {
  Search, Star, Clock, FileText,
  Users, Building2, Package, TrendingUp, X
} from 'lucide-react';
import debounce from 'lodash/debounce';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, Spin, Button } from 'antd';
import { businessApi } from '../../services/businessApi';
import { useCockpitNavigation } from '../../contexts/CockpitNavigationContext';
import { CreateOrderModal } from '../Shared';
import { EntityProfileHeader } from './EntityProfileHeader';
import { AIOverviewCard } from './AIOverviewCard';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface SearchEntity {
  id: string;
  type: string;
  name: string;
  subtitle?: string;
  metadata?: Record<string, unknown>;
}

export interface RelationalChunk {
  type: string;
  title: string;
  items: SearchEntity[];
  icon: React.ReactNode;
}

// NOTE: Breadcrumb UI is owned by CockpitDashboard via <BreadcrumbBar />.
// SmartSearch reacts to navigation path changes to implement continuous browsing.

export interface SmartSearchProps {
  /** Initial search query (uncontrolled mode) */
  initialQuery?: string;
  /** Controlled query (preferred for global header-driven search) */
  query?: string;
  /** Callback when query changes (controlled mode only) */
  onQueryChange?: (query: string) => void;
  /** When true, hides the internal search input (used when Header owns the search input) */
  hideInput?: boolean;
  /** Callback when entity is selected */
  onSelectEntity?: (entity: SearchEntity) => void;
  /** Callback when search closes */
  onClose?: () => void;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgb(var(--color-background-primary));
`;

const SearchHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const SearchInputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 12px;
  color: rgb(var(--color-text-tertiary));
  pointer-events: none;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px 40px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }

  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const ClearButton = styled.button`
  position: absolute;
  right: 8px;
  padding: 4px;
  background: transparent;
  border: none;
  color: rgb(var(--color-text-tertiary));
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background: rgb(var(--color-background-tertiary));
    color: rgb(var(--color-text-primary));
  }
`;


const ContentArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`;

const Section = styled.div`
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const SectionTitle = styled.h3`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));

  svg {
    color: rgb(var(--color-primary));
  }
`;

const SectionCount = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  font-weight: normal;
`;

const ResultGrid = styled.div`
  display: grid;
  gap: 8px;
`;

const ResultCard = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;

  &:hover {
    background: rgb(var(--color-background-tertiary));
    border-color: rgb(var(--color-primary));
    transform: translateX(4px);
  }
`;

const ResultIcon = styled.div<{ $color?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: ${props => props.$color ? `${props.$color}15` : 'rgb(var(--color-background-primary))'};
  color: ${props => props.$color || 'rgb(var(--color-primary))'};
  border-radius: 6px;
  flex-shrink: 0;
`;

const ResultContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ResultTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ResultSubtitle = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
`;

const ResultMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  margin-top: 4px;
`;

const FavoriteButton = styled.button<{ $isFavorite: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  color: ${props => props.$isFavorite ? 'rgb(var(--color-warning))' : 'rgb(var(--color-text-tertiary))'};
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover {
    background: rgb(var(--color-background-tertiary));
    color: ${props => props.$isFavorite ? 'rgb(var(--color-warning))' : 'rgb(var(--color-text-primary))'};
  }

  svg {
    fill: ${props => props.$isFavorite ? 'currentColor' : 'none'};
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
`;

const EmptyIcon = styled.div`
  color: rgb(var(--color-text-tertiary));
  margin-bottom: 16px;
`;

const EmptyTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

const EmptyMessage = styled.div`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  max-width: 400px;
`;

// ============================================================================
// Helper Functions
// ============================================================================

const getEntityIcon = (type: SearchEntity['type'], size = 20) => {
  switch (type) {
    case 'customer': return <Users size={size} />;
    case 'supplier': return <Building2 size={size} />;
    case 'contact': return <Users size={size} />;
    case 'product': return <Package size={size} />;
    case 'order': return <FileText size={size} />;
    case 'inquiry': return <FileText size={size} />;
    default: return <FileText size={size} />;
  }
};

const getEntityColor = (type: SearchEntity['type']) => {
  switch (type) {
    case 'customer': return 'rgb(34, 197, 94)';
    case 'supplier': return 'rgb(168, 85, 247)';
    case 'contact': return 'rgb(59, 130, 246)';
    case 'product': return 'rgb(249, 115, 22)';
    case 'order': return 'rgb(234, 179, 8)';
    case 'inquiry': return 'rgb(239, 68, 68)';
    default: return 'rgb(var(--color-primary))';
  }
};

/**
 * Format relationship type to human-readable title
 */
const formatRelationshipTitle = (relType: string): string => {
  const titleMap: Record<string, string> = {
    'purchase_orders': 'Purchase Orders',
    'sales_orders': 'Sales Orders',
    'contacts': 'Contacts',
    'line_items': 'Line Items',
    'supplier': 'Supplier',
    'customer': 'Customer',
    'products': 'Products',
  };
  return titleMap[relType] || relType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

/**
 * Get icon for relationship type
 */
const getRelationshipIcon = (relType: string) => {
  switch (relType) {
    case 'purchase_orders':
    case 'sales_orders':
      return <FileText size={16} />;
    case 'contacts':
      return <Users size={16} />;
    case 'products':
      return <Package size={16} />;
    case 'line_items':
      return <FileText size={16} />;
    case 'supplier':
      return <Building2 size={16} />;
    case 'customer':
      return <Users size={16} />;
    default:
      return <FileText size={16} />;
  }
};

/**
 * Format entity subtitle from metadata
 */
const formatEntitySubtitle = (item: any): string => {
  // Use smart labels if available
  if (item.metadata?.labels && item.metadata.labels.length > 0) {
    return item.metadata.labels[0]; // Show first label
  }
  
  // Fallback to common fields
  if (item.subtitle) return item.subtitle;
  if (item.status) return item.status;
  if (item.quantity) return `Qty: ${item.quantity}`;
  
  return '';
};

/**
 * Get quick actions for an entity type
 */
const getQuickActionsForEntity = (entity: SearchEntity): RelationalChunk => {
  const actions: SearchEntity[] = [];
  
  switch (entity.type) {
    case 'customer':
      actions.push(
        { id: 'create-invoice', type: 'order', name: 'Create Invoice', subtitle: 'Generate new invoice for this customer', metadata: { action: 'create_invoice', entityId: entity.id } },
        { id: 'schedule-call', type: 'inquiry', name: 'Schedule Call', subtitle: 'Set up a call reminder', metadata: { action: 'schedule_call', entityId: entity.id } },
        { id: 'view-history', type: 'order', name: 'View Full History', subtitle: 'See all transactions and interactions', metadata: { action: 'view_history', entityId: entity.id } }
      );
      break;
    
    case 'supplier':
      actions.push(
        { id: 'create-po', type: 'order', name: 'Create Purchase Order', subtitle: 'Start new PO with this supplier', metadata: { action: 'create_po', entityId: entity.id } },
        { id: 'send-email', type: 'inquiry', name: 'Send Email', subtitle: 'Contact supplier via email', metadata: { action: 'send_email', entityId: entity.id } },
        { id: 'view-history', type: 'order', name: 'View Purchase History', subtitle: 'See all orders from this supplier', metadata: { action: 'view_history', entityId: entity.id } }
      );
      break;
    
    case 'product':
      actions.push(
        { id: 'adjust-inventory', type: 'product', name: 'Adjust Inventory', subtitle: 'Update stock levels', metadata: { action: 'adjust_inventory', entityId: entity.id } },
        { id: 'update-pricing', type: 'product', name: 'Update Pricing', subtitle: 'Change product pricing', metadata: { action: 'update_pricing', entityId: entity.id } },
        { id: 'view-movement', type: 'product', name: 'View Stock Movement', subtitle: 'See inventory history', metadata: { action: 'view_movement', entityId: entity.id } }
      );
      break;
    
    case 'contact':
      actions.push(
        { id: 'send-email', type: 'inquiry', name: 'Send Email', subtitle: 'Contact via email', metadata: { action: 'send_email', entityId: entity.id } },
        { id: 'schedule-meeting', type: 'inquiry', name: 'Schedule Meeting', subtitle: 'Set up a meeting', metadata: { action: 'schedule_meeting', entityId: entity.id } }
      );
      break;
  }
  
  return {
    type: 'actions' as any,
    title: 'Quick Actions',
    items: actions,
    icon: <TrendingUp size={16} />,
  };
};

// ============================================================================
// Main Component
// ============================================================================

export const SmartSearch: React.FC<SmartSearchProps> = ({
  initialQuery = '',
  query: controlledQuery,
  onQueryChange,
  hideInput = false,
  onSelectEntity,
  onClose,
}) => {

  // Use global navigation context instead of local breadcrumbs
  const navigation = useCockpitNavigation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [internalQuery, setInternalQuery] = useState(initialQuery);
  const query = controlledQuery ?? internalQuery;
  const [results, setResults] = useState<Record<string, SearchEntity[]>>({});
  const [relationalChunks, setRelationalChunks] = useState<RelationalChunk[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [isRelationsLoading, setIsRelationsLoading] = useState(false);

  const [activeRelationTab, setActiveRelationTab] = useState<'orders' | 'invoices' | 'contacts' | 'more'>('orders');
  const [relationTabData, setRelationTabData] = useState<Record<string, { items: SearchEntity[]; count: number }>>({});
  const [loadingRelationTab, setLoadingRelationTab] = useState<string | null>(null);

  /**
   * Load favorites from localStorage
   */
  useEffect(() => {
    const savedFavorites = localStorage.getItem('cockpit_favorites');
    if (savedFavorites) {
      try {
        setFavorites(new Set(JSON.parse(savedFavorites)));
      } catch (error) {
        console.error('[SmartSearch] Failed to load favorites:', error);
      }
    }
  }, []);

  /**
   * Save favorites to localStorage
   */
  const saveFavorites = useCallback((newFavorites: Set<string>) => {
    localStorage.setItem('cockpit_favorites', JSON.stringify(Array.from(newFavorites)));
  }, []);

  /**
   * Search entities with debouncing
   */
  const searchEntities = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults({});
      return;
    }

    setIsSearching(true);

    try {
      console.log('[SmartSearch] Searching for:', searchQuery);
      
      // Call universal search API (correct endpoint)
      const response = await businessApi.get('/search/universal/', {
        params: { q: searchQuery, limit: 5 },
      });

      console.log('[SmartSearch] Search response:', response.data);

      // The API returns results already grouped by type
      // Format: { results: [{type, id, title, subtitle, metadata}], counts: {}, total: N }
      const grouped: Record<string, SearchEntity[]> = {};
      
      if (response.data.results && Array.isArray(response.data.results)) {
        response.data.results.forEach((item: any) => {
          const type = String(item.type ?? 'unknown');
          if (!grouped[type]) {
            grouped[type] = [];
          }
          grouped[type].push({
            id: String(item.id ?? ''),
            type,
            name: item.title || item.name || 'Unnamed',
            subtitle: item.subtitle || '',
            metadata: (item.metadata ?? {}) as Record<string, unknown>,
          });
        });
      }

      console.log('[SmartSearch] Grouped results:', grouped);
      setResults(grouped);
    } catch (error: any) {
      console.error('[SmartSearch] Search failed:', error);
      console.error('[SmartSearch] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setResults({});
    } finally {
      setIsSearching(false);
    }
  }, []);

  /**
   * Handle query change with debouncing
   */
  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;

    if (controlledQuery !== undefined) {
      onQueryChange?.(newQuery);
      return;
    }

    setInternalQuery(newQuery);
  }, [controlledQuery, onQueryChange]);

  const debouncedSearch = useMemo(() => debounce((q: string) => {
    searchEntities(q);
  }, 300), [searchEntities]);

  useEffect(() => {
    debouncedSearch(query);
    return () => debouncedSearch.cancel();
  }, [debouncedSearch, query]);

  /**
   * Load relational chunks for an entity using Entity Graph API + Fuzzy Discovery
   */
  const loadRelationalChunks = useCallback(async (entity: SearchEntity) => {
    setIsRelationsLoading(true);

    try {
      console.log('[SmartSearch] Loading relationships for:', entity);
      
      // Use unified Entity Graph API
      const response = await businessApi.get(
        `/system/entities/${entity.type}/${entity.id}/relationships/`
      );
      
      console.log('[SmartSearch] Entity relationships:', response.data);
      
      const chunks: RelationalChunk[] = [];
      const { relationships } = response.data;
      
      // Transform API relationships to chunks
      Object.entries(relationships).forEach(([relType, items]: [string, any]) => {
        if (!items || items.length === 0) return;
        
        const chunk: RelationalChunk = {
          type: relType as any,
          title: formatRelationshipTitle(relType),
          items: items.map((item: any) => ({
            id: String(item.id ?? ''),
            type: String(item.type ?? 'unknown'),
            name: item.title || item.name || `${item.type} #${item.id}`,
            subtitle: formatEntitySubtitle(item),
            metadata: (item.metadata ?? {}) as Record<string, unknown>,
          })),
          icon: getRelationshipIcon(relType),
        };
        
        chunks.push(chunk);
      });

      // FUZZY DISCOVERY: Fetch fuzzy-matched related entities
      try {
        const fuzzyResponse = await businessApi.get(
          `/system/entities/${entity.type}/${entity.id}/fuzzy-related/`,
          { params: { max_results: 30 } }
        );
        
        console.log('[SmartSearch] Fuzzy matches:', fuzzyResponse.data);
        
        if (fuzzyResponse.data.fuzzy_matches && fuzzyResponse.data.fuzzy_matches.length > 0) {
          // Group fuzzy matches by type
          const fuzzyByType: Record<string, any[]> = {};
          
          fuzzyResponse.data.fuzzy_matches.forEach((match: any) => {
            if (!fuzzyByType[match.type]) {
              fuzzyByType[match.type] = [];
            }
            fuzzyByType[match.type].push(match);
          });
          
          // Add fuzzy chunks with distinctive styling
          Object.entries(fuzzyByType).forEach(([matchType, matches]) => {
            const fuzzyChunk: RelationalChunk = {
              type: `fuzzy_${matchType}`,
              title: `${formatRelationshipTitle(matchType)} (Fuzzy Matches)`,
              items: (matches as any[]).map((match: any) => ({
                id: String(match.id ?? ''),
                type: String(match.type ?? 'unknown'),
                name: match.name,
                subtitle: match.subtitle || `Match: ${match.metadata?.match_type || 'Unknown'}`,
                metadata: {
                  ...(match.metadata ?? {}),
                  fuzzy: true,
                  relevance_score: match.relevance_score || 0.5,
                } as Record<string, unknown>,
              })),
              icon: getRelationshipIcon(matchType),
            };

            chunks.push(fuzzyChunk);
          });
        }
      } catch (fuzzyError) {
        // Fuzzy discovery is optional - don't fail if it errors
        console.warn('[SmartSearch] Fuzzy discovery failed (non-fatal):', fuzzyError);
      }

      // Add Quick Actions chunk at the end
      const quickActions = getQuickActionsForEntity(entity);
      if (quickActions.items.length > 0) {
        chunks.push(quickActions);
      }

      setRelationalChunks(chunks);
    } catch (error) {
      console.error('[SmartSearch] Failed to load relational chunks:', error);
      setRelationalChunks([]);
    } finally {
      setIsRelationsLoading(false);
    }
  }, []);

  /**
   * Handle entity selection - push into the global navigation path.
   * Relational chunks are loaded by the navigation-path effect.
   */
  const handleSelectEntity = useCallback((entity: SearchEntity) => {
    navigation.addStep({
      id: entity.id,
      type: entity.type,
      label: entity.name,
      subtitle: entity.subtitle,
    });

    // If a caller provided a handler, defer to it (backwards compatible).
    if (onSelectEntity) {
      onSelectEntity(entity);
      return;
    }

    // Canonical Cockpit Detail View trigger (customer/supplier)
    const rawType = String(entity.type ?? '').toLowerCase();
    const canonicalType = rawType === 'customer' || rawType === 'customers'
      ? 'customer'
      : rawType === 'supplier' || rawType === 'suppliers'
      ? 'supplier'
      : null;

    if (canonicalType) {
      navigate(`/cockpit/entity/${canonicalType}/${encodeURIComponent(entity.id)}`, {
        state: { initialLabel: entity.name },
      });
    }
  }, [navigate, navigation, onSelectEntity]);


  /**
   * Handle quick action click
   */
  const handleQuickAction = useCallback((action: SearchEntity) => {
    const actionType = action.metadata?.action as string | undefined;
    const entityId = (action.metadata?.entityId as string | number | undefined) ?? action.id;

    if (!actionType) {
      console.warn('[SmartSearch] Quick action missing actionType', action);
      return;
    }

    const activeContext = navigation.path[navigation.path.length - 1];
    const prefillBase = {
      source: 'cockpit',
      query,
      contextEntity: activeContext
        ? {
            id: activeContext.id,
            type: activeContext.type,
            label: activeContext.label,
          }
        : undefined,
    };

    switch (actionType) {
      case 'create_po': {
        const supplierId = entityId ? String(entityId) : '';
        const params = new URLSearchParams({ action: 'create' });
        if (supplierId) params.set('supplier_id', supplierId);
        if (query) params.set('cockpit_q', query);

        navigate(`/purchase-orders?${params.toString()}`, {
          state: {
            prefill: {
              ...prefillBase,
              supplierId,
            },
          },
        });
        break;
      }
      case 'view_purchase_history':
      case 'view_history':
        navigate(`/purchase-orders?supplier_id=${entityId}`);
        break;
      case 'send_email':
        window.dispatchEvent(new CustomEvent('pm:open-tool', { detail: { toolId: 'tool:email' } }));
        break;
      case 'create_so': {
        const customerId = entityId ? String(entityId) : '';
        const params = new URLSearchParams({ action: 'create' });
        if (customerId) params.set('customer_id', customerId);
        if (query) params.set('cockpit_q', query);

        navigate(`/sales-orders?${params.toString()}`, {
          state: {
            prefill: {
              ...prefillBase,
              customerId,
            },
          },
        });
        break;
      }
      case 'view_sales_history':
        navigate(`/sales-orders?customer_id=${entityId}`);
        break;
      default:
        console.warn('Unhandled quick action:', actionType, 'for entity', entityId);
    }
  }, [navigate, navigation.path, query]);

  /**
   * Toggle favorite
   */
  const toggleFavorite = useCallback((entityId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(entityId)) {
        newFavorites.delete(entityId);
      } else {
        newFavorites.add(entityId);
      }
      saveFavorites(newFavorites);
      return newFavorites;
    });
  }, [saveFavorites]);

  /**
   * Clear search
   */
  const handleClear = useCallback(() => {
    if (controlledQuery !== undefined) {
      onQueryChange?.('');
    } else {
      setInternalQuery('');
    }

    setResults({});
    setRelationalChunks([]);
    navigation.clearPath();
    onClose?.();
  }, [controlledQuery, navigation, onQueryChange, onClose]);

  const activeStep = navigation.path[navigation.path.length - 1];

  const handleNavigateToEntity = useCallback((nextType: string, nextId: string, label: string) => {
    navigation.addStep({
      id: nextId,
      type: nextType,
      label,
    });
  }, [navigation]);

  const activeEntity = useMemo(() => {
    if (!activeStep) return null;

    const rawType = String(activeStep.type ?? '').toLowerCase();
    const canonicalType = rawType === 'customers'
      ? 'customer'
      : rawType === 'suppliers'
      ? 'supplier'
      : rawType;

    return {
      id: String(activeStep.id),
      type: canonicalType,
      name: activeStep.label,
      subtitle: activeStep.subtitle,
    } satisfies SearchEntity;
  }, [activeStep]);

  const isPrimaryEntity = useMemo(() => {
    const raw = String(activeEntity?.type ?? '').toLowerCase();
    return raw === 'customer' || raw === 'supplier';
  }, [activeEntity?.type]);

  const loadRelationshipTab = useCallback(async (tabKey: 'orders' | 'invoices' | 'contacts', entity: SearchEntity) => {
    const relationshipType = tabKey === 'orders'
      ? 'recent_orders'
      : tabKey === 'contacts'
      ? 'contacts'
      : 'invoices';

    setLoadingRelationTab(tabKey);
    try {
      const response = await businessApi.get(
        `/system/entities/${encodeURIComponent(entity.type)}/${encodeURIComponent(entity.id)}/relationships/`,
        { params: { relationship_types: relationshipType } }
      );

      const items = (response.data?.relationships?.[relationshipType] ?? []) as any[];
      const count = Number(response.data?.counts?.[relationshipType] ?? items.length);

      const mapped: SearchEntity[] = items.map((item: any) => ({
        id: String(item.id ?? ''),
        type: String(item.type ?? 'unknown'),
        name: item.title || item.name || `${item.type} #${item.id}`,
        subtitle: formatEntitySubtitle(item),
        metadata: (item.metadata ?? {}) as Record<string, unknown>,
      }));

      setRelationTabData(prev => ({
        ...prev,
        [tabKey]: { items: mapped, count },
      }));
    } catch (error) {
      console.error('[SmartSearch] Failed to load relationship tab:', tabKey, error);
      setRelationTabData(prev => ({
        ...prev,
        [tabKey]: { items: [], count: 0 },
      }));
    } finally {
      setLoadingRelationTab(prev => (prev === tabKey ? null : prev));
    }
  }, []);

  // Continuous browsing: when the breadcrumb path changes, load the most relevant panel.
  useEffect(() => {
    if (!activeEntity) {
      setRelationalChunks([]);
      setRelationTabData({});
      setLoadingRelationTab(null);
      return;
    }

    if (isPrimaryEntity) {
      setActiveRelationTab('orders');
      setRelationTabData({});
      void loadRelationshipTab('orders', activeEntity);
      return;
    }

    void loadRelationalChunks(activeEntity);
  }, [activeEntity, isPrimaryEntity, loadRelationalChunks, loadRelationshipTab]);

  /**
   * Render search results (top-5 per type)
   */
  const renderSearchResults = () => {
    const types = Object.keys(results);

    if (types.length === 0) {
      return (
        <EmptyState>
          <EmptyIcon>
            <Search size={48} />
          </EmptyIcon>
          <EmptyTitle>No results found</EmptyTitle>
          <EmptyMessage>
            Try a different search term or check your spelling
          </EmptyMessage>
        </EmptyState>
      );
    }

    return types.map(type => {
      const entities = results[type];
      const typeLabel = type.charAt(0).toUpperCase() + type.slice(1) + 's';

      return (
        <Section key={type}>
          <SectionHeader>
            <SectionTitle>
              {getEntityIcon(type as SearchEntity['type'], 16)}
              {typeLabel}
              <SectionCount>({entities.length})</SectionCount>
            </SectionTitle>
          </SectionHeader>

          <ResultGrid>
            {entities.map(entity => (
              <ResultCard
                key={entity.id}
                onClick={() => handleSelectEntity(entity)}
              >
                <ResultIcon $color={getEntityColor(entity.type)}>
                  {getEntityIcon(entity.type)}
                </ResultIcon>

                <ResultContent>
                  <ResultTitle>{entity.name}</ResultTitle>
                  {entity.subtitle && (
                    <ResultSubtitle>{entity.subtitle}</ResultSubtitle>
                  )}
                  <ResultMeta>
                    <Clock size={10} />
                    Last modified: Today
                  </ResultMeta>
                </ResultContent>

                <FavoriteButton
                  $isFavorite={favorites.has(entity.id)}
                  onClick={(e) => toggleFavorite(entity.id, e)}
                  title={favorites.has(entity.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star size={16} />
                </FavoriteButton>
              </ResultCard>
            ))}
          </ResultGrid>
        </Section>
      );
    });
  };

  /**
   * Render relational chunks
   */
  const renderRelationalChunks = (chunks: RelationalChunk[] = relationalChunks) => {
    if (chunks.length === 0) {
      return (
        <EmptyState>
          <EmptyIcon>
            <TrendingUp size={48} />
          </EmptyIcon>
          <EmptyTitle>No related items</EmptyTitle>
          <EmptyMessage>
            This entity doesn't have any related records yet
          </EmptyMessage>
        </EmptyState>
      );
    }

    return chunks.map(chunk => (
      <Section key={chunk.type}>
        <SectionHeader>
          <SectionTitle>
            {chunk.icon}
            {chunk.title}
            <SectionCount>({chunk.items.length})</SectionCount>
          </SectionTitle>
        </SectionHeader>

        <ResultGrid>
          {chunk.items.map(item => (
            <ResultCard
              key={item.id}
              onClick={() => chunk.type === 'actions' ? handleQuickAction(item) : handleSelectEntity(item)}
              style={chunk.type === 'actions' ? { cursor: 'pointer', borderStyle: 'dashed' } : {}}
            >
              <ResultIcon $color={getEntityColor(item.type)}>
                {getEntityIcon(item.type)}
              </ResultIcon>

              <ResultContent>
                <ResultTitle>{item.name}</ResultTitle>
                {item.subtitle && (
                  <ResultSubtitle>{item.subtitle}</ResultSubtitle>
                )}
              </ResultContent>

              {chunk.type !== 'actions' && (
                <FavoriteButton
                  $isFavorite={favorites.has(item.id)}
                  onClick={(e) => toggleFavorite(item.id, e)}
                  title={favorites.has(item.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star size={16} />
                </FavoriteButton>
              )}
            </ResultCard>
          ))}
        </ResultGrid>
      </Section>
    ));
  };

  const cockpitSubview = searchParams.get('cockpit_subview');
  const isInlineCreateSalesOrderOpen = cockpitSubview === 'create_so';

  // Keep breadcrumbs in sync with URL-driven subview.
  useEffect(() => {
    if (!activeEntity || !isPrimaryEntity) return;

    const last = navigation.path[navigation.path.length - 1];
    const subviewStepId = 'subview:create_so';
    const hasSubviewStep = last?.id === subviewStepId;

    if (isInlineCreateSalesOrderOpen && !hasSubviewStep) {
      navigation.addStep({
        id: subviewStepId,
        type: 'subview',
        label: 'New Sales Order',
      });
    }

    if (!isInlineCreateSalesOrderOpen && hasSubviewStep) {
      navigation.goBack(1);
    }
  }, [activeEntity, isPrimaryEntity, isInlineCreateSalesOrderOpen, navigation, navigation.path]);

  const openInlineCreateSalesOrder = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.set('cockpit_subview', 'create_so');
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const closeInlineSubview = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('cockpit_subview');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const tabCTA = useMemo(() => {
    if (!activeEntity || !isPrimaryEntity) return null;

    if (activeRelationTab === 'orders') {
      const type = String(activeEntity.type).toLowerCase();
      const isSupplier = type === 'supplier';
      const actionType = isSupplier ? 'create_po' : 'create_so';
      const label = isSupplier ? '+ New Purchase Order' : '+ New Sales Order';

      return (
        <Button
          type="primary"
          onClick={() => {
            if (actionType === 'create_so' && type === 'customer') {
              openInlineCreateSalesOrder();
              return;
            }

            handleQuickAction({
              id: `action:${actionType}`,
              type: 'action',
              name: label,
              metadata: {
                action: actionType,
                entityId: activeEntity.id,
              },
            });
          }}
        >
          {label}
        </Button>
      );
    }

    return null;
  }, [activeEntity, activeRelationTab, handleQuickAction, isPrimaryEntity, openInlineCreateSalesOrder]);

  return (
    <Container>
      {!hideInput && (
        <SearchHeader>
          <SearchInputWrapper>
            <SearchIcon>
              <Search size={18} />
            </SearchIcon>
            <SearchInput
              type="text"
              placeholder="Search customers, suppliers, orders..."
              value={query}
              onChange={handleQueryChange}
              autoFocus
            />
            {query && (
              <ClearButton onClick={handleClear} title="Clear search">
                <X size={18} />
              </ClearButton>
            )}
          </SearchInputWrapper>
        </SearchHeader>
      )}

      <ContentArea>
        {activeStep && (
          <>
            <AIOverviewCard entityType={activeEntity?.type ?? activeStep.type} entityId={String(activeStep.id)} />
            <EntityProfileHeader
              entityType={activeEntity?.type ?? activeStep.type}
              entityId={String(activeStep.id)}
              onNavigateToEntity={handleNavigateToEntity}
              variant={isPrimaryEntity ? 'compact' : 'full'}
            />
          </>
        )}

        {isInlineCreateSalesOrderOpen && activeEntity && String(activeEntity.type).toLowerCase() === 'customer' && (
          <CreateOrderModal
            isOpen={true}
            onClose={closeInlineSubview}
            onSuccess={closeInlineSubview}
            initialValues={{ customer: String(activeEntity.id) }}
          />
        )}

        {activeStep ? (
          isPrimaryEntity ? (
            <Tabs
              activeKey={activeRelationTab}
              tabBarExtraContent={tabCTA}
              onChange={(nextKey) => {
                const key = nextKey as typeof activeRelationTab;
                setActiveRelationTab(key);
                if (!activeEntity) return;

                if (key === 'more') {
                  if (relationalChunks.length === 0 && !isRelationsLoading) {
                    void loadRelationalChunks(activeEntity);
                  }
                  return;
                }

                const typed = key as 'orders' | 'invoices' | 'contacts';
                if (!relationTabData[typed] && loadingRelationTab !== typed) {
                  void loadRelationshipTab(typed, activeEntity);
                }
              }}
              items={([
                {
                  key: 'orders',
                  label: `Orders${relationTabData.orders ? ` (${relationTabData.orders.count})` : ''}`,
                  children: loadingRelationTab === 'orders' ? (
                    <div style={{ padding: 12 }}><Spin /></div>
                  ) : relationTabData.orders?.items?.length ? (
                    <ResultGrid>
                      {relationTabData.orders.items.map(item => (
                        <ResultCard key={item.id} onClick={() => handleSelectEntity(item)}>
                          <ResultIcon $color={getEntityColor(item.type)}>
                            {getEntityIcon(item.type)}
                          </ResultIcon>
                          <ResultContent>
                            <ResultTitle>{item.name}</ResultTitle>
                            {item.subtitle && <ResultSubtitle>{item.subtitle}</ResultSubtitle>}
                          </ResultContent>
                        </ResultCard>
                      ))}
                    </ResultGrid>
                  ) : (
                    <EmptyState>
                      <EmptyIcon><FileText size={48} /></EmptyIcon>
                      <EmptyTitle>No orders yet</EmptyTitle>
                      <EmptyMessage>Orders will appear here once created</EmptyMessage>
                    </EmptyState>
                  ),
                },
                {
                  key: 'invoices',
                  label: `Invoices${relationTabData.invoices ? ` (${relationTabData.invoices.count})` : ''}`,
                  children: loadingRelationTab === 'invoices' ? (
                    <div style={{ padding: 12 }}><Spin /></div>
                  ) : relationTabData.invoices?.items?.length ? (
                    <ResultGrid>
                      {relationTabData.invoices.items.map(item => (
                        <ResultCard key={item.id} onClick={() => handleSelectEntity(item)}>
                          <ResultIcon $color={getEntityColor(item.type)}>
                            {getEntityIcon(item.type)}
                          </ResultIcon>
                          <ResultContent>
                            <ResultTitle>{item.name}</ResultTitle>
                            {item.subtitle && <ResultSubtitle>{item.subtitle}</ResultSubtitle>}
                          </ResultContent>
                        </ResultCard>
                      ))}
                    </ResultGrid>
                  ) : (
                    <EmptyState>
                      <EmptyIcon><FileText size={48} /></EmptyIcon>
                      <EmptyTitle>No invoices yet</EmptyTitle>
                      <EmptyMessage>Invoices will appear here once issued</EmptyMessage>
                    </EmptyState>
                  ),
                },
                {
                  key: 'contacts',
                  label: `Contacts${relationTabData.contacts ? ` (${relationTabData.contacts.count})` : ''}`,
                  children: loadingRelationTab === 'contacts' ? (
                    <div style={{ padding: 12 }}><Spin /></div>
                  ) : relationTabData.contacts?.items?.length ? (
                    <ResultGrid>
                      {relationTabData.contacts.items.map(item => (
                        <ResultCard key={item.id} onClick={() => handleSelectEntity(item)}>
                          <ResultIcon $color={getEntityColor(item.type)}>
                            {getEntityIcon(item.type)}
                          </ResultIcon>
                          <ResultContent>
                            <ResultTitle>{item.name}</ResultTitle>
                            {item.subtitle && <ResultSubtitle>{item.subtitle}</ResultSubtitle>}
                          </ResultContent>
                        </ResultCard>
                      ))}
                    </ResultGrid>
                  ) : (
                    <EmptyState>
                      <EmptyIcon><Users size={48} /></EmptyIcon>
                      <EmptyTitle>No contacts yet</EmptyTitle>
                      <EmptyMessage>Contacts will appear here once added</EmptyMessage>
                    </EmptyState>
                  ),
                },
                {
                  key: 'more',
                  label: 'More',
                  children: isRelationsLoading ? (
                    <div style={{ padding: 12 }}><Spin /></div>
                  ) : (
                    renderRelationalChunks()
                  ),
                },
              ] as any[])}
            />
          ) : isRelationsLoading ? (
            <EmptyState>
              <EmptyIcon>
                <Search size={48} />
              </EmptyIcon>
              <EmptyTitle>Loading record context…</EmptyTitle>
            </EmptyState>
          ) : (
            renderRelationalChunks()
          )
        ) : isSearching ? (
          <EmptyState>
            <EmptyIcon>
              <Search size={48} />
            </EmptyIcon>
            <EmptyTitle>Searching…</EmptyTitle>
          </EmptyState>
        ) : (
          renderSearchResults()
        )}
      </ContentArea>
    </Container>
  );
};
