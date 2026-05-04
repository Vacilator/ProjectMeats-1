const REDACTED = '[REDACTED]';
const REDACTED_EMAIL = '[REDACTED:EMAIL]';
const REDACTED_PHONE = '[REDACTED:PHONE]';
const REDACTED_TOKEN = '[REDACTED:TOKEN]';
const REDACTED_COOKIE = '[REDACTED:COOKIE]';

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(?<!\w)(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s])\d{3}[-.\s]\d{4}(?!\w)/g;
const AUTH_RE = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;
const HEADER_ASSIGNMENT_RE =
  /(authorization|x-api-key|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|password|secret|cookie)(\s*[:=]\s*)([^\s,;]+)/gi;
const QUERY_ASSIGNMENT_RE =
  /(token|access_token|refresh_token|api_key|password|secret)(=)([^&\s]+)/gi;

const SENSITIVE_KEY_PARTS = [
  'password',
  'passcode',
  'secret',
  'token',
  'authorization',
  'cookie',
  'api_key',
  'apikey',
  'client_secret',
  'email',
  'phone',
  'username',
];

function redactedForKey(key: string): string {
  const lowered = key.toLowerCase();
  if (lowered.includes('email')) return REDACTED_EMAIL;
  if (lowered.includes('phone')) return REDACTED_PHONE;
  if (lowered.includes('cookie')) return REDACTED_COOKIE;
  if (
    lowered.includes('authorization') ||
    lowered.includes('token') ||
    lowered.includes('secret') ||
    lowered.includes('api') ||
    lowered.includes('password')
  ) {
    return REDACTED_TOKEN;
  }
  return REDACTED;
}

function isSensitiveKey(key: string): boolean {
  const lowered = key.toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => lowered.includes(part));
}

export function sanitizeTelemetryString(value: string): string {
  return value
    .replace(EMAIL_RE, REDACTED_EMAIL)
    .replace(PHONE_RE, REDACTED_PHONE)
    .replace(AUTH_RE, (_match, scheme: string) => `${scheme} ${REDACTED_TOKEN}`)
    .replace(HEADER_ASSIGNMENT_RE, (_match, key: string, sep: string) => `${key}${sep}${redactedForKey(key)}`)
    .replace(QUERY_ASSIGNMENT_RE, (_match, key: string, sep: string) => `${key}${sep}${REDACTED_TOKEN}`);
}

export function sanitizeTelemetryData(
  value: unknown,
  depth: number = 0,
  seen: WeakSet<object> = new WeakSet()
): unknown {
  if (depth > 6) {
    return '[REDACTED:DEPTH]';
  }

  if (value == null || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeTelemetryString(value);
  }

  if (value instanceof Error) {
    const errorRecord: Record<string, unknown> = {
      name: value.name,
      message: sanitizeTelemetryString(value.message),
    };

    if (value.stack) {
      errorRecord.stack = sanitizeTelemetryString(value.stack);
    }

    const anyError = value as Error & {
      code?: unknown;
      status?: unknown;
      response?: unknown;
      config?: unknown;
    };

    if (anyError.code !== undefined) {
      errorRecord.code = anyError.code;
    }
    if (anyError.status !== undefined) {
      errorRecord.status = anyError.status;
    }
    if (anyError.response !== undefined) {
      errorRecord.response = sanitizeTelemetryData(anyError.response, depth + 1, seen);
    }
    if (anyError.config !== undefined) {
      errorRecord.config = sanitizeTelemetryData(anyError.config, depth + 1, seen);
    }

    return errorRecord;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeTelemetryData(item, depth + 1, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) {
      return '[REDACTED:CYCLE]';
    }
    seen.add(value as object);

    const output: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      output[key] = isSensitiveKey(key)
        ? redactedForKey(key)
        : sanitizeTelemetryData(item, depth + 1, seen);
    });
    return output;
  }

  return sanitizeTelemetryString(String(value));
}
