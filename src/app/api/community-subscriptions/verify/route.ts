import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { verifySubscriptionSignature } from "@/lib/razorpay";
import { CommunitySubscription } from "@/models/Subscription";
import { User } from "@/models/User";
import { Community } from "@/models/Community";
import { Transaction } from "@/models/Transaction";
import { clearTrialState } from "@/lib/trial-service";

// POST /api/community-subscriptions/verify - Verify community subscription payment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const { subscriptionId, paymentId, signature, communityId } = await request.json();

    // Log verification request for debugging
    console.log("Payment verification request:", {
      subscriptionId: subscriptionId ? `${subscriptionId.substring(0, 15)}...` : "missing",
      paymentId: paymentId ? `${paymentId.substring(0, 15)}...` : "missing",
      hasSignature: !!signature,
      communityId,
      userId: session.user.id
    });

    if (!subscriptionId || !paymentId || !signature) {
      return NextResponse.json(
        { error: "Subscription ID, payment ID, and signature are required" },
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
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    // Verify the signature
    const isValid = verifySubscriptionSignature(subscriptionId, paymentId, signature);

    // Log verification result
    console.log("Signature verification:", {
      isValid,
      subscriptionFound: !!subscription,
      subscriptionStatus: subscription?.status
    });

    if (!isValid) {
      console.error("Signature verification failed for:", {
        subscriptionId,
        paymentId,
        signaturePrefix: signature.substring(0, 10),
        keySecretConfigured: !!process.env.RAZORPAY_KEY_SECRET
      });

      // In development, we might want to be more lenient for testing
      if (process.env.NODE_ENV === 'development') {
        console.warn("⚠️  Development mode: Proceeding despite signature verification failure");
        // Still proceed in development for testing purposes
      } else {
        return NextResponse.json(
          { error: "Invalid payment signature" },
          { status: 400 }
        );
      }
    }

    // Update subscription status
    subscription.status = "active";
    subscription.paidCount += 1;
    subscription.authAttempts = 0;
    subscription.retryAttempts = 0;
    subscription.consecutiveFailures = 0;
    
    // Add webhook event to history
    subscription.webhookEvents.push({
      event: "subscription.authenticated",
      receivedAt: new Date(),
      processed: true,
      data: { subscriptionId, paymentId }
    });

    await subscription.save();

    // Update user's admin subscription status
    await User.findByIdAndUpdate(session.user.id, {
      "communityAdminSubscription.subscriptionStatus": "active",
      "communityAdminSubscription.subscriptionId": subscriptionId
    });

    // Update community subscription status if communityId provided
    if (communityId) {
      // Validate subscription dates before using them
      const isValidDate = (date: Date): boolean => {
        return date && !isNaN(date.getTime()) && date.getTime() > new Date('1971-01-01').getTime();
      };

      // Use validated dates or calculate proper fallbacks
      const subscriptionStartDate = isValidDate(subscription.currentStart)
        ? subscription.currentStart
        : new Date(); // Use current date as fallback

      const subscriptionEndDate = isValidDate(subscription.currentEnd)
        ? subscription.currentEnd
        : new Date(subscriptionStartDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from start

      console.log('Verifying subscription - setting community dates:', {
        subscriptionStartDate: subscriptionStartDate.toISOString(),
        subscriptionEndDate: subscriptionEndDate.toISOString(),
        originalCurrentStart: subscription.currentStart,
        originalCurrentEnd: subscription.currentEnd,
        isCurrentStartValid: isValidDate(subscription.currentStart),
        isCurrentEndValid: isValidDate(subscription.currentEnd)
      });

      await Community.findByIdAndUpdate(communityId, {
        subscriptionStatus: "active",
        paymentStatus: "paid",
        subscriptionEndDate: subscriptionEndDate,
        subscriptionStartDate: subscriptionStartDate
      });

      // Clear trial state now that subscription is active
      await clearTrialState(communityId, session.user.id);
    }

    // Create transaction record for the authentication payment
    const transaction = new Transaction({
      orderId: `sub_auth_${subscriptionId}_${Date.now()}`,
      paymentId,
      signature,
      amount: subscription.amount / 100, // Convert from paise to rupees
      currency: subscription.currency,
      status: "captured",
      paymentType: "community_subscription",
      payerId: session.user.id,
      metadata: {
        subscriptionId,
        communityId: communityId || null,
        isAuthentication: true,
        authenticatedAt: new Date().toISOString()
      }
    });

    await transaction.save();

    return NextResponse.json({
      success: true,
      message: "Community subscription verified and activated successfully",
      subscription,
      transaction
    });

  } catch (error: any) {
    console.error("Error verifying community subscription:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify subscription" },
      { status: 500 }
    );
  }
}
