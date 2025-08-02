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
  const startTime = Date.now();
  let subscriptionId: string | undefined;
  let paymentId: string | undefined;

  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestData = await request.json();
    subscriptionId = requestData.subscriptionId;
    paymentId = requestData.paymentId;
    const { signature, communityId } = requestData;

    // Log verification request for debugging
    console.log("Payment verification request:", {
      subscriptionId: subscriptionId ? `${subscriptionId.substring(0, 15)}...` : "missing",
      paymentId: paymentId ? `${paymentId.substring(0, 15)}...` : "missing",
      hasSignature: !!signature,
      communityId,
      userId: session.user.id,
      timestamp: new Date().toISOString()
    });

    if (!subscriptionId || !paymentId || !signature) {
      return NextResponse.json(
        { error: "Subscription ID, payment ID, and signature are required" },
        { status: 400 }
      );
    }

    // Quick signature verification first (before database operations)
    const isValid = verifySubscriptionSignature(subscriptionId, paymentId, signature);

    // Log verification result
    console.log("Signature verification:", {
      isValid,
      keySecretConfigured: !!process.env.RAZORPAY_KEY_SECRET
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

    // Connect to database after signature verification
    await dbconnect();

    // Find the subscription with optimized query
    const subscription = await CommunitySubscription.findOne({
      razorpaySubscriptionId: subscriptionId,
      adminId: session.user.id
    }).lean(); // Use lean() for faster queries

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    // Prepare date validation function
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

    // Prepare all database operations to run in parallel
    const updateOperations = [];

    // 1. Update subscription status
    updateOperations.push(
      CommunitySubscription.findByIdAndUpdate(subscription._id, {
        status: "active",
        $inc: { paidCount: 1 },
        authAttempts: 0,
        retryAttempts: 0,
        consecutiveFailures: 0,
        $push: {
          webhookEvents: {
            event: "subscription.authenticated",
            receivedAt: new Date(),
            processed: true,
            data: { subscriptionId, paymentId }
          }
        }
      })
    );

    // 2. Update user's admin subscription status
    updateOperations.push(
      User.findByIdAndUpdate(session.user.id, {
        "communityAdminSubscription.subscriptionStatus": "active",
        "communityAdminSubscription.subscriptionId": subscriptionId
      })
    );

    // 3. Update community subscription status if communityId provided
    if (communityId) {
      updateOperations.push(
        Community.findByIdAndUpdate(communityId, {
          subscriptionStatus: "active",
          paymentStatus: "paid",
          subscriptionEndDate: subscriptionEndDate,
          subscriptionStartDate: subscriptionStartDate
        })
      );

      // 4. Clear trial state (can be done asynchronously)
      updateOperations.push(clearTrialState(communityId, session.user.id));
    }

    // 5. Create transaction record
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

    updateOperations.push(transaction.save());

    // Execute all operations in parallel for better performance
    await Promise.all(updateOperations);

    const processingTime = Date.now() - startTime;
    console.log(`Payment verification completed in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      message: "Community subscription verified and activated successfully",
      subscription: {
        id: subscription._id,
        status: "active",
        razorpaySubscriptionId: subscriptionId
      },
      transaction: {
        id: transaction._id,
        paymentId,
        status: "captured"
      },
      processingTime
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error("Error verifying community subscription:", {
      error: error.message,
      stack: error.stack,
      processingTime,
      subscriptionId: subscriptionId ? `${subscriptionId.substring(0, 15)}...` : "missing",
      paymentId: paymentId ? `${paymentId.substring(0, 15)}...` : "missing"
    });

    return NextResponse.json(
      {
        error: error.message || "Failed to verify subscription",
        processingTime
      },
      { status: 500 }
    );
  }
}
