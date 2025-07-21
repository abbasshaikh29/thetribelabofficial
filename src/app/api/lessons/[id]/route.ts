import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Lesson, ILesson } from "@/models/Lesson";
import { Module } from "@/models/Module";
import { Course } from "@/models/Course";
import { Community } from "@/models/Community";
import { UserProgress } from "@/models/UserProgress";
import mongoose from "mongoose";

// GET /api/lessons/[id] - Get lesson details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();
    const resolvedParams = await context.params;
    const lessonId = resolvedParams.id;

    // Get the lesson
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Get the module
    const courseModule = await Module.findById(lesson.moduleId);
    if (!courseModule) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    // Get the course
    const course = await Course.findById(lesson.courseId);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Check if user has access to the course
    const community = await Community.findById(course.communityId);
    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    const isMember = community.members.includes(session.user.id);
    const isAdmin = community.admin === session.user.id;
    const isSubAdmin = community.subAdmins?.includes(session.user.id);
    const isEnrolled = course.enrolledUsers.includes(session.user.id);
    const isCreator = course.createdBy === session.user.id;

    // If lesson is not published, only creator, admin, or sub-admin can access
    if (!lesson.isPublished && !isCreator && !isAdmin && !isSubAdmin) {
      return NextResponse.json(
        { error: "Lesson is not published" },
        { status: 403 }
      );
    }

    // If user is not a member of the community, they can't access the lesson
    if (!isMember) {
      return NextResponse.json(
        { error: "You are not a member of this community" },
        { status: 403 }
      );
    }

    // If course is not public and user is not enrolled, they can't access
    if (!course.isPublic && !isEnrolled && !isAdmin && !isSubAdmin) {
      return NextResponse.json(
        { error: "You are not enrolled in this course" },
        { status: 403 }
      );
    }

    // Get user progress for this course
    let userProgress = await UserProgress.findOne({
      userId: session.user.id,
      courseId: lesson.courseId,
    });

    // If no progress record exists, create one
    if (!userProgress && isEnrolled) {
      userProgress = await UserProgress.create({
        userId: session.user.id,
        courseId: lesson.courseId,
        completedLessons: [],
        progress: 0,
        isCompleted: false,
      });
    }

    // Update last accessed lesson
    if (userProgress) {
      userProgress.lastAccessedLesson = new mongoose.Types.ObjectId(lessonId);
      userProgress.lastAccessedAt = new Date();
      await userProgress.save();
    }

    // Get next and previous lessons
    const allLessons = await Lesson.find({
      moduleId: lesson.moduleId,
      isPublished: true,
    }).sort({ order: 1 });

    const currentIndex = allLessons.findIndex(
      (l: ILesson) => l._id?.toString() === lessonId
    );

    const previousLesson =
      currentIndex > 0 ? allLessons[currentIndex - 1] : null;
    const nextLesson =
      currentIndex < allLessons.length - 1
        ? allLessons[currentIndex + 1]
        : null;

    // Return lesson with navigation and progress info
    return NextResponse.json({
      lesson,
      module: courseModule,
      course,
      navigation: {
        previousLesson: previousLesson
          ? {
              _id: previousLesson._id,
              title: previousLesson.title,
            }
          : null,
        nextLesson: nextLesson
          ? {
              _id: nextLesson._id,
              title: nextLesson.title,
            }
          : null,
      },
      progress: userProgress
        ? {
            isCompleted: userProgress.completedLessons.includes(
              new mongoose.Types.ObjectId(lessonId)
            ),
            overallProgress: userProgress.progress,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching lesson:", error);
    return NextResponse.json(
      { error: "Failed to fetch lesson" },
      { status: 500 }
    );
  }
}

// PUT /api/lessons/[id] - Update lesson details
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();
    const resolvedParams = await context.params;
    const lessonId = resolvedParams.id;
    const {
      title,
      description,
      content,
      videoUrl,
      attachments,
      isPublished,
      duration,
      releaseDate,
    } = await request.json();

    // Get the lesson
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Get the course
    const course = await Course.findById(lesson.courseId);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Check if user is admin, sub-admin, or creator
    const community = await Community.findById(course.communityId);
    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    const isAdmin = community.admin === session.user.id;
    const isSubAdmin = community.subAdmins?.includes(session.user.id);
    const isCreator = course.createdBy === session.user.id;

    if (!isAdmin && !isSubAdmin && !isCreator) {
      return NextResponse.json(
        {
          error: "Only admins, sub-admins, and the creator can update lessons",
        },
        { status: 403 }
      );
    }

    // Update the lesson
    const updatedLesson = await Lesson.findByIdAndUpdate(
      lessonId,
      {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(content !== undefined && { content }),
        ...(videoUrl !== undefined && { videoUrl }),
        ...(attachments && { attachments }),
        ...(isPublished !== undefined && { isPublished }),
        ...(duration !== undefined && { duration }),
        ...(releaseDate && { releaseDate: new Date(releaseDate) }),
      },
      { new: true }
    );

    return NextResponse.json(updatedLesson);
  } catch (error) {
    console.error("Error updating lesson:", error);
    return NextResponse.json(
      { error: "Failed to update lesson" },
      { status: 500 }
    );
  }
}

// DELETE /api/lessons/[id] - Delete a lesson
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();
    const resolvedParams = await context.params;
    const lessonId = resolvedParams.id;

    // Get the lesson
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Get the course
    const course = await Course.findById(lesson.courseId);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Check if user is admin, sub-admin, or creator
    const community = await Community.findById(course.communityId);
    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    const isAdmin = community.admin === session.user.id;
    const isSubAdmin = community.subAdmins?.includes(session.user.id);
    const isCreator = course.createdBy === session.user.id;

    if (!isAdmin && !isSubAdmin && !isCreator) {
      return NextResponse.json(
        {
          error: "Only admins, sub-admins, and the creator can delete lessons",
        },
        { status: 403 }
      );
    }

    // Delete the lesson
    await Lesson.findByIdAndDelete(lessonId);

    // Update user progress records
    await UserProgress.updateMany(
      {
        courseId: lesson.courseId,
        completedLessons: new mongoose.Types.ObjectId(lessonId),
      },
      { $pull: { completedLessons: new mongoose.Types.ObjectId(lessonId) } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting lesson:", error);
    return NextResponse.json(
      { error: "Failed to delete lesson" },
      { status: 500 }
    );
  }
}
