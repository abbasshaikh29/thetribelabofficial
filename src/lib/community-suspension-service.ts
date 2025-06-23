import { dbconnect } from './db';
import { CommunitySubscription } from '@/models/Subscription';
import { Community } from '@/models/Community';
import { User } from '@/models/User';
import { createNotification } from './notifications';
import { sendTrialExpiredEmail } from './resend';

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
      const reactivationUrl = `/Newcompage/${communitySlug}?tab=billing&action=subscribe`;
      
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
      
      // Send email notification via the new trial expired email function
      await sendTrialExpiredEmail(admin.email, {
        adminName: admin.name || admin.email,
        communityName: community.name,
        paymentUrl: reactivationUrl,
        trialType: 'community' // Generic trial type
      });
      
      console.log(`Suspension notifications sent for ${community.name}`);
      
    } catch (error) {
      console.error('Error sending suspension notifications:', error);
      throw error;
    }
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
