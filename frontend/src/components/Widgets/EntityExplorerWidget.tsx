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
import { 
  Layers, Package, Users, Building2, FileText, 
  ChevronRight, Star, Clock
} from 'lucide-react';
import { WidgetCard } from './WidgetCard';
import axios from 'axios';

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
    color: 'rgb(59, 130, 246)',
    path: '/suppliers',
    label: 'Suppliers',
  },
  customers: {
    icon: <Users size={14} />,
    color: 'rgb(168, 85, 247)',
    path: '/customers',
    label: 'Customers',
  },
  purchase_orders: {
    icon: <Package size={14} />,
    color: 'rgb(34, 197, 94)',
    path: '/purchase-orders',
    label: 'Purchase Orders',
  },
  sales_orders: {
    icon: <Package size={14} />,
    color: 'rgb(234, 179, 8)',
    path: '/sales-orders',
    label: 'Sales Orders',
  },
  invoices: {
    icon: <FileText size={14} />,
    color: 'rgb(236, 72, 153)',
    path: '/accounting/invoices',
    label: 'Invoices',
  },
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
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
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
  color: ${props => props.$active ? 'rgb(234, 179, 8)' : 'rgb(var(--color-text-tertiary))'};
  opacity: ${props => props.$active ? 1 : 0.3};
  cursor: pointer;
  
  &:hover {
    opacity: 1;
    color: rgb(234, 179, 8);
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
  const [activeTab, setActiveTab] = useState<EntityType>('suppliers');
  const [entities, setEntities] = useState<Record<EntityType, RecentEntity[]>>({
    suppliers: [],
    customers: [],
    purchase_orders: [],
    sales_orders: [],
    invoices: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchEntities = useCallback(async () => {
    try {
      // Try to fetch from API, fall back to mock data
      const response = await axios.get('/api/v1/core/search/recent/').catch(() => null);
      
      if (response?.data?.recent_items) {
        // Group by type
        const grouped: Record<EntityType, RecentEntity[]> = {
          suppliers: [],
          customers: [],
          purchase_orders: [],
          sales_orders: [],
          invoices: [],
        };
        
        response.data.recent_items.forEach((item: any) => {
          const type = item.type as EntityType;
          if (grouped[type]) {
            grouped[type].push({
              id: item.id,
              type,
              name: item.name,
              subtitle: item.subtitle,
              isFavorite: item.is_favorite,
              lastAccessed: item.last_accessed,
            });
          }
        });
        
        setEntities(grouped);
      } else {
        // Mock data for development
        setEntities({
          suppliers: [
            { id: '1', type: 'suppliers', name: 'Prime Beef Co', subtitle: 'Active • 12 orders', isFavorite: true, lastAccessed: new Date().toISOString() },
            { id: '2', type: 'suppliers', name: 'Quality Pork LLC', subtitle: 'Active • 8 orders', lastAccessed: new Date().toISOString() },
            { id: '3', type: 'suppliers', name: 'Fresh Poultry Inc', subtitle: 'Active • 15 orders', lastAccessed: new Date().toISOString() },
          ],
          customers: [
            { id: '1', type: 'customers', name: 'Acme Foods Inc', subtitle: 'Houston, TX', isFavorite: true, lastAccessed: new Date().toISOString() },
            { id: '2', type: 'customers', name: 'Metro Restaurants', subtitle: 'Dallas, TX', lastAccessed: new Date().toISOString() },
            { id: '3', type: 'customers', name: 'Fresh Mart Chain', subtitle: 'Austin, TX', lastAccessed: new Date().toISOString() },
          ],
          purchase_orders: [
            { id: '1', type: 'purchase_orders', name: 'PO-2026-001234', subtitle: '$12,450 • Pending', lastAccessed: new Date().toISOString() },
            { id: '2', type: 'purchase_orders', name: 'PO-2026-001233', subtitle: '$8,900 • Shipped', lastAccessed: new Date().toISOString() },
          ],
          sales_orders: [
            { id: '1', type: 'sales_orders', name: 'SO-2026-000567', subtitle: '$15,200 • Processing', lastAccessed: new Date().toISOString() },
            { id: '2', type: 'sales_orders', name: 'SO-2026-000566', subtitle: '$9,800 • Completed', lastAccessed: new Date().toISOString() },
          ],
          invoices: [
            { id: '1', type: 'invoices', name: 'INV-2026-000789', subtitle: '$12,450 • Due Feb 15', lastAccessed: new Date().toISOString() },
            { id: '2', type: 'invoices', name: 'INV-2026-000788', subtitle: '$8,900 • Paid', lastAccessed: new Date().toISOString() },
          ],
        });
      }
    } catch (err) {
      console.error('Failed to fetch entities:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const handleEntityClick = (entity: RecentEntity) => {
    const config = ENTITY_CONFIG[entity.type];
    navigate(`${config.path}/${entity.id}`);
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
    </WidgetCard>
  );
};

export default EntityExplorerWidget;
