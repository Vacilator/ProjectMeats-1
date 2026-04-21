import { ApiServiceError } from './apiErrors';

export interface ApiErrorPresentation {
  /** A message intended to be safe and helpful for end users */
  friendlyMessage: string;
  /** HTTP status code when known */
  status?: number;
  /** Transport/error code when known (e.g. axios ERR_NETWORK) */
  code?: string;
  /** Normalized classification */
  kind?: string;
}

type ErrorWithResponse = {
  response?: {
    status?: number;
    data?: any;
  };
  code?: string;
  message?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function extractBackendMessage(data: unknown): string | undefined {
  if (!isObject(data)) return undefined;

  const anyData = data as any;
  const msg = anyData.message ?? anyData.error ?? anyData.detail ?? anyData.details;
  return typeof msg === 'string' ? msg : undefined;
}

function looksLikeAxiosStatusMessage(msg: string): boolean {
  return /request failed with status code \d+/i.test(msg);
}

export function getApiErrorPresentation(
  error: unknown,
  opts?: {
    fallbackMessage?: string;
  }
): ApiErrorPresentation {
  const fallbackMessage = opts?.fallbackMessage ?? 'Something went wrong. Please try again.';

  if (error instanceof ApiServiceError) {
    return {
      friendlyMessage: error.friendlyMessage ?? error.message ?? fallbackMessage,
      status: error.status,
      code: error.code,
      kind: error.kind,
    };
  }

  const e = (error ?? null) as ErrorWithResponse | null;
  const status = typeof e?.response?.status === 'number' ? e.response.status : undefined;
  const code = typeof e?.code === 'string' ? e.code : undefined;

  const backendMessage = extractBackendMessage(e?.response?.data);
  const rawMessage = typeof e?.message === 'string' ? e.message : undefined;

  const friendlyMessage =
    backendMessage ??
    (rawMessage && !looksLikeAxiosStatusMessage(rawMessage) ? rawMessage : undefined) ??
    fallbackMessage;

  return {
    friendlyMessage,
    status,
    code,
    kind: undefined,
  };
}

export function formatApiErrorMeta(presentation: ApiErrorPresentation): string | undefined {
  const parts = [
    typeof presentation.status === 'number' ? `Status ${presentation.status}` : undefined,
    presentation.code ? `Code ${presentation.code}` : undefined,
    presentation.kind ? presentation.kind : undefined,
  ].filter(Boolean) as string[];

  return parts.length ? parts.join(' • ') : undefined;
}

export function toApiErrorText(
  error: unknown,
  opts?: {
    fallbackMessage?: string;
    includeMeta?: boolean;
  }
): string {
  const presentation = getApiErrorPresentation(error, { fallbackMessage: opts?.fallbackMessage });
  const meta = opts?.includeMeta === false ? undefined : formatApiErrorMeta(presentation);
  return meta ? `${presentation.friendlyMessage}\n\n${meta}` : presentation.friendlyMessage;
}
