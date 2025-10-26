import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Logger } from '@klikkflow/core';
import { z } from 'zod';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  organizationId?: string;

  // Event classification
  category: 'authentication' | 'authorization' | 'data' | 'system' | 'workflow' | 'security';
  action: string;
  resource: string;
  resourceId?: string;

  // Event details
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'success' | 'failure' | 'error';
  message: string;

  // Context information
  metadata: {
    ip?: string;
    userAgent?: string;
    method?: string;
    path?: string;
    duration?: number;
    [key: string]: unknown;
  };

  // Data changes (for data events)
  changes?: {
    before?: unknown;
    after?: unknown;
    fields?: string[];
  };

  // Risk assessment
  riskScore?: number;
  riskFactors?: string[];

  // Compliance tags
  complianceTags?: string[];
}

export interface AuditQuery {
  userId?: string;
  organizationId?: string;
  category?: string;
  action?: string;
  resource?: string;
  severity?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  riskScoreMin?: number;
  riskScoreMax?: number;
  complianceTags?: string[];
  limit?: number;
  offset?: number;
}

export interface AuditReport {
  id: string;
  generatedAt: Date;
  generatedBy: string;
  reportType: 'compliance' | 'security' | 'activity' | 'risk';
  timeRange: {
    start: Date;
    end: Date;
  };
  filters: AuditQuery;
  summary: {
    totalEvents: number;
    eventsByCategory: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    riskDistribution: Record<string, number>;
    topUsers: Array<{ userId: string; eventCount: number }>;
    topResources: Array<{ resource: string; eventCount: number }>;
  };
  events: AuditEvent[];
  recommendations?: string[];
}

const AuditEventSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  organizationId: z.string().optional(),
  category: z.enum(['authentication', 'authorization', 'data', 'system', 'workflow', 'security']),
  action: z.string(),
  resource: z.string(),
  resourceId: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['success', 'failure', 'error']),
  message: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  changes: z
    .object({
      before: z.any().optional(),
      after: z.any().optional(),
      fields: z.array(z.string()).optional(),
    })
    .optional(),
  riskScore: z.number().min(0).max(100).optional(),
  riskFactors: z.array(z.string()).optional(),
  complianceTags: z.array(z.string()).optional(),
});

export class AuditLogger extends EventEmitter {
  private logger: Logger;
  private events: AuditEvent[] = [];
  private maxEvents: number;
  private retentionDays: number;
  private complianceMode: boolean;

  constructor(
    options: {
      maxEvents?: number;
      retentionDays?: number;
      complianceMode?: boolean;
    } = {}
  ) {
    super();
    this.logger = new Logger('AuditLogger');
    this.maxEvents = options.maxEvents || 100000;
    this.retentionDays = options.retentionDays || 365;
    this.complianceMode = options.complianceMode ?? false;

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Log an audit event
   */
  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string> {
    try {
      const auditEvent: AuditEvent = {
        ...event,
        id: this.generateEventId(),
        timestamp: new Date(),
        riskScore: event.riskScore || this.calculateRiskScore(event),
        riskFactors: event.riskFactors || this.identifyRiskFactors(event),
        complianceTags: event.complianceTags || this.generateComplianceTags(event),
      };

      // Validate event
      AuditEventSchema.parse(auditEvent);

      // Store event
      this.events.push(auditEvent);

      // Maintain size limit
      if (this.events.length > this.maxEvents) {
        this.events = this.events.slice(-this.maxEvents);
      }

      // Emit event for real-time processing
      this.emit('audit_event', auditEvent);

      // Log high-severity events
      if (auditEvent.severity === 'high' || auditEvent.severity === 'critical') {
        this.logger.warn('High-severity audit event', {
          eventId: auditEvent.id,
          category: auditEvent.category,
          action: auditEvent.action,
          severity: auditEvent.severity,
          riskScore: auditEvent.riskScore,
        });
      }

      // Compliance mode logging
      if (this.complianceMode) {
        this.logger.info('Compliance audit event', {
          eventId: auditEvent.id,
          userId: auditEvent.userId,
          action: auditEvent.action,
          resource: auditEvent.resource,
          complianceTags: auditEvent.complianceTags,
        });
      }

      return auditEvent.id;
    } catch (error) {
      this.logger.error('Failed to log audit event', { error, event });
      throw error;
    }
  }

  /**
   * Authentication events
   */
  async logAuthentication(
    action:
      | 'login'
      | 'logout'
      | 'login_failed'
      | 'password_change'
      | 'mfa_enabled'
      | 'mfa_disabled',
    userId?: string,
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    return this.logEvent({
      category: 'authentication',
      action,
      resource: 'user_session',
      resourceId: userId,
      severity: action.includes('failed') ? 'medium' : 'low',
      status: action.includes('failed') ? 'failure' : 'success',
      message: `User ${action.replace('_', ' ')}`,
      userId,
      metadata,
      complianceTags: ['authentication', 'access_control'],
    });
  }

  /**
   * Authorization events
   */
  async logAuthorization(
    action:
      | 'access_granted'
      | 'access_denied'
      | 'permission_changed'
      | 'role_assigned'
      | 'role_removed',
    userId: string,
    resource: string,
    resourceId?: string,
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    return this.logEvent({
      category: 'authorization',
      action,
      resource,
      resourceId,
      severity: action === 'access_denied' ? 'medium' : 'low',
      status: action === 'access_denied' ? 'failure' : 'success',
      message: `Authorization ${action.replace('_', ' ')} for ${resource}`,
      userId,
      metadata,
      complianceTags: ['authorization', 'rbac'],
    });
  }

  /**
   * Data events
   */
  async logDataEvent(
    action: 'create' | 'read' | 'update' | 'delete' | 'export' | 'import',
    resource: string,
    resourceId: string,
    userId?: string,
    changes?: AuditEvent['changes'],
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    const severity = action === 'delete' ? 'high' : action === 'export' ? 'medium' : 'low';

    return this.logEvent({
      category: 'data',
      action,
      resource,
      resourceId,
      severity,
      status: 'success',
      message: `Data ${action} on ${resource}`,
      userId,
      changes,
      metadata,
      complianceTags: ['data_access', 'gdpr', 'data_protection'],
    });
  }

  /**
   * Workflow events
   */
  async logWorkflowEvent(
    action: 'created' | 'updated' | 'deleted' | 'executed' | 'failed' | 'shared',
    workflowId: string,
    userId?: string,
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    return this.logEvent({
      category: 'workflow',
      action,
      resource: 'workflow',
      resourceId: workflowId,
      severity: action === 'failed' ? 'medium' : 'low',
      status: action === 'failed' ? 'failure' : 'success',
      message: `Workflow ${action}`,
      userId,
      metadata,
      complianceTags: ['workflow_management', 'automation'],
    });
  }

  /**
   * Security events
   */
  async logSecurityEvent(
    action: string,
    severity: AuditEvent['severity'],
    message: string,
    userId?: string,
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    return this.logEvent({
      category: 'security',
      action,
      resource: 'security_system',
      severity,
      status: severity === 'critical' || severity === 'high' ? 'failure' : 'success',
      message,
      userId,
      metadata,
      complianceTags: ['security', 'threat_detection'],
    });
  }

  /**
   * Query audit events
   */
  async queryEvents(query: AuditQuery = {}): Promise<AuditEvent[]> {
    try {
      let filteredEvents = [...this.events];

      // Apply basic filters
      if (query.userId) {
        filteredEvents = filteredEvents.filter((e) => e.userId === query.userId);
      }
      if (query.category) {
        filteredEvents = filteredEvents.filter((e) => e.category === query.category);
      }
      if (query.action) {
        filteredEvents = filteredEvents.filter((e) => e.action === query.action);
      }
      if (query.startDate) {
        const startDate = query.startDate;
        filteredEvents = filteredEvents.filter((e) => e.timestamp >= startDate);
      }
      if (query.endDate) {
        const endDate = query.endDate;
        filteredEvents = filteredEvents.filter((e) => e.timestamp <= endDate);
      }

      // Sort by timestamp (newest first)
      filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination
      const offset = query.offset || 0;
      const limit = query.limit || 100;

      return filteredEvents.slice(offset, offset + limit);
    } catch (error) {
      this.logger.error('Failed to query audit events', { error, query });
      throw error;
    }
  }

  /**
   * Generate compliance report
   */
  async generateReport(
    reportType: AuditReport['reportType'],
    timeRange: { start: Date; end: Date },
    filters: AuditQuery = {},
    generatedBy: string
  ): Promise<AuditReport> {
    try {
      const query: AuditQuery = {
        ...filters,
        startDate: timeRange.start,
        endDate: timeRange.end,
        limit: 10000, // Get all events for report
      };

      const events = await this.queryEvents(query);

      // Generate summary statistics
      const summary = this.generateSummary(events);

      // Generate recommendations based on report type
      const recommendations = this.generateRecommendations(reportType, events, summary);

      const report: AuditReport = {
        id: this.generateReportId(),
        generatedAt: new Date(),
        generatedBy,
        reportType,
        timeRange,
        filters,
        summary,
        events,
        recommendations,
      };

      this.logger.info('Audit report generated', {
        reportId: report.id,
        reportType,
        eventCount: events.length,
        generatedBy,
      });

      return report;
    } catch (error) {
      this.logger.error('Failed to generate audit report', { error, reportType });
      throw error;
    }
  }

  /**
   * Export events for external systems
   */
  async exportEvents(
    query: AuditQuery = {},
    format: 'json' | 'csv' | 'xml' = 'json'
  ): Promise<string> {
    try {
      const events = await this.queryEvents(query);

      switch (format) {
        case 'json':
          return JSON.stringify(events, null, 2);

        case 'csv':
          return this.convertToCSV(events);

        case 'xml':
          return this.convertToXML(events);

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      this.logger.error('Failed to export audit events', { error, query, format });
      throw error;
    }
  }

  private generateEventId(): string {
    return `audit_${Date.now()}_${randomBytes(6).toString('hex')}`;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${randomBytes(6).toString('hex')}`;
  }

  private calculateRiskScore(event: Omit<AuditEvent, 'id' | 'timestamp'>): number {
    let score = 0;

    // Base score by severity
    const severityScores = { low: 10, medium: 30, high: 60, critical: 90 };
    score += severityScores[event.severity];

    // Increase score for failures
    if (event.status === 'failure' || event.status === 'error') {
      score += 20;
    }

    // Increase score for sensitive actions
    const sensitiveActions = ['delete', 'export', 'permission_change', 'role_change'];
    if (sensitiveActions.some((action) => event.action.includes(action))) {
      score += 15;
    }

    // Increase score for administrative resources
    const adminResources = ['user', 'role', 'permission', 'system'];
    if (adminResources.includes(event.resource)) {
      score += 10;
    }

    return Math.min(100, score);
  }

  private identifyRiskFactors(event: Omit<AuditEvent, 'id' | 'timestamp'>): string[] {
    const factors: string[] = [];

    if (event.status === 'failure') {
      factors.push('operation_failed');
    }
    if (event.severity === 'critical') {
      factors.push('critical_severity');
    }
    if (event.action.includes('delete')) {
      factors.push('destructive_action');
    }
    if (event.action.includes('export')) {
      factors.push('data_export');
    }
    if (event.resource === 'user' || event.resource === 'role') {
      factors.push('identity_management');
    }
    if (event.metadata.ip && this.isUnusualIP(event.metadata.ip)) {
      factors.push('unusual_ip');
    }

    return factors;
  }

  private generateComplianceTags(event: Omit<AuditEvent, 'id' | 'timestamp'>): string[] {
    const tags: string[] = [];

    // GDPR tags
    if (event.category === 'data' || event.resource === 'user') {
      tags.push('gdpr');
    }

    // SOX tags
    if (event.category === 'data' && ['create', 'update', 'delete'].includes(event.action)) {
      tags.push('sox');
    }

    // HIPAA tags (if healthcare data)
    if (event.metadata.dataType === 'healthcare') {
      tags.push('hipaa');
    }

    // PCI DSS tags (if payment data)
    if (event.metadata.dataType === 'payment') {
      tags.push('pci_dss');
    }

    // ISO 27001 tags
    if (event.category === 'security' || event.category === 'authentication') {
      tags.push('iso27001');
    }

    return tags;
  }

  private generateSummary(events: AuditEvent[]) {
    const summary = {
      totalEvents: events.length,
      eventsByCategory: {} as Record<string, number>,
      eventsBySeverity: {} as Record<string, number>,
      riskDistribution: {} as Record<string, number>,
      topUsers: [] as Array<{ userId: string; eventCount: number }>,
      topResources: [] as Array<{ resource: string; eventCount: number }>,
    };

    // Count by category
    events.forEach((event) => {
      summary.eventsByCategory[event.category] =
        (summary.eventsByCategory[event.category] || 0) + 1;
      summary.eventsBySeverity[event.severity] =
        (summary.eventsBySeverity[event.severity] || 0) + 1;

      const riskRange = this.getRiskRange(event.riskScore || 0);
      summary.riskDistribution[riskRange] = (summary.riskDistribution[riskRange] || 0) + 1;
    });

    // Top users
    const userCounts = new Map<string, number>();
    events.forEach((event) => {
      if (event.userId) {
        userCounts.set(event.userId, (userCounts.get(event.userId) || 0) + 1);
      }
    });

    summary.topUsers = Array.from(userCounts.entries())
      .map(([userId, eventCount]) => ({ userId, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    // Top resources
    const resourceCounts = new Map<string, number>();
    events.forEach((event) => {
      resourceCounts.set(event.resource, (resourceCounts.get(event.resource) || 0) + 1);
    });

    summary.topResources = Array.from(resourceCounts.entries())
      .map(([resource, eventCount]) => ({ resource, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    return summary;
  }

  private generateRecommendations(
    reportType: string,
    events: AuditEvent[],
    _summary: Record<string, unknown>
  ): string[] {
    const recommendations: string[] = [];

    // Security recommendations
    if (reportType === 'security') {
      const failedLogins = events.filter((e) => e.action === 'login_failed').length;
      if (failedLogins > 10) {
        recommendations.push(
          'Consider implementing account lockout policies due to high number of failed login attempts'
        );
      }

      const highRiskEvents = events.filter((e) => (e.riskScore || 0) > 70).length;
      if (highRiskEvents > events.length * 0.1) {
        recommendations.push(
          'High number of high-risk events detected. Review security policies and access controls'
        );
      }
    }

    // Compliance recommendations
    if (reportType === 'compliance') {
      const dataExports = events.filter((e) => e.action === 'export').length;
      if (dataExports > 0) {
        recommendations.push(
          'Data exports detected. Ensure proper authorization and data protection measures are in place'
        );
      }
    }

    return recommendations;
  }

  private getRiskRange(score: number): string {
    if (score < 25) {
      return 'Low (0-24)';
    }
    if (score < 50) {
      return 'Medium (25-49)';
    }
    if (score < 75) {
      return 'High (50-74)';
    }
    return 'Critical (75-100)';
  }

  private isUnusualIP(_ip: string): boolean {
    // Simplified implementation - would typically check against known IP ranges
    return false;
  }

  private convertToCSV(events: AuditEvent[]): string {
    const headers = [
      'ID',
      'Timestamp',
      'User ID',
      'Category',
      'Action',
      'Resource',
      'Severity',
      'Status',
      'Message',
      'Risk Score',
    ];

    const rows = events.map((event) => [
      event.id,
      event.timestamp.toISOString(),
      event.userId || '',
      event.category,
      event.action,
      event.resource,
      event.severity,
      event.status,
      event.message,
      event.riskScore || 0,
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }

  private convertToXML(events: AuditEvent[]): string {
    const xmlEvents = events
      .map(
        (event) => `
    <event>
      <id>${event.id}</id>
      <timestamp>${event.timestamp.toISOString()}</timestamp>
      <userId>${event.userId || ''}</userId>
      <category>${event.category}</category>
      <action>${event.action}</action>
      <resource>${event.resource}</resource>
      <severity>${event.severity}</severity>
      <status>${event.status}</status>
      <message><![CDATA[${event.message}]]></message>
      <riskScore>${event.riskScore || 0}</riskScore>
    </event>`
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<auditEvents>
  ${xmlEvents}
</auditEvents>`;
  }

  private startCleanupInterval(): void {
    // Clean up old events every hour
    setInterval(
      () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

        const originalLength = this.events.length;
        this.events = this.events.filter((event) => event.timestamp > cutoffDate);

        if (this.events.length < originalLength) {
          this.logger.info('Cleaned up old audit events', {
            removed: originalLength - this.events.length,
            remaining: this.events.length,
          });
        }
      },
      60 * 60 * 1000
    ); // 1 hour
  }
}

export default AuditLogger;
