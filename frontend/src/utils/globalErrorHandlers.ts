/**
 * Global runtime error handlers
 *
 * Captures unhandled promise rejections and window errors and routes them through
 * our centralized logger (and Sentry in production when available).
 */

import { logger } from './logger';
import { sanitizeTelemetryData } from './telemetrySanitizer';

export function initGlobalErrorHandlers(appName: string = 'frontend'): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : new Error('Unhandled promise rejection');

    logger.error('Unhandled promise rejection', {
      component: 'GlobalErrorHandlers',
      metadata: {
        app: appName,
        reasonType: typeof reason,
        reason: sanitizeTelemetryData(reason),
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
