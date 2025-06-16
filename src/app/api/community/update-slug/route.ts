import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { Community, generateSlug } from "@/models/Community";
import { getServerSession } from "@/lib/auth-helpers";
import mongoose from "mongoose";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { communityId, newName } = await request.json();

    if (!communityId || !newName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await dbconnect();

    // Resolve community slug to ObjectId if needed
    let community;
    let resolvedCommunityId: string;

    if (mongoose.Types.ObjectId.isValid(communityId)) {
      // If it's already a valid ObjectId, use it directly
      community = await Community.findById(communityId);
      resolvedCommunityId = communityId;
    } else {
      // If it's a slug, resolve it to community
      community = await Community.findOne({ slug: communityId });
      if (!community) {
        return NextResponse.json(
          { error: "Community not found" },
          { status: 404 }
        );
      }
      resolvedCommunityId = community._id.toString();
    }

    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Check if the user is an admin or sub-admin
    const userId = session.user.id;
    const isAdmin = community.admin === userId;
    const isSubAdmin = community.subAdmins?.includes(userId) || false;

    if (!isAdmin && !isSubAdmin) {
      return NextResponse.json(
        { error: "Only admins and sub-admins can update community settings" },
        { status: 403 }
      );
    }

    // Generate new slug
    const oldSlug = community.slug;
    const newSlug = generateSlug(newName);

    console.log("Old slug:", oldSlug);
    console.log("New slug:", newSlug);

    // Update the community with the new name and slug
    let result;

    // Check if mongoose connection is available
    if (mongoose.connection && mongoose.connection.db) {
      // Use updateOne with raw MongoDB driver for more direct control
      result = await mongoose.connection.db
        .collection("communities")
        .updateOne(
          { _id: new mongoose.Types.ObjectId(resolvedCommunityId) },
          { $set: { name: newName, slug: newSlug } }
        );
    } else {
      // Fallback to using Mongoose model
      result = await Community.updateOne(
        { _id: resolvedCommunityId },
        { $set: { name: newName, slug: newSlug } }
      );
    }

    console.log("Update result:", result);

    // Verify the update
    const updatedCommunity = await Community.findById(resolvedCommunityId);
    console.log("Updated community:", updatedCommunity);

    if (!updatedCommunity || updatedCommunity.slug !== newSlug) {
      return NextResponse.json(
        { error: "Failed to update slug" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      oldSlug,
      newSlug,
      community: updatedCommunity,
    });
  } catch (error) {
    console.error("Error updating slug:", error);
    return NextResponse.json(
      { error: "Failed to update slug" },
      { status: 500 }
    );
  }
}
