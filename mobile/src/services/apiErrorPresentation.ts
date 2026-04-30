export interface ApiErrorPresentation {
  friendlyMessage: string;
  status?: number;
  code?: string;
  kind?: 'auth' | 'not_configured' | 'quota' | 'network' | 'server' | 'unknown';
}

type ErrorWithResponse = {
  response?: {
    status?: number;
    data?: unknown;
  };
  config?: {
    url?: string;
  };
  code?: string;
  message?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function extractBackendMessage(data: unknown): string | undefined {
  if (!isObject(data)) return undefined;

  const anyData = data as Record<string, unknown>;
  const directKeys = ['message', 'error', 'detail', 'details'];

  for (const key of directKeys) {
    const value = anyData[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  for (const value of Object.values(anyData)) {
    if (Array.isArray(value) && value.every((item) => typeof item === 'string') && value.length > 0) {
      return value.join(' ');
    }
  }

  return undefined;
}

function extractBackendCode(data: unknown): string | undefined {
  if (!isObject(data)) return undefined;

  const anyData = data as Record<string, unknown>;
  const code = anyData.code ?? anyData.error_code;
  return typeof code === 'string' ? code : undefined;
}

function looksLikeAxiosStatusMessage(message: string): boolean {
  return /request failed with status code \d+/i.test(message);
}

function normalizeKnownErrors(args: {
  status?: number;
  backendCode?: string;
  transportCode?: string;
}): Pick<ApiErrorPresentation, 'friendlyMessage' | 'kind'> {
  const { status, backendCode, transportCode } = args;

  if (backendCode === 'AI_NOT_CONFIGURED') {
    return {
      friendlyMessage:
        'AI is not enabled for this environment. Please contact an administrator to configure AI.',
      kind: 'not_configured',
    };
  }

  if (backendCode === 'EMAIL_SEND_NOT_CONFIGURED') {
    return {
      friendlyMessage:
        'Email sending is not configured for this environment. Please contact an administrator.',
      kind: 'not_configured',
    };
  }

  if (backendCode === 'EMAIL_SEND_QUOTA_EXCEEDED') {
    return {
      friendlyMessage:
        'Email sending quota exceeded. Please try again later or contact support.',
      kind: 'quota',
    };
  }

  if (backendCode === 'EMAIL_SEND_UNAUTHORIZED') {
    return {
      friendlyMessage:
        'Email provider authorization failed. Please reconnect your email account.',
      kind: 'auth',
    };
  }

  if (backendCode === 'EMAIL_SEND_FAILED') {
    return {
      friendlyMessage: 'Email could not be sent. Please try again shortly.',
      kind: 'unknown',
    };
  }

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

  if (transportCode === 'ERR_NETWORK') {
    return {
      friendlyMessage:
        'Unable to reach the server. Please check your connection and try again.',
      kind: 'network',
    };
  }

  if (transportCode === 'ECONNABORTED') {
    return {
      friendlyMessage: 'The request took too long. Please try again.',
      kind: 'network',
    };
  }

  if (typeof status === 'number' && status >= 500) {
    return {
      friendlyMessage: 'The server is temporarily unavailable. Please try again shortly.',
      kind: 'server',
    };
  }

  return { friendlyMessage: '', kind: undefined };
}

export function getApiErrorPresentation(
  error: unknown,
  opts?: { fallbackMessage?: string }
): ApiErrorPresentation {
  const fallbackMessage =
    opts?.fallbackMessage ?? 'Something went wrong. Please try again.';
  const e = (error ?? null) as ErrorWithResponse | null;

  const status =
    typeof e?.response?.status === 'number' ? e.response.status : undefined;
  const transportCode = typeof e?.code === 'string' ? e.code : undefined;
  const backendCode = extractBackendCode(e?.response?.data);
  const backendMessage = extractBackendMessage(e?.response?.data);
  const rawMessage = typeof e?.message === 'string' ? e.message : undefined;

  const normalized = normalizeKnownErrors({
    status,
    backendCode,
    transportCode,
  });

  const friendlyMessage =
    (normalized.friendlyMessage ? normalized.friendlyMessage : undefined) ??
    backendMessage ??
    (rawMessage && !looksLikeAxiosStatusMessage(rawMessage) ? rawMessage : undefined) ??
    fallbackMessage;

  return {
    friendlyMessage,
    status,
    code: backendCode ?? transportCode,
    kind: normalized.kind ?? 'unknown',
  };
}

export function toApiErrorText(
  error: unknown,
  opts?: { fallbackMessage?: string }
): string {
  return getApiErrorPresentation(error, opts).friendlyMessage;
}
