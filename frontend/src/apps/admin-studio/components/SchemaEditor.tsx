/**
 * SchemaEditor Component
 * 
 * Industry-leading spreadsheet-style editor for defining Blueprint field schemas.
 * Matches Airtable/Notion standards with:
 * - Field templates for common patterns
 * - Keyboard shortcuts (Ctrl+S save, Ctrl+Z undo, Del delete)
 * - Bulk operations (multi-select, bulk delete)
 * - Copy/paste fields
 * - Field search/filter
 * - Preview mode
 * - Import/export schema
 * - Undo/redo history
 * - Auto-save with debounce
 * - Inline help tooltips
 * 
 * Uses @tanstack/react-table for the table and @dnd-kit for row reordering.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import axios from 'axios';
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
import { notify } from '../../../utils/notify';

// Field definition type
export interface FieldDefinition {
  id: string;
  label: string;
  key: string;
  type: 'text' | 'number' | 'date' | 'select' | 'email' | 'phone' | 'url' | 'textarea' | 'checkbox' | 'radio' | 'file' | 'datetime' | 'reference' | 'currency' | 'percent' | 'rating' | 'color' | 'json';
  options?: string[];
  referenceEntity?: string;
  required: boolean;
  unique?: boolean;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: string;
  defaultValue?: string;
  placeholder?: string;
  helpText?: string;
  hidden?: boolean;
  readOnly?: boolean;
}

// Field template for quick creation
interface FieldTemplate {
  name: string;
  icon: string;
  description: string;
  field: Partial<FieldDefinition>;
}

// Common field templates (industry standard patterns)
const FIELD_TEMPLATES: FieldTemplate[] = [
  { name: 'Full Name', icon: '👤', description: 'Person\'s full name', field: { type: 'text', label: 'Full Name', required: true, minLength: 2, maxLength: 100 } },
  { name: 'Email Address', icon: '📧', description: 'Valid email', field: { type: 'email', label: 'Email', required: true, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' } },
  { name: 'Phone Number', icon: '📱', description: 'Phone with format', field: { type: 'phone', label: 'Phone', placeholder: '+1 (555) 123-4567' } },
  { name: 'Date of Birth', icon: '🎂', description: 'Birth date picker', field: { type: 'date', label: 'Date of Birth' } },
  { name: 'Currency Amount', icon: '💰', description: 'Money field', field: { type: 'currency', label: 'Amount', minValue: 0 } },
  { name: 'Percentage', icon: '📊', description: '0-100%', field: { type: 'percent', label: 'Percentage', minValue: 0, maxValue: 100 } },
  { name: 'Rating', icon: '⭐', description: '1-5 stars', field: { type: 'rating', label: 'Rating', minValue: 1, maxValue: 5 } },
  { name: 'Status', icon: '🚦', description: 'Status dropdown', field: { type: 'select', label: 'Status', options: ['Active', 'Inactive', 'Pending'] } },
  { name: 'Priority', icon: '🔥', description: 'Priority level', field: { type: 'select', label: 'Priority', options: ['Low', 'Medium', 'High', 'Critical'] } },
  { name: 'Notes', icon: '📝', description: 'Long text area', field: { type: 'textarea', label: 'Notes', maxLength: 5000 } },
  { name: 'Website URL', icon: '🌐', description: 'Valid URL', field: { type: 'url', label: 'Website', pattern: '^https?://' } },
  { name: 'File Attachment', icon: '📎', description: 'File upload', field: { type: 'file', label: 'Attachment' } },
];

// Undo/Redo history item
interface HistoryItem {
  fields: FieldDefinition[];
  timestamp: number;
  action: string;
}

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(var(--color-primary), 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(var(--color-primary), 0); }
  100% { box-shadow: 0 0 0 0 rgba(var(--color-primary), 0); }
`;

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
  gap: 1rem;
  flex-wrap: wrap;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Title = styled.h1`
  font-size: 1.875rem;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const SaveIndicator = styled.span<{ status: 'saved' | 'saving' | 'unsaved' }>`
  font-size: 0.75rem;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  background-color: ${props => {
    switch(props.status) {
      case 'saved': return 'rgba(34, 197, 94, 0.1)';
      case 'saving': return 'rgba(234, 179, 8, 0.1)';
      case 'unsaved': return 'rgba(239, 68, 68, 0.1)';
    }
  }};
  color: ${props => {
    switch(props.status) {
      case 'saved': return 'rgb(34, 197, 94)';
      case 'saving': return 'rgb(234, 179, 8)';
      case 'unsaved': return 'rgb(239, 68, 68)';
    }
  }};
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  margin-bottom: 1rem;
`;

const ToolbarDivider = styled.div`
  width: 1px;
  height: 24px;
  background-color: rgb(var(--color-border));
  margin: 0 0.5rem;
`;

const ToolbarButton = styled.button<{ active?: boolean }>`
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: ${props => props.active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  background: ${props => props.active ? 'rgba(var(--color-primary), 0.1)' : 'transparent'};
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  transition: all 0.2s;

  &:hover {
    background-color: rgba(var(--color-primary), 0.1);
    color: rgb(var(--color-primary));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SearchInput = styled.input`
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background-color: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  width: 200px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
  
  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
`;

const TemplatesPanel = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: ${props => props.isOpen ? '0' : '-400px'};
  width: 400px;
  height: 100vh;
  background-color: rgb(var(--color-surface));
  border-left: 1px solid rgb(var(--color-border));
  box-shadow: var(--shadow-xl);
  z-index: 100;
  transition: right 0.3s ease-in-out;
  display: flex;
  flex-direction: column;
`;

const TemplatesPanelHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const TemplatesPanelBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
`;

const TemplateCard = styled.div`
  padding: 1rem;
  margin-bottom: 0.5rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;

  &:hover {
    border-color: rgb(var(--color-primary));
    background-color: rgba(var(--color-primary), 0.05);
    transform: translateX(-4px);
  }
`;

const TemplateIcon = styled.span`
  font-size: 1.5rem;
`;

const TemplateInfo = styled.div`
  flex: 1;
`;

const TemplateName = styled.div`
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 0.25rem;
`;

const TemplateDescription = styled.div`
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary));
`;

const PreviewModal = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: ${props => props.isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const PreviewContent = styled.div`
  background-color: rgb(var(--color-surface));
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: ${fadeIn} 0.2s ease-out;
`;

const PreviewHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const PreviewBody = styled.div`
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
`;

const PreviewField = styled.div`
  margin-bottom: 1.5rem;
`;

const PreviewLabel = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 0.5rem;
`;

const PreviewInput = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
`;

const PreviewSelect = styled.select`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
`;

const PreviewTextarea = styled.textarea`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  min-height: 100px;
  resize: vertical;
`;

const HelpTooltip = styled.span`
  font-size: 0.7rem;
  color: rgb(var(--color-text-secondary));
  margin-left: 0.25rem;
  cursor: help;
  
  &:hover {
    color: rgb(var(--color-primary));
  }
`;

const KeyboardShortcut = styled.kbd`
  display: inline-block;
  padding: 0.125rem 0.375rem;
  font-size: 0.65rem;
  font-family: var(--font-mono);
  background-color: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  color: rgb(var(--color-text-secondary));
  margin-left: 0.5rem;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  color: rgb(var(--color-text-secondary));
`;

const EmptyStateIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`;

const EmptyStateTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 0.5rem;
`;

const EmptyStateDescription = styled.p`
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
`;

const SelectionBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: rgba(var(--color-primary), 0.1);
  color: rgb(var(--color-primary));
  border-radius: var(--radius-full);
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
      currency: 'rgba(16, 185, 129, 0.1)',
      percent: 'rgba(245, 158, 11, 0.1)',
      rating: 'rgba(251, 191, 36, 0.1)',
      color: 'rgba(236, 72, 153, 0.1)',
      json: 'rgba(99, 102, 241, 0.1)',
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
      currency: 'rgb(16, 185, 129)',
      percent: 'rgb(245, 158, 11)',
      rating: 'rgb(251, 191, 36)',
      color: 'rgb(236, 72, 153)',
      json: 'rgb(99, 102, 241)',
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
  
  // Industry-leading features state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [clipboard, setClipboard] = useState<FieldDefinition[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Filtered fields based on search
  const filteredFields = useMemo(() => {
    if (!searchQuery.trim()) return fields;
    const query = searchQuery.toLowerCase();
    return fields.filter(f => 
      f.label.toLowerCase().includes(query) ||
      f.key.toLowerCase().includes(query) ||
      f.type.toLowerCase().includes(query)
    );
  }, [fields, searchQuery]);

  // Save to history for undo/redo
  const saveToHistory = useCallback((newFields: FieldDefinition[], action: string) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ fields: JSON.parse(JSON.stringify(newFields)), timestamp: Date.now(), action });
    // Keep only last 50 history items
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setFields(JSON.parse(JSON.stringify(history[newIndex].fields)));
      setHistoryIndex(newIndex);
      setSaveStatus('unsaved');
    }
  }, [history, historyIndex]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setFields(JSON.parse(JSON.stringify(history[newIndex].fields)));
      setHistoryIndex(newIndex);
      setSaveStatus('unsaved');
    }
  }, [history, historyIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Ctrl/Cmd + Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y: Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
      // Ctrl/Cmd + C: Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedFields.size > 0) {
        e.preventDefault();
        handleCopy();
      }
      // Ctrl/Cmd + V: Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard.length > 0) {
        e.preventDefault();
        handlePaste();
      }
      // Delete: Delete selected
      if (e.key === 'Delete' && selectedFields.size > 0) {
        e.preventDefault();
        handleBulkDelete();
      }
      // Escape: Clear selection
      if (e.key === 'Escape') {
        setSelectedFields(new Set());
        setIsTemplatesOpen(false);
        setIsPreviewOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFields, clipboard, handleUndo, handleRedo]);

  // Auto-save with debounce
  const triggerAutoSave = useCallback(() => {
    setSaveStatus('unsaved');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 2000); // Auto-save after 2 seconds of inactivity
  }, []);

  // Copy selected fields
  const handleCopy = () => {
    const copiedFields = fields.filter(f => selectedFields.has(f.id));
    setClipboard(JSON.parse(JSON.stringify(copiedFields)));
  };

  // Paste copied fields
  const handlePaste = () => {
    const pastedFields = clipboard.map(f => ({
      ...f,
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label: `${f.label} (Copy)`,
      key: `${f.key}_copy`,
    }));
    const newFields = [...fields, ...pastedFields];
    setFields(newFields);
    saveToHistory(newFields, 'Paste fields');
    triggerAutoSave();
  };

  // Bulk delete selected fields
  const handleBulkDelete = () => {
    if (selectedFields.size === 0) return;
    if (window.confirm(`Delete ${selectedFields.size} selected field(s)? This cannot be undone.`)) {
      const newFields = fields.filter(f => !selectedFields.has(f.id));
      setFields(newFields);
      setSelectedFields(new Set());
      saveToHistory(newFields, 'Bulk delete');
      triggerAutoSave();
    }
  };

  // Select all fields
  const handleSelectAll = () => {
    if (selectedFields.size === fields.length) {
      setSelectedFields(new Set());
    } else {
      setSelectedFields(new Set(fields.map(f => f.id)));
    }
  };

  // Toggle field selection
  const toggleFieldSelection = (id: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedFields(newSelected);
  };

  // Add field from template
  const handleAddFromTemplate = (template: FieldTemplate) => {
    const newField: FieldDefinition = {
      id: `field_${Date.now()}`,
      label: template.field.label || '',
      key: (template.field.label || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      type: template.field.type || 'text',
      required: template.field.required || false,
      ...template.field,
    };
    const newFields = [...fields, newField];
    setFields(newFields);
    saveToHistory(newFields, `Add ${template.name}`);
    setIsTemplatesOpen(false);
    triggerAutoSave();
  };

  // Duplicate a field
  const handleDuplicate = (id: string) => {
    const fieldToDuplicate = fields.find(f => f.id === id);
    if (!fieldToDuplicate) return;
    const newField: FieldDefinition = {
      ...fieldToDuplicate,
      id: `field_${Date.now()}`,
      label: `${fieldToDuplicate.label} (Copy)`,
      key: `${fieldToDuplicate.key}_copy`,
    };
    const index = fields.findIndex(f => f.id === id);
    const newFields = [...fields];
    newFields.splice(index + 1, 0, newField);
    setFields(newFields);
    saveToHistory(newFields, 'Duplicate field');
    triggerAutoSave();
  };

  // Export schema as JSON
  const handleExport = () => {
    const exportData = {
      blueprintId,
      exportedAt: new Date().toISOString(),
      fields: fields.map(({ id, ...rest }) => rest), // Remove internal IDs
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema_${blueprintId}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import schema from JSON
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.fields && Array.isArray(data.fields)) {
            const importedFields: FieldDefinition[] = data.fields.map((f: any, i: number) => ({
              ...f,
              id: `imported_${Date.now()}_${i}`,
            }));
            if (window.confirm(`Import ${importedFields.length} fields? This will replace current schema.`)) {
              setFields(importedFields);
              saveToHistory(importedFields, 'Import schema');
              triggerAutoSave();
            }
          }
        } catch (err) {
          alert('Invalid JSON file. Please check the format.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

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
    const initialFields: FieldDefinition[] = [
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
    ];
    setFields(initialFields);
    // Initialize history with initial state
    setHistory([{ fields: initialFields, timestamp: Date.now(), action: 'Initial load' }]);
    setHistoryIndex(0);
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
        const newFields = arrayMove(items, oldIndex, newIndex);
        
        // Save to history and trigger API save
        saveToHistory(newFields, 'Reorder fields');
        triggerAutoSave();
        
        return newFields;
      });
    }
  };

  const handleUpdate = (id: string, field: string, value: any) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
    // Trigger auto-save after field update
    triggerAutoSave();
  };

  const handleDelete = (id: string) => {
    const newFields = fields.filter((f) => f.id !== id);
    setFields(newFields);
    saveToHistory(newFields, 'Delete field');
    triggerAutoSave();
  };

  const handleMoveUp = (id: string) => {
    setFields((prev) => {
      const index = prev.findIndex((f) => f.id === id);
      if (index > 0) {
        const newFields = arrayMove(prev, index, index - 1);
        saveToHistory(newFields, 'Move field up');
        triggerAutoSave();
        return newFields;
      }
      return prev;
    });
  };

  const handleMoveDown = (id: string) => {
    setFields((prev) => {
      const index = prev.findIndex((f) => f.id === id);
      if (index < prev.length - 1) {
        const newFields = arrayMove(prev, index, index + 1);
        saveToHistory(newFields, 'Move field down');
        triggerAutoSave();
        return newFields;
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
    const newFields = [...fields, newField];
    setFields(newFields);
    saveToHistory(newFields, 'Add field');
    triggerAutoSave();
  };

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    
    try {
      // Get CSRF token from cookie
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return null;
      };
      const csrfToken = getCookie('csrftoken') || 
                        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      // Save schema to API
      const response = await axios.put(
        `/admin/system-config/api/studio/versions/${blueprintId}/schema/`,
        { 
          fields: fields.map((f, index) => ({
            ...f,
            order: index  // Include order in the save payload
          }))
        },
        {
          headers: {
            'X-CSRFToken': csrfToken || '',
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.status === 200) {
        setSaveStatus('saved');
        notify.success('Schema saved successfully');
      }
    } catch (error: any) {
      console.error('Error saving schema:', error);
      setSaveStatus('unsaved');
      notify.error(`Failed to save schema: ${error.message || 'Unknown error'}`);
    }
  }, [fields, blueprintId]);

  // Render preview of a field
  const renderPreviewField = (field: FieldDefinition) => {
    switch (field.type) {
      case 'select':
      case 'radio':
        return (
          <PreviewSelect disabled>
            <option value="">{field.placeholder || 'Select...'}</option>
            {field.options?.map((opt, i) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </PreviewSelect>
        );
      case 'textarea':
        return <PreviewTextarea disabled placeholder={field.placeholder || 'Enter text...'} />;
      case 'checkbox':
        return (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" disabled />
            <span>{field.label}</span>
          </label>
        );
      default:
        return (
          <PreviewInput 
            type={field.type === 'number' || field.type === 'currency' || field.type === 'percent' ? 'number' : 
                  field.type === 'email' ? 'email' : 
                  field.type === 'date' ? 'date' : 
                  field.type === 'datetime' ? 'datetime-local' : 'text'}
            disabled 
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
          />
        );
    }
  };

  return (
    <Container>
      <Header>
        <HeaderLeft>
          <Title>Schema Editor</Title>
          <SaveIndicator status={saveStatus}>
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'saving' && '⟳ Saving...'}
            {saveStatus === 'unsaved' && '● Unsaved'}
          </SaveIndicator>
        </HeaderLeft>
        <HeaderRight>
          <Button variant="outline" onClick={() => window.history.back()}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Schema
            <KeyboardShortcut>⌘S</KeyboardShortcut>
          </Button>
        </HeaderRight>
      </Header>

      {/* Toolbar with all actions */}
      <Toolbar>
        <ToolbarButton onClick={handleUndo} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)">
          ↩ Undo
        </ToolbarButton>
        <ToolbarButton onClick={handleRedo} disabled={historyIndex >= history.length - 1} title="Redo (Ctrl+Y)">
          ↪ Redo
        </ToolbarButton>
        
        <ToolbarDivider />
        
        <ToolbarButton onClick={() => setIsTemplatesOpen(true)} title="Add from template">
          📋 Templates
        </ToolbarButton>
        <ToolbarButton onClick={handleAddField} title="Add blank field">
          ➕ Add Field
        </ToolbarButton>
        
        <ToolbarDivider />
        
        <ToolbarButton onClick={handleCopy} disabled={selectedFields.size === 0} title="Copy (Ctrl+C)">
          📄 Copy
        </ToolbarButton>
        <ToolbarButton onClick={handlePaste} disabled={clipboard.length === 0} title="Paste (Ctrl+V)">
          📋 Paste
        </ToolbarButton>
        <ToolbarButton onClick={handleBulkDelete} disabled={selectedFields.size === 0} title="Delete (Del)">
          🗑️ Delete
        </ToolbarButton>
        
        <ToolbarDivider />
        
        <ToolbarButton onClick={() => setIsPreviewOpen(true)} title="Preview form">
          👁️ Preview
        </ToolbarButton>
        <ToolbarButton onClick={handleExport} title="Export as JSON">
          📤 Export
        </ToolbarButton>
        <ToolbarButton onClick={handleImport} title="Import from JSON">
          📥 Import
        </ToolbarButton>
        
        <div style={{ flex: 1 }} />
        
        <SearchInput
          type="text"
          placeholder="🔍 Search fields..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        
        {selectedFields.size > 0 && (
          <SelectionBadge>
            {selectedFields.size} selected
            <button onClick={() => setSelectedFields(new Set())} style={{ marginLeft: '0.25rem', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
          </SelectionBadge>
        )}
      </Toolbar>

      <Card>
        <CardHeader
          title={`Blueprint: ${blueprintId}`}
          description="Define custom fields for this entity type. Drag to reorder, click templates for common patterns."
        />
        <CardContent>
          {filteredFields.length === 0 && searchQuery ? (
            <EmptyState>
              <EmptyStateIcon>🔍</EmptyStateIcon>
              <EmptyStateTitle>No fields found</EmptyStateTitle>
              <EmptyStateDescription>
                No fields match "{searchQuery}". Try a different search term.
              </EmptyStateDescription>
              <Button variant="outline" onClick={() => setSearchQuery('')}>
                Clear Search
              </Button>
            </EmptyState>
          ) : fields.length === 0 ? (
            <EmptyState>
              <EmptyStateIcon>📝</EmptyStateIcon>
              <EmptyStateTitle>No fields yet</EmptyStateTitle>
              <EmptyStateDescription>
                Start by adding fields to define your data schema. Use templates for common patterns.
              </EmptyStateDescription>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <Button variant="outline" onClick={() => setIsTemplatesOpen(true)}>
                  📋 Browse Templates
                </Button>
                <Button variant="primary" onClick={handleAddField}>
                  ➕ Add Field
                </Button>
              </div>
            </EmptyState>
          ) : (
            <TableContainer>
              <StyledTable>
                <TableHead>
                  <tr>
                    <TableHeadCell style={{ width: '40px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedFields.size === fields.length && fields.length > 0}
                        onChange={handleSelectAll}
                        title="Select all"
                      />
                    </TableHeadCell>
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
                    items={filteredFields.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <TableBody>
                      {table.getRowModel().rows
                        .filter(row => filteredFields.some(f => f.id === row.original.id))
                        .map((row, index) => (
                        <SortableRow
                          key={row.original.id}
                          row={row}
                          onUpdate={handleUpdate}
                          onDelete={handleDelete}
                          onMoveUp={handleMoveUp}
                          onMoveDown={handleMoveDown}
                          isFirst={index === 0}
                          isLast={index === filteredFields.length - 1}
                          availableEntities={availableEntities}
                          expandedValidation={expandedValidation}
                          setExpandedValidation={setExpandedValidation}
                        />
                      ))}
                    <GhostRow onClick={handleAddField}>
                      <TableCell colSpan={8} style={{ textAlign: 'center', color: 'rgb(var(--color-text-secondary))' }}>
                        + Add Field
                      </TableCell>
                    </GhostRow>
                  </TableBody>
                </SortableContext>
              </DndContext>
            </StyledTable>
          </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Field Templates Panel */}
      <TemplatesPanel isOpen={isTemplatesOpen}>
        <TemplatesPanelHeader>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>Field Templates</h2>
            <p style={{ fontSize: '0.875rem', color: 'rgb(var(--color-text-secondary))' }}>
              Quick-add common field patterns
            </p>
          </div>
          <button
            onClick={() => setIsTemplatesOpen(false)}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'rgb(var(--color-text-secondary))' }}
          >
            ×
          </button>
        </TemplatesPanelHeader>
        <TemplatesPanelBody>
          {FIELD_TEMPLATES.map((template, index) => (
            <TemplateCard key={index} onClick={() => handleAddFromTemplate(template)}>
              <TemplateIcon>{template.icon}</TemplateIcon>
              <TemplateInfo>
                <TemplateName>{template.name}</TemplateName>
                <TemplateDescription>{template.description}</TemplateDescription>
              </TemplateInfo>
            </TemplateCard>
          ))}
        </TemplatesPanelBody>
      </TemplatesPanel>

      {/* Form Preview Modal */}
      <PreviewModal isOpen={isPreviewOpen} onClick={() => setIsPreviewOpen(false)}>
        <PreviewContent onClick={(e) => e.stopPropagation()}>
          <PreviewHeader>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>Form Preview</h2>
              <p style={{ fontSize: '0.875rem', color: 'rgb(var(--color-text-secondary))' }}>
                Preview how the form will look to users
              </p>
            </div>
            <button
              onClick={() => setIsPreviewOpen(false)}
              style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'rgb(var(--color-text-secondary))' }}
            >
              ×
            </button>
          </PreviewHeader>
          <PreviewBody>
            {fields.length === 0 ? (
              <EmptyState>
                <EmptyStateIcon>📝</EmptyStateIcon>
                <EmptyStateTitle>No fields to preview</EmptyStateTitle>
                <EmptyStateDescription>Add some fields to see a preview.</EmptyStateDescription>
              </EmptyState>
            ) : (
              fields.map((field) => (
                <PreviewField key={field.id}>
                  <PreviewLabel>
                    {field.label || 'Untitled Field'}
                    {field.required && <span style={{ color: 'rgb(239, 68, 68)', marginLeft: '0.25rem' }}>*</span>}
                    {field.helpText && <HelpTooltip title={field.helpText}>ⓘ</HelpTooltip>}
                  </PreviewLabel>
                  {renderPreviewField(field)}
                  {field.helpText && (
                    <div style={{ fontSize: '0.75rem', color: 'rgb(var(--color-text-secondary))', marginTop: '0.25rem' }}>
                      {field.helpText}
                    </div>
                  )}
                </PreviewField>
              ))
            )}
          </PreviewBody>
        </PreviewContent>
      </PreviewModal>

      {/* Keyboard shortcuts help (hidden, for accessibility) */}
      <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
        <p>Keyboard shortcuts:</p>
        <ul>
          <li>Ctrl+S: Save schema</li>
          <li>Ctrl+Z: Undo</li>
          <li>Ctrl+Y or Ctrl+Shift+Z: Redo</li>
          <li>Ctrl+C: Copy selected fields</li>
          <li>Ctrl+V: Paste fields</li>
          <li>Delete: Delete selected fields</li>
          <li>Escape: Clear selection</li>
        </ul>
      </div>
    </Container>
  );
};

export default SchemaEditor;
