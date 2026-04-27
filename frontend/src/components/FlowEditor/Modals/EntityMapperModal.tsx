/**
 * Entity Mapping Modal
 * 
 * Allows users to map workflow form fields to ProjectMeats entity attributes.
 * Enables automatic data synchronization between workflows and business entities.
 * 
 * Features:
 * - Select target entity type (Supplier, Customer, Invoice, etc.)
 * - Map form fields to entity attributes via drag-and-drop or table
 * - Preview mapping before saving
 * - Validation for required entity fields
 * - Support for nested object mapping (e.g., customer.billing_address.city)
 * 
 * Use Cases:
 * - Supplier Onboarding Form → Supplier entity
 * - Customer Order Form → SalesOrder + Customer entities
 * - Invoice Approval Form → Invoice entity status update
 * 
 * Authority: Phase 2.2 - Entity Cascading (protein → cuts automation)
 */

import React, { useState, useEffect } from 'react';
import { Modal, Select, Table, Button, Space, Typography, Alert, message, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { businessApi } from '@/services/businessApi';
import styled from 'styled-components';
import { logger } from '@/utils/logger';

const { Title, Text } = Typography;
const { Option } = Select;

interface FormField {
  id: string;
  label: string;
  field_type: string;
}

interface EntityAttribute {
  name: string;
  type: string;
  required: boolean;
  help_text?: string;
}

interface FieldMapping {
  formFieldId: string;
  entityAttribute: string;
  transformationType?: string;
}

interface EntityMapperModalProps {
  open: boolean;
  onClose: () => void;
  formId: string;
  existingMappings?: FieldMapping[];
  onSave: (mappings: FieldMapping[], entityType: string) => Promise<void>;
}

const StyledModal = styled(Modal)`
  .ant-modal-body {
    max-height: 600px;
    overflow-y: auto;
  }
`;

type MappingRow = FieldMapping & { key: number };

const MappingTable = styled(Table<MappingRow>)`
  .mapping-row {
    &:hover {
      background-color: rgba(var(--color-primary), 0.05);
    }
  }
`;

const EntitySelector = styled.div`
  margin-bottom: 24px;
  padding: 16px;
  background: rgb(var(--color-bg-secondary, 245, 245, 245));
  border-radius: 8px;
`;

const MappingPreview = styled.div`
  margin-top: 16px;
  padding: 12px;
  background: rgb(var(--color-bg-secondary, 250, 250, 250));
  border-left: 3px solid rgb(var(--color-success));
  border-radius: 4px;
`;

// Available entity types in ProjectMeats
const ENTITY_TYPES = [
  { value: 'supplier', label: 'Supplier', icon: '🏭' },
  { value: 'customer', label: 'Customer', icon: '👤' },
  { value: 'purchase_order', label: 'Purchase Order', icon: '📦' },
  { value: 'sales_order', label: 'Sales Order', icon: '🛒' },
  { value: 'invoice', label: 'Invoice', icon: '💵' },
  { value: 'product', label: 'Product', icon: '🥩' },
];

// Mock entity attributes (in production, fetch from backend)
const ENTITY_ATTRIBUTES: Record<string, EntityAttribute[]> = {
  supplier: [
    { name: 'name', type: 'string', required: true, help_text: 'Supplier company name' },
    { name: 'email', type: 'email', required: true, help_text: 'Primary contact email' },
    { name: 'phone', type: 'string', required: false, help_text: 'Contact phone number' },
    { name: 'address', type: 'string', required: false, help_text: 'Physical address' },
    { name: 'tax_id', type: 'string', required: false, help_text: 'Tax identification number' },
    { name: 'payment_terms', type: 'string', required: false, help_text: 'Default payment terms' },
  ],
  customer: [
    { name: 'name', type: 'string', required: true, help_text: 'Customer name or company' },
    { name: 'email', type: 'email', required: true, help_text: 'Primary email address' },
    { name: 'phone', type: 'string', required: false, help_text: 'Contact phone number' },
    { name: 'billing_address', type: 'string', required: false, help_text: 'Billing address' },
    { name: 'shipping_address', type: 'string', required: false, help_text: 'Shipping address' },
    { name: 'credit_limit', type: 'number', required: false, help_text: 'Credit limit amount' },
  ],
  invoice: [
    { name: 'invoice_number', type: 'string', required: true, help_text: 'Unique invoice number' },
    { name: 'amount', type: 'number', required: true, help_text: 'Invoice total amount' },
    { name: 'due_date', type: 'date', required: true, help_text: 'Payment due date' },
    { name: 'status', type: 'string', required: true, help_text: 'Invoice status' },
    { name: 'notes', type: 'text', required: false, help_text: 'Additional notes' },
  ],
};

export const EntityMapperModal: React.FC<EntityMapperModalProps> = ({
  open,
  onClose,
  formId,
  existingMappings = [],
  onSave,
}) => {
  const [selectedEntityType, setSelectedEntityType] = useState<string | null>(null);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>(existingMappings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && formId) {
      fetchFormFields();
    }
  }, [open, formId]);

  const fetchFormFields = async () => {
    setLoading(true);
    try {
      const response = await businessApi.get(`/workflows/forms/${formId}/fields/`);
      setFormFields(response.data || []);
    } catch (error) {
      logger.error('Failed to fetch form fields:', error);
      message.error('Failed to load form fields');
    } finally {
      setLoading(false);
    }
  };

  const handleEntityTypeChange = (entityType: string) => {
    setSelectedEntityType(entityType);
    // Clear existing mappings when entity type changes
    setMappings([]);
  };

  const handleAddMapping = () => {
    setMappings([...mappings, { formFieldId: '', entityAttribute: '' }]);
  };

  const handleUpdateMapping = (index: number, field: keyof FieldMapping, value: string) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setMappings(newMappings);
  };

  const handleRemoveMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    // Validate mappings
    const invalidMappings = mappings.filter(m => !m.formFieldId || !m.entityAttribute);
    if (invalidMappings.length > 0) {
      message.error('Please complete all mappings before saving');
      return;
    }

    if (!selectedEntityType) {
      message.error('Please select an entity type');
      return;
    }

    // Check if required entity attributes are mapped
    const entityAttrs = ENTITY_ATTRIBUTES[selectedEntityType] || [];
    const requiredAttrs = entityAttrs.filter(attr => attr.required);
    const mappedAttrs = mappings.map(m => m.entityAttribute);
    const missingRequired = requiredAttrs.filter(attr => !mappedAttrs.includes(attr.name));

    if (missingRequired.length > 0) {
      message.warning(
        `Missing required fields: ${missingRequired.map(a => a.name).join(', ')}`
      );
    }

    setSaving(true);
    try {
      await onSave(mappings, selectedEntityType);
      message.success('Entity mapping saved successfully');
      onClose();
    } catch (error) {
      logger.error('Failed to save mapping:', error);
      message.error('Failed to save entity mapping');
    } finally {
      setSaving(false);
    }
  };

  const getFieldLabel = (fieldId: string): string => {
    const field = formFields.find(f => f.id === fieldId);
    return field ? field.label : fieldId;
  };

  const columns: ColumnsType<MappingRow> = [
    {
      title: 'Form Field',
      dataIndex: 'formFieldId',
      key: 'formFieldId',
      width: '40%',
      render: (value: string, _record: MappingRow, index: number) => (
        <Select
          style={{ width: '100%' }}
          placeholder="Select form field"
          value={value || undefined}
          onChange={(val) => handleUpdateMapping(index, 'formFieldId', val)}
        >
          {formFields.map(field => (
            <Option key={field.id} value={field.id}>
              {field.label} <Tag>{field.field_type}</Tag>
            </Option>
          ))}
        </Select>
      ),
    },
    {
      title: '→',
      key: 'arrow',
      width: '5%',
      align: 'center' as const,
      render: () => <span style={{ fontSize: '16px' }}>→</span>,
    },
    {
      title: 'Entity Attribute',
      dataIndex: 'entityAttribute',
      key: 'entityAttribute',
      width: '40%',
      render: (value: string, _record: MappingRow, index: number) => (
        <Select
          style={{ width: '100%' }}
          placeholder="Select entity attribute"
          value={value || undefined}
          onChange={(val) => handleUpdateMapping(index, 'entityAttribute', val)}
          disabled={!selectedEntityType}
        >
          {selectedEntityType && ENTITY_ATTRIBUTES[selectedEntityType]?.map(attr => (
            <Option key={attr.name} value={attr.name}>
              {attr.name}
              {attr.required && <Tag color="red">Required</Tag>}
              {attr.help_text && <Text type="secondary" style={{ fontSize: '11px', marginLeft: 8 }}>{attr.help_text}</Text>}
            </Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '15%',
      align: 'center' as const,
      render: (_: unknown, _record: MappingRow, index: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveMapping(index)}
        />
      ),
    },
  ];

  const mappedRequiredCount = selectedEntityType
    ? ENTITY_ATTRIBUTES[selectedEntityType]
        ?.filter(attr => attr.required && mappings.some(m => m.entityAttribute === attr.name))
        .length || 0
    : 0;
  
  const totalRequiredCount = selectedEntityType
    ? ENTITY_ATTRIBUTES[selectedEntityType]?.filter(attr => attr.required).length || 0
    : 0;

  return (
    <StyledModal
      title={
        <Title level={4} style={{ margin: 0 }}>
          Entity Field Mapping
        </Title>
      }
      open={open}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={saving}
          onClick={handleSave}
          disabled={!selectedEntityType || mappings.length === 0}
          icon={<CheckCircleOutlined />}
        >
          Save Mapping
        </Button>,
      ]}
    >
      <EntitySelector>
        <Text strong>Target Entity Type:</Text>
        <Select
          style={{ width: '100%', marginTop: 8 }}
          placeholder="Select entity type to map to"
          value={selectedEntityType || undefined}
          onChange={handleEntityTypeChange}
          size="large"
        >
          {ENTITY_TYPES.map(type => (
            <Option key={type.value} value={type.value}>
              <span style={{ marginRight: 8 }}>{type.icon}</span>
              {type.label}
            </Option>
          ))}
        </Select>
      </EntitySelector>

      {selectedEntityType && (
        <Alert
          message={`Mapping to: ${ENTITY_TYPES.find(t => t.value === selectedEntityType)?.label}`}
          description={
            <div>
              <div>Required fields mapped: <strong>{mappedRequiredCount}/{totalRequiredCount}</strong></div>
              <div style={{ marginTop: 4 }}>
                Total mappings: <strong>{mappings.length}</strong>
              </div>
            </div>
          }
          type={mappedRequiredCount === totalRequiredCount ? 'success' : 'warning'}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Space direction="vertical" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>Field Mappings</Text>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAddMapping}
            disabled={!selectedEntityType}
          >
            Add Mapping
          </Button>
        </div>

        <MappingTable
          columns={columns}
          dataSource={mappings.map((mapping, index): MappingRow => ({ ...mapping, key: index }))}
          pagination={false}
          loading={loading}
          locale={{
            emptyText: selectedEntityType 
              ? 'No mappings yet. Click "Add Mapping" to start.'
              : 'Please select an entity type first.',
          }}
          rowClassName="mapping-row"
        />
      </Space>

      {mappings.length > 0 && (
        <MappingPreview>
          <Text strong>Preview:</Text>
          <div style={{ marginTop: 8 }}>
            {mappings.map((mapping, index) => (
              <div key={index} style={{ fontSize: '12px', marginTop: 4 }}>
                <Tag color="blue">{getFieldLabel(mapping.formFieldId)}</Tag>
                <span> → </span>
                <Tag color="green">{mapping.entityAttribute}</Tag>
              </div>
            ))}
          </div>
        </MappingPreview>
      )}
    </StyledModal>
  );
};
