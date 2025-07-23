import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Course, ICourse } from "@/models/Course";
import { Community } from "@/models/Community";
import { Lesson } from "@/models/Lesson";
import mongoose from "mongoose";

// GET /api/community/[slug]/courses - Get all courses for a community
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();
    const resolvedParams = await context.params;
    const slug = resolvedParams.slug;

    // Get the community
    const community = await Community.findOne({ slug });
    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Check if user is a member of the community
    const isMember = community.members.includes(session.user.id);
    if (!isMember) {
      return NextResponse.json(
        { error: "You are not a member of this community" },
        { status: 403 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const isPublished = url.searchParams.get("isPublished");
    const tag = url.searchParams.get("tag");
    const enrolled = url.searchParams.get("enrolled") === "true";

    // Build query
    const query: any = {
      communityId: community._id,
    };

    if (isPublished === "true") {
      query.isPublished = true;
    }

    if (tag) {
      query.tags = tag;
    }

    if (enrolled) {
      query.enrolledUsers = session.user.id;
    }

    // Get courses
    const courses = await Course.find(query).sort({ createdAt: -1 });

    // Get lesson counts for each course
    const coursesWithLessonCount = await Promise.all(
      courses.map(async (course: ICourse) => {
        const lessonCount = await Lesson.countDocuments({
          courseId: course._id,
          isPublished: true,
        });

        return {
          ...(course as any).toObject(),
          lessonCount,
          communitySlug: slug,
        };
      })
    );

    return NextResponse.json(coursesWithLessonCount);
  } catch (error) {
    console.error("Error fetching community courses:", error);
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 }
    );
  }
}
