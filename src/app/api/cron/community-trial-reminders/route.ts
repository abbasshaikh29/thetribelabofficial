import { NextRequest, NextResponse } from "next/server";
import { CommunityTrialNotificationService } from "@/lib/community-trial-notifications";

// GET /api/cron/community-trial-reminders - Send trial reminder notifications
export async function GET(request: NextRequest) {
  try {
    // Verify cron job authorization
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error("Unauthorized access attempt to community trial reminders cron endpoint");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Starting community trial reminder cron job...");

    // Run the trial reminder check
    const results = await CommunityTrialNotificationService.checkAndSendTrialReminders();

    console.log("Community trial reminder cron job completed:", results);

    return NextResponse.json({
      success: true,
      message: "Community trial reminders processed successfully",
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Error in community trial reminders cron job:", error);
    return NextResponse.json(
      { 
        error: error.message || "Community trial reminders failed",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// POST endpoint for manual trigger (admin use)
export async function POST(request: NextRequest) {
  try {
    // This could be used for manual testing or admin triggers
    // Add additional authentication if needed
    
    console.log("Manual trigger of community trial reminders...");
    
    const results = await CommunityTrialNotificationService.checkAndSendTrialReminders();
    
    return NextResponse.json({
      success: true,
      message: "Community trial reminders triggered manually",
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error("Error in manual community trial reminders trigger:", error);
    return NextResponse.json(
      { 
        error: error.message || "Manual trigger failed",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
