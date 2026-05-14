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

import React, { useCallback } from 'react';
import { Typography } from 'antd';

import StableAntSelect from './StableAntSelect';
import { getAntdPopupContainer, type AntdGetPopupContainer } from '../../utils/antdPopupContainer';

// Stable style references to prevent re-renders in AntD Select
const WRAPPER_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, width: '100%' };
const SELECT_STYLE: React.CSSProperties = { width: '100%' };

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
  /**
   * Ensures dropdown renders within the correct overlay stacking context.
   * Defaults to a modal/drawer-safe container.
   */
  getPopupContainer?: AntdGetPopupContainer;
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
  getPopupContainer,
  'aria-label': ariaLabel,
  id,
}) => {
  const normalizedValue = value === '' ? undefined : value;
  const handleChange = useCallback(
    (next: string) => onChange(String(next)),
    [onChange]
  );

  return (
    <div style={WRAPPER_STYLE}>
      <StableAntSelect
        id={id}
        aria-label={ariaLabel}
        value={normalizedValue}
        placeholder={placeholder}
        disabled={disabled}
        status={error ? 'error' : undefined}
        options={options}
        onChange={handleChange}
        allowClear={!required}
        getPopupContainer={getPopupContainer ?? getAntdPopupContainer}
        style={SELECT_STYLE}
      />
      {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
    </div>
  );
};

export default Select;
