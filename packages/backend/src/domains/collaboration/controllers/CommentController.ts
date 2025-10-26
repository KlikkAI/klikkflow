/**
 * Comment Controller for Collaboration REST API
 * Provides HTTP endpoints for collaborative comment system
 */

import type { Request, Response } from 'express';
import { Comment } from '../../../models/Comment';
import { asyncHandler } from '../../../utils/asyncHandler';
import { ApiResponse } from '../../../utils/response';
import { CollaborationService } from '../services/CollaborationService';

export class CommentController {
  constructor() {
    this.collaborationService = CollaborationService.getInstance();
  }

  /**
   * Get comments for a workflow
   * GET /collaboration/comments/:workflowId
   */
  public getWorkflowComments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { workflowId } = req.params;
    const {
      status,
      nodeId,
      limit = 50,
      page = 1,
      includeReplies = true,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dateRange = 30,
    } = req.query;

    if (!workflowId) {
      res.status(400).json(ApiResponse.error('Workflow ID is required'));
      return;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(dateRange));

    // Get comment analytics
    const commentStats = await Comment.aggregate([
      {
        $match: {
          workflowId,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalComments: { $sum: 1 },
          openComments: {
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] },
          },
          resolvedComments: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] },
          },
          totalReplies: { $sum: { $size: '$thread' } },
          totalReactions: { $sum: { $size: '$reactions' } },
          averageRepliesPerComment: { $avg: { $size: '$thread' } },
        },
      },
    ]);

    // Get comment activity by day
    const dailyActivity = await Comment.aggregate([
      {
        $match: {
          workflowId,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get top commenters
    const topCommenters = await Comment.aggregate([
      {
        $match: {
          workflowId,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$authorId',
          commentCount: { $sum: 1 },
        },
      },
      { $sort: { commentCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'author',
        },
      },
      {
        $unwind: '$author',
      },
      {
        $project: {
          _id: 1,
          commentCount: 1,
          name: '$author.name',
          email: '$author.email',
        },
      },
    ]);

    const analytics = {
      dateRange: Number(dateRange),
      summary: commentStats[0] || {
        totalComments: 0,
        openComments: 0,
        resolvedComments: 0,
        totalReplies: 0,
        totalReactions: 0,
        averageRepliesPerComment: 0,
      },
      dailyActivity,
      topCommenters,
    };

    res.json(ApiResponse.success(analytics));
  });
}
