/**
 * MultiSelect Component - Array-Based Multi-Selection Dropdown
 *
 * Features:
 * - Binds to ArrayField backend structure (string[])
 * - Searchable multi-select via Ant Design
 * - Theme-aware labels/help/error text
 *
 * Phase 4: Frontend Integration & UX Alignment
 * CRITICAL: Ensures proper array serialization for Django ArrayField
 */

import React from 'react';
import { Select } from 'antd';
import styled from 'styled-components';
import { Theme } from '../../config/theme';
import { useTheme } from '../../contexts/ThemeContext';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  value: string[];
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-label'?: string;
  id?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  value,
  onChange,
  options,
  label,
  placeholder = 'Select multiple options…',
  error,
  disabled = false,
  required = false,
  'aria-label': ariaLabel,
  id,
}) => {
  const { theme } = useTheme();

  return (
    <Container>
      {label && (
        <Label $theme={theme} htmlFor={id}>
          {label}
          {required && ' *'}
        </Label>
      )}

      <Select
        id={id}
        mode="multiple"
        showSearch
        allowClear
        optionFilterProp="label"
        // CRITICAL FIX: Explicitly force local string matching on every keystroke
        filterOption={(input, option) =>
          (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
        }
        value={value}
        onChange={(newValues) => {
          console.debug('[MultiSelect] New values:', newValues);
          onChange(newValues as string[]);
        }}
        options={options}
        disabled={disabled}
        placeholder={placeholder}
        style={{ width: '100%' }}
        status={error ? 'error' : ''}
        aria-label={ariaLabel || label}
      />

      {value.length > 0 && (
        <SelectedCount $theme={theme}>
          {value.length} item{value.length !== 1 ? 's' : ''} selected
        </SelectedCount>
      )}

      {error && <ErrorMessage $theme={theme}>{error}</ErrorMessage>}
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
`;

const Label = styled.label<{ $theme: Theme }>`
  font-size: 14px;
  font-weight: 500;
  color: ${(props) => props.$theme.colors.textPrimary};
  margin-bottom: 2px;
`;

const SelectedCount = styled.div<{ $theme: Theme }>`
  color: ${(props) => props.$theme.colors.primary};
  font-size: 12px;
  font-weight: 500;
`;

const ErrorMessage = styled.div<{ $theme: Theme }>`
  color: ${(props) => props.$theme.colors.danger};
  font-size: 12px;
`;

export default MultiSelect;
