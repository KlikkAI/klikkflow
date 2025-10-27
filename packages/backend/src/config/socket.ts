/**
 * Socket.IO Configuration and Initialization
 * Sets up WebSocket server with authentication and CORS
 */

import type { Server as HTTPServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../middleware/socket-auth';
import { socketAuthMiddleware } from '../middleware/socket-auth';
import { CollaborationService } from '../services/CollaborationService';
import { CursorTrackingService } from '../services/CursorTrackingService';
import { logger } from '../utils/logger';

/**
 * Get allowed CORS origins for WebSocket connections
 */
function getAllowedOrigins(): string[] {
  const defaultOrigins = ['http://localhost:3000', 'http://localhost:3002'];

  if (!process.env.CORS_ORIGIN) {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('CORS_ORIGIN not set in production environment for WebSocket');
    }
    return defaultOrigins;
  }

  const origins = process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  // Validate origins - reject wildcards and non-HTTP(S) origins
  const validOrigins = origins.filter((origin) => {
    if (origin === '*') {
      logger.error('Wildcard (*) origin not allowed for WebSocket with credentials');
      return false;
    }
    if (!(origin.startsWith('http://') || origin.startsWith('https://'))) {
      logger.error(`Invalid WebSocket origin protocol: ${origin}`);
      return false;
    }
    return true;
  });

  return validOrigins.length > 0 ? validOrigins : defaultOrigins;
}

/**
 * Initialize Socket.IO server with authentication and service integration
 */
export function initializeSocketIO(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
      methods: ['GET', 'POST'],
    },
    // Connection timeout
    pingTimeout: 60000,
    pingInterval: 25000,
    // Maximum payload size
    maxHttpBufferSize: 1e6, // 1MB
    // Transport options
    transports: ['websocket', 'polling'],
    // Allow upgrades from polling to websocket
    allowUpgrades: true,
    // Cookie configuration
    cookie: {
      name: 'io',
      httpOnly: true,
      sameSite: 'lax',
    },
  });

  // Apply authentication middleware to all connections
  io.use(socketAuthMiddleware);

  // Log connection events
  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info('WebSocket client connected', {
      socketId: socket.id,
      userId: socket.user?.id,
      transport: socket.conn.transport.name,
    });

    socket.on('disconnect', (reason) => {
      logger.info('WebSocket client disconnected', {
        socketId: socket.id,
        userId: socket.user?.id,
        reason,
      });
    });

    socket.on('error', (error) => {
      logger.error('WebSocket error', {
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
      });
    });
  });

  // Initialize services that use WebSocket
  try {
    CollaborationService.getInstance().initialize(io);
    logger.info('CollaborationService initialized with Socket.IO');
  } catch (error) {
    logger.error('Failed to initialize CollaborationService', { error });
  }

  try {
    CursorTrackingService.getInstance().initialize(io);
    logger.info('CursorTrackingService initialized with Socket.IO');
  } catch (error) {
    logger.error('Failed to initialize CursorTrackingService', { error });
  }

  // ExecutionMonitoringService will be initialized separately
  // Uncomment when getInstance method is available
  // try {
  //   ExecutionMonitoringService.getInstance().initialize(io);
  //   logger.info('ExecutionMonitoringService initialized with Socket.IO');
  // } catch (error) {
  //   logger.error('Failed to initialize ExecutionMonitoringService', { error });
  // }

  logger.info('Socket.IO server initialized successfully', {
    allowedOrigins: getAllowedOrigins(),
    authEnabled: true,
  });

  return io;
}

/**
 * Example client-side connection code:
 *
 * ```typescript
 * // Method 1: Using Sec-WebSocket-Protocol (recommended)
 * const token = 'your-jwt-token';
 * const socket = io('http://localhost:3001', {
 *   transports: ['websocket'],
 *   protocols: [`Bearer_${token}`],
 * });
 *
 * // Method 2: Using Authorization header (requires custom transport)
 * const socket = io('http://localhost:3001', {
 *   transportOptions: {
 *     polling: {
 *       extraHeaders: {
 *         Authorization: `Bearer ${token}`
 *       }
 *     }
 *   }
 * });
 *
 * // Method 3: Using cookies (automatic for browser)
 * // Set cookie: document.cookie = `token=${token}; path=/; secure; samesite=lax`
 * const socket = io('http://localhost:3001');
 * ```
 */
