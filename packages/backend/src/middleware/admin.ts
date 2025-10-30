/**
 * Admin Authorization Middleware
 * Enforces admin-only access for sensitive endpoints
 */

import type { NextFunction, Request, Response } from 'express';
import { AppError } from './errorHandlers';

/**
 * Require admin or super_admin role
 * Must be used after authenticate() middleware
 */
export const requireAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    // Check if user has admin or super_admin role
    const userRoles = req.user.roles || (req.user.role ? [req.user.role] : []);
    const hasAdminRole = userRoles.some((role) => ['admin', 'super_admin'].includes(role));

    if (!hasAdminRole) {
      throw new AppError(
        'Access denied: Administrator privileges required for this operation',
        403
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Require super_admin role only (highest privilege level)
 * Must be used after authenticate() middleware
 */
export const requireSuperAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    // Check if user has super_admin role
    const userRoles = req.user.roles || (req.user.role ? [req.user.role] : []);
    const hasSuperAdminRole = userRoles.includes('super_admin');

    if (!hasSuperAdminRole) {
      throw new AppError(
        'Access denied: Super Administrator privileges required for this operation',
        403
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
