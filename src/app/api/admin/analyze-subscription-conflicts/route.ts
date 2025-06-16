import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import { CommunitySubscription } from "@/models/Subscription";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json(
        { error: "Community slug is required" },
        { status: 400 }
      );
    }

    await dbconnect();

    // Find the community
    const community = await Community.findOne({ slug });
    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Check if user is admin of the community
    if (community.admin.toString() !== session.user.id) {
      return NextResponse.json(
        { error: "Only community admin can analyze subscription conflicts" },
        { status: 403 }
      );
    }

    // Find all subscription records for this community and admin
    const allSubscriptions = await CommunitySubscription.find({
      $or: [
        { communityId: community._id },
        { adminId: session.user.id }
      ]
    }).sort({ createdAt: -1 });

    // Find potentially conflicting subscriptions (active, trial, past_due)
    const conflictingSubscriptions = allSubscriptions.filter(sub => 
      ['active', 'trial', 'past_due', 'authenticated', 'created'].includes(sub.status)
    );

    // Analyze the conflicts
    const now = new Date();
    const recommendations: string[] = [];
    
    if (conflictingSubscriptions.length > 1) {
      recommendations.push("Multiple active subscriptions detected - this can prevent new subscription creation");
    }

    // Check for expired subscriptions still marked as active
    const expiredActiveSubscriptions = conflictingSubscriptions.filter(sub => 
      ['active', 'authenticated'].includes(sub.status) && 
      sub.currentEnd && 
      new Date(sub.currentEnd) < now
    );

    if (expiredActiveSubscriptions.length > 0) {
      recommendations.push(`${expiredActiveSubscriptions.length} subscription(s) are marked as active but have expired`);
    }

    // Check for subscriptions without valid end dates
    const invalidDateSubscriptions = conflictingSubscriptions.filter(sub => 
      !sub.currentEnd || isNaN(new Date(sub.currentEnd).getTime())
    );

    if (invalidDateSubscriptions.length > 0) {
      recommendations.push(`${invalidDateSubscriptions.length} subscription(s) have invalid end dates`);
    }

    // Check for orphaned subscriptions (community subscription ID doesn't match any record)
    if (community.subscriptionId) {
      const linkedSubscription = allSubscriptions.find(sub => 
        sub.razorpaySubscriptionId === community.subscriptionId
      );
      
      if (!linkedSubscription) {
        recommendations.push("Community has a subscription ID that doesn't match any subscription record");
      } else if (!['active', 'authenticated'].includes(linkedSubscription.status)) {
        recommendations.push("Community is linked to a non-active subscription");
      }
    }

    // Check for status mismatches
    if (community.paymentStatus === 'paid' && conflictingSubscriptions.length === 0) {
      recommendations.push("Community payment status is 'paid' but no active subscriptions found");
    }

    const hasConflicts = conflictingSubscriptions.length > 0 || recommendations.length > 0;

    if (!hasConflicts) {
      recommendations.push("No conflicts detected - subscription system appears clean");
    } else {
      recommendations.push("Run 'Smart Cleanup' to automatically resolve detected issues");
      recommendations.push("Use 'Force Reset' only if Smart Cleanup doesn't resolve the issue");
    }

    return NextResponse.json({
      hasConflicts,
      conflictingSubscriptions: conflictingSubscriptions.map(sub => ({
        _id: sub._id?.toString(),
        razorpaySubscriptionId: sub.razorpaySubscriptionId,
        status: sub.status,
        currentStart: sub.currentStart,
        currentEnd: sub.currentEnd,
        adminId: sub.adminId,
        communityId: sub.communityId.toString(),
        createdAt: sub.createdAt || sub.updatedAt
      })),
      communityData: {
        paymentStatus: community.paymentStatus,
        subscriptionId: community.subscriptionId,
        subscriptionEndDate: community.subscriptionEndDate,
        adminTrialInfo: community.adminTrialInfo
      },
      recommendations,
      totalSubscriptions: allSubscriptions.length,
      analysis: {
        expiredActiveCount: expiredActiveSubscriptions.length,
        invalidDateCount: invalidDateSubscriptions.length,
        hasOrphanedSubscriptionId: community.subscriptionId && !allSubscriptions.find(sub => 
          sub.razorpaySubscriptionId === community.subscriptionId
        )
      }
    });

  } catch (error: any) {
    console.error("Error analyzing subscription conflicts:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze subscription conflicts" },
      { status: 500 }
    );
  }
}
