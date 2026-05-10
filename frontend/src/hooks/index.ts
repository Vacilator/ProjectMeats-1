/**
 * Custom Hooks
 * 
 * Re-exports all custom hooks for easy imports.
 */

export { useFormValidation } from './useFormValidation';
export type { FieldConfig, ValidationState, UseFormValidationReturn } from './useFormValidation';

export { useCustomerProducts } from './useCustomerProducts';
export type { Product, Customer, UseCustomerProductsReturn } from './useCustomerProducts';

export { useCommandPalette } from './useCommandPalette';
export type { default as UseCommandPaletteReturn } from './useCommandPalette';

export { useActionItemCounts, POLL_INTERVAL_ACTIVE, POLL_INTERVAL_BACKGROUND } from './useActionItemCounts';
export type { ActionItemCounts, UseActionItemCountsResult } from './useActionItemCounts';

export { useZodForm } from './useZodForm';

export { useMediaQuery, useIsMobile, useIsTablet } from './useMediaQuery';
