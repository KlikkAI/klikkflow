import express, { type Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../../../middleware/auth';
import { catchAsync } from '../../../middleware/errorHandlers';
import { moderateRateLimit, relaxedRateLimit } from '../../../middleware/rate-limit.middleware';
import { CredentialController } from '../controllers/CredentialController';

const router: Router = express.Router();
const credentialController = new CredentialController();

/**
 * @route   GET /credentials
 * @desc    Get all credentials for user
 * @access  Private
 */
router.get('/', relaxedRateLimit, authenticate, catchAsync(credentialController.getCredentials));

/**
 * @route   GET /credentials/debug
 * @desc    Get all credentials (debug route)
 * @access  Private (Admin only - TODO: add admin middleware)
 */
router.get(
  '/debug',
  relaxedRateLimit,
  authenticate,
  catchAsync(credentialController.getAllCredentialsDebug)
);

/**
 * @route   POST /credentials
 * @desc    Create new credential
 * @access  Private
 */
router.post(
  '/',
  moderateRateLimit,
  authenticate,
  [
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('type')
      .isIn(['oauth2', 'apiKey', 'basic', 'jwt', 'custom'])
      .withMessage('Type must be oauth2, apiKey, basic, jwt, or custom'),
    body('integration').trim().isLength({ min: 1, max: 100 }),
    body('data').isObject(),
    body('expiresAt').optional().isISO8601().toDate(),
  ],
  catchAsync(credentialController.createCredential)
);

/**
 * @route   PUT /credentials/:id
 * @desc    Update credential
 * @access  Private
 */
router.put(
  '/:id',
  moderateRateLimit,
  authenticate,
  [
    param('id').isMongoId(),
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('data').optional().isObject(),
    body('expiresAt').optional().isISO8601().toDate(),
    body('isActive').optional().isBoolean(),
  ],
  catchAsync(credentialController.updateCredential)
);

/**
 * @route   DELETE /credentials/:id
 * @desc    Delete credential
 * @access  Private
 */
router.delete(
  '/:id',
  moderateRateLimit,
  authenticate,
  [param('id').isMongoId()],
  catchAsync(credentialController.deleteCredential)
);

/**
 * @route   POST /credentials/:id/test
 * @desc    Test credential connection
 * @access  Private
 */
router.post(
  '/:id/test',
  moderateRateLimit,
  authenticate,
  [param('id').isMongoId()],
  catchAsync(credentialController.testCredential)
);

/**
 * @route   POST /credentials/:id/test-gmail
 * @desc    Test Gmail credential and fetch sample emails
 * @access  Private
 */
router.post(
  '/:id/test-gmail',
  moderateRateLimit,
  authenticate,
  [param('id').isMongoId(), body('filters').optional().isObject()],
  catchAsync(credentialController.testGmail)
);

export default router;
