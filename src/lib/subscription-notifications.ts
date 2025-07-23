import { Subscription } from "@/models/Subscription";
import { User } from "@/models/User";
import {
  sendRenewalReminderEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCancelledEmail,
} from "./resend";

interface NotificationData {
  userId: string;
  subscriptionId: string;
  type:
    | "renewal_reminder"
    | "payment_failed"
    | "subscription_cancelled"
    | "payment_retry";
  data?: any;
}

/**
 * Send subscription-related notifications
 */
export class SubscriptionNotificationService {
  /**
   * Send renewal reminder notification to community admin
   */
  static async sendCommunityAdminRenewalReminder(
    subscriptionId: string,
    daysUntilRenewal: number
  ) {
    try {
      const subscription = await Subscription.findOne({
        razorpaySubscriptionId: subscriptionId,
      }).populate("communityId");

      if (!subscription) {
        console.error(
          "Subscription not found for renewal reminder:",
          subscriptionId
        );
        return;
      }

      const adminUser = await User.findById(subscription.userId);
      if (!adminUser) {
        console.error("Admin user not found for subscription:", subscriptionId);
        return;
      }

      // Check if notification was already sent recently
      const recentNotification = subscription.notificationsSent.find(
        (n: { type: string; sentAt: Date }) =>
          n.type === "renewal_reminder" &&
          new Date(n.sentAt).getTime() > Date.now() - 24 * 60 * 60 * 1000 // 24 hours
      );

      if (recentNotification) {
        console.log(
          "Renewal reminder already sent recently for:",
          subscriptionId
        );
        return;
      }

      // Get community name if available
      const communityName = subscription.communityId?.name || "Your Community";

      // Send email notification
      await sendRenewalReminderEmail(adminUser.email, {
        adminName: adminUser.name || adminUser.email,
        communityName,
        subscriptionAmount: subscription.amount,
        currency: subscription.currency,
        renewalDate: subscription.currentEnd,
        daysUntilRenewal,
      });

      // Record notification
      subscription.notificationsSent.push({
        type: "renewal_reminder",
        sentAt: new Date(),
        channel: "email",
      });

      await subscription.save();

      console.log(
        "Community admin renewal reminder sent for subscription:",
        subscriptionId
      );
    } catch (error) {
      console.error("Error sending community admin renewal reminder:", error);
    }
  }

  /**
   * Send payment failed notification to community admin
   */
  static async sendCommunityAdminPaymentFailedNotification(
    subscriptionId: string,
    failureReason?: string
  ) {
    try {
      const subscription = await Subscription.findOne({
        razorpaySubscriptionId: subscriptionId,
      }).populate("communityId");

      if (!subscription) {
        console.error(
          "Subscription not found for payment failure:",
          subscriptionId
        );
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
      await sendPaymentFailedEmail(adminUser.email, {
        adminName: adminUser.name || adminUser.email,
        communityName,
        subscriptionAmount: subscription.amount,
        currency: subscription.currency,
        failureReason: failureReason || "Payment could not be processed",
        retryAttempts: subscription.retryAttempts,
        maxRetryAttempts: subscription.maxRetryAttempts,
        nextRetryDate: subscription.nextRetryAt,
        paymentUrl: `${process.env.NEXTAUTH_URL}/billing/${subscription.communityId?.slug || subscription.communityId?._id}`,
      });

      // Record notification
      subscription.notificationsSent.push({
        type: "payment_failed",
        sentAt: new Date(),
        channel: "email",
      });

      await subscription.save();

      console.log(
        "Community admin payment failed notification sent for subscription:",
        subscriptionId
      );
    } catch (error) {
      console.error(
        "Error sending community admin payment failed notification:",
        error
      );
    }
  }

  /**
   * Send subscription cancelled notification
   */
  static async sendSubscriptionCancelledNotification(subscriptionId: string) {
    try {
      const subscription = await Subscription.findOne({
        razorpaySubscriptionId: subscriptionId,
      });

      if (!subscription) {
        console.error(
          "Subscription not found for cancellation:",
          subscriptionId
        );
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
          accessUntil: subscription.currentEnd,
        },
      });

      // Record notification
      subscription.notificationsSent.push({
        type: "subscription_cancelled",
        sentAt: new Date(),
        channel: "email",
      });

      await subscription.save();

      console.log(
        "Subscription cancelled notification sent for:",
        subscriptionId
      );
    } catch (error) {
      console.error(
        "Error sending subscription cancelled notification:",
        error
      );
    }
  }

  /**
   * Send payment retry notification
   */
  static async sendPaymentRetryNotification(subscriptionId: string) {
    try {
      const subscription = await Subscription.findOne({
        razorpaySubscriptionId: subscriptionId,
      });

      if (!subscription) {
        console.error(
          "Subscription not found for payment retry:",
          subscriptionId
        );
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
          nextRetryDate: subscription.nextRetryAt,
        },
      });

      // Record notification
      subscription.notificationsSent.push({
        type: "payment_retry",
        sentAt: new Date(),
        channel: "email",
      });

      await subscription.save();

      console.log(
        "Payment retry notification sent for subscription:",
        subscriptionId
      );
    } catch (error) {
      console.error("Error sending payment retry notification:", error);
    }
  }

  /**
   * Send subscription cancellation notification
   */
  static async sendCancellationNotification(
    subscriptionId: string,
    cancellationReason?: string
  ) {
    try {
      const subscription = await Subscription.findOne({
        razorpaySubscriptionId: subscriptionId,
      })
        .populate("userId")
        .populate("communityId");

      if (!subscription || !subscription.userId || !subscription.communityId) {
        console.error(
          "Subscription, user, or community not found for cancellation notification for razorpaySubscriptionId:",
          subscriptionId
        );
        return;
      }

      const adminUser = subscription.userId as any;
      const communityName = subscription.communityId?.name || "Your Community";

      await sendSubscriptionCancelledEmail(adminUser.email, {
        adminName: adminUser.name || adminUser.email,
        communityName,
        cancellationDate: new Date(),
        accessEndDate: subscription.currentEnd,
      });

      subscription.notificationsSent.push({
        type: "subscription_cancelled_admin",
        sentAt: new Date(),
        channel: "email",
      });

      await subscription.save();

      console.log(
        `Cancellation notification sent to admin for subscription ${subscriptionId}`
      );
    } catch (error) {
      console.error("Error sending cancellation notification:", error);
    }
  }

  /**
   * Send a generic email notification using EmailQueue
   */
  static async sendEmailNotification(options: {
    to: string;
    subject: string;
    template: string;
    data?: any;
  }): Promise<void> {
    try {
      const { EmailQueue } = await import("./email-queue");

      // Create a simple HTML template
      const htmlContent = `
        <html>
          <body>
            <h2>${options.subject}</h2>
            <p>Template: ${options.template}</p>
            ${options.data ? `<pre>${JSON.stringify(options.data, null, 2)}</pre>` : ""}
          </body>
        </html>
      `;

      await EmailQueue.addJob({
        to: options.to,
        subject: options.subject,
        html: htmlContent,
        category: options.template,
      });
    } catch (error) {
      console.error("Failed to queue email notification:", error);
      throw error;
    }
  }
}
