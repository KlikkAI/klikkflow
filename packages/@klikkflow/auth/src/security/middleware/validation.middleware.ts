import { ERROR_CODES } from '@klikkflow/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

export interface ValidationRule {
  field: string;
  location?: 'body' | 'query' | 'params' | 'headers';
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'uuid' | 'json' | 'array' | 'object';
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: unknown[];
  custom?: (value: unknown) => boolean | string;
  sanitize?: boolean;
  trim?: boolean;
  escape?: boolean;
  normalizeEmail?: boolean;
  toLowerCase?: boolean;
  toUpperCase?: boolean;
  default?: unknown;
  transform?: (value: unknown) => unknown;
}

export interface ValidationSchema {
  rules: ValidationRule[];
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
  location?: string;
}

/**
 * SQL injection patterns to detect
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|EXEC|EXECUTE|SCRIPT|JAVASCRIPT|ALERT|CONFIRM|PROMPT)\b)/gi,
  /(--|#|\/\*|\*\/|;|\||\\x[0-9a-f]{2}|\\u[0-9a-f]{4})/gi,
  /('|(')|"|(")|(--)|(\|)|(\|\|)|(;))/gi,
  /(UNION\s+SELECT|SELECT\s+\*|DROP\s+TABLE|INSERT\s+INTO)/gi,
];

/**
 * NoSQL injection patterns to detect
 */
const NOSQL_INJECTION_PATTERNS = [
  /(\$where|\$regex|\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin|\$exists|\$type)/gi,
  /({|}|\[|\])/g,
  /(\$\w+)/g,
];

/**
 * Path traversal patterns to detect
 */
const PATH_TRAVERSAL_PATTERNS = [/\.\.\//g, /\.\.\\/, /%2e%2e%2f/gi, /%252e%252e%252f/gi, /\.\./g];

/**
 * Command injection patterns to detect
 */
const COMMAND_INJECTION_PATTERNS = [/[;&|`$()]/g, /\$\(/g, /`[^`]*`/g, /\|\|/g, /&&/g];

/**
 * Process a single validation rule
 */
function processValidationRule(
  rule: ValidationRule,
  req: Request,
  errors: ValidationError[],
  validatedData: Record<string, unknown>,
  abortEarly: boolean
): { shouldAbort: boolean; shouldContinue: boolean } {
  const location = rule.location || 'body';
  const source = req[location as keyof Request] as Record<string, unknown>;
  let value = source?.[rule.field];

  // Check required fields
  if (rule.required && (value === undefined || value === null || value === '')) {
    errors.push({
      field: rule.field,
      message: `${rule.field} is required`,
      location,
    });
    return { shouldAbort: abortEarly, shouldContinue: true };
  }

  // Apply default value if not present
  if (value === undefined && rule.default !== undefined) {
    value = typeof rule.default === 'function' ? rule.default() : rule.default;
  }

  // Skip validation if value is not present and not required
  if (value === undefined || value === null) {
    return { shouldAbort: false, shouldContinue: true };
  }

  // Sanitize value first if requested
  if (rule.sanitize) {
    value = sanitizeInput(value, rule);
  }

  // Validate type
  const typeError = validateType(value, rule.type);
  if (typeError) {
    errors.push({
      field: rule.field,
      message: typeError,
      value,
      location,
    });
    return { shouldAbort: abortEarly, shouldContinue: true };
  }

  // Validate constraints
  const constraintErrors = validateConstraints(value, rule);
  if (constraintErrors.length > 0) {
    errors.push(
      ...constraintErrors.map((error) => ({
        field: rule.field,
        message: error,
        value,
        location,
      }))
    );
    return { shouldAbort: abortEarly, shouldContinue: true };
  }

  // Apply transformation
  if (rule.transform) {
    value = rule.transform(value);
  }

  // Store validated value
  validatedData[rule.field] = value;
  return { shouldAbort: false, shouldContinue: false };
}

/**
 * Get known field names for a specific location
 */
function getKnownFields(schema: ValidationSchema, location: string): string[] {
  return schema.rules.filter((r) => (r.location || 'body') === location).map((r) => r.field);
}

/**
 * Process unknown fields in a single location
 */
function processUnknownFieldsInLocation(
  source: Record<string, unknown>,
  knownFields: string[],
  location: string,
  schema: ValidationSchema,
  errors: ValidationError[]
): void {
  for (const key of Object.keys(source)) {
    if (!knownFields.includes(key)) {
      if (!schema.allowUnknown) {
        errors.push({
          field: key,
          message: `Unknown field: ${key}`,
          location,
        });
      }
      delete source[key];
    }
  }
}

/**
 * Strip unknown fields from request
 */
function stripUnknownFields(
  req: Request,
  schema: ValidationSchema,
  errors: ValidationError[]
): void {
  for (const location of ['body', 'query', 'params']) {
    const source = req[location as keyof Request] as Record<string, unknown>;
    if (source && typeof source === 'object') {
      const knownFields = getKnownFields(schema, location);
      processUnknownFieldsInLocation(source, knownFields, location, schema, errors);
    }
  }
}

/**
 * Create validation middleware
 */
export function createValidationMiddleware(schema: ValidationSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors: ValidationError[] = [];
    const validatedData: Record<string, unknown> = {};

    // Process each rule
    for (const rule of schema.rules) {
      const result = processValidationRule(
        rule,
        req,
        errors,
        validatedData,
        schema.abortEarly ?? false
      );

      if (result.shouldAbort) {
        break;
      }
    }

    // Handle unknown fields
    if (schema.stripUnknown) {
      stripUnknownFields(req, schema, errors);
    }

    // Return errors if any
    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Validation failed',
          details: errors,
        },
      });
      return;
    }

    // Attach validated data to request
    (req as unknown as { validated: Record<string, unknown> }).validated = validatedData;
    next();
  };
}

/**
 * Type validator function signature
 */
type TypeValidator = (value: unknown) => string | null;

/**
 * Individual type validators
 */
const TYPE_VALIDATORS: Record<string, TypeValidator> = {
  string: (value) => (typeof value !== 'string' ? `Expected string, got ${typeof value}` : null),

  number: (value) =>
    typeof value !== 'number' || Number.isNaN(value)
      ? `Expected number, got ${typeof value}`
      : null,

  boolean: (value) => (typeof value !== 'boolean' ? `Expected boolean, got ${typeof value}` : null),

  email: (value) =>
    typeof value !== 'string' || !validator.isEmail(value) ? 'Invalid email address' : null,

  url: (value) => (typeof value !== 'string' || !validator.isURL(value) ? 'Invalid URL' : null),

  uuid: (value) => (typeof value !== 'string' || !validator.isUUID(value) ? 'Invalid UUID' : null),

  json: (value) => {
    if (typeof value !== 'string') {
      return 'Expected string for JSON parsing';
    }
    try {
      JSON.parse(value);
      return null;
    } catch {
      return 'Invalid JSON';
    }
  },

  array: (value) => (!Array.isArray(value) ? 'Expected array' : null),

  object: (value) => (typeof value !== 'object' || Array.isArray(value) ? 'Expected object' : null),
};

/**
 * Validate type of value
 */
function validateType(value: unknown, type?: string): string | null {
  if (!type) {
    return null;
  }

  const validator = TYPE_VALIDATORS[type];
  return validator ? validator(value) : null;
}

/**
 * Validate numeric min/max constraints
 */
function validateNumericConstraints(value: unknown, rule: ValidationRule): string[] {
  const errors: string[] = [];
  if (typeof value !== 'number') {
    return errors;
  }

  if (rule.min !== undefined && value < rule.min) {
    errors.push(`Value must be at least ${rule.min}`);
  }
  if (rule.max !== undefined && value > rule.max) {
    errors.push(`Value must be at most ${rule.max}`);
  }
  return errors;
}

/**
 * Validate length constraints for strings and arrays
 */
function validateLengthConstraints(value: unknown, rule: ValidationRule): string[] {
  const errors: string[] = [];
  if (typeof value !== 'string' && !Array.isArray(value)) {
    return errors;
  }

  const length = value.length;
  if (rule.minLength !== undefined && length < rule.minLength) {
    errors.push(`Length must be at least ${rule.minLength}`);
  }
  if (rule.maxLength !== undefined && length > rule.maxLength) {
    errors.push(`Length must be at most ${rule.maxLength}`);
  }
  return errors;
}

/**
 * Validate pattern constraint
 */
function validatePatternConstraint(value: unknown, rule: ValidationRule): string | null {
  if (!rule.pattern || typeof value !== 'string') {
    return null;
  }
  return !rule.pattern.test(value) ? 'Value does not match required pattern' : null;
}

/**
 * Validate enum constraint
 */
function validateEnumConstraint(value: unknown, rule: ValidationRule): string | null {
  if (!rule.enum) {
    return null;
  }
  return !rule.enum.includes(value) ? `Value must be one of: ${rule.enum.join(', ')}` : null;
}

/**
 * Validate custom constraint
 */
function validateCustomConstraint(value: unknown, rule: ValidationRule): string | null {
  if (!rule.custom) {
    return null;
  }

  const result = rule.custom(value);
  if (typeof result === 'string') {
    return result;
  }
  if (!result) {
    return 'Custom validation failed';
  }
  return null;
}

/**
 * Validate constraints
 */
function validateConstraints(value: unknown, rule: ValidationRule): string[] {
  const errors: string[] = [];

  // Numeric constraints
  errors.push(...validateNumericConstraints(value, rule));

  // Length constraints
  errors.push(...validateLengthConstraints(value, rule));

  // Pattern constraint
  const patternError = validatePatternConstraint(value, rule);
  if (patternError) {
    errors.push(patternError);
  }

  // Enum constraint
  const enumError = validateEnumConstraint(value, rule);
  if (enumError) {
    errors.push(enumError);
  }

  // Custom constraint
  const customError = validateCustomConstraint(value, rule);
  if (customError) {
    errors.push(customError);
  }

  return errors;
}

/**
 * Sanitize input based on rules
 */
function sanitizeInput(value: unknown, rule: ValidationRule): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  let sanitized = value;

  // Basic sanitization
  if (rule.trim) {
    sanitized = sanitized.trim();
  }

  if (rule.toLowerCase) {
    sanitized = sanitized.toLowerCase();
  }

  if (rule.toUpperCase) {
    sanitized = sanitized.toUpperCase();
  }

  if (rule.escape) {
    sanitized = validator.escape(sanitized);
  }

  if (rule.normalizeEmail && rule.type === 'email') {
    sanitized = validator.normalizeEmail(sanitized) || sanitized;
  }

  // HTML sanitization
  sanitized = DOMPurify.sanitize(sanitized, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });

  return sanitized;
}

/**
 * Check if string contains SQL injection patterns
 */
function containsSQLInjection(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Check all request input sources for malicious content
 */
function checkAllInputSources(
  req: Request,
  checkFunction: (value: unknown) => boolean,
  errorMessage: string
): {
  valid: boolean;
  errorResponse?: { success: boolean; error: { code: string; message: string } };
} {
  for (const location of ['body', 'query', 'params']) {
    const source = req[location as keyof Request] as Record<string, unknown> | undefined;
    if (source && typeof source === 'object') {
      for (const value of Object.values(source)) {
        if (checkFunction(value)) {
          return {
            valid: false,
            errorResponse: {
              success: false,
              error: {
                code: ERROR_CODES.SECURITY_VIOLATION,
                message: errorMessage,
              },
            },
          };
        }
      }
    }
  }
  return { valid: true };
}

/**
 * Create SQL injection prevention middleware
 */
export function createSQLInjectionProtection() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = checkAllInputSources(
      req,
      containsSQLInjection,
      'Potentially malicious input detected'
    );

    if (!result.valid && result.errorResponse) {
      res.status(400).json(result.errorResponse);
      return;
    }

    next();
  };
}

/**
 * Check if value contains NoSQL injection patterns
 */
function containsNoSQLInjection(value: unknown): boolean {
  const valueStr = JSON.stringify(value);

  for (const pattern of NOSQL_INJECTION_PATTERNS) {
    if (pattern.test(valueStr)) {
      return true;
    }
  }

  // Check for operator injection
  if (typeof value === 'object' && value !== null) {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Create NoSQL injection prevention middleware
 */
export function createNoSQLInjectionProtection() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check body for NoSQL injection
    if (req.body && containsNoSQLInjection(req.body)) {
      res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.SECURITY_VIOLATION,
          message: 'Invalid input detected',
        },
      });
      return;
    }

    next();
  };
}

/**
 * Recursively sanitize a value for XSS protection
 */
function sanitizeValueRecursive(value: unknown): unknown {
  if (typeof value === 'string') {
    return DOMPurify.sanitize(value, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      ALLOWED_ATTR: ['href'],
    });
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValueRecursive);
  }

  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValueRecursive(val);
    }
    return sanitized;
  }

  return value;
}

/**
 * Create XSS prevention middleware
 */
export function createXSSProtection() {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Sanitize all input
    if (req.body) {
      req.body = sanitizeValueRecursive(req.body);
    }

    next();
  };
}

/**
 * Check if string contains path traversal patterns
 */
function containsPathTraversal(value: string): boolean {
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Check query parameters for path traversal in file/path fields
 */
function checkQueryForPathTraversal(query: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string' && (key.includes('path') || key.includes('file'))) {
      if (containsPathTraversal(value)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Create path traversal prevention middleware
 */
export function createPathTraversalProtection() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check URL path
    if (containsPathTraversal(req.path)) {
      res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.SECURITY_VIOLATION,
          message: 'Invalid path',
        },
      });
      return;
    }

    // Check query parameters
    if (checkQueryForPathTraversal(req.query as Record<string, unknown>)) {
      res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.SECURITY_VIOLATION,
          message: 'Invalid file path',
        },
      });
      return;
    }

    next();
  };
}

/**
 * Check if string contains command injection patterns
 */
function containsCommandInjection(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  for (const pattern of COMMAND_INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if field name indicates a command field
 */
function isCommandField(fieldName: string): boolean {
  return fieldName.includes('cmd') || fieldName.includes('command') || fieldName.includes('exec');
}

/**
 * Check if source object has command injection in command fields
 */
function hasCommandInjectionInSource(source: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(source)) {
    if (isCommandField(key) && containsCommandInjection(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Check command-related fields in all input sources
 */
function checkCommandFields(req: Request): boolean {
  for (const location of ['body', 'query', 'params']) {
    const source = req[location as keyof Request] as Record<string, unknown> | undefined;
    if (source && typeof source === 'object') {
      if (hasCommandInjectionInSource(source)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Create command injection prevention middleware
 */
export function createCommandInjectionProtection() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (checkCommandFields(req)) {
      res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.SECURITY_VIOLATION,
          message: 'Invalid command',
        },
      });
      return;
    }

    next();
  };
}

/**
 * Create comprehensive security validation middleware
 */
export function createSecurityValidationMiddleware(
  options: {
    enableSQLProtection?: boolean;
    enableNoSQLProtection?: boolean;
    enableXSSProtection?: boolean;
    enablePathTraversalProtection?: boolean;
    enableCommandInjectionProtection?: boolean;
  } = {}
) {
  const middlewares: RequestHandler[] = [];

  if (options.enableSQLProtection !== false) {
    middlewares.push(createSQLInjectionProtection());
  }

  if (options.enableNoSQLProtection !== false) {
    middlewares.push(createNoSQLInjectionProtection());
  }

  if (options.enableXSSProtection !== false) {
    middlewares.push(createXSSProtection());
  }

  if (options.enablePathTraversalProtection !== false) {
    middlewares.push(createPathTraversalProtection());
  }

  if (options.enableCommandInjectionProtection !== false) {
    middlewares.push(createCommandInjectionProtection());
  }

  return middlewares;
}

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  login: {
    rules: [
      {
        field: 'email',
        type: 'email',
        required: true,
        normalizeEmail: true,
        toLowerCase: true,
        sanitize: true,
      },
      {
        field: 'password',
        type: 'string',
        required: true,
        minLength: 8,
        maxLength: 128,
      },
    ],
  },

  registration: {
    rules: [
      {
        field: 'email',
        type: 'email',
        required: true,
        normalizeEmail: true,
        toLowerCase: true,
        sanitize: true,
      },
      {
        field: 'password',
        type: 'string',
        required: true,
        minLength: 8,
        maxLength: 128,
        pattern: /^[A-Za-z\d@$!%*?&]+$/,
        custom: (value: unknown) => {
          if (typeof value !== 'string') return 'Password must be a string';
          if (!/[a-z]/.test(value)) return 'Password must contain lowercase letter';
          if (!/[A-Z]/.test(value)) return 'Password must contain uppercase letter';
          if (!/\d/.test(value)) return 'Password must contain number';
          if (!/[@$!%*?&]/.test(value)) return 'Password must contain special character';
          return true;
        },
      },
      {
        field: 'name',
        type: 'string',
        required: true,
        minLength: 2,
        maxLength: 100,
        sanitize: true,
        trim: true,
      },
    ],
  },

  pagination: {
    rules: [
      {
        field: 'page',
        location: 'query',
        type: 'number',
        min: 1,
        default: 1,
        transform: (v: unknown) => Number.parseInt(String(v), 10),
      },
      {
        field: 'limit',
        location: 'query',
        type: 'number',
        min: 1,
        max: 100,
        default: 20,
        transform: (v: unknown) => Number.parseInt(String(v), 10),
      },
      {
        field: 'sort',
        location: 'query',
        type: 'string',
        enum: ['asc', 'desc'],
        default: 'desc',
        toLowerCase: true,
      },
    ],
  },
};
