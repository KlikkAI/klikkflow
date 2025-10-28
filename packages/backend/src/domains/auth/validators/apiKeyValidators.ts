/**
 * API Key Validation Schemas and Middleware
 * Uses BaseValidationMiddleware with Zod schemas for API key request validation
 */

import { BaseValidationMiddleware } from '@klikkflow/core';
import { z } from 'zod';

/**
 * Valid permissions for API keys
 */
const VALID_PERMISSIONS = [
  'read',
  'write',
  'execute',
  'workflows:read',
  'workflows:write',
  'workflows:execute',
  'workflows:delete',
  'credentials:read',
  'credentials:write',
  'executions:read',
  'admin',
] as const;

/**
 * API key name schema - between 1 and 100 characters
 */
const ApiKeyNameSchema = z
  .string()
  .trim()
  .min(1, 'API key name is required')
  .max(100, 'API key name must be at most 100 characters');

/**
 * Permissions schema - array of valid permission strings
 */
const PermissionsSchema = z
  .array(
    z.enum([
      'read',
      'write',
      'execute',
      'workflows:read',
      'workflows:write',
      'workflows:execute',
      'workflows:delete',
      'credentials:read',
      'credentials:write',
      'executions:read',
      'admin',
    ])
  )
  .min(1, 'At least one permission is required')
  .default(['read']);

/**
 * IP whitelist schema - array of valid IP addresses
 */
const IpWhitelistSchema = z
  .array(
    z.string().refine(
      (ip) => {
        // Basic IP validation (supports both IPv4 and IPv6)
        const ipv4Regex =
          /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv4Regex.test(ip) || ipv6Regex.test(ip);
      },
      {
        message: 'Invalid IP address format',
      }
    )
  )
  .optional();

/**
 * Expiration schema - between 1 day (86400s) and 1 year (31536000s)
 */
const ExpirationSchema = z
  .number()
  .int('Expiration must be an integer')
  .min(86400, 'Expiration must be at least 1 day (86400 seconds)')
  .max(31536000, 'Expiration must be at most 1 year (31536000 seconds)')
  .optional();

/**
 * Create API key validation schema
 */
const CreateApiKeySchema = z.object({
  name: ApiKeyNameSchema,
  permissions: PermissionsSchema,
  expiresIn: ExpirationSchema,
  ipWhitelist: IpWhitelistSchema,
});

/**
 * Update API key validation schema
 */
const UpdateApiKeySchema = z.object({
  permissions: PermissionsSchema,
  name: ApiKeyNameSchema.optional(),
});

/**
 * API key ID parameter schema
 */
const ApiKeyIdSchema = z.object({
  keyId: z
    .string()
    .min(1, 'API key ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid API key ID format'),
});

/**
 * Export validation middleware using BaseValidationMiddleware
 */

// Validate create API key request body
export const createApiKeyValidation = BaseValidationMiddleware.validateBody(CreateApiKeySchema, {
  customErrorMessages: {
    name: 'Please provide a valid name for your API key',
    permissions: 'Please select at least one permission for your API key',
  },
});

// Validate update API key request body
export const updateApiKeyValidation = BaseValidationMiddleware.validateBody(UpdateApiKeySchema, {
  stripExtraFields: true,
  customErrorMessages: {
    permissions: 'Please provide valid permissions for your API key',
  },
});

// Validate API key ID in route params
export const apiKeyIdValidation = BaseValidationMiddleware.validateParams(ApiKeyIdSchema);

/**
 * Composite validation for create API key with all checks
 */
export const validateCreateApiKey = BaseValidationMiddleware.validateRequest({
  body: CreateApiKeySchema,
  headers: z
    .object({
      'content-type': z.string().includes('application/json').optional(),
    })
    .optional(),
});

/**
 * Composite validation for update API key with all checks
 */
export const validateUpdateApiKey = BaseValidationMiddleware.validateRequest({
  body: UpdateApiKeySchema,
  params: ApiKeyIdSchema,
  headers: z
    .object({
      'content-type': z.string().includes('application/json').optional(),
    })
    .optional(),
});

/**
 * Export schemas for testing and reuse
 */
export const apiKeySchemas = {
  CreateApiKeySchema,
  UpdateApiKeySchema,
  ApiKeyIdSchema,
  PermissionsSchema,
  ExpirationSchema,
  IpWhitelistSchema,
};

/**
 * Export valid permissions list for use in controllers/services
 */
export { VALID_PERMISSIONS };
