import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import { CommunitySubscriptionPlan } from "@/models/PaymentPlan";
import { User } from "@/models/User";

// POST /api/admin/migrate-communities - Migrate existing communities to subscription model
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin (implement your admin check logic)
    const user = await User.findById(session.user.id);
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    await dbconnect();

    // Step 1: Create or find default starter plan
    let starterPlan = await CommunitySubscriptionPlan.findOne({ name: "Legacy Starter" });
    
    if (!starterPlan) {
      starterPlan = await CommunitySubscriptionPlan.create({
        name: "Legacy Starter",
        description: "Default plan for existing communities during migration",
        amount: 0, // Free during migration
        currency: "INR",
        interval: "monthly",
        intervalCount: 1,
        trialPeriodDays: 14,
        features: [
          "Unlimited members",
          "Unlimited storage", 
          "Unlimited events",
          "Unlimited channels",
          "Basic analytics",
          "Email support",
          "Legacy community access"
        ],
        razorpayPlanId: "plan_legacy_starter_free",
        allowCustomBranding: false,
        prioritySupport: false,
        analyticsAccess: true,
        advancedAnalytics: false,
        apiAccess: false,
        whitelabelOptions: false,
        dedicatedSupport: false,
        customIntegrations: false,
        isActive: true
      });
    }

    // Step 2: Find communities without subscription plans
    const communitiesWithoutPlans = await Community.find({
      $or: [
        { subscriptionPlanId: { $exists: false } },
        { subscriptionPlanId: null }
      ]
    });

    if (communitiesWithoutPlans.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All communities already have subscription plans",
        updated: 0,
        planId: starterPlan._id
      });
    }

    // Step 3: Update communities with default plan and trial status
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now

    const updateResult = await Community.updateMany(
      {
        $or: [
          { subscriptionPlanId: { $exists: false } },
          { subscriptionPlanId: null }
        ]
      },
      {
        $set: {
          subscriptionPlanId: starterPlan._id,
          subscriptionStatus: "trial",
          subscriptionStartDate: now,
          trialEndDate: trialEndDate
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: "Communities migrated successfully",
      updated: updateResult.modifiedCount,
      planId: starterPlan._id,
      planName: starterPlan.name,
      trialEndDate: trialEndDate.toISOString()
    });

  } catch (error: any) {
    console.error("Error migrating communities:", error);
    return NextResponse.json(
      { error: error.message || "Failed to migrate communities" },
      { status: 500 }
    );
  }
}

// GET /api/admin/migrate-communities - Check migration status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    // Count communities with and without subscription plans
    const totalCommunities = await Community.countDocuments();
    const communitiesWithPlans = await Community.countDocuments({
      subscriptionPlanId: { $exists: true, $ne: null }
    });
    const communitiesWithoutPlans = totalCommunities - communitiesWithPlans;

    // Get legacy starter plan info
    const legacyPlan = await CommunitySubscriptionPlan.findOne({ name: "Legacy Starter" });

    return NextResponse.json({
      success: true,
      migration: {
        totalCommunities,
        communitiesWithPlans,
        communitiesWithoutPlans,
        migrationNeeded: communitiesWithoutPlans > 0,
        legacyPlanExists: !!legacyPlan,
        legacyPlanId: legacyPlan?._id
      }
    });

  } catch (error: any) {
    console.error("Error checking migration status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check migration status" },
      { status: 500 }
    );
  }
}
