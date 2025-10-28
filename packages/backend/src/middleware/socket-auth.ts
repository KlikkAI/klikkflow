/**
 * WebSocket Authentication Middleware
 * Implements secure Socket.IO authentication using Sec-WebSocket-Protocol
 *
 * SECURITY: Query parameter authentication is disabled for security reasons
 * Tokens in URLs are exposed in:
 * - Server access logs
 * - Browser history
 * - Referrer headers
 * - Bookmarks
 *
 * Instead, we use the Sec-WebSocket-Protocol header for token transmission
 */

import type { Socket } from 'socket.io';
import type { ExtendedError } from 'socket.io/dist/namespace';
import { UserRepository } from '../domains/auth/repositories/UserRepository';
import { JWTService } from '../utils/jwt';
import { logger } from '../utils/logger';

export interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
    organizationId?: string;
    isEmailVerified: boolean;
  };
}

/**
 * Socket.IO authentication middleware
 * Extracts JWT from Sec-WebSocket-Protocol header or Authorization header
 */
export const socketAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: ExtendedError) => void
): Promise<void> => {
  try {
    const token = extractTokenFromSocket(socket);

    if (!token) {
      logger.warn('WebSocket connection attempt without authentication token', {
        socketId: socket.id,
        handshake: socket.handshake.headers,
      });
      return next(new Error('Authentication required'));
    }

    // Verify JWT token
    const decoded = JWTService.verifyToken(token);

    // Verify user still exists and is active
    const userRepository = new UserRepository();
    const user = await userRepository.findById(decoded.userId);

    if (!user?.isActive) {
      logger.warn('WebSocket connection attempt with invalid/inactive user', {
        socketId: socket.id,
        userId: decoded.userId,
      });
      return next(new Error('User account not found or inactive'));
    }

    // Check if account is locked
    if (user.isLocked()) {
      logger.warn('WebSocket connection attempt from locked account', {
        socketId: socket.id,
        userId: decoded.userId,
      });
      return next(new Error('Account is temporarily locked'));
    }

    // Attach user data to socket
    socket.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions,
      organizationId: decoded.organizationId,
      isEmailVerified: decoded.isEmailVerified,
    };

    logger.info('WebSocket connection authenticated', {
      socketId: socket.id,
      userId: decoded.userId,
      email: decoded.email,
    });

    next();
  } catch (error) {
    logger.error('WebSocket authentication error', {
      socketId: socket.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        return next(new Error('Token expired'));
      }
      if (error.message.includes('invalid')) {
        return next(new Error('Invalid token'));
      }
    }

    next(new Error('Authentication failed'));
  }
};

/**
 * Extract JWT token from Socket.IO handshake
 *
 * Supports multiple authentication methods in order of preference:
 * 1. Sec-WebSocket-Protocol header (recommended for WebSocket)
 * 2. Authorization header (Bearer token)
 * 3. Cookie (for browser-based connections)
 *
 * SECURITY: Query parameters are NOT supported for token transmission
 */
function extractTokenFromSocket(socket: Socket): string | null {
  // Method 1: Sec-WebSocket-Protocol header (WebSocket standard)
  // Client sends: new WebSocket(url, ['authorization', 'Bearer_<token>'])
  const protocols = socket.handshake.headers['sec-websocket-protocol'];
  if (protocols) {
    const protocolArray = Array.isArray(protocols) ? protocols : protocols.split(',');

    for (const protocol of protocolArray) {
      const trimmed = protocol.trim();

      // Format: "Bearer_<token>" or "authorization_Bearer_<token>"
      if (trimmed.startsWith('Bearer_')) {
        return trimmed.substring(7); // Remove "Bearer_" prefix
      }

      if (trimmed.startsWith('authorization_Bearer_')) {
        return trimmed.substring(21); // Remove "authorization_Bearer_" prefix
      }
    }
  }

  // Method 2: Authorization header (standard HTTP authentication)
  const authHeader = socket.handshake.headers.authorization;
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Legacy support for lowercase bearer
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.split(' ')[1];
    }

    // Token without Bearer prefix (only if no spaces)
    if (!authHeader.includes(' ')) {
      return authHeader;
    }
  }

  // Method 3: Cookie authentication (for browser-based connections)
  const cookies = socket.handshake.headers.cookie;
  if (cookies) {
    const tokenCookie = cookies
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('token='));

    if (tokenCookie) {
      return tokenCookie.substring(6); // Remove "token=" prefix
    }
  }

  // SECURITY NOTE: Query parameter extraction intentionally removed
  // Tokens in URLs are security risks - they get logged and exposed
  // If you need WebSocket auth, use one of the above methods

  return null;
}

/**
 * Optional authentication middleware for WebSocket connections
 * Doesn't throw errors if authentication fails, but still attaches user if available
 */
export const socketOptionalAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: ExtendedError) => void
): Promise<void> => {
  try {
    const token = extractTokenFromSocket(socket);

    if (!token) {
      // No token provided, continue without authentication
      return next();
    }

    // Attempt to authenticate
    const decoded = JWTService.verifyToken(token);
    const userRepository = new UserRepository();
    const user = await userRepository.findById(decoded.userId);

    if (user?.isActive && !user.isLocked()) {
      socket.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions,
        organizationId: decoded.organizationId,
        isEmailVerified: decoded.isEmailVerified,
      };

      logger.info('WebSocket connection authenticated (optional)', {
        socketId: socket.id,
        userId: decoded.userId,
      });
    }

    next();
  } catch (_error) {
    // For optional auth, continue without user data on error
    logger.debug('WebSocket optional authentication failed, continuing as anonymous', {
      socketId: socket.id,
    });
    next();
  }
};
