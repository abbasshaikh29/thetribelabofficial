import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Post } from "@/models/Posts";
import { User } from "@/models/User";
import mongoose from "mongoose";
import { emitToRoom } from "@/lib/socket";
import { awardPoints } from "@/lib/gamification";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();
    const { postId, action } = await request.json();

    if (!postId || !action) {
      return NextResponse.json(
        { error: "Post ID and action are required" },
        { status: 400 }
      );
    }

    // Validate action
    if (action !== "like" && action !== "unlike") {
      return NextResponse.json(
        { error: "Invalid action. Must be 'like' or 'unlike'" },
        { status: 400 }
      );
    }

    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const userId = new mongoose.Types.ObjectId(session.user.id);

    // Get user info for real-time updates
    const user = await User.findById(userId).select("name image");
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update likes based on action
    let pointsAwarded = 0;
    if (action === "like") {
      // Check if user already liked the post
      const alreadyLiked = post.likes.some(
        (id: mongoose.Types.ObjectId) => id.toString() === userId.toString()
      );

      if (!alreadyLiked) {
        post.likes.push(userId);

        // Award 1 point to the post author for receiving a like
        try {
          const result = await awardPoints(
            post.createdBy.toString(),
            1,
            post.communityId.toString()
          );
          pointsAwarded = result.pointsAwarded;
        } catch (error) {
          console.error("Error awarding points:", error);
          // Continue even if point awarding fails
        }
      }
    } else {
      // Unlike: Remove user ID from likes array
      const wasLiked = post.likes.some(
        (id: mongoose.Types.ObjectId) => id.toString() === userId.toString()
      );

      post.likes = post.likes.filter(
        (id: mongoose.Types.ObjectId) => id.toString() !== userId.toString()
      );

      // Remove 1 point from the post author for losing a like
      if (wasLiked) {
        try {
          await awardPoints(
            post.createdBy.toString(),
            -1,
            post.communityId.toString()
          );
          pointsAwarded = -1;
        } catch (error) {
          console.error("Error removing points:", error);
          // Continue even if point removal fails
        }
      }
    }

    await post.save();

    // Try to emit the socket event for real-time updates
    try {
      // Prepare the event data
      const eventData = {
        postId,
        likes: post.likes,
        likeCount: post.likes.length,
        action,
        userId: userId.toString(),
        userName: user.name || "A user",
        userImage: user.image,
      };

      // Try to emit directly using our global socket instance
      const emitSuccess = emitToRoom(
        `post:${postId}`,
        "post-like-update",
        eventData
      );

      // If direct emission fails, log the error
      if (!emitSuccess) {
        console.log("Direct socket emission failed, trying alternative method");

        // Get the origin for absolute URLs
        const origin =
          request.headers.get("origin") || request.headers.get("host") || "";
        const protocol = origin.startsWith("localhost")
          ? "http://"
          : "https://";
        const baseUrl = origin.startsWith("http")
          ? origin
          : `${protocol}${origin}`;

        // Try to emit using the socket API
        await fetch(`${baseUrl}/api/socket/emit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event: "post-like-update",
            room: `post:${postId}`,
            data: eventData,
          }),
        });

        console.log(
          `Emitted post-like-update event for post ${postId} via API`
        );
      } else {
        console.log(`Successfully emitted like update for post ${postId}`);
      }
    } catch (socketError) {
      console.error("Error with socket emission:", socketError);
      // Continue even if socket emission fails - the like will still be saved
    }

    // Also emit to the community room for broader awareness
    try {
      // Get the origin for absolute URLs
      const origin =
        request.headers.get("origin") || request.headers.get("host") || "";
      const protocol = origin.startsWith("localhost") ? "http://" : "https://";
      const baseUrl = origin.startsWith("http")
        ? origin
        : `${protocol}${origin}`;

      // Prepare the event data
      const communityEventData = {
        postId,
        likes: post.likes,
        likeCount: post.likes.length,
        action,
        userId: userId.toString(),
        userName: user.name || "A user",
        userImage: user.image,
        communityId: post.communityId.toString(),
      };

      // Try to emit using the socket API to the community room
      await fetch(`${baseUrl}/api/socket/emit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event: "post-like-update",
          room: `community:${post.communityId}`,
          data: communityEventData,
        }),
      });

      console.log(
        `Emitted post-like-update event to community:${post.communityId}`
      );
    } catch (communitySocketError) {
      console.error(
        "Error with community socket emission:",
        communitySocketError
      );
      // Continue even if socket emission fails
    }

    return NextResponse.json({
      success: true,
      likes: post.likes,
      likeCount: post.likes.length,
    });
  } catch (error) {
    console.error("Error updating post likes:", error);
    return NextResponse.json(
      { error: "Failed to update post likes" },
      { status: 500 }
    );
  }
}
