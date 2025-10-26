/**
 * Session Controller for Collaboration REST API
 * Provides HTTP endpoints for collaboration session management
 */

import type { Request, Response } from 'express';
import { CollaborationSession } from '../../../models/CollaborationSession';
import { Operation } from '../../../models/Operation';
import { asyncHandler } from '../../../utils/asyncHandler';
import { ApiResponse } from '../../../utils/response';
import { CollaborationService } from '../services/CollaborationService';

export class SessionController {
  constructor() {
    this.collaborationService = CollaborationService.getInstance();
  }

  /**
   * Get active collaboration session for a workflow
   * GET /collaboration/sessions/:workflowId
   */
  public getSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { workflowId } = req.params;
    const { dateRange = 30 } = req.query;

    if (!workflowId) {
      res.status(400).json(ApiResponse.error('Workflow ID is required'));
      return;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(dateRange));

    // Get session analytics
    const sessionStats = await CollaborationSession.aggregate([
      {
        $match: {
          workflowId,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          activeSessions: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] },
          },
          averageParticipants: { $avg: { $size: '$participants' } },
          totalParticipants: { $sum: { $size: '$participants' } },
        },
      },
    ]);

    // Get operation analytics
    const operationStats = await Operation.aggregate([
      {
        $match: {
          workflowId,
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);

    const analytics = {
      dateRange: Number(dateRange),
      sessions: sessionStats[0] || {
        totalSessions: 0,
        activeSessions: 0,
        averageParticipants: 0,
        totalParticipants: 0,
      },
      operations: operationStats.reduce(
        (acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        },
        {} as Record<string, number>
      ),
    };

    res.json(ApiResponse.success(analytics));
  });
}
