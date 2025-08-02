import { NextRequest, NextResponse } from "next/server";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Transaction } from "@/models/Transaction";
import { Community } from "@/models/Community";

// Fast payment verification endpoint - processes transfers asynchronously
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId, paymentId, signature, communitySlug } = await request.json();

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    console.log("Fast payment verification started:", {
      orderId: orderId.substring(0, 15) + "...",
      paymentId: paymentId.substring(0, 15) + "...",
      userId: session.user.id,
      timestamp: new Date().toISOString()
    });

    // Quick signature verification first
    const isValid = verifyPaymentSignature(orderId, paymentId, signature);

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid payment signature" },
        { status: 400 }
      );
    }

    await dbconnect();

    // Quick database operations
    const community = communitySlug 
      ? await Community.findOne({ slug: communitySlug }).select('_id admin name price currency')
      : null;

    // Create or update transaction record quickly
    let transaction = await Transaction.findOne({ orderId });

    if (!transaction) {
      // Create new transaction
      transaction = new Transaction({
        orderId,
        paymentId,
        signature,
        amount: community?.price ? community.price * 100 : 0,
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

    const processingTime = Date.now() - startTime;
    console.log(`Fast payment verification completed in ${processingTime}ms`);

    // Schedule transfer processing asynchronously (don't wait for it)
    if (community?.admin && transaction._id) {
      // Fire and forget - process transfer in background
      setImmediate(async () => {
        try {
          console.log("Processing transfer asynchronously for transaction:", transaction._id);
          // You can call your transfer processing logic here
          // await processTransferAsync(transaction._id, community.admin);
        } catch (transferError) {
          console.error("Async transfer processing error:", transferError);
        }
      });
    }

    return NextResponse.json({
      success: true,
      transactionId: transaction._id,
      processingTime,
      message: "Payment verified successfully"
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error("Fast payment verification error:", error);
    console.error(`Failed after ${processingTime}ms`);
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Payment verification failed",
        processingTime 
      },
      { status: 500 }
    );
  }
}
