import { dbconnect } from "@/lib/db";
import { User } from "@/models/User";
import { Community } from "@/models/Community";
import { TrialHistory } from "@/models/TrialHistory";
import { CommunitySubscription } from "@/models/Subscription";
import { createNotification } from "./notifications";
import { sendTrialWelcomeEmail } from "./resend";
import { fetchSubscription } from "./razorpay";

/**
 * Helper function to validate if a date is valid and not Unix epoch
 */
function isValidDate(date: any): boolean {
  if (!date) return false;

  const dateObj = new Date(date);

  // Check if it's a valid date
  if (isNaN(dateObj.getTime())) return false;

  // Check if it's not Unix epoch (1970-01-01) or close to it
  const epochTime = new Date("1970-01-01").getTime();
  const oneYearInMs = 365 * 24 * 60 * 60 * 1000;

  // Date should be at least one year after epoch to be considered valid
  return dateObj.getTime() > epochTime + oneYearInMs;
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
    const hasUsedTrial = await TrialHistory.hasUserUsedTrial(
      userId,
      trialType,
      communityId
    );

    if (hasUsedTrial) {
      return {
        eligible: false,
        reason: "User has already used a free trial for this service",
      };
    }

    // Check if there's an active trial in TrialHistory
    const activeTrial = await TrialHistory.getActiveTrial(
      userId,
      trialType,
      communityId
    );

    if (activeTrial) {
      return {
        eligible: false,
        reason: "User already has an active trial",
        existingTrial: activeTrial,
      };
    }

    // For community trials, check additional restrictions
    if (trialType === "community" && communityId) {
      const community = await Community.findById(communityId);

      if (!community) {
        return {
          eligible: false,
          reason: "Community not found",
        };
      }

      // Check if community admin is the requesting user
      if (community.admin.toString() !== userId) {
        return {
          eligible: false,
          reason: "Only community admin can activate trial",
        };
      }

      // Check if community already has active subscription
      const hasActiveSubscriptionStatus =
        await hasActiveSubscription(community);
      if (hasActiveSubscriptionStatus) {
        return {
          eligible: false,
          reason: "Community already has active subscription",
        };
      }

      // Check if community already has an active trial
      const hasActiveTrialStatus = await hasActiveTrial(community);
      if (hasActiveTrialStatus) {
        return {
          eligible: false,
          reason: "Community already has an active trial",
        };
      }

      // Check if community has used trial before (from adminTrialInfo)
      if (community.adminTrialInfo?.hasUsedTrial) {
        return {
          eligible: false,
          reason: "Community has already used its free trial",
        };
      }
    }

    return { eligible: true };
  } catch (error) {
    console.error("Error checking trial eligibility:", error);
    return {
      eligible: false,
      reason: "Error checking trial eligibility",
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
    const eligibility = await checkTrialEligibility(
      userId,
      trialType,
      communityId
    );

    if (!eligibility.eligible) {
      return {
        success: false,
        error: eligibility.reason,
      };
    }

    // Calculate trial end date (14 days from now)
    const trialStartDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialStartDate.getDate() + 14);

    // Create trial history record
    const trialHistory = new (TrialHistory as any)({
      userId,
      communityId: communityId ? communityId : undefined,
      trialType,
      startDate: trialStartDate,
      endDate: trialEndDate,
      status: "active",
      ipAddress,
      userAgent,
      metadata: {
        activatedAt: new Date(),
        source: "billing_page",
      },
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
        trialUsedAt: new Date(),
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
          cancelled: false,
        };
        community.paymentStatus = "trial";
        community.subscriptionEndDate = trialEndDate;
        community.freeTrialActivated = true;
        community.suspended = false; // Ensure community is not suspended

        await community.save();
      }
    }

    // Send welcome notification
    try {
      await sendTrialWelcomeNotification(
        userId,
        trialType,
        trialEndDate,
        communityId
      );
    } catch (notificationError) {
      // Log the notification error but don't fail the trial activation
      console.error(
        "Failed to send trial welcome notification:",
        notificationError
      );
      // Optionally, you could add additional error handling here such as:
      // - Storing the error for later retry
      // - Sending an alert to administrators
      // - Adding a flag to indicate notification failure
    }

    return {
      success: true,
      trialEndDate,
      trialHistory,
    };
  } catch (error) {
    console.error("Error activating trial:", error);
    return {
      success: false,
      error: "Failed to activate trial",
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

    let communityName = "";
    let linkUrl = "/profile";

    if (trialType === "community" && communityId) {
      const community = await Community.findById(communityId);
      if (community) {
        communityName = community.name;
        linkUrl = `/billing/${community.slug}`;
      }
    }

    const title =
      trialType === "community"
        ? `Trial Started for ${communityName}`
        : "Your Free Trial Has Started";

    const message =
      trialType === "community"
        ? `Your 14-day free trial for ${communityName} is now active. Trial expires on ${trialEndDate.toLocaleDateString()}.`
        : `Your 14-day free trial is now active. Trial expires on ${trialEndDate.toLocaleDateString()}.`;

    // Create in-app notification
    await createNotification({
      userId,
      title,
      message,
      type: "trial_started",
      linkUrl,
      metadata: {
        trialType,
        communityId,
        trialEndDate: trialEndDate.toISOString(),
      },
    });

    // Send email notification
    await sendTrialWelcomeEmail(user.email, {
      userName: user.name || user.username,
      communityName:
        trialType === "community" && communityId
          ? (await Community.findById(communityId))?.name
          : undefined,
      trialType,
      trialEndDate,
      paymentUrl: `${process.env.NEXTAUTH_URL}${linkUrl}`,
    });
  } catch (error) {
    console.error("Error sending trial welcome notification:", error);
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
    const activeTrial = await TrialHistory.getActiveTrial(
      userId,
      trialType,
      communityId
    );
    return !!activeTrial;
  } catch (error) {
    console.error("Error checking if trial is active:", error);
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
      throw new Error("Community not found");
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
    await (TrialHistory as any).updateMany(
      {
        userId,
        communityId,
        trialType: "community",
        status: "active",
      },
      {
        status: "converted",
        convertedAt: new Date(),
      }
    );

    if (process.env.NODE_ENV === "development") {
      console.log(`Trial state cleared for community ${communityId}`);
    }
    return { success: true };
  } catch (error) {
    console.error("Error clearing trial state:", error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get comprehensive community status including trial and subscription information
 */
export async function getCommunityStatus(communityId: string) {
  try {
    if (!communityId) {
      console.error("getCommunityStatus called without communityId");
      return {
        found: false,
        error: "Community ID is required",
      };
    }

    await dbconnect();

    const community = await Community.findById(communityId);
    if (!community) {
      if (process.env.NODE_ENV === "development") {
        console.error("Community not found for ID:", communityId);
      }
      return {
        found: false,
        error: "Community not found",
      };
    }

    const now = new Date();

    // Check subscription status
    const hasActiveSubscriptionStatus = await hasActiveSubscription(community);
    const hasPendingSubscriptionStatus =
      await hasPendingSubscription(community);

    // Simplified trial status checking - legacy system only
    let hasActiveTrialStatus = false;
    if (!hasActiveSubscriptionStatus) {
      hasActiveTrialStatus = await hasActiveTrial(community);
    }

    // Determine the primary status
    let status:
      | "active_subscription"
      | "pending_subscription"
      | "active_trial"
      | "expired"
      | "suspended"
      | "unpaid" = "unpaid";
    let daysRemaining = 0;
    let endDate: Date | null = null;

    if (hasActiveSubscriptionStatus) {
      status = "active_subscription";
      if (community.subscriptionEndDate) {
        endDate = new Date(community.subscriptionEndDate);
        const diffTime = endDate.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    } else if (hasActiveTrialStatus) {
      status = "active_trial";
      // For legacy trials, always use subscriptionEndDate
      if (community.subscriptionEndDate) {
        endDate = new Date(community.subscriptionEndDate);
        const diffTime = endDate.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    } else if (hasPendingSubscriptionStatus) {
      status = "pending_subscription";
      if (community.subscriptionEndDate) {
        endDate = new Date(community.subscriptionEndDate);
        const diffTime = endDate.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    } else if (community.suspended) {
      status = "suspended";
    } else {
      status = "expired";
    }

    // Get subscription details if available
    let subscriptionDetails = null;
    if (community.subscriptionId) {
      try {
        subscriptionDetails = await fetchSubscription(community.subscriptionId);
      } catch (err) {
        console.error("Error fetching subscription details:", err);

        // Provide specific guidance for authentication errors
        if (err instanceof Error && err.message.includes('Authentication failed')) {
          console.error('🔑 Razorpay authentication failed. Please check:');
          console.error('1. RAZORPAY_KEY_ID is correct in environment variables');
          console.error('2. RAZORPAY_KEY_SECRET is correct in environment variables');
          console.error('3. Credentials are from the correct Razorpay account');
          console.error('4. Account has necessary API permissions');
          console.error('📖 See RAZORPAY_DEBUG_GUIDE.md for detailed troubleshooting');
        }

        // Don't throw, just continue without subscription details
        subscriptionDetails = null;
      }
    }

    // Only truly active subscriptions
    const effectivelyActiveSubscription = hasActiveSubscriptionStatus;

    // --- Mutual exclusivity enforced: ---
    // - hasActiveTrial: true only if no active or pending paid subscription
    // - hasActiveSubscription: true only if paid subscription is active

    return {
      found: true,
      community: {
        _id: community._id,
        name: community.name,
        slug: community.slug,
        admin: community.admin,
        paymentStatus: community.paymentStatus,
        // Legacy trial system only - no adminTrialInfo needed
        freeTrialActivated: community.freeTrialActivated,
        subscriptionEndDate: isValidDate(community.subscriptionEndDate)
          ? community.subscriptionEndDate
          : null,
        subscriptionId: community.subscriptionId,
        subscriptionStatus: subscriptionDetails?.status || null,
        suspended: community.suspended,
      },
      status,
      hasActiveSubscription: effectivelyActiveSubscription,
      hasActiveTrial: hasActiveTrialStatus,
      hasPendingSubscription: hasPendingSubscriptionStatus,
      daysRemaining: Math.max(0, daysRemaining),
      endDate,
      isEligibleForTrial:
        !effectivelyActiveSubscription &&
        !hasActiveTrialStatus &&
        !community.freeTrialActivated, // Legacy system - if trial was ever activated, not eligible again
    };
  } catch (error) {
    console.error("Error getting community status:", error);
    return {
      found: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get community status",
    };
  }
}

/**
 * Check if community has paid payment status
 */
function checkPaymentStatus(community: any): boolean {
  return community.paymentStatus === "paid";
}

/**
 * Validate subscription end date - must be valid and in the future
 */
function validateSubscriptionEndDate(community: any): boolean {
  return (
    community.subscriptionEndDate &&
    isValidDate(community.subscriptionEndDate) &&
    new Date(community.subscriptionEndDate) > new Date()
  );
}

/**
 * Fetch and evaluate subscription record
 */
async function fetchSubscriptionRecord(community: any): Promise<{
  hasActiveRecord: boolean;
  status: string | null;
  hasPending: boolean;
  error?: string;
}> {
  if (!community.subscriptionId) {
    return {
      hasActiveRecord: false,
      status: null,
      hasPending: false,
    };
  }

  try {
    const subscription = await CommunitySubscription.findOne({
      razorpaySubscriptionId: community.subscriptionId,
    });

    if (!subscription) {
      return {
        hasActiveRecord: false,
        status: null,
        hasPending: false,
      };
    }

    const status = subscription.status;
    const hasActiveRecord = ["active", "authenticated"].includes(status);

    // Check for pending subscription (created status with valid dates)
    const hasPending =
      status === "created" &&
      subscription.currentEnd &&
      isValidDate(subscription.currentEnd) &&
      new Date(subscription.currentEnd) > new Date();

    // For active subscriptions, also verify they have valid current dates
    let finalActiveRecord = hasActiveRecord;
    if (hasActiveRecord) {
      const hasValidCurrentDates =
        subscription.currentEnd &&
        isValidDate(subscription.currentEnd) &&
        new Date(subscription.currentEnd) > new Date();

      finalActiveRecord = hasActiveRecord && hasValidCurrentDates;
    }

    return {
      hasActiveRecord: finalActiveRecord,
      status,
      hasPending,
    };
  } catch (error) {
    console.error("Error checking subscription record:", error);
    return {
      hasActiveRecord: false,
      status: null,
      hasPending: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Combine subscription checks to determine active subscription state
 */
function combineSubscriptionChecks(
  hasActivePaidStatus: boolean,
  hasActiveSubscriptionEndDate: boolean,
  subscriptionRecord: {
    hasActiveRecord: boolean;
    status: string | null;
    hasPending: boolean;
  }
): {
  isValidActiveSubscription: boolean;
  hasPendingSubscriptionWithValidDates: boolean;
} {
  const { hasActiveRecord, status, hasPending } = subscriptionRecord;

  // Enhanced logic for determining active subscription:
  // 1. Has an active subscription record with valid dates, OR
  // 2. Paid status AND valid community subscription end date, OR
  // 3. Has subscription record status "active" or "authenticated" even if community paymentStatus isn't "paid" yet (webhook delay)
  const isValidActiveSubscription =
    hasActiveRecord ||
    (hasActivePaidStatus && hasActiveSubscriptionEndDate) ||
    (status !== null &&
      ["active", "authenticated"].includes(status) &&
      Boolean(hasActiveSubscriptionEndDate));

  // For pending subscriptions, we'll return false here but handle them separately in the calling function
  const hasPendingSubscriptionWithValidDates =
    hasPending && hasActiveSubscriptionEndDate;
  return {
    isValidActiveSubscription: Boolean(isValidActiveSubscription),
    hasPendingSubscriptionWithValidDates: Boolean(
      hasPendingSubscriptionWithValidDates
    ),
  };
}

/**
 * Check if a community has an active subscription
 */
async function hasActiveSubscription(community: any): Promise<boolean> {
  // Check individual components
  const hasActivePaidStatus = checkPaymentStatus(community);
  const hasActiveSubscriptionEndDate = validateSubscriptionEndDate(community);
  const subscriptionRecord = await fetchSubscriptionRecord(community);

  // Combine all checks
  const { isValidActiveSubscription, hasPendingSubscriptionWithValidDates } =
    combineSubscriptionChecks(
      hasActivePaidStatus,
      hasActiveSubscriptionEndDate,
      subscriptionRecord
    );

  // Debug logging in development
  if (process.env.NODE_ENV === "development") {
    console.log("Subscription status check: ", isValidActiveSubscription);
  }

  return isValidActiveSubscription;
}

/**
 * Check if a community has a pending subscription (created but not yet activated)
 */
async function hasPendingSubscription(community: any): Promise<boolean> {
  if (!community.subscriptionId) return false;

  try {
    const subscription = await CommunitySubscription.findOne({
      razorpaySubscriptionId: community.subscriptionId,
    });

    if (subscription) {
      const isPending =
        subscription.status === "created" &&
        subscription.currentEnd &&
        isValidDate(subscription.currentEnd) &&
        new Date(subscription.currentEnd) > new Date();

      return isPending;
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error checking pending subscription:", error);
    }
  }

  return false;
}

/**
 * Check if a community has an active trial (Legacy system only)
 */
async function hasActiveTrial(community: any): Promise<boolean> {
  const now = new Date();

  // Debug all the conditions
  const freeTrialActivated = community.freeTrialActivated === true;
  const hasSubscriptionEndDate = !!community.subscriptionEndDate;
  const dateIsValid = isValidDate(community.subscriptionEndDate);
  const endDate = community.subscriptionEndDate
    ? new Date(community.subscriptionEndDate)
    : null;
  const endDateInFuture = endDate ? endDate > now : false;

  // Be more flexible with payment status - if freeTrialActivated=true and we have a future end date,
  // consider it active regardless of paymentStatus (could be "trial", "unpaid", or undefined)
  const paymentStatusCompatible =
    !community.paymentStatus ||
    community.paymentStatus === "trial" ||
    community.paymentStatus === "unpaid";

  // Only check legacy trial fields - more flexible logic
  const hasActiveLegacyTrial =
    freeTrialActivated &&
    hasSubscriptionEndDate &&
    dateIsValid &&
    endDateInFuture &&
    paymentStatusCompatible;

  if (process.env.NODE_ENV === "development") {
    console.log("🔍 hasActiveTrial debug:");
  }

  return hasActiveLegacyTrial;
}
