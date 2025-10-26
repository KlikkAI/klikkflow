import express, { type Router } from 'express';
import { authenticate } from '../../../middleware/auth';
import { enhancedCatchAsync } from '../../../middleware/enhancedErrorHandlers';
import {
  moderateRateLimit,
  relaxedRateLimit,
  strictRateLimit,
} from '../../../middleware/rate-limit.middleware';
import { AuthController } from '../controllers/AuthController';
import {
  changePasswordValidation,
  loginValidation,
  refreshTokenValidation,
  registerValidation,
  updateProfileValidation,
} from '../validators/authValidators';

const router: Router = express.Router();
const authController = new AuthController();

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

export default router;
