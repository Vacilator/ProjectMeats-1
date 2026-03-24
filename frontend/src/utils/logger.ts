/**
 * Centralized Logging Utility
 * 
 * Replaces console.log with structured logging that can be:
 * - Disabled in production
 * - Filtered by level
 * - Sent to external services (Sentry, LogRocket, etc.)
 * - Formatted consistently
 */

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
    
    if (context?.component) {
      return `${prefix} [${context.component}] ${message}`;
    }
    
    return `${prefix} ${message}`;
  }

  private logToConsole(
    level: LogLevel,
    message: string,
    context?: LogContext,
    data?: unknown
  ): void {
    const formattedMessage = this.formatMessage(level, message, context);
    
    const consoleMethod =
      level === 'debug'
        ? console.debug
        : level === 'info'
          ? console.info
          : level === 'warn'
            ? console.warn
            : console.error;

    if (data !== undefined) {
      if (context?.metadata) {
        consoleMethod(formattedMessage, { ...context.metadata, data });
      } else {
        consoleMethod(formattedMessage, data);
      }
    } else if (context?.metadata) {
      consoleMethod(formattedMessage, context.metadata);
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

    this.logToConsole('warn', message, hasAnyContextKey ? ctx : undefined, hasAnyContextKey ? data : contextOrData);

    const sentryData = hasAnyContextKey ? data : contextOrData;

    // Send to Sentry in production
    if (!this.isDevelopment && typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureMessage(message, {
        level: 'warning',
        tags: {
          component: hasAnyContextKey ? ctx?.component : undefined,
          tenant: hasAnyContextKey ? ctx?.tenant : undefined,
        },
        extra: {
          ...(hasAnyContextKey ? ctx?.metadata : undefined),
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

    this.logToConsole('error', message, hasAnyContextKey ? ctx : undefined, hasAnyContextKey ? data : contextOrData);

    const sentryData = hasAnyContextKey ? data : contextOrData;

    // Send to Sentry in production
    if (!this.isDevelopment && typeof window !== 'undefined' && (window as any).Sentry) {
      if (sentryData instanceof Error) {
        (window as any).Sentry.captureException(sentryData, {
          tags: {
            component: hasAnyContextKey ? ctx?.component : undefined,
            tenant: hasAnyContextKey ? ctx?.tenant : undefined,
          },
          extra: {
            message,
            ...(hasAnyContextKey ? ctx?.metadata : undefined),
          },
        });
      } else {
        (window as any).Sentry.captureMessage(message, {
          level: 'error',
          tags: {
            component: hasAnyContextKey ? ctx?.component : undefined,
            tenant: hasAnyContextKey ? ctx?.tenant : undefined,
          },
          extra: {
            ...(hasAnyContextKey ? ctx?.metadata : undefined),
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
    console.table(data, columns);
  }
}

// Singleton instance
export const logger = new Logger();

// Named exports for convenience
export const { debug, info, warn, error, time, group, table } = logger;
