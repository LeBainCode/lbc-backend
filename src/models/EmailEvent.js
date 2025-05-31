// models/EmailEvent.js (rename EmailNotification.js to EmailEvent.js)
const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     EmailEventModel:
 *       type: object
 *       required:
 *         - recipient
 *         - eventType
 *         - templateId
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated MongoDB ObjectId
 *         recipient:
 *           type: object
 *           required:
 *             - email
 *           properties:
 *             email:
 *               type: string
 *               format: email
 *               description: Recipient email address
 *               index: true
 *             userId:
 *               type: string
 *               description: Reference to User model
 *               index: true
 *             username:
 *               type: string
 *               description: Recipient username for display
 *         eventType:
 *           type: string
 *           enum: [ACCOUNT_CREATION, ADMIN_CREATED_ACCOUNT, BETA_APPLICATION_SUBMITTED, BETA_APPLICATION_APPROVED, BETA_APPLICATION_REJECTED, PASSWORD_RESET, EMAIL_VERIFICATION, WELCOME, MODULE_COMPLETED, NEWSLETTER, CUSTOM]
 *           description: Type of email notification event
 *           index: true
 *         templateId:
 *           type: string
 *           description: Mailchimp template ID or 'auto' for generated content
 *         status:
 *           type: string
 *           enum: [PENDING, SENT, FAILED, DELIVERED, OPENED, CLICKED]
 *           default: PENDING
 *           description: Current status of the email
 *           index: true
 *         metadata:
 *           type: object
 *           properties:
 *             mailchimpId:
 *               type: string
 *               description: Mailchimp campaign or message ID
 *             campaignId:
 *               type: string
 *               description: Campaign identifier for tracking
 *             mailchimpResponse:
 *               type: object
 *               description: Full response from Mailchimp API
 *             emailServiceProvider:
 *               type: string
 *               default: mailchimp
 *               description: Email service provider used
 *         sentBy:
 *           type: string
 *           description: User ID who triggered this email
 *         data:
 *           type: object
 *           default: {}
 *           description: Template variables and data used in email
 *         error:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *               description: Error message if email failed
 *             stack:
 *               type: string
 *               description: Error stack trace for debugging
 *             code:
 *               type: string
 *               description: Error code from email service
 *         createdAt:
 *           type: string
 *           format: date-time
 *           default: Date.now
 *           description: When the email event was created
 *           index: true
 *         sentAt:
 *           type: string
 *           format: date-time
 *           description: When the email was successfully sent
 *         deliveredAt:
 *           type: string
 *           format: date-time
 *           description: When the email was delivered to recipient
 *         openedAt:
 *           type: string
 *           format: date-time
 *           description: When the recipient opened the email
 */

const emailEventSchema = new mongoose.Schema({
  recipient: {
    email: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    username: String
  },
  eventType: {
    type: String,
    required: true,
    enum: [
      'ACCOUNT_CREATION', 
      'ADMIN_CREATED_ACCOUNT',
      'BETA_APPLICATION_SUBMITTED',
      'BETA_APPLICATION_APPROVED',
      'BETA_APPLICATION_REJECTED',
      'PASSWORD_RESET',
      'EMAIL_VERIFICATION',
      'WELCOME',
      'MODULE_COMPLETED',
      'NEWSLETTER',
      'CUSTOM'
    ],
    index: true
  },
  templateId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'SENT', 'FAILED', 'DELIVERED', 'OPENED', 'CLICKED'],
    default: 'PENDING',
    index: true
  },
  metadata: {
    mailchimpId: String,
    campaignId: String,
    mailchimpResponse: mongoose.Schema.Types.Mixed,
    emailServiceProvider: {
      type: String,
      default: 'mailchimp'
    }
  },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  error: {
    message: String,
    stack: String,
    code: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  sentAt: Date,
  deliveredAt: Date,
  openedAt: Date
});

// Methods for handling email events
emailEventSchema.statics.createEvent = async function(eventConfig) {
  return await this.create({
    recipient: eventConfig.recipient,
    eventType: eventConfig.eventType,
    templateId: eventConfig.templateId,
    data: eventConfig.data || {},
    sentBy: eventConfig.sentBy
  });
};

// Update email status
emailEventSchema.statics.updateStatus = async function(eventId, status, metadata = {}) {
  const statusMap = {
    'SENT': { sentAt: new Date() },
    'DELIVERED': { deliveredAt: new Date() },
    'OPENED': { openedAt: new Date() }
  };

  const update = { 
    status,
    ...(statusMap[status] || {}),
    'metadata.mailchimpResponse': metadata 
  };

  if (metadata.mailchimpId) {
    update['metadata.mailchimpId'] = metadata.mailchimpId;
  }

  return await this.findByIdAndUpdate(eventId, update, { new: true });
};

// Record error for email event
emailEventSchema.statics.recordError = async function(eventId, error) {
  return await this.findByIdAndUpdate(eventId, {
    status: 'FAILED',
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code
    }
  }, { new: true });
};

// Get recent emails for a specific user
emailEventSchema.statics.getRecentForUser = async function(userId, limit = 10) {
  return await this.find({ 'recipient.userId': userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('EmailEvent', emailEventSchema);