import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import { cleanupCommunitySubscriptionData, getDetailedSubscriptionStatus } from "@/lib/subscription-data-cleanup";

// GET /api/admin/cleanup-subscription-data?slug=community-slug - Get detailed status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json(
        { error: "Community slug is required" },
        { status: 400 }
      );
    }

    // Find community by slug
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
        { error: "Only community admin can access this data" },
        { status: 403 }
      );
    }

    const detailedStatus = await getDetailedSubscriptionStatus(community._id.toString());

    return NextResponse.json(detailedStatus);

  } catch (error: any) {
    console.error("Error getting detailed subscription status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get subscription status" },
      { status: 500 }
    );
  }
}

// POST /api/admin/cleanup-subscription-data - Clean up subscription data
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const { slug } = await request.json();

    if (!slug) {
      return NextResponse.json(
        { error: "Community slug is required" },
        { status: 400 }
      );
    }

    // Find community by slug
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
        { error: "Only community admin can cleanup subscription data" },
        { status: 403 }
      );
    }

    const cleanupResult = await cleanupCommunitySubscriptionData(community._id.toString());

    if (cleanupResult.success) {
      return NextResponse.json({
        success: true,
        message: cleanupResult.updated 
          ? "Subscription data cleaned up successfully" 
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
    console.error("Error cleaning up subscription data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cleanup subscription data" },
      { status: 500 }
    );
  }
}
