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
    console.log('Community status endpoint called');
    const session = await getServerSession();
    const resolvedParams = await context.params;
    const { slug } = resolvedParams;

    if (!slug) {
      console.log('No slug provided');
      return NextResponse.json(
        { error: "Slug is required", found: false },
        { status: 400 }
      );
    }

    console.log('Connecting to database for slug:', slug);
    await dbconnect();

    // Find the community by slug
    console.log('Finding community by slug:', slug);
    const community = await Community.findOne({ slug }).lean() as unknown as CommunityDocument;

    if (!community) {
      console.log('Community not found for slug:', slug);
      return NextResponse.json(
        { error: "Community not found", found: false },
        { status: 404 }
      );
    }

    console.log('Community found:', community._id.toString());

    // If user is authenticated and is the admin, use comprehensive status
    if (session?.user?.id && community.admin.toString() === session.user.id) {
      console.log('User is admin, getting comprehensive status');
      const comprehensiveStatus = await getCommunityStatus(community._id.toString());

      if (comprehensiveStatus.found && comprehensiveStatus.community) {
        console.log('Comprehensive status found');
        return NextResponse.json({
          found: true,
          community: {
            _id: community._id.toString(),
            name: community.name,
          slug: community.slug,
            admin: community.admin.toString(),
            adminTrialInfo: comprehensiveStatus.community.adminTrialInfo,
            paymentStatus: comprehensiveStatus.community.paymentStatus,
            subscriptionEndDate: comprehensiveStatus.community.subscriptionEndDate,
            subscriptionId: comprehensiveStatus.community.subscriptionId,
            subscriptionStatus: comprehensiveStatus.community.subscriptionStatus,
            suspended: comprehensiveStatus.community.suspended,
            freeTrialActivated: comprehensiveStatus.community.freeTrialActivated
          },
          hasActiveSubscription: comprehensiveStatus.hasActiveSubscription,
          hasActiveTrial: comprehensiveStatus.hasActiveTrial,
          daysRemaining: comprehensiveStatus.daysRemaining,
          isEligibleForTrial: comprehensiveStatus.isEligibleForTrial,
          hasActiveTrialOrPayment: comprehensiveStatus.hasActiveSubscription || comprehensiveStatus.hasActiveTrial
        });
      }
    }

    console.log('Using basic status check for non-admin or fallback');
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

    console.log('Returning basic status');
    return NextResponse.json({
      found: true,
      community: {
        _id: community._id.toString(),
        name: community.name,
      slug: community.slug,
        admin: community.admin.toString(),
        adminTrialInfo: community.adminTrialInfo,
        paymentStatus: community.paymentStatus,
        subscriptionEndDate: community.subscriptionEndDate,
        subscriptionId: community.subscriptionId,
        freeTrialActivated: community.freeTrialActivated
      },
      suspended,
      suspensionReason,
      suspendedAt,
      hasActiveTrialOrPayment,
      hasActiveSubscription: community.paymentStatus === 'paid',
      hasActiveTrial: hasActiveTrialOrPayment && community.paymentStatus !== 'paid',
      paymentStatus: community.paymentStatus,
      daysRemaining,
      isEligibleForTrial: !hasActiveTrialOrPayment && !community.adminTrialInfo?.hasUsedTrial
    });
  } catch (error) {
    console.error("Error checking community status:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to check community status",
        found: false,
        // Return safe defaults in case of error
        suspended: false,
        hasActiveTrialOrPayment: true
      },
      { status: 500 }
    );
  }
}
