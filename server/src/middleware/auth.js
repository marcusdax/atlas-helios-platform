const jwt = require('jsonwebtoken');
const rawLogger = require('../../utils/logger');
const logger = rawLogger.logger || rawLogger;

const JWT_SECRET = process.env.JWT_SECRET || 'atlas-helios-jwt-secret-dev';

/**
 * Authentication Middleware
 * Supports standard Bearer JWT tokens and allows dev-mode pass-through
 * when no token is provided or in non-production environments.
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['x-access-token'];

  if (!authHeader) {
    // In development / testing mode or when bypassing auth, provide default user context
    if (process.env.NODE_ENV !== 'production' || process.env.AUTH_OPTIONAL === 'true') {
      req.user = {
        id: 1,
        email: 'dev@atlashelios.ai',
        role: 'admin'
      };
      return next();
    }
    return res.status(401).json({ error: 'Authentication token required' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    // If invalid token in development mode, fallback to dev user
    if (process.env.NODE_ENV !== 'production') {
      logger.warn(`JWT verification failed: ${error.message}. Falling back to dev user context.`);
      req.user = {
        id: 1,
        email: 'dev@atlashelios.ai',
        role: 'admin'
      };
      return next();
    }
    return res.status(403).json({ error: 'Invalid or expired authentication token' });
  }
};

module.exports = {
  authMiddleware
};
