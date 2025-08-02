import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { verifySubscriptionSignature } from "@/lib/razorpay";
import { CommunitySubscription } from "@/models/Subscription";
import { User } from "@/models/User";
import { Community } from "@/models/Community";
import { Transaction } from "@/models/Transaction";

// GET /api/auth/callback/razorpay - Handle Razorpay hosted checkout return
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get("razorpay_subscription_id");
    const paymentId = searchParams.get("razorpay_payment_id");
    const signature = searchParams.get("razorpay_signature");
    const communityId = searchParams.get("community_id");
    
    console.log("Razorpay callback received:", {
      subscriptionId: subscriptionId ? `${subscriptionId.substring(0, 15)}...` : "missing",
      paymentId: paymentId ? `${paymentId.substring(0, 15)}...` : "missing",
      hasSignature: !!signature,
      communityId
    });

    const session = await getServerSession();
    if (!session?.user?.id) {
      // Redirect to login with callback URL
      const redirectUrl = `/login?callbackUrl=${encodeURIComponent(request.url)}`;
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    if (!subscriptionId || !paymentId || !signature) {
      // Redirect to error page
      const errorUrl = `/community/payment-error?error=missing_parameters`;
      return NextResponse.redirect(new URL(errorUrl, request.url));
    }

    await dbconnect();

    // Find the subscription
    const subscription = await CommunitySubscription.findOne({
      razorpaySubscriptionId: subscriptionId,
      adminId: session.user.id
    });

    if (!subscription) {
      const errorUrl = `/community/payment-error?error=subscription_not_found`;
      return NextResponse.redirect(new URL(errorUrl, request.url));
    }

    // Verify the signature
    const isValid = verifySubscriptionSignature(subscriptionId, paymentId, signature);
    
    if (!isValid && process.env.NODE_ENV !== 'development') {
      console.error("Signature verification failed in callback");
      const errorUrl = `/community/payment-error?error=invalid_signature`;
      return NextResponse.redirect(new URL(errorUrl, request.url));
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
      const isValidDate = (date: Date): boolean => {
        return date && !isNaN(date.getTime()) && date.getTime() > new Date('1971-01-01').getTime();
      };

      const subscriptionStartDate = isValidDate(subscription.currentStart)
        ? subscription.currentStart
        : new Date();

      const subscriptionEndDate = isValidDate(subscription.currentEnd)
        ? subscription.currentEnd
        : new Date(subscriptionStartDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      await Community.findByIdAndUpdate(communityId, {
        subscriptionStatus: "active",
        paymentStatus: "paid",
        subscriptionEndDate: subscriptionEndDate,
        subscriptionStartDate: subscriptionStartDate
      });

      // Get community slug for redirect
      const community = await Community.findById(communityId);
      if (community?.slug) {
        const successUrl = `/Newcompage/${community.slug}?subscription=success&payment=completed`;
        return NextResponse.redirect(new URL(successUrl, request.url));
      }
    }

    // Create transaction record
    const transaction = new Transaction({
      orderId: `sub_auth_${subscriptionId}_${Date.now()}`,
      paymentId,
      signature,
      amount: subscription.amount / 100,
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

    // Default success redirect
    const successUrl = `/admin/communities?subscription=success&payment=completed`;
    return NextResponse.redirect(new URL(successUrl, request.url));

  } catch (error: any) {
    console.error("Error in Razorpay callback:", error);
    const errorUrl = `/community/payment-error?error=processing_failed`;
    return NextResponse.redirect(new URL(errorUrl, request.url));
  }
}
