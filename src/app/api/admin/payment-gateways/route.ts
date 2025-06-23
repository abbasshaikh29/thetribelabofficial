import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { PaymentGateway } from "@/models/PaymentGateway";
import { User } from "@/models/User";

/**
 * GET /api/admin/payment-gateways
 * Return a list of all configured payment gateways.
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    // For backward compatibility: platform-level admin can view all gateways.
    const user = await User.findById(session.user.id);

    let gateways;
    if (user?.isAdmin) {
      gateways = await PaymentGateway.find();
    } else {
      gateways = await PaymentGateway.find({ ownerId: session.user.id });
    }

    const sanitizedGateways = gateways.map((g: any) => {
      const { credentials, ...rest } = g.toObject();
      return rest;
    });
    return NextResponse.json({ success: true, gateways: sanitizedGateways });
  } catch (error: any) {
    console.error("Error fetching payment gateways:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch payment gateways" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/payment-gateways
 * Create or update a payment gateway configuration.
 * Body example:
 * {
 *   "name": "stripe",
 *   "isEnabled": true,
 *   "credentials": {
 *       "apiKey": "sk_...",
 *       "secretKey": "..."
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    // Allow any logged-in user to create their own gateway; platform admin can create global ones too.
    const user = await User.findById(session.user.id);

    const body = await request.json();
    const { name, isEnabled = false, credentials = {} } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Gateway name is required" },
        { status: 400 }
      );
    }

    // Either update an existing gateway (by name) or create a new one
    const gateway = await PaymentGateway.findOneAndUpdate(
      { ownerId: session.user.id, name },
      { ownerId: session.user.id, name, isEnabled, credentials },
      { upsert: true, new: true }
    );

    const { credentials: _cred, ...gatewaySafe } = gateway.toObject();
    return NextResponse.json({ success: true, gateway: gatewaySafe });
  } catch (error: any) {
    console.error("Error saving payment gateway:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save payment gateway" },
      { status: 500 }
    );
  }
} 