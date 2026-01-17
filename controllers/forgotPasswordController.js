const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { sendMail } = require('../config/email');

/**
 * Send password reset email
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    console.log('📧 Password reset requested for:', email);
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user exists
    const userQuery = 'SELECT user_id, username, email, full_name FROM users WHERE email = $1';
    const userResult = await pool.query(userQuery, [email]);
    
    // Always return success (don't reveal if email exists - security)
    if (userResult.rows.length === 0) {
      console.log('⚠️ Email not found:', email);
      return res.status(200).json({ 
        message: 'If that email exists, a reset link has been sent' 
      });
    }
    
    const user = userResult.rows[0];
    console.log('✅ User found:', user.username);
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
    
    // Save token to database
    const updateQuery = `
      UPDATE users 
      SET reset_token = $1, reset_token_expiry = $2, updated_at = NOW()
      WHERE user_id = $3
    `;
    await pool.query(updateQuery, [resetTokenHash, resetTokenExpiry, user.user_id]);
    console.log('💾 Reset token saved to database');
    
    // Create reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
    const resetUrl = `${frontendUrl}/pages/auth/reset-password.html?token=${resetToken}`;
    
    console.log('🔗 Reset URL:', resetUrl);
    
    // Email options
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: email,
      subject: 'Password Reset Request - SimamiaKodi',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #198754 0%, #20c997 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">🏠 SimamiaKodi</h1>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa;">
            <h2 style="color: #212529;">Password Reset Request</h2>
            
            <p>Hello <strong>${user.full_name || user.username}</strong>,</p>
            
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: #198754; 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        display: inline-block;
                        font-weight: bold;">
                Reset Password
              </a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: white; padding: 15px; border-radius: 5px; border: 1px solid #dee2e6;">
              ${resetUrl}
            </p>
            
            <p style="color: #dc3545; font-weight: bold; background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
              ⚠️ This link will expire in 1 hour for security reasons.
            </p>
            
            <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
            
            <p style="color: #6c757d; font-size: 0.9em;">
              Best regards,<br>
              The SimamiaKodi Team
            </p>
          </div>
          
          <div style="background: #212529; padding: 20px; text-align: center; color: white; font-size: 0.85em;">
            <p style="margin: 0;">© 2026 SimamiaKodi. All rights reserved.</p>
          </div>
        </div>
      `
    };
    
    console.log('📤 Attempting to send email...');
    
    // Send email using sendMail function
    const info = await sendMail(mailOptions);
    
    console.log('✅ Password reset email sent successfully');
    console.log('📧 Message ID:', info);
    
    res.status(200).json({ 
      message: 'Password reset email sent successfully' 
    });
    
  } catch (error) {
    console.error('❌ Forgot password error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ 
      error: 'Failed to send reset email',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Reset password using token
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    console.log('🔄 Password reset attempt with token');
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    // Hash the token
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // Find user with valid token
    const userQuery = `
      SELECT user_id, username, email, full_name 
      FROM users 
      WHERE reset_token = $1 
      AND reset_token_expiry > NOW()
    `;
    const userResult = await pool.query(userQuery, [resetTokenHash]);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Invalid or expired token');
      return res.status(400).json({ 
        error: 'Invalid or expired reset token' 
      });
    }
    
    const user = userResult.rows[0];
    console.log('✅ Valid token for user:', user.username);
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password and clear token
    const updateQuery = `
      UPDATE users 
      SET password_hash = $1, 
          reset_token = NULL, 
          reset_token_expiry = NULL,
          updated_at = NOW()
      WHERE user_id = $2
    `;
    await pool.query(updateQuery, [hashedPassword, user.user_id]);
    console.log('✅ Password updated successfully');
    
    // Send confirmation email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: user.email,
      subject: 'Password Changed Successfully - SimamiaKodi',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #198754 0%, #20c997 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;"> SimamiaKodi</h1>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa;">
            <h2 style="color: #198754;">✅ Password Changed Successfully</h2>
            
            <p>Hello <strong>${user.full_name || user.username}</strong>,</p>
            
            <p>Your password has been successfully changed. You can now log in with your new password.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${frontendUrl}/pages/auth/login.html" 
                 style="background: #198754; 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        display: inline-block;
                        font-weight: bold;">
                Go to Login
              </a>
            </div>
            
            <p style="color: #dc3545; background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
              ⚠️ If you didn't make this change, please contact support immediately at support@simamiakodi.com
            </p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
            
            <p style="color: #6c757d; font-size: 0.9em;">
              Best regards,<br>
              The SimamiaKodi Team
            </p>
          </div>
        </div>
      `
    };
    
    await sendMail(mailOptions);
    console.log('Confirmation email sent');
    
    res.status(200).json({ 
      message: 'Password reset successful' 
    });
    
  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

/**
 * Verify if reset token is valid
 */
exports.verifyResetToken = async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const query = `
      SELECT user_id 
      FROM users 
      WHERE reset_token = $1 
      AND reset_token_expiry > NOW()
    `;
    const result = await pool.query(query, [resetTokenHash]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Invalid or expired token' 
      });
    }
    
    res.status(200).json({ valid: true });
    
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
};