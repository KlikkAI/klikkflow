/**
 * Rate Limiting Middleware
 *
 * Provides tiered rate limiting to prevent abuse and DoS attacks:
 * - Strict: Auth endpoints (login, register, password reset)
 * - Moderate: API mutations (create, update, delete)
 * - Relaxed: Read-only operations (get, list)
 */

import type { Request } from 'express';
import rateLimit from 'express-rate-limit';

/**
 * Generate a unique key combining IP and authenticated user ID
 * This prevents authenticated users from bypassing IP-based limits
 */
const generateKey = (req: Request): string => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userId = (req as Request & { user?: { id?: string } }).user?.id;
  return userId ? `${ip}:${userId}` : ip;
};

/**
 * Standard error message for rate limit exceeded
 */
const rateLimitMessage = {
  error: 'Too many requests',
  message: 'You have exceeded the rate limit. Please try again later.',
  retryAfter: 'See Retry-After header',
};

/**
 * Strict Rate Limiter (15 requests per 15 minutes)
 * Use for: Authentication, password reset, account operations
 */
export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 requests per window
  message: rateLimitMessage,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: generateKey,
  skipSuccessfulRequests: false, // Count all requests
  skipFailedRequests: false, // Count failed requests too
});

/**
 * Moderate Rate Limiter (100 requests per 15 minutes)
 * Use for: API mutations (create, update, delete operations)
 */
export const moderateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Relaxed Rate Limiter (300 requests per 15 minutes)
 * Use for: Read-only operations (get, list, search)
 */
export const relaxedRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per window
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * File Upload Rate Limiter (10 uploads per hour)
 * Use for: File upload endpoints
 */
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
  message: {
    error: 'Upload limit exceeded',
    message: 'You have exceeded the file upload limit. Please try again later.',
    retryAfter: 'See Retry-After header',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Webhook Rate Limiter (1000 requests per hour)
 * Use for: Webhook endpoints that receive external calls
 */
export const webhookRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // 1000 requests per hour
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});
