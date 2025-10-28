/**
 * API Key Controller
 * Handles API key creation, listing, and revocation
 */

import type { Response } from 'express';
import { BaseController } from '../../../base/BaseController';
import { AppError } from '../../../middleware/errorHandlers';
import { logger } from '../../../utils/logger';
import type { ICreateApiKeyRequest, IUpdateApiKeyRequest } from '../interfaces';
import { ApiKeyService } from '../services/ApiKeyService';
import type { AuthenticatedRequest } from './AuthController';

export class ApiKeyController extends BaseController {
  private apiKeyService: ApiKeyService;

  constructor() {
    super();
    this.apiKeyService = ApiKeyService.getInstance();
  }

  /**
   * Get all API keys for the authenticated user
   * GET /auth/api-keys
   */
  getApiKeys = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    const apiKeys = await this.apiKeyService.getUserApiKeys(userId);

    this.sendSuccess(res, { apiKeys }, 'API keys retrieved successfully');
  };

  /**
   * Get a specific API key by ID
   * GET /auth/api-keys/:keyId
   */
  getApiKeyById = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    const { keyId } = req.params;

    const apiKey = await this.apiKeyService.getApiKeyById(keyId, userId);

    if (!apiKey) {
      throw new AppError('API key not found', 404);
    }

    this.sendSuccess(res, { apiKey }, 'API key retrieved successfully');
  };

  /**
   * Create a new API key
   * POST /auth/api-keys
   */
  createApiKey = async (req: AuthenticatedRequest, res: Response) => {
    this.validateRequest(req);

    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    const { name, permissions, expiresIn, ipWhitelist }: ICreateApiKeyRequest = req.body;

    // Validate expiresIn if provided (1 day to 1 year in seconds)
    if (expiresIn !== undefined) {
      const oneDay = 86400; // 1 day in seconds
      const oneYear = 31536000; // 1 year in seconds

      if (expiresIn < oneDay || expiresIn > oneYear) {
        throw new AppError('Expiration must be between 1 day and 1 year', 400);
      }
    }

    const result = await this.apiKeyService.createApiKey({
      userId,
      name,
      permissions,
      expiresIn,
      ipWhitelist,
    });

    // Return the full key only once!
    const responseData = {
      apiKey: {
        ...result.apiKey,
        key: result.plainKey, // Full key shown only on creation
      },
    };

    logger.info(`API key created by user ${userId}: ${name}`);

    this.sendCreated(
      res,
      responseData,
      "API key created successfully. Make sure to save it - you won't be able to see it again!"
    );
  };

  /**
   * Update API key permissions
   * PATCH /auth/api-keys/:keyId
   */
  updateApiKey = async (req: AuthenticatedRequest, res: Response) => {
    this.validateRequest(req);

    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    const { keyId } = req.params;
    const { permissions }: IUpdateApiKeyRequest = req.body;

    if (!permissions || permissions.length === 0) {
      throw new AppError('Permissions are required', 400);
    }

    const apiKey = await this.apiKeyService.updateApiKeyPermissions(keyId, userId, permissions);

    logger.info(`API key permissions updated by user ${userId}: ${keyId}`);

    this.sendSuccess(res, { apiKey }, 'API key updated successfully');
  };

  /**
   * Revoke (delete) an API key
   * DELETE /auth/api-keys/:keyId
   */
  revokeApiKey = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    const { keyId } = req.params;

    await this.apiKeyService.revokeApiKey(keyId, userId);

    logger.info(`API key revoked by user ${userId}: ${keyId}`);

    this.sendSuccess(res, null, 'API key revoked successfully');
  };

  /**
   * Cleanup expired API keys (admin endpoint or scheduled job)
   * POST /auth/api-keys/cleanup
   */
  cleanupExpiredKeys = async (req: AuthenticatedRequest, res: Response) => {
    // This could be protected by admin-only middleware
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    const count = await this.apiKeyService.cleanupExpiredKeys();

    logger.info(`Cleaned up ${count} expired API keys`);

    this.sendSuccess(res, { count }, `Cleaned up ${count} expired API keys`);
  };
}
