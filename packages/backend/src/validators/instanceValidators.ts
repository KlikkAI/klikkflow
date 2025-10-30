/**
 * Instance Validation Schemas
 * Validates requests for self-hosted instance management
 */

import { BaseValidationMiddleware } from '@klikkflow/core';
import { z } from 'zod';

/**
 * Platform types for self-hosted instances
 */
const PlatformSchema = z.enum(['docker', 'vps', 'local', 'kubernetes', 'cloud']);

/**
 * Instance metadata schema
 */
const InstanceMetadataSchema = z.object({
  os: z.string().optional(),
  osVersion: z.string().optional(),
  nodeVersion: z.string().optional(),
  architecture: z.string().optional(),
  cpu: z.number().int().positive().optional(),
  memory: z.number().positive().optional(),
  diskSpace: z.number().positive().optional(),
  timezone: z.string().optional(),
  country: z.string().length(2).optional(), // ISO country code
});

/**
 * Instance features schema
 */
const InstanceFeaturesSchema = z.object({
  telemetryEnabled: z.boolean().optional().default(true),
  autoUpdate: z.boolean().optional().default(false),
  analyticsEnabled: z.boolean().optional().default(true),
});

/**
 * Instance statistics schema
 */
const InstanceStatisticsSchema = z.object({
  workflowCount: z.number().int().min(0).optional(),
  executionCount: z.number().int().min(0).optional(),
  activeUsers: z.number().int().min(0).optional(),
  lastExecutionAt: z.coerce.date().optional(),
});

/**
 * Activate instance schema
 */
const ActivateInstanceSchema = z.object({
  apiKey: z
    .string()
    .min(1, 'API key is required')
    .regex(/^rkr_live_[a-f0-9]{64}$/, 'Invalid API key format'),
  hostname: z
    .string()
    .min(1, 'Hostname is required')
    .max(255, 'Hostname must be at most 255 characters'),
  version: z
    .string()
    .min(1, 'Version is required')
    .regex(/^\d+\.\d+\.\d+$/, 'Version must be in format X.Y.Z'),
  platform: PlatformSchema.optional().default('docker'),
  metadata: InstanceMetadataSchema.optional(),
  features: InstanceFeaturesSchema.optional(),
});

/**
 * Heartbeat schema
 */
const HeartbeatSchema = z.object({
  instanceId: z.string().uuid('Invalid instance ID format'),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must be in format X.Y.Z')
    .optional(),
  metadata: InstanceMetadataSchema.partial().optional(),
  statistics: InstanceStatisticsSchema.optional(),
});

/**
 * Instance ID parameter schema
 */
const InstanceIdSchema = z.object({
  instanceId: z.string().uuid('Invalid instance ID format'),
});

/**
 * Cleanup stale instances schema
 */
const CleanupSchema = z.object({
  days: z.number().int().min(1).max(365).optional().default(30),
});

/**
 * Export validation middleware
 */

export const activateInstanceValidation =
  BaseValidationMiddleware.validateBody(ActivateInstanceSchema);

export const heartbeatValidation = BaseValidationMiddleware.validateBody(HeartbeatSchema);

export const instanceIdValidation = BaseValidationMiddleware.validateParams(InstanceIdSchema);

export const cleanupValidation = BaseValidationMiddleware.validateBody(CleanupSchema);

/**
 * Composite validations
 */

export const validateActivateInstance = BaseValidationMiddleware.validateRequest({
  body: ActivateInstanceSchema,
  headers: z
    .object({
      'content-type': z.string().includes('application/json').optional(),
    })
    .optional(),
});

export const validateHeartbeat = BaseValidationMiddleware.validateRequest({
  body: HeartbeatSchema,
  headers: z
    .object({
      'content-type': z.string().includes('application/json').optional(),
    })
    .optional(),
});

/**
 * Export schemas for testing and reuse
 */
export const instanceSchemas = {
  ActivateInstanceSchema,
  HeartbeatSchema,
  InstanceIdSchema,
  CleanupSchema,
  InstanceMetadataSchema,
  InstanceFeaturesSchema,
  InstanceStatisticsSchema,
  PlatformSchema,
};
