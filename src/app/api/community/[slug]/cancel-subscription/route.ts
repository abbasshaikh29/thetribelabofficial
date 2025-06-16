import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { CommunitySubscription } from "@/models/Subscription";
import { Community } from "@/models/Community";
import { User } from "@/models/User";
import { cancelSubscription } from "@/lib/razorpay";

// POST /api/community/[slug]/cancel-subscription - Cancel community subscription by community slug
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const resolvedParams = await context.params;
    const { slug } = resolvedParams;
    const { communityId, cancelAtCycleEnd = true } = await request.json();

    if (!slug) {
      return NextResponse.json(
        { error: "Community slug is required" },
        { status: 400 }
      );
    }

    // Find the community by slug
    const community = await Community.findOne({ slug });
    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Verify user is the admin of this community
    if (community.admin.toString() !== session.user.id) {
      return NextResponse.json(
        { error: "Only community admin can cancel subscription" },
        { status: 403 }
      );
    }

    // Find the active subscription for this community
    const subscription = await CommunitySubscription.findOne({
      communityId: community._id,
      adminId: session.user.id,
      status: { $in: ['active', 'authenticated'] }
    }).sort({ createdAt: -1 }); // Get the most recent active subscription

    if (!subscription) {
      return NextResponse.json(
        { error: "No active subscription found for this community" },
        { status: 404 }
      );
    }

    // Cancel subscription in Razorpay
    const cancelledSubscription = await cancelSubscription(
      subscription.razorpaySubscriptionId, 
      cancelAtCycleEnd
    );

    // Update subscription status in database
    subscription.status = "cancelled";
    subscription.endedAt = new Date();
    
    // Add webhook event to history
    subscription.webhookEvents.push({
      event: "subscription.cancelled",
      receivedAt: new Date(),
      processed: true,
      data: { 
        subscriptionId: subscription.razorpaySubscriptionId, 
        cancelAtCycleEnd,
        cancelledBy: session.user.id,
        cancelledAt: new Date().toISOString(),
        cancelledVia: "community-endpoint"
      }
    });

    await subscription.save();

    // Update user's admin subscription status
    await User.findByIdAndUpdate(session.user.id, {
      "communityAdminSubscription.subscriptionStatus": "cancelled"
    });

    // Update community subscription status
    const updateData: any = {
      subscriptionStatus: "cancelled"
    };

    // If cancelling immediately, set payment status to expired
    if (!cancelAtCycleEnd) {
      updateData.paymentStatus = "expired";
    }

    await Community.findByIdAndUpdate(community._id, updateData);

    const message = cancelAtCycleEnd 
      ? "Subscription cancelled successfully. You will continue to have access until the end of your current billing period. No refunds will be provided."
      : "Subscription cancelled immediately. Access has been revoked. No refunds will be provided.";

    return NextResponse.json({
      success: true,
      message,
      subscription: {
        id: subscription.razorpaySubscriptionId,
        status: subscription.status,
        endedAt: subscription.endedAt,
        cancelAtCycleEnd
      }
    });

  } catch (error: any) {
    console.error("Error cancelling community subscription:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
