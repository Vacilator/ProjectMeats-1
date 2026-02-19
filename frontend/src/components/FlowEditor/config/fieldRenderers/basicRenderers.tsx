/**
 * Basic Field Renderers
 * 
 * Simple field renderers for text, textarea, number, select, toggle.
 * Complex field types (entity-selector, field-mapping) use existing components.
 * 
 * Created: 2026-02-18
 * Phase: D.2 - Dynamic Panel
 * Updated: 2026-02-19 - Phase E: Added dynamic entity type select renderer
 */

import React from 'react';
import styled from 'styled-components';
import { ConfigField, FieldRendererProps } from '../types';
import { useEntityList } from '../../../../services/schemaService';  // Fixed path

// Import shared styled components
import {
  FormField,
  Label,
  Input,
  TextArea,
  Select,
  HelpText,
  ErrorMessage
} from '../../ConfigPanel/shared/StyledComponents';

/**
 * Render a text input field
 */
export function renderTextField(
  props: FieldRendererProps<string>
): React.ReactNode {
  const { field, value, onChange, error } = props;

  return (
    <FormField key={field.id}>
      <Label>
        {field.label}
        {field.required && <span style={{ color: 'rgb(var(--color-error))' }}> *</span>}
      </Label>
      {field.type === 'textarea' ? (
        <TextArea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={field.disabled || props.disabled}
          rows={4}
        />
      ) : (
        <Input
          type={field.type === 'number' ? 'number' : 'text'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={field.disabled || props.disabled}
        />
      )}
      {field.helpText && !error && <HelpText>{field.helpText}</HelpText>}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </FormField>
  );
}

/**
 * Render a select dropdown field
 */
export function renderSelectField(
  props: FieldRendererProps<string | string[]>
): React.ReactNode {
  const { field, value, onChange, error } = props;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (field.type === 'multiselect') {
      const options = Array.from(e.target.selectedOptions, option => option.value);
      onChange(options);
    } else {
      onChange(e.target.value);
    }
  };

  return (
    <FormField key={field.id}>
      <Label>
        {field.label}
        {field.required && <span style={{ color: 'rgb(var(--color-error))' }}> *</span>}
      </Label>
      <Select
        value={value || (field.type === 'multiselect' ? [] : '')}
        onChange={handleChange}
        disabled={field.disabled || props.disabled}
        multiple={field.type === 'multiselect'}
      >
        {!field.required && field.type !== 'multiselect' && (
          <option value="">-- Select --</option>
        )}
        {field.options?.map(option => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </Select>
      {field.helpText && !error && <HelpText>{field.helpText}</HelpText>}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </FormField>
  );
}

/**
 * Render a toggle switch field
 */
export function renderToggleField(
  props: FieldRendererProps<boolean>
): React.ReactNode {
  const { field, value, onChange, error } = props;

  return (
    <FormField key={field.id}>
      <ToggleRow>
        <ToggleLabel>
          {field.label}
          {field.required && <span style={{ color: 'rgb(var(--color-error))' }}> *</span>}
        </ToggleLabel>
        <ToggleSwitch
          checked={value || false}
          onChange={(e) => onChange(e.target.checked)}
          disabled={field.disabled || props.disabled}
        />
      </ToggleRow>
      {field.helpText && !error && <HelpText>{field.helpText}</HelpText>}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </FormField>
  );
}

/**
 * Render an entity type select dropdown (Phase E.2)
 * 
 * Dynamically loads entity types from the backend API and populates the dropdown.
 * This is the CORRECT way to render entity type selection - NOT EntityFieldPicker.
 * 
 * EntityFieldPicker is for selecting FIELDS from an entity, not the entity itself.
 */
export function renderEntityTypeSelect(
  props: FieldRendererProps<string>
): React.ReactNode {
  const { field, value, onChange, error } = props;
  
  // Fetch entity types from backend API
  const { data: entities = [], isLoading, error: fetchError } = useEntityList();

  return (
    <FormField key={field.id}>
      <Label>
        {field.label}
        {field.required && <span style={{ color: 'rgb(var(--color-error))' }}> *</span>}
      </Label>
      <Select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={field.disabled || props.disabled || isLoading}
      >
        {isLoading ? (
          <option value="">Loading entities...</option>
        ) : fetchError ? (
          <option value="">Error loading entities</option>
        ) : (
          <>
            <option value="">-- Select Entity Type --</option>
            {entities.map(entity => (
              <option key={entity.id} value={entity.id}>
                {entity.label}
              </option>
            ))}
          </>
        )}
      </Select>
      {field.helpText && !error && !fetchError && <HelpText>{field.helpText}</HelpText>}
      {fetchError && <ErrorMessage>Failed to load entity types: {String(fetchError)}</ErrorMessage>}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </FormField>
  );
}

// ============================================================================
// Styled Components
// ============================================================================

const ToggleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const ToggleLabel = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const ToggleSwitch = styled.input.attrs({ type: 'checkbox' })`
  width: 44px;
  height: 24px;
  appearance: none;
  background: rgb(var(--color-border));
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;

  &:checked {
    background: rgb(var(--color-primary));
  }

  &::before {
    content: '';
    position: absolute;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    top: 3px;
    left: 3px;
    background: white;
    transition: transform 0.2s;
  }

  &:checked::before {
    transform: translateX(20px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
