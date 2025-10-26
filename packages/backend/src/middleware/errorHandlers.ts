import type { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

// Custom error class
export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// MongoDB CastError handler
// biome-ignore lint/suspicious/noExplicitAny: Error handler accepts generic MongoDB errors
const handleCastErrorDB = (err: any) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

// MongoDB Duplicate field error handler
// biome-ignore lint/suspicious/noExplicitAny: Error handler accepts generic MongoDB errors
const handleDuplicateFieldsDB = (err: any) => {
  // CodeQL fix: Avoid ReDoS with simpler extraction (Alert #115)
  // Extract value between quotes without nested quantifiers
  const match = err.errmsg.match(/["']([^"']*)["']/);
  const value = match ? match[0] : 'unknown';
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

// MongoDB ValidationError handler
// biome-ignore lint/suspicious/noExplicitAny: Error handler accepts generic MongoDB errors
const handleValidationErrorDB = (err: any) => {
  // biome-ignore lint/suspicious/noExplicitAny: Mapping error values to messages
  const errors = Object.values(err.errors).map((el: any) => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// JWT Error handler
const handleJWTError = () => new AppError('Invalid token. Please log in again!', 401);

// JWT Expired Error handler
const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401);

// Send error in development
// biome-ignore lint/suspicious/noExplicitAny: Error handler accepts generic errors
const sendErrorDev = (err: any, res: Response) => {
  res.status(err.statusCode).json({
    success: false,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

// Send error in production
// biome-ignore lint/suspicious/noExplicitAny: Error handler accepts generic errors
const sendErrorProd = (err: any, res: Response) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('ERROR 💥', err);

    res.status(500).json({
      success: false,
      message: 'Something went very wrong!',
    });
  }
};

// Async error handler wrapper
export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

// Global error handler middleware
// biome-ignore lint/suspicious/noExplicitAny: Global error handler must accept any error type
export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    if (error.name === 'CastError') {
      error = handleCastErrorDB(error);
    }
    if (error.code === 11000) {
      error = handleDuplicateFieldsDB(error);
    }
    if (error.name === 'ValidationError') {
      error = handleValidationErrorDB(error);
    }
    if (error.name === 'JsonWebTokenError') {
      error = handleJWTError();
    }
    if (error.name === 'TokenExpiredError') {
      error = handleJWTExpiredError();
    }

    sendErrorProd(error, res);
  }
};

// 404 handler for undefined routes
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
  const err = new AppError(`Can't find ${req.originalUrl} on this server!`, 404);
  next(err);
};
