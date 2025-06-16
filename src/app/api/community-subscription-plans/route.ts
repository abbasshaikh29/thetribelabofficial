import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { createPlan } from "@/lib/razorpay";
import { CommunitySubscriptionPlan } from "@/models/PaymentPlan";
import { CommunitySubscription } from "@/models/Subscription";

// POST /api/community-subscription-plans - Create a new community subscription plan
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow platform admins to create plans (implement your admin check)
    // const user = await User.findById(session.user.id);
    // if (!user.isAdmin) {
    //   return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    // }

    await dbconnect();
    
    const {
      name,
      description,
      amount,
      currency = "INR",
      interval,
      intervalCount = 1,
      trialPeriodDays = 14,
      features = [],
      allowCustomBranding = false,
      prioritySupport = false,
      analyticsAccess = true,
      advancedAnalytics = false,
      apiAccess = false,
      whitelabelOptions = false,
      dedicatedSupport = false,
      customIntegrations = false
    } = await request.json();

    // Validate required fields
    if (!name || !amount || !interval) {
      return NextResponse.json(
        { error: "Name, amount, and interval are required" },
        { status: 400 }
      );
    }

    // Validate interval
    if (!["monthly", "yearly"].includes(interval)) {
      return NextResponse.json(
        { error: "Interval must be 'monthly' or 'yearly'" },
        { status: 400 }
      );
    }

    // Create plan in Razorpay
    const razorpayPlanData = {
      period: interval === "monthly" ? "monthly" as const : "yearly" as const,
      interval: intervalCount,
      item: {
        name: `${name} - Community Management`,
        amount: amount * 100, // Convert to paise
        currency,
        description: description || `${name} community management plan`
      },
      notes: {
        planType: "community_management",
        features: features.join(","),
        customBranding: allowCustomBranding.toString(),
        prioritySupport: prioritySupport.toString(),
        advancedAnalytics: advancedAnalytics.toString()
      }
    };

    const razorpayPlan = await createPlan(razorpayPlanData);

    // Save plan to database
    const subscriptionPlan = new CommunitySubscriptionPlan({
      name,
      description,
      amount,
      currency,
      interval,
      intervalCount,
      trialPeriodDays,
      features,
      razorpayPlanId: razorpayPlan.id,
      allowCustomBranding,
      prioritySupport,
      analyticsAccess,
      advancedAnalytics,
      apiAccess,
      whitelabelOptions,
      dedicatedSupport,
      customIntegrations,
      isActive: true
    });

    await subscriptionPlan.save();

    return NextResponse.json({
      success: true,
      plan: subscriptionPlan,
      razorpayPlan
    });

  } catch (error: any) {
    console.error("Error creating community subscription plan:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create subscription plan" },
      { status: 500 }
    );
  }
}

// GET /api/community-subscription-plans - Get all community subscription plans
export async function GET(request: NextRequest) {
  try {
    await dbconnect();

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get("isActive");
    const interval = searchParams.get("interval");

    // Build query
    const query: any = {};
    if (isActive !== null) query.isActive = isActive === "true";
    if (interval) query.interval = interval;

    let plans = await CommunitySubscriptionPlan.find(query)
      .sort({ amount: 1 }); // Sort by price ascending

    // If no active plans exist, create default ones automatically
    if (plans.length === 0 && (isActive === "true" || isActive === null)) {
      try {
        console.log("No active plans found, creating default plans...");

        const defaultPlans = [
          {
            name: "Community Starter",
            description: "Perfect for small communities getting started",
            amount: 999, // ₹9.99 in paise
            currency: "INR",
            interval: "monthly" as const,
            intervalCount: 1,
            trialPeriodDays: 14,
            features: [
              "Unlimited members",
              "Unlimited storage",
              "Unlimited events",
              "Unlimited channels",
              "Basic analytics",
              "Email support",
              "Mobile app access"
            ],
            allowCustomBranding: false,
            prioritySupport: false,
            analyticsAccess: true,
            advancedAnalytics: false,
            apiAccess: false,
            whitelabelOptions: false,
            dedicatedSupport: false,
            customIntegrations: false,
            isActive: true
          }
        ];

        const createdPlans = [];

        for (const planData of defaultPlans) {
          try {
            // Create plan in Razorpay first
            const razorpayPlanData = {
              period: planData.interval,
              interval: planData.intervalCount,
              item: {
                name: `${planData.name} - Community Management`,
                amount: planData.amount,
                currency: planData.currency,
                description: planData.description
              },
              notes: {
                planType: "community_management",
                features: planData.features.join(",")
              }
            };

            const razorpayPlan = await createPlan(razorpayPlanData);

            // Create plan in database
            const dbPlan = new CommunitySubscriptionPlan({
              ...planData,
              razorpayPlanId: razorpayPlan.id
            });

            await dbPlan.save();
            createdPlans.push(dbPlan);
            console.log(`Created plan: ${planData.name} with Razorpay ID: ${razorpayPlan.id}`);
          } catch (planError) {
            console.error(`Error creating plan ${planData.name}:`, planError);
          }
        }

        plans = createdPlans;
      } catch (autoCreateError) {
        console.error("Error auto-creating plans:", autoCreateError);
        // Continue with empty plans array
      }
    }

    return NextResponse.json({
      success: true,
      plans
    });

  } catch (error: any) {
    console.error("Error fetching community subscription plans:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch subscription plans" },
      { status: 500 }
    );
  }
}

// PUT /api/community-subscription-plans - Update a community subscription plan
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();
    
    const { planId, ...updateData } = await request.json();

    if (!planId) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    const updatedPlan = await CommunitySubscriptionPlan.findByIdAndUpdate(
      planId,
      updateData,
      { new: true }
    );

    if (!updatedPlan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      plan: updatedPlan
    });

  } catch (error: any) {
    console.error("Error updating community subscription plan:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update subscription plan" },
      { status: 500 }
    );
  }
}

// DELETE /api/community-subscription-plans - Delete a community subscription plan
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();
    
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("planId");

    if (!planId) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    // Check if plan is being used by any active subscriptions
    const activeSubscriptions = await CommunitySubscription.countDocuments({
      razorpayPlanId: planId,
      status: { $in: ["active", "trial", "past_due"] }
    });

    if (activeSubscriptions > 0) {
      return NextResponse.json(
        { error: "Cannot delete plan with active subscriptions" },
        { status: 400 }
      );
    }

    const deletedPlan = await CommunitySubscriptionPlan.findByIdAndDelete(planId);

    if (!deletedPlan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Plan deleted successfully"
    });

  } catch (error: any) {
    console.error("Error deleting community subscription plan:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete subscription plan" },
      { status: 500 }
    );
  }
}
