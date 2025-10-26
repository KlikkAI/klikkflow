/**
 * Audit API Routes
 * Provides secure access to audit logging functionality
 */

// import { authMiddleware } from '@klikkflow/security';
import { Router } from 'express';
import { z } from 'zod';
import { moderateRateLimit, relaxedRateLimit } from '../middleware/rate-limit.middleware';
import { auditService } from '../services/AuditService';

const router = Router();

// Apply authentication middleware to all audit routes
// router.use(authMiddleware);

// Query schema
const AuditQuerySchema = z.object({
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  category: z
    .enum(['authentication', 'authorization', 'data', 'system', 'workflow', 'security'])
    .optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['success', 'failure', 'error']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
});

/**
 * GET /api/audit/events
 * Query audit events
 */
router.get('/events', relaxedRateLimit, async (req, res) => {
  try {
    const query = AuditQuerySchema.parse(req.query);

    // Convert date strings to Date objects and separate pagination from filters
    const { startDate, endDate, limit, offset, status, ...filterQuery } = query;
    const auditQuery = {
      ...filterQuery,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    } as import('@klikkflow/shared').AuditEventFilter;

    const events = await auditService.queryEvents(auditQuery);

    res.json({
      success: true,
      data: events,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total: events.length,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid query parameters',
    });
  }
});

/**
 * POST /api/audit/reports
 * Generate compliance report
 */
router.post('/reports', moderateRateLimit, async (req, res) => {
  try {
    const schema = z.object({
      reportType: z.enum(['compliance', 'security', 'activity', 'risk']),
      timeRange: z.object({
        start: z.string().datetime(),
        end: z.string().datetime(),
      }),
      filters: AuditQuerySchema.optional(),
      generatedBy: z.string(),
    });

    const { reportType, timeRange, filters = {}, generatedBy } = schema.parse(req.body);

    const report = await auditService.generateReport(
      reportType,
      {
        start: new Date(timeRange.start),
        end: new Date(timeRange.end),
      },
      filters,
      generatedBy
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request',
    });
  }
});

/**
 * POST /api/audit/export
 * Export audit events
 */
router.post('/export', moderateRateLimit, async (req, res) => {
  try {
    const schema = z.object({
      query: AuditQuerySchema.optional(),
      format: z.enum(['json', 'csv', 'xml']).default('json'),
    });

    const parsed = schema.parse(req.body);
    const format = parsed.format;

    // Convert date strings to Date objects if query exists
    const auditQuery = parsed.query
      ? {
          ...parsed.query,
          startDate: parsed.query.startDate ? new Date(parsed.query.startDate) : undefined,
          endDate: parsed.query.endDate ? new Date(parsed.query.endDate) : undefined,
        }
      : {};

    const exportData = await auditService.exportEvents(auditQuery, format);

    // Set appropriate content type
    const contentTypes = {
      json: 'application/json',
      csv: 'text/csv',
      xml: 'application/xml',
    };

    res.setHeader('Content-Type', contentTypes[format]);
    res.setHeader('Content-Disposition', `attachment; filename="audit-export.${format}"`);
    res.send(exportData);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    });
  }
});

/**
 * POST /api/audit/log
 * Log audit event (internal use)
 */
router.post('/log', moderateRateLimit, async (req, res) => {
  try {
    const schema = z.object({
      category: z.enum([
        'authentication',
        'authorization',
        'data',
        'system',
        'workflow',
        'security',
      ]),
      action: z.string(),
      resource: z.string(),
      resourceId: z.string().optional(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      message: z.string(),
      userId: z.string().optional(),
      metadata: z.record(z.string(), z.any()).default({}),
    });

    const eventData = schema.parse(req.body);

    let eventId: string;

    // Route to appropriate logging method based on category
    switch (eventData.category) {
      case 'authentication':
        eventId = await auditService.logAuthentication(
          eventData.action as any,
          eventData.userId,
          eventData.metadata
        );
        break;

      case 'authorization':
        eventId = await auditService.logAuthorization(
          eventData.action as any,
          eventData.userId || 'system',
          eventData.resource,
          eventData.resourceId,
          eventData.metadata
        );
        break;

      case 'workflow':
        eventId = await auditService.logWorkflowEvent(
          eventData.action as any,
          eventData.resourceId || eventData.resource,
          eventData.userId,
          eventData.metadata
        );
        break;

      case 'security':
        eventId = await auditService.logSecurityEvent(
          eventData.action,
          eventData.severity,
          eventData.message,
          eventData.userId,
          eventData.metadata
        );
        break;

      default:
        eventId = await auditService.logDataEvent(
          eventData.action as any,
          eventData.resource,
          eventData.resourceId || 'unknown',
          eventData.userId,
          undefined,
          eventData.metadata
        );
    }

    res.json({
      success: true,
      data: { eventId },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to log event',
    });
  }
});

export default router;
