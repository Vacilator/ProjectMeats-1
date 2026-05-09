import { businessApi } from './businessApi';
import { EMPTY_CHOICES } from './choiceConstants';

export interface ContactFormOption {
  value: string;
  label: string;
}

const CANONICAL_CHOICE_LIST_ALIASES: Record<string, string> = {
  'protein-type': 'protein_types',
  'protein_type': 'protein_types',
  'protein_types': 'protein_types',
};

const systemChoiceCache = new Map<string, ContactFormOption[]>();
const pendingSystemChoiceRequests = new Map<string, Promise<ContactFormOption[]>>();

const normalizeChoiceListSlug = (slug: string): string => {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return '';

  return CANONICAL_CHOICE_LIST_ALIASES[normalized] || normalized.replace(/-/g, '_');
};

const emptyChoices = (): ContactFormOption[] => EMPTY_CHOICES as ContactFormOption[];

const asOption = (value: unknown, label?: unknown): ContactFormOption | null => {
  const normalizedValue = value == null ? '' : String(value).trim();
  const normalizedLabel = typeof label === 'string' && label.trim() ? label.trim() : normalizedValue;

  if (!normalizedValue) return null;

  return {
    value: normalizedValue,
    label: normalizedLabel,
  };
};

const normalizeChoicePayload = (payload: unknown): ContactFormOption[] => {
  if (Array.isArray(payload)) {
    const options = payload
      .map((item) => {
        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        return asOption(row.value ?? row.id ?? row.key, row.label ?? row.name ?? row.display_name);
      })
      .filter((item): item is ContactFormOption => Boolean(item));

    return options.length > 0 ? options : emptyChoices();
  }

  const obj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  const results = Array.isArray(obj?.results)
    ? obj?.results
    : Array.isArray(obj?.options)
      ? obj?.options
      : Array.isArray(obj?.items)
        ? obj?.items
        : [];

  return normalizeChoicePayload(results);
};

export const contactFormOptionsService = {
  async getSystemChoiceOptions(listSlug: string): Promise<ContactFormOption[]> {
    const key = normalizeChoiceListSlug(listSlug);
    if (!key) {
      return emptyChoices();
    }

    const cached = systemChoiceCache.get(key);
    if (cached) {
      return cached;
    }

    const pending = pendingSystemChoiceRequests.get(key);
    if (pending) {
      return pending;
    }

    const request = businessApi
      .get('/system/choices/', {
        params: { list: key },
      })
      .then((response) => {
        const options = normalizeChoicePayload(response.data);
        const stableOptions = options.length > 0 ? options : emptyChoices();
        systemChoiceCache.set(key, stableOptions);
        return stableOptions;
      })
      .catch(() => {
        const stableEmpty = emptyChoices();
        systemChoiceCache.set(key, stableEmpty);
        return stableEmpty;
      })
      .finally(() => {
        pendingSystemChoiceRequests.delete(key);
      });

    pendingSystemChoiceRequests.set(key, request);
    return request;
  },

  async getMasterProductOptions(params?: {
    proteinTypes?: string[];
    search?: string;
  }): Promise<ContactFormOption[]> {
    const proteinTypes = Array.isArray(params?.proteinTypes)
      ? params?.proteinTypes.map((item) => String(item || '').trim()).filter(Boolean)
      : [];

    const requestParams: Record<string, unknown> = {
      search: params?.search || undefined,
      page_size: 200,
      limit: 200,
      is_active: true,
    };

    if (proteinTypes.length > 0) {
      requestParams.protein_types = proteinTypes;
      requestParams.protein_type = proteinTypes;
    }

    // Canonical endpoint. (Historical /products/master/ alias caused noisy 404s in some envs.)
    const endpoint = '/master-products/';

    try {
      const response = await businessApi.get(endpoint, { params: requestParams });
      const payload = response.data as unknown;
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as Record<string, unknown> | null)?.results)
          ? ((payload as Record<string, unknown>).results as unknown[])
          : [];

      const options = rows
        .map((item) => {
          const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
          const label =
            row.display_name ??
            row.effective_name ??
            row.name ??
            (row.product_code
              ? `${String(row.product_code)}${row.name ? ` - ${String(row.name)}` : ''}`
              : row.id);
          return asOption(row.id ?? row.value ?? row.product_code ?? row.name, label);
        })
        .filter((item): item is ContactFormOption => Boolean(item));

      return options.length > 0 ? options : emptyChoices();
    } catch {
      return emptyChoices();
    }
  },

  clearCache(): void {
    systemChoiceCache.clear();
    pendingSystemChoiceRequests.clear();
  },
};

export default contactFormOptionsService;
