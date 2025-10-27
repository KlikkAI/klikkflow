import { randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '@klikkflow/shared';
import type { Request, Response } from 'express';
import { BaseController } from '../../../base/BaseController';
import { AppError } from '../../../middleware/errorHandlers';
import { logger } from '../../../utils/logger';
import { AuthService } from '../services/AuthService';

/**
 * Authenticated request with user information
 * Uses AuthenticatedUser from shared package for type consistency
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export class AuthController extends BaseController {
  private authService: AuthService;
  // Using winston logger directly

  constructor() {
    super();
    this.authService = AuthService.getInstance();
    // Using winston logger directly
  }

  /**
   * Register a new user
   */
  register = async (req: Request, res: Response) => {
    this.validateRequest(req);

    const { email, password, firstName, lastName } = req.body;
    const result = await this.authService.register({ email, password, firstName, lastName });

    // Transform response to match frontend expectations
    const responseData = {
      user: result.user,
      token: result.accessToken, // Frontend expects 'token', backend returns 'accessToken'
      refreshToken: result.refreshToken,
      permissions: result.user.permissions || [],
      sessionId: `session_${Date.now()}_${randomBytes(6).toString('hex')}`,
    };

    logger.info(`User registered: ${result.user.id}`);
    this.sendCreated(res, responseData, 'User registered successfully');
  };

  /**
   * Login user
   */
  login = async (req: Request, res: Response) => {
    this.validateRequest(req);

    const { email, password } = req.body;
    const result = await this.authService.login(email, password);

    // Transform response to match frontend expectations
    const responseData = {
      user: result.user,
      token: result.accessToken, // Frontend expects 'token', backend returns 'accessToken'
      refreshToken: result.refreshToken,
      permissions: result.user.permissions || [],
      sessionId: `session_${Date.now()}_${randomBytes(6).toString('hex')}`,
    };

    logger.info(`User logged in: ${result.user.id}`);
    this.sendSuccess(res, responseData, 'Login successful');
  };

  /**
   * Refresh access token
   */
  refreshToken = async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    const result = await this.authService.refreshToken(refreshToken);

    this.sendSuccess(res, result, 'Token refreshed successfully');
  };

  /**
   * Logout user - Invalidates refresh token
   */
  logout = async (req: Request, res: Response) => {
    const userId = this.getUserId(req);
    const { refreshToken } = req.body;

    // Invalidate the refresh token
    await this.authService.logout(userId, refreshToken);

    // Generate a simple session ID for the response
    const sessionId = `session_${Date.now()}_${randomBytes(6).toString('hex')}`;

    logger.info(`User logged out: ${userId}`);

    this.sendSuccess(
      res,
      {
        message: 'Logout successful',
        sessionId,
      },
      'Logout successful'
    );
  };

  /**
   * Get current user profile
   */
  getProfile = async (req: Request, res: Response) => {
    const userId = this.getUserId(req);
    const user = await this.authService.getUserProfile(userId);
    this.sendSuccess(res, { user });
  };

  /**
   * Update user profile
   */
  updateProfile = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    const { firstName, lastName, email } = req.body;
    const user = await this.authService.updateProfile(userId, { firstName, lastName, email });

    this.sendSuccess(res, { user }, 'Profile updated successfully');
  };

  /**
   * Change user password
   */
  changePassword = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    const { currentPassword, newPassword } = req.body;
    await this.authService.changePassword(userId, currentPassword, newPassword);

    this.sendSuccess(res, null, 'Password changed successfully');
  };
}
