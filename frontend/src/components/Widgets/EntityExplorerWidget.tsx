/**
 * Entity Explorer Widget
 *
 * Quick navigation to recently accessed or favorite entities.
 * Shows a mini-browser for key entity types.
 *
 * Features:
 * - Recent items by entity type
 * - Favorites/pinned items
 * - Quick preview on hover
 *
 * Theme Compliance:
 * - Uses CSS custom properties
 */
import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useCockpitNavigation } from '../../contexts/CockpitNavigationContext';
import {
  Layers, Package, Users, Building2, FileText,
  ChevronRight, Star, Clock
} from 'lucide-react';
import { WidgetCard } from './WidgetCard';
import { EntityDetailModal } from '../Shared/EntityDetailModal';
import { getRecentItems } from '@/services/searchService';
import { logger } from '@/utils/logger';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

type EntityType = 'suppliers' | 'customers' | 'purchase_orders' | 'sales_orders' | 'invoices';

interface RecentEntity {
  id: string;
  type: EntityType;
  name: string;
  subtitle?: string;
  isFavorite?: boolean;
  lastAccessed: string;
}

export interface EntityExplorerWidgetProps {
  tenantId?: string;
}

// ============================================================================
// Constants
// ============================================================================

const ENTITY_CONFIG: Record<EntityType, { icon: React.ReactNode; color: string; path: string; label: string }> = {
  suppliers: {
    icon: <Building2 size={14} />,
    color: 'rgb(var(--color-info))',
    path: '/suppliers',
    label: 'Suppliers',
  },
  customers: {
    icon: <Users size={14} />,
    color: 'rgb(var(--color-accent))',
    path: '/customers',
    label: 'Customers',
  },
  purchase_orders: {
    icon: <Package size={14} />,
    color: 'rgb(var(--color-success))',
    path: '/purchase-orders',
    label: 'Purchase Orders',
  },
  sales_orders: {
    icon: <Package size={14} />,
    color: 'rgb(var(--color-warning))',
    path: '/sales-orders',
    label: 'Sales Orders',
  },
  invoices: {
    icon: <FileText size={14} />,
    color: 'rgb(var(--color-accent-pink))',
    path: '/accounting/invoices',
    label: 'Invoices',
  },
};

const EMPTY_ENTITIES: Record<EntityType, RecentEntity[]> = {
  suppliers: [],
  customers: [],
  purchase_orders: [],
  sales_orders: [],
  invoices: [],
};

const toEntityExplorerType = (rawType: string): EntityType | null => {
  switch (rawType) {
    case 'supplier':
    case 'suppliers':
      return 'suppliers';
    case 'customer':
    case 'customers':
      return 'customers';
    case 'purchase_order':
    case 'purchase_orders':
      return 'purchase_orders';
    case 'sales_order':
    case 'sales_orders':
      return 'sales_orders';
    case 'invoice':
    case 'invoices':
      return 'invoices';
    default:
      return null;
  }
};

// ============================================================================
// Styled Components
// ============================================================================

const TabContainer = styled.div`
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgb(var(--color-background));
  border-radius: var(--radius-md);
  margin-bottom: 12px;
`;

const Tab = styled.button<{ $active: boolean; $color: string }>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: ${props => props.$active ? 'rgb(var(--color-surface))' : 'transparent'};
  color: ${props => props.$active ? props.$color : 'rgb(var(--color-text-tertiary))'};
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  ${props => props.$active && `
    box-shadow: 0 1px 3px rgba(var(--color-overlay), 0.08);
  `}

  &:hover {
    color: ${props => props.$color};
  }
`;

const EntityList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const EntityItem = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgb(var(--color-background));
  }
`;

const EntityIcon = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: ${props => props.$color}15;
  color: ${props => props.$color};
  flex-shrink: 0;
`;

const EntityContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const EntityName = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const EntitySubtitle = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FavoriteIcon = styled.div<{ $active: boolean }>`
  color: ${props => props.$active ? 'rgb(var(--color-warning))' : 'rgb(var(--color-text-tertiary))'};
  opacity: ${props => props.$active ? 1 : 0.3};
  cursor: pointer;
  
  &:hover {
    opacity: 1;
    color: rgb(var(--color-warning));
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  color: rgb(var(--color-text-tertiary));
  font-size: 13px;

  svg {
    margin-bottom: 8px;
    opacity: 0.5;
  }
`;

const ViewAllLink = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: 8px;
  margin-top: 8px;
  border: 1px dashed rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: transparent;
  color: rgb(var(--color-primary));
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgb(var(--color-primary) / 0.05);
    border-color: rgb(var(--color-primary));
  }
`;

// ============================================================================
// Component
// ============================================================================

export const EntityExplorerWidget: React.FC<EntityExplorerWidgetProps> = ({
  tenantId,
}) => {
  const navigate = useNavigate();
  const cockpitNavigation = useCockpitNavigation();
  const [activeTab, setActiveTab] = useState<EntityType>('suppliers');
  const [entities, setEntities] = useState<Record<EntityType, RecentEntity[]>>(EMPTY_ENTITIES);
  const [loading, setLoading] = useState(true);

  // Entity detail modal state
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; id: string } | null>(null);

  const handleEntityDetailClose = useCallback(() => setSelectedEntity(null), []);

  const fetchEntities = useCallback(async () => {
    try {
      const grouped = getRecentItems(20).then((items) =>
        items.reduce<Record<EntityType, RecentEntity[]>>(
          (acc, item) => {
            const type = toEntityExplorerType(item.type);
            if (!type) return acc;

            acc[type].push({
              id: item.id,
              type,
              name: item.title,
              subtitle: item.subtitle,
              isFavorite: false,
              lastAccessed: '',
            });
            return acc;
          },
          {
            suppliers: [],
            customers: [],
            purchase_orders: [],
            sales_orders: [],
            invoices: [],
          }
        )
      );

      setEntities(await grouped);
    } catch (err) {
      logger.error('Failed to fetch entities:', err);
      setEntities(EMPTY_ENTITIES);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const handleEntityClick = (entity: RecentEntity) => {
    const rawType = String(entity.type ?? '').toLowerCase();
    const canonicalType = rawType === 'customers' || rawType === 'customer'
      ? 'customer'
      : rawType === 'suppliers' || rawType === 'supplier'
      ? 'supplier'
      : null;

    // Default detail screen for Cockpit-selected customers/suppliers
    if (canonicalType) {
      cockpitNavigation.clearPath();
      cockpitNavigation.addStep({
        id: String(entity.id),
        type: canonicalType,
        label: entity.name,
        subtitle: entity.subtitle,
      });

      navigate('/cockpit/dashboard');
      return;
    }

    // Preserve existing behavior for other entity types.
    setSelectedEntity({ type: entity.type, id: entity.id });
  };

  const handleViewAll = () => {
    const config = ENTITY_CONFIG[activeTab];
    navigate(config.path);
  };

  const currentEntities = entities[activeTab];
  const config = ENTITY_CONFIG[activeTab];

  return (
    <WidgetCard
      title="Entity Explorer"
      icon={<Layers size={16} />}
      loading={loading}
      onRefresh={fetchEntities}
    >
      <TabContainer>
        {(Object.keys(ENTITY_CONFIG) as EntityType[]).slice(0, 3).map(type => (
          <Tab
            key={type}
            $active={activeTab === type}
            $color={ENTITY_CONFIG[type].color}
            onClick={() => setActiveTab(type)}
          >
            {ENTITY_CONFIG[type].icon}
          </Tab>
        ))}
      </TabContainer>

      {currentEntities.length === 0 ? (
        <EmptyState>
          <Clock size={20} />
          <span>No recent {config.label.toLowerCase()}</span>
        </EmptyState>
      ) : (
        <>
          <EntityList>
            {currentEntities.slice(0, 5).map(entity => (
              <EntityItem
                key={entity.id}
                $color={config.color}
                onClick={() => handleEntityClick(entity)}
              >
                <EntityIcon $color={config.color}>
                  {config.icon}
                </EntityIcon>
                <EntityContent>
                  <EntityName>{entity.name}</EntityName>
                  {entity.subtitle && (
                    <EntitySubtitle>{entity.subtitle}</EntitySubtitle>
                  )}
                </EntityContent>
                <FavoriteIcon
                  $active={!!entity.isFavorite}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Toggle favorite
                  }}
                >
                  <Star size={14} fill={entity.isFavorite ? 'currentColor' : 'none'} />
                </FavoriteIcon>
              </EntityItem>
            ))}
          </EntityList>

          <ViewAllLink onClick={handleViewAll}>
            View all {config.label.toLowerCase()}
            <ChevronRight size={14} />
          </ViewAllLink>
        </>
      )}

      {/* Entity Detail Modal */}
      {selectedEntity && (
        <EntityDetailModal
          isOpen={!!selectedEntity}
          onClose={handleEntityDetailClose}
          entityType={selectedEntity.type}
          entityId={selectedEntity.id}
        />
      )}
    </WidgetCard>
  );
};

export default EntityExplorerWidget;
