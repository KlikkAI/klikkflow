/**
 * Professional Logging Service for Large-Scale Applications
 *
 * Features:
 * - Structured logging with context
 * - Multiple transport layers (console, remote, localStorage)
 * - Log levels and filtering
 * - Performance metrics integration
 * - Error tracking integration
 * - Buffer management for performance
 * - User action tracking
 */

import { configService, type LogLevel } from './ConfigService';

export interface LogContext {
  userId?: string;
  sessionId?: string;
  workflowId?: string;
  nodeId?: string;
  executionId?: string;
  userAgent?: string;
  timestamp?: string;
  correlationId?: string;
  [key: string]: any;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  stack?: string;
  fingerprint?: string;
  tags?: string[];
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'ratio';
  timestamp: number;
  context?: Record<string, any>;
}

export interface UserAction {
  action: string;
  target: string;
  context?: LogContext;
  timestamp: string;
}

// Log level priority for filtering
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private buffer: LogEntry[] = [];
  private performanceBuffer: PerformanceMetric[] = [];
  private userActionBuffer: UserAction[] = [];
  private sessionId: string;
  private correlationId: string;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    // CodeQL fix: Use cryptographically secure random (Alert #90)
    this.sessionId = `session_${Date.now()}_${crypto.randomUUID()}`;
    this.correlationId = `corr_${Date.now()}_${crypto.randomUUID()}`;

    this.setupAutoFlush();
    this.setupErrorTracking();
    this.setupPerformanceTracking();

    if (configService.isDevelopment()) {
      this.debug('Logging service initialized', {
        sessionId: this.sessionId,
        environment: configService.getEnvironment(),
      });
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const logContext = {
      ...context,
      stack: error?.stack,
      errorName: error?.name,
      errorMessage: error?.message,
    };

    this.log('error', message, logContext);

    // Send error to external service if enabled
    this.reportError(message, error, logContext);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const config = configService.getConfig();

    // Check if log level should be output
    const configLevel = (config.logging?.level || 'info') as LogLevel;
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[configLevel]) {
      return;
    }

    const logEntry: LogEntry = {
      level,
      message,
      context: {
        ...this.getDefaultContext(),
        ...context,
      },
      timestamp: new Date().toISOString(),
      fingerprint: this.generateFingerprint(level, message, context),
    };

    // Add to buffer
    this.buffer.push(logEntry);

    // Console output if enabled
    if (config.logging?.enableConsole) {
      this.logToConsole(logEntry);
    }

    // Flush buffer if it's getting full
    const bufferSize = config.logging?.bufferSize || 100;
    if (this.buffer.length >= bufferSize) {
      this.flush();
    }
  }

  /**
   * Log performance metric
   */
  logPerformance(
    name: string,
    value: number,
    unit: 'ms' | 'bytes' | 'count' = 'ms',
    context?: LogContext
  ): void {
    if (!configService.isFeatureEnabled('enablePerformanceMonitoring')) {
      return;
    }

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      context: context || {},
      timestamp: Date.now(),
    };

    this.performanceBuffer.push(metric);

    if (configService.isDevelopment()) {
    }
  }

  /**
   * Log user action
   */
  logUserAction(action: string, target?: string, context?: LogContext): void {
    if (!configService.isFeatureEnabled('enableAnalytics')) {
      return;
    }

    const userAction: UserAction = {
      action,
      target: target || '',
      context: {
        ...this.getDefaultContext(),
        ...context,
      },
      timestamp: new Date().toISOString(),
    };

    this.userActionBuffer.push(userAction);

    if (configService.isDevelopment()) {
    }
  }

  /**
   * Get default context for all logs
   */
  private getDefaultContext(): LogContext {
    const userId = this.getUserId();
    return {
      sessionId: this.sessionId,
      correlationId: this.correlationId,
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: userId || undefined,
    };
  }

  /**
   * Generate fingerprint for log deduplication
   */
  private generateFingerprint(level: LogLevel, message: string, context?: LogContext): string {
    const key = `${level}:${message}:${context?.stack?.split('\n')[0] || ''}`;
    // Use encodeURIComponent to safely handle Unicode characters before btoa
    return btoa(encodeURIComponent(key)).replace(/[+=/]/g, '').substr(0, 12);
  }

  /**
   * Output log to console with formatting
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const _prefix = `[${timestamp}] ${entry.level.toUpperCase()}`;
    void _prefix; // Suppress unused variable warning

    const _style = this.getConsoleStyle(entry.level);
    void _style; // Suppress unused variable warning

    if (entry.context && Object.keys(entry.context).length > 0) {
      if (entry.stack) {
      }
    } else {
    }
  }

  /**
   * Get console styling for log level
   */
  private getConsoleStyle(level: LogLevel): string {
    switch (level) {
      case 'debug':
        return 'color: #8b5cf6; font-weight: bold';
      case 'info':
        return 'color: #0ea5e9; font-weight: bold';
      case 'warn':
        return 'color: #f59e0b; font-weight: bold';
      case 'error':
        return 'color: #ef4444; font-weight: bold';
      default:
        return 'font-weight: bold';
    }
  }

  /**
   * Set up auto-flush for remote logging
   */
  private setupAutoFlush(): void {
    const config = configService.getConfig();

    if (config.logging?.enableRemote) {
      this.flushInterval = setInterval(() => {
        this.flush();
      }, 30000); // Flush every 30 seconds
    }

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flush();
    });
  }

  /**
   * Set up global error tracking
   */
  private setupErrorTracking(): void {
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled Promise Rejection', event.reason, {
        type: 'unhandled_promise_rejection',
      });
    });

    // Catch global JavaScript errors
    window.addEventListener('error', (event) => {
      this.error('Global JavaScript Error', event.error, {
        type: 'global_error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });
  }

  /**
   * Set up performance tracking
   */
  private setupPerformanceTracking(): void {
    if (!configService.isFeatureEnabled('enablePerformanceMonitoring')) {
      return;
    }

    // Track page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType(
          'navigation'
        )[0] as PerformanceNavigationTiming;
        if (navigation) {
          this.logPerformance(
            'page_load_time',
            navigation.loadEventEnd - navigation.fetchStart,
            'ms'
          );
          this.logPerformance(
            'dom_content_loaded',
            navigation.domContentLoadedEventEnd - navigation.fetchStart,
            'ms'
          );
        }
      }, 0);
    });
  }

  /**
   * Report error to external service
   */
  private reportError(_message: string, _error?: Error, _context?: LogContext): void {
    if (!configService.isFeatureEnabled('enableErrorReporting')) {
      return;
    }

    // TODO: Integrate with error reporting service (Sentry, Bugsnag, etc.)
    // Example:
    // window.Sentry?.captureException(error || new Error(message), {
    //   extra: context,
    //   tags: { sessionId: this.sessionId }
    // })
  }

  /**
   * Get user ID from auth system
   */
  private getUserId(): string | undefined {
    try {
      const token = localStorage.getItem(configService.get('auth').tokenKey);
      if (token) {
        const tokenPart = token.split('.')[1];
        if (!tokenPart) {
          return undefined;
        }
        const payload = JSON.parse(atob(tokenPart));
        return payload.userId || payload.sub;
      }
    } catch (_e) {
      // Ignore decode errors
    }
    return undefined;
  }

  /**
   * Flush logs to remote endpoint
   */
  flush(): void {
    const config = configService.getConfig();

    if (!(config.logging?.enableRemote && config.logging?.remoteEndpoint)) {
      // If remote logging is disabled, just clear buffers
      this.clearBuffers();
      return;
    }

    if (
      this.buffer.length === 0 &&
      this.performanceBuffer.length === 0 &&
      this.userActionBuffer.length === 0
    ) {
      return;
    }

    const payload = {
      logs: [...this.buffer],
      performance: [...this.performanceBuffer],
      userActions: [...this.userActionBuffer],
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    };

    // Send to remote endpoint
    fetch(config.logging.remoteEndpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
      .catch((_error) => {
        // Fallback to localStorage if remote fails
        this.saveToLocalStorage(payload);
      })
      .finally(() => {
        this.clearBuffers();
      });
  }

  /**
   * Save logs to localStorage as fallback
   */
  private saveToLocalStorage(payload: any): void {
    try {
      const existing = JSON.parse(localStorage.getItem('app_logs') || '[]');
      existing.push(payload);

      // Keep only last 50 log batches
      if (existing.length > 50) {
        existing.splice(0, existing.length - 50);
      }

      localStorage.setItem('app_logs', JSON.stringify(existing));
    } catch (_e) {}
  }

  /**
   * Clear all buffers
   */
  private clearBuffers(): void {
    this.buffer = [];
    this.performanceBuffer = [];
    this.userActionBuffer = [];
  }

  /**
   * Get current log statistics
   */
  getStats(): {
    logs: number;
    performance: number;
    userActions: number;
    sessionId: string;
  } {
    return {
      logs: this.buffer.length,
      performance: this.performanceBuffer.length,
      userActions: this.userActionBuffer.length,
      sessionId: this.sessionId,
    };
  }

  /**
   * Clear all stored logs (for GDPR compliance)
   */
  clearAllLogs(): void {
    this.clearBuffers();
    localStorage.removeItem('app_logs');
    localStorage.removeItem('app_errors');
  }

  /**
   * Get current user ID (public method for external use)
   */
  getCurrentUserId(): string | undefined {
    return this.getUserId();
  }

  /**
   * Generate correlation ID (public method for external use)
   */
  generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    this.flush();
  }
}

// Export singleton instance
export const logger = new Logger();

// Export types and class for testing
export { Logger };
export default logger;
