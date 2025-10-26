/**
 * Plugin Marketplace API Routes
 * Handles plugin publishing, searching, downloading, and management
 */

import { Logger } from '@klikkflow/core';
import {
  DownloadRequestSchema,
  PluginDistribution,
  PluginRegistry,
  PluginSearchSchema,
  PluginValidator,
  PublishRequestSchema,
} from '@klikkflow/platform';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { moderateRateLimit, relaxedRateLimit } from '../middleware/rate-limit.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { sanitizeObject } from '../utils/safe-object-merge';

const router = Router();
const logger = new Logger('MarketplaceAPI');

// Initialize services
const pluginRegistry = new PluginRegistry();
const pluginValidator = new PluginValidator();
const pluginDistribution = new PluginDistribution();

/**
 * GET /api/marketplace/plugins
 * Search and browse plugins in the marketplace
 */
router.get(
  '/plugins',
  relaxedRateLimit,
  asyncHandler(async (req, res) => {
    const searchQuery = PluginSearchSchema.parse(req.query);

    const result = await pluginRegistry.searchPlugins(searchQuery);

    return res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * GET /api/marketplace/plugins/:pluginId
 * Get detailed information about a specific plugin
 */
router.get(
  '/plugins/:pluginId',
  relaxedRateLimit,
  asyncHandler(async (req, res) => {
    const { pluginId } = req.params;

    const plugin = await pluginRegistry.getPlugin(pluginId);

    if (!plugin) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found',
      });
    }

    // Get version information
    const versions = await pluginDistribution.getPluginVersions(pluginId);

    return res.json({
      success: true,
      data: {
        ...plugin,
        versions: versions.versions,
      },
    });
  })
);

/**
 * POST /api/marketplace/plugins
 * Publish a new plugin or update an existing one
 */
router.post(
  '/plugins',
  moderateRateLimit,
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Sanitize request body to prevent prototype pollution
    const sanitizedBody = sanitizeObject(req.body);
    const publishRequest = PublishRequestSchema.parse({
      ...sanitizedBody,
      publisherInfo: {
        userId: req.user.id,
        organizationId: req.user.organizationId,
        publisherType: req.user.organizationId ? 'organization' : 'individual',
      },
    });

    // Validate plugin before publishing
    const validationResult = await pluginValidator.validatePlugin(publishRequest.pluginPackage);

    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Plugin validation failed',
        validationResult,
      });
    }

    // Publish plugin
    const publishResult = await pluginDistribution.publishPlugin(publishRequest);

    if (!publishResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to publish plugin',
        details: publishResult.errors,
      });
    }

    // Register plugin in marketplace
    await pluginRegistry.registerPlugin(publishRequest.pluginPackage);

    return res.status(201).json({
      success: true,
      data: publishResult,
    });
  })
);

/**
 * PUT /api/marketplace/plugins/:pluginId
 * Update plugin metadata
 */
router.put(
  '/plugins/:pluginId',
  moderateRateLimit,
  authenticate,
  asyncHandler(async (req, res) => {
    const { pluginId } = req.params;
    const updates = req.body;

    // TODO: Validate user permissions to update this plugin

    const success = await pluginRegistry.updatePlugin(pluginId, updates);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found or update failed',
      });
    }

    return res.json({
      success: true,
      message: 'Plugin updated successfully',
    });
  })
);

/**
 * DELETE /api/marketplace/plugins/:pluginId/versions/:version
 * Unpublish a specific version of a plugin
 */
router.delete(
  '/plugins/:pluginId/versions/:version',
  moderateRateLimit,
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { pluginId, version } = req.params;

    const publisherInfo = {
      userId: req.user.id,
      organizationId: req.user.organizationId,
      publisherType: (req.user.organizationId ? 'organization' : 'individual') as
        | 'organization'
        | 'individual'
        | 'verified',
    };

    const result = await pluginDistribution.unpublishPlugin(pluginId, version, publisherInfo);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    return res.json({
      success: true,
      message: 'Plugin version unpublished successfully',
    });
  })
);

/**
 * POST /api/marketplace/plugins/:pluginId/download
 * Download a plugin
 */
router.post(
  '/plugins/:pluginId/download',
  moderateRateLimit,
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { pluginId } = req.params;
    const { version } = req.body;

    const downloadRequest = DownloadRequestSchema.parse({
      pluginId,
      version,
      userId: req.user.id,
      organizationId: req.user.organizationId,
    });

    const result = await pluginDistribution.downloadPlugin(downloadRequest);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    return res.json({
      success: true,
      data: {
        downloadUrl: result.downloadUrl,
        pluginPackage: result.pluginPackage,
      },
    });
  })
);

/**
 * GET /api/marketplace/plugins/:pluginId/versions/:version/download
 * Direct download endpoint with token validation
 */
router.get(
  '/plugins/:pluginId/versions/:version/download',
  relaxedRateLimit,
  asyncHandler(async (req, res) => {
    const { pluginId, version } = req.params;
    const { token } = req.query;

    // TODO: Validate download token
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Download token required',
      });
    }

    // Get plugin package
    const downloadRequest = {
      pluginId,
      version,
      userId: 'system', // System download
    };

    const result = await pluginDistribution.downloadPlugin(downloadRequest);

    if (!(result.success && result.pluginPackage)) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found',
      });
    }

    // Return plugin bundle
    const bundle = Buffer.from(result.pluginPackage.bundle, 'base64');

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${pluginId}-${version}.zip"`);
    return res.send(bundle);
  })
);

/**
 * POST /api/marketplace/plugins/:pluginId/validate
 * Validate a plugin without publishing
 */
router.post(
  '/plugins/:pluginId/validate',
  moderateRateLimit,
  authenticate,
  asyncHandler(async (req, res) => {
    const pluginPackage = req.body;

    const validationResult = await pluginValidator.validatePlugin(pluginPackage);

    return res.json({
      success: true,
      data: validationResult,
    });
  })
);

/**
 * GET /api/marketplace/stats
 * Get marketplace statistics
 */
router.get(
  '/stats',
  relaxedRateLimit,
  asyncHandler(async (_req, res) => {
    const [registryStats, downloadStats] = await Promise.all([
      pluginRegistry.getMarketplaceStats(),
      pluginDistribution.getDownloadStats(),
    ]);

    return res.json({
      success: true,
      data: {
        ...registryStats,
        ...downloadStats,
      },
    });
  })
);

/**
 * GET /api/marketplace/categories
 * Get available plugin categories
 */
router.get(
  '/categories',
  relaxedRateLimit,
  asyncHandler(async (_req, res) => {
    const categories = [
      { id: 'integration', name: 'Integrations', description: 'Connect with external services' },
      { id: 'trigger', name: 'Triggers', description: 'Start workflows automatically' },
      { id: 'action', name: 'Actions', description: 'Perform specific tasks' },
      { id: 'utility', name: 'Utilities', description: 'Helper functions and tools' },
      { id: 'ai', name: 'AI & ML', description: 'Artificial intelligence and machine learning' },
    ];

    return res.json({
      success: true,
      data: categories,
    });
  })
);

/**
 * GET /api/marketplace/featured
 * Get featured plugins
 */
router.get(
  '/featured',
  relaxedRateLimit,
  asyncHandler(async (_req, res) => {
    const searchQuery = {
      featured: true,
      limit: 10,
      offset: 0,
      sortBy: 'downloads' as const,
      sortOrder: 'desc' as const,
    };

    const result = await pluginRegistry.searchPlugins(searchQuery);

    return res.json({
      success: true,
      data: result.plugins,
    });
  })
);

/**
 * POST /api/marketplace/plugins/:pluginId/review
 * Submit a review for a plugin
 */
router.post(
  '/plugins/:pluginId/review',
  moderateRateLimit,
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { pluginId } = req.params;
    const { rating, comment } = req.body;

    // Validate review data
    const reviewSchema = z.object({
      rating: z.number().min(1).max(5),
      comment: z.string().min(10).max(1000).optional(),
    });

    const reviewData = reviewSchema.parse({ rating, comment });

    // TODO: Implement review system
    // - Store review in database
    // - Update plugin rating
    // - Prevent duplicate reviews from same user

    logger.info(`Review submitted for plugin ${pluginId} by user ${req.user.id}`, {
      pluginId,
      userId: req.user.id,
      rating: reviewData.rating,
    });

    return res.json({
      success: true,
      message: 'Review submitted successfully',
    });
  })
);

export default router;
