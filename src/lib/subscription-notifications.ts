import { Subscription } from "@/models/Subscription";
import { User } from "@/models/User";

interface NotificationData {
  userId: string;
  subscriptionId: string;
  type: "renewal_reminder" | "payment_failed" | "subscription_cancelled" | "payment_retry";
  data?: any;
}

/**
 * Send subscription-related notifications
 */
export class SubscriptionNotificationService {
  
  /**
   * Send renewal reminder notification to community admin
   */
  static async sendCommunityAdminRenewalReminder(subscriptionId: string, daysUntilRenewal: number) {
    try {
      const subscription = await Subscription.findOne({
        razorpaySubscriptionId: subscriptionId
      }).populate("communityId");

      if (!subscription) {
        console.error("Subscription not found for renewal reminder:", subscriptionId);
        return;
      }

      const adminUser = await User.findById(subscription.userId);
      if (!adminUser) {
        console.error("Admin user not found for subscription:", subscriptionId);
        return;
      }

      // Check if notification was already sent recently
      const recentNotification = subscription.notificationsSent.find(
        (n: { type: string; sentAt: Date }) => n.type === "renewal_reminder" &&
        new Date(n.sentAt).getTime() > Date.now() - 24 * 60 * 60 * 1000 // 24 hours
      );

      if (recentNotification) {
        console.log("Renewal reminder already sent recently for:", subscriptionId);
        return;
      }

      // Get community name if available
      const communityName = subscription.communityId?.name || "Your Community";

      // Send email notification
      await this.sendEmailNotification({
        to: adminUser.email,
        subject: `${communityName} subscription renews in ${daysUntilRenewal} days`,
        template: "admin_renewal_reminder",
        data: {
          adminName: adminUser.name || adminUser.email,
          communityName,
          subscriptionAmount: subscription.amount,
          currency: subscription.currency,
          renewalDate: subscription.currentEnd,
          daysUntilRenewal,
          isAdmin: true
        }
      });

      // Record notification
      subscription.notificationsSent.push({
        type: "renewal_reminder",
        sentAt: new Date(),
        channel: "email"
      });

      await subscription.save();

      console.log("Community admin renewal reminder sent for subscription:", subscriptionId);
    } catch (error) {
      console.error("Error sending community admin renewal reminder:", error);
    }
  }

  /**
   * Send payment failed notification to community admin
   */
  static async sendCommunityAdminPaymentFailedNotification(subscriptionId: string, failureReason?: string) {
    try {
      const subscription = await Subscription.findOne({
        razorpaySubscriptionId: subscriptionId
      }).populate("communityId");

      if (!subscription) {
        console.error("Subscription not found for payment failure:", subscriptionId);
        return;
      }

      const adminUser = await User.findById(subscription.userId);
      if (!adminUser) {
        console.error("Admin user not found for subscription:", subscriptionId);
        return;
      }

      // Get community name if available
      const communityName = subscription.communityId?.name || "Your Community";

      // Send email notification
      await this.sendEmailNotification({
        to: adminUser.email,
        subject: `${communityName} - Payment Failed - Immediate Action Required`,
        template: "admin_payment_failed",
        data: {
          adminName: adminUser.name || adminUser.email,
          communityName,
          subscriptionAmount: subscription.amount,
          currency: subscription.currency,
          failureReason: failureReason || "Payment could not be processed",
          retryAttempts: subscription.retryAttempts,
          maxRetryAttempts: subscription.maxRetryAttempts,
          nextRetryDate: subscription.nextRetryAt,
          isAdmin: true,
          communityAtRisk: subscription.retryAttempts >= subscription.maxRetryAttempts - 1
        }
      });

      // Record notification
      subscription.notificationsSent.push({
        type: "payment_failed",
        sentAt: new Date(),
        channel: "email"
      });

      await subscription.save();

      console.log("Community admin payment failed notification sent for subscription:", subscriptionId);
    } catch (error) {
      console.error("Error sending community admin payment failed notification:", error);
    }
  }

  /**
   * Send subscription cancelled notification
   */
  static async sendSubscriptionCancelledNotification(subscriptionId: string) {
    try {
      const subscription = await Subscription.findOne({
        razorpaySubscriptionId: subscriptionId
      });

      if (!subscription) {
        console.error("Subscription not found for cancellation:", subscriptionId);
        return;
      }

      const user = await User.findById(subscription.userId);
      if (!user) {
        console.error("User not found for subscription:", subscriptionId);
        return;
      }

      // Send email notification
      await this.sendEmailNotification({
        to: user.email,
        subject: "Subscription Cancelled",
        template: "subscription_cancelled",
        data: {
          userName: user.name || user.email,
          subscriptionAmount: subscription.amount,
          currency: subscription.currency,
          endDate: subscription.endedAt || subscription.currentEnd,
          accessUntil: subscription.currentEnd
        }
      });

      // Record notification
      subscription.notificationsSent.push({
        type: "subscription_cancelled",
        sentAt: new Date(),
        channel: "email"
      });

      await subscription.save();

      console.log("Subscription cancelled notification sent for:", subscriptionId);
    } catch (error) {
      console.error("Error sending subscription cancelled notification:", error);
    }
  }

  /**
   * Send payment retry notification
   */
  static async sendPaymentRetryNotification(subscriptionId: string) {
    try {
      const subscription = await Subscription.findOne({
        razorpaySubscriptionId: subscriptionId
      });

      if (!subscription) {
        console.error("Subscription not found for payment retry:", subscriptionId);
        return;
      }

      const user = await User.findById(subscription.userId);
      if (!user) {
        console.error("User not found for subscription:", subscriptionId);
        return;
      }

      // Send email notification
      await this.sendEmailNotification({
        to: user.email,
        subject: "Payment Retry Scheduled",
        template: "payment_retry",
        data: {
          userName: user.name || user.email,
          subscriptionAmount: subscription.amount,
          currency: subscription.currency,
          retryAttempt: subscription.retryAttempts,
          maxRetryAttempts: subscription.maxRetryAttempts,
          nextRetryDate: subscription.nextRetryAt
        }
      });

      // Record notification
      subscription.notificationsSent.push({
        type: "payment_retry",
        sentAt: new Date(),
        channel: "email"
      });

      await subscription.save();

      console.log("Payment retry notification sent for subscription:", subscriptionId);
    } catch (error) {
      console.error("Error sending payment retry notification:", error);
    }
  }

  /**
   * Send email notification (implement based on your email service)
   */
  private static async sendEmailNotification(params: {
    to: string;
    subject: string;
    template: string;
    data: any;
  }) {
    // Implement your email sending logic here
    // This could use Nodemailer, SendGrid, AWS SES, etc.
    
    console.log("Sending email notification:", {
      to: params.to,
      subject: params.subject,
      template: params.template
    });

    // Example implementation with Nodemailer (uncomment and configure)
    /*
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const emailContent = this.generateEmailContent(params.template, params.data);

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: params.to,
      subject: params.subject,
      html: emailContent,
    });
    */
  }

  /**
   * Generate email content based on template
   */
  private static generateEmailContent(template: string, data: any): string {
    switch (template) {
      case "admin_renewal_reminder":
        return `
          <h2>Community Subscription Renewal Reminder</h2>
          <p>Hi ${data.adminName},</p>
          <p>Your community "${data.communityName}" subscription will renew in ${data.daysUntilRenewal} days.</p>
          <p><strong>Renewal Details:</strong></p>
          <ul>
            <li>Amount: ${data.currency} ${data.subscriptionAmount}</li>
            <li>Renewal Date: ${new Date(data.renewalDate).toLocaleDateString()}</li>
            <li>Community: ${data.communityName}</li>
            <li>Access: Unlimited members, storage, events & channels</li>
          </ul>
          <p>Please ensure your payment method is up to date to avoid any interruption to your unlimited community services.</p>
          <p>Your community members depend on uninterrupted access. Thank you for being a valued community administrator!</p>
        `;

      case "admin_payment_failed":
        return `
          <h2>🚨 Community Payment Failed - Immediate Action Required</h2>
          <p>Hi ${data.adminName},</p>
          <p><strong>URGENT:</strong> We were unable to process the subscription payment for your community "${data.communityName}".</p>
          <p><strong>Payment Details:</strong></p>
          <ul>
            <li>Amount: ${data.currency} ${data.subscriptionAmount}</li>
            <li>Community: ${data.communityName}</li>
            <li>Failure Reason: ${data.failureReason}</li>
            <li>Retry Attempts: ${data.retryAttempts} of ${data.maxRetryAttempts}</li>
          </ul>
          ${data.communityAtRisk ?
            `<div style="background-color: #fee; padding: 15px; border-left: 4px solid #f00; margin: 15px 0;">
              <strong>⚠️ CRITICAL WARNING:</strong> This is your final retry attempt. If this payment fails, your community will be suspended and members will lose access.
            </div>` :
            `<p>We will retry the payment ${data.maxRetryAttempts - data.retryAttempts} more times. Next retry: ${data.nextRetryDate ? new Date(data.nextRetryDate).toLocaleDateString() : 'Soon'}.</p>`
          }
          <p><strong>What you need to do:</strong></p>
          <ol>
            <li>Log into your admin dashboard immediately</li>
            <li>Update your payment method</li>
            <li>Ensure sufficient funds are available</li>
          </ol>
          <p>Your community members are counting on you to maintain their access. Please act immediately to avoid service disruption.</p>
        `;

      case "admin_subscription_cancelled":
        return `
          <h2>Community Subscription Cancelled</h2>
          <p>Hi ${data.adminName},</p>
          <p>The subscription for your community "${data.communityName}" has been cancelled as requested.</p>
          <p><strong>Important Information:</strong></p>
          <ul>
            <li>Community access will continue until: ${new Date(data.accessUntil).toLocaleDateString()}</li>
            <li>After this date, your community will be archived</li>
            <li>Member access will be suspended</li>
            <li>Community data will be preserved for 30 days</li>
          </ul>
          <p>If you change your mind, you can reactivate your subscription anytime before the access end date.</p>
          <p>Thank you for being part of the TheTribeLab community platform.</p>
        `;

      case "admin_payment_retry":
        return `
          <h2>Community Payment Retry Scheduled</h2>
          <p>Hi ${data.adminName},</p>
          <p>We will retry the subscription payment for your community "${data.communityName}" on ${new Date(data.nextRetryDate).toLocaleDateString()}.</p>
          <p><strong>Retry Details:</strong></p>
          <ul>
            <li>Amount: ${data.currency} ${data.subscriptionAmount}</li>
            <li>Community: ${data.communityName}</li>
            <li>Attempt: ${data.retryAttempt} of ${data.maxRetryAttempts}</li>
            <li>Next Retry: ${new Date(data.nextRetryDate).toLocaleDateString()}</li>
          </ul>
          <p>Please ensure your payment method is valid and has sufficient funds to avoid service interruption for your community.</p>
        `;

      // Legacy templates for backward compatibility
      case "renewal_reminder":
        return this.generateEmailContent("admin_renewal_reminder", data);

      case "payment_failed":
        return this.generateEmailContent("admin_payment_failed", data);

      case "subscription_cancelled":
        return this.generateEmailContent("admin_subscription_cancelled", data);

      case "payment_retry":
        return this.generateEmailContent("admin_payment_retry", data);

      default:
        return `<p>Community subscription notification</p>`;
    }
  }
}
