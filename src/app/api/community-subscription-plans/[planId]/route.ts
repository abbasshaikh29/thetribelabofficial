import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { CommunitySubscriptionPlan } from "@/models/PaymentPlan";

// GET /api/community-subscription-plans/[planId] - Get a specific community subscription plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    await dbconnect();

    const { planId } = await params;

    if (!planId) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    const plan = await CommunitySubscriptionPlan.findById(planId);

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      plan
    });

  } catch (error: any) {
    console.error("Error fetching community subscription plan:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch subscription plan" },
      { status: 500 }
    );
  }
}
