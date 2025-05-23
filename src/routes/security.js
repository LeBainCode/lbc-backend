// routes/security.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');
const { checkRole } = require('../middleware/checkRoleAccess');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * @swagger
 * tags:
 *   name: Security
 *   description: Endpoints for managing application security
 */

/**
 * @swagger
 * /api/security/password/change:
 *   post:
 *     summary: Change user's password (for admin accounts)
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: User's current password
 *               newPassword:
 *                 type: string
 *                 description: User's new password
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid password
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/password/change', verifyToken, async (req, res) => {
  try {
    // This endpoint is only for admin accounts with passwords
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin accounts can change passwords'
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Password complexity validation
    if (newPassword.length < 12) {
      return res.status(400).json({
        success: false, 
        message: 'New password must be at least 12 characters long'
      });
    }

    if (!/[A-Z]/.test(newPassword) || 
        !/[a-z]/.test(newPassword) || 
        !/[0-9]/.test(newPassword) || 
        !/[^A-Za-z0-9]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'New password must include uppercase, lowercase, number, and special character'
      });
    }

    const user = await User.findById(req.user._id);
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update password
    user.password = hashedPassword;
    user.security = user.security || {};
    user.security.passwordLastChanged = new Date();
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password'
    });
  }
});

/**
 * @swagger
 * /api/security/sessions/active:
 *   get:
 *     summary: Get list of active sessions for the current user
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active sessions retrieved
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/sessions/active', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Return login history
    const activeSessions = user.security?.loginHistory?.slice(-10) || [];
    
    res.status(200).json({
      success: true,
      sessions: activeSessions.map(session => ({
        timestamp: session.timestamp,
        ip: session.ip,
        userAgent: session.userAgent,
        location: session.location // If you track geographic location
      }))
    });
  } catch (error) {
    console.error('Error retrieving active sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving active sessions'
    });
  }
});

/**
 * @swagger
 * /api/security/sessions/terminate-all:
 *   post:
 *     summary: Terminate all active sessions except the current one
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All other sessions terminated
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/sessions/terminate-all', verifyToken, async (req, res) => {
  try {
    // Log current session out of all devices except this one
    // This could involve:
    // 1. Updating a tokenVersion field on the user model
    // 2. Only accepting tokens with matching version
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Increment token version to invalidate all existing tokens
    user.security = user.security || {};
    user.security.tokenVersion = (user.security.tokenVersion || 0) + 1;
    user.security.tokenVersionUpdatedAt = new Date();
    
    // Keep only the current session in history
    const currentSession = {
      timestamp: new Date(),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      isCurrent: true
    };
    
    user.security.loginHistory = [currentSession];
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'All other sessions terminated successfully'
    });
  } catch (error) {
    console.error('Error terminating sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error terminating sessions'
    });
  }
});

/**
 * @swagger
 * /api/security/account/activity:
 *   get:
 *     summary: Get recent account activity
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account activity retrieved
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/account/activity', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Compile recent activity
    const activity = [];
    
    // Login activity
    if (user.security?.loginHistory) {
      user.security.loginHistory.slice(-5).forEach(login => {
        activity.push({
          type: 'login',
          timestamp: login.timestamp,
          details: { ip: login.ip, userAgent: login.userAgent }
        });
      });
    }
    
    // Password changes
    if (user.security?.passwordLastChanged) {
      activity.push({
        type: 'password_change',
        timestamp: user.security.passwordLastChanged,
        details: {}
      });
    }
    
    // Beta application
    if (user.betaAccess?.application?.submittedAt) {
      activity.push({
        type: 'beta_application',
        timestamp: user.betaAccess.application.submittedAt,
        details: {}
      });
    }
    
    // Beta approval
    if (user.betaAccess?.enabledAt) {
      activity.push({
        type: 'beta_approval',
        timestamp: user.betaAccess.enabledAt,
        details: {}
      });
    }
    
    // Sort by most recent first
    activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.status(200).json({
      success: true,
      activity
    });
  } catch (error) {
    console.error('Error retrieving account activity:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving account activity'
    });
  }
});

/**
 * @swagger
 * /api/security/account/security-score:
 *   get:
 *     summary: Get account security score and recommendations
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Security score retrieved
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/account/security-score', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Calculate security score (0-100)
    let score = 50; // Base score
    const recommendations = [];
    
    // Check if admin has strong password
    if (user.role === 'admin') {
      if (!user.password || user.password.length < 12) {
        score -= 15;
        recommendations.push('Set a strong password that is at least 12 characters long');
      } else {
        score += 10;
      }
    }
    
    // Check email verification
    if (!user.email) {
      score -= 15;
      recommendations.push('Add a verified email address to your account');
    } else {
      score += 10;
    }
    
    // Check recent logins
    if (!user.security?.loginHistory || user.security.loginHistory.length === 0) {
      score -= 5;
      recommendations.push('No login history found');
    }
    
    // Adjust based on GitHub integration
    if (user.githubId) {
      score += 10;
    } else {
      recommendations.push('Connect your GitHub account for additional security');
    }
    
    // Cap score between 0-100
    score = Math.min(100, Math.max(0, score));
    
    res.status(200).json({
      success: true,
      securityScore: score,
      recommendations,
      level: score >= 80 ? 'strong' : score >= 60 ? 'good' : 'needs-improvement'
    });
  } catch (error) {
    console.error('Error calculating security score:', error);
    res.status(500).json({
      success: false, 
      message: 'Error calculating security score'
    });
  }
});

/**
 * @swagger
 * /api/security/audit-logs:
 *   get:
 *     summary: Get security audit logs (admin only)
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Audit logs retrieved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get('/audit-logs', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    // This would connect to your audit log collection/system
    // For now, we'll return a placeholder
    
    res.status(200).json({
      success: true,
      auditLogs: [
        {
          action: 'user_login',
          userId: '123456789012',
          performedBy: '123456789012',
          timestamp: new Date(),
          ip: '192.168.1.1',
          details: { userAgent: 'Mozilla/5.0...' }
        },
        {
          action: 'beta_access_granted',
          userId: '234567890123',
          performedBy: '123456789012',
          timestamp: new Date(Date.now() - 86400000), // 1 day ago
          ip: '192.168.1.1',
          details: { reason: 'Application approved' }
        }
      ]
    });
  } catch (error) {
    console.error('Error retrieving audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving audit logs'
    });
  }
});

// Helper function to validate IP address or CIDR notation
function isValidIpOrCidr(input) {
  // Basic regex for IPv4 address or CIDR
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
  if (!ipv4Regex.test(input)) {
    return false;
  }
  
  // Validate each octet
  const parts = input.split('/')[0].split('.');
  for (let part of parts) {
    if (parseInt(part) > 255) {
      return false;
    }
  }
  
  // If CIDR, validate prefix length
  if (input.includes('/')) {
    const prefix = parseInt(input.split('/')[1]);
    if (prefix < 0 || prefix > 32) {
      return false;
    }
  }
  
  return true;
}

module.exports = router;
