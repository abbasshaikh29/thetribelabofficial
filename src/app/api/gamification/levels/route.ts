import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { LevelConfig, DEFAULT_LEVELS } from "@/models/LevelConfig";
import { Community } from "@/models/Community";
import mongoose from "mongoose";

// GET /api/gamification/levels - Get level configuration for a community
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get("communityId");

    if (!communityId) {
      return NextResponse.json(
        { error: "Community ID is required" },
        { status: 400 }
      );
    }

    await dbconnect();

    // Resolve community slug to ObjectId
    let communityObjectId: mongoose.Types.ObjectId;

    if (mongoose.Types.ObjectId.isValid(communityId)) {
      // If it's already a valid ObjectId, use it directly
      communityObjectId = new mongoose.Types.ObjectId(communityId);
    } else {
      // If it's a slug, resolve it to ObjectId
      const community = await Community.findOne({ slug: communityId }).select("_id");
      if (!community) {
        return NextResponse.json(
          { error: "Community not found" },
          { status: 404 }
        );
      }
      communityObjectId = community._id;
    }

    const config = await LevelConfig.findOne({
      communityId: communityObjectId,
    });

    return NextResponse.json({
      levels: config ? config.levels : DEFAULT_LEVELS,
      isCustom: !!config,
    });
  } catch (error) {
    console.error("Error fetching level config:", error);
    return NextResponse.json(
      { error: "Failed to fetch level configuration" },
      { status: 500 }
    );
  }
}

// PUT /api/gamification/levels - Update level configuration for a community
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { communityId, levels } = await request.json();

    if (!communityId || !levels || !Array.isArray(levels)) {
      return NextResponse.json(
        { error: "Community ID and levels array are required" },
        { status: 400 }
      );
    }

    await dbconnect();

    // Resolve community slug to ObjectId and get community data
    let community;
    let communityObjectId: mongoose.Types.ObjectId;

    if (mongoose.Types.ObjectId.isValid(communityId)) {
      // If it's already a valid ObjectId, use it directly
      communityObjectId = new mongoose.Types.ObjectId(communityId);
      community = await Community.findById(communityObjectId);
    } else {
      // If it's a slug, resolve it to ObjectId
      community = await Community.findOne({ slug: communityId });
      if (!community) {
        return NextResponse.json(
          { error: "Community not found" },
          { status: 404 }
        );
      }
      communityObjectId = community._id;
    }

    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    const isAdmin = community.admin === session.user.id;
    const isSubAdmin = community.subAdmins?.includes(session.user.id);

    if (!isAdmin && !isSubAdmin) {
      return NextResponse.json(
        { error: "Only community admins can update level configuration" },
        { status: 403 }
      );
    }

    // Validate levels structure
    const validatedLevels = levels.map((level: any, index: number) => ({
      level: index + 1,
      name: level.name || `Level ${index + 1}`,
      pointsRequired: DEFAULT_LEVELS[index]?.pointsRequired || 0,
    }));

    // Update or create level configuration
    await LevelConfig.findOneAndUpdate(
      { communityId: communityObjectId },
      { levels: validatedLevels },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      levels: validatedLevels,
    });
  } catch (error) {
    console.error("Error updating level config:", error);
    return NextResponse.json(
      { error: "Failed to update level configuration" },
      { status: 500 }
    );
  }
}
