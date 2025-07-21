import { Community } from '@/models/Community';
import { dbconnect } from './db';
import { sendTrialReminderEmail } from './resend';
import { User } from '@/models/User';
import { createNotification } from './notifications';
import { TrialHistory, ITrialHistory } from '@/models/TrialHistory';
import { processExpiredTrials } from './trial-expiration-service';
import { EmailQueue } from './email-queue';

// Days before expiration when we want to send notifications
const NOTIFICATION_DAYS = [7, 3, 1];

/**
 * Checks for communities with trials about to expire and sends notifications
 * Should be run daily via a cron job
 */
export async function checkTrialExpirations() {
  try {
    await dbconnect();

    console.log('Starting comprehensive trial check...');

    // First, process any expired trials and suspend communities/users
    const expiredResult = await processExpiredTrials();
    console.log('Expired trials processed:', expiredResult);

    // Then, send notifications for trials about to expire
    const notificationResult = await sendExpirationNotifications();
    console.log('Expiration notifications sent:', notificationResult);

    return {
      success: true,
      message: 'Trial expiration check completed',
      expired: expiredResult,
      notifications: notificationResult
    };
  } catch (error) {
    console.error('Error checking trial expirations:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send notifications for trials about to expire
 */
async function sendExpirationNotifications() {
  try {
    const now = new Date();
    let totalNotifications = 0;

    // For each notification day threshold
    for (const daysLeft of NOTIFICATION_DAYS) {
      // Calculate the target date (trial end date that is exactly X days from now)
      const targetDate = new Date();
      targetDate.setDate(now.getDate() + daysLeft);

      // Set time to beginning of day for target date
      targetDate.setHours(0, 0, 0, 0);

      // Set time to end of day for target date
      const targetDateEnd = new Date(targetDate);
      targetDateEnd.setHours(23, 59, 59, 999);

      console.log(`Checking for trials expiring in ${daysLeft} days (${targetDate.toISOString()} to ${targetDateEnd.toISOString()})`);

      // Find active trials from TrialHistory that are expiring
      const expiringTrials = await TrialHistory.find({
        status: 'active',
        endDate: {
          $gte: targetDate,
          $lte: targetDateEnd
        }
      });

      console.log(`Found ${expiringTrials.length} trials expiring in ${daysLeft} days`);

      // Process each expiring trial
      for (const trial of expiringTrials) {
        await sendTrialExpirationNotifications(trial, daysLeft);
        totalNotifications++;
      }
    }

    return { success: true, totalNotifications };
  } catch (error) {
    console.error('Error sending expiration notifications:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Sends notifications about trial expiration based on TrialHistory
 */
async function sendTrialExpirationNotifications(trial: any, daysLeft: number) {
  try {
    // Get the user
    const user = await User.findById(trial.userId);
    if (!user) {
      console.error(`User not found for trial ${trial._id}`);
      return;
    }

    let title = `Your Trial Expires in ${daysLeft} Day${daysLeft !== 1 ? 's' : ''}`;
    let message = `Your free trial will expire in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Please upgrade to continue using premium features.`;
    let linkUrl = '/profile';
    let communityName = '';

    // Handle community trials
    if (trial.trialType === 'community' && trial.communityId) {
      const community = await Community.findById(trial.communityId);
      if (community) {
        communityName = community.name;
        title = `[${communityName}] Trial Expires in ${daysLeft} Day${daysLeft !== 1 ? 's' : ''}`;
        message = `Your free trial for ${communityName} will expire in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Please upgrade to continue using all features.`;
        linkUrl = `/billing/${community.slug}`;
      }
    }

    // Create notification in the app
    await createNotification({
      userId: trial.userId,
      title,
      message,
      type: 'trial_expiration',
      linkUrl,
      metadata: {
        trialId: trial._id.toString(),
        trialType: trial.trialType,
        communityId: trial.communityId?.toString(),
        daysLeft
      }
    });

    // Send email notification with enhanced warning
    const emailHtml = `
      <h2>Your Trial is Ending Soon</h2>
      <p>${message}</p>
      <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 5px;">
        <h3 style="color: #856404; margin-top: 0;">⚠️ Important Reminder</h3>
        <p><strong>This is your one-time free trial.</strong> After expiration:</p>
        <ul>
          <li>You cannot start another trial</li>
          <li>${trial.trialType === 'community' ? 'Your community will be suspended' : 'Your premium access will be revoked'}</li>
          <li>You must subscribe to continue using premium features</li>
        </ul>
      </div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXTAUTH_URL}${linkUrl}"
           style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          Upgrade Now
        </a>
      </p>
      <p style="font-size: 12px; color: #666;">
        Trial ends on: ${trial.endDate.toLocaleDateString()} at ${trial.endDate.toLocaleTimeString()}
      </p>
    `;

    await EmailQueue.addJob({
      to: user.email,
      subject: title,
      text: message,
      html: emailHtml,
      category: 'trial_reminder',
      priority: daysLeft <= 3 ? 'high' : 'normal',
      tags: [
        { name: 'trial_type', value: trial.trialType },
        { name: 'days_left', value: daysLeft.toString() },
        ...(trial.communityId ? [{ name: 'community_id', value: trial.communityId.toString() }] : [])
      ]
    });

    console.log(`Sent trial expiration notification for ${trial.trialType} trial (${daysLeft} days left) to user ${trial.userId}`);

  } catch (error) {
    console.error(`Error sending trial expiration notification for trial ${trial._id}:`, error);
  }
}
