import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Transaction } from "@/models/Transaction";
import { CommunityPlan } from "@/models/CommunityPlan";
import { Community } from "@/models/Community";
import { TransferManager } from "@/lib/transfer-manager";
import crypto from 'crypto';
import mongoose from "mongoose";

// POST /api/payments/verify-subscription - Verify payment and trigger Route transfer
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
      communityId
    } = await request.json();

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planId || !communityId) {
      return NextResponse.json(
        { error: "Missing required payment verification fields" },
        { status: 400 }
      );
    }

    // Verify Razorpay signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 }
      );
    }

    // Find the transaction
    const transaction = await Transaction.findOne({
      orderId: razorpay_order_id,
      payerId: session.user.id
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Update transaction with payment details
    transaction.paymentId = razorpay_payment_id;
    transaction.signature = razorpay_signature;
    transaction.status = 'captured';
    await transaction.save();

    // Get plan and community details
    const [plan, community] = await Promise.all([
      CommunityPlan.findById(planId),
      Community.findById(communityId)
    ]);

    if (!plan || !community) {
      return NextResponse.json(
        { error: "Plan or community not found" },
        { status: 404 }
      );
    }

    // Initialize transfer result
    let transferResult: any = null;

    try {
      // Trigger automatic Route transfer to admin
      transferResult = await TransferManager.createTransfer({
        adminId: community.adminId,
        grossAmount: transaction.feeBreakdown!.grossAmount,
        sourceTransactionId: transaction._id!,
        memberId: new mongoose.Types.ObjectId(session.user.id),
        communityId: communityId,
        sourceType: 'member_subscription',
        platformFeeRate: transaction.feeBreakdown!.platformFeeRate
      });

      if (transferResult.success) {
        console.log(`Route transfer initiated successfully for transaction ${transaction._id}`);
      } else {
        console.error(`Route transfer failed for transaction ${transaction._id}:`, transferResult.error);
        // Continue with subscription creation even if transfer fails (it will be retried)
      }

    } catch (transferError) {
      console.error("Transfer initiation error:", transferError);
      // Continue with subscription creation
    }

    // Create member subscription record (you might want to create a MemberSubscription model)
    const subscriptionData = {
      memberId: session.user.id,
      communityId: communityId,
      planId: planId,
      transactionId: transaction._id,
      status: plan.requiresApproval ? 'pending_approval' : 'active',
      startDate: new Date(),
      trialEndDate: plan.trialPeriodDays > 0 ? 
        new Date(Date.now() + (plan.trialPeriodDays * 24 * 60 * 60 * 1000)) : 
        null,
      nextBillingDate: plan.interval !== 'one_time' ? 
        new Date(Date.now() + (plan.interval === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000) :
        null
    };

    // Update plan statistics
    await CommunityPlan.findByIdAndUpdate(planId, {
      $inc: { 
        totalSubscribers: 1,
        totalRevenue: transaction.feeBreakdown!.grossAmount
      }
    });

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully",
      subscriptionId: `sub_${transaction._id}`,
      subscription: subscriptionData,
      requiresApproval: plan.requiresApproval,
      trialPeriod: plan.trialPeriodDays,
      transferInitiated: transferResult?.success || false
    });

  } catch (error: any) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 500 }
    );
  }
}
