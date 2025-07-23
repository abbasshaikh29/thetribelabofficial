import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import { getServerSession } from "@/lib/auth-helpers";
import { User } from "@/models/User";

/**
 * POST /api/admin/fix-trial-status
 * Admin endpoint to fix trial status for communities with freeTrialActivated but missing paymentStatus.
 * Requires admin authentication. Logs all admin operations for audit purposes.
 * TODO: Review/remove hardcoded 'trial-test' community logic if not needed.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate and check admin privileges
    const session = await getServerSession();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await User.findOne({ email: session.user.email });
    if (!user || (user.role !== "admin" && user.role !== "platform_admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Log admin operation for audit
    console.log(
      `[ADMIN][${new Date().toISOString()}] User ${session.user.email || session.user.id} (${user.role}) called fix-trial-status`
    );
    await dbconnect();

    // Find communities with freeTrialActivated but no paymentStatus
    const result = await Community.updateMany(
      {
        freeTrialActivated: true,
        $or: [
          { paymentStatus: { $exists: false } },
          { paymentStatus: null },
          { paymentStatus: "" },
        ],
        subscriptionEndDate: { $gt: new Date() },
      },
      {
        $set: {
          paymentStatus: "trial",
        },
      }
    );

    console.log(
      `Updated ${result.modifiedCount} communities with trial status`
    );

    // Also check specific community (TODO: Review if this is still needed)
    const trialTestCommunity = await (Community as any).findOne({ slug: "trial-test" });
    console.log("[ADMIN] trial-test community after update:", {
      slug: trialTestCommunity?.slug,
      freeTrialActivated: trialTestCommunity?.freeTrialActivated,
      paymentStatus: trialTestCommunity?.paymentStatus,
      subscriptionEndDate: trialTestCommunity?.subscriptionEndDate,
    });

    return NextResponse.json({
      success: true,
      message: `Updated ${result.modifiedCount} communities with trial status`,
      trialTestCommunity: {
        slug: trialTestCommunity?.slug,
        freeTrialActivated: trialTestCommunity?.freeTrialActivated,
        paymentStatus: trialTestCommunity?.paymentStatus,
        subscriptionEndDate: trialTestCommunity?.subscriptionEndDate,
      },
    });
  } catch (error: any) {
    console.error("Error fixing trial status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fix trial status" },
      { status: 500 }
    );
  }
}
