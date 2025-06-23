import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Community, ICommunity } from "@/models/Community";
import slugify from "slugify";
import mongoose from "mongoose";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ error: "Community slug is required" }, { status: 400 });
    }

    await dbconnect();
    const community = await Community.findOne({ slug });

    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    return NextResponse.json(community);
  } catch (error) {
    console.error('Error fetching community:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch community" },
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
    const existingCommunity = await Community.findOne({ slug: newCommunity.slug });
    if (existingCommunity) {
      return NextResponse.json(
        { error: "A community with this name already exists" },
        { status: 409 }
      );
    }

    await newCommunity.save();
    return NextResponse.json(newCommunity);
  } catch (error) {
    console.error('Error creating community:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create community" },
      { status: 500 }
    );
  }
}
