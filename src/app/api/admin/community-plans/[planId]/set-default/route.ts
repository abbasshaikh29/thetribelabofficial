import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { CommunityPlan } from "@/models/CommunityPlan";
import mongoose from "mongoose";

// POST /api/admin/community-plans/[planId]/set-default - Set plan as default
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params;
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    // Find the plan
    const plan = await (CommunityPlan as any).findOne({
      _id: planId,
      adminId: session.user.id
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    // Use transaction to prevent race conditions when setting default
    const mongoSession = await mongoose.startSession();

    try {
      await mongoSession.withTransaction(async () => {
        // Unset all other default plans for this community
        await (CommunityPlan as any).updateMany(
          {
            communityId: plan.communityId,
            adminId: session.user.id,
            _id: { $ne: planId }
          },
          { isDefault: false },
          { session: mongoSession }
        );

        // Set this plan as default
        plan.isDefault = true;
        await plan.save({ session: mongoSession });
      });
    } finally {
      await mongoSession.endSession();
    }

    return NextResponse.json({
      success: true,
      message: "Plan set as default successfully",
      plan
    });

  } catch (error: unknown) {
    console.error("Set default plan error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to set default plan";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
