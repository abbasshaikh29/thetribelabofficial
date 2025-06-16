import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { CommunitySubscription } from "@/models/Subscription";
import { User } from "@/models/User";
import { Community } from "@/models/Community";
import { Transaction } from "@/models/Transaction";
import { validateAndConvertTimestamp } from "@/lib/subscription-date-utils";
import { CommunitySuspensionService } from "@/lib/community-suspension-service";

// POST /api/webhooks/razorpay - Handle Razorpay webhook events
export async function POST(request: NextRequest) {
  try {
    await dbconnect();

    // Get the raw body and signature
    const body = await request.text();
    const signature = request.headers.get("x-razorpay-signature");
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      console.error("Missing signature or webhook secret");
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Verify webhook signature
    const isValid = verifyWebhookSignature(body, signature, webhookSecret);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);
    console.log("Received webhook event:", event.event, event.payload?.subscription?.entity?.id);

    // Handle different webhook events
    switch (event.event) {
      case "subscription.charged":
        await handleSubscriptionCharged(event.payload);
        break;
      
      case "subscription.failed":
        await handleSubscriptionFailed(event.payload);
        break;
      
      case "subscription.cancelled":
        await handleSubscriptionCancelled(event.payload);
        break;
      
      case "subscription.activated":
        await handleSubscriptionActivated(event.payload);
        break;
      
      case "subscription.completed":
        await handleSubscriptionCompleted(event.payload);
        break;
      
      case "subscription.halted":
        await handleSubscriptionHalted(event.payload);
        break;
      
      case "invoice.issued":
        await handleInvoiceIssued(event.payload);
        break;
      
      default:
        console.log("Unhandled webhook event:", event.event);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// Handle successful subscription charge (community admin payment)
async function handleSubscriptionCharged(payload: any) {
  const subscription = payload.subscription?.entity;
  const payment = payload.payment?.entity;

  if (!subscription || !payment) {
    console.error("Missing subscription or payment data in charged event");
    return;
  }

  try {
    // Update subscription in database
    const dbSubscription = await CommunitySubscription.findOne({
      razorpaySubscriptionId: subscription.id
    });

    if (dbSubscription) {
      // Update subscription status and dates with validation
      dbSubscription.status = subscription.status;

      const newCurrentStart = validateAndConvertTimestamp(
        subscription.current_start,
        dbSubscription.currentStart, // Keep existing start date if invalid
        'webhook-charged'
      );

      const newCurrentEnd = validateAndConvertTimestamp(
        subscription.current_end,
        new Date(newCurrentStart.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from start
        'webhook-charged'
      );

      dbSubscription.currentStart = newCurrentStart;
      dbSubscription.currentEnd = newCurrentEnd;
      dbSubscription.paidCount = subscription.paid_count;
      dbSubscription.consecutiveFailures = 0; // Reset failure count
      dbSubscription.retryAttempts = 0; // Reset retry attempts
      dbSubscription.lastWebhookAt = new Date();

      console.log("Webhook: Updated subscription dates:", {
        subscriptionId: subscription.id,
        currentStart: newCurrentStart.toISOString(),
        currentEnd: newCurrentEnd.toISOString(),
        status: subscription.status
      });

      // Add webhook event to history
      dbSubscription.webhookEvents.push({
        event: "subscription.charged",
        receivedAt: new Date(),
        processed: true,
        data: { subscriptionId: subscription.id, paymentId: payment.id }
      });

      await dbSubscription.save();

      // Update community admin subscription status
      await User.findByIdAndUpdate(dbSubscription.adminId, {
        "communityAdminSubscription.subscriptionStatus": "active",
        "communityAdminSubscription.subscriptionEndDate": newCurrentEnd
      });

      // Update community subscription status if community exists
      if (dbSubscription.communityId) {
        await Community.findByIdAndUpdate(dbSubscription.communityId, {
          subscriptionStatus: "active",
          subscriptionEndDate: newCurrentEnd
        });
      }

      // Create transaction record
      const transaction = new Transaction({
        orderId: payment.order_id || `sub_${subscription.id}_${Date.now()}`,
        paymentId: payment.id,
        amount: payment.amount / 100, // Convert from paise
        currency: payment.currency,
        status: "captured",
        paymentType: "community_subscription",
        payerId: dbSubscription.adminId,
        metadata: {
          subscriptionId: subscription.id,
          communityId: dbSubscription.communityId?.toString(),
          isRecurring: true,
          chargeDate: new Date().toISOString(),
          adminPayment: true
        }
      });

      await transaction.save();

      console.log(`Community admin subscription ${subscription.id} charged successfully`);
    }
  } catch (error) {
    console.error("Error handling subscription charged:", error);
  }
}

// Handle failed subscription charge (community admin payment failure)
async function handleSubscriptionFailed(payload: any) {
  const subscription = payload.subscription?.entity;

  if (!subscription) {
    console.error("Missing subscription data in failed event");
    return;
  }

  try {
    const dbSubscription = await CommunitySubscription.findOne({
      razorpaySubscriptionId: subscription.id
    });

    if (dbSubscription) {
      dbSubscription.status = subscription.status;
      dbSubscription.consecutiveFailures += 1;
      dbSubscription.lastFailureAt = new Date();
      dbSubscription.lastWebhookAt = new Date();

      // Set next retry date (24 hours later)
      if (dbSubscription.retryAttempts < dbSubscription.maxRetryAttempts) {
        dbSubscription.nextRetryAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        dbSubscription.retryAttempts += 1;
      }

      // Add webhook event to history
      dbSubscription.webhookEvents.push({
        event: "subscription.failed",
        receivedAt: new Date(),
        processed: true,
        data: { subscriptionId: subscription.id, reason: payload.payment?.entity?.error_description }
      });

      await dbSubscription.save();

      // Update community admin subscription status
      await User.findByIdAndUpdate(dbSubscription.adminId, {
        "communityAdminSubscription.subscriptionStatus": "past_due",
        "communityAdminSubscription.lastPaymentFailure": new Date()
      });

      // Update community status if community exists
      if (dbSubscription.communityId) {
        await Community.findByIdAndUpdate(dbSubscription.communityId, {
          subscriptionStatus: "past_due"
        });
      }

      console.log(`Community admin subscription ${subscription.id} payment failed`);
    }
  } catch (error) {
    console.error("Error handling subscription failed:", error);
  }
}

// Handle subscription cancellation
async function handleSubscriptionCancelled(payload: any) {
  const subscription = payload.subscription?.entity;

  if (!subscription) {
    console.error("Missing subscription data in cancelled event");
    return;
  }

  try {
    const dbSubscription = await CommunitySubscription.findOne({
      razorpaySubscriptionId: subscription.id
    });

    if (dbSubscription) {
      dbSubscription.status = "cancelled";
      dbSubscription.endedAt = validateAndConvertTimestamp(
        subscription.ended_at,
        new Date(), // Use current date as fallback
        'webhook-cancelled'
      );
      dbSubscription.lastWebhookAt = new Date();

      // Add webhook event to history
      dbSubscription.webhookEvents.push({
        event: "subscription.cancelled",
        receivedAt: new Date(),
        processed: true,
        data: { subscriptionId: subscription.id }
      });

      await dbSubscription.save();

      // Update community admin subscription status
      await User.findByIdAndUpdate(dbSubscription.adminId, {
        "communityAdminSubscription.subscriptionStatus": "canceled"
      });

      console.log(`Subscription ${subscription.id} cancelled`);
    }
  } catch (error) {
    console.error("Error handling subscription cancelled:", error);
  }
}

// Handle subscription activation
async function handleSubscriptionActivated(payload: any) {
  const subscription = payload.subscription?.entity;

  if (!subscription) return;

  try {
    const dbSubscription = await CommunitySubscription.findOne({
      razorpaySubscriptionId: subscription.id
    });

    if (dbSubscription) {
      dbSubscription.status = "active";
      dbSubscription.lastWebhookAt = new Date();

      dbSubscription.webhookEvents.push({
        event: "subscription.activated",
        receivedAt: new Date(),
        processed: true,
        data: { subscriptionId: subscription.id }
      });

      await dbSubscription.save();

      await User.findByIdAndUpdate(dbSubscription.adminId, {
        "communityAdminSubscription.subscriptionStatus": "active"
      });

      // Reactivate community if it was suspended
      try {
        await CommunitySuspensionService.reactivateCommunity(subscription.id);
        console.log(`Community reactivated for subscription ${subscription.id}`);
      } catch (reactivationError) {
        console.error(`Error reactivating community for subscription ${subscription.id}:`, reactivationError);
        // Don't fail the webhook if reactivation fails
      }
    }
  } catch (error) {
    console.error("Error handling subscription activated:", error);
  }
}

// Handle subscription completion
async function handleSubscriptionCompleted(payload: any) {
  const subscription = payload.subscription?.entity;

  if (!subscription) return;

  try {
    const dbSubscription = await CommunitySubscription.findOne({
      razorpaySubscriptionId: subscription.id
    });

    if (dbSubscription) {
      dbSubscription.status = "completed";
      dbSubscription.endedAt = validateAndConvertTimestamp(
        subscription.ended_at,
        new Date(), // Use current date as fallback
        'webhook-completed'
      );
      dbSubscription.lastWebhookAt = new Date();

      dbSubscription.webhookEvents.push({
        event: "subscription.completed",
        receivedAt: new Date(),
        processed: true,
        data: { subscriptionId: subscription.id }
      });

      await dbSubscription.save();

      await User.findByIdAndUpdate(dbSubscription.adminId, {
        "communityAdminSubscription.subscriptionStatus": "expired"
      });
    }
  } catch (error) {
    console.error("Error handling subscription completed:", error);
  }
}

// Handle subscription halted
async function handleSubscriptionHalted(payload: any) {
  const subscription = payload.subscription?.entity;

  if (!subscription) return;

  try {
    const dbSubscription = await CommunitySubscription.findOne({
      razorpaySubscriptionId: subscription.id
    });

    if (dbSubscription) {
      dbSubscription.status = "halted";
      dbSubscription.lastWebhookAt = new Date();

      dbSubscription.webhookEvents.push({
        event: "subscription.halted",
        receivedAt: new Date(),
        processed: true,
        data: { subscriptionId: subscription.id }
      });

      await dbSubscription.save();

      await User.findByIdAndUpdate(dbSubscription.adminId, {
        "communityAdminSubscription.subscriptionStatus": "halted"
      });
    }
  } catch (error) {
    console.error("Error handling subscription halted:", error);
  }
}

// Handle invoice issued (upcoming renewal notification)
async function handleInvoiceIssued(payload: any) {
  const invoice = payload.invoice?.entity;

  if (!invoice || !invoice.subscription_id) return;

  try {
    const dbSubscription = await CommunitySubscription.findOne({
      razorpaySubscriptionId: invoice.subscription_id
    });

    if (dbSubscription) {
      dbSubscription.webhookEvents.push({
        event: "invoice.issued",
        receivedAt: new Date(),
        processed: true,
        data: {
          subscriptionId: invoice.subscription_id,
          invoiceId: invoice.id,
          amount: invoice.amount,
          dueDate: validateAndConvertTimestamp(
            invoice.due_date,
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now as fallback
            'webhook-invoice'
          )
        }
      });

      await dbSubscription.save();

      // Here you can add logic to send renewal reminder notifications
      console.log(`Invoice issued for subscription ${invoice.subscription_id}`);
    }
  } catch (error) {
    console.error("Error handling invoice issued:", error);
  }
}
