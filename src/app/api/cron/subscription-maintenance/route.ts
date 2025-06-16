import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { fetchSubscription } from "@/lib/razorpay";
import { Subscription } from "@/models/Subscription";
import { User } from "@/models/User";
import { SubscriptionNotificationService } from "@/lib/subscription-notifications";
import { validateAndConvertTimestamp } from "@/lib/subscription-date-utils";

// GET /api/cron/subscription-maintenance - Maintenance tasks for subscriptions
export async function GET(request: NextRequest) {
  try {
    // Verify cron job authorization (implement your own auth logic)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const results = {
      syncedSubscriptions: 0,
      renewalReminders: 0,
      retryNotifications: 0,
      expiredSubscriptions: 0,
      errors: []
    };

    // 1. Sync subscription statuses with Razorpay
    await syncSubscriptionStatuses(results);

    // 2. Send renewal reminders
    await sendRenewalReminders(results);

    // 3. Handle retry notifications
    await handleRetryNotifications(results);

    // 4. Handle expired subscriptions
    await handleExpiredSubscriptions(results);

    // 5. Cleanup old webhook events (keep last 100 per subscription)
    await cleanupWebhookEvents(results);

    return NextResponse.json({
      success: true,
      message: "Subscription maintenance completed",
      results
    });

  } catch (error: any) {
    console.error("Error in subscription maintenance:", error);
    return NextResponse.json(
      { error: error.message || "Maintenance failed" },
      { status: 500 }
    );
  }
}

/**
 * Sync subscription statuses with Razorpay
 */
async function syncSubscriptionStatuses(results: any) {
  try {
    // Get active subscriptions that haven't been synced in the last 24 hours
    const subscriptions = await Subscription.find({
      status: { $in: ["active", "pending", "past_due"] },
      $or: [
        { lastWebhookAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        { lastWebhookAt: { $exists: false } }
      ]
    }).limit(50); // Process in batches

    for (const subscription of subscriptions) {
      try {
        const razorpaySubscription = await fetchSubscription(subscription.razorpaySubscriptionId);
        
        // Update local subscription with Razorpay data
        const wasUpdated = await updateSubscriptionFromRazorpay(subscription, razorpaySubscription);
        
        if (wasUpdated) {
          results.syncedSubscriptions++;
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        console.error(`Error syncing subscription ${subscription.razorpaySubscriptionId}:`, error);
        results.errors.push(`Sync error for ${subscription.razorpaySubscriptionId}: ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error("Error in syncSubscriptionStatuses:", error);
    results.errors.push(`Sync process error: ${error.message}`);
  }
}

/**
 * Send renewal reminders for subscriptions ending soon
 */
async function sendRenewalReminders(results: any) {
  try {
    // Find subscriptions ending in 3 days
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);

    const subscriptions = await Subscription.find({
      status: "active",
      currentEnd: {
        $gte: oneDayFromNow,
        $lte: threeDaysFromNow
      }
    });

    for (const subscription of subscriptions) {
      try {
        // Check if reminder was already sent in the last 2 days
        const recentReminder = subscription.notificationsSent.find(
          (n: { type: string; sentAt: Date; channel: string }) => n.type === "renewal_reminder" &&
          new Date(n.sentAt).getTime() > Date.now() - 2 * 24 * 60 * 60 * 1000
        );

        if (!recentReminder) {
          const daysUntilRenewal = Math.ceil(
            (new Date(subscription.currentEnd).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
          );

          await SubscriptionNotificationService.sendCommunityAdminRenewalReminder(
            subscription.razorpaySubscriptionId,
            daysUntilRenewal
          );

          results.renewalReminders++;
        }
      } catch (error: any) {
        console.error(`Error sending renewal reminder for ${subscription.razorpaySubscriptionId}:`, error);
        results.errors.push(`Renewal reminder error: ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error("Error in sendRenewalReminders:", error);
    results.errors.push(`Renewal reminders process error: ${error.message}`);
  }
}

/**
 * Handle retry notifications for failed payments
 */
async function handleRetryNotifications(results: any) {
  try {
    // Find subscriptions with upcoming retries
    const now = new Date();
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

    const subscriptions = await Subscription.find({
      status: "past_due",
      nextRetryAt: {
        $gte: now,
        $lte: oneHourFromNow
      },
      retryAttempts: { $lt: 3 }
    });

    for (const subscription of subscriptions) {
      try {
        // Check if retry notification was already sent
        const recentRetryNotification = subscription.notificationsSent.find(
          (n: { type: string; sentAt: Date; channel: string }) => n.type === "payment_retry" &&
          new Date(n.sentAt).getTime() > Date.now() - 6 * 60 * 60 * 1000 // 6 hours
        );

        if (!recentRetryNotification) {
          await SubscriptionNotificationService.sendPaymentRetryNotification(
            subscription.razorpaySubscriptionId
          );

          results.retryNotifications++;
        }
      } catch (error: any) {
        console.error(`Error sending retry notification for ${subscription.razorpaySubscriptionId}:`, error);
        results.errors.push(`Retry notification error: ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error("Error in handleRetryNotifications:", error);
    results.errors.push(`Retry notifications process error: ${error.message}`);
  }
}

/**
 * Handle expired subscriptions
 */
async function handleExpiredSubscriptions(results: any) {
  try {
    const now = new Date();

    // Find subscriptions that have ended but status is still active
    const expiredSubscriptions = await Subscription.find({
      status: { $in: ["active", "past_due"] },
      currentEnd: { $lt: now },
      retryAttempts: { $gte: 3 }
    });

    for (const subscription of expiredSubscriptions) {
      try {
        // Update subscription status to expired
        subscription.status = "expired";
        subscription.endedAt = subscription.currentEnd;
        await subscription.save();

        // Update user subscription status
        await User.findByIdAndUpdate(subscription.userId, {
          "paymentSettings.subscriptionStatus": "expired"
        });

        results.expiredSubscriptions++;
      } catch (error: any) {
        console.error(`Error handling expired subscription ${subscription.razorpaySubscriptionId}:`, error);
        results.errors.push(`Expired subscription error: ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error("Error in handleExpiredSubscriptions:", error);
    results.errors.push(`Expired subscriptions process error: ${error.message}`);
  }
}

/**
 * Cleanup old webhook events
 */
async function cleanupWebhookEvents(results: any) {
  try {
    const subscriptions = await Subscription.find({
      "webhookEvents.100": { $exists: true } // Has more than 100 webhook events
    });

    for (const subscription of subscriptions) {
      // Keep only the latest 100 webhook events
      subscription.webhookEvents = subscription.webhookEvents
        .sort((a: { receivedAt: Date }, b: { receivedAt: Date }) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
        .slice(0, 100);
      
      await subscription.save();
    }
  } catch (error: any) {
    console.error("Error in cleanupWebhookEvents:", error);
    results.errors.push(`Webhook cleanup error: ${error.message}`);
  }
}

/**
 * Update subscription from Razorpay data
 */
async function updateSubscriptionFromRazorpay(subscription: any, razorpayData: any): Promise<boolean> {
  let wasUpdated = false;

  if (subscription.status !== razorpayData.status) {
    subscription.status = razorpayData.status;
    wasUpdated = true;
  }

  const newCurrentStart = validateAndConvertTimestamp(
    razorpayData.current_start,
    subscription.currentStart, // Keep existing start date if invalid
    'maintenance'
  );

  const newCurrentEnd = validateAndConvertTimestamp(
    razorpayData.current_end,
    new Date(newCurrentStart.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from start
    'maintenance'
  );

  if (subscription.currentStart.getTime() !== newCurrentStart.getTime()) {
    subscription.currentStart = newCurrentStart;
    wasUpdated = true;
  }

  if (subscription.currentEnd.getTime() !== newCurrentEnd.getTime()) {
    subscription.currentEnd = newCurrentEnd;
    wasUpdated = true;
  }

  console.log("Maintenance: Updated subscription dates:", {
    subscriptionId: razorpayData.id,
    currentStart: newCurrentStart.toISOString(),
    currentEnd: newCurrentEnd.toISOString(),
    wasUpdated
  });

  if (subscription.paidCount !== razorpayData.paid_count) {
    subscription.paidCount = razorpayData.paid_count;
    wasUpdated = true;
  }

  if (subscription.authAttempts !== razorpayData.auth_attempts) {
    subscription.authAttempts = razorpayData.auth_attempts;
    wasUpdated = true;
  }

  if (razorpayData.ended_at && !subscription.endedAt) {
    subscription.endedAt = validateAndConvertTimestamp(
      razorpayData.ended_at,
      new Date(), // Use current date as fallback
      'maintenance-ended'
    );
    wasUpdated = true;
  }

  if (wasUpdated) {
    subscription.lastWebhookAt = new Date();
    await subscription.save();

    // Update user subscription status
    await User.findByIdAndUpdate(subscription.userId, {
      "paymentSettings.subscriptionStatus": razorpayData.status,
      "paymentSettings.subscriptionEndDate": newCurrentEnd
    });
  }

  return wasUpdated;
}
