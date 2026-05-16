import { ApiServiceError } from './apiErrors';

export interface ApiErrorPresentation {
  /** A message intended to be safe and helpful for end users */
  friendlyMessage: string;
  /** HTTP status code when known */
  status?: number;
  /** Backend error code (preferred) or transport/error code when known (e.g. axios ERR_NETWORK) */
  code?: string;
  /** Normalized classification */
  kind?: string;
}

type ErrorWithResponse = {
  response?: {
    status?: number;
    data?: Record<string, unknown>;
  };
  code?: string;
  message?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function extractBackendMessage(data: unknown): string | undefined {
  if (!isObject(data)) return undefined;

  const rec = data as Record<string, unknown>;
  const msg = rec.message ?? rec.error ?? rec.detail ?? rec.details;
  return typeof msg === 'string' ? msg : undefined;
}

function extractBackendCode(data: unknown): string | undefined {
  if (!isObject(data)) return undefined;

  const rec = data as Record<string, unknown>;
  const code = rec.code ?? rec.error_code;
  return typeof code === 'string' ? code : undefined;
}

function looksLikeAxiosStatusMessage(msg: string): boolean {
  return /request failed with status code \d+/i.test(msg);
}

function normalizeKnownErrors(args: {
  status?: number;
  backendCode?: string;
}): Pick<ApiErrorPresentation, 'friendlyMessage' | 'kind'> {
  const { status, backendCode } = args;

  // Not configured / optional integrations
  if (backendCode === 'AI_NOT_CONFIGURED') {
    return {
      friendlyMessage: 'AI is not enabled for this environment. Please contact an administrator to configure AI.',
      kind: 'not_configured',
    };
  }

  if (backendCode === 'EMAIL_SEND_NOT_CONFIGURED') {
    return {
      friendlyMessage: 'Email sending is not configured for this environment. Please contact an administrator.',
      kind: 'not_configured',
    };
  }

  if (backendCode === 'EMAIL_SEND_QUOTA_EXCEEDED') {
    return {
      friendlyMessage: 'Email sending quota exceeded. Please try again later or contact support.',
      kind: 'quota',
    };
  }

  if (backendCode === 'EMAIL_SEND_UNAUTHORIZED') {
    return {
      friendlyMessage: 'Email provider authorization failed. Please reconnect your email account.',
      kind: 'auth',
    };
  }

  if (backendCode === 'EMAIL_SEND_FAILED') {
    return {
      friendlyMessage: 'Email could not be sent. Please try again shortly.',
      kind: 'unknown',
    };
  }

  // Auth
  if (status === 401) {
    return {
      friendlyMessage: 'Your session has expired. Please sign in again.',
      kind: 'auth',
    };
  }

  if (status === 403) {
    return {
      friendlyMessage: 'You do not have permission to perform this action.',
      kind: 'auth',
    };
  }

  return { friendlyMessage: '', kind: undefined };
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
  const transportCode = typeof e?.code === 'string' ? e.code : undefined;

  const backendCode = extractBackendCode(e?.response?.data);
  const backendMessage = extractBackendMessage(e?.response?.data);
  const rawMessage = typeof e?.message === 'string' ? e.message : undefined;

  const normalized = normalizeKnownErrors({ status, backendCode });

  const friendlyMessage =
    (normalized.friendlyMessage ? normalized.friendlyMessage : undefined) ??
    backendMessage ??
    (rawMessage && !looksLikeAxiosStatusMessage(rawMessage) ? rawMessage : undefined) ??
    fallbackMessage;

  return {
    friendlyMessage,
    status,
    code: backendCode ?? transportCode,
    kind: normalized.kind,
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
