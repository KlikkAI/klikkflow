# WebSocket Authentication Guide

## Overview

Reporunner uses **Socket.IO** for real-time WebSocket communication with **secure JWT-based authentication**.

For security reasons, tokens are transmitted via the `Sec-WebSocket-Protocol` header instead of URL query parameters.

---

## Why Not Query Parameters?

**❌ Security Risk:** Tokens in URLs are exposed in:
- Server access logs
- Browser history
- Referrer headers
- Bookmarks
- Analytics tools

**✅ Solution:** Use `Sec-WebSocket-Protocol` or HTTP headers for token transmission.

---

## Authentication Methods

### Method 1: Sec-WebSocket-Protocol (Recommended)

**Client-Side (TypeScript/JavaScript):**

```typescript
import { io } from 'socket.io-client';

const token = 'your-jwt-token';
const socket = io('http://localhost:3001', {
  transports: ['websocket'],
  protocols: [`Bearer_${token}`],
});
```

**How it works:**
- The token is sent in the WebSocket handshake as a subprotocol
- Server extracts and validates the token from `Sec-WebSocket-Protocol` header
- More secure than query parameters

---

### Method 2: Authorization Header (Polling Transport)

**Client-Side:**

```typescript
import { io } from 'socket.io-client';

const token = 'your-jwt-token';
const socket = io('http://localhost:3001', {
  transportOptions: {
    polling: {
      extraHeaders: {
        Authorization: `Bearer ${token}`
      }
    }
  }
});
```

**When to use:**
- When WebSocket transport is not available
- Fallback for polling transport
- Compatible with standard HTTP authentication

---

### Method 3: Cookie-Based (Browser Only)

**Client-Side:**

```typescript
// Set authentication cookie
document.cookie = `token=${token}; path=/; secure; samesite=lax`;

// Connect without additional configuration
const socket = io('http://localhost:3001');
```

**When to use:**
- Browser-based applications
- When you want automatic authentication
- Session-based systems

---

## Using the SocketClient Utility (Frontend)

**Recommended approach for React/TypeScript applications:**

```typescript
import { socketClient } from '@/core/utils/socket-client';
import { authStore } from '@/core/stores/authStore';

// Get token from auth store
const token = authStore.getState().token;

if (token) {
  // Connect with authentication
  const socket = socketClient.connect(token, {
    url: 'http://localhost:3001',
    reconnection: true,
    reconnectionAttempts: 5,
  });

  // Listen for events
  socket.on('workflow_update', (data) => {
    console.log('Workflow updated:', data);
  });

  // Join a workflow collaboration session
  socket.emit('join_collaboration', {
    workflowId: '123',
    participant: {
      userId: 'user-id',
      userName: 'John Doe',
      role: 'editor',
    },
  });

  // Listen for collaboration events
  socket.on('participant_joined', (data) => {
    console.log('Participant joined:', data);
  });

  socket.on('collaboration_operation', (data) => {
    console.log('Received operation:', data);
  });

  // Cleanup on unmount
  return () => {
    socketClient.disconnect();
  };
}
```

---

## React Hook Example

**Create a custom hook for WebSocket connections:**

```typescript
import { useEffect, useState } from 'react';
import { socketClient } from '@/core/utils/socket-client';
import { authStore } from '@/core/stores/authStore';
import type { Socket } from 'socket.io-client';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const token = authStore((state) => state.token);

  useEffect(() => {
    if (!token) {
      return;
    }

    // Connect
    const socketInstance = socketClient.connect(token);
    setSocket(socketInstance);

    // Track connection status
    socketInstance.on('connect', () => setIsConnected(true));
    socketInstance.on('disconnect', () => setIsConnected(false));

    // Cleanup
    return () => {
      socketClient.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [token]);

  return { socket, isConnected };
}

// Usage in component
function WorkflowEditor() {
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on('workflow_update', handleWorkflowUpdate);

    return () => {
      socket.off('workflow_update', handleWorkflowUpdate);
    };
  }, [socket, isConnected]);

  // ... rest of component
}
```

---

## Server-Side Configuration

The server automatically handles authentication via middleware:

**Backend (packages/backend/src/config/socket.ts):**

```typescript
import { Server as SocketIOServer } from 'socket.io';
import { socketAuthMiddleware } from '../middleware/socket-auth';

export function initializeSocketIO(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
  });

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    // socket.user is now available with authenticated user data
    console.log('User connected:', socket.user);
  });

  return io;
}
```

---

## Authentication Flow

```
Client                          Server
  |                               |
  |--- WebSocket Handshake ------>|
  |    (Sec-WebSocket-Protocol:   |
  |     Bearer_<token>)            |
  |                               |
  |                               |--- Validate JWT Token
  |                               |--- Check User Status
  |                               |--- Attach User to Socket
  |                               |
  |<---- Connection Accepted -----|
  |     (socket.user populated)   |
  |                               |
  |--- Emit/Listen Events ------->|
  |<----- Emit/Listen Events -----|
  |                               |
```

---

## Error Handling

**Common authentication errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| `Authentication required` | No token provided | Send token in connection |
| `Invalid token` | Malformed JWT | Check token format |
| `Token expired` | JWT expired | Refresh token and reconnect |
| `User account not found or inactive` | User deleted/deactivated | Re-authenticate user |
| `Account is temporarily locked` | Too many failed logins | Wait for unlock period |

**Client-side error handling:**

```typescript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);

  if (error.message === 'Token expired') {
    // Refresh token and reconnect
    refreshAuthToken().then((newToken) => {
      socketClient.disconnect();
      socketClient.connect(newToken);
    });
  }
});
```

---

## Migration from Query Parameters

**❌ Old Method (Insecure - Removed):**

```typescript
// DO NOT USE - Security risk!
const socket = io(`http://localhost:3001?token=${token}`);
```

**✅ New Method (Secure):**

```typescript
// Use Sec-WebSocket-Protocol
const socket = io('http://localhost:3001', {
  protocols: [`Bearer_${token}`],
});
```

---

## Testing WebSocket Authentication

**Using Socket.IO Client CLI:**

```bash
# Install socket.io-client globally
npm install -g socket.io-client

# Connect with authentication
socket.io-client http://localhost:3001 \
  --extraHeaders '{"Authorization":"Bearer YOUR_TOKEN_HERE"}'
```

**Using Browser DevTools:**

```javascript
// In browser console
const token = 'your-jwt-token';
const socket = io('http://localhost:3001', {
  protocols: [`Bearer_${token}`],
});

socket.on('connect', () => console.log('Connected!'));
socket.on('connect_error', (err) => console.error(err));
```

---

## Security Best Practices

1. **✅ Always use HTTPS/WSS in production**
2. **✅ Validate tokens on every connection**
3. **✅ Use short-lived access tokens (7 days)**
4. **✅ Implement token refresh mechanism**
5. **✅ Log authentication failures**
6. **✅ Rate limit connection attempts**
7. **❌ Never log tokens in server logs**
8. **❌ Never send tokens in URLs**

---

## Troubleshooting

### Connection Fails Immediately

**Check:**
- Token is valid and not expired
- Token is being sent correctly in the protocol header
- CORS is configured correctly
- Server is running on the expected port

### Authentication Succeeds but Events Don't Work

**Check:**
- User has required permissions for the event
- Event names match between client and server
- Data is being serialized correctly (JSON-compatible)

### Reconnection Loops

**Check:**
- Token hasn't expired during the session
- Implement token refresh before expiration
- Check server logs for specific errors

---

## Related Files

- **Backend Middleware:** `packages/backend/src/middleware/socket-auth.ts`
- **Backend Configuration:** `packages/backend/src/config/socket.ts`
- **Frontend Client:** `packages/frontend/src/core/utils/socket-client.ts`
- **Server Initialization:** `packages/backend/src/server.ts`

---

**Last Updated:** October 27, 2025
