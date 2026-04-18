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

import { getAntdPopupContainer, type AntdGetPopupContainer } from '../../utils/antdPopupContainer';
import { US_STATES } from '../../utils/constants/states';

export interface StateSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  /**
   * Ensures dropdown renders within the correct overlay stacking context.
   * Defaults to a modal/drawer-safe container.
   */
  getPopupContainer?: AntdGetPopupContainer;
  'aria-label'?: string;
}

export const StateSelect: React.FC<StateSelectProps> = ({
  value,
  onChange,
  placeholder = 'Select state',
  disabled = false,
  allowClear = true,
  getPopupContainer,
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
      getPopupContainer={getPopupContainer ?? getAntdPopupContainer}
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
