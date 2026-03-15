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
  const sentryDsn = config?.dsn || (window as any).ENV?.SENTRY_DSN;
  const environment = config?.environment || (window as any).ENV?.ENVIRONMENT || 'development';
  const release = config?.release || (window as any).ENV?.GIT_COMMIT_SHA || 'unknown';
  const enabled = config?.enabled ?? (window as any).ENV?.SENTRY_ENABLED === 'true';
  
  // Don't initialize in development unless explicitly enabled
  if (environment === 'development' && !enabled) {
    console.log('[Sentry] Skipped initialization in development');
    return;
  }
  
  // Don't initialize if DSN is missing
  if (!sentryDsn) {
    console.warn('[Sentry] DSN not configured, error tracking disabled');
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
        const message = (error as any).message?.toLowerCase() || '';
        
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
      
      return event;
    },
    
    // Privacy
    sendDefaultPii: false, // Don't send PII by default (GDPR)
    
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
  
  console.log(`[Sentry] Initialized for ${environment} (release: ${release})`);
};

/**
 * Set user context for error tracking
 */
export const setSentryUser = (userId: string, email?: string, tenant?: string): void => {
  Sentry.setUser({
    id: userId,
    email,
    tenant,
  });
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
  Sentry.setTag('tenant.id', tenantId);
  Sentry.setTag('tenant.name', tenantName || 'unknown');
  Sentry.setContext('tenant', {
    id: tenantId,
    name: tenantName,
  });
};

/**
 * Add breadcrumb for user actions
 */
export const addSentryBreadcrumb = (
  category: string,
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, any>
): void => {
  Sentry.addBreadcrumb({
    category,
    message,
    level,
    data,
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
    metadata?: Record<string, any>;
  }
): void => {
  Sentry.captureException(error, {
    tags: {
      component: context?.component,
      tenant: context?.tenant,
    },
    extra: context?.metadata,
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
    metadata?: Record<string, any>;
  }
): void => {
  Sentry.captureMessage(message, {
    level,
    tags: {
      component: context?.component,
      tenant: context?.tenant,
    },
    extra: context?.metadata,
  });
};

// Export Sentry instance for advanced usage
export { Sentry };
