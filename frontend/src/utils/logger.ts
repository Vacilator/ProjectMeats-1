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
  metadata?: Record<string, any>;
}

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
    data?: any
  ): void {
    const formattedMessage = this.formatMessage(level, message, context);
    
    const consoleMethod = level === 'debug' || level === 'info' 
      ? console.log 
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
  debug(message: string, context?: LogContext, data?: any): void {
    if (!this.shouldLog('debug')) return;
    this.logToConsole('debug', message, context, data);
  }

  /**
   * Info-level logging (development only by default)
   */
  info(message: string, context?: LogContext, data?: any): void {
    if (!this.shouldLog('info')) return;
    this.logToConsole('info', message, context, data);
  }

  /**
   * Warning-level logging (always logged)
   */
  warn(message: string, context?: LogContext, data?: any): void {
    if (!this.shouldLog('warn')) return;
    this.logToConsole('warn', message, context, data);
    
    // Send to Sentry in production
    if (!this.isDevelopment && typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureMessage(message, {
        level: 'warning',
        tags: {
          component: context?.component,
          tenant: context?.tenant,
        },
        extra: {
          ...context?.metadata,
          data,
        },
      });
    }
  }

  /**
   * Error-level logging (always logged)
   */
  error(message: string, context?: LogContext, data?: any): void {
    if (!this.shouldLog('error')) return;
    this.logToConsole('error', message, context, data);
    
    // Send to Sentry in production
    if (!this.isDevelopment && typeof window !== 'undefined' && (window as any).Sentry) {
      if (data instanceof Error) {
        (window as any).Sentry.captureException(data, {
          tags: {
            component: context?.component,
            tenant: context?.tenant,
          },
          extra: {
            message,
            ...context?.metadata,
          },
        });
      } else {
        (window as any).Sentry.captureMessage(message, {
          level: 'error',
          tags: {
            component: context?.component,
            tenant: context?.tenant,
          },
          extra: {
            ...context?.metadata,
            data,
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
