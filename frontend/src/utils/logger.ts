/* eslint-disable no-console -- This IS the logging layer; raw console access is intentional. */
/**
 * Centralized Logging Utility
 * 
 * Replaces console.log with structured logging that can be:
 * - Disabled in production
 * - Filtered by level
 * - Sent to external services (Sentry, LogRocket, etc.)
 * - Formatted consistently
 */

import { sanitizeTelemetryData, sanitizeTelemetryString } from './telemetrySanitizer';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  component?: string;
  user?: string;
  tenant?: string;
  metadata?: Record<string, unknown>;
}

type LogContextOrData = LogContext | unknown;

class Logger {
  private isDevelopment: boolean;
  private minLevel: LogLevel;
  private enabledLevels: Set<LogLevel>;

  constructor() {
    this.isDevelopment = import.meta.env.DEV || process.env.NODE_ENV === 'development';
    this.minLevel = this.isDevelopment ? 'debug' : 'warn';
    this.enabledLevels = this.getEnabledLevels();
  }

  private getEnabledLevels(): Set<LogLevel> {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const minIndex = levels.indexOf(this.minLevel);
    return new Set(levels.slice(minIndex));
  }

  private shouldLog(level: LogLevel): boolean {
    return this.enabledLevels.has(level);
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const sanitizedMessage = sanitizeTelemetryString(message);
    
    if (context?.component) {
      return `${prefix} [${sanitizeTelemetryString(context.component)}] ${sanitizedMessage}`;
    }
    
    return `${prefix} ${sanitizedMessage}`;
  }

  private logToConsole(
    level: LogLevel,
    message: string,
    context?: LogContext,
    data?: unknown
  ): void {
    const sanitizedContext = context
      ? {
          ...context,
          user: context.user ? sanitizeTelemetryString(context.user) : context.user,
          tenant: context.tenant ? sanitizeTelemetryString(context.tenant) : context.tenant,
          metadata:
            context.metadata &&
            (sanitizeTelemetryData(context.metadata) as Record<string, unknown>),
        }
      : undefined;
    const sanitizedData = data === undefined ? undefined : sanitizeTelemetryData(data);
    const formattedMessage = this.formatMessage(level, message, sanitizedContext);
    
    const consoleMethod =
      level === 'debug'
        ? console.debug
        : level === 'info'
          ? console.info
          : level === 'warn'
            ? console.warn
            : console.error;

    if (sanitizedData !== undefined) {
      if (sanitizedContext?.metadata) {
        consoleMethod(formattedMessage, { ...sanitizedContext.metadata, data: sanitizedData });
      } else {
        consoleMethod(formattedMessage, sanitizedData);
      }
    } else if (sanitizedContext?.metadata) {
      consoleMethod(formattedMessage, sanitizedContext.metadata);
    } else {
      consoleMethod(formattedMessage);
    }
  }

  /**
   * Debug-level logging (development only)
   */
  debug(message: string, data?: unknown): void;
  debug(message: string, context?: LogContext, data?: unknown): void;
  debug(message: string, contextOrData?: LogContextOrData, data?: unknown): void {
    if (!this.shouldLog('debug')) return;

    if (contextOrData && typeof contextOrData === 'object' && !Array.isArray(contextOrData)) {
      const ctx = contextOrData as LogContext;
      const hasAnyContextKey = 'component' in ctx || 'user' in ctx || 'tenant' in ctx || 'metadata' in ctx;
      if (hasAnyContextKey) {
        this.logToConsole('debug', message, ctx, data);
        return;
      }
    }

    this.logToConsole('debug', message, undefined, contextOrData);
  }

  /**
   * Info-level logging (development only by default)
   */
  info(message: string, data?: unknown): void;
  info(message: string, context?: LogContext, data?: unknown): void;
  info(message: string, contextOrData?: LogContextOrData, data?: unknown): void {
    if (!this.shouldLog('info')) return;

    if (contextOrData && typeof contextOrData === 'object' && !Array.isArray(contextOrData)) {
      const ctx = contextOrData as LogContext;
      const hasAnyContextKey = 'component' in ctx || 'user' in ctx || 'tenant' in ctx || 'metadata' in ctx;
      if (hasAnyContextKey) {
        this.logToConsole('info', message, ctx, data);
        return;
      }
    }

    this.logToConsole('info', message, undefined, contextOrData);
  }

  /**
   * Warning-level logging (always logged)
   */
  warn(message: string, data?: unknown): void;
  warn(message: string, context?: LogContext, data?: unknown): void;
  warn(message: string, contextOrData?: LogContextOrData, data?: unknown): void {
    if (!this.shouldLog('warn')) return;

    const ctx =
      contextOrData && typeof contextOrData === 'object' && !Array.isArray(contextOrData)
        ? (contextOrData as LogContext)
        : undefined;
    const hasAnyContextKey =
      !!ctx && ('component' in ctx || 'user' in ctx || 'tenant' in ctx || 'metadata' in ctx);
    const rawSentryData = hasAnyContextKey ? data : contextOrData;
    const sentryData = sanitizeTelemetryData(rawSentryData);

    this.logToConsole('warn', message, hasAnyContextKey ? ctx : undefined, hasAnyContextKey ? data : contextOrData);

    // Send to Sentry in production
    if (!this.isDevelopment && typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.captureMessage(sanitizeTelemetryString(message), {
        level: 'warning',
        tags: {
          component: hasAnyContextKey ? sanitizeTelemetryString(ctx?.component || '') : undefined,
          tenant: hasAnyContextKey ? sanitizeTelemetryString(ctx?.tenant || '') : undefined,
        },
        extra: {
          ...(hasAnyContextKey
            ? (sanitizeTelemetryData(ctx?.metadata) as Record<string, unknown> | undefined)
            : undefined),
          data: sentryData,
        },
      });
    }
  }

  /**
   * Error-level logging (always logged)
   */
  error(message: string, data?: unknown): void;
  error(message: string, context?: LogContext, data?: unknown): void;
  error(message: string, contextOrData?: LogContextOrData, data?: unknown): void {
    if (!this.shouldLog('error')) return;

    const ctx =
      contextOrData && typeof contextOrData === 'object' && !Array.isArray(contextOrData)
        ? (contextOrData as LogContext)
        : undefined;
    const hasAnyContextKey =
      !!ctx && ('component' in ctx || 'user' in ctx || 'tenant' in ctx || 'metadata' in ctx);
    const rawSentryData = hasAnyContextKey ? data : contextOrData;
    const sentryData = sanitizeTelemetryData(rawSentryData);

    this.logToConsole('error', message, hasAnyContextKey ? ctx : undefined, hasAnyContextKey ? data : contextOrData);

    // Send to Sentry in production
    if (!this.isDevelopment && typeof window !== 'undefined' && window.Sentry) {
      if (rawSentryData instanceof Error) {
        window.Sentry.captureException(rawSentryData, {
          tags: {
            component: hasAnyContextKey ? sanitizeTelemetryString(ctx?.component || '') : undefined,
            tenant: hasAnyContextKey ? sanitizeTelemetryString(ctx?.tenant || '') : undefined,
          },
          extra: {
            message: sanitizeTelemetryString(message),
            ...(hasAnyContextKey
              ? (sanitizeTelemetryData(ctx?.metadata) as Record<string, unknown> | undefined)
              : undefined),
          },
        });
      } else {
        window.Sentry.captureMessage(sanitizeTelemetryString(message), {
          level: 'error',
          tags: {
            component: hasAnyContextKey ? sanitizeTelemetryString(ctx?.component || '') : undefined,
            tenant: hasAnyContextKey ? sanitizeTelemetryString(ctx?.tenant || '') : undefined,
          },
          extra: {
            ...(hasAnyContextKey
              ? (sanitizeTelemetryData(ctx?.metadata) as Record<string, unknown> | undefined)
              : undefined),
            data: sentryData,
          },
        });
      }
    }
  }

  /**
   * Performance timing helper
   */
  time(label: string): () => void {
    if (!this.shouldLog('debug')) return () => {};
    
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.debug(`${label} took ${duration.toFixed(2)}ms`);
    };
  }

  /**
   * Group related logs
   */
  group(label: string, fn: () => void): void {
    if (!this.shouldLog('debug')) {
      fn();
      return;
    }
    
    console.group(label);
    try {
      fn();
    } finally {
      console.groupEnd();
    }
  }

  /**
   * Table logging for arrays/objects
   */
  table(data: any, columns?: string[]): void {
    if (!this.shouldLog('debug')) return;
    console.table(sanitizeTelemetryData(data), columns);
  }
}

// Singleton instance
export const logger = new Logger();

// Named exports for convenience
export const { debug, info, warn, error, time, group, table } = logger;
