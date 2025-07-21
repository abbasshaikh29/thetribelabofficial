import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import mongoose from "mongoose";

// GET /api/community/[slug]/about-media - Get community about media
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const { slug } = resolvedParams;

    await dbconnect();

    // Find the community
    const community = await (Community as any).findOne({ slug });

    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Return the about media
    return NextResponse.json({
      aboutMedia: community.aboutMedia || [],
    });
  } catch (error) {
    console.error("Error fetching community about media:", error);
    return NextResponse.json(
      { error: "Failed to fetch community about media" },
      { status: 500 }
    );
  }
}

// POST /api/community/[slug]/about-media - Add media to community about page
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await context.params;
    const { slug } = resolvedParams;

    const { url, type, title } = await request.json();

    if (!url || !type) {
      return NextResponse.json(
        { error: "URL and type are required" },
        { status: 400 }
      );
    }

    if (type !== "image" && type !== "video") {
      return NextResponse.json(
        { error: "Type must be 'image' or 'video'" },
        { status: 400 }
      );
    }

    await dbconnect();

    // Find the community first to check permissions
    const community = await Community.findOne({ slug });

    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Check if user is admin or sub-admin
    const userId = session.user.id;
    const isAdmin = community.admin === userId;
    const isSubAdmin = community.subAdmins?.includes(userId) || false;

    if (!isAdmin && !isSubAdmin) {
      return NextResponse.json(
        { error: "Only admins and sub-admins can update community settings" },
        { status: 403 }
      );
    }

    // Check if there are already 5 media items
    if (community.aboutMedia && community.aboutMedia.length >= 5) {
      return NextResponse.json(
        { error: "Maximum of 5 media items allowed" },
        { status: 400 }
      );
    }

    // Add the new media item
    const newMediaItem = {
      url,
      type,
      title: title || "",
      createdAt: new Date(),
    };

    // Update the community with the new media item
    const updatedCommunity = await Community.findOneAndUpdate(
      { slug },
      { $push: { aboutMedia: newMediaItem } },
      { new: true }
    );

    if (!updatedCommunity) {
      return NextResponse.json(
        { error: "Failed to update community" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mediaItem: newMediaItem,
      aboutMedia: updatedCommunity.aboutMedia,
    });
  } catch (error) {
    console.error("Error adding community about media:", error);
    return NextResponse.json(
      { error: "Failed to add community about media" },
      { status: 500 }
    );
  }
}

// DELETE /api/community/[slug]/about-media - Remove media from community about page
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await context.params;
    const { slug } = resolvedParams;

    const { mediaUrl } = await request.json();

    if (!mediaUrl) {
      return NextResponse.json(
        { error: "Media URL is required" },
        { status: 400 }
      );
    }

    await dbconnect();

    // Find the community first to check permissions
    const community = await Community.findOne({ slug });

    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Check if user is admin or sub-admin
    const userId = session.user.id;
    const isAdmin = community.admin === userId;
    const isSubAdmin = community.subAdmins?.includes(userId) || false;

    if (!isAdmin && !isSubAdmin) {
      return NextResponse.json(
        { error: "Only admins and sub-admins can update community settings" },
        { status: 403 }
      );
    }

    // Remove the media item
    const updatedCommunity = await Community.findOneAndUpdate(
      { slug },
      { $pull: { aboutMedia: { url: mediaUrl } } },
      { new: true }
    );

    if (!updatedCommunity) {
      return NextResponse.json(
        { error: "Failed to update community" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      aboutMedia: updatedCommunity.aboutMedia || [],
    });
  } catch (error) {
    console.error("Error removing community about media:", error);
    return NextResponse.json(
      { error: "Failed to remove community about media" },
      { status: 500 }
    );
  }
}
