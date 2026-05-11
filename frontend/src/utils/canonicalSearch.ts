const COMMAND_CENTER_PATH = '/command-center';
const PRESERVED_COMMAND_CENTER_PARAMS = ['tab', 'item'] as const;

const toSearchParams = (value?: string | URLSearchParams): URLSearchParams => {
  if (!value) {
    return new URLSearchParams();
  }

  if (value instanceof URLSearchParams) {
    return new URLSearchParams(value);
  }

  return new URLSearchParams(value);
};

export const getCanonicalSearchQuery = (value?: string | URLSearchParams): string =>
  toSearchParams(value).get('q') ?? '';

export const buildCanonicalSearchParams = (
  value: string | URLSearchParams | undefined,
  query: string,
): URLSearchParams => {
  const current = toSearchParams(value);
  const next = new URLSearchParams();

  for (const key of PRESERVED_COMMAND_CENTER_PARAMS) {
    const preservedValue = current.get(key);
    if (preservedValue) {
      next.set(key, preservedValue);
    }
  }

  const normalizedQuery = query.trim();
  if (normalizedQuery) {
    next.set('q', normalizedQuery);
  }

  return next;
};

export const buildCanonicalSearchPath = ({
  query,
  searchParams,
}: {
  query: string;
  searchParams?: string | URLSearchParams;
}): string => {
  const next = buildCanonicalSearchParams(searchParams, query);
  const suffix = next.toString();
  return suffix ? `${COMMAND_CENTER_PATH}?${suffix}` : COMMAND_CENTER_PATH;
};

export const isCommandCenterPath = (pathname: string): boolean => pathname === COMMAND_CENTER_PATH;
