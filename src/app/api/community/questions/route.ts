import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { Community } from "@/models/Community";
import { dbconnect } from "@/lib/db";
import mongoose from "mongoose";

// GET questions for a community
export async function GET(req: Request) {
  try {
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

    return NextResponse.json({ questions: community.adminQuestions });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST to update questions (admin only)
export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { communityId, questions } = await req.json();

    if (!communityId || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate questions array length
    if (questions.length > 3) {
      return NextResponse.json(
        { error: "Maximum 3 questions allowed" },
        { status: 400 }
      );
    }

    // Filter out empty questions
    const filteredQuestions = questions.filter((q) => q.trim() !== "");

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

    // Update questions
    community.adminQuestions = filteredQuestions;
    await community.save();

    return NextResponse.json({
      message: "Questions updated successfully",
      questions: community.adminQuestions,
    });
  } catch (error) {
    console.error("Error updating questions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
