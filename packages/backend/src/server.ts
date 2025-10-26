import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import 'express-async-errors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { DatabaseConfig } from './config/database.js';
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
      console.warn('WARNING: CORS_ORIGIN not set in production environment');
    }
    return defaultOrigins;
  }

  const origins = process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  // Validate origins - reject wildcards and non-HTTP(S) origins
  const validOrigins = origins.filter((origin) => {
    if (origin === '*') {
      console.error('ERROR: Wildcard (*) origin not allowed with credentials');
      return false;
    }
    if (!(origin.startsWith('http://') || origin.startsWith('https://'))) {
      console.error(`ERROR: Invalid origin protocol: ${origin}`);
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

// Start server
app.listen(PORT, () => {});

export default app;
