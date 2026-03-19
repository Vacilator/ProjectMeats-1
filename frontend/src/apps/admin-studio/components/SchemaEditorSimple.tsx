/**
 * SchemaEditor Component - Simplified with API Integration
 * 
 * Business-friendly spreadsheet editor for defining form fields.
 * Fetches and saves schema_config to/from Django backend.
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import FormPreview from './FormPreview';
import { adminClient } from '@/services/apiService';

interface FieldDefinition {
  id: string;
  label: string;
  key: string;
  type: string;
  options?: string;
  required: boolean;
  referenceEntity?: string;  // NEW: For reference fields
  lookupFilter?: string;      // NEW: For lookup fields
}

interface Props {
  blueprintId: string;
  csrfToken: string;
}

const Container = styled.div`
  padding: 2rem;
  background: #f8f9fa;
  min-height: 100vh;
`;

const Toolbar = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
`;

const Table = styled.table`
  width: 100%;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border-collapse: collapse;
`;

const Th = styled.th`
  background: #f1f3f5;
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #dee2e6;
`;

const Td = styled.td`
  padding: 12px 16px;
  border-bottom: 1px solid #e9ecef;
`;

const Input = styled.input<{ hasError?: boolean }>`
  width: 100%;
  padding: 8px;
  border: 1px solid ${props => props.hasError ? '#ef4444' : '#ced4da'};
  border-radius: 4px;
  font-size: 14px;
  background: ${props => props.hasError ? '#fef2f2' : 'white'};

  &:focus {
    outline: none;
    border-color: ${props => props.hasError ? '#ef4444' : '#4dabf7'};
    box-shadow: ${props => props.hasError ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : 'none'};
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
  background: white;

  &:focus {
    outline: none;
    border-color: #4dabf7;
  }
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;

  ${props => props.variant === 'primary' && `
    background: #4dabf7;
    color: white;
    &:hover { background: #339af0; }
  `}
  
  ${props => props.variant === 'secondary' && `
    background: #e9ecef;
    color: #495057;
    &:hover { background: #dee2e6; }
  `}
  
  ${props => props.variant === 'danger' && `
    background: #fa5252;
    color: white;
    &:hover { background: #f03e3e; }
  `}
`;

const StatusMessage = styled.div<{ type: 'success' | 'error' }>`
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-size: 14px;
  
  ${props => props.type === 'success' && `
    background: #d3f9d8;
    color: #2b8a3e;
    border: 1px solid #8ce99a;
  `}
  
  ${props => props.type === 'error' && `
    background: #ffe0e0;
    color: #c92a2a;
    border: 1px solid #ffa8a8;
  `}
`;

const TypeBadge = styled.span<{ fieldType: string }>`
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  margin-left: 8px;
  
  ${props => {
    if (props.fieldType === 'reference') return `
      background: #dbe4ff;
      color: #3b5bdb;
    `;
    if (props.fieldType === 'lookup') return `
      background: #e5dbff;
      color: #7048e8;
    `;
    return `
      background: #e9ecef;
      color: #495057;
    `;
  }}
`;

const GhostRow = styled.tr`
  background: #f8f9fa;
  cursor: pointer;
  
  &:hover {
    background: #e9ecef;
  }
  
  td {
    text-align: center;
    color: #868e96;
    font-style: italic;
    padding: 20px;
    border: 2px dashed #ced4da;
  }
`;

// Available entities for reference fields (will come from API later)
const AVAILABLE_ENTITIES = [
  { value: 'customer', label: 'Customer' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'sales_order', label: 'Sales Order' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'plant', label: 'Plant' },
  { value: 'product', label: 'Product' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'payment', label: 'Payment' },
];

// Available sources for lookup filters
const AVAILABLE_SOURCES = [
  { value: 'Step1', label: 'Step 1: Supplier Selection' },
  { value: 'Step2', label: 'Step 2: Location' },
  { value: 'Step3', label: 'Step 3: Product' },
  { value: 'CurrentTenant', label: 'User: Current Tenant' },
  { value: 'CurrentUser', label: 'User: Current User' },
];

// Query Builder Component Styles
const QueryBuilderContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
`;

const QueryBuilderInput = styled(Input)`
  flex: 1;
  min-width: 80px;
  font-family: monospace;
  font-size: 12px;
`;

const OperatorBadge = styled.span`
  padding: 4px 8px;
  background: #e9ecef;
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
  color: #495057;
  user-select: none;
`;

const QueryBuilderSelect = styled(Select)`
  flex: 1.5;
  min-width: 120px;
  font-size: 12px;
`;

// QueryBuilder Component
interface QueryBuilderProps {
  value: string;
  onChange: (newValue: string) => void;
}

const QueryBuilder: React.FC<QueryBuilderProps> = ({ value, onChange }) => {
  // Parse existing value: "target=source" -> ["target", "source"]
  const parseValue = (val: string): { target: string; source: string } => {
    if (!val || !val.includes('=')) {
      return { target: '', source: '' };
    }
    const [target, source] = val.split('=');
    return { target: target.trim(), source: source.trim() };
  };

  const parsed = parseValue(value);
  const [target, setTarget] = React.useState(parsed.target);
  const [source, setSource] = React.useState(parsed.source);

  // Update parent when either input changes
  const handleTargetChange = (newTarget: string) => {
    setTarget(newTarget);
    if (newTarget && source) {
      onChange(`${newTarget}=${source}`);
    } else if (newTarget || source) {
      onChange(`${newTarget}=${source}`);
    } else {
      onChange('');
    }
  };

  const handleSourceChange = (newSource: string) => {
    setSource(newSource);
    if (target && newSource) {
      onChange(`${target}=${newSource}`);
    } else if (target || newSource) {
      onChange(`${target}=${newSource}`);
    } else {
      onChange('');
    }
  };

  // Prevent row drag when clicking inputs
  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <QueryBuilderContainer onClick={stopPropagation}>
      <QueryBuilderInput
        value={target}
        onChange={(e) => handleTargetChange(e.target.value)}
        placeholder="target_field"
        title="Target field name (e.g., supplier_id)"
      />
      <OperatorBadge>=</OperatorBadge>
      <QueryBuilderSelect
        value={source}
        onChange={(e) => handleSourceChange(e.target.value)}
        title="Source step or context"
      >
        <option value="">-- Select Source --</option>
        {AVAILABLE_SOURCES.map(src => (
          <option key={src.value} value={src.value}>
            {src.label}
          </option>
        ))}
      </QueryBuilderSelect>
    </QueryBuilderContainer>
  );
};

const SchemaEditor: React.FC<Props> = ({ blueprintId, csrfToken }) => {
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<number, string[]>>({});

  // Fetch schema on mount
  useEffect(() => {
    fetchSchema();
  }, [blueprintId]);

  const fetchSchema = async () => {
    try {
      setLoading(true);
      const response = await adminClient.get(
        `/admin/system-config/api/studio/versions/${blueprintId}/`,
        {
          headers: csrfToken ? { 'X-CSRFToken': csrfToken } : undefined,
        }
      );
      
      const schemaConfig = response.data.schema_config || [];
      setFields(schemaConfig);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch schema:', error);
      setMessage({ text: 'Failed to load schema configuration', type: 'error' });
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await adminClient.patch(
        `/admin/system-config/api/studio/versions/${blueprintId}/`,
        { schema_config: fields },
        {
          headers: csrfToken
            ? {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json',
              }
            : undefined,
        }
      );
      
      setMessage({ text: '✅ Saved successfully!', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save schema:', error);
      setMessage({ text: '❌ Failed to save changes', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Validation functions
  const validateFields = (): { valid: boolean; errors: string[]; fieldErrors: Record<number, string[]> } => {
    const errors: string[] = [];
    const newFieldErrors: Record<number, string[]> = {};
    const keys = new Set<string>();

    fields.forEach((field, index) => {
      const fieldErrorList: string[] = [];

      // Check for empty labels
      if (!field.label || field.label.trim() === '') {
        fieldErrorList.push('Label is required');
        errors.push(`Field ${index + 1}: Label is required`);
      }

      // Check for empty keys
      if (!field.key || field.key.trim() === '') {
        fieldErrorList.push('Field key is required');
        errors.push(`Field ${index + 1}: Field key is required`);
      } else {
        // Check for duplicate keys
        if (keys.has(field.key)) {
          fieldErrorList.push(`Duplicate field key "${field.key}"`);
          errors.push(`Field ${index + 1}: Duplicate field key "${field.key}"`);
        }
        keys.add(field.key);

        // Check for invalid key format (must be alphanumeric + underscores only)
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.key)) {
          fieldErrorList.push('Invalid key format. Must start with letter or underscore.');
          errors.push(`Field ${index + 1}: Invalid key format "${field.key}". Must start with letter or underscore, contain only letters, numbers, and underscores.`);
        }
      }

      // Check for options on select/radio fields
      if ((field.type === 'select' || field.type === 'radio') && (!field.options || field.options.trim() === '')) {
        fieldErrorList.push('Options are required for this field type');
        errors.push(`Field ${index + 1}: Options are required for ${field.type} type`);
      }

      if (fieldErrorList.length > 0) {
        newFieldErrors[index] = fieldErrorList;
      }
    });

    return { valid: errors.length === 0, errors, fieldErrors: newFieldErrors };
  };

  const handleAddField = () => {
    const newField: FieldDefinition = {
      id: `field_${Date.now()}`,
      label: 'New Field',
      key: `new_field_${fields.length + 1}`,
      type: 'text',
      required: false,
    };
    setFields([...fields, newField]);
  };

  const handleUpdateField = (index: number, key: keyof FieldDefinition, value: any) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: value };
    
    // Auto-generate key from label if key is being set from a new field
    if (key === 'label' && updated[index].label === 'New Field') {
      const sanitizedKey = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      updated[index].key = sanitizedKey || `field_${Date.now()}`;
    }
    
    setFields(updated);
    
    // Clear errors for this field when user makes changes
    if (fieldErrors[index]) {
      const newErrors = { ...fieldErrors };
      delete newErrors[index];
      setFieldErrors(newErrors);
    }
  };

  const handleDeleteField = (index: number) => {
    if (confirm('Delete this field? This action cannot be undone.')) {
      setFields(fields.filter((_, i) => i !== index));
    }
  };

  const handleSaveWithValidation = async () => {
    const validation = validateFields();
    
    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      setMessage({
        type: 'error',
        text: `Validation failed: ${validation.errors.length} error(s) found. Please fix the highlighted fields.`
      });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    setFieldErrors({});
    await handleSave();
  };

  if (loading) {
    return <Container><p>Loading schema...</p></Container>;
  }

  return (
    <Container>
      {message && <StatusMessage type={message.type}>{message.text}</StatusMessage>}
      
      <Toolbar>
        <Button variant="secondary" onClick={() => setShowPreview(true)}>
          👁️ Preview Form
        </Button>
        <Button variant="secondary" onClick={handleAddField}>
          ➕ Add Field
        </Button>
        <Button variant="primary" onClick={handleSaveWithValidation} disabled={saving}>
          {saving ? '💾 Saving...' : '💾 Save Changes'}
        </Button>
        <Button variant="secondary" onClick={fetchSchema}>
          🔄 Reload
        </Button>
      </Toolbar>

      <Table>
        <thead>
          <tr>
            <Th style={{ width: '25%' }}>Field Label</Th>
            <Th style={{ width: '20%' }}>Field Key</Th>
            <Th style={{ width: '15%' }}>Type</Th>
            <Th style={{ width: '20%' }}>Options</Th>
            <Th style={{ width: '10%' }}>Required</Th>
            <Th style={{ width: '10%' }}>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => (
            <tr key={field.id}>
              <Td>
                <Input
                  value={field.label}
                  onChange={(e) => handleUpdateField(index, 'label', e.target.value)}
                  placeholder="Field Label"
                  hasError={fieldErrors[index]?.some(e => e.includes('Label'))}
                />
                {fieldErrors[index]?.filter(e => e.includes('Label')).map((err, i) => (
                  <div key={i} style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>{err}</div>
                ))}
              </Td>
              <Td>
                <Input
                  value={field.key}
                  onChange={(e) => handleUpdateField(index, 'key', e.target.value)}
                  placeholder="field_key"
                  hasError={fieldErrors[index]?.some(e => e.includes('key') || e.includes('Duplicate') || e.includes('Invalid'))}
                />
                {fieldErrors[index]?.filter(e => e.includes('key') || e.includes('Duplicate') || e.includes('Invalid')).map((err, i) => (
                  <div key={i} style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>{err}</div>
                ))}
              </Td>
              <Td>
                <Select
                  value={field.type}
                  onChange={(e) => handleUpdateField(index, 'type', e.target.value)}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="date">Date</option>
                  <option value="select">Select</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="radio">Radio</option>
                  <option value="textarea">Textarea</option>
                  <option value="reference">🔗 Reference</option>
                  <option value="lookup">🔍 Dynamic Lookup</option>
                </Select>
                {(field.type === 'reference' || field.type === 'lookup') && (
                  <TypeBadge fieldType={field.type}>
                    {field.type === 'reference' ? 'SMART' : 'DYNAMIC'}
                  </TypeBadge>
                )}
              </Td>
              <Td>
                {/* Conditional rendering based on field type */}
                {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                  <>
                    <Input
                      value={field.options || ''}
                      onChange={(e) => handleUpdateField(index, 'options', e.target.value)}
                      placeholder="option1, option2, option3"
                      hasError={fieldErrors[index]?.some(e => e.includes('Options'))}
                    />
                    {fieldErrors[index]?.filter(e => e.includes('Options')).map((err, i) => (
                      <div key={i} style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>{err}</div>
                    ))}
                  </>
                )}
                
                {field.type === 'reference' && (
                  <Select
                    value={field.referenceEntity || ''}
                    onChange={(e) => {
                      const updated = { ...field, referenceEntity: e.target.value };
                      setFields(fields.map((f, i) => i === index ? updated : f));
                    }}
                  >
                    <option value="">-- Select Entity --</option>
                    {AVAILABLE_ENTITIES.map(entity => (
                      <option key={entity.value} value={entity.value}>
                        {entity.label}
                      </option>
                    ))}
                  </Select>
                )}
                
                {field.type === 'lookup' && (
                  <QueryBuilder
                    value={field.lookupFilter || ''}
                    onChange={(newValue) => {
                      const updated = { ...field, lookupFilter: newValue };
                      setFields(fields.map((f, i) => i === index ? updated : f));
                    }}
                  />
                )}
                
                {!['select', 'radio', 'checkbox', 'reference', 'lookup'].includes(field.type) && (
                  <Input
                    value=""
                    disabled
                    placeholder="—"
                    style={{ background: '#f1f3f5', cursor: 'not-allowed' }}
                  />
                )}
              </Td>
              <Td>
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => handleUpdateField(index, 'required', e.target.checked)}
                />
              </Td>
              <Td>
                <Button variant="danger" onClick={() => handleDeleteField(index)}>
                  🗑️
                </Button>
              </Td>
            </tr>
          ))}
          <GhostRow onClick={handleAddField}>
            <td colSpan={6}>
              ➕ Click to add a new field
            </td>
          </GhostRow>
        </tbody>
      </Table>

      {/* Form Preview Modal */}
      {showPreview && (
        <FormPreview
          fields={fields}
          onClose={() => setShowPreview(false)}
        />
      )}
    </Container>
  );
};

export default SchemaEditor;
