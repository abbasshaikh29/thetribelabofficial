import { getServerSession } from "@/lib/auth-helpers";
import { User } from "@/models/User";
import { Post } from "@/models/Posts";
import { Community, ICommunity } from "@/models/Community";
import { dbconnect } from "@/lib/db";

import { NextRequest, NextResponse } from "next/server";
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await context.params;
  const { id } = resolvedParams;

  await dbconnect();

  try {
    // Verify authentication
    if (!id) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = id as string;

    // Validate user ID format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return NextResponse.json(
        { error: "Invalid user ID format" },
        { status: 400 }
      );
    }
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch posts created by the user using the same approach as community posts
    const posts = await Post.find({ createdBy: user._id })
      .populate("communityId", "name slug")
      .select("title content createdAt likes") // Explicitly select likes
      .sort({ createdAt: -1 });

    // Find communities the user is a member of
    const communities = await Community.find({ members: id });

    // Map communities with user's role in each
    const userCommunities = communities.map((community: ICommunity) => {
      let role = "member";
      if (community.admin === id) {
        role = "admin";
      } else if (community.subAdmins?.includes(id)) {
        role = "sub-admin";
      }

      return {
        _id: community._id,
        name: community.name,
        slug: community.slug,
        role,
      };
    });

    return NextResponse.json({
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        image: user.image,
        profileImage: user.profileImage,
        bio: user.bio || "",
        location: user.location || "",
        website: user.website || "",
        createdAt: user.createdAt,
        emailVerified: user.emailVerified || false,
        followersCount: user.followedBy?.length || 0,
        followingCount: user.following?.length || 0,
      },
      communities: userCommunities,
      posts: posts.map((post: any) => ({
        _id: post._id,
        title: post.title,
        content: post.content,
        createdAt: post.createdAt,
        likes: post.likes || [], // Include likes array
        community: {
          name: post.communityId?.name || "Unknown Community",
          slug: post.communityId?.slug || "",
        },
        authorName: user.username, // Already fetching user, so authorName is user.username
        authorProfileImage: user.profileImage || "", // Add author's profile image
        authorBio: user.bio || "", // Add author's bio
      })),
    });
  } catch (error) {
    // Error handling
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
