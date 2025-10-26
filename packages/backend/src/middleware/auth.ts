/**
 * Enhanced Authentication and Authorization Middleware
 * Implements JWT verification with RBAC permission checking
 */

import type { AuthenticatedUser } from '@klikkflow/shared';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../domains/auth/repositories/UserRepository';
import type { Permission } from '../services/PermissionService';
import { AppError } from './errorHandlers';

// Import AuthenticatedUser from shared package instead of declaring global namespace
// The shared package already defines Express.Request augmentation

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  organizationId?: string;
  isEmailVerified: boolean;
  iat: number;
  exp: number;
}

export class AuthMiddleware {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Verify JWT token and attach user to request
   */
  authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);
      if (!token) {
        throw new AppError('Authentication token is required', 401);
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new AppError('JWT secret not configured', 500);
      }

      // Verify and decode token
      const decoded = jwt.verify(token, secret) as AuthPayload;

      // Verify user still exists and is active
      const user = await this.userRepository.findById(decoded.userId);
      if (!user?.isActive) {
        throw new AppError('User account not found or inactive', 401);
      }

      // Check if user is locked
      if (user.isLocked()) {
        throw new AppError('Account is temporarily locked', 423);
      }

      // Attach user data to request - aligned with AuthenticatedUser from shared
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        roles: decoded.role ? [decoded.role] : [],
        permissions: decoded.permissions,
        organizationId: decoded.organizationId,
        isEmailVerified: decoded.isEmailVerified,
      };

      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        next(new AppError('Invalid authentication token', 401));
      } else if (error instanceof jwt.TokenExpiredError) {
        next(new AppError('Authentication token has expired', 401));
      } else {
        next(error);
      }
    }
  };

  /**
   * Optional authentication - doesn't throw error if no token
   */
  optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);
      if (!token) {
        return next();
      }

      await this.authenticate(req, res, next);
    } catch (_error) {
      // For optional auth, continue without user data
      next();
    }
  };

  /**
   * Require specific permission
   */
  requirePermission = (permission: Permission) => {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        // Super admin has all permissions
        const userRoles = req.user.roles || (req.user.role ? [req.user.role] : []);
        if (userRoles.includes('super_admin')) {
          return next();
        }

        // Check if user has the required permission
        const userPermissions = req.user.permissions || [];
        if (!userPermissions.includes(permission)) {
          throw new AppError('Insufficient permissions', 403);
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  };

  /**
   * Require one of multiple permissions
   */
  requireAnyPermission = (permissions: Permission[]) => {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        // Super admin has all permissions
        const userRoles = req.user.roles || (req.user.role ? [req.user.role] : []);
        if (userRoles.includes('super_admin')) {
          return next();
        }

        // Check if user has any of the required permissions
        const userPermissions = req.user.permissions || [];
        const hasPermission = permissions.some((permission) =>
          userPermissions.includes(permission)
        );

        if (!hasPermission) {
          throw new AppError('Insufficient permissions', 403);
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  };

  /**
   * Require specific role
   */
  requireRole = (roles: string | string[]) => {
    const roleArray = Array.isArray(roles) ? roles : [roles];

    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const userRoles = req.user.roles || (req.user.role ? [req.user.role] : []);
        const hasRequiredRole = userRoles.some((userRole) => roleArray.includes(userRole));

        if (!hasRequiredRole) {
          throw new AppError('Insufficient role privileges', 403);
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  };

  /**
   * Require email verification
   */
  requireEmailVerification = async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      if (!req.user.isEmailVerified) {
        throw new AppError('Email verification required', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };

  /**
   * Check resource ownership or admin access
   */
  requireOwnershipOrAdmin = (resourceUserIdField: string = 'userId') => {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        // Admin and super_admin can access any resource
        const userRoles = req.user.roles || (req.user.role ? [req.user.role] : []);
        const hasAdminRole = userRoles.some((role) => ['admin', 'super_admin'].includes(role));

        if (hasAdminRole) {
          return next();
        }

        // Get resource user ID from params, body, or query
        const resourceUserId =
          req.params[resourceUserIdField] ||
          req.body[resourceUserIdField] ||
          req.query[resourceUserIdField];

        if (!resourceUserId) {
          throw new AppError('Resource ownership cannot be determined', 400);
        }

        // Check if user owns the resource
        if (req.user.id !== resourceUserId) {
          throw new AppError('Access denied: insufficient privileges', 403);
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  };

  /**
   * Rate limiting by user
   */
  rateLimitByUser = (maxRequests: number, windowMs: number) => {
    const userRequests = new Map<string, { count: number; resetTime: number }>();

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const userId = req.user.id;
        const now = Date.now();
        const userLimit = userRequests.get(userId);

        if (!userLimit || now > userLimit.resetTime) {
          // Reset window
          userRequests.set(userId, {
            count: 1,
            resetTime: now + windowMs,
          });
          return next();
        }

        if (userLimit.count >= maxRequests) {
          res.status(429).json({
            success: false,
            error: 'Too many requests',
            retryAfter: Math.ceil((userLimit.resetTime - now) / 1000),
          });
          return;
        }

        userLimit.count++;
        next();
      } catch (error) {
        next(error);
      }
    };
  };

  /**
   * Organization context validation
   */
  requireOrganization = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      if (!req.user.organizationId) {
        throw new AppError('Organization membership required', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };

  /**
   * Extract token from Authorization header or cookies
   */
  private extractToken(req: Request): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Legacy support for bearer (lowercase)
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      return authHeader.split(' ')[1];
    }

    // Legacy support: token without Bearer prefix (only if no spaces)
    if (authHeader && !authHeader.includes(' ')) {
      return authHeader;
    }

    // Check cookies (for browser requests)
    if (req.cookies?.token) {
      return req.cookies.token;
    }

    // Check query parameter (for websocket connections)
    if (req.query?.token && typeof req.query.token === 'string') {
      return req.query.token;
    }

    return null;
  }
}

// Export singleton instance
export const authMiddleware = new AuthMiddleware();

// Export individual middleware functions for convenience and backward compatibility
export const authenticate = authMiddleware.authenticate;
export const optionalAuth = authMiddleware.optionalAuth;
export const requirePermission = authMiddleware.requirePermission;
export const requireAnyPermission = authMiddleware.requireAnyPermission;
export const requireRole = authMiddleware.requireRole;
export const requireEmailVerification = authMiddleware.requireEmailVerification;
export const requireOwnershipOrAdmin = authMiddleware.requireOwnershipOrAdmin;
export const rateLimitByUser = authMiddleware.rateLimitByUser;
export const requireOrganization = authMiddleware.requireOrganization;

// Legacy compatibility exports
export const authorize = (...roles: string[]) => {
  return authMiddleware.requireRole(roles);
};
