import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { CommunityPlan } from "@/models/CommunityPlan";
import { Community } from "@/models/Community";

// GET /api/community/[slug]/plans/[planId] - Get specific plan details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; planId: string }> }
) {
  const { slug, planId } = await params;
  try {
    await dbconnect();

    // Find community by slug
    const community = await (Community as any).findOne({ slug });
    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Get the specific plan
    const plan = await CommunityPlan.findOne({
      _id: planId,
      communityId: community._id,
      isActive: true,
      isPublic: true
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      plan,
      community: {
        id: community._id,
        name: community.name,
        description: community.description,
        slug: community.slug
      }
    });

  } catch (error: any) {
    console.error("Get community plan error:", error);
    return NextResponse.json(
      { error: "Failed to fetch plan" },
      { status: 500 }
    );
  }
}
