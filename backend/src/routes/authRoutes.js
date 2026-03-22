const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../../config/database');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register new user
 * @access Public
 */
router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password, companyName, role = 'user' } = req.body;

  // Validate input
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, and password are required'
    });
  }

  // Check if user already exists
  const existingUser = await db('users').where('email', email).first();
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User with this email already exists'
    });
  }

  // Hash password
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Create or get company
  let company = null;
  if (companyName) {
    company = await db('companies').where('name', companyName).first();
    if (!company) {
      company = {
        id: require('uuid').v4(),
        name: companyName,
        createdAt: new Date().toISOString()
      };
      await db('companies').insert(company);
    }
  }

  // Create user
  const user = {
    id: require('uuid').v4(),
    name,
    email,
    password: hashedPassword,
    role,
    companyId: company ? company.id : null,
    status: 'active',
    emailVerified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db('users').insert(user);

  // Generate tokens
  const accessToken = generateToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);

  // Save refresh token
  await db('refresh_tokens').insert({
    id: require('uuid').v4(),
    userId: user.id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    createdAt: new Date().toISOString()
  });

  logger.info(`User registered: ${email}`);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId
      },
      tokens: {
        accessToken,
        refreshToken
      }
    }
  });
}));

/**
 * @route POST /api/auth/login
 * @desc Authenticate user and return tokens
 * @access Public
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  // Find user
  const user = await db('users')
    .select('id', 'name', 'email', 'password', 'role', 'companyId', 'status')
    .where('email', email)
    .first();

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Check if user is active
  if (user.status !== 'active') {
    return res.status(401).json({
      success: false,
      message: 'Account is inactive. Please contact support.'
    });
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Generate tokens
  const accessToken = generateToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);

  // Save refresh token
  await db('refresh_tokens').insert({
    id: require('uuid').v4(),
    userId: user.id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    createdAt: new Date().toISOString()
  });

  // Update last login
  await db('users')
    .where('id', user.id)
    .update({
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

  logger.info(`User logged in: ${email}`);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId
      },
      tokens: {
        accessToken,
        refreshToken
      }
    }
  });
}));

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token using refresh token
 * @access Public
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token is required'
    });
  }

  try {
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    // Check if token exists in database and is valid
    const tokenRecord = await db('refresh_tokens')
      .where('token', refreshToken)
      .where('userId', decoded.userId)
      .where('expiresAt', '>', new Date())
      .first();

    if (!tokenRecord) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Get user
    const user = await db('users')
      .select('id', 'name', 'email', 'role', 'companyId', 'status')
      .where('id', decoded.userId)
      .first();

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Generate new access token
    const accessToken = generateToken(user.id, user.role);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId
        }
      }
    });

  } catch (error) {
    logger.error('Token refresh failed:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token'
    });
  }
}));

/**
 * @route POST /api/auth/logout
 * @desc Logout user and invalidate refresh token
 * @access Private
 */
router.post('/logout', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    // Remove refresh token from database
    await db('refresh_tokens')
      .where('token', refreshToken)
      .delete();
  }

  res.json({
    success: true,
    message: 'Logout successful'
  });
}));

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', asyncHandler(async (req, res) => {
  // User is attached by auth middleware
  const user = req.user;

  // Get company info if applicable
  let company = null;
  if (user.company_id) {
    company = await db('companies')
      .select('id', 'name', 'address', 'phone', 'email')
      .where('id', user.company_id)
      .first();
  }

  // Get user stats
  const stats = await db('properties')
    .where('companyId', user.company_id || null)
    .count('id as total')
    .first();

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.company_id,
        createdAt: user.created_at
      },
      company,
      stats: {
        totalProperties: parseInt(stats.total) || 0
      }
    }
  });
}));

/**
 * @route PUT /api/auth/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/profile', asyncHandler(async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body;
  const user = req.user;

  const updateData = {
    updatedAt: new Date().toISOString()
  };

  // Update name
  if (name) {
    updateData.name = name;
  }

  // Update email (if different)
  if (email && email !== user.email) {
    // Check if email is already taken
    const existingUser = await db('users')
      .where('email', email)
      .where('id', '!=', user.id)
      .first();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email is already taken'
      });
    }

    updateData.email = email;
    updateData.emailVerified = false; // Reset email verification
  }

  // Update password
  if (newPassword) {
    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is required to set new password'
      });
    }

    // Verify current password
    const userRecord = await db('users')
      .select('password')
      .where('id', user.id)
      .first();

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userRecord.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    updateData.password = await bcrypt.hash(newPassword, saltRounds);
  }

  // Update user
  await db('users')
    .where('id', user.id)
    .update(updateData);

  // Get updated user data
  const updatedUser = await db('users')
    .select('id', 'name', 'email', 'role', 'companyId')
    .where('id', user.id)
    .first();

  logger.info(`User profile updated: ${user.id}`);

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: updatedUser
    }
  });
}));

/**
 * @route POST /api/auth/verify-email
 * @desc Verify user email
 * @access Private
 */
router.post('/verify-email', asyncHandler(async (req, res) => {
  const { token } = req.body;
  const user = req.user;

  // In a real implementation, you would verify the email token
  // For now, we'll just mark the email as verified
  await db('users')
    .where('id', user.id)
    .update({
      emailVerified: true,
      updatedAt: new Date().toISOString()
    });

  res.json({
    success: true,
    message: 'Email verified successfully'
  });
}));

/**
 * @route POST /api/auth/forgot-password
 * @desc Send password reset email
 * @access Public
 */
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await db('users').where('email', email).first();
  if (!user) {
    // Don't reveal if email exists or not
    return res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    });
  }

  // Generate reset token
  const resetToken = require('uuid').v4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Save reset token
  await db('password_resets').insert({
    id: require('uuid').v4(),
    userId: user.id,
    token: resetToken,
    expiresAt,
    createdAt: new Date().toISOString()
  });

  // In a real implementation, send email here
  logger.info(`Password reset requested for: ${email}`);

  res.json({
    success: true,
    message: 'If the email exists, a password reset link has been sent'
  });
}));

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password using reset token
 * @access Public
 */
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Token and new password are required'
    });
  }

  // Find valid reset token
  const resetRecord = await db('password_resets')
    .where('token', token)
    .where('expiresAt', '>', new Date())
    .first();

  if (!resetRecord) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired reset token'
    });
  }

  // Hash new password
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  // Update user password
  await db('users')
    .where('id', resetRecord.userId)
    .update({
      password: hashedPassword,
      updatedAt: new Date().toISOString()
    });

  // Remove used reset token
  await db('password_resets')
    .where('token', token)
    .delete();

  // Remove all existing refresh tokens for security
  await db('refresh_tokens')
    .where('userId', resetRecord.userId)
    .delete();

  logger.info(`Password reset completed for user: ${resetRecord.userId}`);

  res.json({
    success: true,
    message: 'Password reset successful'
  });
}));

module.exports = router;