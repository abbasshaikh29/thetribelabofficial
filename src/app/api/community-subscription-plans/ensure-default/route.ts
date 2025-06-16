import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { CommunitySubscriptionPlan } from "@/models/PaymentPlan";
import { createPlan } from "@/lib/razorpay";

// POST /api/community-subscription-plans/ensure-default - Ensure a default plan exists
export async function POST(request: NextRequest) {
  try {
    await dbconnect();

    // Check if any active plans exist
    const existingPlans = await CommunitySubscriptionPlan.find({ isActive: true });

    if (existingPlans.length > 0) {
      return NextResponse.json({
        success: true,
        message: "Plans already exist",
        plans: existingPlans
      });
    }

    // Create default plans with proper Razorpay integration
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
          "Custom integrations"
        ],
        allowCustomBranding: true,
        prioritySupport: true,
        analyticsAccess: true,
        advancedAnalytics: true,
        apiAccess: true,
        whitelabelOptions: false,
        dedicatedSupport: false,
        customIntegrations: true,
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
            amount: planData.amount, // Already in paise
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

        const razorpayPlan = await createPlan(razorpayPlanData);

        // Create plan in database with valid Razorpay plan ID
        const dbPlan = new CommunitySubscriptionPlan({
          ...planData,
          razorpayPlanId: razorpayPlan.id
        });

        await dbPlan.save();
        createdPlans.push(dbPlan);

        console.log(`Created plan: ${planData.name} with Razorpay ID: ${razorpayPlan.id}`);
      } catch (planError: any) {
        console.error(`Error creating plan ${planData.name}:`, planError);
        // Continue with other plans even if one fails
      }
    }

    if (createdPlans.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Failed to create any default plans"
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdPlans.length} default subscription plans`,
      plans: createdPlans
    });

  } catch (error: any) {
    console.error("Error ensuring default plans:", error);
    return NextResponse.json(
      { error: error.message || "Failed to ensure default plans" },
      { status: 500 }
    );
  }
}

