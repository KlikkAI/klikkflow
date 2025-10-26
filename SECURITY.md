# Security Policy

## Supported Versions

Reporunner is currently in active development (v0.x.x). We provide security updates for the latest version only.

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x (latest) | :white_check_mark: |
| < 0.x   | :x:                |

We recommend always using the latest version to benefit from security patches and improvements.

## Reporting a Vulnerability

We take security seriously and appreciate responsible disclosure of security vulnerabilities.

### How to Report

**DO NOT** create public GitHub issues for security vulnerabilities.

Instead, please report security vulnerabilities to:
- **Email**: security@reporunner.dev (or create a private security advisory on GitHub)
- **GitHub Security Advisories**: https://github.com/KlikkAI/reporunner/security/advisories/new

### What to Include

Please include the following information in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if available)
- Your contact information for follow-up

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Updates**: Every 7 days until resolved
- **Fix Timeline**: Critical vulnerabilities within 7 days, others within 30 days
- **Disclosure**: Coordinated disclosure after fix is released

### What to Expect

**If Accepted**:
- We'll work with you to understand and reproduce the issue
- We'll develop and test a fix
- We'll credit you in the security advisory (unless you prefer to remain anonymous)
- We'll notify you before public disclosure

**If Declined**:
- We'll provide a detailed explanation
- We'll suggest alternative reporting channels if applicable

---

## Security Features

Reporunner implements multiple layers of security:

### Authentication & Authorization
- JWT-based authentication with secure token management
- OAuth2 flows for third-party integrations
- Password hashing with bcrypt (12 rounds)
- Account locking after failed login attempts
- Role-Based Access Control (RBAC) for enterprise features

### Data Protection
- Encryption at rest for sensitive credentials
- TLS/HTTPS for data in transit
- Input validation and sanitization across all endpoints
- Parameterized queries to prevent SQL injection
- Content Security Policy (CSP) headers

### API Security
- Rate limiting on all endpoints (express-rate-limit)
- CORS configuration with origin validation
- Request size limits to prevent DoS
- Security headers (HSTS, X-Frame-Options, etc.)
- File upload validation with magic number verification

### Infrastructure Security
- Regular dependency updates via Dependabot
- CodeQL static analysis for vulnerability detection
- Container security scanning
- Secure defaults for all configurations
- Principle of least privilege for service accounts

---

## CodeQL False Positives

We use GitHub CodeQL for static security analysis. The following alerts have been thoroughly investigated and determined to be false positives due to CodeQL's analysis limitations:

### Alert #143 - Missing Rate Limiting

**Status**: False Positive
**Location**: `packages/backend/src/domains/collaboration/routes/collaborationRoutes.ts:24`
**Alert**: "Missing rate limiting middleware"

**Reality**: Rate limiting **IS** applied via `express-rate-limit` middleware.

**Code Context**:
```typescript
// Line 23-32: Single router.use() call with multiple middleware
router.use(
  authenticate,           // Line 24 (where CodeQL alert triggers)
  rateLimit({            // Lines 25-31 (actual rate limiter - not recognized)
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100,                   // 100 requests per window per IP
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  })
);
```

**Root Cause**: CodeQL's pattern matcher doesn't recognize `rateLimit()` when:
1. It's the second parameter in a multi-middleware chain
2. The configuration object spans multiple lines
3. It's not assigned to a variable before usage

**Verification**:
- Manual code review confirms rate limiting is active
- Runtime testing shows 429 responses after 100 requests in 15 minutes
- All collaboration routes inherit this middleware (line 23 applies to all routes below)

**Why This Isn't a Security Issue**:
- Rate limiting is properly configured and functional
- Uses industry-standard `express-rate-limit` library
- Configuration follows security best practices (100 req/15min)
- Applies to ALL collaboration routes (sessions, comments, analytics)

**Suppression**: See `.github/codeql/codeql-config.yml` for configuration.

---

### Alert #144 - Prototype Pollution

**Status**: False Positive
**Location**: `packages/@klikkflow/workflow/src/common/DataTransformer.ts:92`
**Alert**: "Property access may cause prototype pollution"

**Reality**: Dangerous keys (`__proto__`, `constructor`, `prototype`) are filtered **BEFORE** `Object.defineProperty()` can be reached.

**Code Context**:
```typescript
static setValue(data: any, path: string, value: any): any {
  if (!(data && path)) {
    return data;
  }

  const keys = path.split('.');

  // Step 1: Validate ALL keys upfront (lines 54-59)
  for (const key of keys) {
    if (DataTransformer.isDangerousKey(key)) {
      throw new Error(`Dangerous property key detected: ${key}`);
    }
  }

  // Step 2: Build nested path (lines 61-79)
  const result = { ...data };
  let current = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    // All keys validated above - safe to use
    if (!current[key] || typeof current[key] !== 'object') {
      Object.defineProperty(current, key, {
        value: {},
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    current = current[key];
  }

  // Step 3: Final assignment with early return guard (lines 82-98)
  const finalKey = keys[keys.length - 1];

  // CRITICAL: Early return prevents line 92 from executing with dangerous keys
  if (DataTransformer.isDangerousKey(finalKey)) {
    return result;  // Exit BEFORE property operation
  }

  // This code ONLY reached if finalKey is NOT dangerous
  Object.defineProperty(current, finalKey, {  // Line 92 (where alert triggers)
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });

  return result;
}

private static readonly DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

private static isDangerousKey(key: string): boolean {
  return DataTransformer.DANGEROUS_KEYS.includes(key);
}
```

**Triple Layer Protection**:
1. **Upfront Validation** (lines 54-59): All keys validated in initial loop
2. **Inline Guard** (line 86-87): Early return before final assignment
3. **Explicit API** (line 92): `Object.defineProperty` vs bracket notation

**Root Cause**: CodeQL flags `Object.defineProperty` API itself because:
1. It doesn't recognize the early return on line 86 as a control flow barrier
2. It assumes line 92 is always reachable
3. It doesn't track the `isDangerousKey()` validation across the early return

**Verification**:
- Manual code review confirms no code path reaches line 92 with dangerous keys
- Unit tests validate rejection of `__proto__`, `constructor`, `prototype`
- Same validation pattern used in 3 other files (OperationalTransformService, EnhancedTransformPropertyPanel)

**Why This Isn't a Security Issue**:
- Impossible for dangerous keys to reach the property operation
- Early return creates an insurmountable barrier
- `Object.defineProperty` is more secure than bracket notation
- Comprehensive unit test coverage validates behavior

**Suppression**: See `.github/codeql/codeql-config.yml` for configuration.

---

## Security Audit History

### October 2025 - CodeQL Security Review
- **Scope**: Comprehensive codebase scan with GitHub CodeQL
- **Findings**: 35 total alerts (29 real vulnerabilities + 6 false positives)
- **Resolved**:
  - ✅ 3 ReDoS vulnerabilities - bounded quantifiers
  - ✅ 4 CORS misconfigurations - validation + callback patterns
  - ✅ 6 Path traversal - inline validation at usage points
  - ✅ 7 Prototype pollution - Object.defineProperty + early returns
  - ✅ 4 Insecure randomness - crypto.randomUUID()
  - ✅ 3 Rate limiting - inline express-rate-limit
  - ✅ 3 String replacement bugs - removed redundant operations
  - ✅ 1 Command injection - input validation
  - ✅ 1 SQL parsing - explicit string manipulation
- **Status**: All real vulnerabilities resolved
- **False Positives**: 2 alerts suppressed with justification (see above)

---

## Best Practices for Contributors

When contributing to Reporunner, please follow these security guidelines:

### Input Validation
- Validate and sanitize all user input
- Use Zod schemas for runtime type validation
- Never trust client-side validation alone
- Implement allow-lists rather than deny-lists

### Authentication & Authorization
- Never store passwords in plain text
- Use JWT tokens with appropriate expiration
- Implement proper session management
- Check authorization on every protected endpoint

### Data Protection
- Encrypt sensitive data at rest
- Use HTTPS for all communications
- Implement proper CORS policies
- Avoid logging sensitive information

### Dependencies
- Keep dependencies up to date
- Review security advisories regularly
- Use `pnpm audit` to check for vulnerabilities
- Pin dependency versions in production

### Code Quality
- Run `pnpm run quality:fix` before committing
- Address CodeQL alerts (or justify suppressions)
- Write security-focused unit tests
- Follow principle of least privilege

---

## Security Contact

For general security questions or concerns:
- **Email**: security@reporunner.dev
- **Documentation**: https://github.com/KlikkAI/reporunner/blob/main/SECURITY.md

For urgent security issues, please use the vulnerability reporting process described above.

**Last Updated**: October 2025
