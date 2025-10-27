/**
 * WebSocket Client Utility
 * Provides authenticated Socket.IO connection with token management
 *
 * SECURITY: Uses Sec-WebSocket-Protocol for token transmission
 * Query parameters are NOT supported for security reasons
 */

import { io, type Socket } from 'socket.io-client';

export interface SocketConfig {
  url?: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export class SocketClient {
  private socket: Socket | null = null;
  private token: string | null = null;

  /**
   * Create authenticated Socket.IO connection
   *
   * Uses Sec-WebSocket-Protocol header to transmit JWT token securely
   * This prevents token exposure in:
   * - Server access logs
   * - Browser history
   * - Referrer headers
   * - Bookmarks
   *
   * @param token - JWT authentication token
   * @param config - Optional socket configuration
   */
  public connect(token: string, config: SocketConfig = {}): Socket {
    this.token = token;

    const {
      url = process.env.VITE_API_URL || 'http://localhost:3001',
      autoConnect = true,
      reconnection = true,
      reconnectionAttempts = 5,
      reconnectionDelay = 1000,
    } = config;

    // Disconnect existing connection if any
    if (this.socket?.connected) {
      this.socket.disconnect();
    }

    // Create new socket with authentication
    // Method 1: Using WebSocket protocol header (most secure)
    this.socket = io(url, {
      autoConnect,
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      transports: ['websocket', 'polling'],
      // Use Sec-WebSocket-Protocol to send token
      protocols: [`Bearer_${token}`],
      // Fallback: Use extra headers for polling transport
      transportOptions: {
        polling: {
          extraHeaders: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    });

    this.setupEventHandlers();

    return this.socket;
  }

  /**
   * Get the current socket instance
   */
  public getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Disconnect the socket
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Check if socket is connected
   */
  public isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Emit event to server
   */
  public emit(event: string, data?: unknown): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit(event, data);
  }

  /**
   * Listen for event from server
   */
  public on(event: string, callback: (data: unknown) => void): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.on(event, callback);
  }

  /**
   * Remove event listener
   */
  public off(event: string, callback?: (data: unknown) => void): void {
    if (!this.socket) {
      return;
    }
    this.socket.off(event, callback);
  }

  /**
   * Setup default event handlers for connection lifecycle
   */
  private setupEventHandlers(): void {
    if (!this.socket) {
      return;
    }

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected', {
        id: this.socket?.id,
        transport: this.socket?.io.engine.transport.name,
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔥 WebSocket connection error', {
        error: error.message,
        description: error.message,
      });

      // Handle authentication errors
      if (error.message === 'Authentication required' || error.message === 'Invalid token') {
        console.error('Authentication failed - token may be expired or invalid');
        this.disconnect();
      }
    });

    this.socket.on('error', (error) => {
      console.error('🔥 WebSocket error', error);
    });

    this.socket.io.on('reconnect', (attempt) => {
      console.log('🔄 WebSocket reconnected', { attempt });
    });

    this.socket.io.on('reconnect_attempt', (attempt) => {
      console.log('🔄 WebSocket reconnection attempt', { attempt });
    });

    this.socket.io.on('reconnect_failed', () => {
      console.error('🔥 WebSocket reconnection failed');
    });
  }
}

/**
 * Global socket client instance
 * Use this for singleton pattern across the application
 */
export const socketClient = new SocketClient();

/**
 * Example usage:
 *
 * ```typescript
 * import { socketClient } from '@/core/utils/socket-client';
 * import { authStore } from '@/core/stores/authStore';
 *
 * // Connect with authentication
 * const token = authStore.getState().token;
 * if (token) {
 *   const socket = socketClient.connect(token);
 *
 *   // Listen for events
 *   socket.on('workflow_update', (data) => {
 *     console.log('Workflow updated:', data);
 *   });
 *
 *   // Emit events
 *   socket.emit('join_workflow', { workflowId: '123' });
 * }
 *
 * // Disconnect
 * socketClient.disconnect();
 * ```
 */
