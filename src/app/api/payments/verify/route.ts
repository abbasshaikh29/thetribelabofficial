import { NextRequest, NextResponse } from "next/server";
import { verifyPaymentSignature } from "@/lib/razorpay";

export async function POST(request: NextRequest) {
  try {
    const { orderId, paymentId, signature } = await request.json();

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

    // Optionally: further validation / database update here

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return NextResponse.json({ success: false, error: error.message || "Server error" }, { status: 500 });
  }
} 