/**
 * SchemaEditor Component - Simplified with API Integration
 * 
 * Business-friendly spreadsheet editor for defining form fields.
 * Fetches and saves schema_config to/from Django backend.
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import FormPreview from './FormPreview';

interface FieldDefinition {
  id: string;
  label: string;
  key: string;
  type: string;
  options?: string;
  required: boolean;
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

const Input = styled.input`
  width: 100%;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: #4dabf7;
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

const SchemaEditor: React.FC<Props> = ({ blueprintId, csrfToken }) => {
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Fetch schema on mount
  useEffect(() => {
    fetchSchema();
  }, [blueprintId]);

  const fetchSchema = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `/admin/system-config/api/studio/versions/${blueprintId}/`,
        {
          headers: {
            'X-CSRFToken': csrfToken,
          },
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
      await axios.patch(
        `/admin/system-config/api/studio/versions/${blueprintId}/schema/`,
        { schema_config: fields },
        {
          headers: {
            'X-CSRFToken': csrfToken,
            'Content-Type': 'application/json',
          },
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
    setFields(updated);
  };

  const handleDeleteField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
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
        <Button variant="primary" onClick={handleSave} disabled={saving}>
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
                />
              </Td>
              <Td>
                <Input
                  value={field.key}
                  onChange={(e) => handleUpdateField(index, 'key', e.target.value)}
                  placeholder="field_key"
                />
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
                  <option value="textarea">Textarea</option>
                </Select>
              </Td>
              <Td>
                <Input
                  value={field.options || ''}
                  onChange={(e) => handleUpdateField(index, 'options', e.target.value)}
                  placeholder="option1, option2"
                  disabled={field.type !== 'select'}
                />
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
