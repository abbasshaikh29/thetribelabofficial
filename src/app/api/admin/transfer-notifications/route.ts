import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { AdminPayout, IAdminPayout } from "@/models/AdminPayout";
import { TransferErrorHandler } from "@/lib/transfer-error-handler";

// GET /api/admin/transfer-notifications - Get transfer notifications for admin
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    // Get recent transfer events for notifications
    const recentPayouts = await (AdminPayout as any).find({
      adminId: session.user.id,
      updatedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    })
    .sort({ updatedAt: -1 })
    .limit(20);

    const notifications = await Promise.all(
      recentPayouts.map(async (payout: IAdminPayout) => {
        return await createNotificationFromPayout(payout);
      })
    );

    // Filter out null notifications and sort by timestamp
    const validNotifications = notifications
      .filter(n => n !== null)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      success: true,
      notifications: validNotifications
    });

  } catch (error: any) {
    console.error("Transfer notifications error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// Create notification object from payout
async function createNotificationFromPayout(payout: IAdminPayout) {
  try {
    const baseNotification = {
      id: payout._id?.toString() || '',
      amount: payout.feeBreakdown.netAmount,
      transferId: payout.razorpayTransferId,
      timestamp: payout.updatedAt.toISOString(),
      read: false // You might want to track this in a separate collection
    };

    switch (payout.status) {
      case 'processed':
        return {
          ...baseNotification,
          type: 'success',
          title: 'Transfer Completed',
          message: `₹${(payout.feeBreakdown.netAmount / 100).toLocaleString('en-IN')} has been transferred to your account`,
          actionRequired: false
        };

      case 'failed':
        const errorAnalysis = payout.failureReason
          ? await TransferErrorHandler.analyzeError(payout.failureReason, payout.adminId)
          : null;

        return {
          ...baseNotification,
          type: 'error',
          title: 'Transfer Failed',
          message: payout.failureReason || 'Transfer failed due to unknown error',
          actionRequired: errorAnalysis?.errorType.escalationRequired || false,
          suggestedAction: errorAnalysis?.errorType.suggestedAction
        };

      case 'queued':
        return {
          ...baseNotification,
          type: 'info',
          title: 'Transfer Queued',
          message: `Transfer of ₹${(payout.feeBreakdown.netAmount / 100).toLocaleString('en-IN')} is queued for processing`,
          actionRequired: false
        };

      case 'pending':
        // Only notify if pending for more than 1 hour
        const hoursSincePending = (Date.now() - payout.paymentReceivedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSincePending > 1) {
          return {
            ...baseNotification,
            type: 'warning',
            title: 'Transfer Delayed',
            message: `Transfer has been pending for ${Math.floor(hoursSincePending)} hours`,
            actionRequired: hoursSincePending > 24,
            suggestedAction: hoursSincePending > 24 ? 'Contact support if issue persists' : undefined
          };
        }
        return null;

      default:
        return null;
    }

  } catch (error) {
    console.error('Error creating notification from payout:', error);
    return null;
  }
}
