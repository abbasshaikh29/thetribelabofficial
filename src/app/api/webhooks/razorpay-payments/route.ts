import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { Transaction } from "@/models/Transaction";
import { CommunityPlan } from "@/models/CommunityPlan";
import { Community } from "@/models/Community";
import { TransferManager } from "@/lib/transfer-manager";
import { PlatformSubscription } from "@/models/PlatformSubscription";
import crypto from 'crypto';

// Webhook event types for Razorpay payments
interface RazorpayWebhookEvent {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment: {
      entity: RazorpayPaymentEntity;
    };
    order?: {
      entity: RazorpayOrderEntity;
    };
  };
  created_at: number;
}

interface RazorpayPaymentEntity {
  id: string;
  entity: 'payment';
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  order_id: string;
  method: string;
  captured: boolean;
  description?: string;
  email: string;
  contact: string;
  notes: Record<string, string>;
  created_at: number;
}

interface RazorpayOrderEntity {
  id: string;
  entity: 'order';
  amount: number;
  currency: string;
  status: string;
  notes: Record<string, string>;
  created_at: number;
}

// POST /api/webhooks/razorpay-payments - Handle Razorpay payment webhook events
export async function POST(request: NextRequest) {
  try {
    await dbconnect();

    // Get the raw body and signature
    const body = await request.text();
    const signature = request.headers.get("x-razorpay-signature");
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      console.error("Missing signature or webhook secret for payment webhook");
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      console.error("Invalid payment webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event: RazorpayWebhookEvent = JSON.parse(body);
    console.log("Payment webhook event received:", event.event);

    // Handle different webhook events
    switch (event.event) {
      case "payment.captured":
        await handlePaymentCaptured(event.payload.payment.entity);
        break;

      case "payment.failed":
        await handlePaymentFailed(event.payload.payment.entity);
        break;
      
      case "payment.authorized":
        await handlePaymentAuthorized(event.payload.payment.entity);
        break;

      default:
        console.log("Unhandled payment webhook event:", event.event);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Payment webhook handler error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handle payment captured event - trigger Route transfer
async function handlePaymentCaptured(payment: RazorpayPaymentEntity) {
  try {
    console.log("Processing payment captured:", payment.id);

    // Find the transaction
    const transaction = await Transaction.findOne({ 
      orderId: payment.order_id 
    });

    if (!transaction) {
      console.error("Transaction not found for payment:", payment.id);
      return;
    }

    // Update transaction status
    transaction.paymentId = payment.id;
    transaction.status = 'captured';
    await transaction.save();

    // Only process community subscription payments for Route transfers
    if (transaction.paymentType === 'community_subscription') {
      await processSubscriptionPayment(transaction, payment);
    }

    console.log("Payment captured processed successfully:", payment.id);
  } catch (error) {
    console.error("Error handling payment captured:", error);
  }
}

// Process subscription payment and trigger Route transfer
async function processSubscriptionPayment(transaction: any, payment: RazorpayPaymentEntity) {
  try {
    // Get community and plan details
    const [community, plan] = await Promise.all([
      Community.findById(transaction.communityId),
      CommunityPlan.findById(transaction.planId)
    ]);

    if (!community || !plan) {
      console.error("Community or plan not found for transaction:", transaction._id);
      return;
    }

    // Update plan statistics
    await CommunityPlan.findByIdAndUpdate(plan._id, {
      $inc: { 
        totalSubscribers: 1,
        totalRevenue: transaction.feeBreakdown.grossAmount
      }
    });

    // Trigger Route transfer to admin
    const transferResult = await TransferManager.createTransfer({
      adminId: community.adminId,
      grossAmount: transaction.feeBreakdown.grossAmount,
      sourceTransactionId: transaction._id,
      memberId: transaction.payerId,
      communityId: transaction.communityId,
      sourceType: 'member_subscription',
      platformFeeRate: transaction.feeBreakdown.platformFeeRate
    });

    if (transferResult.success) {
      console.log(`Route transfer initiated successfully for payment ${payment.id}`);
      
      // Update transaction with transfer info
      transaction.routeTransferId = transferResult.transferId;
      transaction.routePayoutId = transferResult.payout?._id;
      await transaction.save();

      // Update platform subscription with earnings
      await updatePlatformSubscriptionEarnings(
        community.adminId, 
        transaction.feeBreakdown.grossAmount
      );

    } else {
      console.error(`Route transfer failed for payment ${payment.id}:`, transferResult.error);
      
      // Transfer will be retried automatically by the retry system
      // Log for monitoring
      console.log(`Transfer queued for retry: ${transferResult.error}`);
    }

  } catch (error) {
    console.error("Error processing subscription payment:", error);
  }
}

// Update platform subscription with monthly earnings
async function updatePlatformSubscriptionEarnings(adminId: any, grossAmount: number) {
  try {
    const platformSubscription = await PlatformSubscription.findOne({ adminId });
    
    if (platformSubscription) {
      // Add to monthly earnings
      platformSubscription.monthlyEarnings += grossAmount;
      platformSubscription.memberCount += 1;
      platformSubscription.transactionCount += 1;
      
      await platformSubscription.save();
    }
  } catch (error) {
    console.error("Error updating platform subscription earnings:", error);
  }
}

// Handle payment failed event
async function handlePaymentFailed(payment: RazorpayPaymentEntity) {
  try {
    console.log("Processing payment failed:", payment.id);

    // Find and update transaction
    const transaction = await Transaction.findOne({ 
      orderId: payment.order_id 
    });

    if (transaction) {
      transaction.paymentId = payment.id;
      transaction.status = 'failed';
      await transaction.save();
    }

    console.log("Payment failure recorded:", payment.id);
  } catch (error) {
    console.error("Error handling payment failed:", error);
  }
}

// Handle payment authorized event
async function handlePaymentAuthorized(payment: RazorpayPaymentEntity) {
  try {
    console.log("Processing payment authorized:", payment.id);

    // Find and update transaction
    const transaction = await Transaction.findOne({ 
      orderId: payment.order_id 
    });

    if (transaction) {
      transaction.paymentId = payment.id;
      transaction.status = 'authorized';
      await transaction.save();
    }

    console.log("Payment authorization recorded:", payment.id);
  } catch (error) {
    console.error("Error handling payment authorized:", error);
  }
}
