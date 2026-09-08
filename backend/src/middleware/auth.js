const jwt = require('jsonwebtoken');
const db = require('../../config/database');
const logger = require('../utils/logger');

/**
 * JWT Authentication Middleware
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    // `status` must be selected: the check below compares against it, and
    // omitting it made every authenticated request fail with 401 because
    // undefined is never 'active'. `platform_admin` is what lets a platform
    // operator read across companies.
    const user = await db('users')
      .select('id', 'email', 'name', 'role', 'company_id', 'status', 'platform_admin', 'created_at')
      .where('id', decoded.userId)
      .first();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Account is inactive.'
      });
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (error) {
    logger.error('Authentication middleware error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error during authentication.'
    });
  }
};

/**
 * Role-based authorization middleware
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions.'
      });
    }

    next();
  };
};

/**
 * Company membership verification middleware
 */
const verifyCompanyAccess = async (req, res, next) => {
  try {
    const companyId = req.params.companyId || req.body.companyId;
    
    if (!companyId) {
      return next(); // Skip if no company ID specified
    }

    // Super admin has access to all companies
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user belongs to the specified company
    if (req.user.company_id !== parseInt(companyId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Company access required.'
      });
    }

    next();
  } catch (error) {
    logger.error('Company access verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying company access.'
    });
  }
};

/**
 * Optional authentication middleware (for endpoints that work with or without auth)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await db('users')
        .select('id', 'email', 'name', 'role', 'company_id')
        .where('id', decoded.userId)
        .where('status', 'active')
        .first();

      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Silent fail for optional auth
    next();
  }
};

/**
 * Generate JWT token
 */
const generateToken = (userId, role = 'user') => {
  return jwt.sign(
    { 
      userId, 
      role,
      iat: Math.floor(Date.now() / 1000)
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      issuer: 'atlas-helios-platform',
      audience: 'propertyinsight-ai'
    }
  );
};

/**
 * Refresh token generation
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { 
      userId, 
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000)
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { 
      expiresIn: '7d',
      issuer: 'atlas-helios-platform',
      audience: 'propertyinsight-ai'
    }
  );
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
};

module.exports = {
  authMiddleware,
  authorize,
  verifyCompanyAccess,
  optionalAuth,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken
};