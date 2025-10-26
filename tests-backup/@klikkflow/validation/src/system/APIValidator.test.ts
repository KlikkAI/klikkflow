/**
 * Tests for API Endpoint Validation System
 * Requirements: 1.2, 1.5
 */

import axios from 'axios';
import { beforeEach, describe, expect, it, type MockedFunction, vi } from 'vitest';
import { type APIValidationConfig, APIValidator } from './APIValidator.js';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as MockedFunction<typeof axios>;

describe('APIValidator', () => {
  let validator: APIValidator;
  let config: APIValidationConfig;

  beforeEach(() => {
    config = {
      baseUrl: 'http://localhost:3000',
      timeout: 5000,
      retryAttempts: 3,
      endpoints: [
        { path: '/api/health', method: 'GET', expectedStatus: 200 },
        { path: '/api/info', method: 'GET', expectedStatus: 200 },
        { path: '/api/audit/events', method: 'GET', expectedStatus: 200 },
      ],
    };
    validator = new APIValidator(config);
    vi.clearAllMocks();
  });

  describe('validateEndpoints', () => {
    it('should validate all endpoints successfully', async () => {
      // Mock successful responses
      mockedAxios.mockResolvedValue({
        status: 200,
        data: { success: true },
      });

      const result = await validator.validateEndpoints();

      expect(result.status).toBe('success');
      expect(result.totalEndpoints).toBe(3);
      expect(result.validatedEndpoints).toBe(3);
      expect(result.failedEndpoints).toHaveLength(0);
      expect(mockedAxios).toHaveBeenCalledTimes(3);
    });

    it('should handle endpoint failures', async () => {
      // Mock one successful and one failed response
      mockedAxios
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true },
        })
        .mockResolvedValueOnce({
          status: 500,
          data: { success: false, error: 'Internal server error' },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true },
        });

      const result = await validator.validateEndpoints();

      expect(result.status).toBe('failure');
      expect(result.totalEndpoints).toBe(3);
      expect(result.validatedEndpoints).toBe(2);
      expect(result.failedEndpoints).toHaveLength(1);
      expect(result.failedEndpoints[0].endpoint).toBe('/api/info');
    });

    it('should handle network errors', async () => {
      mockedAxios.mockRejectedValue(new Error('Network error'));

      const result = await validator.validateEndpoints();

      expect(result.status).toBe('failure');
      expect(result.failedEndpoints).toHaveLength(3);
      expect(result.failedEndpoints[0].error).toBe('Network error');
    });

    it('should calculate response time metrics', async () => {
      // Mock responses with different timing
      mockedAxios.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              status: 200,
              data: { success: true },
            });
          }, Math.random() * 100);
        });
      });

      const result = await validator.validateEndpoints();

      expect(result.responseTimeMetrics.average).toBeGreaterThan(0);
      expect(result.responseTimeMetrics.median).toBeGreaterThan(0);
      expect(result.responseTimeMetrics.p95).toBeGreaterThan(0);
      expect(result.responseTimeMetrics.p99).toBeGreaterThan(0);
    });
  });

  describe('checkResponseFormats', () => {
    it('should validate response formats successfully', async () => {
      mockedAxios.mockResolvedValue({
        status: 200,
        data: { success: true, data: { message: 'OK' } },
      });

      const result = await validator.checkResponseFormats();

      expect(result.status).toBe('success');
      expect(result.validatedEndpoints).toBe(3);
      expect(result.failedEndpoints).toHaveLength(0);
    });

    it('should detect invalid response formats', async () => {
      mockedAxios
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { error: 'Missing success field' }, // Invalid format
        })
        .mockResolvedValueOnce({
          status: 200,
          data: 'Invalid JSON response', // Invalid format
        });

      const result = await validator.checkResponseFormats();

      expect(result.status).toBe('failure');
      expect(result.failedEndpoints).toHaveLength(2);
      expect(result.failedEndpoints[0].error).toContain('success');
      expect(result.failedEndpoints[1].error).toContain('JSON object');
    });
  });

  describe('testErrorHandling', () => {
    it('should validate error handling correctly', async () => {
      // Mock appropriate error responses
      mockedAxios
        .mockResolvedValueOnce({ status: 404, data: { success: false, error: 'Not found' } })
        .mockResolvedValueOnce({
          status: 405,
          data: { success: false, error: 'Method not allowed' },
        })
        .mockResolvedValueOnce({ status: 400, data: { success: false, error: 'Bad request' } });

      const result = await validator.testErrorHandling();

      expect(result.status).toBe('success');
      expect(result.validatedEndpoints).toBe(3);
      expect(result.failedEndpoints).toHaveLength(0);
    });

    it('should detect incorrect error handling', async () => {
      // Mock incorrect status codes
      mockedAxios
        .mockResolvedValueOnce({ status: 200, data: { success: true } }) // Should be 404
        .mockResolvedValueOnce({ status: 405, data: { success: false } })
        .mockResolvedValueOnce({ status: 400, data: { success: false } });

      const result = await validator.testErrorHandling();

      expect(result.status).toBe('failure');
      expect(result.failedEndpoints).toHaveLength(1);
      expect(result.failedEndpoints[0].error).toContain('Expected error status 404');
    });
  });

  describe('validateHealthChecks', () => {
    it('should validate health endpoints successfully', async () => {
      mockedAxios.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          message: 'Backend API is healthy',
          services: { audit: 'operational' },
        },
      });

      const result = await validator.validateHealthChecks();

      expect(result.status).toBe('success');
      expect(result.validatedEndpoints).toBe(2);
      expect(result.failedEndpoints).toHaveLength(0);
    });

    it('should detect unhealthy services', async () => {
      mockedAxios
        .mockResolvedValueOnce({
          status: 200,
          data: { success: false, message: 'Service unhealthy' },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true, data: { name: 'API' } },
        });

      const result = await validator.validateHealthChecks();

      expect(result.status).toBe('failure');
      expect(result.failedEndpoints).toHaveLength(1);
      expect(result.failedEndpoints[0].error).toContain('not healthy');
    });

    it('should handle health check failures', async () => {
      mockedAxios.mockRejectedValue(new Error('Connection refused'));

      const result = await validator.validateHealthChecks();

      expect(result.status).toBe('failure');
      expect(result.failedEndpoints).toHaveLength(2);
      expect(result.failedEndpoints[0].error).toContain('Connection refused');
    });
  });

  describe('discoverEndpoints', () => {
    it('should discover default API endpoints', () => {
      const endpoints = APIValidator.discoverEndpoints('http://localhost:3000');

      expect(endpoints).toHaveLength(10);
      expect(endpoints.some((ep) => ep.path === '/api/health')).toBe(true);
      expect(endpoints.some((ep) => ep.path === '/api/info')).toBe(true);
      expect(endpoints.some((ep) => ep.path === '/api/audit/events')).toBe(true);
      expect(endpoints.some((ep) => ep.path === '/api/schedules')).toBe(true);
    });

    it('should include test data for POST endpoints', () => {
      const endpoints = APIValidator.discoverEndpoints('http://localhost:3000');
      const postEndpoints = endpoints.filter((ep) => ep.method === 'POST');

      expect(postEndpoints.length).toBeGreaterThan(0);
      expect(postEndpoints.every((ep) => ep.testData)).toBe(true);
    });
  });

  describe('configuration validation', () => {
    it('should handle missing auth token', async () => {
      const configWithoutAuth = { ...config };
      configWithoutAuth.authToken = undefined;
      const validatorWithoutAuth = new APIValidator(configWithoutAuth);

      mockedAxios.mockResolvedValue({
        status: 200,
        data: { success: true },
      });

      const result = await validatorWithoutAuth.validateEndpoints();

      expect(result.status).toBe('success');
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should include auth token when provided', async () => {
      const configWithAuth = { ...config, authToken: 'test-token' };
      const validatorWithAuth = new APIValidator(configWithAuth);

      mockedAxios.mockResolvedValue({
        status: 200,
        data: { success: true },
      });

      await validatorWithAuth.validateEndpoints();

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
        })
      );
    });

    it('should respect timeout configuration', async () => {
      const configWithTimeout = { ...config, timeout: 1000 };
      const validatorWithTimeout = new APIValidator(configWithTimeout);

      mockedAxios.mockResolvedValue({
        status: 200,
        data: { success: true },
      });

      await validatorWithTimeout.validateEndpoints();

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 1000,
        })
      );
    });
  });
});
