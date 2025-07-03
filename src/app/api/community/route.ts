import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Community, ICommunity } from "@/models/Community";
import slugify from "slugify";
import mongoose from "mongoose";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "30");

    await dbconnect();

    // If slug is provided, return specific community
    if (slug) {
      const community = await Community.findOne({ slug });

      if (!community) {
        return NextResponse.json(
          { error: "Community not found" },
          { status: 404 }
        );
      }

      // Filter sensitive fields for private communities
      if (community.isPrivate) {
        const userId = session?.user?.id || session?.user?.username;
        const isAdmin =
          community.admin === userId ||
          (community.subAdmins && community.subAdmins.includes(userId));
        const isMember =
          community.members && community.members.includes(userId);
        if (!isAdmin && !isMember) {
          // Exclude sensitive fields
          const {
            members,
            admin,
            createdBy,
            price,
            currency,
            pricingType,
            ...safeCommunity
          } = community.toObject();
          return NextResponse.json(safeCommunity);
        }
      }
      return NextResponse.json(community);
    }

    // If no slug, return paginated list of all communities
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await Community.countDocuments({});

    // Get communities with pagination, sorted by creation date (newest first)
    const communities = await Community.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select({
        name: 1,
        description: 1,
        slug: 1,
        iconImageUrl: 1,
        bannerImageurl: 1, // Correct field name for banner
        members: 1, // Include members array for count
        createdAt: 1,
        isPrivate: 1, // Use isPrivate instead of isPublic
        price: 1, // Include price
        currency: 1, // Include currency
        pricingType: 1, // Include pricing type
        createdBy: 1,
        admin: 1, // Include admin info
      });

    // Filter sensitive fields for private communities in the list
    const userId = session?.user?.id || session?.user?.username;
    const filteredCommunities = communities.map((community: any) => {
      if (community.isPrivate) {
        const isAdmin =
          community.admin === userId ||
          (community.subAdmins && community.subAdmins.includes(userId));
        const isMember =
          community.members && community.members.includes(userId);
        if (!isAdmin && !isMember) {
          // Exclude sensitive fields
          const {
            members,
            admin,
            createdBy,
            price,
            currency,
            pricingType,
            ...safeCommunity
          } = community.toObject();
          return safeCommunity;
        }
      }
      return community;
    });

    // Calculate pagination info
    const pages = Math.ceil(total / limit);
    const hasNextPage = page < pages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      communities: filteredCommunities,
      pagination: {
        total,
        page,
        limit,
        pages,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (error) {
    console.error("Error fetching communities:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch communities",
      },
      { status: 500 }
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
    const body: ICommunity = await request.json();

    // Validate required fields
    if (!body.name || !body.description) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create new community with default values
    const communityData: ICommunity = {
      ...body,
      createdBy: session.user.username,
    };

    // Create document instance
    const newCommunity = new Community(communityData);

    // Explicitly generate slug if not set
    if (!newCommunity.slug && newCommunity.name) {
      newCommunity.slug = slugify(newCommunity.name, {
        lower: true,
        strict: true,
      });
    }

    // Check if a community with this slug already exists
    const existingCommunity = await Community.findOne({
      slug: newCommunity.slug,
    });
    if (existingCommunity) {
      return NextResponse.json(
        { error: "A community with this name already exists" },
        { status: 409 }
      );
    }

    await newCommunity.save();
    return NextResponse.json(newCommunity);
  } catch (error) {
    console.error("Error creating community:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create community",
      },
      { status: 500 }
    );
  }
}
