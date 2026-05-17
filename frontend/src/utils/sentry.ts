/**
 * Sentry Initialization for Frontend
 * 
 * Phase 6.4: Real-time error tracking and performance monitoring
 * 
 * Features:
 * - Error boundary integration
 * - Performance transaction tracking
 * - User context tracking
 * - Tenant-aware error tagging
 * - Release tracking from CI/CD
 */

import * as Sentry from '@sentry/react';

import { logger } from '@/utils/logger';
import { sanitizeTelemetryData, sanitizeTelemetryString } from '@/utils/telemetrySanitizer';
import { useEffect } from 'react';
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';

interface SentryConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  enabled?: boolean;
}

/**
 * Initialize Sentry for production error tracking
 */
export const initSentry = (config?: SentryConfig): void => {
  // Get configuration from environment or window.ENV
  const sentryDsn =
    config?.dsn ||
    window.ENV?.SENTRY_DSN ||
    (typeof process !== 'undefined' ? process.env?.REACT_APP_SENTRY_DSN : undefined);

  const environment =
    config?.environment ||
    window.ENV?.ENVIRONMENT ||
    (typeof process !== 'undefined' ? process.env?.REACT_APP_ENVIRONMENT : undefined) ||
    'development';

  const release =
    config?.release ||
    window.ENV?.GIT_COMMIT_SHA ||
    (typeof process !== 'undefined' ? process.env?.REACT_APP_GIT_COMMIT_SHA : undefined) ||
    (typeof process !== 'undefined' ? process.env?.REACT_APP_COMMIT_SHA : undefined) ||
    'unknown';

  const enabled = config?.enabled ?? window.ENV?.SENTRY_ENABLED === 'true';
  
  // Don't initialize in development unless explicitly enabled
  if (environment === 'development' && !enabled) {
    return;
  }
  
  // Don't initialize if DSN is missing
  if (!sentryDsn) {
    logger.warn('Sentry DSN not configured, error tracking disabled', { component: 'Sentry' });
    return;
  }
  
  // Determine sample rates based on environment
  const tracesSampleRate = environment === 'production' ? 0.1 : 1.0; // 10% in prod, 100% in dev/uat
  const replaysSessionSampleRate = environment === 'production' ? 0.1 : 0.0; // 10% in prod, disabled in dev
  const replaysOnErrorSampleRate = environment === 'production' ? 1.0 : 0.0; // 100% on errors in prod
  
  Sentry.init({
    dsn: sentryDsn,
    environment,
    release,
    
    // Integrations
    integrations: [
      // React Router v7 tracing integration (Sentry v10)
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),

      // Session Replay (Sentry v10)
      Sentry.replayIntegration({
        maskAllText: true, // Privacy: mask all text content
        blockAllMedia: true, // Privacy: block media elements
      }),
    ],
    
    // Performance Monitoring
    tracesSampleRate,
    
    // Session Replay (for debugging production issues)
    replaysSessionSampleRate,
    replaysOnErrorSampleRate,
    
    // Error Filtering
      beforeSend(event, hint) {
      // Filter out non-actionable errors
      const error = hint.originalException;
      
      // Filter network errors that are expected (e.g., offline)
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (typeof (error as { message?: string }).message === 'string'
          ? (error as { message: string }).message
          : '').toLowerCase();
        
        // Common transient errors to ignore
        const ignoredPatterns = [
          'network error',
          'failed to fetch',
          'networkerror',
          'load failed',
          'cancelled',
        ];
        
        if (ignoredPatterns.some(pattern => message.includes(pattern))) {
          return null; // Don't send to Sentry
        }
      }
      
      // Filter out React hydration warnings (development artifact)
      if (event.message?.includes('hydrat')) {
        return null;
      }
      
      // Mark repo frames as "in-app" so stack traces are easier to route via CODEOWNERS.
      // Note: Sentry JS SDK v10 types don't expose inAppInclude; we tag frames directly.
      try {
        const exceptions = event.exception?.values || [];
        for (const ex of exceptions) {
          const frames = ex.stacktrace?.frames || [];
          for (const frame of frames) {
            const f = frame as { filename?: string; in_app?: boolean };
            if (typeof f.filename === 'string') {
              if (f.filename.includes('/backend/') || f.filename.includes('/tenant_apps/')) {
                f.in_app = true;
              }
            }
          }
        }
      } catch (err) {
        logger.debug('Failed to tag in-app stack frames for Sentry event', { component: 'Sentry' }, err);
      }

      return sanitizeTelemetryData(event) as typeof event;
      },
      beforeBreadcrumb(breadcrumb) {
        return sanitizeTelemetryData(breadcrumb) as typeof breadcrumb;
      },
      beforeSendTransaction(event) {
        return sanitizeTelemetryData(event) as typeof event;
      },
    
    // Privacy
    // Required for Seer (user-impact analysis) + richer debugging context.
    sendDefaultPii: false,
    
    // Context
    initialScope: {
      tags: {
        'app.version': release,
        'app.environment': environment,
      },
    },
    
    // Additional Options
    attachStacktrace: true,
    maxBreadcrumbs: 50,
    debug: environment === 'development',
  });
  
  logger.debug('Initialized', {
    component: 'Sentry',
    metadata: { environment, release },
  });
};

/**
 * Set user context for error tracking
 */
export const setSentryUser = (
  userId: string,
  _email?: string,
  tenant?: string,
  _username?: string
): void => {
  Sentry.setUser({
    id: userId,
  });

  if (tenant) {
    Sentry.setTag('tenant.id', sanitizeTelemetryString(tenant));
  }
};

/**
 * Clear user context (on logout)
 */
export const clearSentryUser = (): void => {
  Sentry.setUser(null);
};

/**
 * Set tenant context
 */
export const setSentryTenant = (tenantId: string, tenantName?: string): void => {
  Sentry.setTag('tenant.id', sanitizeTelemetryString(tenantId));
  Sentry.setContext('tenant', {
    id: sanitizeTelemetryString(tenantId),
    ...(tenantName ? { name: sanitizeTelemetryString(tenantName) } : {}),
  });
};

/**
 * Add breadcrumb for user actions
 */
export const addSentryBreadcrumb = (
  category: string,
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, unknown>
): void => {
  Sentry.addBreadcrumb({
    category,
    message: sanitizeTelemetryString(message),
    level,
    data: sanitizeTelemetryData(data) as Record<string, unknown> | undefined,
    timestamp: Date.now() / 1000,
  });
};

/**
 * Start a performance transaction
 */
export const startSentryTransaction = (name: string, op: string) => {
  // Sentry v10 no longer exposes startTransaction; spans cover this use-case.
  if (!Sentry.getClient()) return undefined;
  return Sentry.startInactiveSpan({ name, op });
};

/**
 * Capture an exception manually
 */
export const captureSentryException = (
  error: Error,
  context?: {
    component?: string;
    tenant?: string;
    metadata?: Record<string, unknown>;
  }
): void => {
  Sentry.captureException(error, {
    tags: {
      component: context?.component ? sanitizeTelemetryString(context.component) : undefined,
      tenant: context?.tenant ? sanitizeTelemetryString(context.tenant) : undefined,
    },
    extra: sanitizeTelemetryData(context?.metadata) as Record<string, unknown> | undefined,
  });
};

/**
 * Capture a message manually
 */
export const captureSentryMessage = (
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info',
  context?: {
    component?: string;
    tenant?: string;
    metadata?: Record<string, unknown>;
  }
): void => {
  Sentry.captureMessage(sanitizeTelemetryString(message), {
    level,
    tags: {
      component: context?.component ? sanitizeTelemetryString(context.component) : undefined,
      tenant: context?.tenant ? sanitizeTelemetryString(context.tenant) : undefined,
    },
    extra: sanitizeTelemetryData(context?.metadata) as Record<string, unknown> | undefined,
  });
};

// Export Sentry instance for advanced usage
export { Sentry };
