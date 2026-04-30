type ErrorWithResponseStatus = {
  response?: {
    status?: number;
  };
};

export function getErrorStatus(error: unknown): number | undefined {
  const status = (error as ErrorWithResponseStatus | null)?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

export function isAuthError(error: unknown): boolean {
  const status = getErrorStatus(error);
  return status === 401 || status === 403;
}
