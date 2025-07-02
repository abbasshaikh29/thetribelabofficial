import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import { PaymentGateway } from "@/models/PaymentGateway";
import { getServerSession } from "@/lib/auth-helpers";

/**
 * PUT /api/community/[slug]/payment-gateway
 * Body: { paymentGatewayId: string }
 * Allows a community admin or subadmin to set/change the payment gateway.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { paymentGatewayId } = await request.json();

    if (!paymentGatewayId) {
      return NextResponse.json(
        { error: "paymentGatewayId is required" },
        { status: 400 }
      );
    }

    await dbconnect();

    // Ensure the gateway exists, is enabled, and belongs to the current user (admin)
    const gateway = await PaymentGateway.findOne({ _id: paymentGatewayId, isEnabled: true });
    if (!gateway) {
      return NextResponse.json(
        { error: "Payment gateway not found or disabled" },
        { status: 404 }
      );
    }

    const resolvedParams = await context.params;
    const { slug } = resolvedParams;

    const community = await Community.findOne({ slug });
    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    const userId = session.user.id;
    const isAdmin = community.admin === userId;
    const isSubAdmin = community.subAdmins?.includes(userId) || false;

    if (!isAdmin && !isSubAdmin) {
      return NextResponse.json(
        { error: "Only admins or sub-admins can update payment gateway" },
        { status: 403 }
      );
    }

    // Ensure the gateway belongs to the community admin (extra safety)
    if (gateway.ownerId.toString() !== community.admin) {
      return NextResponse.json(
        { error: "Gateway does not belong to community admin" },
        { status: 403 }
      );
    }

    community.paymentGatewayId = gateway._id;
    await community.save();

    return NextResponse.json({ success: true, paymentGatewayId: gateway._id });
  } catch (error: any) {
    console.error("Error updating community payment gateway:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update payment gateway" },
      { status: 500 }
    );
  }
} 