/**
 * Universal Entity Detail Modal
 *
 * Quick view modal for entities accessed from universal search.
 * Displays basic entity information without navigating away from cockpit.
 *
 * Features:
 * - Dynamic entity type handling (suppliers, customers, orders, etc.)
 * - Read-only view with key fields
 * - Links to full detail page (when implemented)
 * - Theme-compliant styling
 *
 * Usage:
 * ```tsx
 * <EntityDetailModal
 *   isOpen={true}
 *   onClose={handleClose}
 *   entityType="supplier"
 *   entityId="123"
 * />
 * ```
 */
import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '@/utils/logger';

import styled from 'styled-components';
import { Modal as AntModal } from 'antd';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/apiService';
import { formatCurrency } from '../../shared/utils';
import {
  Building2, Users, ShoppingCart, Receipt, Package,
  Truck, User, FileText, Phone, Mail, MapPin, Calendar,
  ExternalLink, Loader, ChevronRight, ChevronDown, Network
} from 'lucide-react';
import { RelationMindMap } from '../Cockpit/RelationMindMap';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface EntityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: number | string;
  /** Optional callback to expand entity and show related records */
  onExpandEntity?: (entity: any) => void;
}

interface EntityData {
  id: number | string;
  name?: string;
  title?: string;
  order_number?: string;
  [key: string]: any;
}

interface RelatedEntity {
  id: number;
  name: string;
  type: string;
  metadata?: any;
}

interface Relationship {
  name: string;
  display_name: string;
  count: number;
  recent_items: RelatedEntity[];
}

// ============================================================================
// Entity Configuration
// ============================================================================

// Map entity types to list page routes
const ENTITY_ROUTES: Record<string, string> = {
  supplier: '/suppliers',
  customer: '/customers',
  contact: '/contacts',
  purchase_order: '/purchase-orders',
  sales_order: '/sales-orders',
  product: '/suppliers',
  carrier: '/carriers',
  plant: '/suppliers/plants',
  invoice: '/accounting/receivables/invoices',
};

const ENTITY_CONFIG: Record<string, {
  icon: typeof Building2;
  color: string;
  apiPath: string;
  displayName: string;
  fields: Array<{ key: string; label: string; icon?: typeof Phone; format?: (value: any) => string }>;
}> = {
  supplier: {
    icon: Building2,
    color: 'rgb(var(--color-primary))',
    apiPath: 'suppliers',
    displayName: 'Supplier',
    fields: [
      { key: 'contact_person', label: 'Contact Person', icon: User },
      { key: 'email', label: 'Email', icon: Mail },
      { key: 'phone', label: 'Phone', icon: Phone },
      { key: 'address', label: 'Address', icon: MapPin },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'created_at', label: 'Created', icon: Calendar, format: (val) => new Date(val).toLocaleDateString() },
    ],
  },
  customer: {
    icon: Users,
    color: 'rgb(var(--color-success))',
    apiPath: 'customers',
    displayName: 'Customer',
    fields: [
      { key: 'contact_person', label: 'Contact Person', icon: User },
      { key: 'email', label: 'Email', icon: Mail },
      { key: 'phone', label: 'Phone', icon: Phone },
      { key: 'address', label: 'Address', icon: MapPin },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'created_at', label: 'Created', icon: Calendar, format: (val) => new Date(val).toLocaleDateString() },
    ],
  },
  purchase_order: {
    icon: ShoppingCart,
    color: 'rgb(var(--color-warning))',
    apiPath: 'purchase-orders',
    displayName: 'Purchase Order',
    fields: [
      { key: 'order_number', label: 'Order Number', icon: FileText },
      { key: 'supplier_name', label: 'Supplier', icon: Building2 },
      { key: 'status', label: 'Status' },
      { key: 'order_date', label: 'Order Date', icon: Calendar, format: (val) => new Date(val).toLocaleDateString() },
      { key: 'expected_delivery', label: 'Expected Delivery', icon: Calendar, format: (val) => val ? new Date(val).toLocaleDateString() : 'TBD' },
      { key: 'total_amount', label: 'Total Amount', format: (val) => formatCurrency(val, 'N/A') },
    ],
  },
  sales_order: {
    icon: Receipt,
    color: 'rgb(var(--color-info))',
    apiPath: 'sales-orders',
    displayName: 'Sales Order',
    fields: [
      { key: 'order_number', label: 'Order Number', icon: FileText },
      { key: 'customer_name', label: 'Customer', icon: Users },
      { key: 'status', label: 'Status' },
      { key: 'order_date', label: 'Order Date', icon: Calendar, format: (val) => new Date(val).toLocaleDateString() },
      { key: 'expected_delivery', label: 'Expected Delivery', icon: Calendar, format: (val) => val ? new Date(val).toLocaleDateString() : 'TBD' },
      { key: 'total_amount', label: 'Total Amount', format: (val) => formatCurrency(val, 'N/A') },
    ],
  },
  product: {
    icon: Package,
    color: 'rgb(var(--color-info))',
    apiPath: 'products',
    displayName: 'Product',
    fields: [
      { key: 'sku', label: 'SKU', icon: FileText },
      { key: 'description', label: 'Description' },
      { key: 'category', label: 'Category' },
      { key: 'unit', label: 'Unit' },
      { key: 'price', label: 'Price', format: (val) => formatCurrency(val, 'N/A') },
      { key: 'created_at', label: 'Created', icon: Calendar, format: (val) => new Date(val).toLocaleDateString() },
    ],
  },
  carrier: {
    icon: Truck,
    color: 'rgb(var(--color-info))',
    apiPath: 'carriers',
    displayName: 'Carrier',
    fields: [
      { key: 'contact_person', label: 'Contact Person', icon: User },
      { key: 'email', label: 'Email', icon: Mail },
      { key: 'phone', label: 'Phone', icon: Phone },
      { key: 'address', label: 'Address', icon: MapPin },
      { key: 'created_at', label: 'Created', icon: Calendar, format: (val) => new Date(val).toLocaleDateString() },
    ],
  },
  contact: {
    icon: User,
    color: 'rgb(var(--color-info))',
    apiPath: 'contacts',
    displayName: 'Contact',
    fields: [
      { key: 'email', label: 'Email', icon: Mail },
      { key: 'phone', label: 'Phone', icon: Phone },
      { key: 'title', label: 'Title' },
      { key: 'company', label: 'Company', icon: Building2 },
      { key: 'created_at', label: 'Created', icon: Calendar, format: (val) => new Date(val).toLocaleDateString() },
    ],
  },
  plant: {
    icon: Building2,
    color: 'rgb(var(--color-warning))',
    apiPath: 'plants',
    displayName: 'Plant',
    fields: [
      { key: 'plant_est_num', label: 'Est. Number', icon: FileText },
      { key: 'city', label: 'City', icon: MapPin },
      { key: 'state', label: 'State' },
      { key: 'created_at', label: 'Created', icon: Calendar, format: (val) => new Date(val).toLocaleDateString() },
    ],
  },
  invoice: {
    icon: FileText,
    color: 'rgb(var(--color-info))',
    apiPath: 'accounting/receivables/invoices',
    displayName: 'Invoice',
    fields: [
      { key: 'invoice_number', label: 'Invoice Number', icon: FileText },
      { key: 'customer_name', label: 'Customer', icon: Users },
      { key: 'amount', label: 'Amount', format: (val) => formatCurrency(val, 'N/A') },
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Created', icon: Calendar, format: (val) => new Date(val).toLocaleDateString() },
    ],
  },
};

// ============================================================================
// Component
// ============================================================================

export const EntityDetailModal: React.FC<EntityDetailModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  onExpandEntity,
}) => {
  const [entity, setEntity] = useState<EntityData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRelations, setShowRelations] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'mindmap'>('list'); // New state for view mode
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loadingRelations, setLoadingRelations] = useState(false);
  const [expandedRelations, setExpandedRelations] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const config = ENTITY_CONFIG[entityType];

  useEffect(() => {
    if (!isOpen || !entityId || !config) return;

    const fetchEntity = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.get(`${config.apiPath}/${entityId}/`);
        setEntity(response.data);
      } catch (err: any) {
        logger.error(`Failed to fetch ${entityType}:`, err);
        setError(err.response?.data?.detail || 'Failed to load entity details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEntity();
  }, [isOpen, entityId, entityType, config]);

  if (!config) {
    return null;
  }

  const Icon = config.icon;
  const entityName = entity?.name || entity?.title || entity?.order_number || 'Unknown';
  const listRoute = ENTITY_ROUTES[entityType];

  const handleExploreRelations = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Toggle relations view
    if (showRelations) {
      setShowRelations(false);
      return;
    }

    // If already loaded, just show them
    if (relationships.length > 0) {
      setShowRelations(true);
      return;
    }

    // Fetch relationships
    setLoadingRelations(true);
    try {
      logger.debug('[EntityDetailModal] Fetching relations for:', { entityType, entityId });

      const response = await apiClient.get(
        `/entities/${entityType}/${entityId}/relationships/?counts=true`
      );

      const relationshipsData = response.data.relationships || [];

      // Fetch top 5 recent items for each relationship
      const relationshipsWithItems = await Promise.all(
        relationshipsData.map(async (rel: any) => {
          if (rel.count > 0) {
            try {
              const itemsResponse = await apiClient.get(
                `/entities/${entityType}/${entityId}/relationships/${rel.name}/?limit=5`
              );
              return {
                name: rel.name,
                display_name: rel.display_name || rel.name,
                count: rel.count,
                recent_items: itemsResponse.data.items || [],
              };
            } catch (err) {
              logger.error(`Failed to fetch ${rel.name}:`, err);
              return {
                name: rel.name,
                display_name: rel.display_name || rel.name,
                count: rel.count,
                recent_items: [],
              };
            }
          }
          return {
            name: rel.name,
            display_name: rel.display_name || rel.name,
            count: rel.count,
            recent_items: [],
          };
        })
      );

      setRelationships(relationshipsWithItems.filter(r => r.count > 0));
      setShowRelations(true);
    } catch (err: any) {
      logger.error('[EntityDetailModal] Failed to fetch relations:', err);
      setError(err.response?.data?.detail || 'Failed to load related records');
    } finally {
      setLoadingRelations(false);
    }
  }, [entityType, entityId, showRelations, relationships.length]);

  const handleViewFullDetails = () => {
    logger.debug('[EntityDetailModal] View Full Details clicked', {
      entityType,
      listRoute,
      entity,
      timestamp: new Date().toISOString()
    });

    // Navigate to list page
    if (listRoute) {
      logger.debug(`[EntityDetailModal] Navigating to: ${listRoute}`);
      onClose();
      navigate(listRoute);
    } else {
      logger.warn(`[EntityDetailModal] No route defined for entity type: ${entityType}`);
    }
  };

  const toggleRelationExpansion = useCallback((relationName: string) => {
    setExpandedRelations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(relationName)) {
        newSet.delete(relationName);
      } else {
        newSet.add(relationName);
      }
      return newSet;
    });
  }, []);

  const modalFooter = (
    <FooterContainer>
      <CloseButton onClick={onClose}>Close</CloseButton>
      <FooterButtonGroup>
        <ViewFullButton
          onClick={handleExploreRelations}
          title="Show related records (calls, orders, etc.)"
          disabled={loadingRelations || !entity}
        >
          {loadingRelations ? (
            <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            showRelations ? <ChevronDown size={16} /> : <ChevronRight size={16} />
          )}
          {showRelations ? 'Hide Relations' : 'Explore Relations'}
        </ViewFullButton>
        {showRelations && (
          <SecondaryButton
            onClick={() => setViewMode(prev => prev === 'list' ? 'mindmap' : 'list')}
            title={`Switch to ${viewMode === 'list' ? 'mind-map' : 'list'} view`}
          >
            <Network size={16} />
            {viewMode === 'list' ? 'Mind Map' : 'List View'}
          </SecondaryButton>
        )}
        {listRoute && (
          <SecondaryButton
            onClick={handleViewFullDetails}
            title={`Navigate to ${config.displayName} list page`}
          >
            <ExternalLink size={16} />
            View Full Details
          </SecondaryButton>
        )}
      </FooterButtonGroup>
    </FooterContainer>
  );

  return (
    <AntModal
      open={isOpen}
      onCancel={onClose}
      title={config.displayName}
      footer={modalFooter}
      width={700}
      destroyOnHidden
      styles={{ body: { padding: 24 } }}
    >
      {isLoading ? (
        <LoadingContainer>
          <Loader size={40} style={{ animation: 'spin 1s linear infinite' }} />
          <LoadingText>Loading {config.displayName.toLowerCase()} details...</LoadingText>
        </LoadingContainer>
      ) : error ? (
        <ErrorContainer>
          <ErrorText>{error}</ErrorText>
        </ErrorContainer>
      ) : entity ? (
        <EntityContent>
          <EntityHeader>
            <IconWrapper color={config.color}>
              <Icon size={32} />
            </IconWrapper>
            <EntityTitle>{entityName}</EntityTitle>
          </EntityHeader>

          <FieldsList>
            {config.fields.map((field) => {
              const value = entity[field.key];
              if (!value && value !== 0) return null;

              const displayValue = field.format ? field.format(value) : value;
              const FieldIcon = field.icon;

              return (
                <FieldRow key={field.key}>
                  <FieldLabel>
                    {FieldIcon && <FieldIcon size={16} />}
                    {field.label}
                  </FieldLabel>
                  <FieldValue>{displayValue}</FieldValue>
                </FieldRow>
              );
            })}
          </FieldsList>

          {entity.notes && (
            <NotesSection>
              <NotesLabel>Notes</NotesLabel>
              <NotesText>{entity.notes}</NotesText>
            </NotesSection>
          )}

          {/* Related Records Section */}
          {showRelations && (
            <RelationsSection>
              <RelationsHeader>
                Related Records
                {viewMode === 'mindmap' && (
                  <ViewModeHint>(Interactive Mind Map - Click nodes to explore)</ViewModeHint>
                )}
              </RelationsHeader>
              {loadingRelations ? (
                <LoadingContainer>
                  <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
                  <LoadingText>Loading relationships...</LoadingText>
                </LoadingContainer>
              ) : relationships.length === 0 ? (
                <EmptyState>No related records found</EmptyState>
              ) : viewMode === 'mindmap' ? (
                <RelationMindMap
                  entityType={entityType}
                  entityId={entityId}
                  entityName={entityName}
                  onEntityClick={(type, id, name) => {
                    logger.debug('[EntityDetailModal] Mind Map entity clicked:', { type, id, name });
                    if (onExpandEntity) {
                      onExpandEntity({
                        id,
                        type,
                        name,
                        subtitle: '',
                      });
                    }
                  }}
                  maxDepth={2}
                />
              ) : (
                <RelationsList>
                  {relationships.map((rel) => (
                    <RelationItem key={rel.name}>
                      <RelationHeader onClick={() => toggleRelationExpansion(rel.name)}>
                        <RelationTitle>
                          {expandedRelations.has(rel.name) ? (
                            <ChevronDown size={16} />
                          ) : (
                            <ChevronRight size={16} />
                          )}
                          {rel.display_name} ({rel.count})
                        </RelationTitle>
                      </RelationHeader>
                      {expandedRelations.has(rel.name) && (
                        <RelationItems>
                          {rel.recent_items.slice(0, 5).map((item) => (
                            <RelationItemCard
                              key={item.id}
                              onClick={() => {
                                logger.debug('[EntityDetailModal] Opening related item:', item);
                                // Could open nested modal or navigate
                                if (onExpandEntity) {
                                  onExpandEntity({
                                    id: item.id,
                                    type: item.type,
                                    name: item.name,
                                    subtitle: '',
                                    metadata: item.metadata,
                                  });
                                }
                              }}
                            >
                              <RelationItemName>{item.name}</RelationItemName>
                              {item.metadata?.created_at && (
                                <RelationItemMeta>
                                  {new Date(item.metadata.created_at).toLocaleDateString()}
                                </RelationItemMeta>
                              )}
                            </RelationItemCard>
                          ))}
                          {rel.count > 5 && (
                            <ViewAllLink>View all {rel.count} →</ViewAllLink>
                          )}
                        </RelationItems>
                      )}
                    </RelationItem>
                  ))}
                </RelationsList>
              )}
            </RelationsSection>
          )}
        </EntityContent>
      ) : (
        <ErrorContainer>
          <ErrorText>Entity not found</ErrorText>
        </ErrorContainer>
      )}
    </AntModal>
  );
};

// ============================================================================
// Styled Components
// ============================================================================

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  gap: 1rem;

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.p`
  color: rgb(var(--color-text-secondary));
  font-size: 0.875rem;
`;

const ErrorContainer = styled.div`
  padding: 2rem 1rem;
  text-align: center;
`;

const ErrorText = styled.p`
  color: rgb(var(--color-error));
  font-size: 0.875rem;
`;

const EntityContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const EntityHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const IconWrapper = styled.div<{ color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg);
  background: ${(props) => `${props.color}15`};
  color: ${(props) => props.color};
`;

const EntityTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const FieldsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const FieldRow = styled.div`
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 1rem;
  align-items: start;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }
`;

const FieldLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));

  svg {
    color: rgb(var(--color-text-tertiary));
  }
`;

const FieldValue = styled.div`
  font-size: 0.875rem;
  color: rgb(var(--color-text-primary));
  word-break: break-word;
`;

const NotesSection = styled.div`
  padding-top: 1rem;
  border-top: 1px solid rgb(var(--color-border));
`;

const NotesLabel = styled.div`
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 0.5rem;
`;

const NotesText = styled.p`
  font-size: 0.875rem;
  color: rgb(var(--color-text-primary));
  white-space: pre-wrap;
  margin: 0;
`;

const FooterContainer = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1rem;
`;

const CloseButton = styled.button`
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgb(var(--color-surface-hover));
    border-color: rgb(var(--color-border-hover));
  }
`;

const ViewFullButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-primary));
  background: rgb(var(--color-primary));
  color: white;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FooterButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const SecondaryButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgb(var(--color-surface-hover));
    border-color: rgb(var(--color-border-hover));
  }
`;

const RelationsSection = styled.div`
  border-top: 1px solid rgb(var(--color-border));
  padding-top: 1.5rem;
  margin-top: 1rem;
`;

const RelationsHeader = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 1rem 0;
`;

const ViewModeHint = styled.span`
  font-size: 0.75rem;
  font-weight: 400;
  color: rgb(var(--color-text-secondary));
  margin-left: 0.5rem;
  font-style: italic;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 2rem 1rem;
  color: rgb(var(--color-text-secondary));
  font-size: 0.875rem;
`;

const RelationsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const RelationItem = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  overflow: hidden;
`;

const RelationHeader = styled.div`
  padding: 0.75rem 1rem;
  background: rgb(var(--color-surface-secondary));
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgb(var(--color-surface-hover));
  }
`;

const RelationTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const RelationItems = styled.div`
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const RelationItemCard = styled.div`
  padding: 0.75rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  background: rgb(var(--color-surface));
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgb(var(--color-surface-hover));
    border-color: rgb(var(--color-primary));
  }
`;

const RelationItemName = styled.div`
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const RelationItemMeta = styled.div`
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary));
  margin-top: 0.25rem;
`;

const ViewAllLink = styled.div`
  padding: 0.5rem 0.75rem;
  text-align: center;
  font-size: 0.75rem;
  color: rgb(var(--color-primary));
  cursor: pointer;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.8;
  }
`;
