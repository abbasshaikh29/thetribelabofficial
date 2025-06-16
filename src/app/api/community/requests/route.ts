import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { Community } from "@/models/Community";

import { dbconnect } from "@/lib/db";
import mongoose from "mongoose";

// GET all pending requests for a community
export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const communityId = searchParams.get("communityId");

    if (!communityId) {
      return NextResponse.json(
        { error: "Community ID is required" },
        { status: 400 }
      );
    }
    await dbconnect();

    // Resolve community slug to ObjectId if needed
    let community;

    if (mongoose.Types.ObjectId.isValid(communityId)) {
      // If it's already a valid ObjectId, use it directly
      community = await Community.findById(communityId);
    } else {
      // If it's a slug, resolve it to community
      community = await Community.findOne({ slug: communityId });
    }

    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Check if user is admin
    if (community.admin !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const pendingRequests = community.joinRequests.filter(
      (request: { userId: string; status: string }) =>
        request.status === "pending"
    );

    return NextResponse.json({ requests: pendingRequests });
  } catch (error) {
    console.error("Error fetching requests:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST to approve/reject a request
export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { communityId, userId, action } = await req.json();

    if (!communityId || !userId || !action) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await dbconnect();

    // Resolve community slug to ObjectId if needed
    let community;

    if (mongoose.Types.ObjectId.isValid(communityId)) {
      // If it's already a valid ObjectId, use it directly
      community = await Community.findById(communityId);
    } else {
      // If it's a slug, resolve it to community
      community = await Community.findOne({ slug: communityId });
    }

    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Check if user is admin
    if (community.admin !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const requestIndex = community.joinRequests.findIndex(
      (request: { userId: string; status: string }) =>
        request.userId === userId && request.status === "pending"
    );

    if (requestIndex === -1) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (action === "approve") {
      // Update request status
      community.joinRequests[requestIndex].status = "approved";
      // Add user to members
      if (!community.members.includes(userId)) {
        community.members.push(userId);
      }
    } else if (action === "reject") {
      community.joinRequests[requestIndex].status = "rejected";
    }

    await community.save();

    return NextResponse.json({
      message: `Request ${action}d successfully`,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
