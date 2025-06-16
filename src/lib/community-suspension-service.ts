import { dbconnect } from './db';
import { CommunitySubscription } from '@/models/Subscription';
import { Community } from '@/models/Community';
import { User } from '@/models/User';
import { createNotification } from './notifications';
import { sendEmail } from './email';

/**
 * Community Suspension Service
 * Handles automatic suspension of communities when trials expire
 */
export class CommunitySuspensionService {
  
  /**
   * Check for expired trials and suspend communities
   */
  static async processExpiredTrials() {
    try {
      await dbconnect();
      
      console.log('Starting expired trial processing...');
      
      const now = new Date();
      
      // Find community subscriptions with expired trials
      const expiredSubscriptions = await CommunitySubscription.find({
        status: { $in: ['created', 'authenticated'] }, // Trial statuses
        trialEndDate: { $lt: now }, // Trial has expired
        $or: [
          { suspended: { $ne: true } }, // Not already suspended
          { suspended: { $exists: false } } // Suspension field doesn't exist
        ]
      }).populate('communityId');
      
      console.log(`Found ${expiredSubscriptions.length} expired trials to process`);
      
      const results = {
        processed: 0,
        suspended: 0,
        errors: 0,
        details: [] as any[]
      };
      
      for (const subscription of expiredSubscriptions) {
        try {
          const result = await this.suspendCommunityForExpiredTrial(subscription);
          results.processed++;
          if (result.suspended) {
            results.suspended++;
          }
          results.details.push(result);
        } catch (error) {
          console.error(`Error processing expired subscription ${subscription.razorpaySubscriptionId}:`, error);
          results.errors++;
          results.details.push({
            subscriptionId: subscription.razorpaySubscriptionId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      console.log('Expired trial processing completed:', results);
      return results;
      
    } catch (error) {
      console.error('Error in processExpiredTrials:', error);
      throw error;
    }
  }
  
  /**
   * Suspend a community for expired trial
   */
  private static async suspendCommunityForExpiredTrial(subscription: any) {
    try {
      const community = subscription.communityId;
      if (!community) {
        throw new Error(`Community not found for subscription: ${subscription.razorpaySubscriptionId}`);
      }
      
      // Get admin user
      const admin = await User.findById(subscription.adminId);
      if (!admin) {
        throw new Error(`Admin user not found: ${subscription.adminId}`);
      }
      
      const now = new Date();
      
      // Update subscription status
      subscription.status = 'expired';
      subscription.suspended = true;
      subscription.suspendedAt = now;
      subscription.suspensionReason = 'trial_expired';
      await subscription.save();
      
      // Update community status
      community.suspended = true;
      community.suspendedAt = now;
      community.suspensionReason = 'trial_expired';
      community.subscriptionStatus = 'expired';
      await community.save();
      
      // Update user's admin subscription status
      await User.findByIdAndUpdate(subscription.adminId, {
        "communityAdminSubscription.subscriptionStatus": "expired"
      });
      
      // Send suspension notifications
      await this.sendSuspensionNotifications(subscription, community, admin);
      
      console.log(`Community ${community.name} suspended for expired trial`);
      
      return {
        subscriptionId: subscription.razorpaySubscriptionId,
        communityId: community._id.toString(),
        communityName: community.name,
        suspended: true,
        suspendedAt: now.toISOString()
      };
      
    } catch (error) {
      console.error('Error suspending community for expired trial:', error);
      throw error;
    }
  }
  
  /**
   * Send suspension notifications to admin
   */
  private static async sendSuspensionNotifications(subscription: any, community: any, admin: any) {
    try {
      const communitySlug = community.slug || community._id.toString();
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const reactivationUrl = `/Newcompage/${communitySlug}?tab=billing&action=subscribe`;
      const fullReactivationUrl = `${baseUrl}${reactivationUrl}`;
      
      // Create in-app notification
      await createNotification({
        userId: subscription.adminId,
        title: `🚨 ${community.name} has been suspended`,
        message: `Your community trial has expired and the community has been suspended. Subscribe now to reactivate immediately.`,
        type: 'community_suspended',
        linkUrl: reactivationUrl,
        metadata: {
          subscriptionId: subscription.razorpaySubscriptionId,
          communityId: community._id.toString(),
          suspendedAt: new Date().toISOString(),
          reason: 'trial_expired'
        }
      });
      
      // Send email notification
      await sendEmail({
        to: admin.email,
        subject: `URGENT: ${community.name} Community Suspended - Immediate Action Required`,
        text: this.getSuspensionEmailText(community.name, fullReactivationUrl),
        html: this.getSuspensionEmailHtml(community.name, fullReactivationUrl)
      });
      
      console.log(`Suspension notifications sent for ${community.name}`);
      
    } catch (error) {
      console.error('Error sending suspension notifications:', error);
      throw error;
    }
  }
  
  /**
   * Generate suspension email text content
   */
  private static getSuspensionEmailText(communityName: string, reactivationUrl: string) {
    return `
URGENT: Your Community Has Been Suspended

Dear Community Administrator,

Your community "${communityName}" has been suspended because your free trial has expired.

IMMEDIATE IMPACT:
• All community members have lost access
• Community features are completely disabled
• Content and data are preserved but inaccessible
• New member registrations are blocked

WHAT YOU NEED TO DO:
Subscribe immediately to reactivate your community: ${reactivationUrl}

SUBSCRIPTION DETAILS:
• Price: $29/month
• Unlimited members, storage, events, and channels
• Full analytics and priority support
• Cancel anytime (no refunds after activation)

Your community data is safe and will be fully restored within minutes of successful subscription.

This was your one-time free trial. You cannot start another trial for this community.

Questions? Reply to this email or contact our support team.

Reactivate now: ${reactivationUrl}

Best regards,
The TheTribeLab Team
    `.trim();
  }
  
  /**
   * Generate suspension email HTML content
   */
  private static getSuspensionEmailHtml(communityName: string, reactivationUrl: string) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Community Suspended - Immediate Action Required</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #F37021; margin: 0;">TheTribeLab</h1>
        <p style="color: #666; margin: 5px 0 0 0;">Community Management Platform</p>
    </div>
    
    <div style="background-color: #fee; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 5px;">
        <h2 style="color: #dc3545; margin-top: 0;">🚨 URGENT: Community Suspended</h2>
        <p style="font-size: 18px; margin: 0;"><strong>Your "${communityName}" community has been suspended due to trial expiration.</strong></p>
    </div>
    
    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; margin: 20px 0; border-radius: 5px;">
        <h3 style="color: #856404; margin-top: 0;">⚠️ Immediate Impact</h3>
        <ul style="margin: 0; padding-left: 20px;">
            <li>All community members have <strong>lost access</strong></li>
            <li>Community features are <strong>completely disabled</strong></li>
            <li>Content and data are preserved but <strong>inaccessible</strong></li>
            <li>New member registrations are <strong>blocked</strong></li>
        </ul>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="${reactivationUrl}" style="background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
            Reactivate Community Now - $29/month
        </a>
    </div>
    
    <div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="color: #2d5a2d; margin-top: 0;">✅ Subscription Benefits</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>✓ Unlimited members</div>
            <div>✓ Unlimited storage</div>
            <div>✓ Unlimited events</div>
            <div>✓ Unlimited channels</div>
            <div>✓ Full analytics</div>
            <div>✓ Priority support</div>
        </div>
        <p style="margin: 15px 0 0 0; font-size: 14px;"><strong>Your community will be fully restored within minutes of successful subscription.</strong></p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Important Notes</h3>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
            <li>This was your <strong>one-time free trial</strong></li>
            <li>You cannot start another trial for this community</li>
            <li>Your data is safe and preserved</li>
            <li>Cancel anytime (no refunds after activation)</li>
        </ul>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="${reactivationUrl}" style="background-color: #F37021; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Reactivate Your Community
        </a>
    </div>
    
    <div style="border-top: 1px solid #ddd; padding-top: 20px; margin-top: 30px; text-align: center; color: #666; font-size: 14px;">
        <p>Questions? Reply to this email or contact our support team.</p>
        <p>© 2024 TheTribeLab. All rights reserved.</p>
    </div>
</body>
</html>
    `.trim();
  }
  
  /**
   * Reactivate a suspended community after successful subscription
   */
  static async reactivateCommunity(subscriptionId: string) {
    try {
      await dbconnect();
      
      // Find the subscription
      const subscription = await CommunitySubscription.findOne({
        razorpaySubscriptionId: subscriptionId
      }).populate('communityId');
      
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }
      
      const community = subscription.communityId;
      if (!community) {
        throw new Error(`Community not found for subscription: ${subscriptionId}`);
      }
      
      // Update subscription status
      subscription.suspended = false;
      subscription.suspendedAt = undefined;
      subscription.suspensionReason = undefined;
      await subscription.save();
      
      // Update community status
      community.suspended = false;
      community.suspendedAt = undefined;
      community.suspensionReason = undefined;
      await community.save();
      
      // Send reactivation notification
      const admin = await User.findById(subscription.adminId);
      if (admin) {
        await createNotification({
          userId: subscription.adminId,
          title: `✅ ${community.name} has been reactivated`,
          message: `Your community subscription is now active and all features have been restored.`,
          type: 'community_reactivated',
          linkUrl: `/Newcompage/${community.slug || community._id}`,
          metadata: {
            subscriptionId,
            communityId: community._id.toString(),
            reactivatedAt: new Date().toISOString()
          }
        });
      }
      
      console.log(`Community ${community.name} reactivated successfully`);
      
      return {
        success: true,
        communityId: community._id.toString(),
        communityName: community.name,
        reactivatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error reactivating community:', error);
      throw error;
    }
  }
}
