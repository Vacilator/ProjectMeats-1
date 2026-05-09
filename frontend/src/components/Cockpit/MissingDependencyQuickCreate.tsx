/**
 * Missing Dependency Quick Creator (PI-04 / master-data-quick-create)
 *
 * Inline creation flow for missing dependencies detected in AI Inbox items
 * or form nodes. Allows quick creation of Supplier, Customer, Contact, Plant
 * without leaving the current context.
 *
 * Theme Compliance: CSS custom properties only.
 */
import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { Modal, Input, Select, message } from 'antd';
import { Plus, Building2, User, MapPin, Factory } from 'lucide-react';
import { businessApi } from '../../services/businessApi';
import { getValidTenantId } from '../../utils/tenantId';

// ============================================================================
// Types
// ============================================================================

export type DependencyType = 'supplier' | 'customer' | 'contact' | 'plant';

export interface MissingDependencyQuickCreateProps {
  /** Type of entity to create */
  entityType: DependencyType;
  /** Pre-filled name (from AI parsing) */
  suggestedName?: string;
  /** Pre-filled email (for contacts) */
  suggestedEmail?: string;
  /** Parent entity ID (e.g., supplier_id for contacts) */
  parentId?: string;
  /** Parent entity type */
  parentType?: DependencyType;
  /** Called when entity is successfully created */
  onCreated?: (entityId: string, entityName: string) => void;
  /** Called when modal is closed */
  onClose: () => void;
  /** Whether the modal is open */
  open: boolean;
}

interface QuickCreateFormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  contactType: string;
  location: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const FormGrid = styled.div`
  display: grid;
  gap: 14px;
`;

const FormField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const FieldLabel = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
`;

const EntityBadge = styled.div<{ $type: DependencyType }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
  background: ${({ $type }) => {
    switch ($type) {
      case 'supplier': return 'rgba(var(--color-info), 0.1)';
      case 'customer': return 'rgba(var(--color-success), 0.1)';
      case 'contact': return 'rgba(var(--color-primary), 0.1)';
      case 'plant': return 'rgba(var(--color-warning), 0.1)';
    }
  }};
  color: ${({ $type }) => {
    switch ($type) {
      case 'supplier': return 'rgb(var(--color-info))';
      case 'customer': return 'rgb(var(--color-success))';
      case 'contact': return 'rgb(var(--color-primary))';
      case 'plant': return 'rgb(var(--color-warning))';
    }
  }};
`;

const ENTITY_ICONS: Record<DependencyType, React.FC<{ size?: number }>> = {
  supplier: Building2,
  customer: Building2,
  contact: User,
  plant: Factory,
};

const ENTITY_LABELS: Record<DependencyType, string> = {
  supplier: 'Supplier',
  customer: 'Customer',
  contact: 'Contact',
  plant: 'Plant',
};

// ============================================================================
// Component
// ============================================================================

export const MissingDependencyQuickCreate: React.FC<MissingDependencyQuickCreateProps> = ({
  entityType,
  suggestedName = '',
  suggestedEmail = '',
  parentId,
  parentType,
  onCreated,
  onClose,
  open,
}) => {
  const [formData, setFormData] = useState<QuickCreateFormData>({
    name: suggestedName,
    email: suggestedEmail,
    phone: '',
    company: suggestedName,
    contactType: 'Sales',
    location: '',
  });
  const [creating, setCreating] = useState(false);

  const Icon = ENTITY_ICONS[entityType];

  const handleCreate = useCallback(async () => {
    if (!formData.name.trim()) {
      message.warning('Name is required');
      return;
    }

    setCreating(true);
    try {
      const tenantId = getValidTenantId();
      let endpoint = '';
      let payload: Record<string, string | undefined> = {};

      switch (entityType) {
        case 'supplier':
          endpoint = `/tenants/${tenantId}/suppliers/`;
          payload = { company_name: formData.name, status: 'active' };
          break;
        case 'customer':
          endpoint = `/tenants/${tenantId}/customers/`;
          payload = { company_name: formData.name, status: 'active' };
          break;
        case 'contact':
          endpoint = `/tenants/${tenantId}/contacts/`;
          payload = {
            first_name: formData.name.split(' ')[0] || formData.name,
            last_name: formData.name.split(' ').slice(1).join(' ') || '',
            email: formData.email,
            main_phone: formData.phone,
            contact_type: formData.contactType,
            status: 'active',
            ...(parentId && parentType === 'supplier' ? { supplier: parentId } : {}),
            ...(parentId && parentType === 'customer' ? { customer: parentId } : {}),
          };
          break;
        case 'plant':
          endpoint = `/tenants/${tenantId}/plants/`;
          payload = {
            name: formData.name,
            location: formData.location,
            status: 'active',
            ...(parentId && parentType === 'supplier' ? { supplier: parentId } : {}),
          };
          break;
      }

      const res = await businessApi.post(endpoint, payload);
      const createdId = res.data?.id || res.data?.pk || '';

      message.success(`${ENTITY_LABELS[entityType]} "${formData.name}" created`);
      onCreated?.(String(createdId), formData.name);
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
        || (err as { message?: string })?.message
        || 'Creation failed';
      message.error(detail);
    } finally {
      setCreating(false);
    }
  }, [formData, entityType, parentId, parentType, onCreated, onClose]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={18} />
          Quick Create {ENTITY_LABELS[entityType]}
        </span>
      }
      okText={`Create ${ENTITY_LABELS[entityType]}`}
      onOk={handleCreate}
      confirmLoading={creating}
      destroyOnHidden
      width={440}
    >
      <FormGrid>
        <EntityBadge $type={entityType}>
          <Icon size={13} />
          {ENTITY_LABELS[entityType]}
        </EntityBadge>

        <FormField>
          <FieldLabel>
            {entityType === 'contact' ? 'Full Name' : 'Company / Name'}
          </FieldLabel>
          <Input
            value={formData.name}
            onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
            placeholder={entityType === 'contact' ? 'John Smith' : 'Acme Corp'}
          />
        </FormField>

        {(entityType === 'contact' || entityType === 'supplier') && (
          <FormField>
            <FieldLabel>Email</FieldLabel>
            <Input
              value={formData.email}
              onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
              placeholder="email@company.com"
              type="email"
            />
          </FormField>
        )}

        {entityType === 'contact' && (
          <>
            <FormField>
              <FieldLabel>Phone</FieldLabel>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+1 (555) 000-0000"
              />
            </FormField>
            <FormField>
              <FieldLabel>Contact Type</FieldLabel>
              <Select
                value={formData.contactType}
                onChange={(val) => setFormData((f) => ({ ...f, contactType: val }))}
                options={[
                  { value: 'Sales', label: 'Sales' },
                  { value: 'Accounting', label: 'Accounting' },
                  { value: 'Operations', label: 'Operations' },
                  { value: 'General', label: 'General' },
                ]}
              />
            </FormField>
          </>
        )}

        {entityType === 'plant' && (
          <FormField>
            <FieldLabel>Location</FieldLabel>
            <Input
              value={formData.location}
              onChange={(e) => setFormData((f) => ({ ...f, location: e.target.value }))}
              placeholder="City, State"
            />
          </FormField>
        )}
      </FormGrid>
    </Modal>
  );
};

export default MissingDependencyQuickCreate;
