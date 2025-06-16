import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import { CommunitySubscription } from "@/models/Subscription";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { slug, action } = await req.json();

    if (!slug || !action) {
      return NextResponse.json(
        { error: "Community slug and action are required" },
        { status: 400 }
      );
    }

    if (!['cleanup', 'force-reset'].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'cleanup' or 'force-reset'" },
        { status: 400 }
      );
    }

    await dbconnect();

    // Find the community
    const community = await Community.findOne({ slug });
    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Check if user is admin of the community
    if (community.admin.toString() !== session.user.id) {
      return NextResponse.json(
        { error: "Only community admin can resolve subscription conflicts" },
        { status: 403 }
      );
    }

    const results = {
      action,
      removedSubscriptions: 0,
      updatedCommunityFields: [] as string[],
      errors: [] as string[],
      details: [] as string[]
    };

    // Find all subscription records for this community and admin
    const allSubscriptions = await CommunitySubscription.find({
      $or: [
        { communityId: community._id },
        { adminId: session.user.id }
      ]
    }).sort({ createdAt: -1 });

    const now = new Date();

    if (action === 'cleanup') {
      // Smart cleanup - remove only problematic subscriptions
      
      // 1. Remove expired subscriptions that are still marked as active
      const expiredActiveSubscriptions = allSubscriptions.filter(sub => 
        ['active', 'authenticated', 'created'].includes(sub.status) && 
        sub.currentEnd && 
        new Date(sub.currentEnd) < now
      );

      for (const sub of expiredActiveSubscriptions) {
        try {
          await CommunitySubscription.findByIdAndUpdate(sub._id, {
            status: 'expired'
          });
          results.details.push(`Marked subscription ${sub.razorpaySubscriptionId} as expired`);
        } catch (error: any) {
          results.errors.push(`Failed to update subscription ${sub.razorpaySubscriptionId}: ${error.message || error}`);
        }
      }

      // 2. Remove subscriptions with invalid dates
      const invalidDateSubscriptions = allSubscriptions.filter(sub => 
        !sub.currentEnd || isNaN(new Date(sub.currentEnd).getTime())
      );

      for (const sub of invalidDateSubscriptions) {
        try {
          await CommunitySubscription.findByIdAndDelete(sub._id);
          results.removedSubscriptions++;
          results.details.push(`Removed subscription with invalid dates: ${sub.razorpaySubscriptionId}`);
        } catch (error: any) {
          results.errors.push(`Failed to remove subscription ${sub.razorpaySubscriptionId}: ${error.message || error}`);
        }
      }

      // 3. Clean up community subscription reference if it points to non-existent or inactive subscription
      if (community.subscriptionId) {
        const linkedSubscription = allSubscriptions.find(sub => 
          sub.razorpaySubscriptionId === community.subscriptionId
        );
        
        if (!linkedSubscription || !['active', 'authenticated'].includes(linkedSubscription.status)) {
          community.subscriptionId = null;
          results.updatedCommunityFields.push('subscriptionId (cleared orphaned reference)');
        }
      }

      // 4. Reset payment status if no valid active subscriptions exist
      const validActiveSubscriptions = allSubscriptions.filter(sub => 
        ['active', 'authenticated'].includes(sub.status) && 
        sub.currentEnd && 
        new Date(sub.currentEnd) > now
      );

      if (community.paymentStatus === 'paid' && validActiveSubscriptions.length === 0) {
        community.paymentStatus = 'unpaid';
        results.updatedCommunityFields.push('paymentStatus (reset to unpaid)');
      }

    } else if (action === 'force-reset') {
      // Force reset - remove all conflicting subscriptions
      
      const conflictingSubscriptions = allSubscriptions.filter(sub => 
        ['active', 'trial', 'past_due', 'authenticated', 'created'].includes(sub.status)
      );

      for (const sub of conflictingSubscriptions) {
        try {
          await CommunitySubscription.findByIdAndDelete(sub._id);
          results.removedSubscriptions++;
          results.details.push(`Force removed subscription: ${sub.razorpaySubscriptionId}`);
        } catch (error: any) {
          results.errors.push(`Failed to remove subscription ${sub.razorpaySubscriptionId}: ${error.message || error}`);
        }
      }

      // Reset all community subscription fields
      community.subscriptionId = null;
      community.paymentStatus = 'unpaid';
      community.subscriptionEndDate = null;
      community.subscriptionStartDate = null;
      
      // Reset admin trial info to allow fresh start
      if (community.adminTrialInfo) {
        community.adminTrialInfo.activated = false;
        community.adminTrialInfo.hasUsedTrial = false;
        community.adminTrialInfo.cancelled = false;
        community.adminTrialInfo.startDate = null;
        community.adminTrialInfo.endDate = null;
        community.adminTrialInfo.cancelledDate = null;
        community.adminTrialInfo.trialUsedAt = null;
      }

      results.updatedCommunityFields.push(
        'subscriptionId (cleared)',
        'paymentStatus (reset to unpaid)',
        'subscriptionEndDate (cleared)',
        'subscriptionStartDate (cleared)',
        'adminTrialInfo (reset)'
      );
    }

    // Save community changes
    if (results.updatedCommunityFields.length > 0) {
      try {
        await community.save();
        results.details.push('Community data updated successfully');
      } catch (error: any) {
        results.errors.push(`Failed to update community: ${error.message || error}`);
      }
    }

    const message = action === 'cleanup' 
      ? `Smart cleanup completed: ${results.removedSubscriptions} subscriptions removed, ${results.updatedCommunityFields.length} community fields updated`
      : `Force reset completed: ${results.removedSubscriptions} subscriptions removed, community subscription data reset`;

    return NextResponse.json({
      success: true,
      message,
      results
    });

  } catch (error: any) {
    console.error("Error resolving subscription conflicts:", error);
    return NextResponse.json(
      { error: error.message || "Failed to resolve subscription conflicts" },
      { status: 500 }
    );
  }
}
