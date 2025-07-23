import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { AdminPayout } from "@/models/AdminPayout";
import { RouteAccount } from "@/models/RouteAccount";
import { Transaction } from "@/models/Transaction";
import { razorpayRoute } from "@/lib/razorpay-route";

// Webhook event types for Route transfers
interface RouteWebhookEvent {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    transfer: {
      entity: RouteTransferEntity;
    };
    account: {
      entity: RouteAccountEntity;
    };
  };
  created_at: number;
}

interface RouteTransferEntity {
  id: string;
  entity: 'transfer';
  status: 'pending' | 'processing' | 'processed' | 'failed' | 'cancelled' | 'reversed';
  source: string;
  recipient: string;
  amount: number;
  currency: string;
  mode: string;
  purpose: string;
  reference_id: string;
  narration: string;
  batch_id?: string;
  failure_reason?: string;
  created_at: number;
  processed_at?: number;
  notes: Record<string, string>;
}

interface RouteAccountEntity {
  id: string;
  entity: 'account';
  status: 'created' | 'activated' | 'suspended' | 'rejected';
  email: string;
  phone: string;
  type: 'route';
  reference_id: string;
  legal_business_name: string;
  business_type: string;
  contact_name: string;
  created_at: number;
}

// POST /api/webhooks/razorpay-route - Handle Razorpay Route webhook events
export async function POST(request: NextRequest) {
  try {
    await dbconnect();

    // Get the raw body and signature
    const body = await request.text();
    const signature = request.headers.get("x-razorpay-signature");
    const webhookSecret = process.env.RAZORPAY_ROUTE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      console.error("Missing signature or webhook secret for Route webhook");
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Verify webhook signature
    const isValid = razorpayRoute.verifyWebhookSignature(body, signature, webhookSecret);
    if (!isValid) {
      console.error("Invalid Route webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event: RouteWebhookEvent = JSON.parse(body);
    console.log("Route webhook event received:", event.event);

    // Handle different webhook events
    switch (event.event) {
      case "transfer.processed":
        await handleTransferProcessed(event.payload.transfer.entity);
        break;

      case "transfer.failed":
        await handleTransferFailed(event.payload.transfer.entity);
        break;
      
      case "transfer.reversed":
        await handleTransferReversed(event.payload.transfer.entity);
        break;
      
      case "account.activated":
        await handleAccountActivated(event.payload.account.entity);
        break;

      case "account.suspended":
        await handleAccountSuspended(event.payload.account.entity);
        break;
      
      case "account.rejected":
        await handleAccountRejected(event.payload.account.entity);
        break;
      
      default:
        console.log("Unhandled Route webhook event:", event.event);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Route webhook handler error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handle transfer processed event
async function handleTransferProcessed(transfer: RouteTransferEntity) {
  try {
    console.log("Processing transfer completed:", transfer.id);

    // Find the payout record by reference_id (which is the payout _id)
    const payout = await AdminPayout.findById(transfer.reference_id);
    if (!payout) {
      console.error("Payout not found for transfer:", transfer.id);
      return;
    }

    // Update payout status
    payout.status = 'processed';
    payout.razorpayTransferId = transfer.id;
    payout.transferCompletedAt = new Date(transfer.processed_at! * 1000);
    
    await payout.save();

    // Update the related transaction
    if (payout.sourceTransactionId) {
      await Transaction.findByIdAndUpdate(payout.sourceTransactionId, {
        routeTransferId: transfer.id,
        routePayoutId: payout._id
      });
    }

    // Update Route account statistics
    const routeAccount = await RouteAccount.findOne({ 
      routeAccountId: transfer.recipient 
    });
    
    if (routeAccount) {
      await routeAccount.recordPayout(transfer.amount);
    }

    console.log("Transfer processed successfully:", transfer.id);
  } catch (error) {
    console.error("Error handling transfer processed:", error);
  }
}

// Handle transfer failed event
async function handleTransferFailed(transfer: RouteTransferEntity) {
  try {
    console.log("Processing transfer failed:", transfer.id);

    // Find the payout record
    const payout = await AdminPayout.findById(transfer.reference_id);
    if (!payout) {
      console.error("Payout not found for failed transfer:", transfer.id);
      return;
    }

    // Update payout status and schedule retry
    await payout.markFailed(transfer.failure_reason || 'Transfer failed');

    console.log("Transfer failure recorded:", transfer.id);
  } catch (error) {
    console.error("Error handling transfer failed:", error);
  }
}

// Handle transfer reversed event
async function handleTransferReversed(transfer: RouteTransferEntity) {
  try {
    console.log("Processing transfer reversed:", transfer.id);

    // Find the payout record
    const payout = await AdminPayout.findById(transfer.reference_id);
    if (!payout) {
      console.error("Payout not found for reversed transfer:", transfer.id);
      return;
    }

    // Update payout status
    payout.status = 'reversed';
    payout.failureReason = 'Transfer was reversed';
    
    await payout.save();

    // Update Route account statistics (subtract the amount)
    const routeAccount = await RouteAccount.findOne({ 
      routeAccountId: transfer.recipient 
    });
    
    if (routeAccount) {
      routeAccount.totalPayoutsReceived = Math.max(0, routeAccount.totalPayoutsReceived - transfer.amount);
      routeAccount.totalPayoutsCount = Math.max(0, routeAccount.totalPayoutsCount - 1);
      await routeAccount.save();
    }

    console.log("Transfer reversal processed:", transfer.id);
  } catch (error) {
    console.error("Error handling transfer reversed:", error);
  }
}

// Handle account activated event
async function handleAccountActivated(account: RouteAccountEntity) {
  try {
    console.log("Processing account activated:", account.id);

    // Find the Route account by reference_id (admin ID)
    const routeAccount = await RouteAccount.findOne({ 
      adminId: account.reference_id 
    });
    
    if (!routeAccount) {
      console.error("Route account not found for activated account:", account.id);
      return;
    }

    // Update account status
    routeAccount.status = 'activated';
    routeAccount.kycStatus = 'verified';
    routeAccount.activatedAt = new Date();
    
    await routeAccount.save();

    // Process any queued transfers for this admin
    const { TransferManager } = await import('@/lib/transfer-manager');
    const result = await TransferManager.processQueuedTransfers(routeAccount.adminId);
    
    console.log(`Account activated and ${result.successfulTransfers} queued transfers processed for admin:`, account.reference_id);
  } catch (error) {
    console.error("Error handling account activated:", error);
  }
}

// Handle account suspended event
async function handleAccountSuspended(account: RouteAccountEntity) {
  try {
    console.log("Processing account suspended:", account.id);

    // Find the Route account
    const routeAccount = await RouteAccount.findOne({ 
      adminId: account.reference_id 
    });
    
    if (!routeAccount) {
      console.error("Route account not found for suspended account:", account.id);
      return;
    }

    // Update account status
    routeAccount.status = 'suspended';
    await routeAccount.save();

    // Mark any pending payouts as failed
    await AdminPayout.updateMany(
      { 
        adminId: routeAccount.adminId,
        status: { $in: ['pending', 'processing'] }
      },
      { 
        status: 'failed',
        failureReason: 'Route account suspended'
      }
    );

    console.log("Account suspension processed:", account.id);
  } catch (error) {
    console.error("Error handling account suspended:", error);
  }
}

// Handle account rejected event
async function handleAccountRejected(account: RouteAccountEntity) {
  try {
    console.log("Processing account rejected:", account.id);

    // Find the Route account
    const routeAccount = await RouteAccount.findOne({ 
      adminId: account.reference_id 
    });
    
    if (!routeAccount) {
      console.error("Route account not found for rejected account:", account.id);
      return;
    }

    // Update account status
    routeAccount.status = 'rejected';
    routeAccount.kycStatus = 'rejected';
    await routeAccount.save();

    // Mark any pending payouts as failed
    await AdminPayout.updateMany(
      { 
        adminId: routeAccount.adminId,
        status: { $in: ['pending', 'processing', 'queued'] }
      },
      { 
        status: 'failed',
        failureReason: 'Route account rejected'
      }
    );

    console.log("Account rejection processed:", account.id);
  } catch (error) {
    console.error("Error handling account rejected:", error);
  }
}
