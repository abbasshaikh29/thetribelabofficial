import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { CommunitySubscription } from "@/models/Subscription";
import { Community } from "@/models/Community";
import { User } from "@/models/User";
import { cancelSubscription } from "@/lib/razorpay";

// POST /api/community-subscriptions/cancel - Cancel community subscription
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const { subscriptionId, communityId, cancelAtCycleEnd = true } = await request.json();

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "Subscription ID is required" },
        { status: 400 }
      );
    }

    // Find the subscription
    const subscription = await CommunitySubscription.findOne({
      razorpaySubscriptionId: subscriptionId,
      adminId: session.user.id
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found or you don't have permission to cancel it" },
        { status: 404 }
      );
    }

    // Check if subscription is already cancelled
    if (subscription.status === "cancelled") {
      return NextResponse.json(
        { error: "Subscription is already cancelled" },
        { status: 400 }
      );
    }

    // Cancel subscription in Razorpay
    const cancelledSubscription = await cancelSubscription(subscriptionId, cancelAtCycleEnd);

    // Update subscription status in database
    subscription.status = "cancelled";
    subscription.endedAt = new Date();
    
    // Add webhook event to history
    subscription.webhookEvents.push({
      event: "subscription.cancelled",
      receivedAt: new Date(),
      processed: true,
      data: { 
        subscriptionId, 
        cancelAtCycleEnd,
        cancelledBy: session.user.id,
        cancelledAt: new Date().toISOString()
      }
    });

    await subscription.save();

    // Update user's admin subscription status
    await User.findByIdAndUpdate(session.user.id, {
      "communityAdminSubscription.subscriptionStatus": "cancelled"
    });

    // Update community subscription status if communityId provided
    if (communityId) {
      const updateData: any = {
        subscriptionStatus: "cancelled"
      };

      // If cancelling immediately, set payment status to expired
      if (!cancelAtCycleEnd) {
        updateData.paymentStatus = "expired";
      }

      await Community.findByIdAndUpdate(communityId, updateData);
    }

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
