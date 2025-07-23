import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
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
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    await dbconnect();

    // Find the community
    const community = await (Community as any).findById(communityId);
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

    // Set trial end date to 14 days from now
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14);

    // Update admin-specific trial information instead of community-wide trial
    community.adminTrialInfo = {
      activated: true,
      startDate: new Date(),
      endDate: trialEndDate
    };
    
    // Set community payment status to trial
    community.paymentStatus = "trial";
    
    // Set subscription end date to the same as trial end date
    community.subscriptionEndDate = trialEndDate;

    await community.save();

    return NextResponse.json({ 
      success: true,
      message: "Free trial activated successfully for admin",
      trialEndDate
    });
  } catch (error) {
    console.error("Error activating free trial:", error);
    return NextResponse.json(
      { error: "Failed to activate free trial" },
      { status: 500 }
    );
  }
}
