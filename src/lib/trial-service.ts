import { dbconnect } from './db';
import { User } from '@/models/User';
import { Community } from '@/models/Community';
import { TrialHistory } from '@/models/TrialHistory';
import { Subscription } from '@/models/Subscription';
import { createNotification } from './notifications';
import { sendEmail } from './email';

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

export interface TrialEligibilityResult {
  eligible: boolean;
  reason?: string;
  existingTrial?: any;
}

export interface TrialActivationResult {
  success: boolean;
  trialEndDate?: Date;
  error?: string;
  trialHistory?: any;
}

/**
 * Check if a user is eligible for a trial
 */
export async function checkTrialEligibility(
  userId: string,
  trialType: "user" | "community",
  communityId?: string
): Promise<TrialEligibilityResult> {
  try {
    await dbconnect();

    // Check if user has already used a trial of this type
    const hasUsedTrial = await TrialHistory.hasUserUsedTrial(userId, trialType, communityId);

    if (hasUsedTrial) {
      return {
        eligible: false,
        reason: "User has already used a free trial for this service"
      };
    }

    // Check if there's an active trial in TrialHistory
    const activeTrial = await TrialHistory.getActiveTrial(userId, trialType, communityId);

    if (activeTrial) {
      return {
        eligible: false,
        reason: "User already has an active trial",
        existingTrial: activeTrial
      };
    }

    // For community trials, check additional restrictions
    if (trialType === "community" && communityId) {
      const community = await Community.findById(communityId);

      if (!community) {
        return {
          eligible: false,
          reason: "Community not found"
        };
      }

      // Check if community admin is the requesting user
      if (community.admin.toString() !== userId) {
        return {
          eligible: false,
          reason: "Only community admin can activate trial"
        };
      }

      // Check if community already has active subscription
      const hasActiveSubscriptionStatus = await hasActiveSubscription(community);
      if (hasActiveSubscriptionStatus) {
        return {
          eligible: false,
          reason: "Community already has active subscription"
        };
      }

      // Check if community already has an active trial
      const hasActiveTrialStatus = await hasActiveTrial(community);
      if (hasActiveTrialStatus) {
        return {
          eligible: false,
          reason: "Community already has an active trial"
        };
      }

      // Check if community has used trial before (from adminTrialInfo)
      if (community.adminTrialInfo?.hasUsedTrial) {
        return {
          eligible: false,
          reason: "Community has already used its free trial"
        };
      }
    }

    return { eligible: true };
  } catch (error) {
    console.error('Error checking trial eligibility:', error);
    return {
      eligible: false,
      reason: "Error checking trial eligibility"
    };
  }
}

/**
 * Activate a trial for a user
 */
export async function activateTrial(
  userId: string,
  trialType: "user" | "community",
  communityId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<TrialActivationResult> {
  try {
    await dbconnect();

    // First check eligibility
    const eligibility = await checkTrialEligibility(userId, trialType, communityId);
    
    if (!eligibility.eligible) {
      return {
        success: false,
        error: eligibility.reason
      };
    }

    // Calculate trial end date (14 days from now)
    const trialStartDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialStartDate.getDate() + 14);

    // Create trial history record
    const trialHistory = new TrialHistory({
      userId,
      communityId: communityId ? communityId : undefined,
      trialType,
      startDate: trialStartDate,
      endDate: trialEndDate,
      status: 'active',
      ipAddress,
      userAgent,
      metadata: {
        activatedAt: new Date(),
        source: 'billing_page'
      }
    });

    await trialHistory.save();

    // Update user record
    const user = await User.findById(userId);
    if (user) {
      if (!user.paymentSettings) {
        user.paymentSettings = {};
      }
      
      user.paymentSettings.trialHistory = {
        hasUsedTrial: true,
        trialStartDate,
        trialEndDate,
        trialUsedAt: new Date()
      };

      if (trialType === "user") {
        user.paymentSettings.subscriptionStatus = "trial";
        user.paymentSettings.subscriptionEndDate = trialEndDate;
        user.role = "admin";
      }

      await user.save();
    }

    // Update community record if it's a community trial
    if (trialType === "community" && communityId) {
      const community = await Community.findById(communityId);
      if (community) {
        community.adminTrialInfo = {
          activated: true,
          startDate: trialStartDate,
          endDate: trialEndDate,
          hasUsedTrial: true,
          trialUsedAt: new Date(),
          cancelled: false
        };
        community.paymentStatus = 'trial';
        community.subscriptionEndDate = trialEndDate;
        community.freeTrialActivated = true;
        community.suspended = false; // Ensure community is not suspended

        await community.save();
      }
    }

    // Send welcome notification
    await sendTrialWelcomeNotification(userId, trialType, trialEndDate, communityId);

    return {
      success: true,
      trialEndDate,
      trialHistory
    };
  } catch (error) {
    console.error('Error activating trial:', error);
    return {
      success: false,
      error: "Failed to activate trial"
    };
  }
}

/**
 * Send welcome notification for new trial
 */
async function sendTrialWelcomeNotification(
  userId: string,
  trialType: "user" | "community",
  trialEndDate: Date,
  communityId?: string
) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    let communityName = '';
    let linkUrl = '/profile';

    if (trialType === "community" && communityId) {
      const community = await Community.findById(communityId);
      if (community) {
        communityName = community.name;
        linkUrl = `/billing/${community.slug}`;
      }
    }

    const title = trialType === "community" 
      ? `Trial Started for ${communityName}`
      : "Your Free Trial Has Started";

    const message = trialType === "community"
      ? `Your 14-day free trial for ${communityName} is now active. Trial expires on ${trialEndDate.toLocaleDateString()}.`
      : `Your 14-day free trial is now active. Trial expires on ${trialEndDate.toLocaleDateString()}.`;

    // Create in-app notification
    await createNotification({
      userId,
      title,
      message,
      type: 'trial_started',
      linkUrl,
      metadata: {
        trialType,
        communityId,
        trialEndDate: trialEndDate.toISOString()
      }
    });

    // Send email notification
    await sendEmail({
      to: user.email,
      subject: title,
      text: message,
      html: `
        <h2>${title}</h2>
        <p>${message}</p>
        <p><strong>Important:</strong> This is a one-time trial. After expiration, you'll need to subscribe to continue using premium features.</p>
        <p>Manage your subscription: <a href="${process.env.NEXTAUTH_URL}${linkUrl}">Click here</a></p>
      `
    });
  } catch (error) {
    console.error('Error sending trial welcome notification:', error);
  }
}

/**
 * Check if a community/user trial is active
 */
export async function isTrialActive(
  userId: string,
  trialType: "user" | "community",
  communityId?: string
): Promise<boolean> {
  try {
    const activeTrial = await TrialHistory.getActiveTrial(userId, trialType, communityId);
    return !!activeTrial;
  } catch (error) {
    console.error('Error checking if trial is active:', error);
    return false;
  }
}

/**
 * Clear trial state when subscription becomes active
 */
export async function clearTrialState(communityId: string, userId: string) {
  try {
    await dbconnect();

    const community = await Community.findById(communityId);
    if (!community) {
      throw new Error('Community not found');
    }

    // Clear trial-related fields
    if (community.adminTrialInfo) {
      community.adminTrialInfo.activated = false;
      community.adminTrialInfo.cancelled = true;
      community.adminTrialInfo.cancelledDate = new Date();
    }

    community.freeTrialActivated = false;
    community.suspended = false; // Ensure community is not suspended

    await community.save();

    // Update any active trial history records to converted status
    await TrialHistory.updateMany(
      {
        userId,
        communityId,
        trialType: 'community',
        status: 'active'
      },
      {
        status: 'converted',
        convertedAt: new Date()
      }
    );

    console.log(`Trial state cleared for community ${communityId}`);
    return { success: true };
  } catch (error) {
    console.error('Error clearing trial state:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get comprehensive community status including trial and subscription information
 */
export async function getCommunityStatus(communityId: string) {
  try {
    await dbconnect();

    const community = await Community.findById(communityId);
    if (!community) {
      return {
        found: false,
        error: "Community not found"
      };
    }

    const now = new Date();

    // Check subscription status
    const hasActiveSubscriptionStatus = await hasActiveSubscription(community);
    const hasActiveTrialStatus = await hasActiveTrial(community);

    // Determine the primary status
    let status: 'active_subscription' | 'active_trial' | 'expired' | 'suspended' | 'unpaid' = 'unpaid';
    let daysRemaining = 0;
    let endDate: Date | null = null;

    if (hasActiveSubscriptionStatus) {
      status = 'active_subscription';
      if (community.subscriptionEndDate) {
        endDate = new Date(community.subscriptionEndDate);
        const diffTime = endDate.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    } else if (hasActiveTrialStatus) {
      status = 'active_trial';
      // Determine which trial end date to use
      if (community.adminTrialInfo?.endDate) {
        endDate = new Date(community.adminTrialInfo.endDate);
      } else if (community.subscriptionEndDate && community.paymentStatus === 'trial') {
        endDate = new Date(community.subscriptionEndDate);
      }

      if (endDate) {
        const diffTime = endDate.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (daysRemaining <= 0) {
          status = 'expired';
        }
      }
    } else if (community.suspended) {
      status = 'suspended';
    } else {
      // Check if trial/subscription has expired
      const hasExpiredTrial = community.adminTrialInfo?.endDate &&
        new Date(community.adminTrialInfo.endDate) <= now;
      const hasExpiredSubscription = community.subscriptionEndDate &&
        new Date(community.subscriptionEndDate) <= now;

      if (hasExpiredTrial || hasExpiredSubscription) {
        status = 'expired';
      }
    }

    // Get subscription details if available
    let subscriptionDetails = null;
    if (community.subscriptionId) {
      try {
        subscriptionDetails = await Subscription.findOne({
          razorpaySubscriptionId: community.subscriptionId
        });
      } catch (error) {
        console.error('Error fetching subscription details:', error);
      }
    }

    return {
      found: true,
      community: {
        _id: community._id,
        name: community.name,
        slug: community.slug,
        admin: community.admin,
        paymentStatus: community.paymentStatus,
        adminTrialInfo: community.adminTrialInfo,
        freeTrialActivated: community.freeTrialActivated,
        subscriptionEndDate: isValidDate(community.subscriptionEndDate) ? community.subscriptionEndDate : null,
        subscriptionId: community.subscriptionId,
        subscriptionStatus: subscriptionDetails?.status || null,
        suspended: community.suspended
      },
      status,
      hasActiveSubscription: hasActiveSubscriptionStatus,
      hasActiveTrial: hasActiveTrialStatus,
      daysRemaining: Math.max(0, daysRemaining),
      endDate,
      isEligibleForTrial: !hasActiveSubscriptionStatus && !hasActiveTrialStatus && !community.adminTrialInfo?.hasUsedTrial
    };
  } catch (error) {
    console.error('Error getting community status:', error);
    return {
      found: false,
      error: "Failed to get community status"
    };
  }
}

/**
 * Check if a community has an active subscription
 */
async function hasActiveSubscription(community: any): Promise<boolean> {
  // Check multiple indicators of active subscription
  const hasActivePaidStatus = community.paymentStatus === 'paid';

  // Validate subscription end date - must be valid and in the future
  const hasActiveSubscriptionEndDate = community.subscriptionEndDate &&
    isValidDate(community.subscriptionEndDate) &&
    new Date(community.subscriptionEndDate) > new Date();

  // Check if there's an active subscription record
  let hasActiveSubscriptionRecord = false;
  if (community.subscriptionId) {
    try {
      const subscription = await Subscription.findOne({
        razorpaySubscriptionId: community.subscriptionId,
        status: { $in: ['active', 'authenticated'] }
      });
      hasActiveSubscriptionRecord = !!subscription;
    } catch (error) {
      console.error('Error checking subscription record:', error);
    }
  }

  // For a subscription to be truly active, we need either:
  // 1. Paid status AND valid end date, OR
  // 2. Active subscription record with valid dates
  const isValidActiveSubscription = (hasActivePaidStatus && hasActiveSubscriptionEndDate) ||
                                   (hasActiveSubscriptionRecord && hasActiveSubscriptionEndDate);

  return isValidActiveSubscription;
}

/**
 * Check if a community has an active trial
 */
async function hasActiveTrial(community: any): Promise<boolean> {
  const now = new Date();

  // Check adminTrialInfo - must be activated, not cancelled, and have valid end date
  const hasActiveAdminTrial = community.adminTrialInfo?.activated === true &&
    community.adminTrialInfo?.cancelled !== true &&
    community.adminTrialInfo?.endDate &&
    isValidDate(community.adminTrialInfo.endDate) &&
    new Date(community.adminTrialInfo.endDate) > now;

  // Check legacy trial fields - must have valid dates
  const hasActiveLegacyTrial = community.freeTrialActivated === true &&
    community.subscriptionEndDate &&
    isValidDate(community.subscriptionEndDate) &&
    new Date(community.subscriptionEndDate) > now &&
    community.paymentStatus === 'trial';

  return hasActiveAdminTrial || hasActiveLegacyTrial;
}
