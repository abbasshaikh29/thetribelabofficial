import { dbconnect } from './db';
import { CommunitySubscription } from '@/models/Subscription';
import { Community } from '@/models/Community';
import { User } from '@/models/User';
import { createNotification } from './notifications';
import { sendEmail } from './email';

// Days before trial expiration when we send reminders
const TRIAL_REMINDER_DAYS = [7, 3, 2, 1];

/**
 * Community Trial Reminder Notification Service
 * Handles automated trial reminder notifications for community administrators
 */
export class CommunityTrialNotificationService {
  
  /**
   * Check for community subscriptions with trials about to expire and send reminders
   * Should be run daily via cron job
   */
  static async checkAndSendTrialReminders() {
    try {
      await dbconnect();
      
      console.log('Starting community trial reminder check...');
      
      const results = {
        checked: 0,
        reminders: 0,
        errors: 0,
        details: [] as any[]
      };
      
      // Process each reminder threshold
      for (const daysRemaining of TRIAL_REMINDER_DAYS) {
        const reminderResult = await this.processTrialRemindersForDays(daysRemaining);
        results.checked += reminderResult.checked;
        results.reminders += reminderResult.sent;
        results.errors += reminderResult.errors;
        results.details.push({
          daysRemaining,
          ...reminderResult
        });
      }
      
      console.log('Community trial reminder check completed:', results);
      return results;
      
    } catch (error) {
      console.error('Error in community trial reminder check:', error);
      throw error;
    }
  }
  
  /**
   * Process trial reminders for subscriptions expiring in specific number of days
   */
  private static async processTrialRemindersForDays(daysRemaining: number) {
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + daysRemaining);
    
    // Set time boundaries for the target date
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log(`Checking for trials expiring in ${daysRemaining} days (${startOfDay.toISOString()} to ${endOfDay.toISOString()})`);
    
    // Find community subscriptions in trial status with trial ending on target date
    const subscriptions = await CommunitySubscription.find({
      status: { $in: ['created', 'authenticated'] }, // Trial statuses
      trialEndDate: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    }).populate('communityId');
    
    console.log(`Found ${subscriptions.length} subscriptions with trials expiring in ${daysRemaining} days`);
    
    let sent = 0;
    let errors = 0;
    
    for (const subscription of subscriptions) {
      try {
        // Check if reminder was already sent for this threshold
        const existingReminder = subscription.trialReminders?.find(
          (reminder: any) => reminder.daysRemaining === daysRemaining
        );
        
        if (!existingReminder) {
          await this.sendTrialReminderNotification(subscription, daysRemaining);
          sent++;
        } else {
          console.log(`Reminder already sent for subscription ${subscription.razorpaySubscriptionId} (${daysRemaining} days)`);
        }
      } catch (error) {
        console.error(`Error sending reminder for subscription ${subscription.razorpaySubscriptionId}:`, error);
        errors++;
      }
    }
    
    return {
      checked: subscriptions.length,
      sent,
      errors
    };
  }
  
  /**
   * Send trial reminder notification to community admin
   */
  private static async sendTrialReminderNotification(subscription: any, daysRemaining: number) {
    try {
      // Get admin user details
      const admin = await User.findById(subscription.adminId);
      if (!admin) {
        throw new Error(`Admin user not found: ${subscription.adminId}`);
      }
      
      // Get community details
      const community = subscription.communityId;
      if (!community) {
        throw new Error(`Community not found for subscription: ${subscription.razorpaySubscriptionId}`);
      }
      
      const trialEndDate = new Date(subscription.trialEndDate);
      const communitySlug = community.slug || community._id.toString();
      
      // Create notification content based on days remaining
      const notificationContent = this.getNotificationContent(daysRemaining, community.name, trialEndDate, communitySlug);
      
      // Send in-app notification
      const inAppResult = await createNotification({
        userId: subscription.adminId,
        title: notificationContent.title,
        message: notificationContent.message,
        type: 'trial_reminder',
        linkUrl: notificationContent.paymentUrl,
        metadata: {
          subscriptionId: subscription.razorpaySubscriptionId,
          communityId: community._id.toString(),
          daysRemaining,
          trialEndDate: trialEndDate.toISOString(),
          urgency: daysRemaining <= 2 ? 'high' : 'medium'
        }
      });
      
      // Send email notification
      const emailResult = await sendEmail({
        to: admin.email,
        subject: notificationContent.emailSubject,
        text: notificationContent.emailText,
        html: notificationContent.emailHtml
      });
      
      // Record the reminder in subscription
      if (!subscription.trialReminders) {
        subscription.trialReminders = [];
      }
      
      subscription.trialReminders.push({
        daysRemaining,
        sentAt: new Date(),
        emailSent: true,
        inAppSent: inAppResult.success,
        metadata: {
          communityName: community.name,
          communitySlug,
          adminEmail: admin.email,
          trialEndDate: trialEndDate.toISOString()
        }
      });
      
      await subscription.save();
      
      console.log(`Trial reminder sent successfully for ${community.name} (${daysRemaining} days remaining)`);
      
    } catch (error) {
      console.error('Error sending trial reminder notification:', error);
      throw error;
    }
  }
  
  /**
   * Generate notification content based on days remaining
   */
  private static getNotificationContent(daysRemaining: number, communityName: string, trialEndDate: Date, communitySlug: string) {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const paymentUrl = `/Newcompage/${communitySlug}?tab=billing&action=subscribe`;
    const fullPaymentUrl = `${baseUrl}${paymentUrl}`;
    
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };
    
    const urgencyLevel = daysRemaining <= 2 ? 'URGENT' : daysRemaining <= 3 ? 'Important' : 'Reminder';
    const urgencyEmoji = daysRemaining <= 2 ? '🚨' : daysRemaining <= 3 ? '⚠️' : '📅';
    
    return {
      title: `${urgencyEmoji} ${urgencyLevel}: ${communityName} trial expires in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`,
      message: `Your free trial for ${communityName} expires on ${formatDate(trialEndDate)}. Subscribe now to avoid community suspension.`,
      paymentUrl,
      emailSubject: `${urgencyLevel}: Your ${communityName} trial expires in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`,
      emailText: this.getEmailTextContent(daysRemaining, communityName, trialEndDate, fullPaymentUrl),
      emailHtml: this.getEmailHtmlContent(daysRemaining, communityName, trialEndDate, fullPaymentUrl, urgencyLevel, urgencyEmoji)
    };
  }
  
  /**
   * Generate email text content
   */
  private static getEmailTextContent(daysRemaining: number, communityName: string, trialEndDate: Date, paymentUrl: string) {
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    return `
Dear Community Administrator,

Your free trial for "${communityName}" is expiring soon!

Trial Details:
- Community: ${communityName}
- Trial expires: ${formatDate(trialEndDate)}
- Days remaining: ${daysRemaining}

IMPORTANT NOTICE:
After your trial expires, your community will be automatically suspended. This means:
• Community members will lose access to all content and features
• All community functionality will be disabled
• Your community data will be preserved but inaccessible

To avoid interruption, subscribe now for just $29/month:
${paymentUrl}

Features included in your subscription:
✓ Unlimited members
✓ Unlimited storage
✓ Unlimited events and channels
✓ Full analytics dashboard
✓ Priority email support
✓ No usage restrictions

Questions? Reply to this email or contact our support team.

Best regards,
The TheTribeLab Team

Note: This is a one-time trial. No refunds are provided after subscription activation.
    `.trim();
  }
  
  /**
   * Generate email HTML content
   */
  private static getEmailHtmlContent(daysRemaining: number, communityName: string, trialEndDate: Date, paymentUrl: string, urgencyLevel: string, urgencyEmoji: string) {
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const urgencyColor = daysRemaining <= 2 ? '#dc3545' : daysRemaining <= 3 ? '#fd7e14' : '#ffc107';
    const urgencyBgColor = daysRemaining <= 2 ? '#f8d7da' : daysRemaining <= 3 ? '#fff3cd' : '#fff3cd';
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trial Expiration Reminder</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #F37021; margin: 0;">TheTribeLab</h1>
        <p style="color: #666; margin: 5px 0 0 0;">Community Management Platform</p>
    </div>
    
    <div style="background-color: ${urgencyBgColor}; border-left: 4px solid ${urgencyColor}; padding: 20px; margin: 20px 0; border-radius: 5px;">
        <h2 style="color: ${urgencyColor}; margin-top: 0;">${urgencyEmoji} ${urgencyLevel} Notice</h2>
        <p style="font-size: 18px; margin: 0;"><strong>Your "${communityName}" trial expires in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}!</strong></p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #333;">Trial Details</h3>
        <ul style="list-style: none; padding: 0;">
            <li style="padding: 5px 0;"><strong>Community:</strong> ${communityName}</li>
            <li style="padding: 5px 0;"><strong>Trial expires:</strong> ${formatDate(trialEndDate)}</li>
            <li style="padding: 5px 0;"><strong>Days remaining:</strong> ${daysRemaining}</li>
        </ul>
    </div>
    
    <div style="background-color: #fee; border: 1px solid #fcc; padding: 20px; margin: 20px 0; border-radius: 5px;">
        <h3 style="color: #c33; margin-top: 0;">⚠️ What happens after trial expiration?</h3>
        <ul>
            <li>Your community will be <strong>automatically suspended</strong></li>
            <li>Members will <strong>lose access</strong> to all content and features</li>
            <li>All community functionality will be <strong>disabled</strong></li>
            <li>Your data is safe but will be <strong>inaccessible until you subscribe</strong></li>
        </ul>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="${paymentUrl}" style="background-color: #F37021; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
            Subscribe Now - $29/month
        </a>
    </div>
    
    <div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="color: #2d5a2d; margin-top: 0;">✅ What's included in your subscription:</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>✓ Unlimited members</div>
            <div>✓ Unlimited storage</div>
            <div>✓ Unlimited events</div>
            <div>✓ Unlimited channels</div>
            <div>✓ Full analytics</div>
            <div>✓ Priority support</div>
        </div>
    </div>
    
    <div style="border-top: 1px solid #ddd; padding-top: 20px; margin-top: 30px; text-align: center; color: #666; font-size: 14px;">
        <p>Questions? Reply to this email or contact our support team.</p>
        <p><strong>Note:</strong> This is a one-time trial. No refunds are provided after subscription activation.</p>
        <p>© 2024 TheTribeLab. All rights reserved.</p>
    </div>
</body>
</html>
    `.trim();
  }
}
