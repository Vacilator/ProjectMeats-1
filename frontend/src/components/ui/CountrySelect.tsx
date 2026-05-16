/**
 * CountrySelect
 *
 * Searchable country selector.
 *
 * Default (recommended) value is "USA" (United States) to match backend defaults.
 */

import React from 'react';
import StableAntSelect from './StableAntSelect';

import { getAntdPopupContainer, type AntdGetPopupContainer } from '../../utils/antdPopupContainer';
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY, type CountryOption } from '../../utils/constants/countries';

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
    <StableAntSelect
      value={effectiveValue || undefined}
      onChange={(next) => onChange?.(String(next || DEFAULT_COUNTRY))}
      placeholder={placeholder}
      disabled={disabled}
      allowClear={allowClear}
      showSearch
      optionFilterProp="label"
      options={COUNTRY_OPTIONS}
      aria-label={ariaLabel}
      getPopupContainer={getPopupContainer ?? getAntdPopupContainer}
      style={{ width: '100%' }}
      filterOption={(input, option) => {
        const q = String(input || '').toLowerCase();
        const opt = option as CountryOption;
        const label = (opt?.label || '').toLowerCase();
        const valueStr = (opt?.value || '').toLowerCase();
        const code2 = (opt?.code2 || '').toLowerCase();
        return label.includes(q) || valueStr.includes(q) || code2.includes(q);
      }}
    />
  );
};

export default CountrySelect;
