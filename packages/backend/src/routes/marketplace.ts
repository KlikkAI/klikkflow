/**
 * Plugin Marketplace API Routes
 * Handles plugin publishing, searching, downloading, and management
 */

import { Logger } from '@reporunner/core';
import {
  DownloadRequestSchema,
  PluginDistribution,
  PluginRegistry,
  PluginSearchSchema,
  PluginValidator,
  PublishRequestSchema,
} from '@reporunner/platform';
import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

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
  asyncHandler(async (req, res) => {
    const searchQuery = PluginSearchSchema.parse(req.query);

    const result = await pluginRegistry.searchPlugins(searchQuery);

    res.json({
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

    res.json({
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
  authMiddleware,
  asyncHandler(async (req, res) => {
    const publishRequest = PublishRequestSchema.parse({
      ...req.body,
      publisherInfo: {
        userId: req.user.id,
        organizationId: req.user.organizationId,
        publisherType: req.user.type || 'individual',
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

    res.status(201).json({
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
  authMiddleware,
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

    res.json({
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
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { pluginId, version } = req.params;

    const publisherInfo = {
      userId: req.user.id,
      organizationId: req.user.organizationId,
      publisherType: req.user.type || 'individual',
    };

    const result = await pluginDistribution.unpublishPlugin(pluginId, version, publisherInfo);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
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
  authMiddleware,
  asyncHandler(async (req, res) => {
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

    res.json({
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
    res.send(bundle);
  })
);

/**
 * POST /api/marketplace/plugins/:pluginId/validate
 * Validate a plugin without publishing
 */
router.post(
  '/plugins/:pluginId/validate',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const pluginPackage = req.body;

    const validationResult = await pluginValidator.validatePlugin(pluginPackage);

    res.json({
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
  asyncHandler(async (_req, res) => {
    const [registryStats, downloadStats] = await Promise.all([
      pluginRegistry.getMarketplaceStats(),
      pluginDistribution.getDownloadStats(),
    ]);

    res.json({
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
  asyncHandler(async (_req, res) => {
    const categories = [
      { id: 'integration', name: 'Integrations', description: 'Connect with external services' },
      { id: 'trigger', name: 'Triggers', description: 'Start workflows automatically' },
      { id: 'action', name: 'Actions', description: 'Perform specific tasks' },
      { id: 'utility', name: 'Utilities', description: 'Helper functions and tools' },
      { id: 'ai', name: 'AI & ML', description: 'Artificial intelligence and machine learning' },
    ];

    res.json({
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
  asyncHandler(async (_req, res) => {
    const searchQuery = {
      featured: true,
      limit: 10,
      sortBy: 'downloads' as const,
      sortOrder: 'desc' as const,
    };

    const result = await pluginRegistry.searchPlugins(searchQuery);

    res.json({
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
  authMiddleware,
  asyncHandler(async (req, res) => {
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

    res.json({
      success: true,
      message: 'Review submitted successfully',
    });
  })
);

export default router;
