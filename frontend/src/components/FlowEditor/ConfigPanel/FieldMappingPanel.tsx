/**
 * Field Mapping Panel Component
 * 
 * Visual interface for mapping form fields to database entity fields.
 * Supports auto-population from previous steps and data transformations.
 * 
 * Features:
 * - Visual field mapper with drag-and-drop connections
 * - Map form fields to entity fields (Supplier, Customer, Product, etc.)
 * - Auto-populate configuration from previous form steps
 * - Data transformation options (copy, lookup, format, calculated)
 * - Validation and type compatibility checking
 * - Mapping preview with sample data
 * 
 * Created: 2026-02-04 - Phase 5 Field/Step/Mapping Enhancements
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { 
  Link, Unlink, ArrowRight, AlertCircle, CheckCircle, 
  ChevronDown, ChevronUp, Zap
} from 'lucide-react';
import {
  Label,
  Select,
  Input,
  EmptyState,
  EmptyIcon,
  EmptyText,
  HelpText,
  PrimaryButton,
} from './shared/StyledComponents';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export type TransformationType = 'direct' | 'lookup' | 'format' | 'calculated';
export type AutoPopulateMode = 'copy' | 'lookup';

export interface FieldMapping {
  id: string;
  formFieldId: string;
  entityField: string;
  transformation: {
    type: TransformationType;
    format?: string;        // For format type: date format, currency, etc.
    formula?: string;       // For calculated type: JavaScript expression
    lookupEntity?: string;  // For lookup type: entity to lookup
  };
  autoPopulate?: {
    sourceStep: string;
    sourceField: string;
    mode: AutoPopulateMode;
  };
}

interface FieldMappingPanelProps {
  mappings: FieldMapping[];
  formFields: Array<{ id: string; label: string; type: string }>;
  targetEntity: string;
  onChange: (mappings: FieldMapping[]) => void;
  availableSteps?: Array<{ id: string; name: string; fields: Array<{ id: string; label: string; type: string }> }>;
}

// ============================================================================
// Entity Field Definitions
// ============================================================================

const ENTITY_FIELDS: Record<string, Array<{ key: string; label: string; type: string; required?: boolean }>> = {
  supplier: [
    { key: 'name', label: 'Supplier Name', type: 'text', required: true },
    { key: 'contact_person', label: 'Contact Person', type: 'text' },
    { key: 'email', label: 'Email', type: 'email', required: true },
    { key: 'phone', label: 'Phone Number', type: 'phone' },
    { key: 'address', label: 'Address', type: 'textarea' },
    { key: 'city', label: 'City', type: 'text' },
    { key: 'state', label: 'State/Province', type: 'text' },
    { key: 'postal_code', label: 'Postal Code', type: 'text' },
    { key: 'country', label: 'Country', type: 'text' },
    { key: 'website', label: 'Website', type: 'url' },
    { key: 'tax_id', label: 'Tax ID', type: 'text' },
    { key: 'payment_terms', label: 'Payment Terms', type: 'text' },
    { key: 'is_active', label: 'Active Status', type: 'checkbox' },
  ],
  customer: [
    { key: 'name', label: 'Customer Name', type: 'text', required: true },
    { key: 'contact_person', label: 'Contact Person', type: 'text' },
    { key: 'email', label: 'Email', type: 'email', required: true },
    { key: 'phone', label: 'Phone Number', type: 'phone' },
    { key: 'billing_address', label: 'Billing Address', type: 'textarea' },
    { key: 'shipping_address', label: 'Shipping Address', type: 'textarea' },
    { key: 'city', label: 'City', type: 'text' },
    { key: 'state', label: 'State/Province', type: 'text' },
    { key: 'postal_code', label: 'Postal Code', type: 'text' },
    { key: 'country', label: 'Country', type: 'text' },
    { key: 'credit_limit', label: 'Credit Limit', type: 'number' },
    { key: 'payment_terms', label: 'Payment Terms', type: 'text' },
    { key: 'is_active', label: 'Active Status', type: 'checkbox' },
  ],
  product: [
    { key: 'sku', label: 'SKU', type: 'text', required: true },
    { key: 'name', label: 'Product Name', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'category', label: 'Category', type: 'select' },
    { key: 'unit_price', label: 'Unit Price', type: 'number', required: true },
    { key: 'cost', label: 'Cost', type: 'number' },
    { key: 'unit_of_measure', label: 'Unit of Measure', type: 'select' },
    { key: 'weight', label: 'Weight', type: 'number' },
    { key: 'dimensions', label: 'Dimensions', type: 'text' },
    { key: 'barcode', label: 'Barcode', type: 'text' },
    { key: 'is_active', label: 'Active Status', type: 'checkbox' },
  ],
  warehouse: [
    { key: 'code', label: 'Warehouse Code', type: 'text', required: true },
    { key: 'name', label: 'Warehouse Name', type: 'text', required: true },
    { key: 'address', label: 'Address', type: 'textarea' },
    { key: 'city', label: 'City', type: 'text' },
    { key: 'state', label: 'State/Province', type: 'text' },
    { key: 'postal_code', label: 'Postal Code', type: 'text' },
    { key: 'country', label: 'Country', type: 'text' },
    { key: 'manager', label: 'Manager', type: 'text' },
    { key: 'phone', label: 'Phone Number', type: 'phone' },
    { key: 'capacity', label: 'Capacity', type: 'number' },
    { key: 'is_active', label: 'Active Status', type: 'checkbox' },
  ],
};

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const Header = styled.div`
  padding: 16px;
  background: rgba(var(--color-primary), 0.05);
  border: 1px solid rgba(var(--color-primary), 0.2);
  border-radius: var(--radius-md);
`;

const HeaderTitle = styled.h4`
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 8px;
`;

const HeaderDescription = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.5;
`;

const MappingGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 24px;
  align-items: start;
`;

const FieldColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ColumnHeader = styled.div`
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgb(var(--color-text-tertiary));
  margin-bottom: 8px;
  padding: 0 12px;
`;

const FieldCard = styled.div<{ $mapped?: boolean; $selected?: boolean }>`
  padding: 12px;
  background: rgb(var(--color-background));
  border: 2px solid ${props => 
    props.$selected ? 'rgb(var(--color-primary))' :
    props.$mapped ? 'rgba(34, 197, 94, 0.3)' : 
    'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }
`;

const FieldLabel = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
`;

const FieldType = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
`;

const FieldBadge = styled.div<{ $type: 'required' | 'mapped' | 'auto' }>`
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  
  ${props => {
    if (props.$type === 'required') {
      return `
        background: rgba(239, 68, 68, 0.1);
        color: rgb(239, 68, 68);
      `;
    } else if (props.$type === 'mapped') {
      return `
        background: rgba(34, 197, 94, 0.1);
        color: rgb(34, 197, 94);
      `;
    } else {
      return `
        background: rgba(59, 130, 246, 0.1);
        color: rgb(59, 130, 246);
      `;
    }
  }}
`;

const ConnectionColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-top: 40px;
`;

const ConnectionLine = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: ${props => props.$active 
    ? 'rgba(var(--color-primary), 0.1)' 
    : 'transparent'};
  border-radius: var(--radius-md);
  color: ${props => props.$active 
    ? 'rgb(var(--color-primary))' 
    : 'rgb(var(--color-text-tertiary))'};
  transition: all 0.15s ease;
`;

const MappingList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
`;

const MappingItem = styled.div`
  padding: 16px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  transition: all 0.15s ease;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }
`;

const MappingHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  cursor: pointer;
`;

const MappingTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 12px;
`;

const MappingPath = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const MappingActions = styled.div`
  display: flex;
  gap: 8px;
`;

const IconButton = styled.button`
  padding: 6px;
  background: none;
  border: none;
  color: rgb(var(--color-text-tertiary));
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
  
  &:hover {
    background: rgb(var(--color-border));
    color: rgb(var(--color-text-primary));
  }
`;

const MappingConfig = styled.div<{ $collapsed?: boolean }>`
  display: ${props => props.$collapsed ? 'none' : 'grid'};
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid rgb(var(--color-border));
`;

const ConfigGroup = styled.div``;







const ValidationAlert = styled.div<{ $type: 'error' | 'warning' | 'success' }>`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius-md);
  font-size: 12px;
  line-height: 1.5;
  
  ${props => {
    if (props.$type === 'error') {
      return `
        background: rgba(239, 68, 68, 0.1);
        color: rgb(239, 68, 68);
      `;
    } else if (props.$type === 'warning') {
      return `
        background: rgba(234, 179, 8, 0.1);
        color: rgb(234, 179, 8);
      `;
    } else {
      return `
        background: rgba(34, 197, 94, 0.1);
        color: rgb(34, 197, 94);
      `;
    }
  }}
`;







// ============================================================================
// Component
// ============================================================================

export const FieldMappingPanel: React.FC<FieldMappingPanelProps> = ({
  mappings,
  formFields,
  targetEntity,
  onChange,
  availableSteps = [],
}) => {
  const [localMappings, setLocalMappings] = useState<FieldMapping[]>(mappings);
  const [selectedFormField, setSelectedFormField] = useState<string | null>(null);
  const [selectedEntityField, setSelectedEntityField] = useState<string | null>(null);
  const [expandedMappings, setExpandedMappings] = useState<Set<string>>(new Set());

  const entityFields = ENTITY_FIELDS[targetEntity] || [];

  useEffect(() => {
    setLocalMappings(mappings);
  }, [mappings]);

  useEffect(() => {
    onChange(localMappings);
  }, [localMappings, onChange]);

  const handleCreateMapping = () => {
    if (!selectedFormField || !selectedEntityField) return;

    const newMapping: FieldMapping = {
      id: `mapping-${Date.now()}`,
      formFieldId: selectedFormField,
      entityField: selectedEntityField,
      transformation: {
        type: 'direct',
      },
    };

    setLocalMappings([...localMappings, newMapping]);
    setSelectedFormField(null);
    setSelectedEntityField(null);
  };

  const handleDeleteMapping = (mappingId: string) => {
    setLocalMappings(localMappings.filter(m => m.id !== mappingId));
  };

  const handleUpdateMapping = (mappingId: string, updates: Partial<FieldMapping>) => {
    setLocalMappings(localMappings.map(m => 
      m.id === mappingId ? { ...m, ...updates } : m
    ));
  };

  const toggleMappingExpanded = (mappingId: string) => {
    const newExpanded = new Set(expandedMappings);
    if (newExpanded.has(mappingId)) {
      newExpanded.delete(mappingId);
    } else {
      newExpanded.add(mappingId);
    }
    setExpandedMappings(newExpanded);
  };

  const getMappedFormFields = () => {
    return new Set(localMappings.map(m => m.formFieldId));
  };

  const getMappedEntityFields = () => {
    return new Set(localMappings.map(m => m.entityField));
  };

  const getFormFieldLabel = (fieldId: string) => {
    return formFields.find(f => f.id === fieldId)?.label || fieldId;
  };

  const getEntityFieldLabel = (fieldKey: string) => {
    return entityFields.find(f => f.key === fieldKey)?.label || fieldKey;
  };

  const validateMapping = (mapping: FieldMapping) => {
    const formField = formFields.find(f => f.id === mapping.formFieldId);
    const entityField = entityFields.find(f => f.key === mapping.entityField);

    if (!formField || !entityField) return { valid: false, message: 'Invalid field reference' };

    // Check type compatibility
    const typeCompatible = formField.type === entityField.type || 
                          (formField.type === 'text' && entityField.type === 'textarea') ||
                          (formField.type === 'textarea' && entityField.type === 'text');

    if (!typeCompatible && mapping.transformation.type === 'direct') {
      return { 
        valid: false, 
        message: `Type mismatch: ${formField.type} → ${entityField.type}. Consider using a transformation.` 
      };
    }

    return { valid: true, message: 'Mapping is valid' };
  };

  // Phase C.4: Auto-suggest field mappings based on name similarity
  const calculateStringSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().replace(/[_\s-]/g, '');
    const s2 = str2.toLowerCase().replace(/[_\s-]/g, '');

    // Exact match
    if (s1 === s2) return 1.0;

    // One contains the other
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;

    // Levenshtein distance (simple implementation)
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    const longerLength = longer.length;

    if (longerLength === 0) return 1.0;

    // Calculate edit distance
    const costs: number[] = [];
    for (let i = 0; i <= shorter.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= longer.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (shorter.charAt(i - 1) !== longer.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[longer.length] = lastValue;
    }

    return (longerLength - costs[longer.length]) / longerLength;
  };

  const autoSuggestMappings = () => {
    const suggestions: FieldMapping[] = [];
    const unmappedFormFields = formFields.filter(ff => !mappedFormFields.has(ff.id));
    const unmappedEntityFields = entityFields.filter(ef => !mappedEntityFields.has(ef.key));

    unmappedFormFields.forEach(formField => {
      let bestMatch: { field: typeof unmappedEntityFields[0]; score: number } | null = null;

      unmappedEntityFields.forEach(entityField => {
        // Calculate similarity score
        const nameSimilarity = calculateStringSimilarity(formField.label, entityField.label);
        const typeSimilarity = formField.type === entityField.type ? 1.0 : 
                               (formField.type === 'text' && entityField.type === 'textarea') ? 0.8 :
                               (formField.type === 'textarea' && entityField.type === 'text') ? 0.8 : 0;

        // Combined score (70% name, 30% type)
        const score = (nameSimilarity * 0.7) + (typeSimilarity * 0.3);

        // Only consider if score > 0.5
        if (score > 0.5 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { field: entityField, score };
        }
      });

      if (bestMatch && bestMatch.score >= 0.6) {
        suggestions.push({
          id: `mapping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          formFieldId: formField.id,
          entityField: bestMatch.field.key,
          transformation: {
            type: 'direct',
          },
        });
      }
    });

    if (suggestions.length > 0) {
      setLocalMappings([...localMappings, ...suggestions]);
    }

    return suggestions.length;
  };

  const mappedFormFields = getMappedFormFields();
  const mappedEntityFields = getMappedEntityFields();
  const unmappedRequired = entityFields.filter(f => f.required && !mappedEntityFields.has(f.key));

  return (
    <Container>
      <Header>
        <HeaderTitle>
          <Link size={16} />
          Field Mapping: {targetEntity.charAt(0).toUpperCase() + targetEntity.slice(1)}
        </HeaderTitle>
        <HeaderDescription>
          Map form fields to {targetEntity} entity fields. This determines how form data is saved to the database.
        </HeaderDescription>
      </Header>

      {/* Phase C.4: Auto-Suggest Button */}
      {formFields.length > 0 && entityFields.length > 0 && localMappings.length < formFields.length && (
        <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <PrimaryButton 
            onClick={() => {
              const count = autoSuggestMappings();
              if (count === 0) {
                alert('No good matches found. Try mapping fields manually.');
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Zap size={16} />
            Auto-Suggest Mappings
          </PrimaryButton>
          <HelpText style={{ margin: 0 }}>
            Automatically map fields based on name similarity (60%+ confidence)
          </HelpText>
        </div>
      )}

      {/* Validation Alerts */}
      {unmappedRequired.length > 0 && (
        <ValidationAlert $type="warning">
          <AlertCircle size={16} />
          <div>
            <strong>Required fields not mapped:</strong>{' '}
            {unmappedRequired.map(f => f.label).join(', ')}
          </div>
        </ValidationAlert>
      )}

      {localMappings.length === 0 && (
        <EmptyState>
          <strong>No field mappings defined yet.</strong><br />
          Click on a form field (left) and an entity field (right) to create a mapping.
          <br /><br />
          Or click "Auto-Suggest Mappings" above to automatically map similar fields.
        </EmptyState>
      )}

      {/* Visual Field Mapper */}
      <MappingGrid>
        {/* Form Fields Column */}
        <FieldColumn>
          <ColumnHeader>Form Fields ({formFields.length})</ColumnHeader>
          {formFields.map(field => (
            <FieldCard
              key={field.id}
              $mapped={mappedFormFields.has(field.id)}
              $selected={selectedFormField === field.id}
              onClick={() => {
                setSelectedFormField(field.id === selectedFormField ? null : field.id);
                if (selectedEntityField && field.id !== selectedFormField) {
                  handleCreateMapping();
                }
              }}
            >
              <FieldLabel>{field.label}</FieldLabel>
              <FieldType>{field.type}</FieldType>
              {mappedFormFields.has(field.id) && (
                <FieldBadge $type="mapped">Mapped</FieldBadge>
              )}
            </FieldCard>
          ))}
        </FieldColumn>

        {/* Connection Column */}
        <ConnectionColumn>
          {formFields.map((_, index) => (
            <ConnectionLine key={index} $active={false}>
              <ArrowRight size={16} />
            </ConnectionLine>
          ))}
        </ConnectionColumn>

        {/* Entity Fields Column */}
        <FieldColumn>
          <ColumnHeader>
            {targetEntity.charAt(0).toUpperCase() + targetEntity.slice(1)} Fields ({entityFields.length})
          </ColumnHeader>
          {entityFields.map(field => (
            <FieldCard
              key={field.key}
              $mapped={mappedEntityFields.has(field.key)}
              $selected={selectedEntityField === field.key}
              onClick={() => {
                setSelectedEntityField(field.key === selectedEntityField ? null : field.key);
                if (selectedFormField && field.key !== selectedEntityField) {
                  handleCreateMapping();
                }
              }}
            >
              <FieldLabel>{field.label}</FieldLabel>
              <FieldType>{field.type}</FieldType>
              {field.required && !mappedEntityFields.has(field.key) && (
                <FieldBadge $type="required">Required</FieldBadge>
              )}
              {mappedEntityFields.has(field.key) && (
                <FieldBadge $type="mapped">Mapped</FieldBadge>
              )}
            </FieldCard>
          ))}
        </FieldColumn>
      </MappingGrid>

      {/* Mapping Configuration List */}
      {localMappings.length > 0 && (
        <MappingList>
          <ColumnHeader>Active Mappings ({localMappings.length})</ColumnHeader>
          {localMappings.map(mapping => {
            const validation = validateMapping(mapping);
            const isExpanded = expandedMappings.has(mapping.id);

            return (
              <MappingItem key={mapping.id}>
                <MappingHeader onClick={() => toggleMappingExpanded(mapping.id)}>
                  <MappingTitle>
                    <MappingPath>
                      <span>{getFormFieldLabel(mapping.formFieldId)}</span>
                      <ArrowRight size={14} />
                      <span>{getEntityFieldLabel(mapping.entityField)}</span>
                    </MappingPath>
                    {!validation.valid && <AlertCircle size={14} color="rgb(239, 68, 68)" />}
                    {validation.valid && <CheckCircle size={14} color="rgb(34, 197, 94)" />}
                  </MappingTitle>
                  <MappingActions>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    <IconButton onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMapping(mapping.id);
                    }}>
                      <Unlink size={16} />
                    </IconButton>
                  </MappingActions>
                </MappingHeader>

                <MappingConfig $collapsed={!isExpanded}>
                  <ConfigGroup>
                    <Label>Transformation</Label>
                    <Select
                      value={mapping.transformation.type}
                      onChange={(e) => handleUpdateMapping(mapping.id, {
                        transformation: {
                          ...mapping.transformation,
                          type: e.target.value as TransformationType,
                        }
                      })}
                    >
                      <option value="direct">Direct Copy</option>
                      <option value="lookup">Lookup Reference</option>
                      <option value="format">Format Conversion</option>
                      <option value="calculated">Calculated Value</option>
                    </Select>
                    <HelpText>
                      {mapping.transformation.type === 'direct' && 'Copy value as-is'}
                      {mapping.transformation.type === 'lookup' && 'Resolve foreign key reference'}
                      {mapping.transformation.type === 'format' && 'Convert format (date, currency, etc.)'}
                      {mapping.transformation.type === 'calculated' && 'Calculate from formula'}
                    </HelpText>
                  </ConfigGroup>

                  {mapping.transformation.type === 'format' && (
                    <ConfigGroup>
                      <Label>Format String</Label>
                      <Input
                        type="text"
                        value={mapping.transformation.format || ''}
                        onChange={(e) => handleUpdateMapping(mapping.id, {
                          transformation: {
                            ...mapping.transformation,
                            format: e.target.value,
                          }
                        })}
                        placeholder="e.g., YYYY-MM-DD"
                      />
                      <HelpText>Format pattern for conversion</HelpText>
                    </ConfigGroup>
                  )}

                  {mapping.transformation.type === 'calculated' && (
                    <ConfigGroup style={{ gridColumn: '1 / -1' }}>
                      <Label>Formula</Label>
                      <Input
                        type="text"
                        value={mapping.transformation.formula || ''}
                        onChange={(e) => handleUpdateMapping(mapping.id, {
                          transformation: {
                            ...mapping.transformation,
                            formula: e.target.value,
                          }
                        })}
                        placeholder="e.g., field1 * field2"
                      />
                      <HelpText>JavaScript expression to calculate value</HelpText>
                    </ConfigGroup>
                  )}

                  {availableSteps.length > 0 && (
                    <>
                      <ConfigGroup>
                        <Label>
                          <Zap size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          Auto-Populate From
                        </Label>
                        <Select
                          value={mapping.autoPopulate?.sourceStep || ''}
                          onChange={(e) => handleUpdateMapping(mapping.id, {
                            autoPopulate: e.target.value ? {
                              sourceStep: e.target.value,
                              sourceField: '',
                              mode: 'copy',
                            } : undefined
                          })}
                        >
                          <option value="">None</option>
                          {availableSteps.map(step => (
                            <option key={step.id} value={step.id}>
                              {step.name}
                            </option>
                          ))}
                        </Select>
                        <HelpText>Pre-fill from previous step</HelpText>
                      </ConfigGroup>

                      {mapping.autoPopulate?.sourceStep && (
                        <ConfigGroup>
                          <Label>Source Field</Label>
                          <Select
                            value={mapping.autoPopulate?.sourceField || ''}
                            onChange={(e) => handleUpdateMapping(mapping.id, {
                              autoPopulate: {
                                ...mapping.autoPopulate!,
                                sourceField: e.target.value,
                              }
                            })}
                          >
                            <option value="">Select field...</option>
                            {availableSteps
                              .find(s => s.id === mapping.autoPopulate?.sourceStep)
                              ?.fields.map(field => (
                                <option key={field.id} value={field.id}>
                                  {field.label}
                                </option>
                              ))}
                          </Select>
                        </ConfigGroup>
                      )}
                    </>
                  )}
                </MappingConfig>

                {!validation.valid && !isExpanded && (
                  <ValidationAlert $type="error" style={{ marginTop: '12px' }}>
                    <AlertCircle size={14} />
                    <span>{validation.message}</span>
                  </ValidationAlert>
                )}
              </MappingItem>
            );
          })}
        </MappingList>
      )}

      {localMappings.length > 0 && localMappings.every(m => validateMapping(m).valid) && (
        <ValidationAlert $type="success">
          <CheckCircle size={16} />
          <span>
            All mappings are valid. Form data will be saved correctly to {targetEntity} entity.
          </span>
        </ValidationAlert>
      )}
    </Container>
  );
};

export default FieldMappingPanel;
