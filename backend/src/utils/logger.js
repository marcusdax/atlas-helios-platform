const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Define format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
  }),
  
  // Error log file
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // Combined log file
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Add file transports for development
if (process.env.NODE_ENV === 'development') {
  transports.push(
    // Debug log file
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'debug.log'),
      level: 'debug',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    })
  );
}

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: fileFormat,
  transports,
  // Exit on error
  exitOnError: false,
  
  // Handle exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
      format: fileFormat,
    }),
  ],
  
  // Handle rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'rejections.log'),
      format: fileFormat,
    }),
  ],
});

// Create a stream object for morgan middleware
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

// Helper functions for structured logging
const logWithContext = (level, message, context = {}) => {
  const logData = {
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };
  
  logger.log(level, JSON.stringify(logData));
};

// Request logging helper
const logRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    responseTime: `${responseTime}ms`,
    statusCode: res.statusCode,
    contentLength: res.get('Content-Length') || 0,
  };
  
  const level = res.statusCode >= 400 ? 'warn' : 'info';
  logWithContext(level, 'HTTP Request', logData);
};

// Error logging helper
const logError = (error, context = {}) => {
  const logData = {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    context,
    timestamp: new Date().toISOString(),
  };
  
  logger.error('Application Error', logData);
};

// Business logic logging helpers
const logStormEvent = (event, data) => {
  logWithContext('info', `Storm Event: ${event}`, {
    service: 'stormService',
    eventType: event,
    ...data,
  });
};

const logPropertyAssessment = (propertyId, action, data) => {
  logWithContext('info', `Property Assessment: ${action}`, {
    service: 'propertyService',
    propertyId,
    action,
    ...data,
  });
};

const logComputerVision = (operation, result, data) => {
  logWithContext('info', `Computer Vision: ${operation}`, {
    service: 'computerVision',
    operation,
    success: result.success,
    confidence: result.confidence,
    processingTime: result.processingTime,
    ...data,
  });
};

/**
 * The winston logger IS the export, with the helpers hung off it.
 *
 * Every consumer in this repo writes `const logger = require('../utils/logger')`
 * and then calls `logger.info(...)`. Exporting a plain object broke all of them
 * at the first log line - which is why the server could not boot. Exporting the
 * logger itself and attaching the helpers keeps both call styles working:
 *
 *   const logger = require('../utils/logger');            // logger.info(...)
 *   const { logger, logError } = require('../utils/logger');
 */
module.exports = logger;
module.exports.logger = logger;
module.exports.logWithContext = logWithContext;
module.exports.logRequest = logRequest;
module.exports.logError = logError;
module.exports.logStormEvent = logStormEvent;
module.exports.logPropertyAssessment = logPropertyAssessment;
module.exports.logComputerVision = logComputerVision;