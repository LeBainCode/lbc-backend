// routes/emailNotifications.js
const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { checkRole } = require('../middleware/checkRoleAccess');
const EmailEvent = require('../models/EmailEvent');
const mailchimpService = require('../utils/mailchimpService');
const { debug } = require('../utils/debugLogger');
const User = require('../models/User');

/**
 * @swagger
 * tags:
 *   name: EmailNotifications
 *   description: Email notification management, testing, and history tracking
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     EmailEvent:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier for the email event
 *           example: "507f1f77bcf86cd799439011"
 *         recipient:
 *           type: object
 *           properties:
 *             email:
 *               type: string
 *               format: email
 *               description: Recipient email address
 *               example: "user@example.com"
 *             userId:
 *               type: string
 *               description: User ID reference
 *               example: "507f1f77bcf86cd799439011"
 *             username:
 *               type: string
 *               description: Recipient username
 *               example: "johndoe"
 *         eventType:
 *           type: string
 *           enum: [ACCOUNT_CREATION, ADMIN_CREATED_ACCOUNT, BETA_APPLICATION_SUBMITTED, BETA_APPLICATION_APPROVED, BETA_APPLICATION_REJECTED, PASSWORD_RESET, EMAIL_VERIFICATION, WELCOME, MODULE_COMPLETED, NEWSLETTER, CUSTOM]
 *           description: Type of email event
 *           example: "WELCOME"
 *         templateId:
 *           type: string
 *           description: Mailchimp template ID used
 *           example: "123456"
 *         status:
 *           type: string
 *           enum: [PENDING, SENT, FAILED, DELIVERED, OPENED, CLICKED]
 *           description: Current status of the email
 *           example: "SENT"
 *         metadata:
 *           type: object
 *           properties:
 *             mailchimpId:
 *               type: string
 *               description: Mailchimp campaign/message ID
 *               example: "abc123def456"
 *             campaignId:
 *               type: string
 *               description: Campaign identifier
 *               example: "campaign_789"
 *             mailchimpResponse:
 *               type: object
 *               description: Full response from Mailchimp API
 *             emailServiceProvider:
 *               type: string
 *               default: mailchimp
 *               description: Email service provider used
 *               example: "mailchimp"
 *         sentBy:
 *           type: string
 *           description: User ID who triggered the email
 *           example: "507f1f77bcf86cd799439011"
 *         data:
 *           type: object
 *           description: Template data and variables used in email
 *           example: { "username": "john", "applicationId": "app123" }
 *         error:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *               description: Error message if email failed
 *               example: "Invalid template ID"
 *             stack:
 *               type: string
 *               description: Error stack trace
 *             code:
 *               type: string
 *               description: Error code
 *               example: "TEMPLATE_NOT_FOUND"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the email event was created
 *           example: "2024-01-15T10:30:00Z"
 *         sentAt:
 *           type: string
 *           format: date-time
 *           description: When the email was sent
 *           example: "2024-01-15T10:31:00Z"
 *         deliveredAt:
 *           type: string
 *           format: date-time
 *           description: When the email was delivered
 *           example: "2024-01-15T10:32:00Z"
 *         openedAt:
 *           type: string
 *           format: date-time
 *           description: When the email was opened
 *           example: "2024-01-15T11:00:00Z"
 *     
 *     EmailNotificationStats:
 *       type: object
 *       properties:
 *         totalNotifications:
 *           type: integer
 *           description: Total number of email notifications
 *           example: 1250
 *         byStatus:
 *           type: object
 *           properties:
 *             pending:
 *               type: integer
 *               example: 5
 *             sent:
 *               type: integer
 *               example: 1200
 *             failed:
 *               type: integer
 *               example: 15
 *             delivered:
 *               type: integer
 *               example: 1180
 *             opened:
 *               type: integer
 *               example: 890
 *         byEventType:
 *           type: object
 *           additionalProperties:
 *             type: integer
 *           description: Count of notifications by event type
 *           example:
 *             WELCOME: 500
 *             BETA_APPLICATION_SUBMITTED: 150
 *             ACCOUNT_CREATION: 300
 *     
 *     TestEmailRequest:
 *       type: object
 *       required:
 *         - recipientEmail
 *         - eventType
 *       properties:
 *         recipientEmail:
 *           type: string
 *           format: email
 *           description: Email address of the test recipient
 *           example: "test@example.com"
 *         recipientUsername:
 *           type: string
 *           description: Username for the test recipient
 *           example: "testuser"
 *         eventType:
 *           type: string
 *           enum: [ACCOUNT_CREATION, ADMIN_CREATED_ACCOUNT, BETA_APPLICATION_SUBMITTED, BETA_APPLICATION_APPROVED, BETA_APPLICATION_REJECTED, PASSWORD_RESET, EMAIL_VERIFICATION, WELCOME, CUSTOM]
 *           description: Type of email to send
 *           example: "WELCOME"
 *         metadata:
 *           type: object
 *           description: Additional data for the email template
 *           properties:
 *             subject:
 *               type: string
 *               description: Custom subject for CUSTOM event type
 *               example: "Custom Test Email"
 *             content:
 *               type: string
 *               description: Custom content for CUSTOM event type
 *               example: "<p>This is a test email.</p>"
 *             resetToken:
 *               type: string
 *               description: Reset token for ADMIN_CREATED_ACCOUNT type
 *               example: "abc123token456"
 *             applicationId:
 *               type: string
 *               description: Application ID for beta-related emails
 *               example: "app_12345"
 *     
 *     CustomEmailRequest:
 *       type: object
 *       required:
 *         - recipients
 *         - content
 *       properties:
 *         recipients:
 *           type: array
 *           items:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Recipient email address
 *               userId:
 *                 type: string
 *                 description: Optional user ID reference
 *               username:
 *                 type: string
 *                 description: Optional username override
 *           description: Array of email recipients
 *           example:
 *             - email: "user1@example.com"
 *               username: "user1"
 *             - email: "user2@example.com"
 *               userId: "507f1f77bcf86cd799439011"
 *         subject:
 *           type: string
 *           description: Email subject line
 *           example: "Important Update from Le Bain Code"
 *         content:
 *           type: string
 *           description: HTML or plain text email content
 *           example: "<p>This is an important update about our platform.</p>"
 *         buttonText:
 *           type: string
 *           description: Text for optional call-to-action button
 *           example: "Learn More"
 *         buttonUrl:
 *           type: string
 *           format: uri
 *           description: URL for optional call-to-action button
 *           example: "https://www.lebaincode.com/updates"
 *     
 *     EmailPagination:
 *       type: object
 *       properties:
 *         currentPage:
 *           type: integer
 *           example: 1
 *         totalPages:
 *           type: integer
 *           example: 10
 *         totalCount:
 *           type: integer
 *           example: 200
 *         hasNextPage:
 *           type: boolean
 *           example: true
 *         hasPrevPage:
 *           type: boolean
 *           example: false
 *         limit:
 *           type: integer
 *           example: 20
 */

/**
 * @swagger
 * /api/email/notifications/send-test:
 *   post:
 *     summary: Send a test email notification (admin only)
 *     description: Allows administrators to send test emails for any event type to verify email templates and delivery
 *     tags: [EmailNotifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TestEmailRequest'
 *           examples:
 *             welcomeEmail:
 *               summary: Welcome email test
 *               value:
 *                 recipientEmail: "test@example.com"
 *                 recipientUsername: "testuser"
 *                 eventType: "WELCOME"
 *                 metadata: {}
 *             betaApproval:
 *               summary: Beta approval email test
 *               value:
 *                 recipientEmail: "beta@example.com"
 *                 recipientUsername: "betatester"
 *                 eventType: "BETA_APPLICATION_APPROVED"
 *                 metadata:
 *                   applicationId: "app_12345"
 *                   approvedBy: "admin"
 *             customEmail:
 *               summary: Custom email test
 *               value:
 *                 recipientEmail: "custom@example.com"
 *                 recipientUsername: "customuser"
 *                 eventType: "CUSTOM"
 *                 metadata:
 *                   subject: "Test Custom Email"
 *                   content: "<p>This is a test custom email.</p>"
 *     responses:
 *       200:
 *         description: Test email queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Test email queued successfully"
 *                 notificationId:
 *                   type: string
 *                   description: ID of the created email event
 *                   example: "507f1f77bcf86cd799439011"
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   examples:
 *                     - "Recipient email and event type are required"
 *                     - "Invalid event type. Must be one of: ACCOUNT_CREATION, ADMIN_CREATED_ACCOUNT, ..."
 *       401:
 *         description: Unauthorized - valid token required
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.post('/notifications/send-test', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { 
      recipientEmail, 
      recipientUsername,
      eventType, 
      metadata = {} 
    } = req.body;
    
    if (!recipientEmail || !eventType) {
      return res.status(400).json({
        success: false,
        message: 'Recipient email and event type are required'
      });
    }
    
    // Check if valid event type
    const validEvents = [
      'ACCOUNT_CREATION', 
      'ADMIN_CREATED_ACCOUNT',
      'BETA_APPLICATION_SUBMITTED',
      'BETA_APPLICATION_APPROVED',
      'BETA_APPLICATION_REJECTED',
      'PASSWORD_RESET',
      'EMAIL_VERIFICATION',
      'WELCOME',
      'CUSTOM'
    ];
    
    if (!validEvents.includes(eventType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid event type. Must be one of: ${validEvents.join(', ')}`
      });
    }
    
    // Find user if they exist
    const user = await User.findOne({ email: recipientEmail });
    
    // Add admin info to metadata
    const enhancedMetadata = {
      ...metadata,
      isTest: true,
      sentBy: req.user.username
    };
    
    // Send the email
    const result = await mailchimpService.sendEmail(
      eventType,
      {
        email: recipientEmail,
        userId: user?._id,
        username: recipientUsername || user?.username || 'User'
      },
      enhancedMetadata,
      req.user._id
    );
    
    res.json({
      success: true,
      message: 'Test email queued successfully',
      notificationId: result.notificationId
    });
  } catch (error) {
    debug.error('Email', 'Error sending test email', error);
    res.status(500).json({
      success: false,
      message: 'Error sending test email',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @swagger
 * /api/email/notifications/history:
 *   get:
 *     summary: Get email notifications history with filtering (admin only)
 *     description: Retrieve paginated email notification history with optional filtering by event type, status, and recipient
 *     tags: [EmailNotifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of notifications per page
 *         example: 20
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *           enum: [ACCOUNT_CREATION, ADMIN_CREATED_ACCOUNT, BETA_APPLICATION_SUBMITTED, BETA_APPLICATION_APPROVED, BETA_APPLICATION_REJECTED, PASSWORD_RESET, EMAIL_VERIFICATION, WELCOME, MODULE_COMPLETED, NEWSLETTER, CUSTOM]
 *         description: Filter by event type
 *         example: "WELCOME"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, SENT, FAILED, DELIVERED, OPENED, CLICKED]
 *         description: Filter by email status
 *         example: "SENT"
 *       - in: query
 *         name: recipient
 *         schema:
 *           type: string
 *         description: Search by recipient email (case-insensitive partial match)
 *         example: "user@example.com"
 *     responses:
 *       200:
 *         description: Email notifications history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 notifications:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EmailEvent'
 *                 pagination:
 *                   $ref: '#/components/schemas/EmailPagination'
 *                 stats:
 *                   $ref: '#/components/schemas/EmailNotificationStats'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get('/notifications/history', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      eventType, 
      status,
      recipient
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build query
    const query = {};
    if (eventType) query.eventType = eventType;
    if (status) query.status = status;
    if (recipient) query['recipient.email'] = new RegExp(recipient, 'i');
    
    // Get notifications
    const notifications = await EmailEvent.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('sentBy', 'username')
      .populate('recipient.userId', 'username');
      
    // Count total
    const totalCount = await EmailEvent.countDocuments(query);
    
    // Get stats
    const stats = {
      totalNotifications: await EmailEvent.countDocuments(),
      byStatus: {
        pending: await EmailEvent.countDocuments({ status: 'PENDING' }),
        sent: await EmailEvent.countDocuments({ status: 'SENT' }),
        failed: await EmailEvent.countDocuments({ status: 'FAILED' }),
        delivered: await EmailEvent.countDocuments({ status: 'DELIVERED' }),
        opened: await EmailEvent.countDocuments({ status: 'OPENED' })
      },
      byEventType: {}
    };
    
    // Get event type stats
    const eventTypes = await EmailEvent.aggregate([
      { $group: { _id: "$eventType", count: { $sum: 1 } } }
    ]);
    
    eventTypes.forEach(type => {
      stats.byEventType[type._id] = type.count;
    });
    
    res.json({
      success: true,
      notifications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNextPage: skip + notifications.length < totalCount,
        hasPrevPage: page > 1,
        limit: parseInt(limit)
      },
      stats
    });
  } catch (error) {
    debug.error('Email', 'Error retrieving notifications history', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving notifications history',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @swagger
 * /api/email/notifications/me:
 *   get:
 *     summary: Get current user's email notifications
 *     description: Retrieve the current user's email notification history (limited to their own emails)
 *     tags: [EmailNotifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Number of notifications to return
 *         example: 20
 *     responses:
 *       200:
 *         description: User's email notifications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 notifications:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EmailEvent'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/notifications/me', verifyToken, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const notifications = await EmailEvent.find({ 
      'recipient.userId': req.user._id 
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
      
    res.json({
      success: true,
      notifications
    });
  } catch (error) {
    debug.error('Email', 'Error retrieving user notifications', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @swagger
 * /api/email/notifications/custom:
 *   post:
 *     summary: Send custom email to multiple recipients (admin only)
 *     description: Send a custom email with subject and content to multiple recipients in batches
 *     tags: [EmailNotifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomEmailRequest'
 *           examples:
 *             simpleCustomEmail:
 *               summary: Simple custom email to multiple users
 *               value:
 *                 recipients:
 *                   - email: "user1@example.com"
 *                     username: "user1"
 *                   - email: "user2@example.com"
 *                     username: "user2"
 *                 subject: "Platform Update Notification"
 *                 content: "<h2>New Features Available</h2><p>We've added exciting new features to the platform!</p>"
 *                 buttonText: "Explore Features"
 *                 buttonUrl: "https://www.lebaincode.com/features"
 *             newsletterEmail:
 *               summary: Newsletter-style email
 *               value:
 *                 recipients:
 *                   - email: "subscriber1@example.com"
 *                   - email: "subscriber2@example.com"
 *                 subject: "Le Bain Code Monthly Newsletter"
 *                 content: "<h1>Monthly Update</h1><p>Here's what happened this month...</p>"
 *                 buttonText: "Read Full Newsletter"
 *                 buttonUrl: "https://www.lebaincode.com/newsletter"
 *     responses:
 *       200:
 *         description: Custom emails processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Processed 5 recipients. 4 succeeded, 1 failed."
 *                 results:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           email:
 *                             type: string
 *                             example: "user1@example.com"
 *                           notificationId:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439011"
 *                     failed:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           email:
 *                             type: string
 *                             example: "invalid@email"
 *                           error:
 *                             type: string
 *                             example: "Invalid email format"
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.post('/notifications/custom', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { 
      recipients, 
      subject,
      content,
      buttonText,
      buttonUrl
    } = req.body;
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Recipients array is required'
      });
    }
    
    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Email content is required'
      });
    }
    
    const results = {
      success: [],
      failed: []
    };
    
    // Process recipients in batches to avoid overwhelming the service
    const batchSize = 10;
    
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      // Process batch in parallel
      const promises = batch.map(async (recipient) => {
        try {
          if (!recipient.email) {
            throw new Error('Email is required for each recipient');
          }
          
          // Look up user if userId is provided
          let userId = recipient.userId;
          let username = recipient.username;
          
          if (!username && userId) {
            const user = await User.findById(userId);
            username = user?.username;
          }
          
          // Send the email
          const result = await mailchimpService.sendEmail(
            'CUSTOM',
            {
              email: recipient.email,
              userId,
              username: username || 'User'
            },
            {
              subject,
              content,
              buttonText: buttonText || 'Visit Website',
              buttonUrl: buttonUrl || process.env.FRONTEND_URL,
              sentBy: req.user.username
            },
            req.user._id
          );
          
          results.success.push({
            email: recipient.email,
            notificationId: result.notificationId
          });
        } catch (error) {
          results.failed.push({
            email: recipient.email,
            error: error.message
          });
        }
      });
      
      await Promise.all(promises);
      
      // Small delay between batches
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    res.json({
      success: true,
      message: `Processed ${recipients.length} recipients. ${results.success.length} succeeded, ${results.failed.length} failed.`,
      results
    });
  } catch (error) {
    debug.error('Email', 'Error sending custom emails', error);
    res.status(500).json({
      success: false,
      message: 'Error sending custom emails',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @swagger
 * /api/email/notifications/stats:
 *   get:
 *     summary: Get email notification statistics (admin only)
 *     description: Retrieve detailed statistics about email notifications for a specified time period
 *     tags: [EmailNotifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *         description: Number of days to include in statistics
 *         example: 30
 *     responses:
 *       200:
 *         description: Email notification statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 stats:
 *                   $ref: '#/components/schemas/EmailNotificationStats'
 *                 period:
 *                   type: object
 *                   properties:
 *                     days:
 *                       type: integer
 *                       example: 30
 *                     from:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-01T00:00:00Z"
 *                     to:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-31T23:59:59Z"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get('/notifications/stats', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - parseInt(days));
    
    const query = { createdAt: { $gte: fromDate } };
    
    // Get basic stats
    const stats = {
      totalNotifications: await EmailEvent.countDocuments(query),
      byStatus: {
        pending: await EmailEvent.countDocuments({ ...query, status: 'PENDING' }),
        sent: await EmailEvent.countDocuments({ ...query, status: 'SENT' }),
        failed: await EmailEvent.countDocuments({ ...query, status: 'FAILED' }),
        delivered: await EmailEvent.countDocuments({ ...query, status: 'DELIVERED' }),
        opened: await EmailEvent.countDocuments({ ...query, status: 'OPENED' })
      },
      byEventType: {}
    };
    
    // Get event type stats
    const eventTypes = await EmailEvent.aggregate([
      { $match: query },
      { $group: { _id: "$eventType", count: { $sum: 1 } } }
    ]);
    
    eventTypes.forEach(type => {
      stats.byEventType[type._id] = type.count;
    });
    
    res.json({
      success: true,
      stats,
      period: {
        days: parseInt(days),
        from: fromDate,
        to: new Date()
      }
    });
  } catch (error) {
    debug.error('Email', 'Error retrieving email stats', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving email statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @swagger
 * /api/email/notifications/test-connection:
 *   get:
 *     summary: Test Mailchimp connection (admin only)
 *     description: Test the connection to Mailchimp API to verify configuration
 *     tags: [EmailNotifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Connection test results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Mailchimp connection successful"
 *                 data:
 *                   type: object
 *                   description: Response from Mailchimp ping endpoint
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Connection failed or server error
 */
router.get('/notifications/test-connection', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const result = await mailchimpService.testConnection();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Mailchimp connection successful',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Mailchimp connection failed',
        error: result.error
      });
    }
  } catch (error) {
    debug.error('Email', 'Error testing Mailchimp connection', error);
    res.status(500).json({
      success: false,
      message: 'Error testing Mailchimp connection',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

module.exports = router;