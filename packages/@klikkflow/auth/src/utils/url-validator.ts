/**
 * Secure URL Validator
 * Mitigates CVE-2025-56200 (validator.js isURL bypass vulnerability)
 *
 * The validator.js library has a URL validation bypass where isURL() uses '://' as a
 * delimiter to parse protocols, while browsers use ':'. This allows attackers to bypass
 * protocol and domain validation, leading to XSS and Open Redirect attacks.
 *
 * This implementation uses the native URL constructor which follows browser parsing rules,
 * preventing protocol/domain validation bypass attacks.
 *
 * @see https://github.com/advisories/GHSA-9965-vmph-33xx
 * @see CVE-2025-56200
 */

export interface URLValidationOptions {
  /** Allowed protocols (default: ['http', 'https']) */
  protocols?: string[];
  /** Require top-level domain (default: false) */
  requireTLD?: boolean;
  /** Allow IP addresses (default: true) */
  allowIPAddress?: boolean;
  /** Allow localhost (default: true) */
  allowLocalhost?: boolean;
  /** Specific allowed hosts (optional) */
  hostAllowlist?: string[];
  /** Blocked hosts (optional) */
  hostBlocklist?: string[];
}

/**
 * Validates URL using native URL constructor + security checks
 *
 * This function provides secure URL validation by:
 * 1. Using native URL constructor (same parsing as browsers)
 * 2. Validating protocol against allowlist (prevents javascript:, data:, file:)
 * 3. Validating hostname requirements
 * 4. Supporting host allowlists/blocklists
 *
 * @param url - URL string to validate
 * @param options - Validation options
 * @returns true if valid and safe, false otherwise
 *
 * @example
 * ```typescript
 * isValidURL('https://example.com') // true
 * isValidURL('javascript://example.com') // false (XSS prevention)
 * isValidURL('http://example.com', { protocols: ['https'] }) // false
 * ```
 */
export function isValidURL(url: string, options: URLValidationOptions = {}): boolean {
  const {
    protocols = ['http', 'https'],
    requireTLD = false,
    allowIPAddress = true,
    allowLocalhost = true,
    hostAllowlist,
    hostBlocklist,
  } = options;

  // Basic string checks
  if (typeof url !== 'string' || url.trim().length === 0) {
    return false;
  }

  // Try to parse with native URL constructor (follows browser rules)
  let parsedURL: URL;
  try {
    parsedURL = new URL(url);
  } catch {
    return false;
  }

  // Validate protocol (prevent javascript:, data:, file:, etc.)
  const protocol = parsedURL.protocol.replace(':', '');
  if (!protocols.includes(protocol)) {
    return false;
  }

  // Validate hostname exists
  if (!parsedURL.hostname) {
    return false;
  }

  // Check localhost
  if (
    !allowLocalhost &&
    (parsedURL.hostname === 'localhost' || parsedURL.hostname === '127.0.0.1')
  ) {
    return false;
  }

  // Check IP address
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const isIPAddress = ipRegex.test(parsedURL.hostname);
  if (isIPAddress && !allowIPAddress) {
    return false;
  }

  // Check TLD requirement (not applicable to IPs or localhost)
  if (requireTLD && !isIPAddress && parsedURL.hostname !== 'localhost') {
    if (!parsedURL.hostname.includes('.')) {
      return false;
    }
  }

  // Host allowlist check (if provided)
  if (hostAllowlist && hostAllowlist.length > 0) {
    if (!hostAllowlist.includes(parsedURL.hostname)) {
      return false;
    }
  }

  // Host blocklist check
  if (hostBlocklist && hostBlocklist.length > 0) {
    if (hostBlocklist.includes(parsedURL.hostname)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates OAuth redirect URI with strict security rules
 *
 * OAuth 2.0 redirect URIs require special validation to prevent open redirect attacks:
 * - Production domains MUST use HTTPS
 * - Localhost is allowed with HTTP for development
 * - Optionally validates against an allowlist of authorized origins
 *
 * @param redirectUri - Redirect URI to validate
 * @param allowedOrigins - List of allowed origins (optional but recommended)
 * @returns true if valid redirect URI, false otherwise
 *
 * @example
 * ```typescript
 * // Production
 * isValidOAuthRedirectURI('https://app.example.com/callback') // true
 * isValidOAuthRedirectURI('http://app.example.com/callback') // false
 *
 * // Development
 * isValidOAuthRedirectURI('http://localhost:3000/callback') // true
 *
 * // With allowlist
 * isValidOAuthRedirectURI('https://evil.com/callback', ['https://app.example.com']) // false
 * ```
 */
export function isValidOAuthRedirectURI(redirectUri: string, allowedOrigins?: string[]): boolean {
  // OAuth redirect URIs must be https in production (or http://localhost for dev)
  const isLocalhost =
    redirectUri.startsWith('http://localhost') || redirectUri.startsWith('http://127.0.0.1');
  const protocols = isLocalhost ? ['http', 'https'] : ['https'];

  if (
    !isValidURL(redirectUri, {
      protocols,
      requireTLD: !isLocalhost,
      allowIPAddress: isLocalhost,
    })
  ) {
    return false;
  }

  // If allowedOrigins provided, validate origin matches
  if (allowedOrigins && allowedOrigins.length > 0) {
    try {
      const url = new URL(redirectUri);
      const origin = url.origin;
      if (!allowedOrigins.includes(origin)) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}
