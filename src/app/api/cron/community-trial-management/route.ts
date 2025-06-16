import { NextRequest, NextResponse } from "next/server";
import { CommunityTrialNotificationService } from "@/lib/community-trial-notifications";
import { CommunitySuspensionService } from "@/lib/community-suspension-service";

// GET /api/cron/community-trial-management - Comprehensive trial management
export async function GET(request: NextRequest) {
  try {
    // Verify cron job authorization
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error("Unauthorized access attempt to community trial management cron endpoint");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Starting comprehensive community trial management...");

    const results = {
      timestamp: new Date().toISOString(),
      reminders: null as any,
      suspensions: null as any,
      totalProcessed: 0,
      totalErrors: 0,
      success: true,
      errors: [] as string[]
    };

    try {
      // Step 1: Send trial reminder notifications
      console.log("Processing trial reminders...");
      results.reminders = await CommunityTrialNotificationService.checkAndSendTrialReminders();
      results.totalProcessed += results.reminders.checked || 0;
      results.totalErrors += results.reminders.errors || 0;
      
      if (results.reminders.errors > 0) {
        results.errors.push(`Trial reminders: ${results.reminders.errors} errors occurred`);
      }
      
      console.log("Trial reminders completed:", {
        checked: results.reminders.checked,
        sent: results.reminders.reminders,
        errors: results.reminders.errors
      });
      
    } catch (error) {
      console.error("Error in trial reminders:", error);
      results.errors.push(`Trial reminders failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      results.totalErrors++;
    }

    try {
      // Step 2: Process expired trials and suspend communities
      console.log("Processing expired trials...");
      results.suspensions = await CommunitySuspensionService.processExpiredTrials();
      results.totalProcessed += results.suspensions.processed || 0;
      results.totalErrors += results.suspensions.errors || 0;
      
      if (results.suspensions.errors > 0) {
        results.errors.push(`Trial suspensions: ${results.suspensions.errors} errors occurred`);
      }
      
      console.log("Expired trials processing completed:", {
        processed: results.suspensions.processed,
        suspended: results.suspensions.suspended,
        errors: results.suspensions.errors
      });
      
    } catch (error) {
      console.error("Error in expired trials processing:", error);
      results.errors.push(`Expired trials processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      results.totalErrors++;
    }

    // Determine overall success
    results.success = results.totalErrors === 0;

    console.log("Community trial management completed:", {
      success: results.success,
      totalProcessed: results.totalProcessed,
      totalErrors: results.totalErrors,
      remindersSent: results.reminders?.reminders || 0,
      communitiesSuspended: results.suspensions?.suspended || 0
    });

    return NextResponse.json({
      success: results.success,
      message: results.success 
        ? "Community trial management completed successfully"
        : `Community trial management completed with ${results.totalErrors} errors`,
      results,
      summary: {
        remindersSent: results.reminders?.reminders || 0,
        communitiesSuspended: results.suspensions?.suspended || 0,
        totalProcessed: results.totalProcessed,
        totalErrors: results.totalErrors
      }
    });

  } catch (error: any) {
    console.error("Critical error in community trial management:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Community trial management failed",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// POST endpoint for manual trigger with specific actions
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    console.log(`Manual trigger of community trial management: ${action || 'all'}`);
    
    let results: any = {
      timestamp: new Date().toISOString(),
      action: action || 'all'
    };
    
    switch (action) {
      case 'reminders':
        results.reminders = await CommunityTrialNotificationService.checkAndSendTrialReminders();
        break;
        
      case 'suspensions':
        results.suspensions = await CommunitySuspensionService.processExpiredTrials();
        break;
        
      default:
        // Run both by default
        results.reminders = await CommunityTrialNotificationService.checkAndSendTrialReminders();
        results.suspensions = await CommunitySuspensionService.processExpiredTrials();
        break;
    }
    
    return NextResponse.json({
      success: true,
      message: `Community trial management triggered manually: ${action || 'all'}`,
      results
    });
    
  } catch (error: any) {
    console.error("Error in manual community trial management trigger:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Manual trigger failed",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
