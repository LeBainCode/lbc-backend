// middleware/emailNotificationMiddleware.js
const mailchimpService = require('../utils/mailchimpService');
const User = require('../models/User');
const { debug } = require('../utils/debugLogger');

/**
 * Sends account creation email
 */
async function sendAccountCreationEmail(userId) {
  try {
    const user = await User.findById(userId);
    
    if (!user || !user.email) {
      debug('EmailNotification', 'Cannot send account creation email - missing user or email', { userId });
      return null;
    }
    
    return mailchimpService.sendEmail(
      'ACCOUNT_CREATION',
      {
        email: user.email,
        userId: user._id,
        username: user.username
      },
      {
        username: user.username,
        role: user.role
      }
    );
  } catch (error) {
    debug.error('EmailNotification', 'Error sending account creation email', error);
    return null;
  }
}

/**
 * Sends admin-created account email
 */
async function sendAdminCreatedAccountEmail(userId, resetToken) {
  try {
    const user = await User.findById(userId);
    
    if (!user || !user.email) {
      debug('EmailNotification', 'Cannot send admin created account email - missing user or email', { userId });
      return null;
    }
    
    return mailchimpService.sendEmail(
      'ADMIN_CREATED_ACCOUNT',
      {
        email: user.email,
        userId: user._id,
        username: user.username
      },
      {
        username: user.username,
        resetToken,
        role: user.role
      }
    );
  } catch (error) {
    debug.error('EmailNotification', 'Error sending admin created account email', error);
    return null;
  }
}

/**
 * Sends beta application submission confirmation email
 */
async function sendBetaApplicationSubmittedEmail(userId, applicationId) {
  try {
    const user = await User.findById(userId);
    
    if (!user || !user.email) {
      debug('EmailNotification', 'Cannot send beta application email - missing user or email', { userId });
      return null;
    }
    
    return mailchimpService.sendEmail(
      'BETA_APPLICATION_SUBMITTED',
      {
        email: user.email,
        userId: user._id,
        username: user.username
      },
      {
        username: user.username,
        applicationId,
        occupation: user.betaAccess?.application?.occupation || null
      }
    );
  } catch (error) {
    debug.error('EmailNotification', 'Error sending beta application email', error);
    return null;
  }
}

/**
 * Sends beta application approval email
 */
async function sendBetaApplicationApprovedEmail(userId, adminId) {
  try {
    const user = await User.findById(userId);
    
    if (!user || !user.email) {
      debug('EmailNotification', 'Cannot send beta approval email - missing user or email', { userId });
      return null;
    }
    
    // Get admin username if available
    let adminUsername = 'Administrator';
    if (adminId) {
      const admin = await User.findById(adminId);
      if (admin) {
        adminUsername = admin.username;
      }
    }
    
    return mailchimpService.sendEmail(
      'BETA_APPLICATION_APPROVED',
      {
        email: user.email,
        userId: user._id,
        username: user.username
      },
      {
        username: user.username,
        approvedBy: adminUsername,
        applicationId: user.betaAccess?.application?.applicationId
      },
      adminId
    );
  } catch (error) {
    debug.error('EmailNotification', 'Error sending beta approval email', error);
    return null;
  }
}

/**
 * Sends beta application rejection email
 */
async function sendBetaApplicationRejectedEmail(userId, adminId, rejectionReason) {
  try {
    const user = await User.findById(userId);
    
    if (!user || !user.email) {
      debug('EmailNotification', 'Cannot send beta rejection email - missing user or email', { userId });
      return null;
    }
    
    // Get admin username if available
    let adminUsername = 'Administrator';
    if (adminId) {
      const admin = await User.findById(adminId);
      if (admin) {
        adminUsername = admin.username;
      }
    }
    
    return mailchimpService.sendEmail(
      'BETA_APPLICATION_REJECTED',
      {
        email: user.email,
        userId: user._id,
        username: user.username
      },
      {
        username: user.username,
        rejectionReason: rejectionReason || user.betaAccess?.application?.rejectionReason,
        rejectedBy: adminUsername,
        applicationId: user.betaAccess?.application?.applicationId
      },
      adminId
    );
  } catch (error) {
    debug.error('EmailNotification', 'Error sending beta rejection email', error);
    return null;
  }
}

module.exports = {
  sendAccountCreationEmail,
  sendAdminCreatedAccountEmail,
  sendBetaApplicationSubmittedEmail,
  sendBetaApplicationApprovedEmail,
  sendBetaApplicationRejectedEmail
};
