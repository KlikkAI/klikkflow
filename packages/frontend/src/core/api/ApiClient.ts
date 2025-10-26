import type { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import axios from 'axios';
import type { ApiError, ApiResponse, PaginatedResponse, PaginationParams } from '../schemas';
import { configService } from '../services/ConfigService';
import { logger } from '../services/LoggingService';

// API Client error types
export class ApiClientError extends Error {
  public status?: number;
  public code?: string;
  public details?: unknown;

  constructor(message: string, status?: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Request/Response interceptor types
interface RequestContext {
  startTime: number;
  endpoint: string;
  method: string;
}

/**
 * Type-safe API Client
 *
 * Features:
 * - Centralized error handling with structured logging
 * - Automatic authentication token management
 * - Request/response interceptors with performance tracking
 * - Type-safe method signatures
 * - Comprehensive error reporting
 */
export class ApiClient {
  private client: AxiosInstance;
  private readonly config = configService.getConfig();

  constructor() {
    this.client = this.createAxiosInstance();
    this.setupInterceptors();
  }

  /**
   * Create and configure Axios instance
   */
  private createAxiosInstance(): AxiosInstance {
    return axios.create({
      baseURL: this.config.api.baseUrl,
      timeout: this.config.api.timeout,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add authentication token
        const token = localStorage.getItem(this.config.auth.tokenKey);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request context for tracking
        const context: RequestContext = {
          startTime: Date.now(),
          endpoint: config.url || 'unknown',
          method: config.method?.toUpperCase() || 'GET',
        };
        (config as any).metadata = { context };

        // Debug logging in development
        if (this.config.features.enableDebug) {
          logger.debug('API Request', {
            method: context.method,
            endpoint: context.endpoint,
            hasData: !!config.data,
            headers: this.sanitizeHeaders(config.headers),
          });
        }

        return config;
      },
      (error) => {
        logger.error(
          'API Request Setup Failed',
          error instanceof Error ? error : new Error(String(error))
        );
        return Promise.reject(
          new ApiClientError('Request setup failed', 0, 'REQUEST_SETUP_ERROR', error)
        );
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        const context = (response.config as any).metadata?.context as RequestContext;
        if (context) {
          const duration = Date.now() - context.startTime;

          // Log successful response
          if (this.config.features.enableDebug) {
            logger.info('API Response Success', {
              method: context.method,
              endpoint: context.endpoint,
              status: response.status,
              duration,
              dataSize: JSON.stringify(response.data || {}).length,
            });
          }

          // Track performance
          if (duration > 5000) {
            // Warn on slow requests (>5s)
            logger.warn('Slow API Response', {
              method: context.method,
              endpoint: context.endpoint,
              duration,
              status: response.status,
            });
          }
        }

        return response;
      },
      (error: AxiosError) => {
        const context = (error.config as any)?.metadata?.context as RequestContext;
        const duration = context ? Date.now() - context.startTime : 0;

        // Handle different error types
        if (error.response) {
          // Server responded with error status
          const status = error.response.status;
          const errorData = error.response.data as any;

          // Handle authentication errors
          if (status === 401) {
            this.handleAuthenticationError();
          }

          // Log the error
          const logError = new Error(error.message);
          logger.error('API Response Error', logError);
          logger.info('API Error Details', {
            endpoint: context?.endpoint || 'UNKNOWN',
            status,
            duration,
            errorData,
          });

          // Create structured error
          const apiError = new ApiClientError(
            errorData?.message || error.message || 'Server error',
            status,
            errorData?.code || 'SERVER_ERROR',
            errorData
          );

          return Promise.reject(apiError);
        } else if (error.request) {
          // Network error
          const networkError = new Error(error.message);
          logger.error('API Network Error', networkError);
          logger.info('Network Error Details', {
            endpoint: context?.endpoint || 'UNKNOWN',
            duration,
          });

          return Promise.reject(
            new ApiClientError(
              'Network error - please check your connection',
              0,
              'NETWORK_ERROR',
              error
            )
          );
        } else {
          // Request setup error
          logger.error(
            'API Client Error',
            error instanceof Error ? error : new Error(String(error))
          );

          return Promise.reject(new ApiClientError('Request failed', 0, 'CLIENT_ERROR', error));
        }
      }
    );
  }

  /**
   * Handle authentication errors (token expiry, etc.)
   */
  private handleAuthenticationError(): void {
    // Clear stored tokens
    localStorage.removeItem(this.config.auth.tokenKey);
    const refreshTokenKey = this.config.auth.refreshTokenKey || 'refresh_token';
    localStorage.removeItem(refreshTokenKey);

    // Log the authentication failure
    logger.warn('Authentication token expired or invalid', {
      timestamp: new Date().toISOString(),
      action: 'tokens_cleared',
    });

    // Don't force redirect here - let the application handle it
    // The calling code can check for 401 errors and redirect as needed
  }

  /**
   * Sanitize headers for logging (remove sensitive data)
   */
  private sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...headers };
    if (sanitized.Authorization) {
      sanitized.Authorization = '[REDACTED]';
    }
    return sanitized;
  }

  /**
   * Generic GET request
   */
  async get<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.get(endpoint, config);
      return this.extractData<T>(response);
    } catch (error) {
      throw this.handleRequestError(error);
    }
  }

  /**
   * Generic POST request
   */
  async post<T, D = unknown>(endpoint: string, data: D, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.post(endpoint, data, config);
      return this.extractData<T>(response);
    } catch (error) {
      throw this.handleRequestError(error);
    }
  }

  /**
   * Generic PUT request
   */
  async put<T, D = unknown>(endpoint: string, data: D, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.put(endpoint, data, config);
      return this.extractData<T>(response);
    } catch (error) {
      throw this.handleRequestError(error);
    }
  }

  /**
   * Generic PATCH request
   */
  async patch<T, D = unknown>(endpoint: string, data: D, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.patch(endpoint, data, config);
      return this.extractData<T>(response);
    } catch (error) {
      throw this.handleRequestError(error);
    }
  }

  /**
   * Generic DELETE request
   */
  async delete<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.delete(endpoint, config);
      return this.extractData<T>(response);
    } catch (error) {
      throw this.handleRequestError(error);
    }
  }

  /**
   * Paginated GET request
   */
  async getPaginated<T>(
    endpoint: string,
    params?: PaginationParams & Record<string, unknown>
  ): Promise<PaginatedResponse<T>> {
    return this.get(endpoint, { params });
  }

  /**
   * Extract data from response
   */
  private extractData<T>(response: AxiosResponse): T {
    // Extract data from response, supporting both direct data and wrapped data
    return (response.data?.data ?? response.data) as T;
  }

  /**
   * Handle request errors and convert to ApiClientError
   */
  private handleRequestError(error: unknown): ApiClientError {
    if (error instanceof ApiClientError) {
      return error;
    }

    // Handle unknown errors
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new ApiClientError(message, 0, 'UNKNOWN_ERROR', error);
  }

  /**
   * Raw request method for special cases (bypasses validation)
   */
  async raw<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.request(config);
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await this.client.get('/health');
      return {
        status: response.data?.status || 'ok',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new ApiClientError('Health check failed', 0, 'HEALTH_CHECK_ERROR', error);
    }
  }

  /**
   * Update configuration (useful for switching environments)
   */
  updateConfig(newConfig: Partial<{ baseURL: string; timeout: number }>): void {
    if (newConfig.baseURL) {
      this.client.defaults.baseURL = newConfig.baseURL;
    }
    if (newConfig.timeout) {
      this.client.defaults.timeout = newConfig.timeout;
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export types for external use
export type { ApiResponse, ApiError, PaginationParams, PaginatedResponse };
