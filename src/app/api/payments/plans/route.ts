import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { CommunitySubscriptionPlan } from "@/models/PaymentPlan";
import { Community } from "@/models/Community";
import mongoose from "mongoose";

// GET /api/payments/plans - Get payment plans
export async function GET(request: NextRequest) {
  try {
    await dbconnect();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("activeOnly") === "true";

    // Build query
    const query: any = {};

    if (activeOnly) {
      query.isActive = true;
    }

    // Fetch plans
    const plans = await CommunitySubscriptionPlan.find(query).sort({ amount: 1 });

    return NextResponse.json(plans);
  } catch (error) {
    console.error("Error fetching community subscription plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch community subscription plans" },
      { status: 500 }
    );
  }
}

// POST /api/payments/plans - Create a new community subscription plan
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();
    const {
      name,
      description,
      amount,
      currency = "INR",
      interval = "monthly",
      intervalCount = 1,
      trialPeriodDays = 14,
      features,
      allowCustomBranding = false,
      prioritySupport = false,
      analyticsAccess = true,
      advancedAnalytics = false,
      apiAccess = false,
      whitelabelOptions = false,
      dedicatedSupport = false,
      customIntegrations = false,
    } = await request.json();

    // Validate required fields
    if (!name || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Name and amount are required" },
        { status: 400 }
      );
    }

    // Validate interval (only monthly allowed for community subscriptions)
    if (interval !== "monthly") {
      return NextResponse.json(
        { error: "Only monthly subscriptions are supported" },
        { status: 400 }
      );
    }

    // Create the community subscription plan
    const plan = new CommunitySubscriptionPlan({
      razorpayPlanId: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Temporary ID, should be replaced with actual Razorpay plan ID
      name,
      description,
      amount,
      currency,
      interval,
      intervalCount,
      trialPeriodDays,
      features: features || [
        "Unlimited members",
        "Unlimited storage",
        "Unlimited events",
        "Unlimited channels",
        "Basic analytics",
        "Email support"
      ],
      allowCustomBranding,
      prioritySupport,
      analyticsAccess,
      advancedAnalytics,
      apiAccess,
      whitelabelOptions,
      dedicatedSupport,
      customIntegrations,
      isActive: true,
    });

    await plan.save();

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Error creating community subscription plan:", error);
    return NextResponse.json(
      { error: "Failed to create community subscription plan" },
      { status: 500 }
    );
  }
}
