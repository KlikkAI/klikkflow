import type {
  ApiKey,
  AuthTokens,
  ChangePasswordRequest,
  CreateApiKeyRequest,
  LoginCredentials,
  LoginResponse,
  MfaSetupRequest,
  MfaVerifyRequest,
  PasswordResetConfirm,
  RegisterRequest,
  SessionInfo,
  UpdateProfileRequest,
  UserProfile,
} from '../schemas';
import { configService } from '../services/ConfigService';
import { ApiClientError, apiClient } from './ApiClient';

/**
 * Backend response structures (includes extra fields from MongoDB)
 */
interface BackendUserData {
  _id?: string;
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  fullName?: string;
  lastLogin?: string;
  avatar?: string;
  timezone?: string;
  preferences?: unknown;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  isActive?: boolean;
  isEmailVerified?: boolean;
  __v?: number;
  failedLoginAttempts?: number;
  // Allow any other fields from backend
  [key: string]: unknown;
}

interface BackendAuthResponse {
  success: boolean;
  message?: string;
  data: {
    user: BackendUserData;
    token: string;
    refreshToken: string;
    permissions?: string[];
    sessionId?: string;
  };
}

interface BackendProfileResponse {
  success: boolean;
  data: {
    user: BackendUserData;
  };
}

/**
 * Type-safe Authentication API Service
 *
 * Handles all authentication operations with full type safety
 * Supports login, registration, password management, MFA, API keys, and session management
 */
export class AuthApiService {
  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  /**
   * Transform user data from backend response to UserProfile
   */
  private transformUserProfile(userData: BackendUserData): UserProfile {
    return {
      id: userData.id,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role as 'super_admin' | 'admin' | 'member' | 'viewer',
      fullName: userData.fullName,
      lastLogin: userData.lastLogin, // Backend uses lastLogin
      avatar: userData.avatar,
      timezone: userData.timezone,
      preferences: userData.preferences as
        | {
            theme: 'light' | 'dark' | 'system';
            language: string;
            notifications: { email: boolean; workflow: boolean; system: boolean };
          }
        | undefined,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
      lastLoginAt: userData.lastLoginAt || userData.lastLogin, // Map lastLogin to lastLoginAt
      isActive: userData.isActive ?? true,
      isEmailVerified: userData.isEmailVerified ?? false,
    };
  }
  // ==========================================
  // AUTHENTICATION OPERATIONS
  // ==========================================

  /**
   * Authenticate user with email and password
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      // Use raw API call to bypass strict schema validation
      // Backend returns nested { success, data: { user, token, refreshToken } }
      const response = await apiClient.raw({
        method: 'POST',
        url: '/auth/login',
        data: credentials,
      });

      // Extract data from nested response structure
      const responseData = response.data as BackendAuthResponse;
      const loginData = responseData.data || responseData;

      // Store tokens in localStorage
      if (loginData.token) {
        localStorage.setItem(configService.get('auth').tokenKey, loginData.token);
      }
      if (loginData.refreshToken) {
        localStorage.setItem(configService.get('auth').refreshTokenKey, loginData.refreshToken);
      }

      // Transform user data to match UserProfile interface
      const transformedUser = this.transformUserProfile(loginData.user);

      return {
        user: transformedUser,
        token: loginData.token,
        refreshToken: loginData.refreshToken,
        permissions: loginData.permissions || [],
        sessionId: loginData.sessionId,
      };
    } catch (error) {
      throw new ApiClientError('Login failed', 0, 'LOGIN_ERROR', error);
    }
  }

  /**
   * Register new user account
   */
  async register(userData: RegisterRequest): Promise<LoginResponse> {
    try {
      // Use raw API call to bypass strict schema validation
      // Backend returns nested { success, data: { user, token, refreshToken } }
      const response = await apiClient.raw({
        method: 'POST',
        url: '/auth/register',
        data: userData,
      });

      // Extract data from nested response structure
      const responseData = response.data as BackendAuthResponse;
      const loginData = responseData.data || responseData;

      // Store tokens in localStorage
      if (loginData.token) {
        localStorage.setItem(configService.get('auth').tokenKey, loginData.token);
      }
      if (loginData.refreshToken) {
        localStorage.setItem(configService.get('auth').refreshTokenKey, loginData.refreshToken);
      }

      // Transform user data to match UserProfile interface
      const transformedUser = this.transformUserProfile(loginData.user);

      return {
        user: transformedUser,
        token: loginData.token,
        refreshToken: loginData.refreshToken,
        permissions: loginData.permissions || [],
        sessionId: loginData.sessionId,
      };
    } catch (error) {
      throw new ApiClientError('Registration failed', 0, 'REGISTRATION_ERROR', error);
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<{ message: string; sessionId: string }> {
    try {
      const response = await apiClient.post<{ message: string; sessionId: string }>(
        '/auth/logout',
        {}
      );

      // Clear stored tokens
      this.clearAuthData();

      return response;
    } catch (error) {
      // Even if logout fails on server, clear local tokens
      this.clearAuthData();

      throw new ApiClientError('Logout failed', 0, 'LOGOUT_ERROR', error);
    }
  }

  /**
   * Refresh authentication tokens
   */
  async refreshTokens(refreshToken?: string): Promise<AuthTokens> {
    try {
      const token = refreshToken || localStorage.getItem(configService.get('auth').refreshTokenKey);
      if (!token) {
        throw new ApiClientError('No refresh token available', 401, 'NO_REFRESH_TOKEN');
      }

      const response = await apiClient.post<AuthTokens>('/auth/refresh', { refreshToken: token });

      // Update stored tokens
      localStorage.setItem(configService.get('auth').tokenKey, response.accessToken);
      if (response.refreshToken) {
        localStorage.setItem(configService.get('auth').refreshTokenKey, response.refreshToken);
      }

      return response;
    } catch (error) {
      // If refresh fails, clear tokens and throw error
      this.clearAuthData();

      throw new ApiClientError('Token refresh failed', 401, 'TOKEN_REFRESH_ERROR', error);
    }
  }

  // ==========================================
  // PASSWORD MANAGEMENT
  // ==========================================

  /**
   * Request password reset email
   */
  async requestPasswordReset(email: string): Promise<{ message: string; email: string }> {
    try {
      return await apiClient.post<{ message: string; email: string }>(
        '/auth/password/reset-request',
        { email }
      );
    } catch (error) {
      throw new ApiClientError(
        'Password reset request failed',
        0,
        'PASSWORD_RESET_REQUEST_ERROR',
        error
      );
    }
  }

  /**
   * Confirm password reset with token
   */
  async confirmPasswordReset(resetData: PasswordResetConfirm): Promise<{ message: string }> {
    try {
      return await apiClient.post<{ message: string }>('/auth/password/reset-confirm', resetData);
    } catch (error) {
      throw new ApiClientError(
        'Password reset confirmation failed',
        0,
        'PASSWORD_RESET_CONFIRM_ERROR',
        error
      );
    }
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(passwordData: ChangePasswordRequest): Promise<{ message: string }> {
    try {
      return await apiClient.post<{ message: string }>('/auth/password/change', passwordData);
    } catch (error) {
      throw new ApiClientError('Password change failed', 0, 'PASSWORD_CHANGE_ERROR', error);
    }
  }

  // ==========================================
  // USER PROFILE MANAGEMENT
  // ==========================================

  /**
   * Get current user profile
   */
  async getProfile(): Promise<UserProfile> {
    try {
      // Use raw API call since backend returns nested { data: { user: UserProfile } }
      const response = await apiClient.raw({
        method: 'GET',
        url: '/auth/profile',
      });

      // Backend returns: { success, data: { user: UserProfile } }
      // Extract user from nested structure
      const responseData = response.data as BackendProfileResponse;
      const userData =
        responseData.data?.user || (responseData as unknown as { user: BackendUserData }).user;

      if (!userData) {
        throw new ApiClientError('Invalid profile response structure', 422, 'INVALID_RESPONSE');
      }

      // Transform and validate the user data
      return this.transformUserProfile(userData);
    } catch (error) {
      throw new ApiClientError('Failed to fetch user profile', 0, 'PROFILE_FETCH_ERROR', error);
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: UpdateProfileRequest): Promise<UserProfile> {
    try {
      // Use raw API call since backend returns nested { data: { user: UserProfile } }
      const response = await apiClient.raw({
        method: 'PUT',
        url: '/auth/profile',
        data: updates,
      });

      // Backend returns: { success, data: { user: UserProfile } }
      // Extract user from nested structure
      const responseData = response.data as BackendProfileResponse;
      const userData =
        responseData.data?.user || (responseData as unknown as { user: BackendUserData }).user;

      if (!userData) {
        throw new ApiClientError('Invalid profile response structure', 422, 'INVALID_RESPONSE');
      }

      // Transform and validate the user data
      return this.transformUserProfile(userData);
    } catch (error) {
      throw new ApiClientError('Failed to update profile', 0, 'PROFILE_UPDATE_ERROR', error);
    }
  }

  /**
   * Upload profile avatar
   */
  async uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await apiClient.raw({
        method: 'POST',
        url: '/auth/profile/avatar',
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data as { avatarUrl: string };
    } catch (error) {
      throw new ApiClientError('Failed to upload avatar', 0, 'AVATAR_UPLOAD_ERROR', error);
    }
  }

  // ==========================================
  // EMAIL VERIFICATION
  // ==========================================

  /**
   * Request email verification
   */
  async requestEmailVerification(): Promise<{
    message: string;
    emailSent: boolean;
  }> {
    try {
      return await apiClient.post<{ message: string; emailSent: boolean }>(
        '/auth/email/verify-request',
        {}
      );
    } catch (error) {
      throw new ApiClientError(
        'Email verification request failed',
        0,
        'EMAIL_VERIFICATION_REQUEST_ERROR',
        error
      );
    }
  }

  /**
   * Confirm email verification with token
   */
  async confirmEmailVerification(token: string): Promise<{ message: string }> {
    try {
      return await apiClient.post<{ message: string }>('/auth/email/verify-confirm', { token });
    } catch (error) {
      throw new ApiClientError(
        'Email verification confirmation failed',
        0,
        'EMAIL_VERIFICATION_CONFIRM_ERROR',
        error
      );
    }
  }

  // ==========================================
  // SESSION MANAGEMENT
  // ==========================================

  /**
   * Get current session information
   */
  async getSessionInfo(): Promise<SessionInfo> {
    try {
      return await apiClient.get<SessionInfo>('/auth/session');
    } catch (error) {
      throw new ApiClientError(
        'Failed to fetch session information',
        0,
        'SESSION_INFO_ERROR',
        error
      );
    }
  }

  /**
   * Get all active sessions for current user
   */
  async getActiveSessions(): Promise<SessionInfo[]> {
    try {
      return await apiClient.get<SessionInfo[]>('/auth/sessions');
    } catch (error) {
      throw new ApiClientError(
        'Failed to fetch active sessions',
        0,
        'ACTIVE_SESSIONS_ERROR',
        error
      );
    }
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<{ message: string }> {
    try {
      return await apiClient.delete<{ message: string }>(`/auth/sessions/${sessionId}`);
    } catch (error) {
      throw new ApiClientError(
        `Failed to revoke session ${sessionId}`,
        0,
        'SESSION_REVOKE_ERROR',
        error
      );
    }
  }

  // ==========================================
  // API KEY MANAGEMENT
  // ==========================================

  /**
   * Get user's API keys
   */
  async getApiKeys(): Promise<ApiKey[]> {
    try {
      return await apiClient.get<ApiKey[]>('/auth/api-keys');
    } catch (error) {
      throw new ApiClientError('Failed to fetch API keys', 0, 'API_KEYS_FETCH_ERROR', error);
    }
  }

  /**
   * Create new API key
   */
  async createApiKey(keyData: CreateApiKeyRequest): Promise<ApiKey> {
    try {
      return await apiClient.post<ApiKey>('/auth/api-keys', keyData);
    } catch (error) {
      throw new ApiClientError('Failed to create API key', 0, 'API_KEY_CREATE_ERROR', error);
    }
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string): Promise<{ message: string }> {
    try {
      return await apiClient.delete<{ message: string }>(`/auth/api-keys/${keyId}`);
    } catch (error) {
      throw new ApiClientError(
        `Failed to revoke API key ${keyId}`,
        0,
        'API_KEY_REVOKE_ERROR',
        error
      );
    }
  }

  // ==========================================
  // MULTI-FACTOR AUTHENTICATION
  // ==========================================

  /**
   * Setup MFA for user account
   */
  async setupMfa(mfaData: MfaSetupRequest): Promise<{
    secret?: string; // For TOTP
    qrCode?: string; // For TOTP
    backupCodes: string[];
  }> {
    try {
      return await apiClient.post<{
        secret?: string;
        qrCode?: string;
        backupCodes: string[];
      }>('/auth/mfa/setup', mfaData);
    } catch (error) {
      throw new ApiClientError('MFA setup failed', 0, 'MFA_SETUP_ERROR', error);
    }
  }

  /**
   * Verify MFA code
   */
  async verifyMfa(mfaData: MfaVerifyRequest): Promise<{ message: string; verified: boolean }> {
    try {
      return await apiClient.post<{ message: string; verified: boolean }>(
        '/auth/mfa/verify',
        mfaData
      );
    } catch (error) {
      throw new ApiClientError('MFA verification failed', 0, 'MFA_VERIFY_ERROR', error);
    }
  }

  /**
   * Disable MFA for user account
   */
  async disableMfa(password: string): Promise<{ message: string }> {
    try {
      return await apiClient.post<{ message: string }>('/auth/mfa/disable', { password });
    } catch (error) {
      throw new ApiClientError('Failed to disable MFA', 0, 'MFA_DISABLE_ERROR', error);
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Check if user is authenticated (has valid token)
   */
  isAuthenticated(): boolean {
    const token = localStorage.getItem(configService.get('auth').tokenKey);
    return !!token;
  }

  /**
   * Get current auth token
   */
  getAuthToken(): string | null {
    return localStorage.getItem(configService.get('auth').tokenKey);
  }

  /**
   * Clear all authentication data
   */
  clearAuthData(): void {
    localStorage.removeItem(configService.get('auth').tokenKey);
    localStorage.removeItem(configService.get('auth').refreshTokenKey);
  }
}

// Export singleton instance
export const authApiService = new AuthApiService();
