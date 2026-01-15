const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const pool = require('../config/db');

/**
 * Generate JWT Token
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '99y' }
  );
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
const register = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }

    const { username, email, password, full_name, phone, role } = req.body;

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT user_id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Username or email already exists' 
      });
    }

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert new user into database
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, username, email, full_name, phone, role, created_at`,
      [username, email, passwordHash, full_name, phone || null, role || 'landlord']
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = generateToken(user.user_id, user.role);

    // Return success response
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        createdAt: user.created_at
      }
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ 
      error: 'Registration failed. Please try again later.' 
    });
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Login user and return JWT token
 * @access  Public
 */
const login = async (req, res) => {
  try {
    console.log('=== LOGIN ATTEMPT ===');
    console.log('Request body:', { username: req.body.username, passwordLength: req.body.password?.length });

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }

    const { username, password } = req.body;

    // Find user by username or email
    console.log('Searching for user:', username);
    const result = await pool.query(
      `SELECT user_id, username, email, password_hash, full_name, phone, role, is_active
       FROM users 
       WHERE username = $1 OR email = $1`,
      [username]
    );

    console.log('Users found:', result.rows.length);

    if (result.rows.length === 0) {
      console.log('❌ User not found in database');
      return res.status(401).json({ 
        error: 'Invalid username or password' 
      });
    }

    const user = result.rows[0];
    console.log('User found:', { 
      userId: user.user_id, 
      username: user.username, 
      email: user.email,
      role: user.role,
      isActive: user.is_active 
    });

    // Check if account is active
    if (!user.is_active) {
      console.log('❌ Account is deactivated');
      return res.status(403).json({ 
        error: 'Your account has been deactivated. Please contact support.' 
      });
    }

    // Verify password
    console.log('Verifying password...');
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log('Password valid:', isValidPassword);

    if (!isValidPassword) {
      console.log('❌ Invalid password');
      return res.status(401).json({ 
        error: 'Invalid username or password' 
      });
    }

    // Generate JWT token
    console.log('Generating JWT token...');
    const token = generateToken(user.user_id, user.role);
    console.log('✅ Login successful');

    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role
      }
    });

  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ 
      error: 'Login failed. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged-in user
 * @access  Private
 */
const getCurrentUser = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT user_id, username, email, full_name, phone, role, is_active, created_at, updated_at
       FROM users 
       WHERE user_id = $1`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      user: {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });

  } catch (err) {
    console.error('Get current user error:', err);
    res.status(500).json({ 
      error: 'Failed to retrieve user data' 
    });
  }
};

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (currentPassword === newPassword) {
      return res.status(400).json({ 
        error: 'New password must be different from current password' 
      });
    }

    const result = await pool.query(
      'SELECT password_hash FROM users WHERE user_id = $1',
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    const user = result.rows[0];

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ 
        error: 'Current password is incorrect' 
      });
    }

    const salt = await bcrypt.genSalt(12);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [newPasswordHash, req.user.user_id]
    );

    res.json({ 
      success: true,
      message: 'Password changed successfully' 
    });

  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ 
      error: 'Failed to change password. Please try again later.' 
    });
  }
};

/**
 * @route   PUT /api/auth/update-profile
 * @desc    Update user profile information
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const { full_name, phone } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (full_name !== undefined) {
      updates.push(`full_name = $${paramCount}`);
      values.push(full_name);
      paramCount++;
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramCount}`);
      values.push(phone);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        error: 'No fields to update' 
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.user.user_id);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE user_id = $${paramCount}
      RETURNING user_id, username, email, full_name, phone, role, updated_at
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        updatedAt: user.updated_at
      }
    });

  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ 
      error: 'Failed to update profile. Please try again later.' 
    });
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
const logout = (req, res) => {
  res.json({ 
    success: true,
    message: 'Logout successful. Please remove your token from client storage.' 
  });
};

module.exports = {
  register,
  login,
  getCurrentUser,
  changePassword,
  updateProfile,
  logout
};