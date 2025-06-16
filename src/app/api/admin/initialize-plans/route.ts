import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { createPlan } from "@/lib/razorpay";
import { CommunitySubscriptionPlan } from "@/models/PaymentPlan";

// POST /api/admin/initialize-plans - Initialize default subscription plans (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();
    
    // Check if plans already exist
    const existingPlans = await CommunitySubscriptionPlan.find({ isActive: true });
    
    if (existingPlans.length > 0) {
      return NextResponse.json({
        success: true,
        message: "Plans already exist",
        plans: existingPlans,
        count: existingPlans.length
      });
    }

    // Default subscription plans with proper Razorpay integration
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
      },
      {
        name: "Community Pro",
        description: "Advanced features for growing communities",
        amount: 2999, // ₹29.99 in paise
        currency: "INR",
        interval: "monthly" as const,
        intervalCount: 1,
        trialPeriodDays: 14,
        features: [
          "Everything in Starter",
          "Advanced analytics",
          "Custom branding",
          "Priority support",
          "API access",
          "Custom integrations",
          "White-label options"
        ],
        allowCustomBranding: true,
        prioritySupport: true,
        analyticsAccess: true,
        advancedAnalytics: true,
        apiAccess: true,
        whitelabelOptions: true,
        dedicatedSupport: false,
        customIntegrations: true,
        isActive: true
      }
    ];

    const createdPlans = [];
    const errors = [];

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
            features: planData.features.join(","),
            customBranding: planData.allowCustomBranding.toString(),
            prioritySupport: planData.prioritySupport.toString(),
            advancedAnalytics: planData.advancedAnalytics.toString()
          }
        };

        console.log(`Creating Razorpay plan for: ${planData.name}`);
        const razorpayPlan = await createPlan(razorpayPlanData);
        console.log(`Razorpay plan created: ${razorpayPlan.id}`);

        // Create plan in database with valid Razorpay plan ID
        const dbPlan = new CommunitySubscriptionPlan({
          ...planData,
          razorpayPlanId: razorpayPlan.id
        });

        await dbPlan.save();
        createdPlans.push(dbPlan);

        console.log(`Database plan created: ${planData.name} with ID: ${dbPlan._id}`);
      } catch (planError: any) {
        console.error(`Error creating plan ${planData.name}:`, planError);
        errors.push({
          planName: planData.name,
          error: planError.message
        });
      }
    }

    if (createdPlans.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Failed to create any default plans",
        errors
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdPlans.length} subscription plans`,
      plans: createdPlans,
      errors: errors.length > 0 ? errors : undefined,
      count: createdPlans.length
    });

  } catch (error: any) {
    console.error("Error initializing plans:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initialize plans" },
      { status: 500 }
    );
  }
}

// GET /api/admin/initialize-plans - Check current plans status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();
    
    const plans = await CommunitySubscriptionPlan.find({ isActive: true })
      .sort({ amount: 1 });

    return NextResponse.json({
      success: true,
      plans,
      count: plans.length,
      hasPlans: plans.length > 0
    });

  } catch (error: any) {
    console.error("Error fetching plans:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch plans" },
      { status: 500 }
    );
  }
}
