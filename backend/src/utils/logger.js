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

/**
 * The log directory, resolved once and created before any file transport.
 *
 * Two things were wrong here. The path used process.cwd(), so where the logs
 * landed depended on which directory the process was started from. And the
 * directory was created *after* the transports that write into it - winston
 * opens a File transport's stream at construction, so the stream failed to
 * open, and the first exception written to that dead stream raised an
 * unhandled 'error' that killed the process. The crash handler was destroying
 * the evidence of the crash it existed to record.
 */
const fs = require('fs');
const LOG_DIR = process.env.LOG_FILE_PATH
  ? path.resolve(process.env.LOG_FILE_PATH)
  : path.resolve(__dirname, '../../logs');

try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (error) {
  // An unwritable log directory must not stop the process booting; the console
  // transport still works, and that is better than no service at all.
  console.warn(`[logger] could not create ${LOG_DIR}: ${error.message}`);
}

const logFile = (name) => path.join(LOG_DIR, name);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
  }),
  
  // Error log file
  new winston.transports.File({
    filename: logFile('error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // Combined log file
  new winston.transports.File({
    filename: logFile('combined.log'),
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
      filename: logFile('debug.log'),
      level: 'debug',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    })
  );
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
      filename: logFile('exceptions.log'),
      format: fileFormat,
    }),
  ],
  
  // Handle rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: logFile('rejections.log'),
      format: fileFormat,
    }),
  ],
});

/**
 * A failing transport must never crash the application it is recording.
 * Without these listeners a stream error is an unhandled 'error' event, which
 * Node turns into an uncaught exception - the logger taking down the service.
 */
for (const transport of [...transports, ...(logger.exceptions?.handlers?.values?.() || [])]) {
  transport.on?.('error', (error) => {
    console.warn(`[logger] transport error: ${error.message}`);
  });
}

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