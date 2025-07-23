import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { CommunityPlan } from "@/models/CommunityPlan";
import { Community } from "@/models/Community";
import { Transaction } from "@/models/Transaction";
import { PlanValidator } from "@/lib/plan-validator";

// Razorpay will be imported dynamically in the function

// POST /api/payments/create-subscription-order - Create Razorpay order for plan subscription
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const { planId, communityId, amount, currency } = await request.json();

    // Validate required fields
    if (!planId || !communityId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: planId, communityId, amount" },
        { status: 400 }
      );
    }

    // Get plan details
    const plan = await CommunityPlan.findOne({
      _id: planId,
      communityId,
      isActive: true,
      isPublic: true
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found or not available" },
        { status: 404 }
      );
    }

    // Get community details
    const community = await Community.findById(communityId);
    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Validate amount matches plan
    const expectedAmount = plan.amount + (plan.setupFee || 0);
    if (amount !== expectedAmount) {
      return NextResponse.json(
        { error: "Amount mismatch" },
        { status: 400 }
      );
    }

    // Calculate fee breakdown
    const feeBreakdown = PlanValidator.calculateFees(amount / 100); // Convert paise to rupees

    try {
      // Import Razorpay dynamically
      const Razorpay = (await import('razorpay')).default;
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });

      // Create Razorpay order
      const orderOptions = {
        amount: amount, // Amount in paise
        currency: currency || 'INR',
        receipt: `sub_${Date.now()}_${session.user.id}`,
        notes: {
          plan_id: planId,
          community_id: communityId,
          user_id: session.user.id,
          plan_name: plan.name,
          community_name: community.name,
          gross_amount: feeBreakdown.grossAmount.toString(),
          platform_fee: feeBreakdown.platformFeeAmount.toString(),
          processing_fee: feeBreakdown.processingFeeAmount.toString(),
          admin_earnings: feeBreakdown.netAmount.toString(),
          payment_type: 'subscription'
        }
      };

      const razorpayOrder = await razorpay.orders.create(orderOptions);

      // Create transaction record
      const transaction = new Transaction({
        orderId: razorpayOrder.id,
        amount: amount,
        currency: currency || 'INR',
        status: 'created',
        paymentType: 'community_subscription',
        payerId: session.user.id,
        payeeId: community.adminId,
        communityId: communityId,
        planId: planId,
        feeBreakdown: {
          grossAmount: feeBreakdown.grossAmount,
          platformFeeRate: feeBreakdown.platformFeeRate,
          platformFeeAmount: feeBreakdown.platformFeeAmount,
          processingFeeAmount: feeBreakdown.processingFeeAmount,
          adminEarnings: feeBreakdown.netAmount
        },
        platformFeeCollected: false,
        platformFeeMethod: 'deducted_from_payment',
        metadata: {
          plan_name: plan.name,
          community_name: community.name,
          trial_period_days: plan.trialPeriodDays,
          requires_approval: plan.requiresApproval
        }
      });

      await transaction.save();

      return NextResponse.json({
        success: true,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        communityName: community.name,
        planName: plan.name,
        feeBreakdown: {
          gross: feeBreakdown.grossAmount,
          platformFee: feeBreakdown.platformFeeAmount,
          processingFee: feeBreakdown.processingFeeAmount,
          adminEarnings: feeBreakdown.netAmount
        }
      });

    } catch (razorpayError: any) {
      console.error("Razorpay order creation failed:", razorpayError);
      return NextResponse.json(
        { error: "Failed to create payment order" },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error("Create subscription order error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
