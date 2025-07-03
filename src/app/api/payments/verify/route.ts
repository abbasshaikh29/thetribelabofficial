import { NextRequest, NextResponse } from "next/server";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Transaction } from "@/models/Transaction";
import { Community } from "@/models/Community";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId, paymentId, signature, communitySlug } =
      await request.json();

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    const isValid = verifyPaymentSignature(orderId, paymentId, signature);

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid payment signature" },
        { status: 400 }
      );
    }

    await dbconnect();

    // Find the community if communitySlug is provided
    let community = null;
    if (communitySlug) {
      community = await Community.findOne({ slug: communitySlug });
    }

    // Create or update transaction record
    let transaction = await Transaction.findOne({ orderId });

    if (!transaction) {
      // Create new transaction
      transaction = new Transaction({
        orderId,
        paymentId,
        signature,
        amount: community?.price ? community.price * 100 : 0, // Convert to paise
        currency: community?.currency || "USD",
        status: "captured",
        paymentType: "community",
        payerId: session.user.id,
        payeeId: community?.admin,
        communityId: community?._id,
        metadata: {
          communitySlug,
          communityName: community?.name,
        },
      });
    } else {
      // Update existing transaction
      transaction.paymentId = paymentId;
      transaction.signature = signature;
      transaction.status = "captured";
    }

    await transaction.save();

    return NextResponse.json({
      success: true,
      transactionId: transaction._id,
    });
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
