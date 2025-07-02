import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import { PaymentGateway } from "@/models/PaymentGateway";
import { CommunitySubscriptionPlan } from "@/models/PaymentPlan";
import { createCustomer, createSubscription } from "@/lib/razorpay";
import { User } from "@/models/User";
import { Subscription } from "@/models/Subscription";
import { decrypt } from "@/lib/encryption";

/**
 * POST /api/community/[slug]/subscribe
 * Body: { interval: "monthly" | "yearly" }
 * Returns { shortUrl, subscription }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { interval } = await request.json();
    if (!interval || !["monthly", "yearly"].includes(interval)) {
      return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
    }

    await dbconnect();

    const { slug } = await context.params;
    const community = await Community.findOne({ slug });
    if (!community || !community.paymentGatewayId) {
      return NextResponse.json({ error: "Community not found or no gateway" }, { status: 404 });
    }

    const gateway = await PaymentGateway.findById(community.paymentGatewayId);
    if (!gateway) {
      return NextResponse.json({ error: "Gateway not found" }, { status: 404 });
    }

    // Verify gateway ownership
    if (gateway.ownerId && gateway.ownerId.toString() !== community.admin.toString()) {
      return NextResponse.json({ error: "Invalid gateway configuration" }, { status: 403 });
    }

    // Find the plan for this interval
    const plan = await CommunitySubscriptionPlan.findOne({
      _id: { $in: community.paymentPlans },
      interval,
      isActive: true,
    });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (!gateway.credentials || typeof gateway.credentials !== "object") {
      return NextResponse.json({ error: "Gateway credentials missing" }, { status: 500 });
    }

    const { apiKey: encApiKey, secretKey: encSecretKey } = gateway.credentials as { apiKey?: string; secretKey?: string };
    const apiKey = encApiKey ? decrypt(encApiKey) : undefined;
    const secretKey = encSecretKey ? decrypt(encSecretKey) : undefined;
    if (!apiKey || !secretKey) {
      return NextResponse.json({ error: "Credentials missing" }, { status: 500 });
    }

    // Retrieve user, create Razorpay customer if needed
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check for existing active subscription for this user in this community
    const existingSubscription = await Subscription.findOne({
      communityId: community._id,
      razorpayCustomerId: user.paymentSettings?.razorpayCustomerId,
      status: { $in: ["active", "created", "authenticated"] },
    });

    if (existingSubscription) {
      return NextResponse.json(
        { error: "You already have an active subscription to this community" },
        { status: 400 }
      );
    }

    let customerId = user.paymentSettings?.razorpayCustomerId;
    if (!customerId) {
      const customer = await createCustomer(
        {
          name: user.name || user.email,
          email: user.email,
          contact: undefined,
          notes: {
            userId: user._id.toString(),
            role: "member",
            community: community._id.toString(),
          },
        },
        { apiKey, secretKey }
      );
      customerId = customer.id;
      await User.findByIdAndUpdate(user._id, {
        "paymentSettings.razorpayCustomerId": customerId,
      });
    }

    // Create subscription
    const subscriptionRes = await createSubscription(
      {
        plan_id: plan.razorpayPlanId,
        customer_id: customerId,
        quantity: 1,
        customer_notify: true,
        total_count: undefined,
      },
      { apiKey, secretKey }
    );

    // Store in DB
    const subDoc = new Subscription({
      razorpaySubscriptionId: subscriptionRes.id,
      razorpayPlanId: plan.razorpayPlanId,
      razorpayCustomerId: customerId,
      adminId: community.admin,
      communityId: community._id,
      status: subscriptionRes.status,
      currentStart: new Date(subscriptionRes.current_start * 1000),
      currentEnd: new Date(subscriptionRes.current_end * 1000),
      chargeAt: new Date(subscriptionRes.charge_at * 1000),
      startAt: subscriptionRes.start_at ? new Date(subscriptionRes.start_at * 1000) : undefined,
      endAt: subscriptionRes.end_at ? new Date(subscriptionRes.end_at * 1000) : undefined,
      authAttempts: subscriptionRes.auth_attempts,
      totalCount: subscriptionRes.total_count,
      paidCount: subscriptionRes.paid_count,
      customerNotify: subscriptionRes.customer_notify,
      quantity: subscriptionRes.quantity,
      notes: subscriptionRes.notes,
      amount: plan.amount,
      currency: plan.currency,
      interval: interval,
      intervalCount: 1,
      retryAttempts: 0,
      maxRetryAttempts: 3,
      consecutiveFailures: 0,
      webhookEvents: [],
      notificationsSent: [],
    });

    await subDoc.save();

    return NextResponse.json({ success: true, shortUrl: subscriptionRes.short_url, subscription: subDoc });
  } catch (error: any) {
    console.error("Subscription error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
} 