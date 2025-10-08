import jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
}

export class JWTService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
  private static readonly ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
  private static readonly REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

  /**
   * Generate access token
   */
  static generateAccessToken(userId: string, email: string, role: string): string {
    const payload: TokenPayload = {
      userId,
      email,
      role,
      type: 'access',
    };

    return jwt.sign(payload, JWTService.JWT_SECRET, {
      expiresIn: JWTService.ACCESS_TOKEN_EXPIRES_IN as string | number,
    });
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(userId: string, email: string, role: string): string {
    const payload: TokenPayload = {
      userId,
      email,
      role,
      type: 'refresh',
    };

    return jwt.sign(payload, JWTService.JWT_SECRET, {
      expiresIn: JWTService.REFRESH_TOKEN_EXPIRES_IN as string | number,
    });
  }

  /**
   * Verify and decode token
   */
  static verifyToken(token: string): DecodedToken {
    try {
      return jwt.verify(token, JWTService.JWT_SECRET) as DecodedToken;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw new Error('Token verification failed');
    }
  }

  /**
   * Decode token without verifying (useful for expired tokens)
   */
  static decodeToken(token: string): DecodedToken | null {
    try {
      return jwt.decode(token) as DecodedToken;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    const decoded = JWTService.decodeToken(token);
    if (!decoded) {
      return true;
    }

    return decoded.exp * 1000 < Date.now();
  }

  /**
   * Get token expiration date
   */
  static getTokenExpiration(token: string): Date | null {
    const decoded = JWTService.decodeToken(token);
    if (!decoded) {
      return null;
    }

    return new Date(decoded.exp * 1000);
  }
}
