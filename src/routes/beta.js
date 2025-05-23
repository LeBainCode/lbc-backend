// routes/beta.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');
const { checkRole } = require('../middleware/checkRoleAccess');

/**
 * @swagger
 * tags:
 *   name: Beta
 *   description: Beta access management endpoints
 */

/**
 * @swagger
 * /api/beta/apply:
 *   post:
 *     summary: Submit an application for beta access
 *     tags: [Beta]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - occupation
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Applicant email address
 *               occupation:
 *                 type: string
 *                 description: Applicant's occupation
 *               discordId:
 *                 type: string
 *                 description: Applicant's Discord ID (optional)
 *               reason:
 *                 type: string
 *                 description: Reason for requesting beta access
 *     responses:
 *       200:
 *         description: Beta application submitted successfully
 *       400:
 *         description: Invalid application data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/apply', verifyToken, async (req, res) => {
  try {
    const { email, occupation, discordId, reason } = req.body;
    
    if (!email || !occupation) {
      return res.status(400).json({
        success: false,
        message: 'Email and occupation are required'
      });
    }
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user already has beta access
    if (user.role === 'beta' || user.betaAccess.isEnabled) {
      return res.status(400).json({
        success: false,
        message: 'You already have beta access'
      });
    }
    
    // Check if user already has a pending application
    if (user.betaAccess.application && user.betaAccess.application.submittedAt) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending beta application'
      });
    }
    
    // Save the beta application
    user.betaAccess.application = {
      email,
      occupation,
      discordId: discordId || '',
      reason: reason || '',
      submittedAt: new Date()
    };
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Beta access application submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting beta application:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting beta application'
    });
  }
});

/**
 * @swagger
 * /api/beta/application/status:
 *   get:
 *     summary: Check status of user's beta application
 *     tags: [Beta]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Beta application status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 hasBetaAccess:
 *                   type: boolean
 *                 hasApplied:
 *                   type: boolean
 *                 application:
 *                   type: object
 *                   properties:
 *                     submittedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/application/status', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      hasBetaAccess: user.role === 'beta',
      hasApplied: !!(user.betaAccess.application && user.betaAccess.application.submittedAt),
      application: user.betaAccess.application || {},
      betaAccessGranted: user.betaAccess.isEnabled,
      betaAccessGrantedAt: user.betaAccess.enabledAt
    });
  } catch (error) {
    console.error('Error checking beta application status:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking beta application status'
    });
  }
});

/**
 * @swagger
 * /api/beta/applications:
 *   get:
 *     summary: Get all beta applications (admin only)
 *     tags: [Beta]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of beta applications
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get('/applications', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const applications = await User.find({
      'betaAccess.application.submittedAt': { $exists: true },
      'role': 'user'
    }).select('username email betaAccess.application createdAt');
    
    res.status(200).json({
      success: true,
      applications
    });
  } catch (error) {
    console.error('Error fetching beta applications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching beta applications'
    });
  }
});

/**
 * @swagger
 * /api/beta/approve/{userId}:
 *   post:
 *     summary: Approve beta access for a user (admin only)
 *     tags: [Beta]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to approve
 *     responses:
 *       200:
 *         description: Beta access granted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/approve/:userId', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Set beta access fields
    user.role = 'beta';
    user.betaAccess.isEnabled = true;
    user.betaAccess.enabledAt = new Date();
    user.betaAccess.enabledBy = req.user._id;
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Beta access granted successfully',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        betaAccess: user.betaAccess
      }
    });
  } catch (error) {
    console.error('Error approving beta access:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving beta access'
    });
  }
});

/**
 * @swagger
 * /api/beta/revoke/{userId}:
 *   post:
 *     summary: Revoke beta access from a user (admin only)
 *     tags: [Beta]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to revoke beta access from
 *     responses:
 *       200:
 *         description: Beta access revoked
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/revoke/:userId', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Remove beta access
    user.role = 'user';
    user.betaAccess.isEnabled = false;
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Beta access revoked successfully',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error revoking beta access:', error);
    res.status(500).json({
      success: false,
      message: 'Error revoking beta access'
    });
  }
});

/**
 * @swagger
 * /api/beta/users:
 *   get:
 *     summary: Get all beta users (admin only)
 *     tags: [Beta]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of beta users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get('/users', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const betaUsers = await User.find({ role: 'beta' })
      .select('username email betaAccess createdAt');
    
    res.status(200).json({
      success: true,
      count: betaUsers.length,
      users: betaUsers
    });
  } catch (error) {
    console.error('Error fetching beta users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching beta users'
    });
  }
});

module.exports = router;
