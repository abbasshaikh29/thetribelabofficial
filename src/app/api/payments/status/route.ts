import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { CommunitySubscription } from "@/models/Subscription";
import { Transaction } from "@/models/Transaction";

// GET /api/payments/status - Check payment and subscription status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscriptionId');
    const paymentId = searchParams.get('paymentId');

    if (!subscriptionId && !paymentId) {
      return NextResponse.json(
        { error: "Either subscriptionId or paymentId is required" },
        { status: 400 }
      );
    }

    await dbconnect();

    const result: any = {
      timestamp: new Date().toISOString(),
      userId: session.user.id
    };

    // Check subscription status
    if (subscriptionId) {
      const subscription = await CommunitySubscription.findOne({
        razorpaySubscriptionId: subscriptionId,
        adminId: session.user.id
      }).lean();

      result.subscription = subscription ? {
        id: subscription._id,
        status: subscription.status,
        razorpaySubscriptionId: subscription.razorpaySubscriptionId,
        paidCount: subscription.paidCount,
        authAttempts: subscription.authAttempts,
        consecutiveFailures: subscription.consecutiveFailures,
        lastWebhookEvent: subscription.webhookEvents?.[subscription.webhookEvents.length - 1],
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt
      } : null;
    }

    // Check transaction status
    if (paymentId) {
      const transaction = await Transaction.findOne({
        paymentId,
        payerId: session.user.id
      }).lean();

      result.transaction = transaction ? {
        id: transaction._id,
        orderId: transaction.orderId,
        paymentId: transaction.paymentId,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        paymentType: transaction.paymentType,
        createdAt: transaction.createdAt,
        metadata: transaction.metadata
      } : null;
    }

    // Check for recent transactions if no specific payment ID
    if (!paymentId && subscriptionId) {
      const recentTransactions = await Transaction.find({
        payerId: session.user.id,
        paymentType: "community_subscription",
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

      result.recentTransactions = recentTransactions.map((t: any) => ({
        id: t._id,
        paymentId: t.paymentId,
        status: t.status,
        amount: t.amount,
        createdAt: t.createdAt
      }));
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error("Error checking payment status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check payment status" },
      { status: 500 }
    );
  }
}

// POST /api/payments/status - Manual retry for stuck payments
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subscriptionId, paymentId, signature, communityId } = await request.json();

    if (!subscriptionId || !paymentId || !signature) {
      return NextResponse.json(
        { error: "subscriptionId, paymentId, and signature are required" },
        { status: 400 }
      );
    }

    // Forward to the verification endpoint
    const verifyResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/community-subscriptions/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": request.headers.get("Cookie") || ""
      },
      body: JSON.stringify({
        subscriptionId,
        paymentId,
        signature,
        communityId
      })
    });

    const verifyData = await verifyResponse.json();

    return NextResponse.json({
      success: verifyResponse.ok,
      message: verifyResponse.ok ? "Payment verification completed" : "Payment verification failed",
      data: verifyData,
      retryAttempt: true
    }, { status: verifyResponse.status });

  } catch (error: any) {
    console.error("Error retrying payment verification:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retry payment verification" },
      { status: 500 }
    );
  }
}
