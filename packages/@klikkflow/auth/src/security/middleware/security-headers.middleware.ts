import cors, { type CorsOptions } from 'cors';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export interface SecurityHeadersConfig {
  cors?: CorsConfig;
  csp?: CSPConfig;
  additionalHeaders?: Record<string, string>;
}

export interface CorsConfig {
  enabled?: boolean;
  origins?: string[] | '*';
  credentials?: boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
  dynamicOrigin?: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => void;
}

export interface CSPConfig {
  enabled?: boolean;
  directives?: CSPDirectives;
  reportOnly?: boolean;
  reportUri?: string;
  upgradeInsecureRequests?: boolean;
  blockAllMixedContent?: boolean;
}

export interface CSPDirectives {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  connectSrc?: string[];
  fontSrc?: string[];
  objectSrc?: string[];
  mediaSrc?: string[];
  frameSrc?: string[];
  frameAncestors?: string[];
  formAction?: string[];
  baseUri?: string[];
  workerSrc?: string[];
  manifestSrc?: string[];
  prefetchSrc?: string[];
  navigateTo?: string[];
  reportUri?: string[];
  reportTo?: string[];
  requireSriFor?: string[];
  requireTrustedTypesFor?: string[];
  sandbox?: string[];
  trustedTypes?: string[];
  upgradeInsecureRequests?: boolean;
  blockAllMixedContent?: boolean;
}

/**
 * Default CSP directives for maximum security
 */
const DEFAULT_CSP_DIRECTIVES: CSPDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // May need adjustment based on app
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'"],
  fontSrc: ["'self'"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],
  frameAncestors: ["'none'"],
  formAction: ["'self'"],
  baseUri: ["'self'"],
  workerSrc: ["'self'"],
  manifestSrc: ["'self'"],
};

/**
 * Create CORS middleware with security best practices
 */
export function createCorsMiddleware(config: CorsConfig = {}): RequestHandler {
  const {
    enabled = true,
    origins = ['http://localhost:3000'],
    credentials = true,
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
    exposedHeaders = ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge = 86400, // 24 hours
    preflightContinue = false,
    optionsSuccessStatus = 204,
    dynamicOrigin,
  } = config;

  if (!enabled) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  const corsOptions: CorsOptions = {
    credentials,
    methods,
    allowedHeaders,
    exposedHeaders,
    maxAge,
    preflightContinue,
    optionsSuccessStatus,
  };

  // Configure origin
  if (dynamicOrigin) {
    corsOptions.origin = dynamicOrigin as CorsOptions['origin'];
  } else if (origins === '*') {
    // CodeQL fix: Prevent wildcard CORS in production (Alert #133, #113)
    // Security guarantee: wildcard is ONLY allowed in non-production environments
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Wildcard CORS origin (*) is not allowed in production');
    }
    // CodeQL: Safe - production check above ensures this only runs in dev/test
    // Wildcard CORS is intentionally permissive for local development
    corsOptions.origin = true; // Allow all origins in development only
  } else if (Array.isArray(origins)) {
    corsOptions.origin = (origin, callback) => {
      if (!origin) {
        // Allow requests with no origin (e.g., mobile apps, Postman)
        return callback(null, true);
      }

      if (origins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    };
  }

  return cors(corsOptions);
}

/**
 * Convert camelCase directive name to kebab-case
 */
function buildDirectiveName(key: string): string {
  return key.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Format a single CSP directive value
 */
function formatDirectiveValue(
  key: string,
  value: string[] | boolean | undefined | null
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const directiveName = buildDirectiveName(key);

  if (typeof value === 'boolean') {
    return value ? directiveName : null;
  }

  if (Array.isArray(value) && value.length > 0) {
    return `${directiveName} ${value.join(' ')}`;
  }

  return null;
}

/**
 * Build policy directives array from CSP directives object
 */
function buildPolicyDirectives(directives: CSPDirectives): string[] {
  const policyDirectives: string[] = [];

  for (const [key, value] of Object.entries(directives)) {
    const formatted = formatDirectiveValue(key, value);
    if (formatted) {
      policyDirectives.push(formatted);
    }
  }

  return policyDirectives;
}

/**
 * Add optional CSP directives
 */
function addOptionalDirectives(
  policyDirectives: string[],
  upgradeInsecureRequests: boolean,
  blockAllMixedContent: boolean,
  reportUri: string | undefined
): void {
  if (upgradeInsecureRequests) {
    policyDirectives.push('upgrade-insecure-requests');
  }

  if (blockAllMixedContent) {
    policyDirectives.push('block-all-mixed-content');
  }

  if (reportUri) {
    policyDirectives.push(`report-uri ${reportUri}`);
  }
}

/**
 * Create Content Security Policy middleware
 */
export function createCSPMiddleware(
  config: CSPConfig = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const {
    enabled = true,
    directives = DEFAULT_CSP_DIRECTIVES,
    reportOnly = false,
    reportUri,
    upgradeInsecureRequests = true,
    blockAllMixedContent = true,
  } = config;

  return (_req: Request, res: Response, next: NextFunction) => {
    if (!enabled) {
      return next();
    }

    // Build CSP header
    const mergedDirectives = { ...DEFAULT_CSP_DIRECTIVES, ...directives };
    const policyDirectives = buildPolicyDirectives(mergedDirectives);

    // Add optional directives
    addOptionalDirectives(
      policyDirectives,
      upgradeInsecureRequests,
      blockAllMixedContent,
      reportUri
    );

    const policy = policyDirectives.join('; ');
    const headerName = reportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';

    res.setHeader(headerName, policy);
    next();
  };
}

/**
 * Create comprehensive security headers middleware
 */
export function createSecurityHeadersMiddleware(
  config: SecurityHeadersConfig = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const { additionalHeaders = {} } = config;

  // Default security headers
  const defaultHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    ...additionalHeaders,
  };

  return (_req: Request, res: Response, next: NextFunction) => {
    // Apply security headers
    for (const [header, value] of Object.entries(defaultHeaders)) {
      res.setHeader(header, value);
    }

    // Remove potentially dangerous headers
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    next();
  };
}

/**
 * Create a combined security middleware with CORS, CSP, and other security headers
 */
export function createCombinedSecurityMiddleware(config: SecurityHeadersConfig = {}) {
  const corsMiddleware = createCorsMiddleware(config.cors);
  const cspMiddleware = createCSPMiddleware(config.csp);
  const securityHeadersMiddleware = createSecurityHeadersMiddleware(config);

  return [corsMiddleware, cspMiddleware, securityHeadersMiddleware];
}

/**
 * Environment-specific configurations
 */
export const SECURITY_CONFIGS = {
  development: {
    cors: {
      enabled: true,
      origins: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
      credentials: true,
    },
    csp: {
      enabled: false, // Often disabled in development for hot reload
      reportOnly: true,
    },
  },
  staging: {
    cors: {
      enabled: true,
      origins: ['https://staging.klikkflow.com'],
      credentials: true,
    },
    csp: {
      enabled: true,
      reportOnly: true,
      reportUri: '/api/security/csp-report',
    },
  },
  production: {
    cors: {
      enabled: true,
      origins: ['https://klikkflow.com', 'https://www.klikkflow.com'],
      credentials: true,
      maxAge: 86400,
    },
    csp: {
      enabled: true,
      reportOnly: false,
      reportUri: '/api/security/csp-report',
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'sha256-...'"], // Add specific script hashes
        styleSrc: ["'self'", "'sha256-...'"], // Add specific style hashes
        imgSrc: ["'self'", 'https:', 'data:'],
        connectSrc: ["'self'", 'https://api.klikkflow.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: true,
      },
    },
    additionalHeaders: {
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      'X-Frame-Options': 'DENY',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  },
};

/**
 * Get security configuration based on environment
 */
export function getEnvironmentConfig(
  env: string = process.env.NODE_ENV || 'development'
): SecurityHeadersConfig {
  return SECURITY_CONFIGS[env as keyof typeof SECURITY_CONFIGS] || SECURITY_CONFIGS.development;
}

/**
 * CSP violation report handler
 */
export function createCSPReportHandler() {
  return async (_req: Request, res: Response) => {
    // CSP violation report received
    // You could process the report here
    // console.log('CSP violation reported');

    res.status(204).end();
  };
}

/**
 * Nonce generator for inline scripts/styles
 */
export function generateNonce(): string {
  const crypto = require('node:crypto');
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Middleware to add nonce to res.locals for CSP
 */
export function createNonceMiddleware() {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.locals.nonce = generateNonce();
    next();
  };
}

/**
 * Create CSP middleware with nonce support
 */
export function createCSPWithNonce(config: CSPConfig = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const nonce = res.locals.nonce;

    if (!nonce) {
      return next();
    }

    // Update script-src and style-src with nonce
    const updatedConfig = {
      ...config,
      directives: {
        ...config.directives,
        scriptSrc: [...(config.directives?.scriptSrc || ["'self'"]), `'nonce-${nonce}'`],
        styleSrc: [...(config.directives?.styleSrc || ["'self'"]), `'nonce-${nonce}'`],
      },
    };

    const cspMiddleware = createCSPMiddleware(updatedConfig);
    cspMiddleware(req, res, next);
  };
}
