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
import { Tabs, Spin, Button, Dropdown, message, type MenuProps } from 'antd';
import { NotesAndCallsDrawer } from './NotesAndCallsDrawer';
import { businessApi } from '../../services/businessApi';
import { useCockpitNavigation } from '../../contexts/CockpitNavigationContext';
// UniversalEntityForm usage consolidated via EntityFormSurface

import { EntityFormSurface, ScheduleCallModal } from '../Shared';
import { InquiryCreateModal, InquiryEmbeddedView } from '../Inquiry';
import { EntityProfileHeader } from './EntityProfileHeader';
import { type Inquiry } from '@/types';
import { AIOverviewCard } from './AIOverviewCard';
import { useFavorites } from '../../hooks/useFavorites';

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

export interface InlineActionPayload {
  action: 'create' | 'edit';
  entityType: string;
  contextData: any;
}

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

  /** Inline create/edit state owned by CockpitDashboard */
  inlineAction?: InlineActionPayload | null;
  /** Cancel inline create/edit */
  onInlineCancel?: () => void;
  /** Inline create/edit success */
  onInlineSuccess?: () => void;
  /** Request an inline create action */
  onOpenInlineCreate?: (targetType: string, currentRecord: SearchEntity) => void;
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

const ResultCard = styled.div.attrs({ role: 'button', tabIndex: 0 })`
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

  &:focus-visible {
    outline: 2px solid rgba(var(--color-primary), 0.6);
    outline-offset: 2px;
  }
`;

const ResultIcon = styled.div<{ $tone?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: ${props => props.$tone ? `rgba(${props.$tone}, 0.12)` : 'rgba(var(--color-primary), 0.12)'};
  color: ${props => props.$tone ? `rgb(${props.$tone})` : 'rgb(var(--color-primary))'};
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
    case 'customer':
      return <Users size={size} />;
    case 'supplier':
      return <Building2 size={size} />;
    case 'contact':
      return <Users size={size} />;
    case 'product':
      return <Package size={size} />;
    case 'purchase_order':
    case 'sales_order':
    case 'invoice':
      return <FileText size={size} />;
    case 'inquiry':
      return <FileText size={size} />;
    case 'claim':
      return <FileText size={size} />;
    case 'call':
      return <Clock size={size} />;
    case 'tenant_user':
      return <Users size={size} />;
    default:
      return <FileText size={size} />;
  }
};

const getEntityTone = (type: SearchEntity['type']) => {
  // Return an RGB tuple CSS var (e.g. "var(--color-success)") so we can use rgb()/rgba() safely.
  switch (type) {
    case 'customer':
      return 'var(--color-success)';
    case 'supplier':
      return 'var(--color-primary)';
    case 'contact':
      return 'var(--color-info)';
    case 'product':
      return 'var(--color-warning)';
    case 'purchase_order':
    case 'sales_order':
    case 'invoice':
      return 'var(--color-warning)';
    case 'inquiry':
      return 'var(--color-error)';
    case 'claim':
      return 'var(--color-error)';
    case 'call':
      return 'var(--color-info)';
    case 'tenant_user':
      return 'var(--color-primary)';
    default:
      return 'var(--color-primary)';
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
  inlineAction = null,
  onInlineCancel,
  onInlineSuccess,
  onOpenInlineCreate,
}) => {

  // Use global navigation context instead of local breadcrumbs
  const navigation = useCockpitNavigation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [internalQuery, setInternalQuery] = useState(initialQuery);
  const query = controlledQuery ?? internalQuery;
  const [results, setResults] = useState<Record<string, SearchEntity[]>>({});
  const [resultCounts, setResultCounts] = useState<Record<string, number>>({});
  const [relationalChunks, setRelationalChunks] = useState<RelationalChunk[]>([]);
  const {
    favorites,
    toggleFavorite: toggleFavoriteMutation,
    isFavorited,
    isLoading: isFavoritesLoading,
  } = useFavorites();
  const [hasMigratedLegacyFavorites, setHasMigratedLegacyFavorites] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRelationsLoading, setIsRelationsLoading] = useState(false);

  const [activeRelationTab, setActiveRelationTab] = useState<'orders' | 'invoices' | 'contacts' | 'inquiries' | 'more'>('orders');
  const [isNotesDrawerOpen, setIsNotesDrawerOpen] = useState(false);
  const [showScheduleCallModal, setShowScheduleCallModal] = useState(false);
  const [defaultCallPurpose, setDefaultCallPurpose] = useState<string | undefined>(undefined);
  const [relationTabData, setRelationTabData] = useState<Record<string, { items: SearchEntity[]; count: number }>>({});
  const [loadingRelationTab, setLoadingRelationTab] = useState<string | null>(null);

  // Embedded Inquiry view (for customer → Inquiries tab). Keeps the user in Cockpit without opening a modal.
  const [embeddedInquiry, setEmbeddedInquiry] = useState<Inquiry | null>(null);
  const [isEmbeddedInquiryLoading, setIsEmbeddedInquiryLoading] = useState(false);
  const [embeddedInquiryError, setEmbeddedInquiryError] = useState<string | null>(null);

  const [quickCreateConfig, setQuickCreateConfig] = useState<{ isOpen: boolean; type: string; context: any }>(
    { isOpen: false, type: '', context: {} }
  );

  // Legacy migration: older builds stored favorites in localStorage. Best-effort ingest typed keys.
  useEffect(() => {
    if (hasMigratedLegacyFavorites) return;
    if (isFavoritesLoading) return;

    const savedFavorites = localStorage.getItem('cockpit_favorites');
    if (!savedFavorites) {
      setHasMigratedLegacyFavorites(true);
      return;
    }

    try {
      const raw = JSON.parse(savedFavorites) as unknown;
      const ids = Array.isArray(raw) ? (raw as unknown[]) : [];
      const normalized = ids.map((v) => String(v)).filter(Boolean);

      const typed = normalized
        .map((key) => {
          if (!key.includes(':')) return null;
          const [t, ...rest] = key.split(':');
          const type = String(t || '').trim().toLowerCase();
          const id = Number(rest.join(':'));
          if (!type || !Number.isFinite(id)) return null;
          return { type, id };
        })
        .filter((v): v is { type: string; id: number } => Boolean(v));

      for (const f of typed.slice(0, 50)) {
        if (!isFavorited(f.type, f.id)) {
          toggleFavoriteMutation.mutate({ entity_type: f.type, entity_id: f.id, entity_title: '' });
        }
      }
    } catch {
      // ignore
    } finally {
      try {
        localStorage.removeItem('cockpit_favorites');
      } catch {
        // ignore
      }
      setHasMigratedLegacyFavorites(true);
    }
  }, [hasMigratedLegacyFavorites, isFavoritesLoading, isFavorited, toggleFavoriteMutation]);
  /**
   * Search entities with debouncing
   */
  const searchEntities = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults({});
      setResultCounts({});
      return;
    }

    setIsSearching(true);

    try {
      
      // Call universal search API (correct endpoint)
      const response = await businessApi.get('/search/universal/', {
        params: { q: searchQuery, limit: 5 },
      });


      // The API returns flat results + counts per entity type.
      // Format: { results: [{type, id, title, subtitle, metadata}], counts: {type: count}, total: N }
      const grouped: Record<string, SearchEntity[]> = {};

      if (response.data.results && Array.isArray(response.data.results)) {
        response.data.results.forEach((item: any) => {
          const type = String(item.type ?? 'unknown');
          if (!grouped[type]) grouped[type] = [];
          grouped[type].push({
            id: String(item.id ?? ''),
            type,
            name: item.title || item.name || 'Unnamed',
            subtitle: item.subtitle || '',
            metadata: (item.metadata ?? {}) as Record<string, unknown>,
          });
        });
      }

      const countsObj = response.data?.counts && typeof response.data.counts === 'object'
        ? (response.data.counts as Record<string, unknown>)
        : {};
      const normalizedCounts: Record<string, number> = {};
      for (const [k, v] of Object.entries(countsObj)) {
        const n = typeof v === 'number' ? v : Number(v ?? 0);
        normalizedCounts[String(k)] = Number.isFinite(n) ? n : 0;
      }

      setResults(grouped);
      setResultCounts(normalizedCounts);
    } catch (error: any) {
      console.error('[SmartSearch] Search failed:', error);
      console.error('[SmartSearch] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setResults({});
      setResultCounts({});
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
  }, 120), [searchEntities]);

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
      
      // Use unified Entity Graph API
      const response = await businessApi.get(
        `/system/entities/${entity.type}/${entity.id}/relationships/`
      );
      
      
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
        }

      // Add Quick Actions chunk at the end
      const quickActions = getQuickActionsForEntity(entity);
      if (quickActions.items.length > 0) {
        chunks.push(quickActions);
      }

      setRelationalChunks(chunks);
    } catch (error) {
      // Non-fatal: keep UI responsive even if relationships endpoint is temporarily unhealthy.
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

  }, [navigation, onSelectEntity]);


  /**
   * Handle quick action click
   */
  const handleQuickAction = (action: SearchEntity) => {
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
        // Cockpit requirement: embedded creation (no redirects) when the host provides inline create.
        if (onOpenInlineCreate && activeEntity) {
          onOpenInlineCreate('purchase_order', activeEntity);
          return;
        }

        // Backwards-compatible fallback: redirect to entity page.
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
      case 'create_invoice': {
        // Prefer embedded quick-create with customer context.
        if (onOpenInlineCreate && activeEntity) {
          onOpenInlineCreate('invoice', activeEntity);
          return;
        }

        if (activeEntity) {
          setActiveRelationTab('invoices');
        }
        openQuickCreate('invoice');
        break;
      }
      case 'schedule_call': {
        setDefaultCallPurpose('follow_up');
        setShowScheduleCallModal(true);
        break;
      }
      case 'view_purchase_history':
        navigate(`/purchase-orders?supplier_id=${entityId}`);
        break;
      case 'view_history': {
        const t = String(activeEntity?.type ?? '').toLowerCase();
        if (t === 'customer') {
          navigate(`/sales-orders?customer_id=${entityId}`);
        } else {
          navigate(`/purchase-orders?supplier_id=${entityId}`);
        }
        break;
      }
      case 'send_email':
        window.dispatchEvent(new CustomEvent('pm:open-tool', { detail: { toolId: 'tool:email' } }));
        break;
      case 'create_so': {
        // Cockpit requirement: embedded creation (no redirects).
        // Preferred: full Universal form embedded for sales orders.
        if (activeEntity && String(activeEntity.type).toLowerCase() === 'customer') {
          const next = new URLSearchParams(searchParams);
          next.set('cockpit_subview', 'create_so');
          setSearchParams(next);
          return;
        }

        if (onOpenInlineCreate && activeEntity) {
          onOpenInlineCreate('sales_order', activeEntity);
          return;
        }

        // Backwards-compatible fallback: redirect to entity page.
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
      case 'adjust_inventory':
      case 'update_pricing':
      case 'view_movement':
      case 'schedule_meeting':
        message.info('Coming soon');
        break;
      default:
        console.warn('Unhandled quick action:', actionType, 'for entity', entityId);
    }
  };

  /**
   * Toggle favorite
   */
  const toggleFavorite = useCallback((entityType: string, entityId: string, entityTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const type = String(entityType || '').toLowerCase();
    const id = Number(entityId);
    if (!type || !Number.isFinite(id)) return;

    toggleFavoriteMutation.mutate(
      {
        entity_type: type,
        entity_id: id,
        entity_title: entityTitle || '',
      },
      {
        onError: () => {
          message.error('Failed to update favorite. Please try again.');
        },
      }
    );
  }, [toggleFavoriteMutation]);

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
    setResultCounts({});
    setRelationalChunks([]);
    navigation.clearPath();
    onClose?.();
  }, [controlledQuery, navigation, onQueryChange, onClose]);

  const activeStep = navigation.path[navigation.path.length - 1];

  const handleCardKeyDown = useCallback((e: React.KeyboardEvent, onActivate: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onActivate();
    }
  }, []);


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

  useEffect(() => {
    // Only customer records should embed inquiry details. Clear selection when changing the active record.
    setEmbeddedInquiry(null);
    setEmbeddedInquiryError(null);
    setIsEmbeddedInquiryLoading(false);
  }, [activeEntity?.id, activeEntity?.type]);

  const handleSelectEmbeddedInquiry = useCallback(async (inquiryId: string) => {
    const id = String(inquiryId || '').trim();
    if (!id) return;

    setIsEmbeddedInquiryLoading(true);
    setEmbeddedInquiryError(null);

    try {
      const response = await businessApi.get(`/inquiries/${id}/`);
      setEmbeddedInquiry(response.data as Inquiry);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to load inquiry details.';
      setEmbeddedInquiry(null);
      setEmbeddedInquiryError(String(msg));
    } finally {
      setIsEmbeddedInquiryLoading(false);
    }
  }, []);

  const buildCascadeContext = useCallback((source: SearchEntity | null, targetType: string) => {
    if (!source) return {};

    const sourceType = String(source.type ?? '').toLowerCase();
    const sourceId = String(source.id ?? '').trim();
    const target = String(targetType ?? '').toLowerCase();

    if (!sourceType || !sourceId) return {};

    const ctx: Record<string, any> = {
      source: 'cockpit',
      source_entity_type: sourceType,
      source_entity_id: sourceId,
    };

    // Always include the "{type}_id" alias for safety.
    ctx[`${sourceType}_id`] = sourceId;

    if (sourceType === 'customer') {
      ctx.customer = sourceId;
      ctx.customer_id = sourceId;

      if (target === 'sales_order' || target === 'invoice' || target === 'inquiry' || target === 'contact') {
        ctx.customer = sourceId;
      }
    }

    if (sourceType === 'supplier') {
      ctx.supplier = sourceId;
      ctx.supplier_id = sourceId;

      if (target === 'purchase_order' || target === 'inquiry' || target === 'contact') {
        ctx.supplier = sourceId;
      }
    }

    return ctx;
  }, []);

  const openQuickCreate = useCallback((type: string) => {
    const context = buildCascadeContext(activeEntity, type);
    setQuickCreateConfig({ isOpen: true, type, context });
  }, [activeEntity, buildCascadeContext]);

  const closeQuickCreate = useCallback(() => {
    setQuickCreateConfig({ isOpen: false, type: '', context: {} });
  }, []);

  const formatEntityLabel = useCallback((raw: string) => {
    const cleaned = String(raw || '').replace(/_/g, ' ').trim();
    if (!cleaned) return 'Record';
    return cleaned.split(' ').map((w) => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ');
  }, []);

  const formatEntityTypePluralLabel = useCallback((raw: string) => {
    const type = String(raw || '').toLowerCase();
    const overrides: Record<string, string> = {
      purchase_order: 'Purchase Orders',
      sales_order: 'Sales Orders',
      tenant_user: 'Tenant Users',
      inquiry: 'Inquiries',
      claim: 'Claims',
      call: 'Calls',
      invoice: 'Invoices',
      customer: 'Customers',
      supplier: 'Suppliers',
      contact: 'Contacts',
      product: 'Products',
      plant: 'Plants',
      carrier: 'Carriers',
    };
    if (overrides[type]) return overrides[type];

    const base = formatEntityLabel(type);
    if (!base) return 'Records';
    if (base.endsWith('s')) return base;
    return `${base}s`;
  }, [formatEntityLabel]);

  const loadRelationshipTab = useCallback(async (tabKey: 'orders' | 'invoices' | 'contacts' | 'inquiries', entity: SearchEntity) => {
    const relationshipType = tabKey === 'orders'
      ? 'recent_orders'
      : tabKey === 'contacts'
      ? 'contacts'
      : tabKey === 'inquiries'
      ? 'inquiries'
      : 'invoices';

    setLoadingRelationTab(tabKey);
    try {
      // CRITICAL: trailing slash before query params prevents redirect loops (Nginx/Django APPEND_SLASH)
      const url = `/system/entities/${encodeURIComponent(entity.type)}/${encodeURIComponent(entity.id)}/relationships/?relationship_types=${encodeURIComponent(relationshipType)}`;
      const response = await businessApi.get(url);

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
      // Non-fatal: avoid noisy console errors for intermittent 5xxs.
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
    const types = Object.keys(resultCounts).length ? Object.keys(resultCounts) : Object.keys(results);

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

    const isEntityFavorited = (entity: SearchEntity) => {
      return isFavorited(String(entity.type).toLowerCase(), Number(entity.id));
    };

    const q = String(query || '').toLowerCase().trim();

    // Favorites section should be driven by the user's saved favorites (not only what's returned
    // in the top-N results per entity type). Filter by the current query so it stays relevant.
    const favoritesInResults: SearchEntity[] = (q
      ? favorites
          .filter((f) => String(f.entity_title || '').toLowerCase().includes(q))
          .slice(0, 12)
          .map((f) => ({
            id: String(f.entity_id),
            type: String(f.entity_type),
            name: String(f.entity_title || '').trim() || `${String(f.entity_type)} #${String(f.entity_id)}`,
            subtitle: 'Favorite',
            metadata: { favorite_created_at: f.created_at },
          }))
      : []);

    return (
      <>
        {favoritesInResults.length > 0 && (
          <Section key="favorites">
            <SectionHeader>
              <SectionTitle>
                <Star size={16} />
                Favorites
                <SectionCount>({favoritesInResults.length})</SectionCount>
              </SectionTitle>
            </SectionHeader>

            <ResultGrid>
              {favoritesInResults.map((entity) => {
                const favoritedOn = String((entity.metadata as any)?.favorite_created_at || '').slice(0, 10);

                return (
                  <ResultCard
                    key={`${String(entity.type)}:${String(entity.id)}`}
                    onClick={() => handleSelectEntity(entity)}
                    onKeyDown={(e) => handleCardKeyDown(e, () => handleSelectEntity(entity))}
                  >
                    <ResultIcon $tone={getEntityTone(entity.type)}>
                      {getEntityIcon(entity.type)}
                    </ResultIcon>

                    <ResultContent>
                      <ResultTitle>{entity.name}</ResultTitle>
                      {entity.subtitle && <ResultSubtitle>{entity.subtitle}</ResultSubtitle>}
                      <ResultMeta>
                        <Clock size={10} />
                        Favorited: {favoritedOn || '—'}
                      </ResultMeta>
                    </ResultContent>

                    <FavoriteButton
                      type="button"
                      $isFavorite={true}
                      onClick={(e) => toggleFavorite(entity.type, entity.id, entity.name, e)}
                      title="Remove from favorites"
                      aria-label="Remove from favorites"
                    >
                      <Star size={16} />
                    </FavoriteButton>
                  </ResultCard>
                );
              })}
            </ResultGrid>
          </Section>
        )}

        {types.map((type) => {
          const entities = (results[type] ?? []).filter((entity) => !isEntityFavorited(entity));
          if (entities.length === 0) return null;

          const count = resultCounts[type] ?? entities.length;
          const typeLabel = formatEntityTypePluralLabel(type);

          return (
            <Section key={type}>
              <SectionHeader>
                <SectionTitle>
                  {getEntityIcon(type as SearchEntity['type'], 16)}
                  {typeLabel}
                  <SectionCount>({count})</SectionCount>
                </SectionTitle>
                <Button size="small" type="primary" onClick={() => openQuickCreate(type)}>
                  + New {formatEntityLabel(type)}
                </Button>
              </SectionHeader>

              <ResultGrid>
                {entities.map((entity) => (
                  <ResultCard
                    key={entity.id}
                    onClick={() => handleSelectEntity(entity)}
                    onKeyDown={(e) => handleCardKeyDown(e, () => handleSelectEntity(entity))}
                  >
                    <ResultIcon $tone={getEntityTone(entity.type)}>
                      {getEntityIcon(entity.type)}
                    </ResultIcon>

                    <ResultContent>
                      <ResultTitle>{entity.name}</ResultTitle>
                      {entity.subtitle && <ResultSubtitle>{entity.subtitle}</ResultSubtitle>}
                      <ResultMeta>
                        <Clock size={10} />
                        Last modified: Today
                      </ResultMeta>
                    </ResultContent>

                    <FavoriteButton
                      type="button"
                      $isFavorite={isFavorited(String(entity.type).toLowerCase(), Number(entity.id))}
                      onClick={(e) => toggleFavorite(entity.type, entity.id, entity.name, e)}
                      title={
                        isFavorited(String(entity.type).toLowerCase(), Number(entity.id))
                          ? 'Remove from favorites'
                          : 'Add to favorites'
                      }
                      aria-label={
                        isFavorited(String(entity.type).toLowerCase(), Number(entity.id))
                          ? 'Remove from favorites'
                          : 'Add to favorites'
                      }
                    >
                      <Star size={16} />
                    </FavoriteButton>
                  </ResultCard>
                ))}
              </ResultGrid>
            </Section>
          );
        })}
      </>
    );
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
              onKeyDown={(e) => handleCardKeyDown(e, () => chunk.type === 'actions' ? handleQuickAction(item) : handleSelectEntity(item))}
              style={chunk.type === 'actions' ? { cursor: 'pointer', borderStyle: 'dashed' } : {}}
            >
              <ResultIcon $tone={getEntityTone(item.type)}>
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
                  type="button"
                  $isFavorite={isFavorited(String(item.type).toLowerCase(), Number(item.id))}
                  onClick={(e) => toggleFavorite(item.type, item.id, item.name, e)}
                  title={
                    isFavorited(String(item.type).toLowerCase(), Number(item.id))
                      ? 'Remove from favorites'
                      : 'Add to favorites'
                  }
                  aria-label={
                    isFavorited(String(item.type).toLowerCase(), Number(item.id))
                      ? 'Remove from favorites'
                      : 'Add to favorites'
                  }
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

      if (isSupplier) {
        return (
          <Button
            type="primary"
            onClick={() => {
              if (onOpenInlineCreate) {
                onOpenInlineCreate('purchase_order', activeEntity);
                return;
              }
              openQuickCreate('purchase_order');
            }}
          >
            + New Purchase Order
          </Button>
        );
      }

      return (
        <Button type="primary" onClick={openInlineCreateSalesOrder}>
          + New Sales Order
        </Button>
      );
    }

    if (activeRelationTab === 'invoices') {
      return (
        <Button type="primary" onClick={() => openQuickCreate('invoice')}>
          + New Invoice
        </Button>
      );
    }

    if (activeRelationTab === 'contacts') {
      return (
        <Button type="primary" onClick={() => openQuickCreate('contact')}>
          + New Contact
        </Button>
      );
    }

    if (activeRelationTab === 'inquiries') {
      return (
        <Button type="primary" onClick={() => openQuickCreate('inquiry')}>
          + New Inquiry
        </Button>
      );
    }

    if (activeRelationTab === 'more') {
      const type = String(activeEntity.type).toLowerCase();
      const isSupplier = type === 'supplier';

      const items: MenuProps['items'] = (isSupplier
        ? [
            { key: 'purchase_order', label: 'Purchase Order' },
            { key: 'contact', label: 'Contact' },
            { key: 'inquiry', label: 'Inquiry' },
          ]
        : [
            { key: 'sales_order', label: 'Sales Order' },
            { key: 'invoice', label: 'Invoice' },
            { key: 'contact', label: 'Contact' },
            { key: 'inquiry', label: 'Inquiry' },
          ]) as MenuProps['items'];

      return (
        <Dropdown
          trigger={['click']}
          menu={{
            items,
            onClick: ({ key }) => {
              if (key === 'sales_order') {
                openInlineCreateSalesOrder();
                return;
              }
              if (key === 'purchase_order' && onOpenInlineCreate) {
                onOpenInlineCreate('purchase_order', activeEntity);
                return;
              }
              openQuickCreate(String(key));
            },
          }}
        >
          <Button type="primary">+ New…</Button>
        </Dropdown>
      );
    }

    return null;
  }, [activeEntity, activeRelationTab, isPrimaryEntity, onOpenInlineCreate, openInlineCreateSalesOrder, openQuickCreate]);

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

        <NotesAndCallsDrawer
          open={isNotesDrawerOpen && Boolean(activeEntity)}
          onClose={() => setIsNotesDrawerOpen(false)}
          entityType={String(activeEntity?.type ?? '')}
          entityId={String(activeEntity?.id ?? '')}
          entityLabel={activeEntity?.name}
        />

        <ScheduleCallModal
          isOpen={showScheduleCallModal}
          onClose={() => {
            setShowScheduleCallModal(false);
            setDefaultCallPurpose(undefined);
          }}
          onSuccess={() => {
            setShowScheduleCallModal(false);
            setDefaultCallPurpose(undefined);
            if (activeEntity) {
              if (activeRelationTab !== 'more') {
                void loadRelationshipTab(activeRelationTab, activeEntity);
              }
              void loadRelationalChunks(activeEntity);
            }
          }}
          defaultCallPurpose={defaultCallPurpose}
          defaultEntityType={
            activeEntity && ['customer', 'supplier'].includes(String(activeEntity.type).toLowerCase())
              ? (String(activeEntity.type).toLowerCase() as 'customer' | 'supplier')
              : undefined
          }
          defaultEntityId={Number.isFinite(Number(activeEntity?.id)) ? Number(activeEntity?.id) : undefined}
        />

        {quickCreateConfig.isOpen && (
          <div style={{ marginTop: 12 }}>
            {String(quickCreateConfig.type).toLowerCase() === 'inquiry' ? (
              <InquiryCreateModal
                isOpen={true}
                onClose={closeQuickCreate}
                onSuccess={() => {
                  if (activeEntity) {
                    if (activeRelationTab !== 'more') {
                      void loadRelationshipTab(activeRelationTab, activeEntity);
                    }
                    void loadRelationalChunks(activeEntity);
                  }
                  closeQuickCreate();
                }}
                initialEntityType={
                  quickCreateConfig.context?.customer || quickCreateConfig.context?.customer_id
                    ? 'customer'
                    : quickCreateConfig.context?.supplier || quickCreateConfig.context?.supplier_id
                      ? 'supplier'
                      : undefined
                }
                initialEntityId={
                  quickCreateConfig.context?.customer ||
                  quickCreateConfig.context?.customer_id ||
                  quickCreateConfig.context?.supplier ||
                  quickCreateConfig.context?.supplier_id
                }
              />
            ) : (
              <EntityFormSurface
                entityType={quickCreateConfig.type}
                mode="create"
                isOpen={true}
                onClose={closeQuickCreate}
                context={{
                  customerId: quickCreateConfig.context?.customer || quickCreateConfig.context?.customer_id,
                  supplierId: quickCreateConfig.context?.supplier || quickCreateConfig.context?.supplier_id,
                  contactId: quickCreateConfig.context?.contact || quickCreateConfig.context?.contact_id,
                }}
                onSuccess={(created) => {
                  const row = (created && typeof created === 'object' ? (created as any) : {}) as any;
                  const createdId = String(row?.id ?? row?.uuid ?? row?.pk ?? '').trim();
                  const rawType = String(quickCreateConfig.type ?? '').toLowerCase();
                  const createdType =
                    rawType === 'customers'
                      ? 'customer'
                      : rawType === 'suppliers'
                        ? 'supplier'
                        : rawType === 'contacts'
                          ? 'contact'
                          : rawType === 'products'
                            ? 'product'
                            : rawType === 'invoices'
                              ? 'invoice'
                              : rawType;

                  const createdName = String(row?.name ?? row?.title ?? row?.code ?? '').trim();

                  if (createdId) {
                    message.success(`Created ${formatEntityLabel(createdType)}${createdName ? `: ${createdName}` : ''}`);
                  }

                  // Master data creates are not always a "relation" of the currently focused entity.
                  // Navigate to the created record so the user can immediately see/confirm it exists.
                  const shouldNavigateToCreated = Boolean(
                    createdId && ['customer', 'supplier', 'contact', 'product', 'invoice'].includes(createdType)
                  );

                  if (shouldNavigateToCreated) {
                    handleSelectEntity({
                      id: createdId,
                      type: createdType,
                      name: createdName || `New ${formatEntityLabel(createdType)}`,
                    });

                    if (query?.trim()) {
                      void searchEntities(query);
                    }

                    closeQuickCreate();
                    return;
                  }

                  if (activeEntity) {
                    if (activeRelationTab !== 'more') {
                      void loadRelationshipTab(activeRelationTab, activeEntity);
                    }
                    void loadRelationalChunks(activeEntity);
                  }

                  closeQuickCreate();
                }}
              />
            )}
          </div>
        )}

        {inlineAction && activeEntity && (
          <div style={{ marginTop: 12 }}>
            {String(inlineAction.entityType).toLowerCase() === 'inquiry' ? (
              <InquiryCreateModal
                isOpen={true}
                onClose={() => onInlineCancel?.()}
                onSuccess={() => {
                  if (activeEntity) {
                    if (activeRelationTab !== 'more') {
                      void loadRelationshipTab(activeRelationTab, activeEntity);
                    }
                    void loadRelationalChunks(activeEntity);
                  }
                  onInlineSuccess?.();
                }}
                initialEntityType={
                  inlineAction.contextData?.customer || inlineAction.contextData?.customer_id
                    ? 'customer'
                    : inlineAction.contextData?.supplier || inlineAction.contextData?.supplier_id
                      ? 'supplier'
                      : undefined
                }
                initialEntityId={
                  inlineAction.contextData?.customer ||
                  inlineAction.contextData?.customer_id ||
                  inlineAction.contextData?.supplier ||
                  inlineAction.contextData?.supplier_id
                }
              />
            ) : (
              <EntityFormSurface
                entityType={inlineAction.entityType}
                mode="create"
                isOpen={true}
                onClose={() => onInlineCancel?.()}
                context={{
                  customerId: inlineAction.contextData?.customer || inlineAction.contextData?.customer_id,
                  supplierId: inlineAction.contextData?.supplier || inlineAction.contextData?.supplier_id,
                  contactId: inlineAction.contextData?.contact || inlineAction.contextData?.contact_id,
                }}
                onSuccess={() => {
                  if (activeEntity) {
                    if (activeRelationTab !== 'more') {
                      void loadRelationshipTab(activeRelationTab, activeEntity);
                    }
                    void loadRelationalChunks(activeEntity);
                  }
                  onInlineSuccess?.();
                }}
              />
            )}
          </div>
        )}

        {isInlineCreateSalesOrderOpen && activeEntity && String(activeEntity.type).toLowerCase() === 'customer' && (
          <EntityFormSurface
            entityType="sales-orders"
            mode="create"
            isOpen={true}
            onClose={closeInlineSubview}
            onSuccess={() => closeInlineSubview()}
            context={{ customerId: String(activeEntity.id) }}
          />
        )}

        {activeStep ? (
          isPrimaryEntity ? (
            inlineAction ? (
              <div style={{ padding: 12 }} />
            ) : (
              <Tabs
              activeKey={activeRelationTab}
              tabBarExtraContent={
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {tabCTA}
                  <Button onClick={() => setIsNotesDrawerOpen(true)}>Log Call / Notes</Button>
                </div>
              }
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

                const typed = key as 'orders' | 'invoices' | 'contacts' | 'inquiries';
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
                          <ResultIcon $tone={getEntityTone(item.type)}>
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
                          <ResultIcon $tone={getEntityTone(item.type)}>
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
                          <ResultIcon $tone={getEntityTone(item.type)}>
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
                  key: 'inquiries',
                  label: `Inquiries${relationTabData.inquiries ? ` (${relationTabData.inquiries.count})` : ''}`,
                  children: loadingRelationTab === 'inquiries' ? (
                    <div style={{ padding: 12 }}><Spin /></div>
                  ) : relationTabData.inquiries?.items?.length ? (
                    <div>
                      <ResultGrid>
                        {relationTabData.inquiries.items.map(item => {
                          const meta = (item.metadata ?? {}) as Record<string, any>;
                          const inquiryNumber = String(meta.inquiry_number ?? item.name ?? '').trim() || 'Inquiry';
                          const productSummary = Array.isArray(meta.product_summary) ? (meta.product_summary as unknown[]) : [];
                          const productsText = productSummary
                            .slice(0, 4)
                            .map((v) => String(v))
                            .filter(Boolean)
                            .join(' • ');
                          const moreCount = Number(meta.product_more_count ?? 0);
                          const createdOn = String(meta.created_on ?? '').slice(0, 10);
                          const modifiedOn = String(meta.modified_on ?? '').slice(0, 10);

                          return (
                            <ResultCard key={item.id} onClick={() => void handleSelectEmbeddedInquiry(item.id)}>
                              <ResultIcon $tone={getEntityTone(item.type)}>
                                {getEntityIcon(item.type)}
                              </ResultIcon>
                              <ResultContent style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                <div style={{ minWidth: 0 }}>
                                  <ResultTitle>{inquiryNumber}</ResultTitle>
                                  <ResultSubtitle>
                                    {productsText ? (
                                      <span>
                                        {productsText}
                                        {moreCount > 0 ? ` +${moreCount} more` : ''}
                                      </span>
                                    ) : item.subtitle ? (
                                      item.subtitle
                                    ) : (
                                      '—'
                                    )}
                                  </ResultSubtitle>
                                </div>

                                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  <div style={{ fontSize: 12, color: 'rgb(var(--color-text-secondary))' }}>
                                    Modified: {modifiedOn || '—'}
                                  </div>
                                  <div style={{ fontSize: 12, color: 'rgb(var(--color-text-secondary))' }}>
                                    Created: {createdOn || '—'}
                                  </div>
                                </div>
                              </ResultContent>
                            </ResultCard>
                          );
                        })}
                      </ResultGrid>

                      <div style={{ marginTop: 12 }}>
                        {embeddedInquiryError ? (
                          <div style={{ padding: 10, border: '1px solid rgb(var(--color-border))', borderRadius: 'var(--radius-md)', color: 'rgb(var(--color-error))' }}>
                            {embeddedInquiryError}
                          </div>
                        ) : null}

                        {isEmbeddedInquiryLoading ? (
                          <div style={{ padding: 12 }}><Spin /></div>
                        ) : embeddedInquiry ? (
                          <InquiryEmbeddedView inquiry={embeddedInquiry} onClose={() => setEmbeddedInquiry(null)} />
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <EmptyState>
                      <EmptyIcon><FileText size={48} /></EmptyIcon>
                      <EmptyTitle>No inquiries yet</EmptyTitle>
                      <EmptyMessage>Inquiries will appear here once created</EmptyMessage>
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
          )
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
