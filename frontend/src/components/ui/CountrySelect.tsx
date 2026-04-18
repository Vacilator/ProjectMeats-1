/**
 * CountrySelect
 *
 * Searchable country selector.
 *
 * Default (recommended) value is "USA" (United States) to match backend defaults.
 */

import React from 'react';
import { Select as AntSelect } from 'antd';

import { getAntdPopupContainer, type AntdGetPopupContainer } from '../../utils/antdPopupContainer';
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY } from '../../utils/constants/countries';

export interface CountrySelectProps {
  /**
   * Optional to support AntD Form.Item injecting value/onChange at runtime.
   */
  value?: string;
  /**
   * Optional to support AntD Form.Item injecting value/onChange at runtime.
   */
  onChange?: (value: string) => void;
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

export const CountrySelect: React.FC<CountrySelectProps> = ({
  value,
  onChange,
  placeholder = 'Search country',
  disabled = false,
  allowClear = true,
  getPopupContainer,
  'aria-label': ariaLabel,
}) => {
  const effectiveValue = value || DEFAULT_COUNTRY;

  return (
    <AntSelect
      value={effectiveValue || undefined}
      onChange={(next) => onChange?.(String(next || DEFAULT_COUNTRY))}
      placeholder={placeholder}
      disabled={disabled}
      allowClear={allowClear}
      showSearch
      optionFilterProp="label"
      options={COUNTRY_OPTIONS as any}
      aria-label={ariaLabel}
      getPopupContainer={getPopupContainer ?? getAntdPopupContainer}
      style={{ width: '100%' }}
      filterOption={(input, option) => {
        const q = String(input || '').toLowerCase();
        const label = String((option as any)?.label || '').toLowerCase();
        const valueStr = String((option as any)?.value || '').toLowerCase();
        const code2 = String((option as any)?.code2 || '').toLowerCase();
        return label.includes(q) || valueStr.includes(q) || code2.includes(q);
      }}
    />
  );
};

export default CountrySelect;
