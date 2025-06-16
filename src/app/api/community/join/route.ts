import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { Community } from "@/models/Community";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { ensureCommunityHasSubscriptionPlan } from "@/lib/community-subscription-middleware";

import { dbconnect } from "@/lib/db";
import mongoose from "mongoose";

interface JoinRequest {
  userId: string;
  status: string;
  answers: string[];
  createdAt: Date;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { communityId, answers } = await req.json();
    await dbconnect();

    // Resolve community slug to ObjectId if needed
    let resolvedCommunityId: string;

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

    // Ensure community has subscription plan (handles migration)
    const community = await ensureCommunityHasSubscriptionPlan(resolvedCommunityId);
    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Initialize members array if it doesn't exist
    if (!community.members) {
      community.members = [];
    }

    // Check if user is already a member
    if (community.members.includes(session.user.id)) {
      return NextResponse.json({ error: "Already a member" }, { status: 400 });
    }

    // Check if community requires payment to join
    if (community.paymentEnabled && community.subscriptionRequired) {
      return NextResponse.json(
        {
          error: "This community requires payment to join",
          requiresPayment: true,
          communityId: community._id,
        },
        { status: 402 }
      );
    }

    // Initialize joinRequests array if it doesn't exist
    if (!community.joinRequests) {
      community.joinRequests = [];
    }

    // Check if user already has a pending request
    const existingRequest = community.joinRequests.find(
      (request: JoinRequest) =>
        request.userId === session.user.id && request.status === "pending"
    );
    if (existingRequest) {
      return NextResponse.json(
        { error: "Request already pending" },
        { status: 400 }
      );
    }

    // Add join request
    community.joinRequests.push({
      userId: session.user.id,
      status: "pending",
      answers: answers || [],
      createdAt: new Date(),
    });

    await community.save();

    // Get user information for the notification
    const user = await User.findById(session.user.id, "username name email");
    const username = user?.username || user?.name || user?.email || "A user";

    // Create notification for the admin
    await Notification.create({
      userId: community.admin,
      type: "join-request",
      title: "New Join Request",
      content: `${username} has requested to join your community.`,
      sourceId: community._id,
      sourceType: "community",
      communityId: community._id,
      read: false,
      createdBy: new mongoose.Types.ObjectId(session.user.id),
    });

    return NextResponse.json({ message: "Join request sent successfully" });
  } catch (error) {
    console.error("Error in join request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
