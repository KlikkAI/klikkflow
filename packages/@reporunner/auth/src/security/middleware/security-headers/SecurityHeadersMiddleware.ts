import {
  type SecurityConfig,
  type SecurityContext,
  SecurityMiddleware,
} from '../base/SecurityMiddleware';
import { CSPBuilder } from './builders/CSPBuilder';
import { HSTSBuilder } from './builders/HSTSBuilder';
import { SecurityHeadersBuilder } from './builders/SecurityHeadersBuilder';

export interface SecurityHeadersConfig extends SecurityConfig {
  /**
   * Content Security Policy configuration
   */
  csp?: {
    enabled?: boolean;
    reportOnly?: boolean;
    directives?: Record<string, string[]>;
    reportUri?: string;
  };

  /**
   * HTTP Strict Transport Security configuration
   */
  hsts?: {
    enabled?: boolean;
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };

  /**
   * Cross-Origin configuration
   */
  cors?: {
    enabled?: boolean;
    origins?: string[];
    methods?: string[];
    headers?: string[];
    credentials?: boolean;
    maxAge?: number;
  };

  /**
   * Frame protection configuration
   */
  frameProtection?: {
    enabled?: boolean;
    action?: 'DENY' | 'SAMEORIGIN';
  };

  /**
   * Content Type Options configuration
   */
  contentTypeOptions?: {
    enabled?: boolean;
    nosniff?: boolean;
  };

  /**
   * XSS Protection configuration
   */
  xssProtection?: {
    enabled?: boolean;
    mode?: '0' | '1' | '1; mode=block' | '1; report=<reporting-uri>';
  };

  /**
   * Referrer Policy configuration
   */
  referrerPolicy?: {
    enabled?: boolean;
    policy?: string;
  };

  /**
   * Permissions Policy configuration
   */
  permissionsPolicy?: {
    enabled?: boolean;
    features?: Record<string, string[]>;
  };
}

const DEFAULT_CONFIG: Partial<SecurityHeadersConfig> = {
  csp: {
    enabled: true,
    reportOnly: false,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'"],
      'connect-src': ["'self'"],
      'font-src': ["'self'"],
      'object-src': ["'none'"],
      'media-src': ["'self'"],
      'frame-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
    },
  },
  hsts: {
    enabled: true,
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  cors: {
    enabled: true,
    origins: ['*'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    headers: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // 24 hours
  },
  frameProtection: {
    enabled: true,
    action: 'DENY',
  },
  contentTypeOptions: {
    enabled: true,
    nosniff: true,
  },
  xssProtection: {
    enabled: true,
    mode: '1; mode=block',
  },
  referrerPolicy: {
    enabled: true,
    policy: 'strict-origin-when-cross-origin',
  },
  permissionsPolicy: {
    enabled: true,
    features: {
      geolocation: ["'self'"],
      microphone: ["'none'"],
      camera: ["'none'"],
      payment: ["'self'"],
      usb: ["'none'"],
    },
  },
};

export class SecurityHeadersMiddleware extends SecurityMiddleware {
  private cspBuilder!: CSPBuilder;
  private hstsBuilder!: HSTSBuilder;
  private headersBuilder!: SecurityHeadersBuilder;
  protected declare config: SecurityHeadersConfig;

  constructor(config: SecurityHeadersConfig) {
    super(config);
    this.config = { ...DEFAULT_CONFIG, ...config } as SecurityHeadersConfig;
    this.initializeBuilders();
  }

  protected async implementation({ req, res }: SecurityContext): Promise<void> {
    // Set CSP headers
    if (this.config.csp?.enabled) {
      const cspHeader = this.config.csp.reportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy';
      res.setHeader(cspHeader, this.cspBuilder.build());
    }

    // Set HSTS headers
    if (this.config.hsts?.enabled) {
      res.setHeader('Strict-Transport-Security', this.hstsBuilder.build());
    }

    // Set CORS headers
    if (this.config.cors?.enabled) {
      this.setCORSHeaders(req, res);
    }

    // Set other security headers
    this.headersBuilder.applyHeaders(res);

    // Log headers if debug enabled
    if (this.config.debug) {
      this.logger.debug('Security headers applied', {
        headers: res.getHeaders(),
      });
    }
  }

  private initializeBuilders(): void {
    this.cspBuilder = new CSPBuilder(this.config.csp);
    this.hstsBuilder = new HSTSBuilder(this.config.hsts);
    this.headersBuilder = new SecurityHeadersBuilder({
      frameProtection: this.config.frameProtection,
      contentTypeOptions: this.config.contentTypeOptions,
      xssProtection: this.config.xssProtection,
      referrerPolicy: this.config.referrerPolicy,
      permissionsPolicy: this.config.permissionsPolicy,
    });
  }

  private setCORSHeaders(req: any, res: any): void {
    const { cors } = this.config;
    const origin = req.headers.origin;

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      if (cors?.methods) {
        res.setHeader('Access-Control-Allow-Methods', cors.methods.join(', '));
      }
      if (cors?.headers) {
        res.setHeader('Access-Control-Allow-Headers', cors.headers.join(', '));
      }
      if (cors?.maxAge) {
        res.setHeader('Access-Control-Max-Age', cors.maxAge.toString());
      }
    }

    // Set CORS headers
    if (cors?.origins?.includes('*') || cors?.origins?.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    if (cors?.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }
}
