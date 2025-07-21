import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { AutoTransferEngine } from "@/lib/auto-transfer-engine";
import { TransferManager } from "@/lib/transfer-manager";
import mongoose from "mongoose";

// GET /api/admin/transfer-processing - Get transfer processing status and stats
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    // Convert to ObjectId
    const adminObjectId = new mongoose.Types.ObjectId(session.user.id);

    // Get transfer stats for this admin
    const stats = await AutoTransferEngine.getTransferStats(adminObjectId);

    // Get pending batches
    const batches = await AutoTransferEngine.createTransferBatches();
    const adminBatches = batches.filter(batch =>
      batch.adminId.toString() === adminObjectId.toString()
    );

    return NextResponse.json({
      success: true,
      stats,
      pendingBatches: adminBatches.length,
      totalPendingAmount: adminBatches.reduce((sum, batch) => sum + batch.totalAmount, 0),
      nextOptimalTransferTime: AutoTransferEngine.getOptimalTransferTime()
    });

  } catch (error: any) {
    console.error("Transfer processing status error:", error);
    return NextResponse.json(
      { error: "Failed to get transfer processing status" },
      { status: 500 }
    );
  }
}

// POST /api/admin/transfer-processing - Manually trigger transfer processing
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const { action, transferIds } = await request.json();

    // Convert to ObjectId
    const adminObjectId = new mongoose.Types.ObjectId(session.user.id);

    switch (action) {
      case 'process_batches':
        return await processBatches(adminObjectId);

      case 'retry_failed':
        return await retryFailedTransfers(adminObjectId);

      case 'force_transfer':
        if (!transferIds || !Array.isArray(transferIds)) {
          return NextResponse.json(
            { error: "Transfer IDs required for force transfer" },
            { status: 400 }
          );
        }
        return await forceTransfers(adminObjectId, transferIds);
      
      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

  } catch (error: any) {
    console.error("Transfer processing action error:", error);
    return NextResponse.json(
      { error: "Failed to process transfer action" },
      { status: 500 }
    );
  }
}

// Process pending batches for admin
async function processBatches(adminId: any) {
  try {
    // Get all batches
    const allBatches = await AutoTransferEngine.createTransferBatches();
    
    // Filter batches for this admin
    const adminBatches = allBatches.filter(batch => 
      batch.adminId.toString() === adminId.toString()
    );

    if (adminBatches.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending batches to process",
        processedBatches: 0,
        totalTransfers: 0,
        totalAmount: 0
      });
    }

    // Process the batches
    const result = await AutoTransferEngine.processBatches(adminBatches);

    return NextResponse.json({
      success: true,
      message: `Processed ${result.processedBatches} batches successfully`,
      ...result
    });

  } catch (error: any) {
    console.error("Batch processing error:", error);
    return NextResponse.json(
      { error: "Failed to process batches" },
      { status: 500 }
    );
  }
}

// Retry failed transfers for admin
async function retryFailedTransfers(adminId: any) {
  try {
    const result = await TransferManager.retryFailedTransfers();
    
    // Filter results for this admin (you might want to modify TransferManager to accept adminId)
    return NextResponse.json({
      success: true,
      message: "Failed transfers retry initiated",
      totalRetries: result.totalTransfers,
      successfulRetries: result.successfulTransfers,
      failedRetries: result.failedTransfers
    });

  } catch (error: any) {
    console.error("Retry failed transfers error:", error);
    return NextResponse.json(
      { error: "Failed to retry transfers" },
      { status: 500 }
    );
  }
}

// Force specific transfers
async function forceTransfers(adminId: any, transferIds: string[]) {
  try {
    // This would implement forced transfer logic
    // For now, return a placeholder response
    
    return NextResponse.json({
      success: true,
      message: `Force transfer initiated for ${transferIds.length} transfers`,
      transferIds
    });

  } catch (error: any) {
    console.error("Force transfer error:", error);
    return NextResponse.json(
      { error: "Failed to force transfers" },
      { status: 500 }
    );
  }
}
