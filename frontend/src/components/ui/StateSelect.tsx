/**
 * StateSelect
 *
 * Searchable US state selector.
 *
 * Uses Ant Design Select for typeahead search while keeping options
 * sourced from our canonical US_STATES constant.
 */

import React from 'react';
import { Select as AntSelect } from 'antd';

import { US_STATES } from '../../utils/constants/states';

export interface StateSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  'aria-label'?: string;
}

export const StateSelect: React.FC<StateSelectProps> = ({
  value,
  onChange,
  placeholder = 'Select state',
  disabled = false,
  allowClear = true,
  'aria-label': ariaLabel,
}) => {
  return (
    <AntSelect
      value={value || undefined}
      onChange={(next) => onChange(String(next || ''))}
      placeholder={placeholder}
      disabled={disabled}
      allowClear={allowClear}
      showSearch
      optionFilterProp="label"
      options={US_STATES}
      aria-label={ariaLabel}
      style={{ width: '100%' }}
      filterOption={(input, option) => {
        const label = String(option?.label || '').toLowerCase();
        const abbrev = String(option?.value || '').toLowerCase();
        const q = input.toLowerCase();
        return label.includes(q) || abbrev.includes(q);
      }}
    />
  );
};

export default StateSelect;
