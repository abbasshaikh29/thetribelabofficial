import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { Community, ICommunity } from "@/models/Community";
import mongoose from "mongoose";

// POST /api/notifications/create - Create notifications for community members
export async function POST(request: NextRequest) {
  try {
    console.log("Notification create API called");

    const session = await getServerSession();
    if (!session?.user?.id) {
      console.log("Unauthorized - no session user ID");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();
    const {
      type,
      title,
      content,
      sourceId,
      sourceType,
      communityId,
      targetUserId,
    } = await request.json();

    console.log("Notification request data:", {
      type,
      title,
      sourceId,
      sourceType,
      communityId,
      targetUserId,
      currentUser: session.user.id,
    });

    // Special check for join-request type notifications
    if (type === "join-request") {
      console.log("WARNING: join-request notification being created via bulk API - this should not happen!");
      console.log("Join request notifications should be created directly in the join API");

      // Prevent join-request notifications from being sent to all members
      if (!targetUserId) {
        console.log("BLOCKING: join-request notification without targetUserId - would spam all members");
        return NextResponse.json(
          { error: "join-request notifications must specify a targetUserId" },
          { status: 400 }
        );
      }
    }

    // Validate required fields
    if (
      !type ||
      !title ||
      !content ||
      !sourceId ||
      !sourceType ||
      !communityId
    ) {
      console.log("Missing required fields:", {
        hasType: !!type,
        hasTitle: !!title,
        hasContent: !!content,
        hasSourceId: !!sourceId,
        hasSourceType: !!sourceType,
        hasCommunityId: !!communityId,
      });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Find the community to get members
    const community = (await Community.findById(
      communityId
    ).lean()) as unknown as ICommunity;
    if (!community) {
      console.log("Community not found with ID:", communityId);
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }
    console.log("Found community:", {
      name: community.name,
      slug: community.slug,
      memberCount: community.members?.length || 0,
    });

    // Check if user is admin or sub-admin
    const isAdmin = community.admin === session.user.id;
    const isSubAdmin = community.subAdmins?.includes(session.user.id);

    // For admin-post type, only allow admins and sub-admins
    if (type === "admin-post" && !isAdmin && !isSubAdmin) {
      return NextResponse.json(
        { error: "Only admins can create admin post notifications" },
        { status: 403 }
      );
    }

    // For regular post type, check if user is a member of the community
    // For comment and like notifications, we don't need to check if the user is a member
    if (type === "post" && !community.members?.includes(session.user.id)) {
      console.log("User is not a member of the community:", {
        type,
        userId: session.user.id,
        communityMembers: community.members,
      });
      return NextResponse.json(
        { error: "Only community members can create post notifications" },
        { status: 403 }
      );
    }

    // Skip membership check for comment and like notifications
    console.log(
      `Creating ${type} notification, targetUserId: ${
        targetUserId || "all members"
      }`
    );
    console.log("Session user ID:", session.user.id);

    // Create notifications array
    const notifications = [];

    // If targetUserId is provided, create notification only for that user
    if (targetUserId) {
      console.log(
        "Creating notification for specific target user:",
        targetUserId
      );

      // For comment and like notifications, we don't need to check if the user is a member
      // For other notification types, verify the target user is a member of the community
      if (
        type !== "comment" &&
        type !== "like" &&
        !community.members?.includes(targetUserId)
      ) {
        console.log("Target user is not a member of this community:", {
          targetUserId,
          type,
          isMember: community.members?.includes(targetUserId),
        });
        return NextResponse.json(
          { error: "Target user is not a member of this community" },
          { status: 400 }
        );
      }

      // Skip if the target user is the same as the creator
      if (targetUserId !== session.user.id) {
        console.log("Adding notification for target user:", targetUserId);
        notifications.push({
          userId: new mongoose.Types.ObjectId(targetUserId),
          type,
          title,
          content,
          sourceId: new mongoose.Types.ObjectId(sourceId),
          sourceType,
          communityId: new mongoose.Types.ObjectId(communityId),
          createdBy: new mongoose.Types.ObjectId(session.user.id),
          read: false,
        });
      } else {
        console.log("Skipping notification because target user is the creator");
      }
    } else {
      // If no targetUserId, create notifications for all members except the creator
      const members = community.members || [];

      for (const memberId of members) {
        // Skip creating notification for the user who created it
        if (memberId === session.user.id) continue;

        notifications.push({
          userId: new mongoose.Types.ObjectId(memberId),
          type,
          title,
          content,
          sourceId: new mongoose.Types.ObjectId(sourceId),
          sourceType,
          communityId: new mongoose.Types.ObjectId(communityId),
          createdBy: new mongoose.Types.ObjectId(session.user.id),
          read: false,
        });
      }
    }

    // Insert all notifications at once
    let result;
    if (notifications.length > 0) {
      console.log(`Inserting ${notifications.length} notifications`);
      try {
        result = await Notification.insertMany(notifications);
        console.log("Successfully inserted notifications:", result.length);
      } catch (insertError: any) {
        console.error("Error inserting notifications:", insertError);
        return NextResponse.json(
          {
            error: "Failed to insert notifications",
            details: insertError.message,
          },
          { status: 500 }
        );
      }
    } else {
      console.log("No notifications to insert");
    }

    return NextResponse.json({
      success: true,
      notificationsCreated: notifications.length,
    });
  } catch (error) {
    console.error("Error creating notifications:", error);
    return NextResponse.json(
      { error: "Failed to create notifications" },
      { status: 500 }
    );
  }
}
