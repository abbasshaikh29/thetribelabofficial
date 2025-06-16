import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import { CommunitySubscription } from "@/models/Subscription";
import { cleanupCommunitySubscriptionData } from "@/lib/subscription-data-cleanup";

// POST /api/admin/fix-subscription-dates - Fix incorrect subscription end dates
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const { communityId, slug } = await request.json();

    let community;
    if (communityId) {
      community = await Community.findById(communityId);
    } else if (slug) {
      community = await Community.findOne({ slug });
    } else {
      return NextResponse.json(
        { error: "Either communityId or slug is required" },
        { status: 400 }
      );
    }

    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Check if user is the admin of this community
    if (community.admin.toString() !== session.user.id) {
      return NextResponse.json(
        { error: "Only community admin can fix subscription dates" },
        { status: 403 }
      );
    }

    // Use the new cleanup utility instead of the old logic
    const cleanupResult = await cleanupCommunitySubscriptionData(community._id.toString());

    if (cleanupResult.success) {
      return NextResponse.json({
        success: true,
        message: cleanupResult.updated
          ? "Subscription data fixed successfully"
          : "No issues found, data is consistent",
        issues: cleanupResult.issues,
        fixes: cleanupResult.fixes,
        updated: cleanupResult.updated,
        community: cleanupResult.community
      });
    } else {
      return NextResponse.json(
        { error: cleanupResult.error },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error("Error fixing subscription dates:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fix subscription dates" },
      { status: 500 }
    );
  }
}

// GET /api/admin/fix-subscription-dates - Check subscription status for a community
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const communityId = searchParams.get("communityId");

    let community;
    if (communityId) {
      community = await Community.findById(communityId);
    } else if (slug) {
      community = await Community.findOne({ slug });
    } else {
      return NextResponse.json(
        { error: "Either communityId or slug is required" },
        { status: 400 }
      );
    }

    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Get subscription information
    const activeSubscription = await CommunitySubscription.findOne({
      communityId: community._id,
      adminId: session.user.id,
      status: { $in: ['active', 'authenticated'] }
    }).sort({ createdAt: -1 });

    const now = new Date();
    const subscriptionEndDate = community.subscriptionEndDate ? new Date(community.subscriptionEndDate) : null;
    const isSubscriptionExpired = subscriptionEndDate ? subscriptionEndDate < now : false;

    return NextResponse.json({
      community: {
        _id: community._id.toString(),
        slug: community.slug,
        name: community.name,
        paymentStatus: community.paymentStatus,
        subscriptionStatus: community.subscriptionStatus,
        subscriptionStartDate: community.subscriptionStartDate,
        subscriptionEndDate: community.subscriptionEndDate,
        adminTrialInfo: community.adminTrialInfo,
        freeTrialActivated: community.freeTrialActivated
      },
      activeSubscription: activeSubscription ? {
        id: activeSubscription.razorpaySubscriptionId,
        status: activeSubscription.status,
        currentStart: activeSubscription.currentStart,
        currentEnd: activeSubscription.currentEnd
      } : null,
      analysis: {
        hasActiveSubscription: !!activeSubscription,
        hasActiveTrial: community.adminTrialInfo?.activated || false,
        isSubscriptionExpired,
        needsDateFix: isSubscriptionExpired && !!activeSubscription,
        currentTime: now.toISOString()
      }
    });

  } catch (error: any) {
    console.error("Error checking subscription status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check subscription status" },
      { status: 500 }
    );
  }
}
