import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { AutoTransferEngine } from "@/lib/auto-transfer-engine";
import { TransferManager } from "@/lib/transfer-manager";
import { TrialManager } from "@/lib/trial-manager";

// GET /api/cron/process-transfers - Automated transfer processing (called by cron)
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const startTime = Date.now();
    const results = {
      batchProcessing: { processedBatches: 0, totalTransfers: 0, totalAmount: 0, errors: [] as string[] },
      retryProcessing: { totalTransfers: 0, successfulTransfers: 0, failedTransfers: 0 },
      trialProcessing: { expiredTrials: 0, gracePeriodStarted: 0, accountsSuspended: 0 },
      executionTime: 0,
      timestamp: new Date().toISOString()
    };

    console.log("Starting automated transfer processing...");

    try {
      // 1. Process transfer batches
      console.log("Processing transfer batches...");
      const batches = await AutoTransferEngine.createTransferBatches();
      
      if (batches.length > 0) {
        const batchResult = await AutoTransferEngine.processBatches(batches);
        results.batchProcessing = batchResult;
        console.log(`Processed ${batchResult.processedBatches} batches with ${batchResult.totalTransfers} transfers`);
      } else {
        console.log("No batches to process");
      }

    } catch (error: any) {
      console.error("Batch processing error:", error);
      results.batchProcessing.errors.push(error.message);
    }

    try {
      // 2. Retry failed transfers
      console.log("Retrying failed transfers...");
      const retryResult = await TransferManager.retryFailedTransfers();
      results.retryProcessing = retryResult;
      console.log(`Retried ${retryResult.totalTransfers} transfers, ${retryResult.successfulTransfers} successful`);

    } catch (error: any) {
      console.error("Retry processing error:", error);
    }

    try {
      // 3. Process trial expirations
      console.log("Processing trial expirations...");
      const trialResult = await TrialManager.processTrialExpirations();
      results.trialProcessing = trialResult;
      console.log(`Processed ${trialResult.expiredTrials} trial expirations`);

    } catch (error: any) {
      console.error("Trial processing error:", error);
    }

    results.executionTime = Date.now() - startTime;

    console.log(`Transfer processing completed in ${results.executionTime}ms`);

    return NextResponse.json({
      success: true,
      message: "Automated transfer processing completed",
      results
    });

  } catch (error: any) {
    console.error("Cron transfer processing error:", error);
    return NextResponse.json(
      { error: "Transfer processing failed", details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/cron/process-transfers - Manual trigger for testing
export async function POST(request: NextRequest) {
  try {
    // Allow manual triggering for testing (with proper auth)
    const { secret } = await request.json();
    
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create a mock request with the cron secret header
    const mockRequest = new NextRequest(request.url, {
      method: 'GET',
      headers: {
        'x-cron-secret': process.env.CRON_SECRET!
      }
    });

    return await GET(mockRequest);

  } catch (error: any) {
    console.error("Manual cron trigger error:", error);
    return NextResponse.json(
      { error: "Failed to trigger processing" },
      { status: 500 }
    );
  }
}
