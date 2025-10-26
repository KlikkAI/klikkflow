import express, { type Router } from 'express';
import { body } from 'express-validator';
import { isValidOAuthRedirectURI } from '../../../../../@klikkflow/auth/src/utils/url-validator';
import { authenticate } from '../../../middleware/auth';
import { catchAsync } from '../../../middleware/errorHandlers';
import {
  moderateRateLimit,
  relaxedRateLimit,
  strictRateLimit,
} from '../../../middleware/rate-limit.middleware';
import { OAuthController } from '../controllers/OAuthController';

const router: Router = express.Router();
const oauthController = new OAuthController();

/**
 * @route   POST /oauth/gmail/initiate
 * @desc    Initiate Gmail OAuth2 flow
 * @access  Private
 */
router.post(
  '/gmail/initiate',
  strictRateLimit,
  authenticate,
  [body('credentialName').notEmpty().withMessage('Credential name is required')],
  catchAsync(oauthController.initiateGmailOAuth)
);

/**
 * @route   POST /oauth/gmail/exchange-code
 * @desc    Exchange authorization code for tokens
 * @access  Private
 */
router.post(
  '/gmail/exchange-code',
  strictRateLimit,
  [
    body('code').notEmpty().withMessage('Authorization code is required'),
    body('clientId').notEmpty().withMessage('Client ID is required'),
    body('clientSecret').notEmpty().withMessage('Client Secret is required'),
    // CVE-2025-56200: Use secure OAuth redirect URI validator instead of isURL()
    body('redirectUri')
      .optional()
      .custom((value) => {
        if (!value) return true; // Optional field
        return isValidOAuthRedirectURI(value);
      })
      .withMessage('Invalid or insecure redirect URI'),
    body('state').optional().isString().withMessage('Invalid state parameter'),
  ],
  catchAsync(oauthController.exchangeCodeForTokens)
);

/**
 * @route   GET /oauth/gmail/callback
 * @desc    OAuth2 callback endpoint (handles Google redirect)
 * @access  Public
 */
router.get('/gmail/callback', relaxedRateLimit, catchAsync(oauthController.handleGmailCallback));

/**
 * @route   POST /oauth/gmail/refresh-token
 * @desc    Refresh Gmail access token
 * @access  Private
 */
router.post(
  '/gmail/refresh-token',
  moderateRateLimit,
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
    body('clientId').notEmpty().withMessage('Client ID is required'),
    body('clientSecret').notEmpty().withMessage('Client Secret is required'),
  ],
  catchAsync(oauthController.refreshGmailToken)
);

/**
 * @route   POST /oauth/gmail/test-connection
 * @desc    Test Gmail connection with credentials
 * @access  Private
 */
router.post(
  '/gmail/test-connection',
  moderateRateLimit,
  [
    body('clientId').notEmpty().withMessage('Client ID is required'),
    body('clientSecret').notEmpty().withMessage('Client Secret is required'),
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  ],
  catchAsync(oauthController.testGmailConnection)
);

export default router;
