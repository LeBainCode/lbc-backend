// routes/beta.js - Complete beta management with unique application IDs
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');
const { checkRole } = require('../middleware/checkRoleAccess');
const mongoose = require('mongoose');

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 applicationId:
 *                   type: string
 *                   description: Unique application ID for tracking
 *                 statusCheckUrl:
 *                   type: string
 *                   description: URL to check application status
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
        message: 'You already have a pending beta application',
        existingApplicationId: user.betaAccess.application.applicationId,
        statusCheckUrl: `/api/beta/application/status/${user.betaAccess.application.applicationId}`
      });
    }
    
    // Generate unique application ID
    const applicationId = new mongoose.Types.ObjectId().toString();
    
    // Save the beta application
    user.betaAccess.application = {
      applicationId,
      email,
      occupation,
      discordId: discordId || '',
      reason: reason || '',
      submittedAt: new Date(),
      status: 'pending'
    };
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Beta access application submitted successfully',
      applicationId,
      statusCheckUrl: `/api/beta/application/status/${applicationId}`
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
 * /api/beta/application/my-status:
 *   get:
 *     summary: Get current user's beta application status
 *     tags: [Beta]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's beta application status
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
 *                     applicationId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [pending, approved, rejected]
 *                     submittedAt:
 *                       type: string
 *                       format: date-time
 *                     reviewedAt:
 *                       type: string
 *                       format: date-time
 *                     rejectionReason:
 *                       type: string
 *                     adminComment:
 *                       type: string
 *                     details:
 *                       type: object
 *                       properties:
 *                         email:
 *                           type: string
 *                         occupation:
 *                           type: string
 *                         discordId:
 *                           type: string
 *                         reason:
 *                           type: string
 *                 timeline:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       event:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                       description:
 *                         type: string
 *                 nextSteps:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No application found
 *       500:
 *         description: Server error
 */
router.get('/application/my-status', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if application exists
    if (!user.betaAccess.application || !user.betaAccess.application.submittedAt) {
      return res.status(200).json({
        success: true,
        hasBetaAccess: user.role === 'beta' || user.betaAccess.isEnabled,
        hasApplied: false,
        message: 'No beta application found. You can submit an application.',
        canApply: true,
        applyUrl: '/api/beta/apply'
      });
    }
    
    // Build application data
    const application = {
      applicationId: user.betaAccess.application.applicationId,
      status: user.betaAccess.application.status || 'pending',
      submittedAt: user.betaAccess.application.submittedAt,
      reviewedAt: user.betaAccess.application.reviewedAt || null,
      rejectionReason: user.betaAccess.application.rejectionReason || null,
      adminComment: user.betaAccess.application.adminComment || null,
      details: {
        email: user.betaAccess.application.email,
        occupation: user.betaAccess.application.occupation,
        discordId: user.betaAccess.application.discordId,
        reason: user.betaAccess.application.reason
      }
    };
    
    // Build timeline
    const timeline = [];
    
    timeline.push({
      event: 'Application Submitted',
      timestamp: user.betaAccess.application.submittedAt,
      status: 'completed',
      description: 'Your beta access application was submitted successfully'
    });
    
    if (user.betaAccess.application.reviewedAt) {
      timeline.push({
        event: user.betaAccess.application.status === 'approved' ? 'Application Approved' : 'Application Reviewed',
        timestamp: user.betaAccess.application.reviewedAt,
        status: 'completed',
        description: user.betaAccess.application.status === 'approved' 
          ? 'Your application has been approved!' 
          : 'Your application has been reviewed'
      });
    }
    
    if (user.betaAccess.enabledAt) {
      timeline.push({
        event: 'Beta Access Activated',
        timestamp: user.betaAccess.enabledAt,
        status: 'completed',
        description: 'Beta access has been activated on your account'
      });
    }
    
    if (user.betaAccess.revokedAt) {
      timeline.push({
        event: 'Beta Access Revoked',
        timestamp: user.betaAccess.revokedAt,
        status: 'completed',
        description: 'Beta access has been removed from your account'
      });
    }
    
    // Determine next steps
    let nextSteps = [];
    
    if (user.betaAccess.application.status === 'pending') {
      nextSteps.push('Your application is currently being reviewed by our team');
      nextSteps.push('You will receive a notification once a decision is made');
      nextSteps.push('Typical review time: 3-5 business days');
    } else if (user.betaAccess.application.status === 'approved' && !user.betaAccess.isEnabled) {
      nextSteps.push('🎉 Congratulations! Your application has been approved');
      nextSteps.push('Beta access is being activated on your account');
      nextSteps.push('You should have access within a few minutes');
    } else if (user.betaAccess.application.status === 'approved' && user.betaAccess.isEnabled) {
      nextSteps.push('✅ You have active beta access');
      nextSteps.push('You can now access beta features and modules');
      nextSteps.push('Thank you for being part of our beta program!');
    } else if (user.betaAccess.application.status === 'rejected') {
      nextSteps.push('Your application was not approved at this time');
      if (user.betaAccess.application.rejectionReason) {
        nextSteps.push(`Reason: ${user.betaAccess.application.rejectionReason}`);
      }
      nextSteps.push('You may reapply in the future as the program evolves');
    }
    
    // Calculate days since submission
    const daysSinceSubmission = Math.floor(
      (new Date() - new Date(user.betaAccess.application.submittedAt)) / (1000 * 60 * 60 * 24)
    );
    
    res.status(200).json({
      success: true,
      hasBetaAccess: user.role === 'beta' || user.betaAccess.isEnabled,
      hasApplied: true,
      application,
      timeline: timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
      nextSteps,
      summary: {
        daysSinceSubmission,
        currentStatus: user.betaAccess.application.status || 'pending',
        hasActiveBetaAccess: user.role === 'beta' || user.betaAccess.isEnabled,
        canReapply: user.betaAccess.application.status === 'rejected'
      }
    });
  } catch (error) {
    console.error('Error getting user application status:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving application status'
    });
  }
});

/**
 * @swagger
 * /api/beta/application/status/{applicationId}:
 *   get:
 *     summary: Get application status by application ID (admin can view any, users can view their own)
 *     tags: [Beta]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique application ID
 *     responses:
 *       200:
 *         description: Beta application status and details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - can only view own application or admin access required
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
router.get('/application/status/:applicationId', verifyToken, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const requestingUserId = req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    
    // Find the user with this application ID
    const user = await User.findOne({
      'betaAccess.application.applicationId': applicationId
    }).select('username email role betaAccess createdAt');
    
    if (!user || !user.betaAccess.application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    // Authorization: Admin can view any application, users can only view their own
    if (!isAdmin && user._id.toString() !== requestingUserId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own application status'
      });
    }
    
    // Build application data
    const applicationData = {
      applicationId: user.betaAccess.application.applicationId,
      userId: user._id,
      username: user.username,
      email: user.email,
      status: user.betaAccess.application.status || 'pending',
      submittedAt: user.betaAccess.application.submittedAt,
      reviewedAt: user.betaAccess.application.reviewedAt || null,
      reviewedBy: user.betaAccess.application.reviewedBy || null,
      rejectionReason: user.betaAccess.application.rejectionReason || null,
      adminComment: user.betaAccess.application.adminComment || null,
      details: {
        occupation: user.betaAccess.application.occupation,
        discordId: user.betaAccess.application.discordId,
        reason: user.betaAccess.application.reason,
        applicationEmail: user.betaAccess.application.email
      }
    };
    
    // Current access information
    const currentAccess = {
      role: user.role,
      hasBetaAccess: user.role === 'beta' || user.betaAccess.isEnabled,
      enabledAt: user.betaAccess.enabledAt || null,
      revokedAt: user.betaAccess.revokedAt || null
    };
    
    // Timeline
    const timeline = [];
    
    timeline.push({
      event: 'Application Submitted',
      timestamp: user.betaAccess.application.submittedAt,
      status: 'completed'
    });
    
    if (user.betaAccess.application.reviewedAt) {
      timeline.push({
        event: user.betaAccess.application.status === 'approved' ? 'Application Approved' : 'Application Reviewed',
        timestamp: user.betaAccess.application.reviewedAt,
        status: 'completed'
      });
    }
    
    if (user.betaAccess.enabledAt) {
      timeline.push({
        event: 'Beta Access Granted',
        timestamp: user.betaAccess.enabledAt,
        status: 'completed'
      });
    }
    
    if (user.betaAccess.revokedAt) {
      timeline.push({
        event: 'Beta Access Revoked',
        timestamp: user.betaAccess.revokedAt,
        status: 'completed'
      });
    }
    
    res.status(200).json({
      success: true,
      application: applicationData,
      currentAccess,
      timeline,
      // Add metadata for admins
      ...(isAdmin && {
        metadata: {
          userCreatedAt: user.createdAt,
          canApprove: user.betaAccess.application.status === 'pending',
          canReject: user.betaAccess.application.status === 'pending',
          canRevoke: user.betaAccess.isEnabled,
          userId: user._id
        }
      })
    });
  } catch (error) {
    console.error('Error fetching application status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching application status'
    });
  }
});

/**
 * @swagger
 * /api/beta/applications:
 *   get:
 *     summary: Get all beta applications with filtering (admin only)
 *     tags: [Beta]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, all]
 *           default: all
 *         description: Filter applications by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of applications per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [submittedAt, reviewedAt, status]
 *           default: submittedAt
 *         description: Sort applications by field
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [desc, asc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of beta applications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 applications:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       applicationId:
 *                         type: string
 *                       userId:
 *                         type: string
 *                       username:
 *                         type: string
 *                       email:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [pending, approved, rejected]
 *                       submittedAt:
 *                         type: string
 *                         format: date-time
 *                       reviewedAt:
 *                         type: string
 *                         format: date-time
 *                       details:
 *                         type: object
 *                       statusUrl:
 *                         type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalCount:
 *                       type: integer
 *                     hasNextPage:
 *                       type: boolean
 *                     hasPrevPage:
 *                       type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalApplications:
 *                       type: integer
 *                     pendingCount:
 *                       type: integer
 *                     approvedCount:
 *                       type: integer
 *                     rejectedCount:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get('/applications', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { 
      status = 'all', 
      page = 1, 
      limit = 20, 
      sortBy = 'submittedAt', 
      order = 'desc' 
    } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Build query
    let query = {
      'betaAccess.application.submittedAt': { $exists: true }
    };
    
    // Filter by status if specified
    if (status !== 'all') {
      query['betaAccess.application.status'] = status;
    }
    
    // Build sort object
    const sortField = `betaAccess.application.${sortBy}`;
    const sortObject = {};
    sortObject[sortField] = order === 'desc' ? -1 : 1;
    
    console.log('Query for beta applications:', JSON.stringify(query, null, 2));
    console.log('Sort object:', sortObject);
    
    // Get applications
    const applications = await User.find(query)
      .select('username email role betaAccess createdAt')
      .sort(sortObject)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const totalCount = await User.countDocuments(query);
    
    // Get statistics
    const stats = await User.aggregate([
      {
        $match: {
          'betaAccess.application.submittedAt': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$betaAccess.application.status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const statistics = {
      totalApplications: totalCount,
      pendingCount: stats.find(s => s._id === 'pending')?.count || 0,
      approvedCount: stats.find(s => s._id === 'approved')?.count || 0,
      rejectedCount: stats.find(s => s._id === 'rejected')?.count || 0
    };
    
    // Format applications
    const formattedApplications = applications.map(user => ({
      applicationId: user.betaAccess.application.applicationId,
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.betaAccess.application.status || 'pending',
      submittedAt: user.betaAccess.application.submittedAt,
      reviewedAt: user.betaAccess.application.reviewedAt || null,
      reviewedBy: user.betaAccess.application.reviewedBy || null,
      rejectionReason: user.betaAccess.application.rejectionReason || null,
      adminComment: user.betaAccess.application.adminComment || null,
      details: {
        email: user.betaAccess.application.email,
        occupation: user.betaAccess.application.occupation,
        discordId: user.betaAccess.application.discordId,
        reason: user.betaAccess.application.reason
      },
      currentAccess: {
        hasBetaAccess: user.role === 'beta' || user.betaAccess.isEnabled,
        enabledAt: user.betaAccess.enabledAt || null
      },
      statusUrl: `/api/beta/application/status/${user.betaAccess.application.applicationId}`,
      // Days since submission
      daysSinceSubmission: Math.floor(
        (new Date() - new Date(user.betaAccess.application.submittedAt)) / (1000 * 60 * 60 * 24)
      )
    }));
    
    res.status(200).json({
      success: true,
      applications: formattedApplications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNextPage: skip + applications.length < totalCount,
        hasPrevPage: page > 1,
        limit: parseInt(limit)
      },
      filter: {
        status,
        sortBy,
        order,
        appliedFilters: { status }
      },
      stats: statistics
    });
  } catch (error) {
    console.error('Error fetching beta applications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching beta applications',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/beta/approve/{applicationId}:
 *   post:
 *     summary: Approve beta access for an application (admin only)
 *     tags: [Beta]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the application to approve
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminComment:
 *                 type: string
 *                 description: Optional comment from admin
 *     responses:
 *       200:
 *         description: Beta access granted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
router.post('/approve/:applicationId', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { adminComment } = req.body;
    
    const user = await User.findOne({
      'betaAccess.application.applicationId': applicationId
    });
    
    if (!user || !user.betaAccess.application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    if (user.betaAccess.application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Application has already been ${user.betaAccess.application.status}`
      });
    }
    
    // Set beta access fields
    user.role = 'beta';
    user.betaAccess.isEnabled = true;
    user.betaAccess.enabledAt = new Date();
    user.betaAccess.enabledBy = req.user._id;
    
    // Update application status
    user.betaAccess.application.status = 'approved';
    user.betaAccess.application.reviewedAt = new Date();
    user.betaAccess.application.reviewedBy = req.user._id;
    if (adminComment) {
      user.betaAccess.application.adminComment = adminComment;
    }
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Beta access granted successfully',
      application: {
        applicationId: user.betaAccess.application.applicationId,
        userId: user._id,
        username: user.username,
        status: 'approved',
        approvedAt: user.betaAccess.application.reviewedAt,
        approvedBy: req.user.username
      },
      statusUrl: `/api/beta/application/status/${applicationId}`
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
 * /api/beta/reject/{applicationId}:
 *   post:
 *     summary: Reject beta access application (admin only)
 *     tags: [Beta]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the application to reject
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for rejection
 *               adminComment:
 *                 type: string
 *                 description: Optional comment from admin
 *     responses:
 *       200:
 *         description: Beta application rejected
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
router.post('/reject/:applicationId', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { reason, adminComment } = req.body;
    
    const user = await User.findOne({
      'betaAccess.application.applicationId': applicationId
    });
    
    if (!user || !user.betaAccess.application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    if (user.betaAccess.application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Application has already been ${user.betaAccess.application.status}`
      });
    }
    
    // Update application status to rejected
    user.betaAccess.application.status = 'rejected';
    user.betaAccess.application.reviewedAt = new Date();
    user.betaAccess.application.reviewedBy = req.user._id;
    user.betaAccess.application.rejectionReason = reason || 'Application rejected by admin';
    if (adminComment) {
      user.betaAccess.application.adminComment = adminComment;
    }
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Beta application rejected',
      application: {
        applicationId: user.betaAccess.application.applicationId,
        userId: user._id,
        username: user.username,
        status: 'rejected',
        rejectedAt: user.betaAccess.application.reviewedAt,
        rejectedBy: req.user.username,
        rejectionReason: user.betaAccess.application.rejectionReason
      },
      statusUrl: `/api/beta/application/status/${applicationId}`
    });
  } catch (error) {
    console.error('Error rejecting beta application:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting beta application'
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
    
    if (user.role !== 'beta' && !user.betaAccess.isEnabled) {
      return res.status(400).json({
        success: false,
        message: 'User does not have beta access to revoke'
      });
    }
    
    // Remove beta access
    user.role = 'user';
    user.betaAccess.isEnabled = false;
    user.betaAccess.revokedAt = new Date();
    user.betaAccess.revokedBy = req.user._id;
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Beta access revoked successfully',
      user: {
        userId: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        revokedAt: user.betaAccess.revokedAt
      },
      // Include application status URL if they have an application
      ...(user.betaAccess.application?.applicationId && {
        statusUrl: `/api/beta/application/status/${user.betaAccess.application.applicationId}`
      })
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
    
    const formattedUsers = betaUsers.map(user => ({
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      betaAccess: {
        enabledAt: user.betaAccess.enabledAt,
        enabledBy: user.betaAccess.enabledBy,
        revokedAt: user.betaAccess.revokedAt || null
      },
      createdAt: user.createdAt,
      // Include application status URL if they have an application
      ...(user.betaAccess.application?.applicationId && {
        applicationId: user.betaAccess.application.applicationId,
        statusUrl: `/api/beta/application/status/${user.betaAccess.application.applicationId}`
      })
    }));
    
    res.status(200).json({
      success: true,
      count: betaUsers.length,
      users: formattedUsers
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