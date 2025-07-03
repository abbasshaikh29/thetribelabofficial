import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import { CommunitySubscription } from "@/models/Subscription";
import { cleanupCommunitySubscriptionData } from "@/lib/subscription-data-cleanup";

// POST /api/admin/fix-subscription-dates - Fix subscription dates for a specific community
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { communityId, action = "fix" } = await request.json();

    if (!communityId) {
      return NextResponse.json(
        { error: "Community ID is required" },
        { status: 400 }
      );
    }

    await dbconnect();

    const community = await Community.findById(communityId);
    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Find the most recent active subscription
    const activeSubscription = await CommunitySubscription.findOne({
      communityId: community._id,
      status: { $in: ["active", "authenticated", "created"] }, // Include 'created' status
    }).sort({ createdAt: -1 });

    const now = new Date();
    let updateFields: any = {};
    let subscriptionUpdated = false;

    if (activeSubscription) {
      // If subscription exists, update community fields to match subscription
      if (activeSubscription.status === "created") {
        // For created subscriptions, set as trial with proper end date
        updateFields.paymentStatus = "trial";
        updateFields.subscriptionStatus = "trial";

        if (activeSubscription.currentEnd) {
          updateFields.subscriptionEndDate = activeSubscription.currentEnd;
        }

        if (activeSubscription.currentStart) {
          updateFields.subscriptionStartDate = activeSubscription.currentStart;
        }
      } else if (
        ["active", "authenticated"].includes(activeSubscription.status)
      ) {
        // For active/authenticated subscriptions, set as paid
        updateFields.paymentStatus = "paid";
        updateFields.subscriptionStatus = "active";

        if (activeSubscription.currentEnd) {
          updateFields.subscriptionEndDate = activeSubscription.currentEnd;
        }

        if (activeSubscription.currentStart) {
          updateFields.subscriptionStartDate = activeSubscription.currentStart;
        }
      }

      updateFields.subscriptionId = activeSubscription.razorpaySubscriptionId;
    } else {
      // No subscription found, check if community needs reset
      if (community.subscriptionId && !activeSubscription) {
        // Orphaned subscription ID, clean it up
        updateFields.subscriptionId = null;
        updateFields.paymentStatus = "unpaid";
        updateFields.subscriptionStatus = null;
        updateFields.subscriptionEndDate = null;
        updateFields.subscriptionStartDate = null;
      }
    }

    // Apply updates if needed
    if (Object.keys(updateFields).length > 0) {
      await Community.findByIdAndUpdate(communityId, updateFields);
      subscriptionUpdated = true;
    }

    // Re-fetch updated community
    const updatedCommunity = await Community.findById(communityId);

    return NextResponse.json({
      success: true,
      action: action,
      subscriptionUpdated,
      updateFields,
      community: {
        _id: updatedCommunity._id.toString(),
        slug: updatedCommunity.slug,
        name: updatedCommunity.name,
        paymentStatus: updatedCommunity.paymentStatus,
        subscriptionStatus: updatedCommunity.subscriptionStatus,
        subscriptionStartDate: updatedCommunity.subscriptionStartDate,
        subscriptionEndDate: updatedCommunity.subscriptionEndDate,
        subscriptionId: updatedCommunity.subscriptionId,
        adminTrialInfo: updatedCommunity.adminTrialInfo,
        freeTrialActivated: updatedCommunity.freeTrialActivated,
      },
      activeSubscription: activeSubscription
        ? {
            id: activeSubscription.razorpaySubscriptionId,
            status: activeSubscription.status,
            currentStart: activeSubscription.currentStart,
            currentEnd: activeSubscription.currentEnd,
          }
        : null,
      analysis: {
        hadSubscription: !!activeSubscription,
        subscriptionStatus: activeSubscription?.status,
        fieldsUpdated: Object.keys(updateFields),
        currentTime: now.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error fixing subscription:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fix subscription" },
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
      status: { $in: ["active", "authenticated"] },
    }).sort({ createdAt: -1 });

    const now = new Date();
    const subscriptionEndDate = community.subscriptionEndDate
      ? new Date(community.subscriptionEndDate)
      : null;
    const isSubscriptionExpired = subscriptionEndDate
      ? subscriptionEndDate < now
      : false;

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
        freeTrialActivated: community.freeTrialActivated,
      },
      activeSubscription: activeSubscription
        ? {
            id: activeSubscription.razorpaySubscriptionId,
            status: activeSubscription.status,
            currentStart: activeSubscription.currentStart,
            currentEnd: activeSubscription.currentEnd,
          }
        : null,
      analysis: {
        hasActiveSubscription: !!activeSubscription,
        hasActiveTrial: community.adminTrialInfo?.activated || false,
        isSubscriptionExpired,
        needsDateFix: isSubscriptionExpired && !!activeSubscription,
        currentTime: now.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error checking subscription status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check subscription status" },
      { status: 500 }
    );
  }
}
