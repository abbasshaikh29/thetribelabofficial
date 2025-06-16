import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import { clearTrialState } from "@/lib/trial-service";
import { User } from "@/models/User";
import { ObjectId } from "mongodb";

export async function POST(request: NextRequest) {
  // Extract the ID from the URL path
  const id = request.nextUrl.pathname.split('/').pop();
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const communityId = id;
    if (!communityId) {
      return NextResponse.json(
        { error: "Community ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { transactionId, paymentId, freeTrialActivated = false } = body;

    if (!transactionId && !freeTrialActivated) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    await dbconnect();

    // Find the community
    const community = await Community.findById(communityId);
    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Check if the user is the community admin
    if (community.admin.toString() !== session.user.id) {
      return NextResponse.json(
        { error: "You are not authorized to update this community" },
        { status: 403 }
      );
    }

    // Update community with payment information
    community.paymentStatus = "paid";
    community.paymentDate = new Date();
    community.transactionId = transactionId;
    community.paymentId = paymentId;

    // Set subscription end date to 1 month from now
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);
    community.subscriptionEndDate = subscriptionEndDate;

    await community.save();

    // Clear trial state now that subscription is active
    await clearTrialState(communityId, session.user.id);

    return NextResponse.json({ 
      success: true,
      message: "Payment completed successfully" 
    });
  } catch (error) {
    console.error("Error completing payment:", error);
    return NextResponse.json(
      { error: "Failed to complete payment" },
      { status: 500 }
    );
  }
}
