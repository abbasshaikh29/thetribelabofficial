import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { TrialManager } from "@/lib/trial-manager";
import mongoose from "mongoose";

// GET /api/admin/trial-status - Get trial status for current admin
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    // Convert to ObjectId
    const adminObjectId = new mongoose.Types.ObjectId(session.user.id);

    // Get trial status
    const trialStatus = await TrialManager.getTrialStatus(adminObjectId);

    // Get trial notification if any
    const notification = await TrialManager.getTrialNotification(adminObjectId);

    return NextResponse.json({
      success: true,
      trialStatus,
      notification
    });
  } catch (error: any) {
    console.error("Trial status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get trial status" },
      { status: 500 }
    );
  }
}

// POST /api/admin/trial-status - Extend trial or convert to active
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const { action, additionalDays } = await request.json();

    let result;
    switch (action) {
      case 'extend':
        if (!additionalDays || additionalDays <= 0) {
          return NextResponse.json(
            { error: "Additional days must be a positive number" },
            { status: 400 }
          );
        }
        // Convert to ObjectId
        const adminObjectId = new mongoose.Types.ObjectId(session.user.id);
        result = await TrialManager.extendTrial(adminObjectId, additionalDays);
        break;

      case 'convert':
        // Convert to ObjectId
        const adminObjectId2 = new mongoose.Types.ObjectId(session.user.id);
        result = await TrialManager.convertToActive(adminObjectId2);
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action. Use 'extend' or 'convert'" },
          { status: 400 }
        );
    }

    // Get updated trial status
    const finalAdminObjectId = new mongoose.Types.ObjectId(session.user.id);
    const trialStatus = await TrialManager.getTrialStatus(finalAdminObjectId);

    return NextResponse.json({
      success: true,
      message: `Trial ${action}ed successfully`,
      subscription: result,
      trialStatus
    });
  } catch (error: any) {
    console.error("Trial action error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process trial action" },
      { status: 500 }
    );
  }
}
