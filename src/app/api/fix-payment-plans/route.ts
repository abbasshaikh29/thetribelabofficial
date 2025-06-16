import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { createPlan } from "@/lib/razorpay";
import { CommunitySubscriptionPlan } from "@/models/PaymentPlan";

// POST /api/fix-payment-plans - Fix payment plans by removing invalid ones and creating valid ones
export async function POST(request: NextRequest) {
  try {
    await dbconnect();
    
    console.log("🔄 Starting payment plans fix...");

    // Step 1: Find and deactivate plans with invalid Razorpay IDs
    const invalidPlans = await CommunitySubscriptionPlan.find({
      isActive: true,
      $or: [
        { razorpayPlanId: { $regex: /^plan_default_/ } },
        { razorpayPlanId: { $regex: /^plan_legacy_/ } },
        { amount: 0 }
      ]
    });

    console.log(`Found ${invalidPlans.length} invalid plans to fix`);

    // Deactivate invalid plans
    for (const plan of invalidPlans) {
      await CommunitySubscriptionPlan.findByIdAndUpdate(plan._id, { isActive: false });
      console.log(`Deactivated invalid plan: ${plan.name} (${plan.razorpayPlanId})`);
    }

    // Step 2: Check if we have any valid plans left
    const validPlans = await CommunitySubscriptionPlan.find({
      isActive: true,
      amount: { $gt: 0 },
      razorpayPlanId: { $not: { $regex: /^plan_(default_|legacy_)/ } }
    });

    console.log(`Found ${validPlans.length} existing valid plans`);

    // Step 3: Create new valid plans if needed
    const createdPlans = [];
    
    if (validPlans.length === 0) {
      console.log("Creating new valid plans...");
      
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

      for (const planData of newPlans) {
        try {
          console.log(`Creating plan: ${planData.name}`);
          
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
          console.log(`Razorpay plan created: ${razorpayPlan.id}`);

          // Create plan in database
          const dbPlan = new CommunitySubscriptionPlan({
            ...planData,
            razorpayPlanId: razorpayPlan.id
          });

          await dbPlan.save();
          createdPlans.push(dbPlan);
          console.log(`Database plan created: ${planData.name}`);
          
        } catch (planError: any) {
          console.error(`Error creating plan ${planData.name}:`, planError);
        }
      }
    }

    // Step 4: Get final count of valid plans
    const finalValidPlans = await CommunitySubscriptionPlan.find({
      isActive: true,
      amount: { $gt: 0 }
    });

    return NextResponse.json({
      success: true,
      message: `Payment plans fixed successfully`,
      invalidPlansDeactivated: invalidPlans.length,
      newPlansCreated: createdPlans.length,
      totalValidPlans: finalValidPlans.length,
      validPlans: finalValidPlans
    });

  } catch (error: any) {
    console.error("Error fixing payment plans:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fix payment plans" },
      { status: 500 }
    );
  }
}

// GET /api/fix-payment-plans - Check current plans status
export async function GET(request: NextRequest) {
  try {
    await dbconnect();
    
    const allPlans = await CommunitySubscriptionPlan.find({}).sort({ createdAt: -1 });
    const activePlans = allPlans.filter(plan => plan.isActive);
    const invalidPlans = activePlans.filter(plan => 
      plan.razorpayPlanId.includes('default_') || 
      plan.razorpayPlanId.includes('legacy_') || 
      plan.amount === 0
    );
    const validPlans = activePlans.filter(plan => 
      !plan.razorpayPlanId.includes('default_') && 
      !plan.razorpayPlanId.includes('legacy_') && 
      plan.amount > 0
    );

    return NextResponse.json({
      success: true,
      totalPlans: allPlans.length,
      activePlans: activePlans.length,
      invalidPlans: invalidPlans.length,
      validPlans: validPlans.length,
      needsFix: invalidPlans.length > 0 || validPlans.length === 0,
      plans: {
        all: allPlans,
        active: activePlans,
        invalid: invalidPlans,
        valid: validPlans
      }
    });

  } catch (error: any) {
    console.error("Error checking plans:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check plans" },
      { status: 500 }
    );
  }
}
