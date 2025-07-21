import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Course } from "@/models/Course";
import { Lesson, ILesson } from "@/models/Lesson";
import { UserProgress } from "@/models/UserProgress";
import mongoose from "mongoose";

// GET /api/progress/course/[courseId] - Get user progress for a course
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();
    const resolvedParams = await context.params;
    const courseId = resolvedParams.courseId;

    // Get the course
    const course = await Course.findById(courseId);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Check if user is enrolled in the course
    const isEnrolled = course.enrolledUsers.includes(session.user.id);
    if (!isEnrolled) {
      return NextResponse.json(
        { error: "You are not enrolled in this course" },
        { status: 403 }
      );
    }

    // Get user progress for this course
    let userProgress = await UserProgress.findOne({
      userId: session.user.id,
      courseId: new mongoose.Types.ObjectId(courseId),
    });

    // If no progress record exists, create one
    if (!userProgress) {
      userProgress = await UserProgress.create({
        userId: session.user.id,
        courseId: new mongoose.Types.ObjectId(courseId),
        completedLessons: [],
        progress: 0,
        isCompleted: false,
      });
    }

    // Get all published lessons for this course
    const lessons = await Lesson.find({
      courseId: new mongoose.Types.ObjectId(courseId),
      isPublished: true,
    });

    // Create a map of completed lessons
    const completedLessonsMap = userProgress.completedLessons.reduce(
      (acc: Record<string, boolean>, lessonId: mongoose.Types.ObjectId) => {
        acc[lessonId.toString()] = true;
        return acc;
      },
      {} as Record<string, boolean>
    );

    // Add completion status to each lesson
    const lessonsWithStatus = lessons.map((lesson: ILesson) => ({
      _id: lesson._id,
      title: lesson.title,
      moduleId: lesson.moduleId,
      order: lesson.order,
      isCompleted: !!completedLessonsMap[lesson._id?.toString() || ''],
    }));

    return NextResponse.json({
      progress: userProgress.progress,
      isCompleted: userProgress.isCompleted,
      completedAt: userProgress.completedAt,
      lastAccessedLesson: userProgress.lastAccessedLesson,
      lastAccessedAt: userProgress.lastAccessedAt,
      lessons: lessonsWithStatus,
    });
  } catch (error) {
    console.error("Error fetching course progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch course progress" },
      { status: 500 }
    );
  }
}
