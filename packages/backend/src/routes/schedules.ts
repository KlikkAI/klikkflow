/**
 * Workflow Scheduler API Routes
 * Provides API access to workflow scheduling functionality
 */

// import { authMiddleware } from '@klikkflow/security';
import { Router } from 'express';
import { z } from 'zod';
import { moderateRateLimit, relaxedRateLimit } from '../middleware/rate-limit.middleware';
import { workflowSchedulerService } from '../services/WorkflowSchedulerService';

const router = Router();

// Apply authentication middleware to all schedule routes
// router.use(authMiddleware);

// Schedule configuration schema
const ScheduleConfigSchema = z.object({
  type: z.enum(['cron', 'interval', 'once']),
  cronExpression: z.string().optional(),
  interval: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  timezone: z.string().default('UTC'),
  maxRuns: z.number().positive().optional(),
});

const CreateScheduleSchema = z.object({
  workflowId: z.string(),
  config: ScheduleConfigSchema,
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * GET /api/schedules
 * List workflow schedules
 */
router.get('/', relaxedRateLimit, async (req, res) => {
  try {
    const schema = z.object({
      workflowId: z.string().optional(),
    });

    const { workflowId } = schema.parse(req.query);
    const schedules = workflowSchedulerService.listSchedules(workflowId);

    res.json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid query parameters',
    });
  }
});

/**
 * POST /api/schedules
 * Create a new workflow schedule
 */
router.post('/', moderateRateLimit, async (req, res) => {
  try {
    const { workflowId, config, metadata = {} } = CreateScheduleSchema.parse(req.body);

    // Convert date strings to Date objects
    const scheduleConfig = {
      ...config,
      startDate: config.startDate ? new Date(config.startDate) : undefined,
      endDate: config.endDate ? new Date(config.endDate) : undefined,
    };

    const schedule = await workflowSchedulerService.createSchedule(
      workflowId,
      scheduleConfig,
      metadata
    );

    res.status(201).json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create schedule',
    });
  }
});

/**
 * GET /api/schedules/:id
 * Get schedule by ID
 */
router.get('/:id', relaxedRateLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = workflowSchedulerService.getSchedule(id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found',
      });
    }

    return res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * PUT /api/schedules/:id
 * Update schedule
 */
router.put('/:id', moderateRateLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = z
      .object({
        schedule: z.string().optional(),
        enabled: z.boolean().optional(),
        timezone: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      })
      .parse(req.body);

    const schedule = await workflowSchedulerService.updateSchedule(id, updates);

    res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update schedule',
    });
  }
});

/**
 * DELETE /api/schedules/:id
 * Delete schedule
 */
router.delete('/:id', moderateRateLimit, async (req, res) => {
  try {
    const { id } = req.params;
    await workflowSchedulerService.deleteSchedule(id);

    res.json({
      success: true,
      message: 'Schedule deleted successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete schedule',
    });
  }
});

/**
 * POST /api/schedules/:id/toggle
 * Enable/disable schedule
 */
router.post('/:id/toggle', moderateRateLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = z
      .object({
        enabled: z.boolean(),
      })
      .parse(req.body);

    await workflowSchedulerService.toggleSchedule(id, enabled);

    res.json({
      success: true,
      message: `Schedule ${enabled ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle schedule',
    });
  }
});

/**
 * POST /api/schedules/:id/trigger
 * Manually trigger a scheduled workflow
 */
router.post('/:id/trigger', moderateRateLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const executionId = await workflowSchedulerService.triggerSchedule(id);

    res.json({
      success: true,
      data: { executionId },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger schedule',
    });
  }
});

/**
 * GET /api/schedules/:id/executions
 * Get scheduled executions for a specific schedule
 */
router.get('/:id/executions', relaxedRateLimit, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the schedule first to get the workflow ID
    const schedule = workflowSchedulerService.getSchedule(id);
    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found',
      });
    }

    const executions = workflowSchedulerService.getScheduledExecutions(schedule.workflowId);

    return res.json({
      success: true,
      data: executions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get scheduled executions',
    });
  }
});

/**
 * GET /api/schedules/analytics
 * Get schedule analytics
 */
router.get('/analytics', relaxedRateLimit, async (_req, res) => {
  try {
    const analytics = workflowSchedulerService.getScheduleAnalytics();

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get schedule analytics',
    });
  }
});

/**
 * GET /api/schedules/executions
 * Get all scheduled executions
 */
router.get('/executions', relaxedRateLimit, async (req, res) => {
  try {
    const schema = z.object({
      workflowId: z.string().optional(),
      limit: z.number().min(1).max(1000).default(100),
      offset: z.number().min(0).default(0),
    });

    const { workflowId, limit, offset } = schema.parse(req.query);
    const allExecutions = workflowSchedulerService.getScheduledExecutions(workflowId);

    // Apply pagination
    const executions = allExecutions.slice(offset, offset + limit);

    res.json({
      success: true,
      data: executions,
      pagination: {
        limit,
        offset,
        total: allExecutions.length,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid query parameters',
    });
  }
});

export default router;
