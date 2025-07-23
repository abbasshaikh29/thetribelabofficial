import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { Post } from "@/models/Posts";
import { Comment } from "@/models/Comments";
import { Community } from "@/models/Community";
import mongoose from "mongoose";

// Add secure origin validation function
function getSecureBaseUrl(request: NextRequest): string {
  // Define allowed origins for your application
  const ALLOWED_ORIGINS = [
    "https://yourdomain.com", // Replace with your actual domain
    "https://www.yourdomain.com", // Replace with your actual domain
    "http://localhost:3000", // For development
    "http://localhost:3001", // For development
  ];

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // First try to use the origin header if it's in our allowlist
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }

  // If no valid origin, construct from host header with validation
  if (host) {
    const protocol = host.includes("localhost") ? "http://" : "https://";
    const fullUrl = `${protocol}${host}`;

    if (ALLOWED_ORIGINS.includes(fullUrl)) {
      return fullUrl;
    }
  }

  // Fallback to a safe default (your production domain)
  return "https://yourdomain.com"; // Replace with your actual domain
}

// POST /api/notifications/post-interaction - Create notifications for post interactions (likes, comments, replies)
export async function POST(request: NextRequest) {
  try {
    console.log("Post interaction notification API called");

    const session = await getServerSession();
    if (!session?.user?.id) {
      console.log("Unauthorized - no session user ID");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();
    const {
      interactionType, // "like", "comment", "comment_like", or "comment_reply"
      postId,
      commentId, // Optional, for comment likes and replies
      parentCommentId, // Optional, only for comment replies
      parentAuthorId, // Optional, only for comment replies
      communityId,
      postCreatorId, // Added this field
    } = await request.json();

    console.log("Post interaction request data:", {
      interactionType,
      postId,
      commentId,
      parentCommentId,
      parentAuthorId,
      communityId,
      postCreatorId,
      currentUser: session.user.id,
    });

    // Validate required fields
    if (!interactionType || !postId || !communityId || !postCreatorId) {
      console.log("Missing required fields:", {
        hasInteractionType: !!interactionType,
        hasPostId: !!postId,
        hasCommunityId: !!communityId,
        hasPostCreatorId: !!postCreatorId,
      });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Find the community
    console.log("Looking up community with ID:", communityId);
    const community = await Community.findById(communityId).lean();
    if (!community) {
      console.log("Community not found with ID:", communityId);
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Find the post
    console.log("Looking up post with ID:", postId);
    const post = await Post.findById(postId);
    if (!post) {
      console.log("Post not found with ID:", postId);
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    console.log("Post data:", {
      title: post.title,
      createdBy: post.createdBy,
      createdByType: typeof post.createdBy,
      currentUser: session.user.id,
      currentUserType: typeof session.user.id,
      postCreatorId,
    });

    let notification;
    let targetUserId;

    if (interactionType === "like") {
      // Handle post like notification
      targetUserId = postCreatorId;
      console.log("Like notification - Target user ID:", targetUserId);
      console.log("Current user ID:", session.user.id);

      // Skip if the current user is the target user (post creator)
      if (session.user.id === targetUserId) {
        console.log("Skipping notification - current user is the post creator");
        return NextResponse.json({
          success: true,
          message: "Skipped - user is post creator",
        });
      }

      notification = {
        userId: new mongoose.Types.ObjectId(targetUserId),
        type: "like",
        title: `${session.user.name || "Someone"} liked your post`,
        content: post.title,
        sourceId: new mongoose.Types.ObjectId(postId),
        sourceType: "post",
        communityId: new mongoose.Types.ObjectId(communityId),
        createdBy: new mongoose.Types.ObjectId(session.user.id),
        read: false,
      };
      console.log("Created like notification object:", notification);
    } else if (interactionType === "comment") {
      // Handle post comment notification
      targetUserId = postCreatorId;
      console.log("Comment notification - Target user ID:", targetUserId);
      console.log("Current user ID:", session.user.id);

      // Skip if the current user is the target user (post creator)
      if (session.user.id === targetUserId) {
        console.log("Skipping notification - current user is the post creator");
        return NextResponse.json({
          success: true,
          message: "Skipped - user is post creator",
        });
      }

      notification = {
        userId: new mongoose.Types.ObjectId(targetUserId),
        type: "comment",
        title: `${session.user.name || "Someone"} commented on your post`,
        content: post.title,
        sourceId: new mongoose.Types.ObjectId(postId),
        sourceType: "post",
        communityId: new mongoose.Types.ObjectId(communityId),
        createdBy: new mongoose.Types.ObjectId(session.user.id),
        read: false,
      };
      console.log("Created comment notification object:", notification);
    } else if (interactionType === "comment_like" && commentId) {
      // Handle comment like notification
      const comment = await Comment.findById(commentId);
      if (!comment) {
        console.log("Comment not found with ID:", commentId);
        return NextResponse.json(
          { error: "Comment not found" },
          { status: 404 }
        );
      }

      targetUserId = comment.author.toString();
      console.log("Comment author ID:", targetUserId);

      // Skip if the current user is the comment author
      if (targetUserId === session.user.id) {
        console.log(
          "Skipping notification - current user is the comment author"
        );
        return NextResponse.json({
          success: true,
          message: "Skipped - user is comment author",
        });
      }

      notification = {
        userId: new mongoose.Types.ObjectId(targetUserId),
        type: "like",
        title: `${session.user.name || "Someone"} liked your comment`,
        content: post.title,
        sourceId: new mongoose.Types.ObjectId(postId),
        sourceType: "post",
        communityId: new mongoose.Types.ObjectId(communityId),
        createdBy: new mongoose.Types.ObjectId(session.user.id),
        read: false,
      };
      console.log("Created comment like notification object:", notification);
    } else if (interactionType === "comment_reply" && parentAuthorId) {
      // Handle comment reply notification
      targetUserId = parentAuthorId;
      console.log("Parent comment author ID:", targetUserId);

      // Skip if the current user is the parent comment author
      if (targetUserId === session.user.id) {
        console.log(
          "Skipping notification - current user is the parent comment author"
        );
        return NextResponse.json({
          success: true,
          message: "Skipped - user is parent comment author",
        });
      }

      // Skip if the parent comment author is the same as the post creator (they already got a notification)
      if (targetUserId === postCreatorId) {
        console.log(
          "Skipping notification - parent comment author is the post creator"
        );
        return NextResponse.json({
          success: true,
          message: "Skipped - parent comment author is post creator",
        });
      }

      notification = {
        userId: new mongoose.Types.ObjectId(targetUserId),
        type: "comment",
        title: `${session.user.name || "Someone"} replied to your comment`,
        content: post.title,
        sourceId: new mongoose.Types.ObjectId(postId),
        sourceType: "post",
        communityId: new mongoose.Types.ObjectId(communityId),
        createdBy: new mongoose.Types.ObjectId(session.user.id),
        read: false,
      };
      console.log("Created comment reply notification object:", notification);
    } else {
      console.log("Invalid interaction type:", interactionType);
      return NextResponse.json(
        { error: "Invalid interaction type" },
        { status: 400 }
      );
    }

    // Insert the notification
    console.log("Creating notification for user:", targetUserId);
    try {
      const result = await Notification.create(notification);
      console.log("Successfully created notification:", result._id);

      // Try to emit a socket event for real-time notification updates
      try {
        // Get the origin for absolute URLs
        const baseUrl = getSecureBaseUrl(request);

        // Prepare the event data
        const eventData = {
          notification: {
            ...notification,
            _id: result._id,
            createdAt: new Date(),
          },
          userId: targetUserId,
          createdBy: session.user.id,
          createdByName: session.user.name || "Someone",
          interactionType,
        };

        // Emit to the user's personal notification channel
        await fetch(`${baseUrl}/api/socket/emit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event: "notification-created",
            room: `user:${targetUserId}`,
            data: eventData,
          }),
        });

        console.log(
          `Emitted notification-created event to user:${targetUserId}`
        );
      } catch (socketError) {
        console.error("Error with socket emission:", socketError);
        // Continue even if socket emission fails - the notification will still be created
      }

      return NextResponse.json({
        success: true,
        notificationId: result._id,
        targetUserId: targetUserId,
      });
    } catch (insertError: any) {
      console.error("Error creating notification:", insertError);
      return NextResponse.json(
        {
          error: "Failed to create notification",
          details: insertError.message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in post interaction notification API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
