import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import { ICommunity } from "@/models/Community";
import { getCommunityStatus } from "@/lib/trial-service";

// Define a type for the community document
interface CommunityDocument extends ICommunity {
  _id: any;
  admin: any;
  slug: string;
  adminTrialInfo?: {
    activated: boolean;
    startDate?: Date;
    endDate?: Date;
  };
  paymentStatus?: 'unpaid' | 'trial' | 'paid' | 'expired';
  freeTrialActivated?: boolean;
  subscriptionEndDate?: Date;
}

// GET /api/community/[slug]/check-trial-status - Check if a community has an active trial or payment
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  // Get the slug from the route parameters
  const resolvedParams = await context.params;
  const slug = resolvedParams.slug;
  try {
    if (!slug) {
      return NextResponse.json(
        { error: "Community slug is required" },
        { status: 400 }
      );
    }

    // Get the userId from the query params
    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    await dbconnect();

    // Find the community by slug
    const community = await Community.findOne({ slug }).lean() as unknown as CommunityDocument;
    if (!community) {
      return NextResponse.json(
        { error: "Community not found", hasActiveTrialOrPayment: false },
        { status: 404 }
      );
    }

    // Check if the user is the admin
    if (community.admin.toString() !== userId) {
      // Not the admin, so no need to check trial status for members
      return NextResponse.json({ hasActiveTrialOrPayment: true });
    }

    // Use the comprehensive status check for admins
    try {
      const comprehensiveStatus = await getCommunityStatus(community._id.toString());

      const hasActiveTrialOrPayment =
        comprehensiveStatus.hasActiveSubscription ||
        comprehensiveStatus.hasActiveTrial;

      return NextResponse.json({
        hasActiveTrialOrPayment,
        debug: {
          hasActiveSubscription: comprehensiveStatus.hasActiveSubscription,
          hasActiveTrial: comprehensiveStatus.hasActiveTrial,
          daysRemaining: comprehensiveStatus.daysRemaining
        }
      });
    } catch (statusError) {
      console.error("Error getting comprehensive status:", statusError);

      // Fallback to basic check if comprehensive status fails
      const hasActiveTrialOrPayment =
        (community.adminTrialInfo?.activated === true &&
         community.adminTrialInfo?.endDate &&
         new Date(community.adminTrialInfo.endDate) > new Date()) ||
        community.paymentStatus === 'paid' ||
        (community.freeTrialActivated === true &&
         community.subscriptionEndDate &&
         new Date(community.subscriptionEndDate) > new Date());

      return NextResponse.json({ hasActiveTrialOrPayment });
    }
  } catch (error) {
    console.error("Error checking trial status:", error);
    return NextResponse.json(
      { error: "Failed to check trial status", hasActiveTrialOrPayment: true },
      { status: 500 }
    );
  }
}
