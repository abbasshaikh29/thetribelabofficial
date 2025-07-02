import { NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { PaymentGateway } from "@/models/PaymentGateway";

/**
 * GET /api/payment-gateways
 * Returns a list of all enabled payment gateways that communities can use.
 * This endpoint is PUBLIC (no auth) and only exposes non-sensitive fields.
 */
export async function GET() {
  try {
    await dbconnect();

    // Fetch all gateways (enabled or not), caller can decide based on isEnabled flag
    const gateways = await PaymentGateway.find().select("_id name isEnabled");

    return NextResponse.json({ success: true, gateways });
  } catch (error: any) {
    console.error("Error fetching payment gateways:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch payment gateways" },
      { status: 500 }
    );
  }
} 