import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { getUserGamificationData } from "@/lib/gamification";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import mongoose from "mongoose";

// GET /api/gamification/user/[userId] - Get user's gamification data
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get("communityId");

    let resolvedCommunityId: string | undefined = undefined;

    if (communityId) {
      await dbconnect();

      if (mongoose.Types.ObjectId.isValid(communityId)) {
        // If it's already a valid ObjectId, use it directly
        resolvedCommunityId = communityId;
      } else {
        // If it's a slug, resolve it to ObjectId
        const community = await Community.findOne({ slug: communityId }).select("_id");
        if (!community) {
          return NextResponse.json(
            { error: "Community not found" },
            { status: 404 }
          );
        }
        resolvedCommunityId = community._id.toString();
      }
    }

    const gamificationData = await getUserGamificationData(
      params.userId,
      resolvedCommunityId
    );

    return NextResponse.json(gamificationData);
  } catch (error) {
    console.error("Error fetching gamification data:", error);
    return NextResponse.json(
      { error: "Failed to fetch gamification data" },
      { status: 500 }
    );
  }
}
