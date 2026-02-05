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
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';
import Modal from '../Modal/Modal';
import { apiClient } from '../../services/apiService';
import { 
  Building2, Users, ShoppingCart, Receipt, Package, 
  Truck, User, FileText, Phone, Mail, MapPin, Calendar,
  ExternalLink, Loader
} from 'lucide-react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface EntityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: number | string;
}

interface EntityData {
  id: number | string;
  name?: string;
  title?: string;
  order_number?: string;
  [key: string]: any;
}

// ============================================================================
// Entity Configuration
// ============================================================================

const ENTITY_CONFIG: Record<string, {
  icon: typeof Building2;
  color: string;
  apiPath: string;
  displayName: string;
  fields: Array<{ key: string; label: string; icon?: typeof Phone; format?: (value: any) => string }>;
}> = {
  supplier: {
    icon: Building2,
    color: '#3b82f6',
    apiPath: 'suppliers/suppliers',
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
    color: '#10b981',
    apiPath: 'customers/customers',
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
    color: '#f59e0b',
    apiPath: 'purchase-orders/purchase-orders',
    displayName: 'Purchase Order',
    fields: [
      { key: 'order_number', label: 'Order Number', icon: FileText },
      { key: 'supplier_name', label: 'Supplier', icon: Building2 },
      { key: 'status', label: 'Status' },
      { key: 'order_date', label: 'Order Date', icon: Calendar, format: (val) => new Date(val).toLocaleDateString() },
      { key: 'expected_delivery', label: 'Expected Delivery', icon: Calendar, format: (val) => val ? new Date(val).toLocaleDateString() : 'TBD' },
      { key: 'total_amount', label: 'Total Amount', format: (val) => val ? `$${parseFloat(val).toFixed(2)}` : 'N/A' },
    ],
  },
  sales_order: {
    icon: Receipt,
    color: '#8b5cf6',
    apiPath: 'sales-orders/sales-orders',
    displayName: 'Sales Order',
    fields: [
      { key: 'order_number', label: 'Order Number', icon: FileText },
      { key: 'customer_name', label: 'Customer', icon: Users },
      { key: 'status', label: 'Status' },
      { key: 'order_date', label: 'Order Date', icon: Calendar, format: (val) => new Date(val).toLocaleDateString() },
      { key: 'expected_delivery', label: 'Expected Delivery', icon: Calendar, format: (val) => val ? new Date(val).toLocaleDateString() : 'TBD' },
      { key: 'total_amount', label: 'Total Amount', format: (val) => val ? `$${parseFloat(val).toFixed(2)}` : 'N/A' },
    ],
  },
  product: {
    icon: Package,
    color: '#ec4899',
    apiPath: 'products/products',
    displayName: 'Product',
    fields: [
      { key: 'sku', label: 'SKU', icon: FileText },
      { key: 'description', label: 'Description' },
      { key: 'category', label: 'Category' },
      { key: 'unit', label: 'Unit' },
      { key: 'price', label: 'Price', format: (val) => val ? `$${parseFloat(val).toFixed(2)}` : 'N/A' },
      { key: 'created_at', label: 'Created', icon: Calendar, format: (val) => new Date(val).toLocaleDateString() },
    ],
  },
  carrier: {
    icon: Truck,
    color: '#06b6d4',
    apiPath: 'carriers/carriers',
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
    color: '#6366f1',
    apiPath: 'contacts/contacts',
    displayName: 'Contact',
    fields: [
      { key: 'email', label: 'Email', icon: Mail },
      { key: 'phone', label: 'Phone', icon: Phone },
      { key: 'title', label: 'Title' },
      { key: 'company', label: 'Company', icon: Building2 },
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
}) => {
  const [entity, setEntity] = useState<EntityData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        console.error(`Failed to fetch ${entityType}:`, err);
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

  const modalFooter = (
    <FooterContainer>
      <CloseButton onClick={onClose}>Close</CloseButton>
      <ViewFullButton
        onClick={() => {
          onClose();
          // TODO: Navigate to full detail page when implemented
          console.log(`Navigate to ${entityType} detail:`, entityId);
        }}
        title="Full detail page (coming soon)"
        disabled
      >
        <ExternalLink size={16} />
        View Full Details
      </ViewFullButton>
    </FooterContainer>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={config.displayName}
      maxWidth="700px"
      footer={modalFooter}
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
        </EntityContent>
      ) : (
        <ErrorContainer>
          <ErrorText>Entity not found</ErrorText>
        </ErrorContainer>
      )}
    </Modal>
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
