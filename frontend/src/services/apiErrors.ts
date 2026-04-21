export type ApiServiceErrorKind = 'circuit_breaker' | 'http' | 'network' | 'unknown';

export interface ApiRequestMeta {
  method?: string;
  url?: string;
  baseURL?: string;
}

export class ApiServiceError extends Error {
  kind: ApiServiceErrorKind;

  /** A message intended to be safe and helpful for end users. */
  friendlyMessage: string;

  status?: number;

  /** Transport/error code when known. */
  code?: string;

  request?: ApiRequestMeta;
  responseData?: unknown;
  originalError?: unknown;

  constructor(
    message: string,
    opts: {
      kind: ApiServiceErrorKind;
      status?: number;
      code?: string;
      request?: ApiRequestMeta;
      responseData?: unknown;
      originalError?: unknown;
    }
  ) {
    super(message);
    this.name = 'ApiServiceError';
    this.kind = opts.kind;
    this.friendlyMessage = message;
    this.status = opts.status;
    this.code = opts.code;
    this.request = opts.request;
    this.responseData = opts.responseData;
    this.originalError = opts.originalError;
  }
}

export function createCircuitBreakerError(args: {
  friendlyMessage: string;
  status: number;
  request?: ApiRequestMeta;
  responseData?: unknown;
  originalError?: unknown;
}): ApiServiceError {
  return new ApiServiceError(args.friendlyMessage, {
    kind: 'circuit_breaker',
    status: args.status,
    code: 'CIRCUIT_BREAKER',
    request: args.request,
    responseData: args.responseData,
    originalError: args.originalError,
  });
}
