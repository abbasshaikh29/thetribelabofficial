import { NextRequest, NextResponse } from "next/server";
import { CommunitySuspensionService } from "@/lib/community-suspension-service";

// GET /api/cron/process-expired-trials - Process expired trials and suspend communities
export async function GET(request: NextRequest) {
  try {
    // Verify cron job authorization
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error("Unauthorized access attempt to expired trials cron endpoint");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Starting expired trials processing cron job...");

    // Process expired trials
    const results = await CommunitySuspensionService.processExpiredTrials();

    console.log("Expired trials processing cron job completed:", results);

    return NextResponse.json({
      success: true,
      message: "Expired trials processed successfully",
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Error in expired trials processing cron job:", error);
    return NextResponse.json(
      { 
        error: error.message || "Expired trials processing failed",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// POST endpoint for manual trigger (admin use)
export async function POST(request: NextRequest) {
  try {
    console.log("Manual trigger of expired trials processing...");
    
    const results = await CommunitySuspensionService.processExpiredTrials();
    
    return NextResponse.json({
      success: true,
      message: "Expired trials processing triggered manually",
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error("Error in manual expired trials processing trigger:", error);
    return NextResponse.json(
      { 
        error: error.message || "Manual trigger failed",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
