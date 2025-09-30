/**
 * Logger Service
 * TODO: Implement comprehensive logging
 */

export interface LogContext {
  [key: string]: any;
}

class Logger {
  info(message: string, context?: LogContext) {
    console.log('[INFO]', message, context || '');
  }

  error(message: string, context?: LogContext) {
    console.error('[ERROR]', message, context || '');
  }

  warn(message: string, context?: LogContext) {
    console.warn('[WARN]', message, context || '');
  }

  debug(message: string, context?: LogContext) {
    console.debug('[DEBUG]', message, context || '');
  }
}

export const logger = new Logger();