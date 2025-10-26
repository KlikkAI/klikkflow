/**
 * Authentication Service
 * Handles user registration, login, token management, and profile operations
 */

import { AppError } from '../../../middleware/errorHandlers';
import { User } from '../../../models/User';
import { JWTService } from '../../../utils/jwt';
import { logger } from '../../../utils/logger';
import type { IRegistrationData, IUser, IUserProfile } from '../interfaces';

interface AuthResult {
  user: IUser;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Register a new user
   */
  async register(userData: IRegistrationData): Promise<AuthResult> {
    try {
      // Check if user already exists (use $eq to prevent NoSQL injection)
      const existingUser = await User.findOne({ email: { $eq: userData.email } });
      if (existingUser) {
        throw new AppError('User with this email already exists', 409);
      }

      // Create new user (password will be hashed automatically by pre-save hook)
      const user = await User.create({
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: 'member', // Default role
        permissions: [],
        isActive: true,
        isEmailVerified: false,
        preferences: {
          language: 'en',
          timezone: 'UTC',
          theme: 'system',
          notifications: {
            email: true,
            push: true,
            workflow: true,
          },
        },
      });

      // Generate tokens
      const accessToken = JWTService.generateAccessToken(
        user._id.toString(),
        user.email,
        user.role,
        user.permissions,
        user.isEmailVerified,
        user.organizationId
      );
      const refreshToken = JWTService.generateRefreshToken(
        user._id.toString(),
        user.email,
        user.role,
        user.permissions,
        user.isEmailVerified,
        user.organizationId
      );

      // Store refresh token
      user.refreshTokens.push(refreshToken);
      await user.save();

      logger.info(`New user registered: ${user.email}`);

      return {
        user: user.toObject() as IUser,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Registration error:', error);
      throw new AppError('Registration failed', 500);
    }
  }

  /**
   * Authenticate user and generate tokens
   */
  async login(email: string, password: string): Promise<AuthResult> {
    try {
      // Find user with password (password is not selected by default, use $eq to prevent NoSQL injection)
      const user = await User.findOne({ email: { $eq: email } }).select('+password +refreshTokens');

      if (!user) {
        throw new AppError('Invalid email or password', 401);
      }

      // Check if account is locked
      if (user.isLocked()) {
        throw new AppError(
          'Account is temporarily locked due to too many failed login attempts. Please try again later.',
          423
        );
      }

      // Check if account is active
      if (!user.isActive) {
        throw new AppError('Account is deactivated', 403);
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        // Increment failed login attempts
        await user.incLoginAttempts();
        throw new AppError('Invalid email or password', 401);
      }

      // Reset failed login attempts on successful login
      if (user.failedLoginAttempts > 0) {
        await user.resetLoginAttempts();
      }

      // Generate tokens
      const accessToken = JWTService.generateAccessToken(
        user._id.toString(),
        user.email,
        user.role,
        user.permissions,
        user.isEmailVerified,
        user.organizationId
      );
      const refreshToken = JWTService.generateRefreshToken(
        user._id.toString(),
        user.email,
        user.role,
        user.permissions,
        user.isEmailVerified,
        user.organizationId
      );

      // Store refresh token and update last login
      user.refreshTokens.push(refreshToken);
      user.lastLogin = new Date();
      await user.save();

      logger.info(`User logged in: ${user.email}`);

      // Remove password from response
      const userWithoutPassword = user.toJSON() as IUser;

      return {
        user: userWithoutPassword,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Login error:', error);
      throw new AppError('Login failed', 500);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verify refresh token
      const decoded = JWTService.verifyToken(refreshToken);

      if (decoded.type !== 'refresh') {
        throw new AppError('Invalid token type', 401);
      }

      // Find user and check if refresh token exists
      const user = await User.findById(decoded.userId).select('+refreshTokens');

      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!user.refreshTokens.includes(refreshToken)) {
        throw new AppError('Invalid refresh token', 401);
      }

      // Generate new tokens
      const newAccessToken = JWTService.generateAccessToken(
        user._id.toString(),
        user.email,
        user.role,
        user.permissions,
        user.isEmailVerified,
        user.organizationId
      );
      const newRefreshToken = JWTService.generateRefreshToken(
        user._id.toString(),
        user.email,
        user.role,
        user.permissions,
        user.isEmailVerified,
        user.organizationId
      );

      // Remove old refresh token and add new one
      user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken);
      user.refreshTokens.push(newRefreshToken);
      await user.save();

      logger.info(`Token refreshed for user: ${user.email}`);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Token refresh error:', error);
      throw new AppError('Token refresh failed', 401);
    }
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<IUserProfile> {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return user.toJSON() as IUserProfile;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Get user profile error:', error);
      throw new AppError('Failed to get user profile', 500);
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: Partial<IUser>): Promise<IUser> {
    try {
      // Only allow certain fields to be updated
      const allowedUpdates = ['firstName', 'lastName', 'email', 'preferences', 'department'];
      const filteredUpdates: Partial<IUser> = {};

      for (const key of Object.keys(updates)) {
        if (allowedUpdates.includes(key)) {
          (filteredUpdates as Record<string, unknown>)[key] = (updates as Record<string, unknown>)[
            key
          ];
        }
      }

      // If email is being updated, check if it's already taken (use $eq to prevent NoSQL injection)
      if (filteredUpdates.email) {
        const existingUser = await User.findOne({ email: { $eq: filteredUpdates.email } });
        if (existingUser && existingUser._id.toString() !== userId) {
          throw new AppError('Email already in use', 409);
        }
      }

      const user = await User.findByIdAndUpdate(userId, filteredUpdates, {
        new: true,
        runValidators: true,
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      logger.info(`Profile updated for user: ${user.email}`);

      return user.toJSON() as IUser;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Update profile error:', error);
      throw new AppError('Failed to update profile', 500);
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      const user = await User.findById(userId).select('+password');

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Verify current password
      const isPasswordValid = await user.comparePassword(currentPassword);

      if (!isPasswordValid) {
        throw new AppError('Current password is incorrect', 401);
      }

      // Update password (will be hashed automatically by pre-save hook)
      user.password = newPassword;
      await user.save();

      logger.info(`Password changed for user: ${user.email}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Change password error:', error);
      throw new AppError('Failed to change password', 500);
    }
  }

  /**
   * Logout user (invalidate refresh token)
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    try {
      const user = await User.findById(userId).select('+refreshTokens');

      if (!user) {
        return; // User not found, but don't throw error
      }

      if (refreshToken) {
        // Remove specific refresh token
        user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken);
      } else {
        // Remove all refresh tokens (logout from all devices)
        user.refreshTokens = [];
      }

      await user.save();

      logger.info(`User logged out: ${user.email}`);
    } catch (error) {
      logger.error('Logout error:', error);
      // Don't throw error on logout
    }
  }
}
