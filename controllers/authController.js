// authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const pool = require('../config/db');

/**
 * =========================
 * Helper Functions
 * =========================
 */

// Hash a plain text password
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

// Compare password with hash
const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// Generate JWT token
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '99y' }
  );
};

/**
 * =========================
 * Register a new user
 * =========================
 */
const register = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { username, email, password, full_name, phone, role } = req.body;

    // Check if username/email exists
    const exists = await pool.query(
      'SELECT 1 FROM users WHERE username=$1 OR email=$2',
      [username, email]
    );
    if (exists.rows.length)
      return res.status(400).json({ error: 'Username or email already exists' });

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert user into DB
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, username, email, full_name, phone, role, created_at`,
      [username, email, passwordHash, full_name, phone || null, role || 'landlord']
    );

    const user = result.rows[0];

    // Generate JWT
    const token = generateToken(user.user_id, user.role);

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
    res.status(500).json({ error: 'Registration failed. Please try again later.' });
  }
};

/**
 * =========================
 * Login user
 * =========================
 */
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { username, password } = req.body;

    // Find user by username/email
    const result = await pool.query(
      'SELECT user_id, username, email, password_hash, role, is_active FROM users WHERE username=$1 OR email=$1',
      [username]
    );

    if (!result.rows.length)
      return res.status(401).json({ error: 'Invalid username or password' });

    const user = result.rows[0];

    // Check if account is active
    if (!user.is_active)
      return res.status(403).json({ error: 'Account is deactivated. Contact support.' });

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: 'Invalid username or password' });

    // Generate JWT
    const token = generateToken(user.user_id, user.role);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again later.' });
  }
};

/**
 * =========================
 * Get Current Logged-in User
 * =========================
 */
const getCurrentUser = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, username, email, full_name, phone, role, is_active, created_at, updated_at FROM users WHERE user_id=$1',
      [req.user.user_id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

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
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to retrieve user data' });
  }
};

/**
 * =========================
 * Change Password
 * =========================
 */
const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { currentPassword, newPassword } = req.body;

    if (currentPassword === newPassword)
      return res.status(400).json({ error: 'New password must differ from current password' });

    const result = await pool.query(
      'SELECT password_hash FROM users WHERE user_id=$1',
      [req.user.user_id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

    const user = result.rows[0];
    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await hashPassword(newPassword);
    await pool.query(
      'UPDATE users SET password_hash=$1, updated_at=CURRENT_TIMESTAMP WHERE user_id=$2',
      [newHash, req.user.user_id]
    );

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password. Please try again later.' });
  }
};

/**
 * =========================
 * Update Profile
 * =========================
 */
const updateProfile = async (req, res) => {
  try {
    const { full_name, phone } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (full_name !== undefined) {
      updates.push(`full_name=$${paramCount}`);
      values.push(full_name);
      paramCount++;
    }
    if (phone !== undefined) {
      updates.push(`phone=$${paramCount}`);
      values.push(phone);
      paramCount++;
    }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    updates.push(`updated_at=CURRENT_TIMESTAMP`);
    values.push(req.user.user_id);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE user_id=$${paramCount} RETURNING user_id, username, email, full_name, phone, role, updated_at`;

    const result = await pool.query(query, values);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

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
    res.status(500).json({ error: 'Failed to update profile. Please try again later.' });
  }
};

/**
 * =========================
 * Logout
 * =========================
 */
const logout = (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful. Remove your token from client storage.'
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
