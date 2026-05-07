/**
 * Global runtime error handlers
 *
 * Captures unhandled promise rejections and window errors and routes them through
 * our centralized logger (and Sentry in production when available).
 */

import { logger } from './logger';
import { sanitizeTelemetryData } from './telemetrySanitizer';
import { attemptChunkRecovery } from './chunkLoadRecovery';

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

    if (attemptChunkRecovery(error, { source: `${appName}-unhandledrejection` })) {
      event.preventDefault();
    }
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

    if (attemptChunkRecovery(error, { source: `${appName}-window-error` })) {
      event.preventDefault();
    }
  });

  window.addEventListener('vite:preloadError', (event: Event) => {
    const preloadEvent = event as CustomEvent<unknown>;
    const detail = preloadEvent.detail;
    const error =
      detail instanceof Error
        ? detail
        : new Error(typeof detail === 'string' ? detail : 'Vite preload error');

    logger.error(
      'Vite preload error',
      {
        component: 'GlobalErrorHandlers',
        metadata: {
          app: appName,
          detail: sanitizeTelemetryData(detail),
        },
      },
      error
    );

    if (attemptChunkRecovery(error, { source: `${appName}-vite-preload` })) {
      event.preventDefault();
    }
  });
}
