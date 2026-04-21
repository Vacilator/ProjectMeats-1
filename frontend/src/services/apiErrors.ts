export type ApiServiceErrorKind = 'circuit_breaker' | 'http' | 'network' | 'unknown';

export interface ApiRequestMeta {
  method?: string;
  url?: string;
  baseURL?: string;
}

export class ApiServiceError extends Error {
  kind: ApiServiceErrorKind;
  status?: number;
  request?: ApiRequestMeta;
  responseData?: unknown;
  originalError?: unknown;

  constructor(
    message: string,
    opts: {
      kind: ApiServiceErrorKind;
      status?: number;
      request?: ApiRequestMeta;
      responseData?: unknown;
      originalError?: unknown;
    }
  ) {
    super(message);
    this.name = 'ApiServiceError';
    this.kind = opts.kind;
    this.status = opts.status;
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
    request: args.request,
    responseData: args.responseData,
    originalError: args.originalError,
  });
}
