import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { CommunityPlan } from "@/models/CommunityPlan";
import { Community } from "@/models/Community";

// GET /api/community/[slug]/plans - Get public plans for a community
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    await dbconnect();

    // Find community by slug
    const community = await Community.findOne({ slug });
    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Get public and active plans for the community
    const plans = await CommunityPlan.find({
      communityId: community._id,
      isActive: true,
      isPublic: true
    }).sort({ 
      isDefault: -1, // Default plans first
      amount: 1 // Then by price ascending
    });

    return NextResponse.json({
      success: true,
      plans,
      community: {
        id: community._id,
        name: community.name,
        description: community.description,
        slug: community.slug
      }
    });

  } catch (error: any) {
    console.error("Get community plans error:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}
