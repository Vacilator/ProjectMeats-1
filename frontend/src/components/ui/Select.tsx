/**
 * Select Component - Reusable dropdown with semantic design system
 * 
 * Features:
 * - Theme-aware styling
 * - Full keyboard navigation
 * - ARIA labels for accessibility
 * - Error state support
 * - Optional placeholder
 */

import React from 'react';
import { Select as AntSelect, Typography } from 'antd';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-label'?: string;
  id?: string;
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  error,
  disabled = false,
  required = false,
  'aria-label': ariaLabel,
  id,
}) => {
  const normalizedValue = value === '' ? undefined : value;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      <AntSelect
        id={id}
        aria-label={ariaLabel}
        value={normalizedValue}
        placeholder={placeholder}
        disabled={disabled}
        status={error ? 'error' : undefined}
        options={options}
        onChange={(next) => onChange(String(next))}
        allowClear={!required}
        style={{ width: '100%' }}
      />
      {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
    </div>
  );
};

export default Select;
