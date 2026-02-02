/**
 * Choices Service
 * 
 * Fetches and caches static choice options from the backend.
 * 
 * Resolution Order:
 * 1. Try configService's SystemChoiceList API first (new v2 system)
 * 2. Fall back to legacy /choices/ endpoint for Django TextChoices
 * 
 * Usage:
 *   const options = await choicesService.getChoices('protein_type');
 *   const allChoices = await choicesService.getAllChoices();
 */
import axios from 'axios';
import { config } from '../config/runtime';
import { configService } from './configService';

const API_BASE_URL = config.API_BASE_URL;

// Create axios instance for choices API
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
});

// Request interceptor for authentication
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  const tenantId = localStorage.getItem('tenantId');
  if (tenantId) {
    config.headers['X-Tenant-ID'] = tenantId;
  }
  return config;
});

// Types
export interface ChoiceOption {
  value: string;
  label: string;
}

export interface ChoicesResponse {
  choice_type: string;
  options: ChoiceOption[];
  count: number;
}

export interface AllChoicesResponse {
  choices: Record<string, ChoiceOption[]>;
  choice_types: string[];
}

// Available choice types (matching backend CHOICE_CLASSES)
export type ChoiceType =
  | 'edible_inedible'
  | 'accounting_payment_terms'
  | 'credit_limit'
  | 'account_line_of_credit'
  | 'protein_type'
  | 'fresh_or_frozen'
  | 'package_type'
  | 'net_or_catch'
  | 'plant_type'
  | 'certificate_type'
  | 'origin'
  | 'country_origin'
  | 'shipping_offered'
  | 'industry'
  | 'weight_unit'
  | 'appointment_method'
  | 'contact_type'
  | 'department_supplier'
  | 'carrier_department'
  | 'carton_type';

// Mapping from field names to choice types
// This helps identify which fields should use static choices
export const FIELD_TO_CHOICE_TYPE: Record<string, ChoiceType> = {
  // Customer fields
  'edible_inedible': 'edible_inedible',
  'accounting_payment_terms': 'accounting_payment_terms',
  'credit_limits': 'credit_limit',
  'credit_limit': 'credit_limit',
  'account_line_of_credit': 'account_line_of_credit',
  'type_of_certificate': 'certificate_type',
  'certificate_type': 'certificate_type',
  'purchasing_preference_origin': 'origin',
  'industry': 'industry',
  'industry_array': 'industry',
  
  // Product fields
  'type_of_protein': 'protein_type',
  'protein_type': 'protein_type',
  'preferred_protein_types': 'protein_type',
  'fresh_or_frozen': 'fresh_or_frozen',
  'package_type': 'package_type',
  'net_or_catch': 'net_or_catch',
  'edible_or_inedible': 'edible_inedible',
  'origin': 'origin',
  'country_origin': 'country_origin',
  
  // Plant fields
  'plant_type': 'plant_type',
  'shipping_offered': 'shipping_offered',
  'appointment_method': 'appointment_method',
  
  // Contact fields
  'contact_type': 'contact_type',
  'department': 'department_supplier',
  
  // Other
  'weight_unit': 'weight_unit',
  'carton_type': 'carton_type',
};

// Mapping from field names to SystemChoiceList slugs (v2 config system)
// These take precedence over legacy FIELD_TO_CHOICE_TYPE
export const FIELD_TO_CHOICE_LIST_SLUG: Record<string, string> = {
  // Add mappings as SystemChoiceLists are created for each field
  // Format: 'field_name': 'choice-list-slug'
  // Example:
  // 'protein_type': 'protein-types',
  // 'status': 'order-statuses',
};

// Cache for choices (avoid repeated API calls)
let choicesCache: Record<string, ChoiceOption[]> | null = null;
let cachePromise: Promise<AllChoicesResponse> | null = null;

/**
 * Get choices for a specific type
 */
export async function getChoices(choiceType: ChoiceType): Promise<ChoiceOption[]> {
  // If we have cache, use it
  if (choicesCache && choicesCache[choiceType]) {
    return choicesCache[choiceType];
  }
  
  // If cache is loading, wait for it
  if (cachePromise) {
    const result = await cachePromise;
    return result.choices[choiceType] || [];
  }
  
  // Fetch specific choice type
  try {
    const response = await apiClient.get<ChoicesResponse>(`/choices/`, {
      params: { choice_type: choiceType }
    });
    return response.data.options;
  } catch (error) {
    console.error(`Failed to fetch choices for ${choiceType}:`, error);
    return [];
  }
}

/**
 * Get all choices at once (cached)
 */
export async function getAllChoices(): Promise<Record<string, ChoiceOption[]>> {
  // Return cache if available
  if (choicesCache) {
    return choicesCache;
  }
  
  // If already loading, wait for it
  if (cachePromise) {
    const result = await cachePromise;
    return result.choices;
  }
  
  // Fetch all choices
  cachePromise = apiClient.get<AllChoicesResponse>(`/choices/`)
    .then(response => {
      choicesCache = response.data.choices;
      return response.data;
    })
    .catch(error => {
      console.error('Failed to fetch all choices:', error);
      cachePromise = null;
      return { choices: {}, choice_types: [] };
    });
  
  const result = await cachePromise;
  return result.choices;
}

/**
 * Get choices for a field by its name
 * 
 * Resolution order:
 * 1. Check FIELD_TO_CHOICE_LIST_SLUG for v2 SystemChoiceList mapping
 * 2. Fall back to FIELD_TO_CHOICE_TYPE for legacy Django TextChoices
 */
export async function getChoicesForField(fieldName: string): Promise<ChoiceOption[] | null> {
  const normalizedName = fieldName.toLowerCase().replace(/\s+/g, '_');
  
  // First try: v2 SystemChoiceList via configService
  const choiceListSlug = FIELD_TO_CHOICE_LIST_SLUG[normalizedName];
  if (choiceListSlug) {
    try {
      const options = await configService.getChoiceOptions(choiceListSlug);
      if (options && options.length > 0) {
        return options;
      }
    } catch (error) {
      console.debug(`No SystemChoiceList found for slug '${choiceListSlug}', falling back to legacy`);
    }
  }
  
  // Second try: legacy Django TextChoices
  const choiceType = FIELD_TO_CHOICE_TYPE[normalizedName];
  if (!choiceType) {
    return null; // Field doesn't have static choices
  }
  
  return getChoices(choiceType);
}

/**
 * Check if a field should use static choices
 */
export function isStaticChoiceField(fieldName: string): boolean {
  const normalizedName = fieldName.toLowerCase().replace(/\s+/g, '_');
  // Field is static if it maps to either v2 SystemChoiceList or legacy TextChoices
  return normalizedName in FIELD_TO_CHOICE_LIST_SLUG || normalizedName in FIELD_TO_CHOICE_TYPE;
}

/**
 * Clear the choices cache (useful for testing or after logout)
 */
export function clearChoicesCache(): void {
  choicesCache = null;
  cachePromise = null;
  configService.clearCache(); // Also clear configService cache
}

/**
 * Preload all choices (call during app initialization)
 */
export async function preloadChoices(): Promise<void> {
  await getAllChoices();
}

/**
 * Choices service object for convenient imports
 */
export const choicesService = {
  getChoices,
  getAllChoices,
  getChoicesForField,
  isStaticChoiceField,
  clearChoicesCache,
  preloadChoices,
  FIELD_TO_CHOICE_TYPE,
  FIELD_TO_CHOICE_LIST_SLUG,
};

export default choicesService;
