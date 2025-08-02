import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      hasMongoUri: !!process.env.MONGODB_URI,
      hasRazorpayKey: !!process.env.RAZORPAY_KEY_ID,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      deploymentTime: "2025-08-01-v2"
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
