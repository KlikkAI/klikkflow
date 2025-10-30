// IMPORTANT: Load environment variables FIRST before any other imports
import './config/env.js';

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import 'express-async-errors';
import { createServer } from 'node:http';

import { DatabaseConfig } from './config/database.js';
import { initializeSocketIO } from './config/socket.js';
// Import routes
import authRoutes from './domains/auth/routes/authRoutes.js';
import apiRoutes from './routes/index.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT;

// Log startup banner
logger.info('🚀 KlikkFlow Backend Server Starting...', {
  version: process.env.npm_package_version || '1.0.0',
  nodeVersion: process.version,
  environment: process.env.NODE_ENV || 'development',
  port: PORT,
});

// Connect to MongoDB
const dbConfig = DatabaseConfig.getInstance();
dbConfig
  .connect()
  .then(() => {
    const mongoUri = process.env.MONGODB_URI || '';
    // Sanitize URI to hide credentials in logs
    const sanitizedUri = mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    logger.info('✓ MongoDB connection established', {
      uri: sanitizedUri,
      maxPoolSize: 10,
      serverSelectionTimeout: '5s',
    });
  })
  .catch((error) => {
    const mongoUri = process.env.MONGODB_URI || '';
    // Only log hostname part for security
    const hostPart = mongoUri.split('@')[1] || 'unknown';
    logger.error('✗ MongoDB connection failed', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      host: hostPart,
    });
    process.exit(1);
  });

// CORS configuration with security validation
const getAllowedOrigins = (): string[] => {
  const defaultOrigins = ['http://localhost:3000', 'http://localhost:3002'];

  if (!process.env.CORS_ORIGIN) {
    // In production, require explicit CORS_ORIGIN configuration
    if (process.env.NODE_ENV === 'production') {
      logger.warn('⚠️  CORS_ORIGIN not configured in production - using defaults', {
        defaults: defaultOrigins,
        recommendation: 'Set CORS_ORIGIN environment variable for production',
      });
    }
    return defaultOrigins;
  }

  const origins = process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  // Validate origins - reject wildcards and non-HTTP(S) origins
  const validOrigins = origins.filter((origin) => {
    if (origin === '*') {
      logger.warn('⚠️  Wildcard CORS origin rejected for security', { origin });
      return false;
    }
    if (!(origin.startsWith('http://') || origin.startsWith('https://'))) {
      logger.warn('⚠️  Invalid CORS origin protocol rejected', { origin });
      return false;
    }
    return true;
  });

  if (validOrigins.length === 0) {
    logger.warn('⚠️  No valid CORS origins found - falling back to defaults', {
      attempted: origins,
      fallback: defaultOrigins,
    });
  }

  return validOrigins.length > 0 ? validOrigins : defaultOrigins;
};

// Middleware
app.use(helmet());

const allowedOrigins = getAllowedOrigins();
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // 24 hours
  })
);
logger.info('✓ CORS configured', {
  allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  environment: process.env.NODE_ENV || 'development',
  explicitlyConfigured: !!process.env.CORS_ORIGIN,
});

app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

logger.info('✓ Security middleware initialized', {
  helmet: true,
  compression: true,
  morgan: 'combined',
  jsonLimit: '10mb',
  urlEncoded: true,
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: '@klikkflow/backend',
    port: PORT,
  });
});

// Register auth routes (legacy path for backward compatibility)
app.use('/auth', authRoutes);
logger.info('✓ Legacy auth routes mounted', { path: '/auth' });

// Mount all API routes at /api
app.use('/api', apiRoutes);
logger.info('✓ API routes mounted', { path: '/api' });

// Also mount auth under /api for consistency
app.use('/api/auth', authRoutes);
logger.info('✓ Modern auth routes mounted', { path: '/api/auth' });

// Error handling middleware
app.use((err: any, _req: any, res: any, _next: any) => {
  logger.error('Unhandled error in request', {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!',
  });
});

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

logger.info('✓ Error handlers configured', {
  globalErrorHandler: true,
  notFoundHandler: true,
  environment: process.env.NODE_ENV || 'development',
});

// Create HTTP server for Socket.IO integration
const httpServer = createServer(app);

// Initialize Socket.IO with authentication
const io = initializeSocketIO(httpServer);
logger.info('✓ Socket.IO initialized', {
  authenticated: true,
  corsEnabled: true,
  transports: ['websocket', 'polling'],
});

// Start server
httpServer.listen(PORT, () => {
  logger.info('✓ HTTP server listening', {
    port: PORT,
    url: `http://localhost:${PORT}`,
    healthCheck: `http://localhost:${PORT}/health`,
    environment: process.env.NODE_ENV || 'development',
  });

  logger.info('========================================');
  logger.info('🎉 KlikkFlow Backend Ready!');
  logger.info('========================================');
  logger.info(`📍 Server URL: http://localhost:${PORT}`);
  logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
  logger.info(`🔐 Auth Endpoints: http://localhost:${PORT}/api/auth`);
  logger.info(`🌐 API Base: http://localhost:${PORT}/api`);
  logger.info('========================================');
});

export default app;
export { io };
