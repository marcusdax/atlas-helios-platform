const logger = require('../utils/logger');

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // PostgreSQL errors
  if (err.code === '23505') { // Unique constraint violation
    const message = 'Duplicate entry found';
    error = { message, statusCode: 400 };
  }

  if (err.code === '23503') { // Foreign key constraint violation
    const message = 'Invalid reference';
    error = { message, statusCode: 400 };
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large';
    error = { message, statusCode: 413 };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Invalid file type';
    error = { message, statusCode: 400 };
  }

  // Rate limiting errors
  if (err.message && err.message.includes('Too many requests')) {
    error = { message: err.message, statusCode: 429 };
  }

  // API validation errors
  if (err.isJoi) {
    const message = err.details.map(detail => detail.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // Computer vision service errors
  if (err.service === 'computerVision') {
    const message = 'Computer vision processing failed';
    error = { message, statusCode: 422 };
  }

  // Storm service errors
  if (err.service === 'stormService') {
    const message = err.message || 'Storm data processing failed';
    error = { message, statusCode: 502 };
  }

  // Property service errors
  if (err.service === 'propertyService') {
    const message = err.message || 'Property data processing failed';
    error = { message, statusCode: 502 };
  }

  // Send error response
  const status = error.statusCode || 500;

  res.status(status).json({
    success: false,
    // `error` stays a string so existing clients keep working; `code` and
    // `details` are what new code should branch on, because a message can be
    // reworded and a code cannot.
    error: error.message || 'Server Error',
    code: error.code || (status >= 500 ? 'INTERNAL_ERROR' : undefined),
    ...(error.details ? { details: error.details } : {}),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
};

/**
 * Async error handler wrapper
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 404 handler
 */
const notFound = (req, res, next) => {
  const error = new Error(`Not found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * Custom error class
 */
class ErrorResponse extends Error {
  /**
   * @param {string} message  human-readable, and safe to show a user
   * @param {number} statusCode
   * @param {object} [details] machine-readable extras: `code` for a stable
   *        identifier clients branch on, plus anything specific to the failure
   *        (which fields failed validation, which status blocked a transition).
   *        Callers were already passing this and it was being dropped, so every
   *        error arrived as an untyped string.
   */
  constructor(message, statusCode, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    const { code, ...rest } = details || {};
    this.code = code;
    this.details = Object.keys(rest).length ? rest : undefined;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  notFound,
  ErrorResponse
};