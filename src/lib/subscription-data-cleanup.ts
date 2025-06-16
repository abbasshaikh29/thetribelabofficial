import { dbconnect } from './db';
import { Community } from '@/models/Community';
import { CommunitySubscription as Subscription } from '@/models/Subscription';

/**
 * Helper function to validate if a date is valid and not Unix epoch
 */
function isValidDate(date: any): boolean {
  if (!date) return false;
  
  const dateObj = new Date(date);
  
  // Check if it's a valid date
  if (isNaN(dateObj.getTime())) return false;
  
  // Check if it's not Unix epoch (1970-01-01) or close to it
  const epochTime = new Date('1970-01-01').getTime();
  const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
  
  // Date should be at least one year after epoch to be considered valid
  return dateObj.getTime() > (epochTime + oneYearInMs);
}

/**
 * Clean up subscription data inconsistencies for a specific community
 */
export async function cleanupCommunitySubscriptionData(communityId: string) {
  try {
    await dbconnect();

    const community = await Community.findById(communityId);
    if (!community) {
      return {
        success: false,
        error: 'Community not found'
      };
    }

    const issues: string[] = [];
    const fixes: string[] = [];
    let updated = false;

    // Check for invalid subscription end dates
    if (community.subscriptionEndDate && !isValidDate(community.subscriptionEndDate)) {
      issues.push(`Invalid subscription end date: ${community.subscriptionEndDate}`);
      
      // Try to find a valid subscription record to get the correct date
      if (community.subscriptionId) {
        const subscription = await Subscription.findOne({
          razorpaySubscriptionId: community.subscriptionId
        });
        
        if (subscription && isValidDate(subscription.currentEnd)) {
          community.subscriptionEndDate = subscription.currentEnd;
          fixes.push(`Fixed subscription end date from subscription record: ${subscription.currentEnd}`);
          updated = true;
        } else {
          // Clear invalid date
          community.subscriptionEndDate = null;
          fixes.push('Cleared invalid subscription end date');
          updated = true;
        }
      } else {
        // Clear invalid date
        community.subscriptionEndDate = null;
        fixes.push('Cleared invalid subscription end date');
        updated = true;
      }
    }

    // Check for trial status inconsistencies
    if (community.adminTrialInfo?.cancelled === true && community.adminTrialInfo?.activated === true) {
      issues.push('Trial marked as both activated and cancelled');
      
      // If trial is cancelled, it should not be activated
      community.adminTrialInfo.activated = false;
      fixes.push('Deactivated cancelled trial');
      updated = true;
    }

    // Check for invalid trial end dates
    if (community.adminTrialInfo?.endDate && !isValidDate(community.adminTrialInfo.endDate)) {
      issues.push(`Invalid trial end date: ${community.adminTrialInfo.endDate}`);
      
      // Clear invalid trial date
      community.adminTrialInfo.endDate = null;
      fixes.push('Cleared invalid trial end date');
      updated = true;
    }

    // Check for subscription status consistency
    if (community.paymentStatus === 'paid' && !community.subscriptionId) {
      issues.push('Payment status is paid but no subscription ID');
      
      // Look for an active subscription for this community
      const activeSubscription = await Subscription.findOne({
        communityId: community._id,
        status: { $in: ['active', 'authenticated'] }
      });
      
      if (activeSubscription) {
        community.subscriptionId = activeSubscription.razorpaySubscriptionId;
        if (isValidDate(activeSubscription.currentEnd)) {
          community.subscriptionEndDate = activeSubscription.currentEnd;
        }
        fixes.push(`Linked active subscription: ${activeSubscription.razorpaySubscriptionId}`);
        updated = true;
      } else {
        // No active subscription found, reset payment status
        community.paymentStatus = 'unpaid';
        fixes.push('Reset payment status to unpaid (no active subscription found)');
        updated = true;
      }
    }

    // Check for orphaned subscription IDs
    if (community.subscriptionId) {
      const subscription = await Subscription.findOne({
        razorpaySubscriptionId: community.subscriptionId
      });
      
      if (!subscription) {
        issues.push(`Subscription ID ${community.subscriptionId} not found in subscription records`);
        community.subscriptionId = null;
        fixes.push('Cleared orphaned subscription ID');
        updated = true;
      } else if (!['active', 'authenticated'].includes(subscription.status) && community.paymentStatus === 'paid') {
        issues.push(`Subscription status is ${subscription.status} but payment status is paid`);
        community.paymentStatus = 'unpaid';
        fixes.push(`Updated payment status to match subscription status: ${subscription.status}`);
        updated = true;
      }
    }

    // Save changes if any were made
    if (updated) {
      await community.save();
    }

    return {
      success: true,
      issues,
      fixes,
      updated,
      community: {
        id: community._id.toString(),
        paymentStatus: community.paymentStatus,
        subscriptionId: community.subscriptionId,
        subscriptionEndDate: community.subscriptionEndDate,
        adminTrialInfo: community.adminTrialInfo
      }
    };

  } catch (error) {
    console.error('Error cleaning up subscription data:', error);
    return {
      success: false,
      error: (error as Error).message || 'Failed to cleanup subscription data'
    };
  }
}

/**
 * Get detailed subscription status for debugging
 */
export async function getDetailedSubscriptionStatus(communityId: string) {
  try {
    await dbconnect();

    const community = await Community.findById(communityId);
    if (!community) {
      return {
        found: false,
        error: 'Community not found'
      };
    }

    // Get subscription record if exists
    let subscriptionRecord = null;
    if (community.subscriptionId) {
      subscriptionRecord = await Subscription.findOne({
        razorpaySubscriptionId: community.subscriptionId
      });
    }

    // Find any subscription records for this community
    const allSubscriptions = await Subscription.find({
      communityId: community._id
    }).sort({ createdAt: -1 });

    const now = new Date();

    return {
      found: true,
      community: {
        id: community._id.toString(),
        name: community.name,
        slug: community.slug,
        paymentStatus: community.paymentStatus,
        subscriptionId: community.subscriptionId,
        subscriptionEndDate: community.subscriptionEndDate,
        adminTrialInfo: community.adminTrialInfo,
        freeTrialActivated: community.freeTrialActivated
      },
      subscriptionRecord: subscriptionRecord ? {
        id: subscriptionRecord.razorpaySubscriptionId,
        status: subscriptionRecord.status,
        currentStart: subscriptionRecord.currentStart,
        currentEnd: subscriptionRecord.currentEnd,
        amount: subscriptionRecord.amount,
        currency: subscriptionRecord.currency
      } : null,
      allSubscriptions: allSubscriptions.map(sub => ({
        id: sub.razorpaySubscriptionId,
        status: sub.status,
        currentStart: sub.currentStart,
        currentEnd: sub.currentEnd,
        createdAt: sub.createdAt
      })),
      validation: {
        hasValidSubscriptionEndDate: isValidDate(community.subscriptionEndDate),
        hasValidTrialEndDate: isValidDate(community.adminTrialInfo?.endDate),
        subscriptionEndDateValue: community.subscriptionEndDate,
        trialEndDateValue: community.adminTrialInfo?.endDate,
        isSubscriptionExpired: community.subscriptionEndDate ? new Date(community.subscriptionEndDate) <= now : null,
        isTrialExpired: community.adminTrialInfo?.endDate ? new Date(community.adminTrialInfo.endDate) <= now : null,
        trialCancelled: community.adminTrialInfo?.cancelled || false,
        trialActivated: community.adminTrialInfo?.activated || false
      }
    };

  } catch (error) {
    console.error('Error getting detailed subscription status:', error);
    return {
      found: false,
      error: (error as Error).message || 'Failed to get subscription status'
    };
  }
}
