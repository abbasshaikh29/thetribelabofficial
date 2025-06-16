import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Community, ICommunity } from "@/models/Community";
import { getCommunityStatus } from "@/lib/trial-service";

// Define a type for the community document
interface CommunityDocument extends ICommunity {
  _id: any;
  admin: any;
  slug: string;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession();
    const resolvedParams = await context.params;
    const { slug } = resolvedParams;

    if (!slug) {
      return NextResponse.json(
        { error: "Slug is required" },
        { status: 400 }
      );
    }

    await dbconnect();

    // Find the community by slug
    const community = await Community.findOne({ slug }).lean() as unknown as CommunityDocument;

    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // If user is authenticated and is the admin, use comprehensive status
    if (session?.user?.id && community.admin.toString() === session.user.id) {
      const comprehensiveStatus = await getCommunityStatus(community._id.toString());

      if (comprehensiveStatus.found && comprehensiveStatus.community) {
        return NextResponse.json({
          ...comprehensiveStatus,
          // Add legacy fields for backward compatibility
          communityId: community._id.toString(),
          slug: community.slug,
          name: community.name,
          suspended: comprehensiveStatus.community.suspended || false,
          hasActiveTrialOrPayment: comprehensiveStatus.hasActiveSubscription || comprehensiveStatus.hasActiveTrial,
          paymentStatus: comprehensiveStatus.community.paymentStatus || 'unpaid',
          daysRemaining: comprehensiveStatus.daysRemaining,
          trialInfo: {
            activated: comprehensiveStatus.community.adminTrialInfo?.activated || false,
            hasUsedTrial: comprehensiveStatus.community.adminTrialInfo?.hasUsedTrial || false,
            startDate: comprehensiveStatus.community.adminTrialInfo?.startDate,
            endDate: comprehensiveStatus.community.adminTrialInfo?.endDate,
          }
        });
      }
    }

    // Fallback to basic status check for non-admin users or if comprehensive status fails
    const suspended = community.suspended || false;
    const suspensionReason = community.suspensionReason || null;
    const suspendedAt = community.suspendedAt || null;

    // Check if community has active trial or payment
    const hasActiveTrialOrPayment =
      // Has active payment
      community.paymentStatus === 'paid' ||
      // Has active trial (admin trial)
      (community.adminTrialInfo?.activated === true &&
       community.adminTrialInfo?.endDate &&
       new Date(community.adminTrialInfo.endDate) > new Date()) ||
      // Has active trial (legacy free trial)
      (community.freeTrialActivated === true &&
       community.subscriptionEndDate &&
       new Date(community.subscriptionEndDate) > new Date());

    // Calculate days remaining if there's an active trial
    let daysRemaining = null;
    if (hasActiveTrialOrPayment && community.paymentStatus !== 'paid') {
      const endDate = community.adminTrialInfo?.endDate
        ? new Date(community.adminTrialInfo.endDate)
        : community.subscriptionEndDate
          ? new Date(community.subscriptionEndDate)
          : null;

      if (endDate) {
        const today = new Date();
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        daysRemaining = diffDays > 0 ? diffDays : 0;
      }
    }

    return NextResponse.json({
      found: true,
      communityId: community._id.toString(),
      slug: community.slug,
      name: community.name,
      suspended,
      suspensionReason,
      suspendedAt,
      hasActiveTrialOrPayment,
      hasActiveSubscription: community.paymentStatus === 'paid',
      hasActiveTrial: hasActiveTrialOrPayment && community.paymentStatus !== 'paid',
      paymentStatus: community.paymentStatus,
      daysRemaining,
      isEligibleForTrial: !hasActiveTrialOrPayment && !community.adminTrialInfo?.hasUsedTrial,
      trialInfo: {
        activated: community.adminTrialInfo?.activated || false,
        hasUsedTrial: community.adminTrialInfo?.hasUsedTrial || false,
        startDate: community.adminTrialInfo?.startDate,
        endDate: community.adminTrialInfo?.endDate,
      }
    });
  } catch (error) {
    console.error("Error checking community status:", error);
    return NextResponse.json(
      {
        error: "Failed to check community status",
        found: false,
        // Return safe defaults in case of error
        suspended: false,
        hasActiveTrialOrPayment: true
      },
      { status: 500 }
    );
  }
}
