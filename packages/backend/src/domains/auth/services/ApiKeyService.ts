/**
 * API Key Service
 * Handles API key generation, validation, and management
 */

import crypto from 'node:crypto';
import { AppError } from '../../../middleware/errorHandlers';
import { ApiKey, type IApiKey } from '../../../models/ApiKey';
import { User } from '../../../models/User';
import { logger } from '../../../utils/logger';

interface CreateApiKeyData {
  userId: string;
  name: string;
  permissions?: string[];
  expiresIn?: number; // Duration in seconds (e.g., 90 days = 7776000)
  ipWhitelist?: string[];
}

interface ApiKeyResult {
  apiKey: IApiKey;
  plainKey: string; // Only returned on creation
}

export class ApiKeyService {
  private static instance: ApiKeyService;
  private static readonly KEY_LENGTH = 32; // 32 bytes = 256 bits
  private static readonly MAX_KEYS_PER_USER = 10; // Default limit
  private static readonly DEFAULT_KEY_PREFIX = 'rkr_live_';

  private constructor() {}

  public static getInstance(): ApiKeyService {
    if (!ApiKeyService.instance) {
      ApiKeyService.instance = new ApiKeyService();
    }
    return ApiKeyService.instance;
  }

  /**
   * Generate a secure random API key
   * Format: rkr_live_<32_random_hex_chars>
   */
  private generateSecureKey(): string {
    const randomBytes = crypto.randomBytes(ApiKeyService.KEY_LENGTH);
    const randomString = randomBytes.toString('hex');
    return `${ApiKeyService.DEFAULT_KEY_PREFIX}${randomString}`;
  }

  /**
   * Create a new API key for a user
   */
  async createApiKey(data: CreateApiKeyData): Promise<ApiKeyResult> {
    try {
      // Verify user exists
      const user = await User.findById(data.userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Check if user has reached the maximum number of API keys
      const existingKeysCount = await ApiKey.countDocuments({
        userId: data.userId,
        isActive: true,
      });

      if (existingKeysCount >= ApiKeyService.MAX_KEYS_PER_USER) {
        throw new AppError(
          `Maximum number of API keys (${ApiKeyService.MAX_KEYS_PER_USER}) reached. Please revoke an existing key first.`,
          400
        );
      }

      // Check for duplicate name
      const duplicateName = await ApiKey.findOne({
        userId: data.userId,
        name: data.name,
        isActive: true,
      });

      if (duplicateName) {
        throw new AppError('An API key with this name already exists', 409);
      }

      // Generate secure API key
      const plainKey = this.generateSecureKey();
      const keyPrefix = plainKey.substring(0, 8); // First 8 chars for prefix

      // Calculate expiration date if provided
      let expiresAt: Date | undefined;
      if (data.expiresIn) {
        expiresAt = new Date(Date.now() + data.expiresIn * 1000);
      }

      // Create API key (keyHash will be automatically hashed by pre-save hook)
      const apiKey = await ApiKey.create({
        userId: data.userId,
        name: data.name,
        keyHash: plainKey, // Will be hashed by pre-save hook
        keyPrefix,
        permissions: data.permissions || ['read'],
        isActive: true,
        expiresAt,
        ipWhitelist: data.ipWhitelist || [],
        requestCount: 0,
      });

      logger.info(`API key created for user ${data.userId}: ${data.name}`);

      return {
        apiKey: apiKey.toObject() as IApiKey,
        plainKey, // Only returned once!
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('API key creation error:', error);
      throw new AppError('Failed to create API key', 500);
    }
  }

  /**
   * Validate an API key and return the associated user ID
   */
  async validateApiKey(plainKey: string, ipAddress?: string): Promise<string | null> {
    try {
      const apiKeys = await this.findKeysWithPrefix(plainKey.substring(0, 8));
      if (!apiKeys || apiKeys.length === 0) {
        return null;
      }

      for (const apiKey of apiKeys) {
        const userId = await this.validateSingleKey(apiKey, plainKey, ipAddress);
        if (userId) {
          return userId;
        }
      }

      return null;
    } catch (error) {
      logger.error('API key validation error:', error);
      return null;
    }
  }

  /**
   * Find API keys with matching prefix
   */
  private async findKeysWithPrefix(keyPrefix: string): Promise<any[]> {
    return ApiKey.find({
      keyPrefix,
      isActive: true,
    }).select('+keyHash');
  }

  /**
   * Validate a single API key
   */
  private async validateSingleKey(
    apiKey: any,
    plainKey: string,
    ipAddress?: string
  ): Promise<string | null> {
    const isValid = await apiKey.compareKey(plainKey);
    if (!isValid) {
      return null;
    }

    if (apiKey.isExpired()) {
      logger.warn(`Expired API key used: ${apiKey._id}`);
      return null;
    }

    if (!this.isIpAllowed(apiKey, ipAddress)) {
      logger.warn(`API key used from unauthorized IP: ${ipAddress}`);
      return null;
    }

    // Update last used timestamp (non-blocking)
    this.updateLastUsed(apiKey._id.toString()).catch((err) => {
      logger.error('Failed to update API key last used:', err);
    });

    return apiKey.userId;
  }

  /**
   * Check if IP address is allowed
   */
  private isIpAllowed(apiKey: any, ipAddress?: string): boolean {
    if (!ipAddress || !apiKey.ipWhitelist || apiKey.ipWhitelist.length === 0) {
      return true;
    }
    return apiKey.ipWhitelist.includes(ipAddress);
  }

  /**
   * Get all API keys for a user
   */
  async getUserApiKeys(userId: string): Promise<IApiKey[]> {
    try {
      const apiKeys = await ApiKey.find({
        userId,
        isActive: true,
      }).sort({ createdAt: -1 });

      return apiKeys.map((key) => key.toObject() as IApiKey);
    } catch (error) {
      logger.error('Error fetching user API keys:', error);
      throw new AppError('Failed to fetch API keys', 500);
    }
  }

  /**
   * Get a specific API key by ID
   */
  async getApiKeyById(apiKeyId: string, userId: string): Promise<IApiKey | null> {
    try {
      const apiKey = await ApiKey.findOne({
        _id: apiKeyId,
        userId,
        isActive: true,
      });

      return apiKey ? (apiKey.toObject() as IApiKey) : null;
    } catch (error) {
      logger.error('Error fetching API key:', error);
      throw new AppError('Failed to fetch API key', 500);
    }
  }

  /**
   * Revoke (deactivate) an API key
   */
  async revokeApiKey(apiKeyId: string, userId: string): Promise<boolean> {
    try {
      const apiKey = await ApiKey.findOne({
        _id: apiKeyId,
        userId,
        isActive: true,
      });

      if (!apiKey) {
        throw new AppError('API key not found', 404);
      }

      apiKey.isActive = false;
      await apiKey.save();

      logger.info(`API key revoked: ${apiKeyId} by user ${userId}`);

      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error revoking API key:', error);
      throw new AppError('Failed to revoke API key', 500);
    }
  }

  /**
   * Update last used timestamp for an API key
   */
  private async updateLastUsed(apiKeyId: string): Promise<void> {
    try {
      await ApiKey.findByIdAndUpdate(apiKeyId, {
        lastUsedAt: new Date(),
        $inc: { requestCount: 1 },
      });
    } catch (error) {
      logger.error('Error updating API key last used:', error);
      // Don't throw error - this is non-critical
    }
  }

  /**
   * Clean up expired API keys (can be run as a scheduled job)
   */
  async cleanupExpiredKeys(): Promise<number> {
    try {
      const result = await ApiKey.updateMany(
        {
          isActive: true,
          expiresAt: { $lt: new Date() },
        },
        {
          isActive: false,
        }
      );

      const count = result.modifiedCount || 0;
      if (count > 0) {
        logger.info(`Cleaned up ${count} expired API keys`);
      }

      return count;
    } catch (error) {
      logger.error('Error cleaning up expired keys:', error);
      return 0;
    }
  }

  /**
   * Update API key permissions
   */
  async updateApiKeyPermissions(
    apiKeyId: string,
    userId: string,
    permissions: string[]
  ): Promise<IApiKey> {
    try {
      const apiKey = await ApiKey.findOne({
        _id: apiKeyId,
        userId,
        isActive: true,
      });

      if (!apiKey) {
        throw new AppError('API key not found', 404);
      }

      apiKey.permissions = permissions;
      await apiKey.save();

      logger.info(`API key permissions updated: ${apiKeyId}`);

      return apiKey.toObject() as IApiKey;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error updating API key permissions:', error);
      throw new AppError('Failed to update API key permissions', 500);
    }
  }
}
