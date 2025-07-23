import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { RouteAccountManager } from "@/lib/route-account-manager";
import { RouteAccount } from "@/models/RouteAccount";
import mongoose from "mongoose";

// GET /api/admin/route-account/status - Get Route account status for admin
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    // Get account status
    const adminObjectId = new mongoose.Types.ObjectId(session.user.id);
    const status = await RouteAccountManager.getAccountStatus(adminObjectId);

    // Get full account details if exists
    const routeAccount = await (RouteAccount as any).findOne({ adminId: adminObjectId });

    return NextResponse.json({
      success: true,
      status,
      account: routeAccount ? {
        id: routeAccount._id,
        status: routeAccount.status,
        kycStatus: routeAccount.kycStatus,
        routeAccountId: routeAccount.routeAccountId,
        settlementSchedule: routeAccount.settlementSchedule,
        minimumPayoutAmount: routeAccount.minimumPayoutAmount,
        totalPayoutsReceived: routeAccount.totalPayoutsReceived,
        totalPayoutsCount: routeAccount.totalPayoutsCount,
        lastPayoutAt: routeAccount.lastPayoutAt,
        activatedAt: routeAccount.activatedAt,
        createdAt: routeAccount.createdAt,
        updatedAt: routeAccount.updatedAt
      } : null
    });

  } catch (error: any) {
    console.error("Route account status API error:", error);
    return NextResponse.json(
      { error: "Failed to get account status" },
      { status: 500 }
    );
  }
}

// POST /api/admin/route-account/status - Sync account status with Razorpay
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    try {
      // Convert to ObjectId
      const adminObjectId = new mongoose.Types.ObjectId(session.user.id);

      // Sync account status with Razorpay
      const updatedAccount = await RouteAccountManager.syncAccountStatus(adminObjectId);
      
      if (!updatedAccount) {
        return NextResponse.json(
          { error: "No Route account found to sync" },
          { status: 404 }
        );
      }

      // Get updated status
      const status = await RouteAccountManager.getAccountStatus(adminObjectId);

      return NextResponse.json({
        success: true,
        message: "Account status synced successfully",
        status,
        account: {
          id: updatedAccount._id,
          status: updatedAccount.status,
          kycStatus: updatedAccount.kycStatus,
          routeAccountId: updatedAccount.routeAccountId,
          activatedAt: updatedAccount.activatedAt,
          updatedAt: updatedAccount.updatedAt
        }
      });

    } catch (syncError: any) {
      console.error("Account sync error:", syncError);
      return NextResponse.json(
        { error: syncError.message || "Failed to sync account status" },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error("Route account sync API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
