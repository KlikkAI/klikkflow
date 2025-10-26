/**
 * URL Validator Tests
 * Tests for CVE-2025-56200 mitigation
 *
 * These tests verify that our custom URL validator properly prevents
 * the URL validation bypass vulnerability present in validator.js <= 13.15.15
 */

import { describe, expect, test } from 'vitest';
import { isValidOAuthRedirectURI, isValidURL } from '../url-validator';

describe('URL Validator (CVE-2025-56200 Mitigation)', () => {
  describe('isValidURL', () => {
    describe('valid URLs', () => {
      test('accepts valid HTTPS URLs', () => {
        expect(isValidURL('https://example.com')).toBe(true);
        expect(isValidURL('https://www.example.com')).toBe(true);
        expect(isValidURL('https://sub.example.com')).toBe(true);
      });

      test('accepts valid HTTP URLs', () => {
        expect(isValidURL('http://example.com')).toBe(true);
        expect(isValidURL('http://www.example.com')).toBe(true);
      });

      test('accepts URLs with paths and query strings', () => {
        expect(isValidURL('https://example.com/path')).toBe(true);
        expect(isValidURL('https://example.com/path/to/resource')).toBe(true);
        expect(isValidURL('https://example.com?query=value')).toBe(true);
        expect(isValidURL('https://example.com/path?query=value&foo=bar')).toBe(true);
      });

      test('accepts URLs with ports', () => {
        expect(isValidURL('https://example.com:8080')).toBe(true);
        expect(isValidURL('http://example.com:3000')).toBe(true);
      });

      test('accepts localhost when allowed (default)', () => {
        expect(isValidURL('http://localhost')).toBe(true);
        expect(isValidURL('http://localhost:3000')).toBe(true);
        expect(isValidURL('http://127.0.0.1')).toBe(true);
        expect(isValidURL('http://127.0.0.1:3000')).toBe(true);
      });

      test('accepts IP addresses when allowed (default)', () => {
        expect(isValidURL('http://192.168.1.1')).toBe(true);
        expect(isValidURL('http://10.0.0.1:8080')).toBe(true);
      });
    });

    describe('XSS prevention (CVE-2025-56200)', () => {
      test('rejects javascript: protocol', () => {
        expect(isValidURL('javascript:alert(1)')).toBe(false);
        expect(isValidURL('javascript://example.com')).toBe(false);
        expect(isValidURL('javascript://example.com/%0aalert(1)')).toBe(false);
      });

      test('rejects data: protocol', () => {
        expect(isValidURL('data:text/html,<script>alert(1)</script>')).toBe(false);
        expect(isValidURL('data://example.com')).toBe(false);
      });

      test('rejects file: protocol', () => {
        expect(isValidURL('file:///etc/passwd')).toBe(false);
        expect(isValidURL('file://example.com')).toBe(false);
      });

      test('rejects vbscript: protocol', () => {
        expect(isValidURL('vbscript:msgbox(1)')).toBe(false);
      });

      test('rejects about: protocol', () => {
        expect(isValidURL('about:blank')).toBe(false);
      });
    });

    describe('invalid URLs', () => {
      test('rejects empty strings', () => {
        expect(isValidURL('')).toBe(false);
        expect(isValidURL('   ')).toBe(false);
      });

      test('rejects non-string values', () => {
        // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
        expect(isValidURL(null as any)).toBe(false);
        // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
        expect(isValidURL(undefined as any)).toBe(false);
        // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
        expect(isValidURL(123 as any)).toBe(false);
        // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
        expect(isValidURL({} as any)).toBe(false);
      });

      test('rejects malformed URLs', () => {
        expect(isValidURL('not-a-url')).toBe(false);
        expect(isValidURL('http://')).toBe(false);
        expect(isValidURL('://example.com')).toBe(false);
      });
    });

    describe('protocol validation', () => {
      test('accepts only specified protocols', () => {
        expect(isValidURL('https://example.com', { protocols: ['https'] })).toBe(true);
        expect(isValidURL('http://example.com', { protocols: ['https'] })).toBe(false);
      });

      test('supports custom protocol lists', () => {
        expect(isValidURL('ftp://example.com', { protocols: ['ftp'] })).toBe(true);
        expect(isValidURL('https://example.com', { protocols: ['ftp'] })).toBe(false);
      });
    });

    describe('localhost validation', () => {
      test('rejects localhost when not allowed', () => {
        expect(isValidURL('http://localhost', { allowLocalhost: false })).toBe(false);
        expect(isValidURL('http://localhost:3000', { allowLocalhost: false })).toBe(false);
        expect(isValidURL('http://127.0.0.1', { allowLocalhost: false })).toBe(false);
      });
    });

    describe('IP address validation', () => {
      test('rejects IP addresses when not allowed', () => {
        expect(isValidURL('http://192.168.1.1', { allowIPAddress: false })).toBe(false);
        expect(isValidURL('http://10.0.0.1:8080', { allowIPAddress: false })).toBe(false);
      });
    });

    describe('TLD validation', () => {
      test('requires TLD when specified', () => {
        expect(isValidURL('http://example', { requireTLD: true })).toBe(false);
        expect(isValidURL('http://example.com', { requireTLD: true })).toBe(true);
      });

      test('TLD not required for IP addresses', () => {
        expect(isValidURL('http://192.168.1.1', { requireTLD: true })).toBe(true);
      });

      test('TLD not required for localhost', () => {
        expect(isValidURL('http://localhost', { requireTLD: true })).toBe(true);
      });
    });

    describe('host allowlist', () => {
      test('accepts only allowlisted hosts', () => {
        const allowlist = ['example.com', 'trusted.com'];
        expect(isValidURL('https://example.com', { hostAllowlist: allowlist })).toBe(true);
        expect(isValidURL('https://trusted.com', { hostAllowlist: allowlist })).toBe(true);
        expect(isValidURL('https://evil.com', { hostAllowlist: allowlist })).toBe(false);
      });
    });

    describe('host blocklist', () => {
      test('rejects blocklisted hosts', () => {
        const blocklist = ['evil.com', 'malicious.com'];
        expect(isValidURL('https://example.com', { hostBlocklist: blocklist })).toBe(true);
        expect(isValidURL('https://evil.com', { hostBlocklist: blocklist })).toBe(false);
        expect(isValidURL('https://malicious.com', { hostBlocklist: blocklist })).toBe(false);
      });
    });
  });

  describe('isValidOAuthRedirectURI', () => {
    describe('production URLs', () => {
      test('accepts HTTPS URLs for production domains', () => {
        expect(isValidOAuthRedirectURI('https://app.example.com/callback')).toBe(true);
        expect(isValidOAuthRedirectURI('https://example.com/oauth/callback')).toBe(true);
      });

      test('rejects HTTP URLs for production domains', () => {
        expect(isValidOAuthRedirectURI('http://app.example.com/callback')).toBe(false);
        expect(isValidOAuthRedirectURI('http://example.com/oauth/callback')).toBe(false);
      });

      test('rejects non-HTTPS protocols for production', () => {
        expect(isValidOAuthRedirectURI('ftp://example.com/callback')).toBe(false);
        expect(isValidOAuthRedirectURI('file:///callback')).toBe(false);
      });
    });

    describe('development URLs (localhost)', () => {
      test('accepts HTTP for localhost', () => {
        expect(isValidOAuthRedirectURI('http://localhost:3000/callback')).toBe(true);
        expect(isValidOAuthRedirectURI('http://localhost/callback')).toBe(true);
      });

      test('accepts HTTP for 127.0.0.1', () => {
        expect(isValidOAuthRedirectURI('http://127.0.0.1:3000/callback')).toBe(true);
        expect(isValidOAuthRedirectURI('http://127.0.0.1/callback')).toBe(true);
      });

      test('accepts HTTPS for localhost', () => {
        expect(isValidOAuthRedirectURI('https://localhost:3000/callback')).toBe(true);
      });
    });

    describe('XSS prevention', () => {
      test('rejects javascript: protocol', () => {
        expect(isValidOAuthRedirectURI('javascript:alert(1)')).toBe(false);
        expect(isValidOAuthRedirectURI('javascript://example.com')).toBe(false);
      });

      test('rejects data: protocol', () => {
        expect(isValidOAuthRedirectURI('data:text/html,<script>alert(1)</script>')).toBe(false);
      });
    });

    describe('origin allowlist', () => {
      test('validates against allowedOrigins', () => {
        const allowed = ['https://app.example.com', 'https://staging.example.com'];

        expect(isValidOAuthRedirectURI('https://app.example.com/callback', allowed)).toBe(true);
        expect(isValidOAuthRedirectURI('https://app.example.com/oauth/redirect', allowed)).toBe(
          true
        );
        expect(isValidOAuthRedirectURI('https://staging.example.com/callback', allowed)).toBe(true);
      });

      test('rejects URLs not in allowedOrigins', () => {
        const allowed = ['https://app.example.com'];

        expect(isValidOAuthRedirectURI('https://evil.com/callback', allowed)).toBe(false);
        expect(isValidOAuthRedirectURI('https://malicious.com/steal', allowed)).toBe(false);
      });

      test('origin check includes port', () => {
        const allowed = ['https://app.example.com:8080'];

        expect(isValidOAuthRedirectURI('https://app.example.com:8080/callback', allowed)).toBe(
          true
        );
        expect(isValidOAuthRedirectURI('https://app.example.com/callback', allowed)).toBe(false);
      });

      test('localhost can use origin allowlist', () => {
        const allowed = ['http://localhost:3000'];

        expect(isValidOAuthRedirectURI('http://localhost:3000/callback', allowed)).toBe(true);
        expect(isValidOAuthRedirectURI('http://localhost:4000/callback', allowed)).toBe(false);
      });
    });

    describe('invalid inputs', () => {
      test('rejects empty strings', () => {
        expect(isValidOAuthRedirectURI('')).toBe(false);
      });

      test('rejects malformed URLs', () => {
        expect(isValidOAuthRedirectURI('not-a-url')).toBe(false);
        expect(isValidOAuthRedirectURI('http://')).toBe(false);
      });
    });
  });
});
