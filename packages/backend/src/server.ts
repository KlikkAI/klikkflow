import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import 'express-async-errors';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from workspace root
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import { DatabaseConfig } from './config/database.js';
import { initializeSocketIO } from './config/socket.js';
// Import routes
import authRoutes from './domains/auth/routes/authRoutes.js';
import apiRoutes from './routes/index.js';

const app = express();
const PORT = process.env.BACKEND_PORT || process.env.PORT || 3001;

// Connect to MongoDB
const dbConfig = DatabaseConfig.getInstance();
dbConfig
  .connect()
  .then(() => {})
  .catch((_error) => {
    process.exit(1);
  });

// CORS configuration with security validation
const getAllowedOrigins = (): string[] => {
  const defaultOrigins = ['http://localhost:3000', 'http://localhost:3002'];

  if (!process.env.CORS_ORIGIN) {
    // In production, require explicit CORS_ORIGIN configuration
    if (process.env.NODE_ENV === 'production') {
    }
    return defaultOrigins;
  }

  const origins = process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  // Validate origins - reject wildcards and non-HTTP(S) origins
  const validOrigins = origins.filter((origin) => {
    if (origin === '*') {
      return false;
    }
    if (!(origin.startsWith('http://') || origin.startsWith('https://'))) {
      return false;
    }
    return true;
  });

  return validOrigins.length > 0 ? validOrigins : defaultOrigins;
};

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: getAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // 24 hours
  })
);
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

// Mount all API routes at /api
app.use('/api', apiRoutes);

// Also mount auth under /api for consistency
app.use('/api/auth', authRoutes);

// Error handling middleware
app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!',
  });
});

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Create HTTP server for Socket.IO integration
const httpServer = createServer(app);

// Initialize Socket.IO with authentication
const io = initializeSocketIO(httpServer);

// Start server
httpServer.listen(PORT, () => {});

export default app;
export { io };
