import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { CommunitySubscriptionPlan } from "@/models/PaymentPlan";
import { Community } from "@/models/Community";
import mongoose from "mongoose";

// GET /api/payments/plans/[id] - Get a specific community subscription plan
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await dbconnect();
    const params = await context.params;
    const plan = await CommunitySubscriptionPlan.findById(params.id);

    if (!plan) {
      return NextResponse.json(
        { error: "Community subscription plan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Error fetching community subscription plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch community subscription plan" },
      { status: 500 }
    );
  }
}

// PUT /api/payments/plans/[id] - Update a community subscription plan
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();
    const params = await context.params;
    const plan = await CommunitySubscriptionPlan.findById(params.id);

    if (!plan) {
      return NextResponse.json(
        { error: "Community subscription plan not found" },
        { status: 404 }
      );
    }

    // For now, only allow platform admins to update subscription plans
    // You can implement more granular permissions as needed
    const user = await mongoose.model("User").findById(session.user.id);
    if (!user || user.role !== "platform_admin") {
      return NextResponse.json(
        { error: "Only platform admins can update subscription plans" },
        { status: 403 }
      );
    }

    // Get update data
    const {
      name,
      description,
      amount,
      currency,
      interval,
      intervalCount,
      trialPeriodDays,
      features,
      isActive,
      allowCustomBranding,
      prioritySupport,
      analyticsAccess,
      advancedAnalytics,
      apiAccess,
      whitelabelOptions,
      dedicatedSupport,
      customIntegrations,
    } = await request.json();

    // Update fields
    if (name !== undefined) plan.name = name;
    if (description !== undefined) plan.description = description;
    if (amount !== undefined && amount > 0) plan.amount = amount;
    if (currency !== undefined) plan.currency = currency;
    if (interval !== undefined) plan.interval = interval;
    if (intervalCount !== undefined) plan.intervalCount = intervalCount;
    if (trialPeriodDays !== undefined) plan.trialPeriodDays = trialPeriodDays;
    if (features !== undefined) plan.features = features;
    if (isActive !== undefined) plan.isActive = isActive;
    if (allowCustomBranding !== undefined) plan.allowCustomBranding = allowCustomBranding;
    if (prioritySupport !== undefined) plan.prioritySupport = prioritySupport;
    if (analyticsAccess !== undefined) plan.analyticsAccess = analyticsAccess;
    if (advancedAnalytics !== undefined) plan.advancedAnalytics = advancedAnalytics;
    if (apiAccess !== undefined) plan.apiAccess = apiAccess;
    if (whitelabelOptions !== undefined) plan.whitelabelOptions = whitelabelOptions;
    if (dedicatedSupport !== undefined) plan.dedicatedSupport = dedicatedSupport;
    if (customIntegrations !== undefined) plan.customIntegrations = customIntegrations;

    await plan.save();

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Error updating community subscription plan:", error);
    return NextResponse.json(
      { error: "Failed to update community subscription plan" },
      { status: 500 }
    );
  }
}

// DELETE /api/payments/plans/[id] - Delete a community subscription plan
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();
    const params = await context.params;
    const plan = await CommunitySubscriptionPlan.findById(params.id);

    if (!plan) {
      return NextResponse.json(
        { error: "Community subscription plan not found" },
        { status: 404 }
      );
    }

    // For now, only allow platform admins to delete subscription plans
    // You can implement more granular permissions as needed
    const user = await mongoose.model("User").findById(session.user.id);
    if (!user || user.role !== "platform_admin") {
      return NextResponse.json(
        { error: "Only platform admins can delete subscription plans" },
        { status: 403 }
      );
    }

    // Check if any communities are using this plan
    const communitiesUsingPlan = await Community.find({ subscriptionPlanId: params.id });
    if (communitiesUsingPlan.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete plan that is currently in use by communities" },
        { status: 400 }
      );
    }

    // Delete the plan
    await CommunitySubscriptionPlan.findByIdAndDelete(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting community subscription plan:", error);
    return NextResponse.json(
      { error: "Failed to delete community subscription plan" },
      { status: 500 }
    );
  }
}
