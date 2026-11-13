const express = require('express');
const bcrypt = require('bcryptjs');
const { authMiddleware, generateToken, generateRefreshToken, verifyRefreshToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../../config/database');
const logger = require('../utils/logger');
/*
  Ids come from node:crypto, via the same helper the other routers use.

  These call sites each inlined the uuid package's v4 generator, required
  lazily inside the handler. Dependabot then moved uuid 9.0.1 to 14.0.3, which is
  "type": "module" with no require export — so `require('uuid')` only still
  works here because Node 22 can require an ES module. On an older Node, and
  under Jest, it throws at request time, which is why register, refresh and
  password reset returned 500 while the server itself started cleanly.

  randomUUID is built in, is the same v4 shape, and cannot be bumped out from
  under the handler.
*/
const { newId } = require('./_helpers');

const router = express.Router();

/**
 * Column names, and why they all changed at once.
 *
 * Every database access in this file addressed its columns in camelCase -
 * `companyId`, `emailVerified`, `createdAt`, `userId`, `expiresAt` - while the
 * migration creates them in snake_case. So register, login, refresh, profile
 * update, email verification and both halves of password reset all threw "no
 * such column" on their first query. Only `GET /me` worked, because it was the
 * one handler written against the real schema, and it was also the only one
 * with a test.
 *
 * The JSON the endpoints answer with keeps its camelCase keys: that is the API
 * contract clients are written against, and it is a reasonable one. Only the
 * column names moved.
 *
 * Instants are written and compared as ISO-8601 strings, explicitly.
 *
 * `expires_at` used to be handed a `Date` object while `created_at` beside it
 * got `.toISOString()`. The driver did not serialise the `Date`: the column
 * ended up holding the literal text "[object Object]", so
 * `where('expires_at', '>', now)` never matched and no refresh token or
 * password-reset token could ever be redeemed. Being explicit also keeps the
 * comparison portable - ISO-8601 sorts lexicographically in the order it sorts
 * chronologically, on SQLite and Postgres alike.
 */

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
        id: newId(),
        name: companyName,
        created_at: new Date().toISOString()
      };
      await db('companies').insert(company);
    }
  }

  // Create user
  const user = {
    id: newId(),
    name,
    email,
    password: hashedPassword,
    role,
    company_id: company ? company.id : null,
    status: 'active',
    email_verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await db('users').insert(user);

  // Generate tokens
  const accessToken = generateToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);

  // Save refresh token
  await db('refresh_tokens').insert({
    id: newId(),
    user_id: user.id,
    token: refreshToken,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    created_at: new Date().toISOString()
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
        companyId: user.company_id
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
    .select('id', 'name', 'email', 'password', 'role', 'company_id', 'status')
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
    id: newId(),
    user_id: user.id,
    token: refreshToken,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    created_at: new Date().toISOString()
  });

  // Update last login
  await db('users')
    .where('id', user.id)
    .update({
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
        companyId: user.company_id
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
      .where('user_id', decoded.userId)
      .where('expires_at', '>', new Date().toISOString())
      .first();

    if (!tokenRecord) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Get user
    const user = await db('users')
      .select('id', 'name', 'email', 'role', 'company_id', 'status')
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
          companyId: user.company_id
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
router.post('/logout', authMiddleware, asyncHandler(async (req, res) => {
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
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
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
    .where('company_id', user.company_id || null)
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
router.put('/profile', authMiddleware, asyncHandler(async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body;
  const user = req.user;

  const updateData = {
    updated_at: new Date().toISOString()
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
    updateData.email_verified = false; // Reset email verification
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
    .select('id', 'name', 'email', 'role', 'company_id')
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
      email_verified: true,
      updated_at: new Date().toISOString()
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
  const resetToken = newId();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  // Save reset token
  await db('password_resets').insert({
    id: newId(),
    user_id: user.id,
    token: resetToken,
    expires_at: expiresAt,
    created_at: new Date().toISOString()
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
    .where('expires_at', '>', new Date().toISOString())
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
    .where('id', resetRecord.user_id)
    .update({
      password: hashedPassword,
      updated_at: new Date().toISOString()
    });

  // Remove used reset token
  await db('password_resets')
    .where('token', token)
    .delete();

  // Remove all existing refresh tokens for security
  await db('refresh_tokens')
    .where('user_id', resetRecord.user_id)
    .delete();

  logger.info(`Password reset completed for user: ${resetRecord.user_id}`);

  res.json({
    success: true,
    message: 'Password reset successful'
  });
}));

module.exports = router;