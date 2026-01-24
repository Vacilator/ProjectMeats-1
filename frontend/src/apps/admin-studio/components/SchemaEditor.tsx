/**
 * SchemaEditor Component
 * 
 * Spreadsheet-style editor for defining Blueprint field schemas.
 * Uses @tanstack/react-table for the table and @dnd-kit for row reordering.
 */
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Input } from './Input';

// Field definition type
export interface FieldDefinition {
  id: string;
  label: string;
  key: string;
  type: 'text' | 'number' | 'date' | 'select' | 'email' | 'phone' | 'url' | 'textarea' | 'checkbox' | 'radio' | 'file' | 'datetime' | 'reference';
  options?: string[];
  referenceEntity?: string;
  required: boolean;
  unique?: boolean;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: string;
}

const Container = styled.div`
  width: 100%;
  height: 100vh;
  padding: 2rem;
  background-color: rgb(var(--color-background));
  overflow: auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const Title = styled.h1`
  font-size: 1.875rem;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  background-color: rgb(var(--color-surface));
  border-radius: var(--radius-lg);
  overflow: hidden;
`;

const TableHead = styled.thead`
  background-color: rgb(var(--color-surface-hover));
  border-bottom: 2px solid rgb(var(--color-border));
`;

const TableHeadCell = styled.th`
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  border-bottom: 1px solid rgb(var(--color-border));
`;

const TableBody = styled.tbody``;

const TableRow = styled.tr<{ isDragging?: boolean }>`
  border-bottom: 1px solid rgb(var(--color-border-light));
  transition: background-color 0.2s;
  cursor: ${props => props.isDragging ? 'grabbing' : 'grab'};
  opacity: ${props => props.isDragging ? 0.5 : 1};

  &:hover {
    background-color: rgb(var(--color-surface-hover));
  }

  &:last-child {
    border-bottom: none;
  }
`;

const TableCell = styled.td`
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: rgb(var(--color-text-primary));
`;

const DragHandle = styled.div`
  cursor: grab;
  color: rgb(var(--color-text-secondary));
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:active {
    cursor: grabbing;
  }
`;

const ActionButton = styled.button<{ variant?: 'danger' | 'default' }>`
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  color: ${props => props.variant === 'danger' ? 'rgb(var(--color-danger))' : 'rgb(var(--color-text-secondary))'};
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background-color 0.2s;
  margin-right: 0.25rem;

  &:hover {
    background-color: ${props => props.variant === 'danger' ? 'rgba(var(--color-danger), 0.1)' : 'rgba(var(--color-primary), 0.1)'};
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const ActionsCell = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const TypeBadge = styled.span<{ fieldType: string }>`
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background-color: ${props => {
    const colors: Record<string, string> = {
      text: 'rgba(59, 130, 246, 0.1)',
      number: 'rgba(34, 197, 94, 0.1)',
      date: 'rgba(249, 115, 22, 0.1)',
      datetime: 'rgba(249, 115, 22, 0.1)',
      select: 'rgba(168, 85, 247, 0.1)',
      reference: 'rgba(236, 72, 153, 0.1)',
      email: 'rgba(14, 165, 233, 0.1)',
      phone: 'rgba(14, 165, 233, 0.1)',
      url: 'rgba(14, 165, 233, 0.1)',
      textarea: 'rgba(100, 116, 139, 0.1)',
      checkbox: 'rgba(34, 197, 94, 0.1)',
      radio: 'rgba(168, 85, 247, 0.1)',
      file: 'rgba(234, 179, 8, 0.1)',
    };
    return colors[props.fieldType] || 'rgba(100, 116, 139, 0.1)';
  }};
  color: ${props => {
    const colors: Record<string, string> = {
      text: 'rgb(59, 130, 246)',
      number: 'rgb(34, 197, 94)',
      date: 'rgb(249, 115, 22)',
      datetime: 'rgb(249, 115, 22)',
      select: 'rgb(168, 85, 247)',
      reference: 'rgb(236, 72, 153)',
      email: 'rgb(14, 165, 233)',
      phone: 'rgb(14, 165, 233)',
      url: 'rgb(14, 165, 233)',
      textarea: 'rgb(100, 116, 139)',
      checkbox: 'rgb(34, 197, 94)',
      radio: 'rgb(168, 85, 247)',
      file: 'rgb(234, 179, 8)',
    };
    return colors[props.fieldType] || 'rgb(100, 116, 139)';
  }};
`;

const ValidationSection = styled.div`
  margin-top: 0.5rem;
  padding: 0.75rem;
  background-color: rgba(var(--color-info), 0.05);
  border: 1px solid rgba(var(--color-info), 0.2);
  border-radius: var(--radius-md);
`;

const ValidationRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const ValidationLabel = styled.label`
  flex: 0 0 80px;
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary));
`;

const ValidationInput = styled(Input)`
  flex: 1;
  font-size: 0.75rem;
`;

const GhostRow = styled.tr`
  background-color: rgba(var(--color-primary), 0.05);
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(var(--color-primary), 0.1);
  }
`;

// Sortable row component
const SortableRow: React.FC<{
  row: any;
  onUpdate: (id: string, field: string, value: any) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
  availableEntities: Array<{ id: string; name: string }>;
  expandedValidation: Record<string, boolean>;
  setExpandedValidation: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}> = ({ row, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast, availableEntities, expandedValidation, setExpandedValidation }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.original.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow ref={setNodeRef} style={style} isDragging={isDragging}>
      <TableCell>
        <DragHandle {...attributes} {...listeners}>
          ⋮⋮
        </DragHandle>
      </TableCell>
      {row.getVisibleCells().map((cell: any) => {
        const columnId = cell.column.id;
        const value = cell.getValue();

        return (
          <TableCell key={cell.id}>
            {columnId === 'label' && (
              <Input
                value={value || ''}
                onChange={(e) => onUpdate(row.original.id, 'label', e.target.value)}
                onBlur={() => {
                  // Auto-generate key from label
                  if (value) {
                    const key = value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                    onUpdate(row.original.id, 'key', key);
                  }
                }}
                placeholder="Field Label"
              />
            )}
            {columnId === 'key' && (
              <Input
                value={value || ''}
                readOnly
                disabled
                placeholder="auto_generated"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
              />
            )}
            {columnId === 'type' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TypeBadge fieldType={value || 'text'}>
                  {value || 'text'}
                </TypeBadge>
                <Select
                  value={value || 'text'}
                  onChange={(newValue) => onUpdate(row.original.id, 'type', newValue)}
                  options={[
                    { value: 'text', label: 'Text' },
                    { value: 'number', label: 'Number' },
                    { value: 'date', label: 'Date' },
                    { value: 'datetime', label: 'Date/Time' },
                    { value: 'select', label: 'Select' },
                    { value: 'reference', label: 'Reference' },
                    { value: 'email', label: 'Email' },
                    { value: 'phone', label: 'Phone' },
                    { value: 'url', label: 'URL' },
                    { value: 'textarea', label: 'Text Area' },
                    { value: 'checkbox', label: 'Checkbox' },
                    { value: 'radio', label: 'Radio' },
                    { value: 'file', label: 'File' },
                  ]}
                />
              </div>
            )}
            {columnId === 'options' && (
              <>
                {row.original.type === 'reference' ? (
                  <Select
                    value={row.original.referenceEntity || ''}
                    onChange={(newValue) => onUpdate(row.original.id, 'referenceEntity', newValue)}
                    options={[
                      { value: '', label: 'Select entity...' },
                      ...availableEntities.map(entity => ({
                        value: entity.id,
                        label: entity.name
                      }))
                    ]}
                  />
                ) : (
                  <Input
                    value={Array.isArray(value) ? value.join(', ') : ''}
                    onChange={(e) => {
                      const options = e.target.value.split(',').map(o => o.trim()).filter(Boolean);
                      onUpdate(row.original.id, 'options', options);
                    }}
                    placeholder="Option 1, Option 2, ..."
                    disabled={row.original.type !== 'select' && row.original.type !== 'radio'}
                  />
                )}
              </>
            )}
            {columnId === 'required' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={value || false}
                    onChange={(e) => onUpdate(row.original.id, 'required', e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.75rem' }}>Required</span>
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedValidation(prev => ({
                        ...prev,
                        [row.original.id]: !prev[row.original.id]
                      }));
                    }}
                    style={{
                      marginLeft: 'auto',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.7rem',
                      background: 'none',
                      border: '1px solid rgb(var(--color-border))',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer'
                    }}
                  >
                    {expandedValidation[row.original.id] ? '▼ Hide' : '▶ More'}
                  </button>
                </div>
                
                {expandedValidation[row.original.id] && (
                  <ValidationSection>
                    <ValidationRow>
                      <input
                        type="checkbox"
                        checked={row.original.unique || false}
                        onChange={(e) => onUpdate(row.original.id, 'unique', e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.75rem' }}>Unique</span>
                    </ValidationRow>
                    
                    {(row.original.type === 'text' || row.original.type === 'textarea') && (
                      <>
                        <ValidationRow>
                          <ValidationLabel>Min Length:</ValidationLabel>
                          <ValidationInput
                            type="number"
                            value={row.original.minLength || ''}
                            onChange={(e) => onUpdate(row.original.id, 'minLength', e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="No min"
                          />
                        </ValidationRow>
                        <ValidationRow>
                          <ValidationLabel>Max Length:</ValidationLabel>
                          <ValidationInput
                            type="number"
                            value={row.original.maxLength || ''}
                            onChange={(e) => onUpdate(row.original.id, 'maxLength', e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="No max"
                          />
                        </ValidationRow>
                        <ValidationRow>
                          <ValidationLabel>Pattern:</ValidationLabel>
                          <ValidationInput
                            type="text"
                            value={row.original.pattern || ''}
                            onChange={(e) => onUpdate(row.original.id, 'pattern', e.target.value)}
                            placeholder="Regex pattern"
                          />
                        </ValidationRow>
                      </>
                    )}
                    
                    {row.original.type === 'number' && (
                      <>
                        <ValidationRow>
                          <ValidationLabel>Min Value:</ValidationLabel>
                          <ValidationInput
                            type="number"
                            value={row.original.minValue || ''}
                            onChange={(e) => onUpdate(row.original.id, 'minValue', e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="No min"
                          />
                        </ValidationRow>
                        <ValidationRow>
                          <ValidationLabel>Max Value:</ValidationLabel>
                          <ValidationInput
                            type="number"
                            value={row.original.maxValue || ''}
                            onChange={(e) => onUpdate(row.original.id, 'maxValue', e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="No max"
                          />
                        </ValidationRow>
                      </>
                    )}
                  </ValidationSection>
                )}
              </div>
            )}
            {columnId === 'actions' && (
              <ActionsCell>
                <ActionButton 
                  onClick={() => onMoveUp(row.original.id)}
                  disabled={isFirst}
                  title="Move Up"
                >
                  ↑
                </ActionButton>
                <ActionButton 
                  onClick={() => onMoveDown(row.original.id)}
                  disabled={isLast}
                  title="Move Down"
                >
                  ↓
                </ActionButton>
                <ActionButton 
                  variant="danger"
                  onClick={() => {
                    if (window.confirm(`Delete field "${row.original.label}"? This cannot be undone.`)) {
                      onDelete(row.original.id);
                    }
                  }}
                  title="Delete"
                >
                  Delete
                </ActionButton>
              </ActionsCell>
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
};

const SchemaEditor: React.FC = () => {
  const { blueprintId } = useParams<{ blueprintId: string }>();
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [availableEntities, setAvailableEntities] = useState<Array<{ id: string; name: string }>>([]);
  const [expandedValidation, setExpandedValidation] = useState<Record<string, boolean>>({});

  // Mock initial data - in production, fetch from API
  useEffect(() => {
    // Simulated API fetch for entities
    setAvailableEntities([
      { id: 'customer', name: 'Customer' },
      { id: 'supplier', name: 'Supplier' },
      { id: 'plant', name: 'Plant' },
      { id: 'product', name: 'Product' },
      { id: 'order', name: 'Order' },
    ]);

    // Simulated API fetch for fields
    setFields([
      {
        id: '1',
        label: 'Customer Name',
        key: 'customer_name',
        type: 'text',
        required: true,
      },
      {
        id: '2',
        label: 'Order Date',
        key: 'order_date',
        type: 'date',
        required: true,
      },
    ]);
  }, [blueprintId]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const columns: ColumnDef<FieldDefinition>[] = [
    {
      accessorKey: 'label',
      header: 'Label',
    },
    {
      accessorKey: 'key',
      header: 'Key',
    },
    {
      accessorKey: 'type',
      header: 'Type',
    },
    {
      accessorKey: 'options',
      header: 'Options',
    },
    {
      accessorKey: 'required',
      header: 'Required',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: () => null, // Rendered in SortableRow
    },
  ];

  const table = useReactTable({
    data: fields,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleUpdate = (id: string, field: string, value: any) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
    // TODO: Auto-save to API
  };

  const handleDelete = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    // TODO: Save to API
  };

  const handleMoveUp = (id: string) => {
    setFields((prev) => {
      const index = prev.findIndex((f) => f.id === id);
      if (index > 0) {
        return arrayMove(prev, index, index - 1);
      }
      return prev;
    });
  };

  const handleMoveDown = (id: string) => {
    setFields((prev) => {
      const index = prev.findIndex((f) => f.id === id);
      if (index < prev.length - 1) {
        return arrayMove(prev, index, index + 1);
      }
      return prev;
    });
  };

  const handleAddField = () => {
    const newField: FieldDefinition = {
      id: `field_${Date.now()}`,
      label: '',
      key: '',
      type: 'text',
      required: false,
    };
    setFields((prev) => [...prev, newField]);
  };

  const handleSave = () => {
    // TODO: Save to API
    console.log('Saving schema:', fields);
    alert('Schema saved! (Mock - TODO: API integration)');
  };

  return (
    <Container>
      <Header>
        <Title>Schema Editor</Title>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="outline" onClick={() => window.history.back()}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Schema
          </Button>
        </div>
      </Header>

      <Card>
        <CardHeader
          title={`Blueprint: ${blueprintId}`}
          description="Define custom fields for this entity type"
        />
        <CardContent>
          <TableContainer>
            <StyledTable>
              <TableHead>
                <tr>
                  <TableHeadCell style={{ width: '40px' }}>Order</TableHeadCell>
                  {table.getHeaderGroups().map((headerGroup) =>
                    headerGroup.headers.map((header) => (
                      <TableHeadCell key={header.id}>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </TableHeadCell>
                    ))
                  )}
                </tr>
              </TableHead>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <TableBody>
                    {table.getRowModel().rows.map((row, index) => (
                      <SortableRow
                        key={row.original.id}
                        row={row}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        onMoveUp={handleMoveUp}
                        onMoveDown={handleMoveDown}
                        isFirst={index === 0}
                        isLast={index === fields.length - 1}
                        availableEntities={availableEntities}
                        expandedValidation={expandedValidation}
                        setExpandedValidation={setExpandedValidation}
                      />
                    ))}
                    <GhostRow onClick={handleAddField}>
                      <TableCell colSpan={7} style={{ textAlign: 'center', color: 'rgb(var(--color-text-secondary))' }}>
                        + Add Field
                      </TableCell>
                    </GhostRow>
                  </TableBody>
                </SortableContext>
              </DndContext>
            </StyledTable>
          </TableContainer>
        </CardContent>
      </Card>
    </Container>
  );
};

export default SchemaEditor;
