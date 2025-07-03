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
    console.log("Community status endpoint called");
    const session = await getServerSession();
    const resolvedParams = await context.params;
    const { slug } = resolvedParams;

    if (!slug) {
      console.log("No slug provided");
      return NextResponse.json(
        { error: "Slug is required", found: false },
        { status: 400 }
      );
    }

    console.log("Connecting to database for slug:", slug);
    await dbconnect();

    // Find the community by slug
    console.log("Finding community by slug:", slug);
    const community = (await Community.findOne({
      slug,
    }).lean()) as unknown as CommunityDocument;

    if (!community) {
      console.log("Community not found for slug:", slug);
      return NextResponse.json(
        { error: "Community not found", found: false },
        { status: 404 }
      );
    }

    console.log("Community found:", community._id.toString());

    // If user is authenticated and is the admin, use comprehensive status
    if (session?.user?.id && community.admin.toString() === session.user.id) {
      console.log("User is admin, getting comprehensive status");
      const comprehensiveStatus = await getCommunityStatus(
        community._id.toString()
      );

      if (comprehensiveStatus.found && comprehensiveStatus.community) {
        console.log("Comprehensive status found:", {
          hasActiveSubscription: comprehensiveStatus.hasActiveSubscription,
          hasActiveTrial: comprehensiveStatus.hasActiveTrial,
          paymentStatus: comprehensiveStatus.community.paymentStatus,
          subscriptionId: comprehensiveStatus.community.subscriptionId,
          subscriptionStatus: comprehensiveStatus.community.subscriptionStatus,
          subscriptionEndDate:
            comprehensiveStatus.community.subscriptionEndDate,
          daysRemaining: comprehensiveStatus.daysRemaining,
        });

        return NextResponse.json({
          found: true,
          community: {
            _id: community._id.toString(),
            name: community.name,
            slug: community.slug,
            admin: community.admin.toString(),
            // Legacy trial system only - no adminTrialInfo needed
            paymentStatus: comprehensiveStatus.community.paymentStatus,
            subscriptionEndDate:
              comprehensiveStatus.community.subscriptionEndDate,
            subscriptionId: comprehensiveStatus.community.subscriptionId,
            subscriptionStatus:
              comprehensiveStatus.community.subscriptionStatus,
            suspended: comprehensiveStatus.community.suspended,
            freeTrialActivated:
              comprehensiveStatus.community.freeTrialActivated,
          },
          hasActiveSubscription: comprehensiveStatus.hasActiveSubscription,
          hasActiveTrial: comprehensiveStatus.hasActiveTrial,
          daysRemaining: comprehensiveStatus.daysRemaining,
          isEligibleForTrial: comprehensiveStatus.isEligibleForTrial,
          hasActiveTrialOrPayment:
            comprehensiveStatus.hasActiveSubscription ||
            comprehensiveStatus.hasActiveTrial,
          // Add debug information
          debug: {
            status: comprehensiveStatus.status,
            endDate: comprehensiveStatus.endDate,
            comprehensive: true,
          },
        });
      }
    }

    console.log("Using basic status check for non-admin or fallback");
    // Fallback to basic status check for non-admin users or if comprehensive status fails
    const suspended = community.suspended || false;
    const suspensionReason = community.suspensionReason || null;
    const suspendedAt = community.suspendedAt || null;

    // Enhanced basic status check
    const now = new Date();

    // Check if community has active payment - enhanced logic
    const hasActivePaidStatus =
      community.paymentStatus === "paid" &&
      community.subscriptionEndDate &&
      new Date(community.subscriptionEndDate) > now;

    // Check if community has active trial (legacy system only)
    const freeTrialActivated = community.freeTrialActivated === true;
    const hasEndDate = !!community.subscriptionEndDate;
    const endDate = community.subscriptionEndDate
      ? new Date(community.subscriptionEndDate)
      : null;
    const endDateInFuture = endDate ? endDate > now : false;

    // Be more flexible with payment status - if freeTrialActivated=true and we have a future end date,
    // consider it active regardless of paymentStatus (could be "trial", "unpaid", or undefined)
    const paymentStatusCompatible =
      !community.paymentStatus ||
      community.paymentStatus === "trial" ||
      community.paymentStatus === "unpaid";

    const hasActiveTrial =
      freeTrialActivated &&
      hasEndDate &&
      endDateInFuture &&
      paymentStatusCompatible;

    const hasActiveTrialOrPayment = hasActivePaidStatus || hasActiveTrial;

    // Calculate days remaining more accurately
    let daysRemaining = null;
    if (hasActiveTrialOrPayment && !hasActivePaidStatus) {
      // For legacy trials, always use subscriptionEndDate
      if (community.subscriptionEndDate) {
        const endDate = new Date(community.subscriptionEndDate);
        const today = new Date();
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        daysRemaining = diffDays > 0 ? diffDays : 0;
      }
    }

    console.log("🔍 Basic status check results:", {
      now: now.toISOString(),
      endDate: endDate?.toISOString(),
      freeTrialActivated,
      hasEndDate,
      endDateInFuture,
      paymentStatusCompatible,
      hasActivePaidStatus,
      hasActiveTrial,
      hasActiveTrialOrPayment,
      daysRemaining,
      paymentStatus: community.paymentStatus,
      subscriptionEndDate: community.subscriptionEndDate,
      // Additional debug
      rawEndDate: community.subscriptionEndDate,
      timeDifference: endDate ? endDate.getTime() - now.getTime() : null,
    });

    return NextResponse.json({
      found: true,
      community: {
        _id: community._id.toString(),
        name: community.name,
        slug: community.slug,
        admin: community.admin.toString(),
        paymentStatus: community.paymentStatus,
        subscriptionEndDate: community.subscriptionEndDate,
        subscriptionId: community.subscriptionId,
        subscriptionStatus: community.subscriptionStatus,
        freeTrialActivated: community.freeTrialActivated,
      },
      suspended,
      suspensionReason,
      suspendedAt,
      hasActiveTrialOrPayment,
      hasActiveSubscription: hasActivePaidStatus,
      hasActiveTrial: hasActiveTrial,
      paymentStatus: community.paymentStatus,
      daysRemaining,
      isEligibleForTrial:
        !hasActiveTrialOrPayment && !community.freeTrialActivated,
      // Add debug information
      debug: {
        hasActivePaidStatus,
        hasActiveTrial,
        comprehensive: false,
        now: now.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error checking community status:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to check community status",
        found: false,
        // Return safe defaults in case of error
        suspended: false,
        hasActiveTrialOrPayment: true,
      },
      { status: 500 }
    );
  }
}
