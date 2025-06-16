import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { getLeaderboard } from "@/lib/gamification";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import mongoose from "mongoose";

// GET /api/gamification/leaderboard - Get leaderboard data
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get("communityId");
    const period = searchParams.get("period") as "7day" | "30day" | "alltime" || "30day";
    const limit = parseInt(searchParams.get("limit") || "10");

    if (!communityId) {
      return NextResponse.json(
        { error: "Community ID is required" },
        { status: 400 }
      );
    }

    await dbconnect();

    // Resolve community slug to ObjectId
    let communityObjectId: string;

    if (mongoose.Types.ObjectId.isValid(communityId)) {
      // If it's already a valid ObjectId, use it directly
      communityObjectId = communityId;
    } else {
      // If it's a slug, resolve it to ObjectId
      const community = await Community.findOne({ slug: communityId }).select("_id");
      if (!community) {
        return NextResponse.json(
          { error: "Community not found" },
          { status: 404 }
        );
      }
      communityObjectId = community._id.toString();
    }

    const leaderboard = await getLeaderboard(communityObjectId, period, limit);

    return NextResponse.json({
      leaderboard,
      period,
      communityId: communityObjectId,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
