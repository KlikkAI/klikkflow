/**
 * Trigger System API Routes
 * Provides API access to workflow trigger management
 */

// import { authMiddleware } from '@klikkflow/security';
import { Router } from 'express';
import { z } from 'zod';
import {
  moderateRateLimit,
  relaxedRateLimit,
  webhookRateLimit,
} from '../middleware/rate-limit.middleware';
import { triggerSystemService } from '../services/TriggerSystemService';

const router = Router();

// Apply authentication middleware to all trigger routes
// router.use(authMiddleware);

// Trigger configuration schemas
const TriggerConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'exists']),
  value: z.any(),
});

const WebhookConfigSchema = z.object({
  path: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  authentication: z
    .object({
      type: z.enum(['none', 'basic', 'bearer', 'signature']),
      secret: z.string().optional(),
    })
    .optional(),
  responseMode: z.enum(['sync', 'async']).default('async'),
});

const EventConfigSchema = z.object({
  eventType: z.string(),
  source: z.string().optional(),
  filters: z.record(z.string(), z.any()).optional(),
});

const CreateTriggerSchema = z.object({
  type: z.enum(['webhook', 'schedule', 'event', 'manual']),
  workflowId: z.string(),
  enabled: z.boolean().default(true),
  config: z.union([WebhookConfigSchema, EventConfigSchema, z.record(z.string(), z.any())]),
  conditions: z.array(TriggerConditionSchema).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * GET /api/triggers
 * List triggers
 */
router.get('/', relaxedRateLimit, async (req, res) => {
  try {
    const schema = z.object({
      workflowId: z.string().optional(),
      type: z.string().optional(),
    });

    const { workflowId, type } = schema.parse(req.query);
    const triggers = triggerSystemService.listTriggers(workflowId, type);

    res.json({
      success: true,
      data: triggers,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid query parameters',
    });
  }
});

/**
 * POST /api/triggers
 * Create a new trigger
 */
router.post('/', moderateRateLimit, async (req, res) => {
  try {
    const triggerData = CreateTriggerSchema.parse(req.body);
    const trigger = await triggerSystemService.createTrigger(triggerData);

    res.status(201).json({
      success: true,
      data: trigger,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create trigger',
    });
  }
});

/**
 * GET /api/triggers/:id
 * Get trigger by ID
 */
router.get('/:id', relaxedRateLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const trigger = triggerSystemService.getTrigger(id);

    if (!trigger) {
      return res.status(404).json({
        success: false,
        error: 'Trigger not found',
      });
    }

    return res.json({
      success: true,
      data: trigger,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * PUT /api/triggers/:id
 * Update trigger
 */
router.put('/:id', moderateRateLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = CreateTriggerSchema.partial().parse(req.body);

    const trigger = await triggerSystemService.updateTrigger(id, updates);

    res.json({
      success: true,
      data: trigger,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update trigger',
    });
  }
});

/**
 * DELETE /api/triggers/:id
 * Delete trigger
 */
router.delete('/:id', moderateRateLimit, async (req, res) => {
  try {
    const { id } = req.params;
    await triggerSystemService.deleteTrigger(id);

    res.json({
      success: true,
      message: 'Trigger deleted successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete trigger',
    });
  }
});

/**
 * POST /api/triggers/:id/test
 * Manually trigger a workflow
 */
router.post('/:id/test', moderateRateLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const { payload = {} } = req.body;

    const result = await triggerSystemService.manualTrigger(id, payload);

    if (result.success) {
      res.json({
        success: true,
        data: { executionId: result.executionId },
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger workflow',
    });
  }
});

/**
 * GET /api/triggers/:id/events
 * Get trigger events
 */
router.get('/:id/events', relaxedRateLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const events = triggerSystemService.getTriggerEvents(id);

    res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get trigger events',
    });
  }
});

/**
 * GET /api/triggers/:id/metrics
 * Get trigger metrics
 */
router.get('/:id/metrics', relaxedRateLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const metrics = triggerSystemService.getTriggerMetrics(id);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get trigger metrics',
    });
  }
});

/**
 * POST /api/triggers/webhook/:path
 * Handle webhook requests (special route)
 */
router.all('/webhook/*', webhookRateLimit, async (req, res) => {
  try {
    const path = (req.params as string[])[0]; // Get the wildcard path
    const method = req.method;
    const headers = req.headers as Record<string, string>;
    const body = req.body;
    const query = req.query as Record<string, string>;

    const result = await triggerSystemService.handleWebhookRequest(
      path,
      method,
      headers,
      body,
      query
    );

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Webhook processing failed',
    });
  }
});

export default router;
