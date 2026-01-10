const express = require('express');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const {
  register,
  login,
  getCurrentUser,
  changePassword,
  logout
} = require('../controllers/authController');

const {
  forgotPassword,
  resetPassword,
  verifyResetToken
} = require('../controllers/forgotPasswordController');

const router = express.Router();

// ============================================
// VALIDATION RULES
// ============================================

/**
 * Custom validator for username - accepts alphanumeric or email format
 */
const validateUsername = (value) => {
  const isAlphanumeric = /^[a-zA-Z0-9_-]+$/.test(value);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  
  if (!isAlphanumeric && !isEmail) {
    throw new Error('Username must be alphanumeric with underscores/hyphens, or a valid email');
  }
  return true;
};

/**
 * Custom validator for strong password
 */
const validateStrongPassword = (value) => {
  const hasUpperCase = /[A-Z]/.test(value);
  const hasLowerCase = /[a-z]/.test(value);
  const hasNumber = /\d/.test(value);
  
  if (!hasUpperCase || !hasLowerCase || !hasNumber) {
    throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
  }
  return true;
};

/**
 * Registration validation rules
 */
const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Username must be between 3 and 100 characters')
    .custom(validateUsername),
  
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email is too long'),
  
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .custom(validateStrongPassword),
  
  body('full_name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 255 })
    .withMessage('Full name must be between 2 and 255 characters'),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9+\-() ]+$/)
    .withMessage('Invalid phone number format')
    .isLength({ max: 20 })
    .withMessage('Phone number is too long'),
  
  body('role')
    .optional()
    .isIn(['landlord', 'tenant', 'admin'])
    .withMessage('Role must be landlord, tenant, or admin')
];

/**
 * Login validation rules
 */
const loginValidation = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username or email is required'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * Change password validation rules
 */
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .custom(validateStrongPassword)
];

/**
 * Forgot password validation rules
 */
const forgotPasswordValidation = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];

/**
 * Reset password validation rules
 */
const resetPasswordValidation = [
  body('token')
    .trim()
    .notEmpty()
    .withMessage('Reset token is required'),
  
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .custom(validateStrongPassword)
];

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', registerValidation, register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and return JWT token
 * @access  Public
 */
router.post('/login', loginValidation, login);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post('/forgot-password', forgotPasswordValidation, forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using token
 * @access  Public
 */
router.post('/reset-password', resetPasswordValidation, resetPassword);

/**
 * @route   GET /api/auth/verify-reset-token
 * @desc    Verify if reset token is valid
 * @access  Public
 */
router.get('/verify-reset-token', verifyResetToken);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged-in user
 * @access  Private
 */
router.get('/me', authMiddleware, getCurrentUser);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password', authMiddleware, changePasswordValidation, changePassword);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
router.post('/logout', authMiddleware, logout);

module.exports = router;