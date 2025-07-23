import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Post } from "@/models/Posts";
import { Community } from "@/models/Community";
import mongoose from "mongoose";
import { User } from "@/models/User";

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

export async function GET(request: NextRequest) {
  // Create headers for responses
  const responseHeaders = new Headers({
    "Cache-Control":
      "public, max-age=5, s-maxage=15, stale-while-revalidate=30",
  });

  const errorHeaders = new Headers({
    "Cache-Control": "no-store, must-revalidate",
  });

  try {
    await dbconnect();

    // Extract community slug from the query parameters
    const communitySlug = request.nextUrl.searchParams.get("communitySlug");

    if (!communitySlug) {
      return NextResponse.json(
        { error: "Missing communitySlug" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Find community by slug first - optimized query
    const community = await Community.findOne({ slug: communitySlug })
      .select("_id") // Only select the _id field since that's all we need
      .lean<{ _id: mongoose.Types.ObjectId }>();

    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Query posts by community ID and sort by isPinned first, then createdAt in descending order
    const posts = await Post.find({ communityId: community._id })
      .select(
        "title content createdBy createdAt authorName isPinned likes communityId"
      )
      .sort({ isPinned: -1, createdAt: -1 }) // Sort pinned posts first, then by date
      .populate("createdBy", "name profileImage bio") // Added bio to populate
      .lean();

    if (!posts || posts.length === 0) {
      return NextResponse.json([], { status: 200, headers: responseHeaders });
    }

    const postsWithAuthor = posts.map((post: any) => {
      let parsedContent;
      if (typeof post.content === "string") {
        try {
          parsedContent = JSON.parse(post.content);
        } catch (error) {
          console.error("Failed to parse content", post.content);
          parsedContent = [];
        }
      } else {
        parsedContent = post.content;
      }

      // Get the profile image from the populated createdBy field
      const profileImage =
        post.createdBy &&
        typeof post.createdBy === "object" &&
        "profileImage" in post.createdBy
          ? post.createdBy.profileImage
          : undefined;

      // Since we're using .lean(), post is already a plain object and doesn't have toObject()
      // Get the bio from the populated createdBy field
      const bio =
        post.createdBy &&
        typeof post.createdBy === "object" &&
        "bio" in post.createdBy
          ? post.createdBy.bio
          : undefined;

      return {
        ...post,
        content: parsedContent,
        authorProfileImage: profileImage, // Renamed for clarity
        authorBio: bio, // Added author's bio
      };
    });

    return NextResponse.json(postsWithAuthor, { headers: responseHeaders });
  } catch (error) {
    console.error("Error in GET /api/community/posts:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch posts",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: errorHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();
    const { title, content, communitySlug, notifyMembers } =
      await request.json();

    // Validate required fields
    if (!title || !content || !communitySlug) {
      return NextResponse.json(
        {
          error: `Missing required fields: ${[
            !title && "title",
            !content && "content",
            !communitySlug && "communitySlug",
          ]
            .filter(Boolean)
            .join(", ")}`,
        },
        { status: 400 }
      );
    }

    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const processedContent = content;
    try {
      // Validate that content is valid JSON if it's a string
      if (typeof content === "string") {
        JSON.parse(content); // This will throw if invalid JSON
      }
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid content format" },
        { status: 400 }
      );
    }

    // Find community by slug
    const community = await Community.findOne({ slug: communitySlug }).lean<{
      _id: mongoose.Types.ObjectId;
    }>();
    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    const postData = {
      title,
      content: processedContent,
      authorName: user.username || user.name,
      createdBy: new mongoose.Types.ObjectId(session.user.id),
      communityId: community._id,
    };

    // Create the post
    const newPost = await Post.create(postData);

    // Check if the user is an admin of the community
    const isCommunityAdmin = await Community.exists({
      _id: community._id,
      admins: { $in: [session.user.id] },
    });

    // If notifyMembers is true AND user is an admin, create notifications for all community members
    if (notifyMembers === true && isCommunityAdmin) {
      try {
        // Get the origin for absolute URLs
        const origin = getSecureBaseUrl(request);

        // Create notifications for community members
        await fetch(`${origin}/api/notifications/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "post",
            title: "New post in your community",
            content: title,
            sourceId: newPost._id,
            sourceType: "post",
            communityId: community._id,
          }),
        });
      } catch (notificationError) {
        console.error("Error creating notifications:", notificationError);
        // Continue even if notification creation fails
      }
    }

    // Prepare the post data for the response and real-time event
    const formattedPostData = {
      ...newPost.toObject(),
      profileImage: user.profileImage,
    };

    // Try to emit a socket event for real-time updates
    try {
      // Get the origin for absolute URLs
      const origin = getSecureBaseUrl(request);

      // Prepare the event data
      const eventData = {
        post: formattedPostData,
        userId: session.user.id,
        userName: user.username || user.name || "A user",
        communityId: community._id.toString(),
      };

      // Try to emit using the socket API
      await fetch(`${origin}/api/socket/emit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event: "post-created",
          room: `community:${community._id}`,
          data: eventData,
        }),
      });

      console.log(`Emitted post-created event for post ${newPost._id}`);
    } catch (socketError) {
      console.error("Error with socket emission:", socketError);
      // Continue even if socket emission fails - the post will still be created
    }

    // Return the post with profile image
    return NextResponse.json(formattedPostData);
  } catch (error: any) {
    console.error("Error creating post:", error);

    const errorHeaders = new Headers({
      "Cache-Control": "no-store, must-revalidate",
    });

    return NextResponse.json(
      { error: error.message || "Failed to create post" },
      { status: 500, headers: errorHeaders }
    );
  }
}
