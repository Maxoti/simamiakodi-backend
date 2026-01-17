const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user info to request object
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authMiddleware = async (req, res, next) => {
  try {
    // DEVELOPMENT BYPASS - Remove this in production!
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      console.log(' AUTH BYPASS ACTIVE - Development Mode');
      
      // Mock user object for development
      req.user = {
        user_id: 1,
        username: 'dev_user',
        email: 'dev@test.com',
        role: 'admin', // Change to 'landlord' or 'tenant' as needed
        full_name: 'Development User'
      };
      
      return next();
    }

    // Get token from Authorization header
    // Expected format: "Bearer <token>"
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.' 
      });
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. Invalid token format.' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists in database and is active
    const result = await pool.query(
      'SELECT user_id, username, email, role, is_active, full_name FROM users WHERE user_id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'User not found. Token is invalid.' 
      });
    }

    const user = result.rows[0];

    // Check if account is still active
    if (!user.is_active) {
      return res.status(403).json({ 
        error: 'Account has been deactivated. Please contact support.' 
      });
    }

    // Attach user info to request object for use in route handlers
    req.user = {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role,
      full_name: user.full_name
    };

    // Proceed to next middleware or route handler
    next();

  } catch (err) {
    // Handle specific JWT errors
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token. Authentication failed.' 
      });
    }
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token has expired. Please login again.' 
      });
    }

    // Handle database or other errors
    console.error('Authentication middleware error:', err);
    return res.status(500).json({ 
      error: 'Authentication failed due to server error.' 
    });
  }
};

/**
 * Role-Based Authorization Middleware
 * Restricts access to routes based on user roles
 * 
 * @param {...string} roles - Allowed roles (e.g., 'admin', 'landlord', 'tenant')
 * @returns {Function} Middleware function
 * 
 * @example
 * // Only admins can access
 * router.get('/admin/users', authMiddleware, authorize('admin'), getUsers);
 * 
 * // Admins and landlords can access
 * router.post('/properties', authMiddleware, authorize('admin', 'landlord'), createProperty);
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // DEVELOPMENT BYPASS - Skip role checks in dev mode
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      console.log(`  ROLE CHECK BYPASSED - Required: [${roles.join(', ')}]`);
      return next();
    }

    // Check if user object exists (should be set by authMiddleware)
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required.' 
      });
    }

    // Check if user's role is in the allowed roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Access denied. This resource requires one of the following roles: ${roles.join(', ')}`,
        requiredRoles: roles,
        userRole: req.user.role
      });
    }

    // User has required role, proceed
    next();
  };
};

/**
 * Optional Authentication Middleware
 * Attaches user info if token is present, but doesn't require it
 * Useful for routes that have different behavior for authenticated/unauthenticated users
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const optionalAuth = async (req, res, next) => {
  try {
    // DEVELOPMENT BYPASS
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      req.user = {
        user_id: 1,
        username: 'dev_user',
        email: 'dev@test.com',
        role: 'admin',
        full_name: 'Development User'
      };
      return next();
    }

    const authHeader = req.headers.authorization;
    
    // If no token, just continue without user info
    if (!authHeader) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      req.user = null;
      return next();
    }

    // Try to verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pool.query(
      'SELECT user_id, username, email, role, is_active, full_name FROM users WHERE user_id = $1',
      [decoded.userId]
    );

    if (result.rows.length > 0 && result.rows[0].is_active) {
      req.user = {
        user_id: result.rows[0].user_id,
        username: result.rows[0].username,
        email: result.rows[0].email,
        role: result.rows[0].role,
        full_name: result.rows[0].full_name
      };
    } else {
      req.user = null;
    }

    next();

  } catch (err) {
    // If token is invalid, just continue without user info (don't throw error)
    req.user = null;
    next();
  }
};

module.exports = {
  authMiddleware,
  authorize,
  optionalAuth
};