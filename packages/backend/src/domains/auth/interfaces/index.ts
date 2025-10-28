/**
 * Auth domain interfaces
 */

export interface IAuthRequest {
  email: string;
  password: string;
}

export interface IRegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// Alias for consistency with service usage
export interface IRegistrationData extends IRegisterRequest {}

export interface IAuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  token: string;
}

export interface IUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
  isEmailVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
  organizationId?: string;
  isEmailVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * API Key interfaces
 */

export interface ICreateApiKeyRequest {
  name: string;
  permissions?: string[];
  expiresIn?: number; // Duration in seconds
  ipWhitelist?: string[];
}

export interface IApiKeyResponse {
  id: string;
  name: string;
  maskedKey: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
  requestCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateApiKeyResponse extends IApiKeyResponse {
  key: string; // Full API key (only shown once)
}

export interface IUpdateApiKeyRequest {
  permissions?: string[];
  name?: string;
}
