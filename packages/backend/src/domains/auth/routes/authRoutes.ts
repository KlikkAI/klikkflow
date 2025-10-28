import express, { type Router } from 'express';
import { authenticate } from '../../../middleware/auth';
import { enhancedCatchAsync } from '../../../middleware/enhancedErrorHandlers';
import {
  moderateRateLimit,
  relaxedRateLimit,
  strictRateLimit,
} from '../../../middleware/rate-limit.middleware';
import { ApiKeyController } from '../controllers/ApiKeyController';
import { AuthController } from '../controllers/AuthController';
import {
  apiKeyIdValidation,
  createApiKeyValidation,
  updateApiKeyValidation,
} from '../validators/apiKeyValidators';
import {
  changePasswordValidation,
  loginValidation,
  refreshTokenValidation,
  registerValidation,
  updateProfileValidation,
} from '../validators/authValidators';

const router: Router = express.Router();
const authController = new AuthController();
const apiKeyController = new ApiKeyController();

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  strictRateLimit,
  registerValidation,
  enhancedCatchAsync(authController.register)
);

/**
 * @route   POST /auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', strictRateLimit, loginValidation, enhancedCatchAsync(authController.login));

/**
 * @route   POST /auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh',
  moderateRateLimit,
  refreshTokenValidation,
  enhancedCatchAsync(authController.refreshToken)
);

/**
 * @route   POST /auth/logout
 * @desc    Logout user (optional - mainly for client-side token removal)
 * @access  Private
 */
router.post('/logout', moderateRateLimit, enhancedCatchAsync(authController.logout));

/**
 * @route   GET /auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', relaxedRateLimit, authenticate, enhancedCatchAsync(authController.getProfile));

/**
 * @route   GET /auth/profile
 * @desc    Get current user profile (alternative endpoint)
 * @access  Private
 */
router.get(
  '/profile',
  relaxedRateLimit,
  authenticate,
  enhancedCatchAsync(authController.getProfile)
);

/**
 * @route   PUT /auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  moderateRateLimit,
  authenticate,
  updateProfileValidation,
  enhancedCatchAsync(authController.updateProfile)
);

/**
 * @route   PUT /auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put(
  '/change-password',
  strictRateLimit,
  authenticate,
  changePasswordValidation,
  enhancedCatchAsync(authController.changePassword)
);

/**
 * API Key Management Routes
 */

/**
 * @route   GET /auth/api-keys
 * @desc    Get all API keys for the authenticated user
 * @access  Private
 */
router.get(
  '/api-keys',
  relaxedRateLimit,
  authenticate,
  enhancedCatchAsync(apiKeyController.getApiKeys)
);

/**
 * @route   GET /auth/api-keys/:keyId
 * @desc    Get a specific API key by ID
 * @access  Private
 */
router.get(
  '/api-keys/:keyId',
  relaxedRateLimit,
  authenticate,
  apiKeyIdValidation,
  enhancedCatchAsync(apiKeyController.getApiKeyById)
);

/**
 * @route   POST /auth/api-keys
 * @desc    Create a new API key
 * @access  Private
 */
router.post(
  '/api-keys',
  moderateRateLimit,
  authenticate,
  createApiKeyValidation,
  enhancedCatchAsync(apiKeyController.createApiKey)
);

/**
 * @route   PATCH /auth/api-keys/:keyId
 * @desc    Update API key permissions
 * @access  Private
 */
router.patch(
  '/api-keys/:keyId',
  moderateRateLimit,
  authenticate,
  apiKeyIdValidation,
  updateApiKeyValidation,
  enhancedCatchAsync(apiKeyController.updateApiKey)
);

/**
 * @route   DELETE /auth/api-keys/:keyId
 * @desc    Revoke (delete) an API key
 * @access  Private
 */
router.delete(
  '/api-keys/:keyId',
  moderateRateLimit,
  authenticate,
  apiKeyIdValidation,
  enhancedCatchAsync(apiKeyController.revokeApiKey)
);

/**
 * @route   POST /auth/api-keys/cleanup
 * @desc    Cleanup expired API keys (admin or scheduled job)
 * @access  Private
 */
router.post(
  '/api-keys/cleanup',
  strictRateLimit,
  authenticate,
  enhancedCatchAsync(apiKeyController.cleanupExpiredKeys)
);

export default router;
