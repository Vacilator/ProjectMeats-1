/**
 * Countries constant for searchable country selectors.
 *
 * We keep a special "USA" value for United States to match existing backend defaults
 * (many models default to "USA"). For other countries, we store the country name.
 */

import { getData } from 'country-list';

export interface CountryOption {
  value: string;
  label: string;
  code2?: string;
}

export const DEFAULT_COUNTRY = 'USA';

const raw = getData(); // [{ code: 'US', name: 'United States' }, ...]

const others: CountryOption[] = raw
  .filter((c) => c?.name && c.name !== 'United States')
  .map((c) => ({ value: c.name, label: c.name, code2: c.code }))
  .sort((a, b) => a.label.localeCompare(b.label));

export const COUNTRY_OPTIONS: CountryOption[] = [
  { value: 'USA', label: 'United States', code2: 'US' },
  { value: 'United States', label: 'United States', code2: 'US' },
  { value: 'US', label: 'United States', code2: 'US' },
  ...others,
];
