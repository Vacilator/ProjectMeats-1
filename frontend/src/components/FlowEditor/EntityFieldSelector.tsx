/**
 * Entity Field Selector Component
 * 
 * Allows users to select an entity type and automatically fetch its fields.
 * Implements cascading field selection for the Editor Revolution (Delegation II).
 * 
 * Created: 2026-03-04 - Delegation II: Editor Revolution
 */
import React, { useState, useEffect } from 'react';
import { Select, Checkbox, Spin, Alert } from 'antd';
import styled from 'styled-components';
import { businessApi } from '@/services/businessApi';

const { Option } = Select;

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const FieldList = styled.div`
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  padding: 0.5rem;
`;

const FieldItem = styled.div`
  padding: 0.5rem;
  border-bottom: 1px solid rgb(var(--color-border) / 0.5);
  
  &:last-child {
    border-bottom: none;
  }
`;

const FieldLabel = styled.div`
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const FieldMeta = styled.div`
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary));
  margin-top: 0.25rem;
`;

// ============================================================================
// Interfaces
// ============================================================================

interface EntityFieldInfo {
  name: string;
  type: string;
  label: string;
  required: boolean;
  help_text?: string;
}

interface EntityInfo {
  id: string;
  name: string;
  field_count: number;
}

interface EntityFieldSelectorProps {
  selectedEntity?: string;
  selectedFields?: string[];
  onEntityChange: (entityId: string) => void;
  onFieldsChange: (fieldNames: string[]) => void;
}

// ============================================================================
// Component
// ============================================================================

export const EntityFieldSelector: React.FC<EntityFieldSelectorProps> = ({
  selectedEntity,
  selectedFields = [],
  onEntityChange,
  onFieldsChange,
}) => {
  const [entities, setEntities] = useState<EntityInfo[]>([]);
  const [fields, setFields] = useState<EntityFieldInfo[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available entities on mount
  useEffect(() => {
    const fetchEntities = async () => {
      setLoadingEntities(true);
      setError(null);
      
      try {
        const response = await businessApi.get('/system/entities-introspect/');
        setEntities(response.data.results || []);
      } catch (err: any) {
        console.error('[EntityFieldSelector] Failed to fetch entities:', err);
        setError('Failed to load entity list');
      } finally {
        setLoadingEntities(false);
      }
    };

    fetchEntities();
  }, []);

  // Fetch fields when entity is selected
  useEffect(() => {
    if (!selectedEntity) {
      setFields([]);
      return;
    }

    const fetchFields = async () => {
      setLoadingFields(true);
      setError(null);
      
      try {
        const response = await businessApi.get(
          `/system/entities-introspect/${selectedEntity}/fields/`
        );
        setFields(response.data.fields || []);
      } catch (err: any) {
        console.error('[EntityFieldSelector] Failed to fetch fields:', err);
        setError('Failed to load entity fields');
        setFields([]);
      } finally {
        setLoadingFields(false);
      }
    };

    fetchFields();
  }, [selectedEntity]);

  const handleEntitySelect = (entityId: string) => {
    onEntityChange(entityId);
    onFieldsChange([]); // Clear selected fields when changing entity
  };

  const handleFieldToggle = (fieldName: string, checked: boolean) => {
    const newSelectedFields = checked
      ? [...selectedFields, fieldName]
      : selectedFields.filter(f => f !== fieldName);
    
    onFieldsChange(newSelectedFields);
  };

  const handleSelectAll = () => {
    if (selectedFields.length === fields.length) {
      // Deselect all
      onFieldsChange([]);
    } else {
      // Select all
      onFieldsChange(fields.map(f => f.name));
    }
  };

  return (
    <Container>
      {/* Entity Selector */}
      <div>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
          Select Entity Type
        </label>
        <Select
          style={{ width: '100%' }}
          placeholder="Choose an entity (Customer, Product, Order...)"
          value={selectedEntity}
          onChange={handleEntitySelect}
          loading={loadingEntities}
          showSearch
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
        >
          {entities.map(entity => (
            <Option key={entity.id} value={entity.id} label={entity.name}>
              {entity.name} ({entity.field_count} fields)
            </Option>
          ))}
        </Select>
      </div>

      {/* Error Display */}
      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
        />
      )}

      {/* Field List (Cascading) */}
      {selectedEntity && (
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}>
            <label style={{ fontWeight: 500 }}>
              Select Fields ({selectedFields.length}/{fields.length})
            </label>
            <a onClick={handleSelectAll} style={{ fontSize: '0.875rem' }}>
              {selectedFields.length === fields.length ? 'Deselect All' : 'Select All'}
            </a>
          </div>
          
          {loadingFields ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Spin tip="Loading entity fields..." />
            </div>
          ) : fields.length === 0 ? (
            <Alert
              message="No fields available for this entity"
              type="info"
              showIcon
            />
          ) : (
            <FieldList>
              {fields.map(field => (
                <FieldItem key={field.name}>
                  <Checkbox
                    checked={selectedFields.includes(field.name)}
                    onChange={(e) => handleFieldToggle(field.name, e.target.checked)}
                  >
                    <FieldLabel>
                      {field.label}
                      {field.required && <span style={{ color: 'red' }}> *</span>}
                    </FieldLabel>
                    <FieldMeta>
                      {field.name} ({field.type})
                      {field.help_text && ` - ${field.help_text}`}
                    </FieldMeta>
                  </Checkbox>
                </FieldItem>
              ))}
            </FieldList>
          )}
        </div>
      )}
    </Container>
  );
};

export default EntityFieldSelector;
