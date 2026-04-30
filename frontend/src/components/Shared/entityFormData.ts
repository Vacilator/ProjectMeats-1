import { businessApi } from '../../services/businessApi';
import {
  normalizeEntityEndpoint,
  normalizeEntityKey,
  mapDrfOptionsType,
  isPhoneNumberFieldKey,
  type BackendField,
  type BackendSchema,
} from './UniversalEntityForm';

export interface PreloadedDropdownOption {
  value: string;
  label: string;
  metadata?: Record<string, unknown>;
}

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
): Promise<PreloadedDropdownOption[]> => {
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
        : related.includes('plants.')
          ? 'plants/'
          : related.includes('locations.')
            ? 'locations/'
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

    const value = String((row.id as string | number | undefined) ?? '');
    const label =
      (typeof row.name === 'string' && row.name) ||
      (typeof row.company_name === 'string' && row.company_name) ||
      (typeof row.full_name === 'string' && row.full_name) ||
      (typeof row.email === 'string' && row.email) ||
      value;

    return {
      value,
      label,
      metadata: row,
    };
  });
};
