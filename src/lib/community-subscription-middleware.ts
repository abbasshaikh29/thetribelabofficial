import { Community } from "@/models/Community";
import { CommunitySubscriptionPlan } from "@/models/PaymentPlan";
import mongoose from "mongoose";

/**
 * Middleware to ensure communities have subscription plans
 * This helps during the migration period when some communities might not have plans yet
 */

interface CommunityWithSubscription {
  _id: string;
  subscriptionPlanId?: mongoose.Types.ObjectId;
  subscriptionStatus?: string;
  trialEndDate?: Date;
  [key: string]: any;
}

/**
 * Get or create a default subscription plan for legacy communities
 */
async function getDefaultSubscriptionPlan() {
  try {
    // Try to find existing legacy starter plan
    let defaultPlan = await CommunitySubscriptionPlan.findOne({ 
      name: "Legacy Starter" 
    });

    if (!defaultPlan) {
      // Create a default plan if it doesn't exist
      defaultPlan = await CommunitySubscriptionPlan.create({
        name: "Legacy Starter",
        description: "Default plan for existing communities during migration",
        amount: 0, // Free during migration
        currency: "INR",
        interval: "monthly",
        intervalCount: 1,
        trialPeriodDays: 14,
        features: [
          "Unlimited members",
          "Unlimited storage", 
          "Unlimited events",
          "Unlimited channels",
          "Basic analytics",
          "Email support",
          "Legacy community access"
        ],
        razorpayPlanId: "plan_legacy_starter_free",
        allowCustomBranding: false,
        prioritySupport: false,
        analyticsAccess: true,
        advancedAnalytics: false,
        apiAccess: false,
        whitelabelOptions: false,
        dedicatedSupport: false,
        customIntegrations: false,
        isActive: true
      });
      
      console.log('Created default subscription plan for legacy communities');
    }

    return defaultPlan;
  } catch (error) {
    console.error('Error getting default subscription plan:', error);
    throw error;
  }
}

/**
 * Ensure a community has a subscription plan
 * If not, assign the default plan and set trial status
 */
export async function ensureCommunityHasSubscriptionPlan(communityId: string): Promise<CommunityWithSubscription> {
  try {
    const community = await Community.findById(communityId);
    
    if (!community) {
      throw new Error('Community not found');
    }

    // If community already has a subscription plan, return it
    if (community.subscriptionPlanId) {
      return community;
    }

    // Get default plan
    const defaultPlan = await getDefaultSubscriptionPlan();
    
    // Update community with default plan and trial status
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days trial

    const updatedCommunity = await Community.findByIdAndUpdate(
      communityId,
      {
        subscriptionPlanId: defaultPlan._id,
        subscriptionStatus: "trial",
        subscriptionStartDate: now,
        trialEndDate: trialEndDate
      },
      { new: true }
    );

    console.log(`Assigned default subscription plan to community: ${community.name}`);
    
    return updatedCommunity;
  } catch (error) {
    console.error('Error ensuring community has subscription plan:', error);
    throw error;
  }
}

/**
 * Check if a community's subscription is active
 */
export async function isCommunitySubscriptionActive(communityId: string): Promise<boolean> {
  try {
    const community = await ensureCommunityHasSubscriptionPlan(communityId);
    
    // During trial period or active subscription
    if (community.subscriptionStatus === "trial") {
      // Check if trial is still valid
      if (community.trialEndDate && new Date() < new Date(community.trialEndDate)) {
        return true;
      }
      // Trial expired, update status
      await Community.findByIdAndUpdate(communityId, {
        subscriptionStatus: "expired"
      });
      return false;
    }
    
    return community.subscriptionStatus === "active";
  } catch (error) {
    console.error('Error checking community subscription status:', error);
    // Default to true during migration to avoid breaking existing functionality
    return true;
  }
}

/**
 * Get community subscription details with plan information
 */
export async function getCommunitySubscriptionDetails(communityId: string) {
  try {
    const community = await ensureCommunityHasSubscriptionPlan(communityId);
    
    const communityWithPlan = await Community.findById(communityId)
      .populate('subscriptionPlanId');
    
    return {
      community: communityWithPlan,
      isActive: await isCommunitySubscriptionActive(communityId),
      plan: communityWithPlan?.subscriptionPlanId,
      status: communityWithPlan?.subscriptionStatus || "trial",
      trialEndDate: communityWithPlan?.trialEndDate,
      subscriptionEndDate: communityWithPlan?.subscriptionEndDate
    };
  } catch (error) {
    console.error('Error getting community subscription details:', error);
    throw error;
  }
}

/**
 * Middleware function to use in API routes
 */
export async function withCommunitySubscription(
  communityId: string,
  handler: (community: CommunityWithSubscription) => Promise<any>
) {
  try {
    const community = await ensureCommunityHasSubscriptionPlan(communityId);
    return await handler(community);
  } catch (error) {
    console.error('Community subscription middleware error:', error);
    throw error;
  }
}

/**
 * Batch update all communities without subscription plans
 */
export async function batchUpdateCommunitiesWithDefaultPlan() {
  try {
    const defaultPlan = await getDefaultSubscriptionPlan();
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const result = await Community.updateMany(
      {
        $or: [
          { subscriptionPlanId: { $exists: false } },
          { subscriptionPlanId: null }
        ]
      },
      {
        $set: {
          subscriptionPlanId: defaultPlan._id,
          subscriptionStatus: "trial",
          subscriptionStartDate: now,
          trialEndDate: trialEndDate
        }
      }
    );

    console.log(`Batch updated ${result.modifiedCount} communities with default subscription plan`);
    return result;
  } catch (error) {
    console.error('Error in batch update:', error);
    throw error;
  }
}
