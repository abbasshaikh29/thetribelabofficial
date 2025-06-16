import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { createPlan } from "@/lib/razorpay";
import { CommunitySubscriptionPlan } from "@/models/PaymentPlan";

// POST /api/admin/fix-plans - Clean up old plans and create new ones with proper Razorpay integration
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();
    
    console.log("🔄 Starting plan cleanup and recreation...");

    // Step 1: Deactivate all existing plans (don't delete to preserve history)
    const existingPlans = await CommunitySubscriptionPlan.find({ isActive: true });
    console.log(`Found ${existingPlans.length} existing plans to deactivate`);

    for (const plan of existingPlans) {
      await CommunitySubscriptionPlan.findByIdAndUpdate(plan._id, { isActive: false });
      console.log(`Deactivated plan: ${plan.name}`);
    }

    // Step 2: Create new plans with proper Razorpay integration
    const newPlans = [
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

    for (const planData of newPlans) {
      try {
        console.log(`\n📝 Creating plan: ${planData.name}`);
        
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

        console.log('   🔄 Creating Razorpay plan...');
        const razorpayPlan = await createPlan(razorpayPlanData);
        console.log(`   ✅ Razorpay plan created: ${razorpayPlan.id}`);

        // Create plan in database with valid Razorpay plan ID
        const dbPlan = new CommunitySubscriptionPlan({
          ...planData,
          razorpayPlanId: razorpayPlan.id
        });

        await dbPlan.save();
        createdPlans.push(dbPlan);

        console.log(`   ✅ Database plan created: ${dbPlan._id}`);
        console.log(`   💰 Price: ₹${planData.amount/100}/${planData.interval}`);
        
      } catch (planError: any) {
        console.error(`   ❌ Error creating plan ${planData.name}:`, planError);
        errors.push({
          planName: planData.name,
          error: planError.message
        });
      }
    }

    if (createdPlans.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Failed to create any new plans",
        errors,
        deactivatedCount: existingPlans.length
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully fixed plans: deactivated ${existingPlans.length} old plans and created ${createdPlans.length} new plans`,
      deactivatedPlans: existingPlans.length,
      createdPlans: createdPlans,
      errors: errors.length > 0 ? errors : undefined,
      count: createdPlans.length
    });

  } catch (error: any) {
    console.error("Error fixing plans:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fix plans" },
      { status: 500 }
    );
  }
}

// GET /api/admin/fix-plans - Check current plans status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();
    
    const activePlans = await CommunitySubscriptionPlan.find({ isActive: true })
      .sort({ amount: 1 });
    
    const inactivePlans = await CommunitySubscriptionPlan.find({ isActive: false })
      .sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      activePlans,
      inactivePlans,
      activeCount: activePlans.length,
      inactiveCount: inactivePlans.length,
      hasValidPlans: activePlans.some(plan => plan.razorpayPlanId && !plan.razorpayPlanId.includes('default') && !plan.razorpayPlanId.includes('legacy'))
    });

  } catch (error: any) {
    console.error("Error checking plans:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check plans" },
      { status: 500 }
    );
  }
}
