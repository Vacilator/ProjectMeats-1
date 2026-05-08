/**
 * Field Transformation Functions
 *
 * Provides data transformation utilities for field mappings.
 * Supports common transformations: case conversion, trimming, formatting, calculations.
 *
 * Created: 2026-02-21
 * Phase: 4 - Smart Algorithms
 */

import { logger } from '@/utils/logger';
export type TransformationType =
  | 'uppercase'
  | 'lowercase'
  | 'capitalize'
  | 'trim'
  | 'trimStart'
  | 'trimEnd'
  | 'replace'
  | 'substring'
  | 'concat'
  | 'split'
  | 'formatDate'
  | 'formatNumber'
  | 'formatCurrency'
  | 'formatPhone'
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'round'
  | 'floor'
  | 'ceil'
  | 'abs'
  | 'default';

export interface TransformationConfig {
  type: TransformationType;
  params?: Record<string, any>;
}

/**
 * Apply a single transformation to a value
 */
export function applyTransformation(
  value: any,
  transformation: TransformationConfig
): any {
  if (value === null || value === undefined) {
    return transformation.type === 'default' ? transformation.params?.value : value;
  }

  try {
    switch (transformation.type) {
      // String transformations
      case 'uppercase':
        return String(value).toUpperCase();

      case 'lowercase':
        return String(value).toLowerCase();

      case 'capitalize':
        return String(value)
          .toLowerCase()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

      case 'trim':
        return String(value).trim();

      case 'trimStart':
        return String(value).trimStart();

      case 'trimEnd':
        return String(value).trimEnd();

      case 'replace':
        return String(value).replace(
          transformation.params?.search || '',
          transformation.params?.replace || ''
        );

      case 'substring':
        return String(value).substring(
          transformation.params?.start || 0,
          transformation.params?.end
        );

      case 'concat':
        return String(value) + (transformation.params?.suffix || '');

      case 'split':
        return String(value).split(transformation.params?.delimiter || ',');

      // Formatting transformations
      case 'formatDate':
        return formatDate(value, transformation.params?.format || 'YYYY-MM-DD');

      case 'formatNumber':
        return formatNumber(value, transformation.params?.decimals || 2);

      case 'formatCurrency':
        return formatCurrency(
          value,
          transformation.params?.currency || 'USD',
          transformation.params?.decimals || 2
        );

      case 'formatPhone':
        return formatPhone(value, transformation.params?.format || 'US');

      // Math transformations
      case 'add':
        return Number(value) + (transformation.params?.value || 0);

      case 'subtract':
        return Number(value) - (transformation.params?.value || 0);

      case 'multiply':
        return Number(value) * (transformation.params?.value || 1);

      case 'divide':
        return Number(value) / (transformation.params?.value || 1);

      case 'round':
        return Math.round(Number(value));

      case 'floor':
        return Math.floor(Number(value));

      case 'ceil':
        return Math.ceil(Number(value));

      case 'abs':
        return Math.abs(Number(value));

      // Default value
      case 'default':
        return transformation.params?.value;

      default:
        return value;
    }
  } catch (error) {
    logger.error(`Transformation error (${transformation.type}):`, error);
    return value;
  }
}

/**
 * Apply multiple transformations in sequence
 */
export function applyTransformations(
  value: any,
  transformations: TransformationConfig[]
): any {
  return transformations.reduce(
    (acc, transformation) => applyTransformation(acc, transformation),
    value
  );
}

/**
 * Format a date value
 */
function formatDate(value: any, format: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);

  const parts: Record<string, string> = {
    YYYY: date.getFullYear().toString(),
    YY: date.getFullYear().toString().slice(-2),
    MM: String(date.getMonth() + 1).padStart(2, '0'),
    M: String(date.getMonth() + 1),
    DD: String(date.getDate()).padStart(2, '0'),
    D: String(date.getDate()),
    HH: String(date.getHours()).padStart(2, '0'),
    H: String(date.getHours()),
    mm: String(date.getMinutes()).padStart(2, '0'),
    m: String(date.getMinutes()),
    ss: String(date.getSeconds()).padStart(2, '0'),
    s: String(date.getSeconds()),
  };

  let result = format;
  for (const [key, value] of Object.entries(parts)) {
    result = result.replace(key, value);
  }

  return result;
}

/**
 * Format a number with decimals
 */
function formatNumber(value: any, decimals: number): string {
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return num.toFixed(decimals);
}

/**
 * Format a currency value
 */
function formatCurrency(value: any, currency: string, decimals: number): string {
  const num = Number(value);
  if (isNaN(num)) return String(value);

  const formatted = num.toFixed(decimals);
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
  };

  const symbol = symbols[currency] || currency;
  return `${symbol}${formatted}`;
}

/**
 * Format a phone number
 */
function formatPhone(value: any, format: string): string {
  const digits = String(value).replace(/\D/g, '');

  if (format === 'US') {
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11) {
      return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
  }

  return String(value);
}

/**
 * Get available transformations for a field type
 */
export function getAvailableTransformations(fieldType: string): TransformationType[] {
  const stringTransformations: TransformationType[] = [
    'uppercase',
    'lowercase',
    'capitalize',
    'trim',
    'trimStart',
    'trimEnd',
    'replace',
    'substring',
    'concat',
    'split',
  ];

  const numberTransformations: TransformationType[] = [
    'add',
    'subtract',
    'multiply',
    'divide',
    'round',
    'floor',
    'ceil',
    'abs',
    'formatNumber',
    'formatCurrency',
  ];

  const dateTransformations: TransformationType[] = ['formatDate'];

  const universalTransformations: TransformationType[] = ['default'];

  switch (fieldType) {
    case 'text':
    case 'textarea':
    case 'email':
      return [...stringTransformations, ...universalTransformations];

    case 'phone':
      return [...stringTransformations, 'formatPhone', ...universalTransformations];

    case 'number':
    case 'rating':
    case 'slider':
      return [...numberTransformations, ...universalTransformations];

    case 'date':
    case 'datetime':
      return [...dateTransformations, ...universalTransformations];

    default:
      return universalTransformations;
  }
}

/**
 * Get transformation display name
 */
export function getTransformationName(type: TransformationType): string {
  const names: Record<TransformationType, string> = {
    uppercase: 'UPPERCASE',
    lowercase: 'lowercase',
    capitalize: 'Capitalize Words',
    trim: 'Trim Whitespace',
    trimStart: 'Trim Start',
    trimEnd: 'Trim End',
    replace: 'Find & Replace',
    substring: 'Extract Substring',
    concat: 'Add Suffix',
    split: 'Split to Array',
    formatDate: 'Format Date',
    formatNumber: 'Format Number',
    formatCurrency: 'Format as Currency',
    formatPhone: 'Format Phone',
    add: 'Add (+)',
    subtract: 'Subtract (-)',
    multiply: 'Multiply (×)',
    divide: 'Divide (÷)',
    round: 'Round',
    floor: 'Round Down',
    ceil: 'Round Up',
    abs: 'Absolute Value',
    default: 'Default Value',
  };

  return names[type] || type;
}
