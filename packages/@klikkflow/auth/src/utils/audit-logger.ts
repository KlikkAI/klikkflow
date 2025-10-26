import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  userId?: string;
  email?: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export class AuditLogger extends EventEmitter {
  private logs: AuditLogEntry[] = [];
  private maxLogs = 10000;

  constructor(maxLogs?: number) {
    super();
    if (maxLogs !== undefined) {
      this.maxLogs = maxLogs;
    }
  }

  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    const logEntry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      ...entry,
    };

    this.logs.push(logEntry);

    // Keep logs under max limit
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Emit log event for external handlers
    this.emit('audit', logEntry);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      // Log to console in development mode
    }
  }

  getRecentLogs(limit = 100): AuditLogEntry[] {
    return this.logs.slice(-limit);
  }

  getLogsByUser(userId: string, limit = 100): AuditLogEntry[] {
    return this.logs.filter((log) => log.userId === userId).slice(-limit);
  }

  getLogsByAction(action: string, limit = 100): AuditLogEntry[] {
    return this.logs.filter((log) => log.action === action).slice(-limit);
  }

  getLogsByDateRange(startDate: Date, endDate: Date): AuditLogEntry[] {
    return this.logs.filter((log) => log.timestamp >= startDate && log.timestamp <= endDate);
  }

  clearLogs(): void {
    this.logs = [];
  }

  private generateId(): string {
    return `audit_${Date.now()}_${randomBytes(6).toString('hex')}`;
  }

  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }

    // CSV export
    const headers = [
      'id',
      'timestamp',
      'action',
      'userId',
      'email',
      'organizationId',
      'ipAddress',
      'userAgent',
      'success',
      'errorMessage',
    ];

    const rows = this.logs.map((log) => [
      log.id,
      log.timestamp.toISOString(),
      log.action,
      log.userId || '',
      log.email || '',
      log.organizationId || '',
      log.ipAddress || '',
      log.userAgent || '',
      log.success.toString(),
      log.errorMessage || '',
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }
}
