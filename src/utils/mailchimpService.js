// utils/mailchimpService.js
const axios = require('axios');
const EmailEvent = require('../models/EmailEvent');
const { debug } = require('./debugLogger');

class MailchimpService {
  constructor() {
    this.apiKey = process.env.MAILCHIMP_API_KEY;
    this.serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX;
    this.listId = process.env.MAILCHIMP_LIST_ID;
    this.fromEmail = process.env.MAILCHIMP_FROM_EMAIL;
    this.fromName = process.env.MAILCHIMP_FROM_NAME;
    
    if (!this.apiKey || !this.serverPrefix) {
      throw new Error('Mailchimp API key and server prefix are required');
    }
    
    this.baseURL = `https://${this.serverPrefix}.api.mailchimp.com/3.0`;
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Get template ID based on event type
   */
  getTemplateId(eventType) {
    const templateMap = {
      'ACCOUNT_CREATION': process.env.MAILCHIMP_TEMPLATE_ACCOUNT_CREATION,
      'ADMIN_CREATED_ACCOUNT': process.env.MAILCHIMP_TEMPLATE_ADMIN_CREATED_ACCOUNT,
      'BETA_APPLICATION_SUBMITTED': process.env.MAILCHIMP_TEMPLATE_BETA_APPLICATION_SUBMITTED,
      'BETA_APPLICATION_APPROVED': process.env.MAILCHIMP_TEMPLATE_BETA_APPLICATION_APPROVED,
      'BETA_APPLICATION_REJECTED': process.env.MAILCHIMP_TEMPLATE_BETA_APPLICATION_REJECTED,
      'PASSWORD_RESET': process.env.MAILCHIMP_TEMPLATE_PASSWORD_RESET,
      'EMAIL_VERIFICATION': process.env.MAILCHIMP_TEMPLATE_EMAIL_VERIFICATION,
      'WELCOME': process.env.MAILCHIMP_TEMPLATE_WELCOME,
      'CUSTOM': process.env.MAILCHIMP_TEMPLATE_CUSTOM
    };
    
    return templateMap[eventType];
  }

  /**
   * Send email using Mailchimp transactional API
   */
  async sendEmail(eventType, recipient, templateData = {}, sentBy = null) {
    let emailEvent = null;
    
    try {
      const templateId = this.getTemplateId(eventType);
      
      if (!templateId) {
        throw new Error(`No template configured for event type: ${eventType}`);
      }

      // Create email event record
      emailEvent = await EmailEvent.createEvent({
        recipient,
        eventType,
        templateId,
        data: templateData,
        sentBy
      });

      debug('MailchimpService', `Sending ${eventType} email to ${recipient.email}`, {
        templateId,
        recipientId: recipient.userId
      });

      // Prepare email content
      const emailContent = this.prepareEmailContent(eventType, templateData);
      
      // Send via Mailchimp
      const response = await this.sendTransactionalEmail({
        to: recipient.email,
        subject: emailContent.subject,
        htmlContent: emailContent.html,
        templateId,
        templateData: {
          ...templateData,
          recipient_name: recipient.username || 'User',
          site_url: process.env.FRONTEND_URL
        }
      });

      // Update event status
      await EmailEvent.updateStatus(emailEvent._id, 'SENT', {
        mailchimpId: response.id,
        response: response
      });

      debug('MailchimpService', `Email sent successfully`, {
        eventId: emailEvent._id,
        mailchimpId: response.id
      });

      return {
        success: true,
        notificationId: emailEvent._id,
        mailchimpId: response.id,
        eventType
      };

    } catch (error) {
      debug.error('MailchimpService', 'Error sending email', {
        error: error.message,
        eventType,
        recipient: recipient.email
      });

      // Record error if event was created
      if (emailEvent) {
        await EmailEvent.recordError(emailEvent._id, error);
      }

      return {
        success: false,
        error: error.message,
        notificationId: emailEvent?._id
      };
    }
  }

  /**
   * Send transactional email via Mailchimp
   */
  async sendTransactionalEmail({ to, subject, htmlContent, templateId, templateData }) {
    try {
      const emailData = {
        type: 'regular',
        recipients: {
          list_id: this.listId
        },
        settings: {
          subject_line: subject,
          from_name: this.fromName,
          reply_to: this.fromEmail
        }
      };

      // If using template
      if (templateId) {
        emailData.settings.template_id = parseInt(templateId);
      } else {
        // Custom HTML content
        emailData.content_type = 'template';
        emailData.html = htmlContent;
      }

      // Create campaign
      const campaignResponse = await axios.post(
        `${this.baseURL}/campaigns`,
        emailData,
        { headers: this.headers }
      );

      const campaignId = campaignResponse.data.id;

      // Add recipient
      await axios.post(
        `${this.baseURL}/lists/${this.listId}/members`,
        {
          email_address: to,
          status: 'subscribed',
          merge_fields: templateData || {}
        },
        { headers: this.headers }
      );

      // Send campaign
      await axios.post(
        `${this.baseURL}/campaigns/${campaignId}/actions/send`,
        {},
        { headers: this.headers }
      );

      return {
        id: campaignId,
        status: 'sent',
        recipient: to
      };

    } catch (error) {
      debug.error('MailchimpService', 'Mailchimp API error', error.response?.data || error.message);
      throw new Error(`Mailchimp API error: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Prepare email content based on event type
   */
  prepareEmailContent(eventType, data) {
    const contentMap = {
      'ACCOUNT_CREATION': {
        subject: 'Welcome to Le Bain Code!',
        html: this.generateWelcomeEmail(data)
      },
      'ADMIN_CREATED_ACCOUNT': {
        subject: 'Your Le Bain Code Account Has Been Created',
        html: this.generateAdminCreatedEmail(data)
      },
      'BETA_APPLICATION_SUBMITTED': {
        subject: 'Beta Access Application Received',
        html: this.generateBetaApplicationEmail(data)
      },
      'BETA_APPLICATION_APPROVED': {
        subject: '🎉 Your Beta Access Has Been Approved!',
        html: this.generateBetaApprovedEmail(data)
      },
      'BETA_APPLICATION_REJECTED': {
        subject: 'Update on Your Beta Application',
        html: this.generateBetaRejectedEmail(data)
      },
      'CUSTOM': {
        subject: data.subject || 'Update from Le Bain Code',
        html: this.generateCustomEmail(data)
      }
    };

    return contentMap[eventType] || {
      subject: 'Notification from Le Bain Code',
      html: '<p>You have a new notification.</p>'
    };
  }

  /**
   * Email template generators
   */
  generateWelcomeEmail(data) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Le Bain Code, ${data.username}!</h2>
        <p>Your account has been successfully created.</p>
        <p>You can now access your learning dashboard and start your coding journey.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Go to Dashboard</a>
        <p>Best regards,<br>The Le Bain Code Team</p>
      </div>
    `;
  }

  generateAdminCreatedEmail(data) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your Le Bain Code Account</h2>
        <p>Hello ${data.username},</p>
        <p>An administrator has created an account for you on Le Bain Code.</p>
        <p>Please use the link below to set your password:</p>
        <a href="${process.env.FRONTEND_URL}/reset-password?token=${data.resetToken}" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Set Password</a>
        <p>This link will expire in 24 hours.</p>
        <p>Best regards,<br>The Le Bain Code Team</p>
      </div>
    `;
  }

  generateBetaApplicationEmail(data) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Beta Application Received</h2>
        <p>Hello ${data.username},</p>
        <p>Thank you for applying for beta access to Le Bain Code!</p>
        <p><strong>Application ID:</strong> ${data.applicationId}</p>
        <p>We'll review your application and get back to you within 3-5 business days.</p>
        <p>Best regards,<br>The Le Bain Code Team</p>
      </div>
    `;
  }

  generateBetaApprovedEmail(data) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>🎉 Beta Access Approved!</h2>
        <p>Hello ${data.username},</p>
        <p>Congratulations! Your beta access application has been approved by ${data.approvedBy}.</p>
        <p>You now have access to beta features and modules.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Access Beta Features</a>
        <p>Welcome to the beta program!</p>
        <p>Best regards,<br>The Le Bain Code Team</p>
      </div>
    `;
  }

  generateBetaRejectedEmail(data) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Beta Application Update</h2>
        <p>Hello ${data.username},</p>
        <p>Thank you for your interest in our beta program.</p>
        <p>Unfortunately, we're unable to approve your application at this time.</p>
        ${data.rejectionReason ? `<p><strong>Reason:</strong> ${data.rejectionReason}</p>` : ''}
        <p>You're welcome to reapply in the future as our program evolves.</p>
        <p>Best regards,<br>The Le Bain Code Team</p>
      </div>
    `;
  }

  generateCustomEmail(data) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${data.subject || 'Update from Le Bain Code'}</h2>
        <div>${data.content || ''}</div>
        ${data.buttonText && data.buttonUrl ? 
          `<a href="${data.buttonUrl}" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0;">${data.buttonText}</a>` 
          : ''
        }
        <p>Best regards,<br>The Le Bain Code Team</p>
      </div>
    `;
  }

  /**
   * Test Mailchimp connection
   */
  async testConnection() {
    try {
      const response = await axios.get(`${this.baseURL}/ping`, {
        headers: this.headers
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  }
}

// Export singleton instance
module.exports = new MailchimpService();