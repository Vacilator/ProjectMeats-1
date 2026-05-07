/**
 * UniversalEntityForm
 *
 * Schema-driven create/edit form surface.
 *
 * Responsibilities:
 * - Fetch entity schema + existing values (edit)
 * - Render fields via DynamicFormEngine
 * - Provide tenant-safe, service-layer-backed persistence
 *
 * Notes:
 * - All requests must go through businessApi/apiClient (service layer)
 * - Foreign keys should use SearchableSelect to avoid massive dropdowns
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthState } from '@/contexts/AuthContext';
import { Button, Modal, Spin, message, Select, Skeleton } from 'antd';
import { isEqual } from 'lodash';
import styled from 'styled-components';
import { businessApi } from '../../services/businessApi';
import DynamicFormEngine from '../../features/system/DynamicFormEngine';
import type { DynamicFormConfig } from '../../features/system/DynamicFormEngine';
import EntityOptionsSelect from '../FormSubmission/SearchableSelect';
import { isValidEmail } from '../../shared/utils';
import { normalizeUsPhone } from '../../utils/phone';
import { getSelectPopupContainer as getDefaultSelectPopupContainer } from '../../utils/antd';

export type UniversalEntityFormMode = 'create' | 'edit' | 'view' | 'clone';
export type UniversalEntityFormVariant = 'modal' | 'inline';

export interface UniversalEntityFormProps {
  entityType: string;
  entityId?: string | number;

  /**
   * Form mode:
   * - create: create new record
   * - edit: edit existing record
   * - view: read-only view with optional switch to edit
   */
  mode?: UniversalEntityFormMode;

  /**
   * Render surface.
   * - modal: wraps form in a modal (default)
   * - inline: renders directly (embeddable into pages/panels)
   */
  variant?: UniversalEntityFormVariant;

  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: unknown) => void;
  initialValues?: Record<string, unknown>;
  initialData?: Record<string, unknown>;
  schema?: BackendSchema | null;
  dropdownOptions?: Record<
    string,
    Array<{ value: string; label: string; metadata?: Record<string, unknown> }>
  >;
  formConfig?: Partial<DynamicFormConfig>;
  loading?: boolean;
  loadError?: unknown | null;
  onSubmit?: (payload: Record<string, unknown>) => Promise<unknown> | unknown;

  /** Optional override for prioritizing key fields first. */
  keyFields?: string[];

  /** When true, allows switching view → edit within the same surface. */
  allowModeSwitch?: boolean;

  /** Optional AI-assisted autofill controls owned by the smart loader. */
  autofill?: {
    documents: Array<{ id: string; original_filename: string }>;
    selectedDocumentId: string;
    loadingDocuments?: boolean;
    extracting?: boolean;
    disabled?: boolean;
    onDocumentChange: (documentId: string) => void;
    onExtract: () => void;
    onUpload: (file: File) => void;
  } | null;

  /** Preloaded resources supplied by an outer data loader to avoid in-component fetch loops. */
  externalSchema?: BackendSchema | null;
  externalRecordValues?: Record<string, unknown> | null;
  externalLoading?: boolean;
  externalLoadError?: unknown | null;
  externalFkOptions?: Record<string, Array<{ id: string | number; name: string }>>;
  onSubmittingChange?: (isSubmitting: boolean) => void;
  onValuesChange?: (values: Record<string, unknown>) => void;
}

type SchemaChoice = { value: unknown; label: string };

export type BackendField = {
  key: string;
  api_key?: string;
  label?: string;
  type?: string;
  required?: boolean;
  placeholder?: string | null;
  help_text?: string;

  /** Progressive disclosure flag from the backend schema generator (additive-only). */
  is_advanced?: boolean;

  // Relationship metadata (schema endpoint)
  related_entity?: string | null;
  choices?: SchemaChoice[] | null;
  ui?: Record<string, unknown> | null;
  dependencies?: string[];
  item_fields?: BackendField[];
  add_button_label?: string;
  item_label?: string;
};

export type BackendSchema = {
  name?: string;
  description?: string;
  fields?: BackendField[];
  key_fields?: string[];
};

type PreloadedDropdownOption = {
  value: string;
  label: string;
  metadata?: Record<string, unknown>;
};

const EMPTY_FORM_VALUES: Record<string, unknown> = {};
const EXTRACTABLE_ENTITY_KEYS = new Set(['purchase_order', 'sales_order', 'invoice', 'carrier_po']);

function useDeepStableValue<T>(value: T): T {
  const ref = useRef(value);

  if (!isEqual(ref.current, value)) {
    ref.current = value;
  }

  return ref.current;
}

export const getStableSignature = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const splitPath = (path: string): string[] =>
  String(path || '')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

const getValueAtPath = (obj: unknown, path: string): any => {
  const segments = splitPath(path);
  let current = obj;
  for (const segment of segments) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

const setValueAtPath = (target: Record<string, unknown>, path: string, value: unknown): void => {
  const segments = splitPath(path);
  if (!segments.length) return;

  let current = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const next = current[segment];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }

  current[segments[segments.length - 1]] = value;
};

const SNAPSHOT_FIELD_TO_FORM_PATH: Record<
  string,
  { path: string; label: string; section: string }
> = {
  billing_contact_name: { path: 'billing_contact.name', label: 'Name', section: 'Billing Contact' },
  billing_contact_phone: { path: 'billing_contact.phone', label: 'Phone', section: 'Billing Contact' },
  billing_contact_email: { path: 'billing_contact.email', label: 'Email', section: 'Billing Contact' },
  billing_contact_title: { path: 'billing_contact.title', label: 'Title', section: 'Billing Contact' },
  billing_address_street: { path: 'billing_address.street', label: 'Street', section: 'Billing Address' },
  billing_address_city: { path: 'billing_address.city', label: 'City', section: 'Billing Address' },
  billing_address_state_zip: { path: 'billing_address.state_zip', label: 'State / Zip', section: 'Billing Address' },
  billing_building_name: { path: 'billing_address.building_name', label: 'Building Name', section: 'Billing Address' },
  shipping_contact_name: { path: 'shipping_contact.name', label: 'Name', section: 'Shipping Contact' },
  shipping_contact_phone: { path: 'shipping_contact.phone', label: 'Phone', section: 'Shipping Contact' },
  shipping_contact_email: { path: 'shipping_contact.email', label: 'Email', section: 'Shipping Contact' },
  shipping_contact_title: { path: 'shipping_contact.title', label: 'Title', section: 'Shipping Contact' },
  shipping_address_street: { path: 'shipping_address.street', label: 'Street', section: 'Shipping Address' },
  shipping_address_city: { path: 'shipping_address.city', label: 'City', section: 'Shipping Address' },
  shipping_address_state_zip: { path: 'shipping_address.state_zip', label: 'State / Zip', section: 'Shipping Address' },
  shipping_building_name: { path: 'shipping_address.building_name', label: 'Building Name', section: 'Shipping Address' },
  accounting_payable_contact_name: {
    path: 'accounting_payable_contact.name',
    label: 'Name',
    section: 'Accounts Payable Contact',
  },
  accounting_payable_contact_phone: {
    path: 'accounting_payable_contact.phone',
    label: 'Phone',
    section: 'Accounts Payable Contact',
  },
  accounting_payable_contact_email: {
    path: 'accounting_payable_contact.email',
    label: 'Email',
    section: 'Accounts Payable Contact',
  },
  accounting_payable_contact_title: {
    path: 'accounting_payable_contact.title',
    label: 'Title',
    section: 'Accounts Payable Contact',
  },
};

const FORM_PATH_TO_SNAPSHOT_FIELD = Object.fromEntries(
  Object.entries(SNAPSHOT_FIELD_TO_FORM_PATH).map(([apiKey, value]) => [value.path, apiKey])
) as Record<string, string>;

const isArrayLikeField = (field: BackendField): boolean => {
  const t = String(field.type ?? '').toLowerCase();
  const ui = field.ui && typeof field.ui === 'object' ? (field.ui as Record<string, unknown>) : null;
  const widget = typeof ui?.widget === 'string' ? String(ui.widget).toLowerCase() : '';

  return (
    t === 'inline_form_array' ||
    widget === 'inline_form_array' ||
    widget === 'multi_select' ||
    widget === 'tags' ||
    t === 'array' ||
    t === 'list'
  );
};

export const sanitizeInitialValuesForSchema = (
  schema: BackendSchema | null,
  values: Record<string, unknown>
): Record<string, unknown> => {
  const next: Record<string, unknown> = { ...(values || {}) };
  const fields = Array.isArray(schema?.fields) ? (schema?.fields as BackendField[]) : [];

  for (const field of fields) {
    const key = String(field?.key ?? '').trim();
    if (!key) continue;
    if (!isArrayLikeField(field)) continue;

    const current = getValueAtPath(next, key);
    if (current === undefined || current === null) {
      setValueAtPath(next, key, []);
    }
  }

  return next;
};

const Container = styled.div<{ $variant: UniversalEntityFormVariant }>`
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  min-height: ${(p) => (p.$variant === 'modal' ? '520px' : 'auto')};
`;

export const normalizeEntityKey = (entityType: string): string => {
  const raw = String(entityType || '').trim();
  const lower = raw.toLowerCase();

  // Common UI paths → introspection aliases.
  if (lower === 'sales-orders' || lower === 'sales_orders') return 'sales_order';
  if (lower === 'purchase-orders' || lower === 'purchase_orders') return 'purchase_order';
  if (lower === 'carrier-pos' || lower === 'carrier_po' || lower === 'carrier_purchase_order') {
    return 'carrier-pos';
  }

  // Plural resources commonly used in UI routes.
  if (lower === 'customers' || lower === 'customer') return 'customer';
  if (lower === 'suppliers' || lower === 'supplier') return 'supplier';
  if (lower === 'plants' || lower === 'plant') return 'plant';
  if (lower === 'locations' || lower === 'location') return 'location';
  if (lower === 'contacts' || lower === 'contact') return 'contact';
  if (lower === 'products' || lower === 'product') return 'product';
  if (lower === 'invoices' || lower === 'invoice') return 'invoice';

  if (lower === 'inquiries' || lower === 'inquiry') return 'inquiries.inquiry';
  if (lower === 'claims' || lower === 'claim') return 'invoices.claim';

  // Fallback: pass through.
  return raw;
};

export const normalizeEntityEndpoint = (entityType: string): string => {
  const lower = String(entityType || '').toLowerCase();
  if (lower === 'sales-orders' || lower === 'sales_orders' || lower === 'sales_order')
    return 'sales-orders/';
  if (lower === 'purchase-orders' || lower === 'purchase_orders' || lower === 'purchase_order')
    return 'purchase-orders/';
  if (lower === 'carrier-pos' || lower === 'carrier_po' || lower === 'carrier_purchase_order')
    return 'carrier-pos/';
  if (lower === 'inquiries' || lower === 'inquiry') return 'inquiries/';

  // Accounting canonical paths (legacy aliases still exist server-side).
  if (lower === 'claims' || lower === 'claim') return 'accounting/claims/';
  if (lower === 'invoices' || lower === 'invoice') return 'accounting/invoices/';

  // Common singular → plural API resources
  if (lower === 'customer') return 'customers/';
  if (lower === 'supplier') return 'suppliers/';
  if (lower === 'plant') return 'plants/';
  if (lower === 'location') return 'locations/';
  if (lower === 'contact') return 'contacts/';
  if (lower === 'product') return 'products/';

  return `${lower.replace(/^\/+/, '').replace(/\/+$/, '')}/`;
};

const relatedEntityToEntityOptionsType = (relatedEntity: string | null | undefined, fieldKey: string): string | null => {
  const related = String(relatedEntity || '').toLowerCase();
  const key = String(fieldKey || '').toLowerCase();

  if (!related && !key) return null;

  if (related.includes('customers.') || key === 'customer') return 'customer';
  if (related.includes('suppliers.') || key === 'supplier') return 'supplier';
  if (related.includes('contacts.') || key === 'contact') return 'contact';
  if (related.includes('purchase_orders.') || key === 'purchase_order') return 'purchase_order';
  if (related.includes('sales_orders.') || key === 'sales_order') return 'sales_order';
  if (related.includes('inquiries.') || key === 'inquiry') return 'inquiry';
  if (related.includes('invoices.') || key === 'invoice') return 'invoice';
  if (key.includes('product') || related.includes('system.product')) return 'product';

  return null;
};

const shouldSkipField = (key: string): boolean => {
  const k = String(key || '').toLowerCase();
  return [
    'id',
    'uuid',
    'tenant',
    'custom_data',
    'created_at',
    'updated_at',
    'created_on',
    'updated_on',
    'modified_on',
    'created_by',
  ].includes(k);
};

const mapBackendFieldKeyToFormPath = (entityKey: string, fieldKey: string): string => {
  if (!EXTRACTABLE_ENTITY_KEYS.has(String(entityKey || '').toLowerCase())) {
    return fieldKey;
  }

  return SNAPSHOT_FIELD_TO_FORM_PATH[fieldKey]?.path || fieldKey;
};

const mapFormPathToBackendFieldKey = (entityKey: string, fieldKey: string): string => {
  if (!EXTRACTABLE_ENTITY_KEYS.has(String(entityKey || '').toLowerCase())) {
    return fieldKey;
  }

  return FORM_PATH_TO_SNAPSHOT_FIELD[fieldKey] || fieldKey;
};

const normalizeValuesForForm = (
  entityKey: string,
  values: Record<string, unknown> | null | undefined
): Record<string, unknown> => {
  const next: Record<string, unknown> = {};
  Object.entries(values || {}).forEach(([key, value]) => {
    setValueAtPath(next, mapBackendFieldKeyToFormPath(entityKey, key), value);
  });
  return next;
};

export const isPhoneNumberFieldKey = (key: string): boolean => {
  const k = String(key || '').trim().toLowerCase();
  if (!k) return false;

  // Explicit non-number phone-related fields
  if (k === 'phone_type' || k.endsWith('_phone_type') || k.endsWith('phone_type')) return false;
  if (k === 'phone_ext' || k.endsWith('_phone_ext') || k.endsWith('phone_ext')) return false;

  // Common number fields
  if (k === 'phone') return true;
  if (k.endsWith('_phone')) return true;
  if (k.includes('phone_number') || k.includes('phonenumber')) return true;

  // Contact-ish variants
  if (k === 'mobile_phone' || k === 'office_phone') return true;
  if (k.endsWith('_mobile_phone') || k.endsWith('_office_phone')) return true;

  return false;
};

export const mapDrfOptionsType = (t: string | undefined): string => {
  const type = String(t || '').toLowerCase();
  if (type.includes('boolean')) return 'checkbox';
  if (type.includes('date') && !type.includes('datetime')) return 'date';
  if (type.includes('datetime')) return 'datetime';
  if (
    type.includes('decimal') ||
    type.includes('float') ||
    type.includes('integer') ||
    type.includes('number')
  )
    return 'number';
  if (type.includes('email')) return 'email';
  if (type.includes('url')) return 'url';
  if (type.includes('choice') || type.includes('select')) return 'select';
  if (type.includes('text') || type.includes('textarea')) return 'textarea';
  return 'text';
};

type ContactFormContext = 'default' | 'shipping_loadout' | 'certification';

type ContactDepartmentKey =
  | 'sales'
  | 'qa'
  | 'shipping'
  | 'certification'
  | 'accounting'
  | 'booking';

const CONTACT_DEPARTMENT_CHOICES: SchemaChoice[] = [
  { value: 'sales', label: 'Sales' },
  { value: 'qa', label: 'QA' },
  { value: 'shipping', label: 'Shipping / Loadout' },
  { value: 'certification', label: 'Certification' },
  { value: 'accounting', label: 'Accounting' },
];

const CONTACT_PROTEIN_TYPE_CHOICES: SchemaChoice[] = [
  { value: 'Beef', label: 'Beef' },
  { value: 'Chicken', label: 'Chicken' },
  { value: 'Duck', label: 'Duck' },
  { value: 'Pork', label: 'Pork' },
  { value: 'Lamb', label: 'Lamb' },
  { value: 'Turkey', label: 'Turkey' },
  { value: 'Fish', label: 'Fish' },
  { value: 'Horse', label: 'Horse' },
  { value: 'Other', label: 'Other' },
];

const CONTACT_MASTER_DOCUMENT_OPTIONS: Array<{
  value: string;
  label: string;
  departments: ContactDepartmentKey[];
}> = [
  { value: 'Spec Sheets', label: 'Spec Sheets', departments: ['sales', 'qa', 'certification'] },
  { value: 'COAs', label: 'COAs', departments: ['sales', 'qa', 'certification'] },
  { value: 'Picture of Label', label: 'Picture of Label', departments: ['sales', 'qa', 'certification'] },
  {
    value: 'Certification Documents',
    label: 'Certification Documents',
    departments: ['sales', 'qa', 'certification'],
  },
  { value: 'LOG (Letter of Guarantee)', label: 'LOG (Letter of Guarantee)', departments: ['certification'] },
  { value: 'Plant Type of Certification', label: 'Plant Type of Certification', departments: ['certification'] },
  { value: 'Audit Reports', label: 'Audit Reports', departments: ['certification'] },
  { value: 'Animal Welfare', label: 'Animal Welfare', departments: ['certification'] },
  { value: 'Halal', label: 'Halal', departments: ['certification'] },
  { value: 'Kosher', label: 'Kosher', departments: ['certification'] },
  { value: 'BOLs', label: 'BOLs', departments: ['sales', 'shipping', 'booking', 'accounting'] },
  { value: 'Release Number', label: 'Release Number', departments: ['sales', 'shipping', 'booking', 'accounting'] },
  {
    value: 'Sales Order Confirmation',
    label: 'Sales Order Confirmation',
    departments: ['sales', 'accounting'],
  },
  { value: 'Loading Instructions', label: 'Loading Instructions', departments: ['shipping', 'booking'] },
  { value: 'Appointment Confirmations', label: 'Appointment Confirmations', departments: ['shipping', 'booking'] },
  { value: 'Statements', label: 'Statements', departments: ['accounting'] },
  { value: 'Claims', label: 'Claims', departments: ['accounting'] },
  { value: 'Credits', label: 'Credits', departments: ['accounting'] },
  { value: 'Checks', label: 'Checks', departments: ['accounting'] },
  { value: 'Bills', label: 'Bills', departments: ['accounting'] },
];

const asSchemaChoices = (value: unknown): SchemaChoice[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map<SchemaChoice | null>((item) => {
      if (typeof item === 'string') {
        const normalized = item.trim();
        return normalized ? { value: normalized, label: normalized } : null;
      }

      const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
      const optionValue = row?.value ?? row?.id ?? row?.key;
      const optionLabel = row?.label ?? row?.name ?? optionValue;
      const normalizedValue = optionValue == null ? '' : String(optionValue).trim();
      if (!normalizedValue) return null;

      return {
        value: normalizedValue,
        label: typeof optionLabel === 'string' && optionLabel.trim() ? optionLabel.trim() : normalizedValue,
      };
    })
    .filter((item): item is SchemaChoice => item !== null);
};

const dedupeChoices = (value: SchemaChoice[]): SchemaChoice[] => {
  const seen = new Set<string>();
  const normalized: SchemaChoice[] = [];

  value.forEach((choice) => {
    const key = String(choice.value ?? '').trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    normalized.push({
      value: String(choice.value ?? '').trim(),
      label: String(choice.label ?? choice.value ?? '').trim(),
    });
  });

  return normalized;
};

const mergeDropdownOptions = (
  primary: PreloadedDropdownOption[],
  secondary: PreloadedDropdownOption[] = []
): PreloadedDropdownOption[] => {
  const seen = new Set<string>();
  const merged: PreloadedDropdownOption[] = [];

  [...primary, ...secondary].forEach((option) => {
    const value = String(option.value ?? '').trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    merged.push({
      value,
      label: String(option.label ?? value).trim() || value,
      ...(option.metadata ? { metadata: option.metadata } : {}),
    });
  });

  return merged;
};

const buildContactDocumentOptionGroups = (
  additionalChoices: SchemaChoice[] = []
): Record<string, SchemaChoice[]> => {
  const byDepartment: Record<string, SchemaChoice[]> = {
    default: CONTACT_MASTER_DOCUMENT_OPTIONS.map(({ value, label }) => ({ value, label })),
    sales: CONTACT_MASTER_DOCUMENT_OPTIONS.filter((option) => option.departments.includes('sales')).map(
      ({ value, label }) => ({ value, label })
    ),
    qa: CONTACT_MASTER_DOCUMENT_OPTIONS.filter((option) => option.departments.includes('qa')).map(
      ({ value, label }) => ({ value, label })
    ),
    shipping: CONTACT_MASTER_DOCUMENT_OPTIONS.filter((option) => option.departments.includes('shipping')).map(
      ({ value, label }) => ({ value, label })
    ),
    booking: CONTACT_MASTER_DOCUMENT_OPTIONS.filter((option) => option.departments.includes('booking')).map(
      ({ value, label }) => ({ value, label })
    ),
    shipping_loadout: CONTACT_MASTER_DOCUMENT_OPTIONS.filter((option) =>
      option.departments.includes('shipping') || option.departments.includes('booking')
    ).map(({ value, label }) => ({ value, label })),
    certification: CONTACT_MASTER_DOCUMENT_OPTIONS.filter((option) =>
      option.departments.includes('certification')
    ).map(({ value, label }) => ({ value, label })),
    accounting: CONTACT_MASTER_DOCUMENT_OPTIONS.filter((option) =>
      option.departments.includes('accounting')
    ).map(({ value, label }) => ({ value, label })),
  };

  if (!additionalChoices.length) {
    return Object.fromEntries(
      Object.entries(byDepartment).map(([key, choices]) => [key, dedupeChoices(choices)])
    );
  }

  return Object.fromEntries(
    Object.entries(byDepartment).map(([key, choices]) => [
      key,
      dedupeChoices([...choices, ...additionalChoices]),
    ])
  );
};

const hasContextValue = (value: unknown): boolean => {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
};

const inferContactFormContext = (values?: Record<string, unknown> | null): ContactFormContext => {
  const rawContext = String(values?.contact_context ?? values?.contactContext ?? '').trim().toLowerCase();
  if (rawContext === 'shipping_loadout' || rawContext === 'shipping/loadout' || rawContext === 'loadout') {
    return 'shipping_loadout';
  }
  if (rawContext === 'certification') return 'certification';

  const department = String(values?.department ?? '').trim().toLowerCase();
  if (department === 'shipping' || department === 'booking') return 'shipping_loadout';
  if (department === 'certification') return 'certification';
  return 'default';
};

const getContactCreateTitle = (context: ContactFormContext) => {
  if (context === 'shipping_loadout') return 'Add Shipping / Loadout Contact';
  if (context === 'certification') return 'Add Certification Contact';
  return 'Add Contact';
};

const getShippingLoadoutTitleChoices = (values?: Record<string, unknown> | null): SchemaChoice[] => {
  const provided = asSchemaChoices(
    values?.shippingLoadoutTitleOptions ??
      values?.shipping_loadout_title_options ??
      values?.contactTitleOptions ??
      values?.contact_title_options
  );

  if (provided.length > 0) return provided;

  return [
    { value: 'Shipping Supervisor', label: 'Shipping Supervisor' },
    { value: 'Load Coordinator', label: 'Load Coordinator' },
    { value: 'Billing', label: 'Billing' },
    { value: 'Prepay / Frozen Shipping', label: 'Prepay / Frozen Shipping' },
    { value: 'DC Shipping', label: 'DC Shipping' },
  ];
};

export const augmentSchemaForFrontend = (
  entityKey: string,
  schema: BackendSchema | null,
  values?: Record<string, unknown> | null
): BackendSchema | null => {
  if (!schema) return schema;

  const normalizedEntityKey = String(entityKey || '').trim().toLowerCase();
  const fields = Array.isArray(schema.fields) ? [...schema.fields] : [];

  if (normalizedEntityKey === 'location') {
    const nextFields = fields.map((field) => {
      if (String(field.key).toLowerCase() !== 'booking_contacts') return field;

      const ui = field.ui && typeof field.ui === 'object' ? { ...(field.ui as Record<string, unknown>) } : {};
      ui.add_button_label = 'Add Shipping / Loadout Contact';
      ui.item_label = 'Shipping / Loadout Contact';

      return {
        ...field,
        label: 'Shipping / Loadout',
        ui,
      };
    });

    return {
      ...schema,
      fields: nextFields,
    };
  }

  if (normalizedEntityKey === 'plant') {
    const withField = (
      list: BackendField[],
      key: string,
      build: (existing?: BackendField) => BackendField
    ) => {
      const index = list.findIndex((field) => String(field.key).toLowerCase() === key.toLowerCase());
      const existing = index >= 0 ? list[index] : undefined;
      const nextField = build(existing);

      if (index >= 0) {
        list[index] = nextField;
      } else {
        list.push(nextField);
      }
    };

    const locationSection = { title: 'Plant Location' };
    const exportSection = { title: 'Export' };

    const nextFields = fields.map((field) => {
      const key = String(field.key || '').toLowerCase();

      if (key === 'booking_contacts') {
        const ui = field.ui && typeof field.ui === 'object' ? { ...(field.ui as Record<string, unknown>) } : {};
        ui.add_button_label = 'Add Shipping / Loadout Contact';
        ui.item_label = 'Shipping / Loadout Contact';

        return {
          ...field,
          label: 'Shipping / Loadout',
          ui,
        };
      }

      if (key === 'name') {
        const ui = field.ui && typeof field.ui === 'object' ? { ...(field.ui as Record<string, unknown>) } : {};
        ui.max_length = 150;
        return {
          ...field,
          label: 'Plant Name',
          required: true,
          placeholder: field.placeholder || 'Enter plant name',
          ui,
        };
      }

      if (key === 'plant_est_num') {
        const ui = field.ui && typeof field.ui === 'object' ? { ...(field.ui as Record<string, unknown>) } : {};
        ui.max_length = 50;
        return {
          ...field,
          label: 'Establishment #',
          required: true,
          placeholder: field.placeholder || 'Enter establishment number',
          ui,
        };
      }

      if (key === 'plant_type') {
        return {
          ...field,
          label: field.label || 'Plant Type',
          required: true,
          placeholder: field.placeholder || 'Select plant type',
        };
      }

      if (['address', 'city', 'state', 'zip_code', 'country'].includes(key)) {
        const ui = field.ui && typeof field.ui === 'object' ? { ...(field.ui as Record<string, unknown>) } : {};
        ui.section = locationSection;
        return {
          ...field,
          ui,
        };
      }

      return field;
    });

    withField(nextFields, 'proteins_offered', (existing) => ({
      ...(existing || { key: 'proteins_offered' }),
      label: 'Protein Types Offered',
      type: 'select',
      required: Boolean(existing?.required),
      placeholder: existing?.placeholder || 'Select protein types offered',
      help_text: existing?.help_text || '',
      choices: existing?.choices || [],
      ui: {
        ...((existing?.ui as Record<string, unknown> | null) || {}),
        widget: 'multi_select',
        data_source: {
          type: 'choice_list',
          list: 'protein_types',
        },
      },
    }));

    withField(nextFields, 'proteins_tested', (existing) => ({
      ...(existing || { key: 'proteins_tested' }),
      label: 'Protein Tested (COA)',
      type: 'select',
      required: Boolean(existing?.required),
      placeholder: existing?.placeholder || 'Select protein types tested',
      help_text: existing?.help_text || 'Warning: proteins tested should typically be a subset of proteins offered.',
      choices: existing?.choices || [],
      dependencies: ['proteins_offered'],
      ui: {
        ...((existing?.ui as Record<string, unknown> | null) || {}),
        widget: 'multi_select',
        data_source: {
          type: 'choice_list',
          list: 'protein_types',
        },
      },
    }));

    withField(nextFields, 'associated_master_product_ids', (existing) => ({
      ...(existing || { key: 'associated_master_product_ids' }),
      label: 'Product List',
      type: 'select',
      required: Boolean(existing?.required),
      placeholder: existing?.placeholder || 'Search and select products',
      help_text: existing?.help_text || 'Master products commonly sold/produced by this plant.',
      choices: existing?.choices || [],
      ui: {
        ...((existing?.ui as Record<string, unknown> | null) || {}),
        widget: 'multi_select',
        data_source: {
          type: 'master_products',
        },
      },
    }));

    withField(nextFields, 'export_approved', (existing) => ({
      ...(existing || { key: 'export_approved' }),
      label: 'Export Approved',
      type: existing?.type || 'checkbox',
      required: Boolean(existing?.required),
      help_text: existing?.help_text || 'Whether this plant is export approved.',
      ui: {
        ...((existing?.ui as Record<string, unknown> | null) || {}),
        section: exportSection,
      },
    }));

    withField(nextFields, 'export_documents_handled', (existing) => ({
      ...(existing || { key: 'export_documents_handled' }),
      label: 'Export Documents Handled',
      type: 'select',
      required: Boolean(existing?.required),
      placeholder: existing?.placeholder || 'Add export documents handled',
      help_text: existing?.help_text || 'Shown only when Export Approved is enabled.',
      choices: existing?.choices || [],
      dependencies: ['export_approved'],
      ui: {
        ...((existing?.ui as Record<string, unknown> | null) || {}),
        section: exportSection,
        widget: 'tags',
        visible_when: {
          field: 'export_approved',
          equals: true,
        },
      },
    }));

    const keyFieldsPlant = [
      'name',
      'plant_est_num',
      'plant_type',
      'address',
      'city',
      'state',
      'zip_code',
      'country',
      'proteins_offered',
      'proteins_tested',
      'associated_master_product_ids',
      'export_approved',
      'export_documents_handled',
    ];

    return {
      ...schema,
      name: schema.name || 'Plant',
      key_fields: schema.key_fields && schema.key_fields.length ? schema.key_fields : keyFieldsPlant,
      fields: nextFields,
    };
  }

  if (normalizedEntityKey === 'supplier' || normalizedEntityKey === 'customer') {
    const fieldsByLowerKey = new Map<string, BackendField>();
    fields.forEach((field) => {
      const key = String(field?.key || '').trim().toLowerCase();
      if (key) fieldsByLowerKey.set(key, field);
    });

    const pickFieldKey = (candidates: string[]): string | null => {
      for (const raw of candidates) {
        const key = String(raw || '').trim().toLowerCase();
        if (key && fieldsByLowerKey.has(key)) return key;
      }
      return null;
    };

    const selectedKeys = [
      pickFieldKey(['name', 'company_name']),
      // Supplier/customer phone keys vary across environments. Prefer office phone when present.
      pickFieldKey(['phone_office', 'phone', 'phone_number', 'office_phone', 'mobile_phone', 'phone_mobile']),
      pickFieldKey(['address', 'street_address']),
      pickFieldKey(['city']),
      pickFieldKey(['state']),
      pickFieldKey(['zip_code', 'postal_code']),
      pickFieldKey(['country']),
    ].filter((k): k is string => Boolean(k));

    // Ensure HQ Phone Number is always present for Supplier/Customer HQ forms.
    // Some environments may omit phone fields from the schema endpoint; we still want the UX to show it.
    const ensuredKeys = [...selectedKeys];
    const hasPhoneField = ensuredKeys.some((k) => {
      const key = String(k || '').toLowerCase();
      return [
        'phone',
        'phone_number',
        'phone_office',
        'office_phone',
        'phone_mobile',
        'mobile_phone',
      ].includes(key);
    });

    if (!hasPhoneField) {
      const syntheticKey = 'phone_office';
      if (!fieldsByLowerKey.has(syntheticKey)) {
        fieldsByLowerKey.set(syntheticKey, {
          key: syntheticKey,
          label: 'HQ Phone Number',
          type: 'phone',
          required: false,
          help_text: '',
        });
      }
      ensuredKeys.push(syntheticKey);
    }

    const labelByKey: Record<string, string> = {
      phone: 'HQ Phone Number',
      phone_number: 'HQ Phone Number',
      phone_office: 'HQ Phone Number',
      office_phone: 'HQ Phone Number',
      phone_mobile: 'HQ Phone Number',
      mobile_phone: 'HQ Phone Number',
      address: 'HQ Address',
      street_address: 'HQ Address',
      city: 'HQ City',
      state: 'HQ State',
      zip_code: 'HQ Zip Code',
      postal_code: 'HQ Zip Code',
      country: 'HQ Country',
    };

    const uniqueSelectedKeys = ensuredKeys.filter((key, idx, arr) => arr.indexOf(key) === idx);

    const nextFields: BackendField[] = [];
    uniqueSelectedKeys.forEach((key) => {
      const field = fieldsByLowerKey.get(key);
      if (!field) return;

      const label = labelByKey[key] || field.label;
      const isHqPhone =
        key === 'phone' ||
        key === 'phone_number' ||
        key === 'phone_office' ||
        key === 'office_phone' ||
        key === 'phone_mobile' ||
        key === 'mobile_phone';

      const placeholder =
        field.placeholder ||
        (isHqPhone
          ? 'Enter HQ phone number'
          : key === 'address' || key === 'street_address'
            ? 'Enter HQ address'
            : null);

      const typeOverride =
        isHqPhone
          ? 'phone'
          : key === 'address' || key === 'street_address'
            ? 'text'
            : field.type;

      nextFields.push({
        ...field,
        label,
        type: typeOverride,
        required: key === 'name' ? true : field.required,
        placeholder,
      });
    });

    const keyFieldsHQ = uniqueSelectedKeys;

    return {
      ...schema,
      key_fields: keyFieldsHQ,
      fields: nextFields,
    };
  }

  if (normalizedEntityKey !== 'contact') return schema;

  const context = inferContactFormContext(values);
  const isDepartmentScopedContact = hasContextValue(values?.plant) || hasContextValue(values?.location);
  const scopedContactTypeLabel =
    hasContextValue(values?.location) && !hasContextValue(values?.plant)
      ? 'Location Contact Type'
      : 'Plant Contact Type';
  const shippingTitleChoices = getShippingLoadoutTitleChoices(values);
  const providedDocumentChoices = asSchemaChoices(values?.documentsResponsibleOptions);
  const documentOptionGroups = buildContactDocumentOptionGroups(providedDocumentChoices);

  const withField = (
    list: BackendField[],
    key: string,
    build: (existing?: BackendField) => BackendField
  ) => {
    const index = list.findIndex((field) => String(field.key).toLowerCase() === key.toLowerCase());
    const existing = index >= 0 ? list[index] : undefined;
    const nextField = build(existing);

    if (index >= 0) {
      list[index] = nextField;
    } else {
      list.push(nextField);
    }
  };

  const nextFields = [...fields]
    .filter((field) => {
      const key = String(field.key || '').toLowerCase();
      if (!isDepartmentScopedContact) return true;
      return key !== 'contact_type' && key !== 'position';
    })
    .map((field) => {
      const key = String(field.key || '').toLowerCase();
      if (key !== 'department') return field;

      const currentDept = String(values?.department ?? '').trim().toLowerCase();

      const choices = [
        ...CONTACT_DEPARTMENT_CHOICES,
        ...(currentDept === 'booking'
          ? [{ value: 'booking', label: 'Shipping / Loadout (Legacy)' }]
          : []),
      ];

      return {
        ...field,
        label: isDepartmentScopedContact ? scopedContactTypeLabel : field.label,
        required: isDepartmentScopedContact ? true : field.required,
        placeholder:
          isDepartmentScopedContact
            ? field.placeholder || `Select ${scopedContactTypeLabel.toLowerCase()}`
            : field.placeholder,
        help_text:
          isDepartmentScopedContact
            ? 'Department this contact belongs to'
            : field.help_text,
        choices,
      };
    });

  if (isDepartmentScopedContact) {
    withField(nextFields, 'shipping_loadout_title', (existing) => ({
      ...(existing || { key: 'shipping_loadout_title' }),
      api_key: 'position',
      label: 'Title',
      type: 'select',
      required: Boolean(existing?.required),
      placeholder: 'Select a shipping / loadout title',
      help_text:
        existing?.help_text ||
        'Shown for Shipping / Loadout contacts.',
      choices: shippingTitleChoices,
      ui: {
        ...((existing?.ui as Record<string, unknown> | null) || {}),
        widget: 'select',
        visible_when: {
          field: 'department',
          equals: 'shipping',
        },
      },
    }));

    withField(nextFields, 'legacy_shipping_loadout_title', (existing) => ({
      ...(existing || { key: 'legacy_shipping_loadout_title' }),
      api_key: 'position',
      label: 'Title',
      type: 'select',
      required: Boolean(existing?.required),
      placeholder: 'Select a shipping / loadout title',
      help_text:
        existing?.help_text ||
        'Shown only for legacy Booking contacts.',
      choices: shippingTitleChoices,
      ui: {
        ...((existing?.ui as Record<string, unknown> | null) || {}),
        widget: 'select',
        visible_when: {
          field: 'department',
          equals: 'booking',
        },
      },
    }));
  } else if (context === 'shipping_loadout') {
    withField(nextFields, 'position', (existing) => ({
      ...(existing || { key: 'position' }),
      label: 'Title',
      type: 'select',
      required: Boolean(existing?.required),
      placeholder: 'Select a title',
      help_text:
        shippingTitleChoices.length > 0
          ? existing?.help_text || ''
          : 'Title options can be provided via contactTitleOptions / shippingLoadoutTitleOptions.',
      choices: shippingTitleChoices,
      ui: {
        ...((existing?.ui as Record<string, unknown> | null) || {}),
        widget: 'select',
      },
    }));
  }

  withField(nextFields, 'protein_types_responsible', (existing) => ({
    ...(existing || { key: 'protein_types_responsible' }),
    label: 'Protein Types Responsible For',
    type: 'select',
    required: Boolean(existing?.required),
    placeholder: 'Select protein types',
    help_text: existing?.help_text || '',
    choices: existing?.choices?.length ? existing.choices : CONTACT_PROTEIN_TYPE_CHOICES,
    ui: {
      ...((existing?.ui as Record<string, unknown> | null) || {}),
      widget: 'multi_select',
      data_source: {
        type: 'choice_list',
        list: 'protein_types',
      },
      ...(isDepartmentScopedContact
        ? {
            visible_when: {
              field: 'department',
              in: ['sales', 'qa'],
            },
          }
        : {}),
    },
  }));

  withField(nextFields, 'items_responsible', (existing) => ({
    ...(existing || { key: 'items_responsible' }),
    label: 'Items Responsible For',
    type: 'select',
    required: Boolean(existing?.required),
    placeholder: 'Select items',
    help_text: existing?.help_text || '',
    choices: existing?.choices || [],
    dependencies: ['protein_types_responsible'],
    ui: {
      ...((existing?.ui as Record<string, unknown> | null) || {}),
      widget: 'multi_select',
      data_source: {
        type: 'master_products',
      },
      ...(isDepartmentScopedContact
        ? {
            visible_when: {
              field: 'department',
              in: ['sales', 'qa'],
            },
          }
        : {}),
    },
  }));

  withField(nextFields, 'documents_responsible_for', (existing) => ({
    ...(existing || { key: 'documents_responsible_for' }),
    label: 'Documents Responsible For',
    type: 'select',
    required: Boolean(existing?.required),
    placeholder: 'Select documents',
    help_text: existing?.help_text || '',
    choices: [],
    dependencies: ['department'],
    ui: {
      ...((existing?.ui as Record<string, unknown> | null) || {}),
      widget: 'multi_select',
      ...(isDepartmentScopedContact
        ? {
            visible_when: {
              field: 'department',
              truthy: true,
            },
          }
        : {}),
      option_groups: {
        default: documentOptionGroups.default,
        sales: documentOptionGroups.sales,
        shipping: documentOptionGroups.shipping,
        booking: documentOptionGroups.booking,
        qa: documentOptionGroups.qa,
        accounting: documentOptionGroups.accounting,
        shipping_loadout: documentOptionGroups.shipping_loadout,
        certification: documentOptionGroups.certification,
      },
    },
  }));

  withField(nextFields, 'notes', (existing) => ({
    ...(existing || { key: 'notes' }),
    label: 'Notes',
    type: 'textarea',
    required: Boolean(existing?.required),
    placeholder: 'Add notes',
    help_text: existing?.help_text || '',
    ui: {
      ...((existing?.ui as Record<string, unknown> | null) || {}),
      widget: 'textarea',
    },
  }));

  const prioritizedKeyFields = isDepartmentScopedContact
    ? [
        'department',
        'first_name',
        'last_name',
        'email',
        'mobile_phone',
        'office_phone',
        'office_phone_ext',
        'shipping_loadout_title',
        'legacy_shipping_loadout_title',
        'protein_types_responsible',
        'items_responsible',
        'documents_responsible_for',
        'notes',
      ]
    : context === 'shipping_loadout'
      ? ['position', 'first_name', 'last_name', 'email', 'mobile_phone', 'office_phone', 'office_phone_ext', 'department', 'protein_types_responsible', 'items_responsible', 'documents_responsible_for', 'notes']
      : ['first_name', 'last_name', 'email', 'mobile_phone', 'office_phone', 'office_phone_ext', 'department', 'protein_types_responsible', 'items_responsible', 'documents_responsible_for', 'notes'];

  return {
    ...schema,
    name: schema.name || 'Contact',
    key_fields: prioritizedKeyFields,
    fields: nextFields,
  };
};

export const fetchUniversalEntitySchema = async (
  entityType: string,
  endpoint = normalizeEntityEndpoint(entityType),
  schemaEntityKey = normalizeEntityKey(entityType)
): Promise<BackendSchema | null> => {
  try {
    const resp = await businessApi.get('/system/forms/schema/', {
      params: { entity_type: schemaEntityKey },
    });
    return (resp.data ?? null) as BackendSchema | null;
  } catch {
    const resp = await businessApi.options(endpoint);
    const data = resp.data as unknown;
    const actions =
      data && typeof data === 'object' && 'actions' in data
        ? ((data as Record<string, unknown>).actions as Record<string, unknown> | undefined)
        : undefined;
    const postFields =
      (actions && 'POST' in actions ? (actions.POST as Record<string, unknown>) : {}) || {};

    const fields: BackendField[] = Object.entries(postFields).map(([key, meta]) => {
      const metaObj =
        (meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {}) || {};
      const choicesRaw = metaObj.choices;
      const choices = Array.isArray(choicesRaw)
        ? choicesRaw.map((choiceItem: unknown) => {
            const choice =
              (choiceItem && typeof choiceItem === 'object'
                ? (choiceItem as Record<string, unknown>)
                : {}) || {};
            const value = choice.value;
            const label =
              (typeof choice.display_name === 'string' && choice.display_name) ||
              (value != null ? String(value) : '');

            return { value, label };
          })
        : null;

      const rawType = typeof metaObj.type === 'string' ? metaObj.type : undefined;
      const lowerKey = String(key || '').toLowerCase();
      const inferredType = isPhoneNumberFieldKey(lowerKey)
        ? 'phone'
        : lowerKey.includes('email')
          ? 'email'
          : mapDrfOptionsType(rawType);

      return {
        key,
        label: (typeof metaObj.label === 'string' && metaObj.label) || key,
        type: inferredType,
        required: Boolean(metaObj.required),
        help_text: (typeof metaObj.help_text === 'string' && metaObj.help_text) || '',
        choices,
      };
    });

    return {
      name: schemaEntityKey === 'contact' ? 'Contact' : `Universal Form: ${entityType}`,
      description: 'Auto-derived from OPTIONS.',
      fields,
    };
  }
};

export const fetchUniversalEntityRecord = async (
  entityType: string,
  entityId: string | number
): Promise<Record<string, unknown> | null> => {
  const endpoint = normalizeEntityEndpoint(entityType);
  const resp = await businessApi.get(`${endpoint}${entityId}/`);
  const data = resp.data as unknown;

  return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
};

export const fetchUniversalEntityFkOptions = async (
  field: BackendField
): Promise<Array<{ id: string | number; name: string }>> => {
  const related = String(field.related_entity || '').toLowerCase();
  if (
    !related ||
    related.includes('system.product') ||
    String(field.key).toLowerCase().includes('product')
  ) {
    return [];
  }

  const relatedEndpoint = related.includes('customers.')
    ? 'customers/'
    : related.includes('suppliers.')
      ? 'suppliers/'
      : related.includes('contacts.')
        ? 'contacts/'
        : null;

  if (!relatedEndpoint) {
    return [];
  }

  const resp = await businessApi.get(relatedEndpoint, { params: { page_size: 200 } });
  const payload = resp.data as unknown;
  const payloadObj =
    typeof payload === 'object' && payload ? (payload as Record<string, unknown>) : null;
  const rows = Array.isArray(payloadObj?.results) ? payloadObj.results : payload;

  return (Array.isArray(rows) ? rows : []).map((rowValue: unknown) => {
    const row =
      (rowValue && typeof rowValue === 'object'
        ? (rowValue as Record<string, unknown>)
        : {}) || {};

    return {
      id: (row.id as string | number | undefined) ?? '',
      name:
        (typeof row.name === 'string' && row.name) ||
        (typeof row.company_name === 'string' && row.company_name) ||
        (typeof row.full_name === 'string' && row.full_name) ||
        (typeof row.email === 'string' && row.email) ||
        String(row.id ?? ''),
    };
  });
};

const prepareFormResources = (
  entityKey: string,
  schema: BackendSchema | null,
  values: Record<string, unknown> | null | undefined
): { schema: BackendSchema | null; values: Record<string, unknown> } => {
  const normalizedValues = normalizeValuesForForm(entityKey, values);
  const preparedSchema = augmentSchemaForFrontend(entityKey, schema, normalizedValues);
  return {
    schema: preparedSchema,
    values: sanitizeInitialValuesForSchema(preparedSchema, normalizedValues),
  };
};

const AutofillToolbar: React.FC<NonNullable<UniversalEntityFormProps['autofill']>> = ({
  documents,
  selectedDocumentId,
  loadingDocuments = false,
  extracting = false,
  disabled = false,
  onDocumentChange,
  onExtract,
  onUpload,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        padding: 12,
        border: '1px solid rgb(var(--color-border))',
        borderRadius: 8,
        background: 'rgb(var(--color-surface))',
      }}
    >
      <Select
        style={{ minWidth: 260, flex: '1 1 260px' }}
        placeholder="Select AI document"
        value={selectedDocumentId || undefined}
        onChange={(value) => onDocumentChange(String(value))}
        options={documents.map((document) => ({
          value: document.id,
          label: document.original_filename,
        }))}
        loading={loadingDocuments}
        disabled={disabled || extracting}
      />
      <Button onClick={() => onExtract()} disabled={disabled || extracting || !selectedDocumentId}>
        {extracting ? 'Autofilling…' : 'Autofill from document'}
      </Button>
      <Button onClick={() => fileInputRef.current?.click()} disabled={disabled || extracting}>
        Upload & Autofill
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".pdf,.txt,.csv,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onUpload(file);
          }
          event.target.value = '';
        }}
      />
    </div>
  );
};

export const UniversalEntityForm: React.FC<UniversalEntityFormProps> = ({
  entityType,
  entityId,
  mode,
  variant = 'modal',
  isOpen,
  onClose,
  onSuccess,
  initialValues,
  initialData,
  schema: legacySchema,
  dropdownOptions = {},
  formConfig,
  loading: legacyLoading,
  loadError: legacyLoadError,
  onSubmit,
  keyFields,
  allowModeSwitch,
  autofill,
  externalSchema,
  externalRecordValues,
  externalLoading,
  externalLoadError,
  externalFkOptions,
  onSubmittingChange,
  onValuesChange,
}) => {
  const { isAuthenticated, loading: authLoading } = useAuthState();
  const stableInitialValues = useDeepStableValue(initialValues);
  const stableLegacyInitialData = useDeepStableValue(initialData);
  const stableInitialValuesSignature = useMemo(
    () => getStableSignature(stableInitialValues ?? EMPTY_FORM_VALUES),
    [stableInitialValues]
  );
  const hasLegacyFormResources =
    legacySchema !== undefined ||
    stableLegacyInitialData !== undefined ||
    legacyLoading !== undefined ||
    legacyLoadError !== undefined;
  const preparedLegacyResources = useMemo(
    () =>
      hasLegacyFormResources
        ? prepareFormResources(
            normalizeEntityKey(entityType),
            legacySchema ?? null,
            stableLegacyInitialData ?? EMPTY_FORM_VALUES
          )
        : null,
    [entityType, hasLegacyFormResources, legacySchema, stableLegacyInitialData]
  );
  const effectiveExternalSchema =
    externalSchema !== undefined ? externalSchema : preparedLegacyResources?.schema;
  const effectiveExternalRecordValues =
    externalRecordValues !== undefined ? externalRecordValues : preparedLegacyResources?.values;
  const effectiveExternalLoading =
    externalLoading !== undefined ? externalLoading : Boolean(legacyLoading);
  const effectiveExternalLoadError =
    externalLoadError !== undefined ? externalLoadError : legacyLoadError ?? null;
  const hasExternalFormResources =
    externalSchema !== undefined ||
    externalRecordValues !== undefined ||
    externalLoading !== undefined ||
    externalLoadError !== undefined ||
    hasLegacyFormResources;
  const initialResolvedValues = useMemo(
    () =>
      sanitizeInitialValuesForSchema(effectiveExternalSchema ?? null, {
        ...(effectiveExternalRecordValues || {}),
        ...((stableInitialValues as Record<string, unknown> | undefined) || {}),
      }),
    [effectiveExternalRecordValues, effectiveExternalSchema, stableInitialValues]
  );

   const [loading, setLoading] = useState(effectiveExternalLoading);
  const [loadError, setLoadError] = useState<unknown | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [schema, setSchema] = useState<BackendSchema | null>(null);
  const [, setRecordValues] = useState<Record<string, unknown> | null>(null);

  const initialValuesRef = useRef<Record<string, unknown> | undefined>(stableInitialValues);
  const [resolvedInitialValues, setResolvedInitialValues] = useState<Record<string, unknown>>(
    initialResolvedValues
  );
  const lastLoadSignatureRef = useRef<string | null>(null);
  const lastFkSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (hasExternalFormResources) return;
    if (!isOpen) return;
    initialValuesRef.current = stableInitialValues;
  }, [hasExternalFormResources, isOpen, stableInitialValues]);

  useEffect(() => {
    if (!isOpen) {
      lastLoadSignatureRef.current = null;
      lastFkSignatureRef.current = null;
    }
  }, [isOpen]);

  const inferredMode: UniversalEntityFormMode = useMemo(() => {
    const hasId = entityId != null && String(entityId).trim().length > 0;

    if (mode === 'clone') return hasId ? 'clone' : 'create';
    if (mode) return mode;

    return hasId ? 'edit' : 'create';
  }, [entityId, mode]);

  const canSwitchModes = allowModeSwitch ?? inferredMode === 'view';
  const [activeMode, setActiveMode] = useState<UniversalEntityFormMode>(inferredMode);

  const [fkValues, setFkValues] = useState<Record<string, unknown>>({});
  const [fkOptions, setFkOptions] = useState<
    Record<string, Array<{ id: string | number; name: string }>>
  >({});
  const [productOptions, setProductOptions] = useState<
    Record<string, Array<{ value: string; label: string }>>
  >({});
  const [asyncDropdownOptions, setAsyncDropdownOptions] = useState<
    Record<string, PreloadedDropdownOption[]>
  >({});
  const [loadingProducts, setLoadingProducts] = useState<Record<string, boolean>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const productSearchSeqRef = useRef<Record<string, number>>({});

  useEffect(() => {
    onSubmittingChange?.(submitting);

    return () => {
      onSubmittingChange?.(false);
    };
  }, [onSubmittingChange, submitting]);

  useEffect(() => {
    if (!isOpen) {
      setAsyncDropdownOptions({});
    }
  }, [isOpen]);

  const schemaEntityKey = useMemo(() => normalizeEntityKey(entityType), [entityType]);
  const endpoint = useMemo(() => normalizeEntityEndpoint(entityType), [entityType]);
  const stableResolvedInitialValues = useDeepStableValue(resolvedInitialValues);
  const resolvedSchema = hasExternalFormResources ? effectiveExternalSchema ?? null : schema;
  const resolvedLoading = hasExternalFormResources ? effectiveExternalLoading : loading;
  const resolvedLoadError = hasExternalFormResources ? effectiveExternalLoadError : loadError;
  const resolvedFormInitialValues = hasExternalFormResources
    ? initialResolvedValues
    : stableResolvedInitialValues;
  const resolvedFkOptions = externalFkOptions ?? fkOptions;
  const mergedDropdownOptions = useMemo(() => {
    const allKeys = new Set([
      ...Object.keys(asyncDropdownOptions),
      ...Object.keys(dropdownOptions),
    ]);
    const next: Record<string, PreloadedDropdownOption[]> = {};

    allKeys.forEach((key) => {
      next[key] = mergeDropdownOptions(dropdownOptions[key] || [], asyncDropdownOptions[key] || []);
    });

    return next;
  }, [asyncDropdownOptions, dropdownOptions]);

  const getSelectPopupContainer = useCallback((triggerNode: HTMLElement) => {
    return getDefaultSelectPopupContainer(triggerNode);
  }, []);

  const setSchemaIfChanged = useCallback((next: BackendSchema | null) => {
    setSchema((prev) => (isEqual(prev, next) ? prev : next));
  }, []);

  const setRecordValuesIfChanged = useCallback((next: Record<string, unknown> | null) => {
    setRecordValues((prev) => (isEqual(prev, next) ? prev : next));
  }, []);

  const setResolvedInitialValuesIfChanged = useCallback((next: Record<string, unknown>) => {
    setResolvedInitialValues((prev) => (isEqual(prev, next) ? prev : next));
  }, []);

  const loadSchema = useCallback(() => {
    return fetchUniversalEntitySchema(entityType, endpoint, schemaEntityKey);
  }, [endpoint, entityType, schemaEntityKey]);

  const loadSignature = useMemo(
    () =>
      getStableSignature({
        endpoint,
        entityId: entityId == null ? '' : String(entityId),
        inferredMode,
        schemaEntityKey,
        initialValues: stableInitialValuesSignature,
      }),
    [endpoint, entityId, inferredMode, schemaEntityKey, stableInitialValuesSignature]
  );

  useEffect(() => {
    if (hasExternalFormResources) return;
    if (!isOpen) return;

    setLoadError(null);
    setShowAdvanced(false);
    setActiveMode(inferredMode);
    setRecordValuesIfChanged(null);

    const initialSnapshot = (initialValuesRef.current || EMPTY_FORM_VALUES) as Record<string, unknown>;
    setResolvedInitialValuesIfChanged(initialSnapshot);
    setFkValues({});

    // Wait for auth initialization to settle before attempting any protected calls.
    if (authLoading) {
      setLoading(true);
      return;
    }

    // If no token credentials exist, do NOT attempt network calls. This prevents
    // a 401→state update→re-render→retry loop that can trigger React error #185.
    if (!isAuthenticated) {
      setSchemaIfChanged(null);
      setRecordValuesIfChanged(null);
      setLoading(false);
      setLoadError({ response: { status: 401 } });

      // Best-effort redirect matching the global interceptor behavior.
      if (typeof window !== 'undefined') {
        const currentPath = `${window.location.pathname}${window.location.search}`;
        if (!currentPath.startsWith('/login')) {
          try {
            localStorage.setItem('redirectAfterLogin', currentPath);
          } catch {
            // best-effort
          }

          try {
            window.location.assign('/login');
          } catch {
            // JSDOM/tests may throw on navigation.
          }
        }
      }

      return;
    }

    if (lastLoadSignatureRef.current === loadSignature) {
      return;
    }

    lastLoadSignatureRef.current = loadSignature;

    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const nextSchema = await loadSchema();

        const shouldLoadRecord =
          inferredMode !== 'create' && entityId != null && String(entityId).trim().length > 0;

        let nextRecord: Record<string, unknown> | null = null;
        if (shouldLoadRecord) {
          nextRecord = await fetchUniversalEntityRecord(entityType, entityId);
        }

        if (!mounted) return;
        const merged: Record<string, unknown> = { ...(nextRecord || {}), ...initialSnapshot };
        const sanitized = sanitizeInitialValuesForSchema(nextSchema, merged);
        setSchemaIfChanged(augmentSchemaForFrontend(schemaEntityKey, nextSchema, sanitized));
        setRecordValuesIfChanged(nextRecord);
        setResolvedInitialValuesIfChanged(sanitized);
        setFkValues({});
      } catch (err: unknown) {
        if (!mounted) return;
        setLoadError(err);
        setSchemaIfChanged(null);
        setRecordValuesIfChanged(null);
        setResolvedInitialValuesIfChanged(initialSnapshot);
        setFkValues({});

        const status = (err as any)?.response?.status;
        const errorMessage =
          typeof (err as { response?: { data?: { error?: string } } })?.response?.data?.error ===
          'string'
            ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
            : 'Failed to load form';

        // Avoid toast spam for auth failures; the global interceptor will redirect.
        if (status !== 401 && status !== 403) {
          message.error(errorMessage);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [
    authLoading,
    hasExternalFormResources,
    endpoint,
    entityId,
    entityType,
    inferredMode,
    isAuthenticated,
    isOpen,
    loadSignature,
    loadSchema,
    schemaEntityKey,
    setRecordValuesIfChanged,
    setResolvedInitialValuesIfChanged,
    setSchemaIfChanged,
  ]);

  const fkLoadSignature = useMemo(() => {
    const fkFields = (resolvedSchema?.fields ?? [])
      .filter((field) => !shouldSkipField(field.key) && Boolean(field.related_entity))
      .map((field) => ({
        key: field.key,
        related_entity: field.related_entity,
      }));

    return getStableSignature(fkFields);
  }, [resolvedSchema?.fields]);

  // Load basic FK option lists (best-effort) for non-product references.
  useEffect(() => {
    if (externalFkOptions !== undefined) return;
    if (!isOpen || !resolvedSchema?.fields?.length) return;

    if (lastFkSignatureRef.current === fkLoadSignature) {
      return;
    }

    lastFkSignatureRef.current = fkLoadSignature;

    const fkFields = resolvedSchema.fields.filter(
      (f) => !shouldSkipField(f.key) && Boolean(f.related_entity)
    );
    if (!fkFields.length) return;

    let cancelled = false;

    const loadFk = async () => {
      for (const f of fkFields) {
        try {
          const options = await fetchUniversalEntityFkOptions(f);
          if (!options.length) continue;

          if (cancelled) return;
          setFkOptions((prev) => {
            if (isEqual(prev[f.key], options)) {
              return prev;
            }

            return { ...prev, [f.key]: options };
          });
        } catch {
          // ignore
        }
      }
    };

    void loadFk();

    return () => {
      cancelled = true;
    };
  }, [externalFkOptions, fkLoadSignature, isOpen, resolvedSchema?.fields]);

  useEffect(() => {
    if (!isOpen || !resolvedSchema?.fields?.length) return;

    const masterProductFieldKeys = resolvedSchema.fields
      .filter((field) => {
        const ui = field.ui && typeof field.ui === 'object' ? (field.ui as Record<string, unknown>) : null;
        const dataSource =
          ui?.data_source && typeof ui.data_source === 'object'
            ? (ui.data_source as Record<string, unknown>)
            : null;

        return (
          !field.related_entity &&
          String(field.type || '').toLowerCase() === 'select' &&
          String(ui?.widget || '').toLowerCase() === 'multi_select' &&
          String(dataSource?.type || '').toLowerCase() === 'master_products' &&
          !dropdownOptions[String(field.key)]?.length
        );
      })
      .map((field) => String(field.key));

    if (!masterProductFieldKeys.length) return;

    let cancelled = false;

    const loadMasterProductOptions = async () => {
      try {
        const response = await businessApi.get('/master-products/', {
          params: { page_size: 5000, limit: 5000, is_active: true },
        });
        if (cancelled) return;

        const payload = response.data as unknown;
        const payloadObj =
          typeof payload === 'object' && payload ? (payload as Record<string, unknown>) : null;
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payloadObj?.results)
            ? payloadObj.results
            : [];

        const baseOptions = mergeDropdownOptions(
          (Array.isArray(rows) ? rows : []).map((rowValue) => {
            const row =
              rowValue && typeof rowValue === 'object'
                ? (rowValue as Record<string, unknown>)
                : {};
            const displayName = String(
              row.display_name ?? row.item_name ?? row.name ?? row.id ?? ''
            ).trim();
            const protein = String(row.protein ?? '').trim();

            return {
              value: displayName,
              label: displayName,
              metadata: protein ? { protein_types: [protein] } : undefined,
            };
          })
        );

        setAsyncDropdownOptions((prev) => {
          const next = { ...prev };
          let changed = false;

          masterProductFieldKeys.forEach((fieldKey) => {
            const selectedValues = getValueAtPath(resolvedFormInitialValues, fieldKey);
            const selectedOptions = Array.isArray(selectedValues)
              ? selectedValues
                  .map((item) => String(item ?? '').trim())
                  .filter(Boolean)
                  .map((item) => ({ value: item, label: item }))
              : [];
            const mergedOptions = mergeDropdownOptions(selectedOptions, baseOptions);

            if (!isEqual(prev[fieldKey], mergedOptions)) {
              next[fieldKey] = mergedOptions;
              changed = true;
            }
          });

          return changed ? next : prev;
        });
      } catch (error) {
        console.error('[UniversalEntityForm] Failed to load master product dropdown options:', error);
      }
    };

    void loadMasterProductOptions();

    return () => {
      cancelled = true;
    };
  }, [dropdownOptions, isOpen, resolvedFormInitialValues, resolvedSchema?.fields]);

  const preferredKeys = useMemo(() => {
    const normalized = schemaEntityKey.toLowerCase();
    const defaultKeyFields: Record<string, string[]> = {
      customer: [
        'name',
        'contact_person',
        'email',
        'phone_type',
        'phone',
        'street_address',
        'city',
        'state',
        'zip_code',
      ],
      supplier: [
        'name',
        'contact_person',
        'email',
        'phone_type',
        'phone',
        'street_address',
        'city',
        'state',
        'zip_code',
      ],
      contact: ['full_name', 'email', 'phone_type', 'phone', 'contact_type'],
      'inquiries.inquiry': [
        'entity_type',
        'customer',
        'supplier',
        'contact_name',
        'contact_email',
        'contact_phone_type',
        'contact_phone',
        'valid_until',
      ],
      inquiry: [
        'entity_type',
        'customer',
        'supplier',
        'contact_name',
        'contact_email',
        'contact_phone_type',
        'contact_phone',
        'valid_until',
      ],
      sales_order: ['customer', 'order_date', 'delivery_date', 'status', 'notes'],
      purchase_order: ['supplier', 'product', 'order_date', 'delivery_date', 'status', 'notes'],
      invoice: ['customer', 'invoice_date', 'status', 'notes'],
      product: ['name', 'product_code', 'protein_type', 'packaging_type', 'weight_unit'],
    };

    return (
      (keyFields && keyFields.length
        ? keyFields
        : resolvedSchema?.key_fields && resolvedSchema.key_fields.length
          ? resolvedSchema.key_fields
          : defaultKeyFields[normalized]) ||
      []
    );
  }, [keyFields, resolvedSchema?.key_fields, schemaEntityKey]);

  const preferredKeySet = useMemo(() => {
    return new Set(preferredKeys.map((k) => String(k).toLowerCase()));
  }, [preferredKeys]);

  const preferredKeyRank = useMemo(() => {
    return new Map(preferredKeys.map((k, idx) => [String(k).toLowerCase(), idx] as const));
  }, [preferredKeys]);

  const fkFields = useMemo(() => {
    return (resolvedSchema?.fields ?? []).filter(
      (f) => !shouldSkipField(f.key) && Boolean(f.related_entity)
    );
  }, [resolvedSchema?.fields]);

  const keyFkFields = useMemo(() => {
    const keyOnes = fkFields.filter((f) => preferredKeySet.has(String(f.key).toLowerCase()));

    return [...keyOnes].sort((a, b) => {
      const ka = String(a.key).toLowerCase();
      const kb = String(b.key).toLowerCase();
      const ra = preferredKeyRank.has(ka) ? (preferredKeyRank.get(ka) as number) : 9999;
      const rb = preferredKeyRank.has(kb) ? (preferredKeyRank.get(kb) as number) : 9999;
      if (ra !== rb) return ra - rb;
      return String(a.label || a.key).localeCompare(String(b.label || b.key));
    });
  }, [fkFields, preferredKeyRank, preferredKeySet]);

  const otherFkFields = useMemo(() => {
    const others = fkFields.filter((f) => !preferredKeySet.has(String(f.key).toLowerCase()));
    return [...others].sort((a, b) => String(a.label || a.key).localeCompare(String(b.label || b.key)));
  }, [fkFields, preferredKeySet]);

  const scalarFields = useMemo(() => {
    const raw = (resolvedSchema?.fields ?? [])
      .filter((f) => !shouldSkipField(f.key))
      .filter((f) => !f.related_entity)
      .map((f) => {
        const ui = f.ui && typeof f.ui === 'object' ? (f.ui as Record<string, unknown>) : null;
        const widget = ui && typeof ui['widget'] === 'string' ? String(ui['widget']) : null;

        const explicitType = String(f.type ?? '').toLowerCase();
        const isInlineArray = explicitType === 'inline_form_array' || widget === 'inline_form_array';

        const options = f.choices?.length
          ? f.choices
              .map((c) => ({
                value: c.value != null ? String(c.value) : '',
                label: typeof c.label === 'string' && c.label ? c.label : c.value != null ? String(c.value) : '',
              }))
              .filter((o) => Boolean(o.value))
          : undefined;

        const itemFieldsRaw =
          isInlineArray && ui && Array.isArray((ui as Record<string, unknown>).item_fields)
            ? ((ui as Record<string, unknown>).item_fields as unknown[])
            : null;

        const item_fields = itemFieldsRaw
          ? itemFieldsRaw
              .map((sf) => {
                const sub = sf && typeof sf === 'object' ? (sf as Record<string, unknown>) : {};
                const subUi =
                  sub.ui && typeof sub.ui === 'object' ? (sub.ui as Record<string, unknown>) : null;
                const subWidget =
                  subUi && typeof subUi['widget'] === 'string' ? String(subUi['widget']) : undefined;
                const subChoices = Array.isArray(sub.choices)
                  ? (sub.choices as unknown[])
                      .map((c) => {
                        const ch = c && typeof c === 'object' ? (c as Record<string, unknown>) : {};
                        const value = ch.value != null ? String(ch.value) : '';
                        const label = typeof ch.label === 'string' && ch.label ? ch.label : value;
                        return value ? { value, label } : null;
                      })
                      .filter(Boolean)
                  : undefined;

                return {
                  key: String(sub.key || ''),
                  api_key: typeof sub.api_key === 'string' ? sub.api_key : undefined,
                  label: typeof sub.label === 'string' ? sub.label : String(sub.key || ''),
                  type: subChoices?.length ? 'select' : String(sub.type ?? 'text'),
                  required: Boolean(sub.required),
                  options: subChoices as Array<{ value: string; label: string }> | undefined,
                  placeholder: typeof sub.placeholder === 'string' ? sub.placeholder : undefined,
                  help_text: typeof sub.help_text === 'string' ? sub.help_text : undefined,
                  ui: subWidget ? { widget: subWidget } : undefined,
                  dependencies: Array.isArray(sub.dependencies)
                    ? sub.dependencies
                        .map((item) => String(item || '').trim())
                        .filter(Boolean)
                    : undefined,
                };
              })
              .filter((sf) => Boolean(sf.key))
          : undefined;

        const add_button_label =
          isInlineArray && ui && typeof (ui as Record<string, unknown>).add_button_label === 'string'
            ? String((ui as Record<string, unknown>).add_button_label)
            : undefined;

        const item_label =
          isInlineArray && ui && typeof (ui as Record<string, unknown>).item_label === 'string'
            ? String((ui as Record<string, unknown>).item_label)
            : undefined;

        return {
          key: f.key,
          api_key: f.api_key,
          label: f.label || f.key,
          type: isInlineArray ? 'inline_form_array' : f.choices?.length ? 'select' : String(f.type ?? 'text'),
          required: Boolean(f.required),
          is_advanced: Boolean(f.is_advanced),
          options,
          placeholder: f.placeholder || undefined,
          help_text: f.help_text,
          ui:
            widget || f.ui
              ? ({
                  ...((f.ui as Record<string, unknown> | null) || {}),
                  ...(widget ? { widget } : {}),
                } as Record<string, unknown>)
              : undefined,
          dependencies: Array.isArray(f.dependencies)
            ? f.dependencies.map((item) => String(item || '').trim()).filter(Boolean)
            : undefined,
          item_fields,
          add_button_label,
          item_label,
        };
      });

    if (!preferredKeys.length) return raw;

    const rank = new Map(preferredKeys.map((k, idx) => [String(k).toLowerCase(), idx] as const));
    return [...raw].sort((a, b) => {
      const ra = rank.has(a.key.toLowerCase()) ? (rank.get(a.key.toLowerCase()) as number) : 9999;
      const rb = rank.has(b.key.toLowerCase()) ? (rank.get(b.key.toLowerCase()) as number) : 9999;
      if (ra !== rb) return ra - rb;
      return a.label.localeCompare(b.label);
    });
  }, [preferredKeys, resolvedSchema?.fields]);

  type DynamicSchema = {
    step_index: number;
    name: string;
    description?: string;
    fields: typeof scalarFields;
  };

  const dynamicSchema: DynamicSchema = useMemo(() => {
    const contactContext = inferContactFormContext(resolvedFormInitialValues);

    const supplierTitle =
      schemaEntityKey === 'supplier' ? (activeMode === 'create' ? 'New Supplier' : 'Supplier') : null;
    const customerTitle =
      schemaEntityKey === 'customer' ? (activeMode === 'create' ? 'New Customer' : 'Customer') : null;

    const formName = supplierTitle
      ? supplierTitle
        : customerTitle
          ? customerTitle
          : schemaEntityKey === 'contact' && activeMode === 'create'
            ? getContactCreateTitle(contactContext)
          : resolvedSchema?.name || `Universal Form: ${entityType}`;

    return {
      step_index: 0,
      name: formName,
      description: resolvedSchema?.description,
      fields: scalarFields,
    };
  }, [
    activeMode,
    entityType,
    scalarFields,
    resolvedFormInitialValues,
    resolvedSchema?.description,
    resolvedSchema?.name,
    schemaEntityKey,
  ]);

  const formInitialValues = useDeepStableValue(resolvedFormInitialValues);
  const stableDynamicSchema = useDeepStableValue(dynamicSchema);
  const getCurrentFkValue = useCallback(
    (fieldKey: string) => fkValues[fieldKey] ?? getValueAtPath(formInitialValues, fieldKey),
    [fkValues, formInitialValues]
  );

  const modalTitle = useMemo(() => {
    const contactContext = inferContactFormContext(formInitialValues);

    const supplierTitle =
      schemaEntityKey === 'supplier' ? (activeMode === 'create' ? 'New Supplier' : 'Supplier') : null;
    const customerTitle =
      schemaEntityKey === 'customer' ? (activeMode === 'create' ? 'New Customer' : 'Customer') : null;

    if (activeMode === 'clone') return `Clone ${entityType}`;

    if (supplierTitle) {
      return supplierTitle;
    }

    if (customerTitle) {
      return customerTitle;
    }

    if (schemaEntityKey === 'contact' && activeMode === 'create') {
      return getContactCreateTitle(contactContext);
    }

    return resolvedSchema?.name || (entityId ? `${entityType} ${entityId}` : `New ${entityType}`);
  }, [activeMode, entityId, entityType, formInitialValues, resolvedSchema?.name, schemaEntityKey]);

  const submit = useCallback(
    async (data: Record<string, unknown>) => {
      const payload: Record<string, unknown> = {};

      (scalarFields || []).forEach((field) => {
        const value = getValueAtPath(data, field.key);
        if (value === undefined) return;
        const backendKey = field.api_key || mapFormPathToBackendFieldKey(schemaEntityKey, field.key);
        payload[backendKey] = value;
      });

      // Enforce required FK fields (they are rendered outside DynamicFormEngine).
      const missingFk = fkFields
        .filter((f) => Boolean(f.required))
        .filter((f) => {
          const v = getCurrentFkValue(f.key);
          return v === undefined || v === null || v === '';
        });
      if (missingFk.length) {
        const missingHiddenFk = missingFk.filter((f) => Boolean(f.is_advanced));
        if (missingHiddenFk.length && !showAdvanced) {
          setShowAdvanced(true);
        }

        message.error(`Please select ${missingFk[0].label || missingFk[0].key}`);
        return;
      }

      // Merge FK values into payload.
      fkFields.forEach((f) => {
        const currentFkValue = getCurrentFkValue(f.key);
        if (currentFkValue !== undefined) {
          payload[f.api_key || f.key] = currentFkValue;
        }
      });

      // Merge explicit initial values for fields not rendered by the schema.
      if (stableInitialValues) {
        Object.entries(stableInitialValues).forEach(([k, v]) => {
          if (payload[k] !== undefined || v === undefined) return;
          if (Array.isArray(v) || (typeof v === 'object' && v !== null)) return;
          payload[k] = v;
        });
      }

      [
        'contact_context',
        'contactContext',
        'shippingLoadoutTitleOptions',
        'shipping_loadout_title_options',
        'contactTitleOptions',
        'contact_title_options',
        'documentsResponsibleOptions',
      ].forEach((key) => {
        delete payload[key];
      });

      // Normalize payload (avoid sending empty strings that cause DRF validation errors).
      const numberKeys = new Set(
        (scalarFields || [])
          .filter((f) => String(f.type).toLowerCase() === 'number')
          .map((f) => f.api_key || mapFormPathToBackendFieldKey(schemaEntityKey, f.key))
      );
      const emailKeySet = new Set(
        (scalarFields || [])
          .filter((f) => {
            const key = String(f.key || '').toLowerCase();
            const type = String(f.type || '').toLowerCase();
            return key.includes('email') || type.includes('email');
          })
          .map((f) => f.api_key || mapFormPathToBackendFieldKey(schemaEntityKey, f.key))
      );
      const emailLabelByKey = new Map(
        (scalarFields || [])
          .filter((f) =>
            emailKeySet.has(f.api_key || mapFormPathToBackendFieldKey(schemaEntityKey, f.key))
          )
          .map((f) => [
            f.api_key || mapFormPathToBackendFieldKey(schemaEntityKey, f.key),
            f.label || f.key,
          ] as const)
      );
      const zipKeySet = new Set(
        (scalarFields || [])
          .filter((f) => String(f.key || '').toLowerCase().includes('zip_code'))
          .map((f) => f.api_key || mapFormPathToBackendFieldKey(schemaEntityKey, f.key))
      );
      const zipLabelByKey = new Map(
        (scalarFields || [])
          .filter((f) =>
            zipKeySet.has(f.api_key || mapFormPathToBackendFieldKey(schemaEntityKey, f.key))
          )
          .map((f) => [
            f.api_key || mapFormPathToBackendFieldKey(schemaEntityKey, f.key),
            f.label || f.key,
          ] as const)
      );

      const phoneKeySet = new Set(
        (scalarFields || [])
          .filter((f) => isPhoneNumberFieldKey(String(f.key || '')))
          .map((f) => f.api_key || mapFormPathToBackendFieldKey(schemaEntityKey, f.key))
      );

      const inlineArrayPhoneKeys = new Map<string, string[]>();
      (scalarFields || [])
        .filter((f) => String(f.type || '').toLowerCase() === 'inline_form_array')
        .forEach((f: any) => {
          const itemFields: any[] = Array.isArray(f.item_fields) ? f.item_fields : [];
          const keys = itemFields
            .filter((it) => isPhoneNumberFieldKey(String(it?.key || '')))
            .map((it) => String(it.key));
          if (keys.length) inlineArrayPhoneKeys.set(String(f.key), keys);
        });

      Object.entries(payload).forEach(([k, v]) => {
        if (v === '') {
          delete payload[k];
          return;
        }
        if (typeof v === 'string') {
          const trimmed = v.trim();
          if (!trimmed) {
            delete payload[k];
            return;
          }
          if (zipKeySet.has(k)) {
            const country = typeof payload.country === 'string' ? payload.country.trim().toUpperCase() : '';
            const isUs = country === 'USA' || country === 'UNITED STATES' || country === 'UNITED STATES OF AMERICA';

            if (!isUs) {
              payload[k] = trimmed;
              return;
            }

            const digits = trimmed.replace(/\D/g, '');
            if (digits.length >= 9) {
              payload[k] = `${digits.slice(0, 5)}-${digits.slice(5, 9)}`;
              return;
            }

            payload[k] = digits.slice(0, 5);
            return;
          }
          if (phoneKeySet.has(k)) {
            payload[k] = normalizeUsPhone(trimmed);
            return;
          }
          if (numberKeys.has(k)) {
            const n = Number(trimmed);
            if (Number.isFinite(n)) payload[k] = n;
          } else {
            payload[k] = trimmed;
          }
        }
      });

      // Normalize integer array inputs (e.g., Plant.associated_master_product_ids).
      if (Array.isArray(payload.associated_master_product_ids)) {
        payload.associated_master_product_ids = payload.associated_master_product_ids
          .map((v) => {
            const trimmed = String(v ?? '').trim();
            if (!trimmed) return null;

            const parsed = Number(trimmed);
            return Number.isFinite(parsed) ? parsed : null;
          })
          .filter((n): n is number => n !== null);
      }

      // Normalize phone numbers in inline form arrays (digits-only for API payload).
      inlineArrayPhoneKeys.forEach((phoneKeys, arrayKey) => {
        const items = payload[arrayKey];
        if (!Array.isArray(items) || !phoneKeys.length) return;

        payload[arrayKey] = items.map((row) => {
          const rec =
            row && typeof row === 'object'
              ? ({ ...(row as Record<string, unknown>) } as Record<string, unknown>)
              : ({} as Record<string, unknown>);

          phoneKeys.forEach((k) => {
            const v = rec[k];
            if (typeof v === 'string') rec[k] = normalizeUsPhone(v);
          });

          return rec;
        });
      });

      // Validate email(s) before submit.
      for (const k of emailKeySet) {
        const v = payload[k];
        if (typeof v === 'string' && v.trim() && !isValidEmail(v.trim())) {
          const label = emailLabelByKey.get(k) || k;
          message.error(`Please enter a valid email for ${label}`);
          return;
        }
      }

      // Validate ZIP code(s) before submit.
      for (const k of zipKeySet) {
        const v = payload[k];
        if (typeof v !== 'string' || !v.trim()) continue;

        const country = typeof payload.country === 'string' ? payload.country.trim().toUpperCase() : '';
        const isUs = country === 'USA' || country === 'UNITED STATES' || country === 'UNITED STATES OF AMERICA';
        if (!isUs) continue;

        if (!/^\d{5}(-\d{4})?$/.test(v.trim())) {
          const label = zipLabelByKey.get(k) || k;
          message.error(`${label} must be a valid US ZIP code`);
          return;
        }
      }

      try {
        setSubmitting(true);
        let result: unknown;
        if (onSubmit) {
          result = await onSubmit(payload);
        } else {
          const hasEntityId = entityId != null && String(entityId).trim().length > 0;
          const isEditSubmit = hasEntityId && activeMode === 'edit';
          const resp = isEditSubmit
            ? await businessApi.patch(`${endpoint}${entityId}/`, payload)
            : await businessApi.post(endpoint, payload);
          result = resp.data;
        }

        onSuccess?.(result);
        onClose();
      } catch (err: unknown) {
        console.error('[UniversalEntityForm] Submit failed:', err);
        const typed = err as {
          response?: {
            data?: unknown;
          };
          message?: string;
        };

        const data = typed?.response?.data;
        if (data && typeof data === 'object') {
          const obj = data as Record<string, unknown>;
          const top =
            (typeof obj.error === 'string' && obj.error) ||
            (typeof obj.detail === 'string' && obj.detail) ||
            null;

          if (top) {
            message.error(top);
          } else {
            const firstField = Object.entries(obj).find(([, v]) => Array.isArray(v) || typeof v === 'string');
            const fieldMsg = firstField
              ? Array.isArray(firstField[1])
                ? String((firstField[1] as unknown[])[0] ?? 'Invalid value')
                : String(firstField[1])
              : null;
            message.error(fieldMsg || 'Failed to submit form');
          }
        } else if (typeof data === 'string' && data) {
          message.error(data);
        } else {
          message.error(typed?.message || 'Failed to submit form');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [
      endpoint,
      entityId,
      activeMode,
      fkFields,
      formInitialValues,
      getCurrentFkValue,
      onClose,
      onSuccess,
      onSubmit,
      preferredKeySet,
      scalarFields,
      schemaEntityKey,
      showAdvanced,
      stableInitialValues,
    ]
  );

  const fetchProducts = useCallback(
    async (fieldKey: string, q: string) => {
      const nextSeq = (productSearchSeqRef.current[fieldKey] ?? 0) + 1;
      productSearchSeqRef.current[fieldKey] = nextSeq;

      setLoadingProducts((prev) => ({ ...prev, [fieldKey]: true }));
      try {
        const resp = await businessApi.get('/system/products/', {
          params: { search: q || undefined, page_size: 50, limit: 50, is_active: true },
        });

        // Ignore out-of-order responses.
        if (productSearchSeqRef.current[fieldKey] !== nextSeq) return;

        const payload = resp.data as unknown;
        const payloadObj =
          typeof payload === 'object' && payload ? (payload as Record<string, unknown>) : null;
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payloadObj?.results)
            ? payloadObj?.results
            : [];

        const opts = rows.map((p: unknown) => {
          const row = (p && typeof p === 'object' ? (p as Record<string, unknown>) : {}) || {};
          const id = row.id;
          const code = typeof row.product_code === 'string' ? row.product_code : '';
          const name =
            typeof row.name === 'string'
              ? row.name
              : typeof row.effective_name === 'string'
                ? row.effective_name
                : '';
          const label = `${code ? `${code} - ` : ''}${name}`.trim() || String(id ?? '');
          return { value: String(id ?? ''), label };
        });

        // Replace options for the current search (so results actually refresh on every keystroke),
        // but keep the currently-selected value so it doesn't disappear.
        const selectedValue = String(getCurrentFkValue(fieldKey) ?? '');

        setProductOptions((prev) => {
          const selected = selectedValue
            ? (prev[fieldKey] || []).find((o) => String(o.value) === selectedValue)
            : undefined;

          const merged = [...opts];
          if (selected && !merged.some((o) => String(o.value) === String(selected.value))) {
            merged.unshift(selected);
          }

          return {
            ...prev,
            [fieldKey]: merged,
          };
        });
      } catch (err) {
        console.error('[UniversalEntityForm] Failed to search products:', err);
      } finally {
        if (productSearchSeqRef.current[fieldKey] === nextSeq) {
          setLoadingProducts((prev) => ({ ...prev, [fieldKey]: false }));
        }
      }
    },
    [getCurrentFkValue]
  );

  if (variant === 'inline' && !isOpen) return null;

  const hasDisplayValue = (v: unknown): boolean => {
    if (v === undefined || v === null) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (typeof v === 'number') return true;
    if (typeof v === 'boolean') return true;
    if (Array.isArray(v)) return v.some((item) => hasDisplayValue(item));
    if (typeof v === 'object') return Object.keys(v as Record<string, unknown>).length > 0;
    return Boolean(v);
  };

  const formatValue = (v: unknown): string => {
    if (v === undefined || v === null) return '';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(formatValue).filter(Boolean).join(', ');
    if (typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      const name = typeof obj.name === 'string' ? obj.name : null;
      if (name) return name;
      const id = obj.id;
      if (id != null) return String(id);
      try {
        return JSON.stringify(obj);
      } catch {
        return '[object]';
      }
    }
    return String(v);
  };

  const keyScalarFields = scalarFields.filter((f) => preferredKeySet.has(String(f.key).toLowerCase()));
  const otherScalarFields = scalarFields.filter((f) => !preferredKeySet.has(String(f.key).toLowerCase()));

  const standardScalarFields = [...keyScalarFields, ...otherScalarFields.filter((f) => !f.is_advanced)];
  const advancedScalarFields = otherScalarFields.filter((f) => Boolean(f.is_advanced));

  const visibleScalarFields = [...standardScalarFields, ...(showAdvanced ? advancedScalarFields : [])];

  const advancedFkFields = otherFkFields.filter((f) => Boolean(f.is_advanced));

  const showVisibilityToggle =
    advancedFkFields.length > 0 || advancedScalarFields.length > 0;

  const modeSwitchControls =
    entityId != null &&
    canSwitchModes && (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 10 }}>
        {activeMode === 'view' ? (
          <Button type="primary" onClick={() => setActiveMode('edit')}>
            Edit
          </Button>
        ) : inferredMode === 'view' ? (
          <Button onClick={() => setActiveMode('view')} disabled={submitting}>
            View
          </Button>
        ) : null}
      </div>
    );

  const content = (
    <Container $variant={variant}>
      {resolvedLoading ? (
        <div style={{ padding: 16 }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      ) : resolvedLoadError ? (
        <div style={{ padding: 12, color: 'rgb(var(--color-text-secondary))', fontSize: 13 }}>
          {(resolvedLoadError as any)?.response?.status === 401 ||
          (resolvedLoadError as any)?.response?.status === 403
            ? 'Authentication required. Redirecting to login…'
            : 'Unable to load form.'}
        </div>
      ) : !resolvedSchema ? (
        <div style={{ padding: 12, color: 'rgb(var(--color-text-secondary))', fontSize: 13 }}>
          Unable to load form.
        </div>
      ) : (
        <>
          {activeMode !== 'view' && autofill && (
            <AutofillToolbar
              {...autofill}
              disabled={Boolean(autofill.disabled) || submitting || resolvedLoading}
            />
          )}

          {modeSwitchControls}

          {(keyFkFields.length > 0 || otherFkFields.length > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 10 }}>
              {[...keyFkFields, ...otherFkFields.filter((f) => !f.is_advanced), ...(showAdvanced ? otherFkFields.filter((f) => Boolean(f.is_advanced)) : [])].map((f) => {
                const related = String(f.related_entity || '').toLowerCase();
                const isProduct =
                  related.includes('system.product') ||
                  String(f.key).toLowerCase().includes('product');

                const value = String(getCurrentFkValue(f.key) ?? '');

                if (activeMode === 'view') {
                  if (Boolean(f.is_advanced) && !hasDisplayValue(getValueAtPath(formInitialValues, f.key))) {
                    return null;
                  }

                  return (
                    <div key={f.key}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'rgb(var(--color-text-secondary))',
                          marginBottom: 6,
                        }}
                      >
                        {f.label || f.key}
                      </div>
                      <div
                        style={{
                          padding: '10px 12px',
                          border: '1px solid rgb(var(--color-border))',
                          borderRadius: 8,
                          background: 'rgb(var(--color-input-readonly))',
                          color: 'rgb(var(--color-text-primary))',
                          fontSize: 13,
                        }}
                      >
                        {formatValue(getValueAtPath(formInitialValues, f.key)) || '—'}
                      </div>
                    </div>
                  );
                }

                if (isProduct) {
                  return (
                    <div key={f.key}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'rgb(var(--color-text-secondary))',
                          marginBottom: 6,
                        }}
                      >
                        {f.label || f.key}
                      </div>
                      <Select
                        showSearch
                        filterOption={false}
                        onDropdownVisibleChange={(open) => {
                          if (open && (productOptions[f.key] || []).length === 0) {
                            void fetchProducts(f.key, '');
                          }
                        }}
                        onSearch={(q) => void fetchProducts(f.key, q)}
                        options={productOptions[f.key] || []}
                        value={value || undefined}
                        onChange={(next) => setFkValues((prev) => ({ ...prev, [f.key]: String(next) }))}
                        notFoundContent={loadingProducts[f.key] ? <Spin size="small" /> : null}
                        getPopupContainer={getSelectPopupContainer}
                        style={{ width: '100%' }}
                        placeholder="Search products…"
                      />
                    </div>
                  );
                }

                const mapped = relatedEntityToEntityOptionsType(f.related_entity, f.key);

                if (mapped && mapped !== 'product') {
                  return (
                    <div key={f.key}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'rgb(var(--color-text-secondary))',
                          marginBottom: 6,
                        }}
                      >
                        {f.label || f.key}
                      </div>
                      <EntityOptionsSelect
                        entityType={mapped}
                        value={value}
                        onChange={(next) => setFkValues((prev) => ({ ...prev, [f.key]: next }))}
                        placeholder={`Search ${f.label || f.key}…`}
                        forceSearch
                        debounceMs={0}
                      />
                    </div>
                  );
                }

                const options = resolvedFkOptions[f.key] || [];
                return (
                  <div key={f.key}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'rgb(var(--color-text-secondary))',
                        marginBottom: 6,
                      }}
                    >
                      {f.label || f.key}
                    </div>
                    <Select
                      showSearch
                      options={options.map((o) => ({ value: String(o.id), label: o.name }))}
                      value={value || undefined}
                      onChange={(next) => setFkValues((prev) => ({ ...prev, [f.key]: String(next) }))}
                      getPopupContainer={getSelectPopupContainer}
                      style={{ width: '100%' }}
                      placeholder={`Select ${f.label || f.key}`}
                      filterOption={(input, option) =>
                        String(option?.label || '').toLowerCase().includes(String(input || '').toLowerCase())
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}

          {showVisibilityToggle && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <Button
                type="dashed"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? 'Hide details' : 'Expand details'}
              </Button>
            </div>
          )}

          {activeMode === 'view' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {visibleScalarFields.map((f) => {
                if (Boolean(f.is_advanced) && !hasDisplayValue(getValueAtPath(formInitialValues, f.key))) {
                  return null;
                }

                return (
                  <div key={f.key}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'rgb(var(--color-text-secondary))',
                      marginBottom: 6,
                    }}
                  >
                    {f.label || f.key}
                  </div>
                  <div
                    style={{
                      padding: '10px 12px',
                      border: '1px solid rgb(var(--color-border))',
                      borderRadius: 8,
                      background: 'rgb(var(--color-input-readonly))',
                      color: 'rgb(var(--color-text-primary))',
                      fontSize: 13,
                    }}
                  >
                    {formatValue(getValueAtPath(formInitialValues, f.key)) || '—'}
                  </div>
                  </div>
                );
              })}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <Button onClick={onClose} disabled={submitting}>
                  Close
                </Button>
                {entityId != null && canSwitchModes && (
                  <Button type="primary" onClick={() => setActiveMode('edit')}>
                    Edit
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <DynamicFormEngine
              schema={stableDynamicSchema as any}
              initialValues={formInitialValues}
              onValuesChange={onValuesChange}
              isSubmitting={submitting}
              submitLabel={entityId ? 'Save' : 'Create'}
              keyFieldKeys={preferredKeys}
              showAllFields={showAdvanced}
              onShowAllFieldsChange={setShowAdvanced}
              showAllFieldsToggle={false}
              dropdownOptions={mergedDropdownOptions}
              formConfig={formConfig}
              onSubmit={(data) => {
                void submit(data);
              }}
              onCancel={() => {
                if (submitting) return;
                if (inferredMode === 'view' && canSwitchModes) {
                  setActiveMode('view');
                  return;
                }
                onClose();
              }}
            />
          )}
        </>
      )}
    </Container>
  );

  if (variant === 'inline') return content;

  return (
    <Modal
      open={isOpen}
      centered
      onCancel={() => {
        if (submitting) return;
        onClose();
      }}
      mask={{ closable: !submitting }}
      keyboard={!submitting}
      footer={null}
      width="min(720px, calc(100vw - 32px))"
      destroyOnHidden
      title={modalTitle}
    >
      {content}
    </Modal>
  );
};

export default UniversalEntityForm;
