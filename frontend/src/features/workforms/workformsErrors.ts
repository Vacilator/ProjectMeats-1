export type WorkformsErrorContext =
  | 'catalog.load'
  | 'catalog.start'
  | 'catalog.delete'
  | 'execute.start'
  | 'executionDetails.load'
  | 'inProgress.load'
  | 'history.load'
  | 'inProgress.cancel';

type ErrorWithResponse = {
  response?: {
    status?: number;
    data?: any;
  };
  message?: string;
};

function getHttpStatus(error: unknown): number | undefined {
  const e = error as ErrorWithResponse | null;
  const status = e?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

function getBackendMessage(error: unknown): string | undefined {
  const e = error as ErrorWithResponse | null;
  const data = e?.response?.data;

  const candidates = [
    typeof data?.detail === 'string' ? data.detail : undefined,
    typeof data?.error === 'string' ? data.error : undefined,
    typeof data?.message === 'string' ? data.message : undefined,
    typeof (error as any)?.message === 'string' ? (error as any).message : undefined,
  ].filter(Boolean) as string[];

  return candidates[0];
}

function isOfflineLike(error: unknown): boolean {
  const msg = getBackendMessage(error);
  if (!msg) return false;
  return /network\s*error|failed\s*to\s*fetch|networkerror|offline/i.test(msg);
}

export function getWorkformsErrorMessage(error: unknown, fallback: string): string {
  const msg = getBackendMessage(error);
  if (!msg) return fallback;

  // Avoid leaking overly-technical Axios-ish messages as primary UX.
  if (/request failed with status code \d+/i.test(msg)) {
    return fallback;
  }

  return msg;
}

export function getWorkformsErrorUi(
  error: unknown,
  context: WorkformsErrorContext
): { title: string; message: string } {
  const status = getHttpStatus(error);

  if (status === 401) {
    return { title: 'Please sign in', message: 'Your session has expired. Sign in to continue.' };
  }

  if (status === 403) {
    return {
      title: "You don't have access",
      message: 'You do not have permission to complete this action. Contact your administrator for access.',
    };
  }

  if (status === 404) {
    const messageByContext: Partial<Record<WorkformsErrorContext, string>> = {
      'executionDetails.load':
        'This WorkForm run could not be found. It may have been deleted or you may not have access.',
      'execute.start': 'This WorkForm could not be found. It may have been deleted or you may not have access.',
    };
    return {
      title: 'Not found',
      message: messageByContext[context] ?? 'This item could not be found. It may have been deleted or you may not have access.',
    };
  }

  if (isOfflineLike(error)) {
    return { title: "You're offline", message: 'Check your internet connection, then try again.' };
  }

  const fallbackByContext: Record<WorkformsErrorContext, { title: string; message: string }> = {
    'catalog.load': {
      title: "Couldn't load catalog",
      message: 'We could not load WorkForms and forms right now. Please try again.',
    },
    'catalog.start': { title: 'Error', message: 'Failed to start. Please try again.' },
    'catalog.delete': { title: 'Error', message: 'Failed to delete WorkForm. Please try again.' },
    'execute.start': { title: 'Error', message: 'Failed to start WorkForm.' },
    'executionDetails.load': {
      title: "Couldn't load run",
      message: 'We could not load this WorkForm run. Please try again.',
    },
    'inProgress.load': {
      title: "Couldn't load in-progress work",
      message: 'We could not load in-progress items. Please try again.',
    },
    'history.load': { title: "Couldn't load history", message: 'We could not load history. Please try again.' },
    'inProgress.cancel': { title: 'Error', message: 'Failed to cancel. Please try again.' },
  };

  if (status && status >= 500) {
    const fallback = fallbackByContext[context];
    return {
      title: fallback.title,
      message: getWorkformsErrorMessage(error, fallback.message),
    };
  }

  const fallback = fallbackByContext[context];

  return {
    title: fallback.title,
    message: getWorkformsErrorMessage(error, fallback.message),
  };
}
