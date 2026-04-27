import { businessApi } from './businessApi';
import { configService } from './configService';

export interface ContactFormOption {
  value: string;
  label: string;
}

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
    return payload
      .map((item) => {
        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        return asOption(row.value ?? row.id ?? row.key, row.label ?? row.name ?? row.display_name);
      })
      .filter((item): item is ContactFormOption => Boolean(item));
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

const slugVariants = (slug: string): string[] => {
  const normalized = String(slug || '').trim();
  if (!normalized) return [];

  const variants = new Set<string>([
    normalized,
    normalized.replace(/-/g, '_'),
    normalized.replace(/_/g, '-'),
  ]);

  if (normalized.endsWith('s')) {
    variants.add(normalized.slice(0, -1));
  } else {
    variants.add(`${normalized}s`);
  }

  return Array.from(variants);
};

export const contactFormOptionsService = {
  async getSystemChoiceOptions(listSlug: string): Promise<ContactFormOption[]> {
    const candidates = slugVariants(listSlug);

    for (const candidate of candidates) {
      try {
        const response = await businessApi.get('/system/choices/', {
          params: { list: candidate },
        });

        const options = normalizeChoicePayload(response.data);
        if (options.length > 0) return options;
      } catch {
        // Fall through to the next candidate / fallback.
      }
    }

    for (const candidate of candidates) {
      try {
        const options = await configService.getChoiceOptions(candidate);
        if (Array.isArray(options) && options.length > 0) {
          return options
            .map((item) => asOption(item.value, item.label))
            .filter((item): item is ContactFormOption => Boolean(item));
        }
      } catch {
        // Ignore fallback failures until all variants are exhausted.
      }
    }

    return [];
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

      return rows
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
    } catch {
      return [];
    }
  },
};

export default contactFormOptionsService;
