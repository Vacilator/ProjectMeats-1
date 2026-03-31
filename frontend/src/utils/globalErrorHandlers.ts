/**
 * Global runtime error handlers
 *
 * Captures unhandled promise rejections and window errors and routes them through
 * our centralized logger (and Sentry in production when available).
 */

import { logger } from './logger';

function safeStringify(value: unknown): string {
  try {
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function initGlobalErrorHandlers(appName: string = 'frontend'): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : new Error(safeStringify(reason));

    logger.error('Unhandled promise rejection', {
      component: 'GlobalErrorHandlers',
      metadata: {
        app: appName,
        reasonType: typeof reason,
      },
    }, error);
  });

  window.addEventListener('error', (event: ErrorEvent) => {
    const error = event.error instanceof Error ? event.error : new Error(event.message || 'Window error');

    logger.error('Window error', {
      component: 'GlobalErrorHandlers',
      metadata: {
        app: appName,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    }, error);
  });
}
