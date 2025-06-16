"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useNotification } from "@/components/Notification";
import CommunityNav from "@/components/communitynav/CommunityNav";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Edit,
  List,
  Download,
  ExternalLink,
  FileText,
} from "lucide-react";

interface Lesson {
  _id: string;
  title: string;
  description?: string;
  content?: string;
  videoUrl?: string;
  attachments?: {
    name: string;
    url: string;
    type: string;
    size?: number;
  }[];
  moduleId: string;
  courseId: string;
  isPublished: boolean;
}

interface Module {
  _id: string;
  title: string;
  courseId: string;
}

interface Course {
  _id: string;
  title: string;
  communityId: string;
}

interface Navigation {
  previousLesson: {
    _id: string;
    title: string;
  } | null;
  nextLesson: {
    _id: string;
    title: string;
  } | null;
}

interface Progress {
  isCompleted: boolean;
  overallProgress: number;
}

export default function LessonView() {
  const { slug, courseId, lessonId } = useParams<{
    slug: string;
    courseId: string;
    lessonId: string;
  }>();
  const router = useRouter();
  const { data: session } = useSession();
  const { showNotification } = useNotification();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [module, setModule] = useState<Module | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [navigation, setNavigation] = useState<Navigation | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [allLessons, setAllLessons] = useState<
    {
      moduleId: string;
      moduleTitle: string;
      lessons: { _id: string; title: string; isCompleted: boolean }[];
    }[]
  >([]);

  // Fetch lesson details
  useEffect(() => {
    const fetchLessonDetails = async () => {
      try {
        setLoading(true);

        const response = await fetch(`/api/lessons/${lessonId}`);

        if (!response.ok) {
          throw new Error("Failed to fetch lesson details");
        }

        const data = await response.json();
        setLesson(data.lesson);
        setModule(data.module);
        setCourse(data.course);
        setNavigation(data.navigation);
        setProgress(data.progress);

        // Check if user is admin or creator
        if (session?.user?.id && data.course) {
          const communityResponse = await fetch(`/api/community/${slug}`);
          if (communityResponse.ok) {
            const communityData = await communityResponse.json();
            const isUserAdmin = communityData.admin === session.user.id;
            const isUserSubAdmin = communityData.subAdmins?.includes(
              session.user.id
            );
            const isCreator = data.course.createdBy === session.user.id;
            setIsAdmin(isUserAdmin || isUserSubAdmin || isCreator);
          }
        }

        // Fetch all lessons for the sidebar
        const courseResponse = await fetch(`/api/courses/${courseId}`);
        if (courseResponse.ok) {
          const courseData = await courseResponse.json();

          // Group lessons by module
          const modules = courseData.modules.sort(
            (a: any, b: any) => a.order - b.order
          );
          const lessons = courseData.lessons;

          const groupedLessons = modules.map((mod: any) => {
            const moduleLessons = lessons
              .filter((l: any) => l.moduleId === mod._id)
              .sort((a: any, b: any) => a.order - b.order)
              .map((l: any) => ({
                _id: l._id,
                title: l.title,
                isCompleted:
                  data.progress?.completedLessons?.includes(l._id) || false,
              }));

            return {
              moduleId: mod._id,
              moduleTitle: mod.title,
              lessons: moduleLessons,
            };
          });

          setAllLessons(groupedLessons);
        }
      } catch (err) {
        console.error("Error fetching lesson details:", err);
        setError("Failed to load lesson. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    if (lessonId && session) {
      fetchLessonDetails();
    }
  }, [lessonId, courseId, slug, session]);

  const handleMarkComplete = async () => {
    try {
      setMarkingComplete(true);

      const response = await fetch(
        `/api/progress/lesson/${lessonId}/complete`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to mark lesson as complete");
      }

      const data = await response.json();

      // Update progress
      setProgress({
        isCompleted: true,
        overallProgress: data.progress,
      });

      // Update lesson completion in sidebar
      setAllLessons((prev) =>
        prev.map((module) => ({
          ...module,
          lessons: module.lessons.map((lesson) =>
            lesson._id === lessonId ? { ...lesson, isCompleted: true } : lesson
          ),
        }))
      );

      showNotification("Lesson marked as complete", "success");

      // If there's a next lesson and the course isn't completed, ask if they want to continue
      if (navigation?.nextLesson && data.progress < 100) {
        // Auto-navigate to next lesson after a short delay
        setTimeout(() => {
          router.push(
            `/Newcompage/${slug}/Courses/${courseId}/lesson/${
              navigation.nextLesson!._id
            }`
          );
        }, 1500);
      } else if (data.isCompleted) {
        showNotification(
          "Congratulations! You've completed the course!",
          "success"
        );
      }
    } catch (error) {
      console.error("Error marking lesson as complete:", error);
      showNotification("Failed to mark lesson as complete", "error");
    } finally {
      setMarkingComplete(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";

    if (bytes < 1024) return bytes + " bytes";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (loading) {
    return (
      <div>
        <CommunityNav />
        <div className="flex justify-center items-center py-20">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      </div>
    );
  }

  if (error || !lesson || !module || !course) {
    return (
      <div>
        <CommunityNav />
        <div className="alert alert-error max-w-md mx-auto m-4">
          <span>{error || "Lesson not found"}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <CommunityNav />

      <div className="container mx-auto px-4 py-6">
        {/* Lesson Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Link
                href={`/Newcompage/${slug}/Courses/${courseId}`}
                className="hover:underline"
              >
                {course.title}
              </Link>
              <ChevronRight size={14} />
              <span>{module.title}</span>
            </div>
            <h1 className="text-2xl font-bold">{lesson.title}</h1>
          </div>

          <div className="flex gap-2">
            <button
              className="btn btn-sm btn-outline"
              onClick={() => setShowSidebar(!showSidebar)}
              aria-label="Toggle sidebar"
            >
              <List size={16} />
              <span className="hidden sm:inline">Lessons</span>
            </button>

            {isAdmin && (
              <Link
                href={`/Newcompage/${slug}/Courses/${courseId}/lesson/${lessonId}/edit`}
                className="btn btn-sm btn-outline"
              >
                <Edit size={16} />
                <span className="hidden sm:inline">Edit</span>
              </Link>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex">
          {/* Lesson Content */}
          <div
            className={`flex-1 transition-all ${showSidebar ? "md:pr-4" : ""}`}
          >
            <div className="card bg-base-100 shadow-md">
              <div className="card-body">
                {/* Video */}
                {lesson.videoUrl && (
                  <div className="mb-6">
                    <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
                      <video
                        src={lesson.videoUrl}
                        controls
                        className="w-full h-full"
                        poster="/images/video-placeholder.jpg"
                      />
                    </div>
                  </div>
                )}

                {/* Content */}
                {lesson.content && (
                  <div
                    className="prose max-w-none mb-6"
                    dangerouslySetInnerHTML={{
                      __html: typeof window !== 'undefined'
                        ? require('dompurify').sanitize(lesson.content, {
                            ALLOWED_TAGS: [
                              'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                              'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'code', 'pre'
                            ],
                            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
                            FORBID_SCRIPT: true,
                            FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'iframe']
                          })
                        : lesson.content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    }}
                  />
                )}

                {/* Attachments */}
                {lesson.attachments && lesson.attachments.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-3">Attachments</h3>
                    <div className="space-y-2">
                      {lesson.attachments.map((attachment, index) => (
                        <a
                          key={index}
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 border rounded-lg hover:bg-base-200 transition-colors"
                        >
                          <FileText size={20} className="text-primary" />
                          <div className="flex-1">
                            <div className="font-medium">{attachment.name}</div>
                            <div className="text-xs text-gray-500">
                              {attachment.type.split("/")[1].toUpperCase()}{" "}
                              {formatFileSize(attachment.size)}
                            </div>
                          </div>
                          <Download size={18} className="text-gray-500" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mark Complete Button */}
                <div className="flex justify-between items-center mt-4">
                  <div className="flex gap-2">
                    {navigation?.previousLesson && (
                      <Link
                        href={`/Newcompage/${slug}/Courses/${courseId}/lesson/${navigation.previousLesson._id}`}
                        className="btn btn-outline"
                      >
                        <ChevronLeft size={16} />
                        <span className="hidden sm:inline">Previous</span>
                      </Link>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {!progress?.isCompleted ? (
                      <button
                        className="btn btn-primary"
                        onClick={handleMarkComplete}
                        disabled={markingComplete}
                      >
                        {markingComplete ? (
                          <>
                            <span className="loading loading-spinner loading-sm"></span>
                            <span>Marking...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle size={16} />
                            <span>Mark Complete</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-success">
                        <CheckCircle size={18} />
                        <span>Completed</span>
                      </div>
                    )}

                    {navigation?.nextLesson && (
                      <Link
                        href={`/Newcompage/${slug}/Courses/${courseId}/lesson/${navigation.nextLesson._id}`}
                        className="btn btn-primary"
                      >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight size={16} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lesson Sidebar */}
          <div
            className={`fixed inset-0 z-20 bg-black bg-opacity-50 md:static md:bg-transparent md:w-80 transition-all ${
              showSidebar
                ? "opacity-100"
                : "opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto"
            } ${showSidebar ? "md:block" : "md:hidden"}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowSidebar(false);
              }
            }}
          >
            <div
              className={`fixed right-0 top-0 h-full w-80 bg-base-100 shadow-lg overflow-auto transition-transform md:static md:shadow-none ${
                showSidebar
                  ? "translate-x-0"
                  : "translate-x-full md:translate-x-0"
              }`}
            >
              <div className="p-4 border-b sticky top-0 bg-base-100 z-10">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold">Course Content</h3>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost md:hidden"
                    onClick={() => setShowSidebar(false)}
                    aria-label="Close sidebar"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>

                {progress && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Your Progress</span>
                      <span>{progress.overallProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full"
                        style={{ width: `${progress.overallProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-2">
                {allLessons.map((module) => (
                  <div key={module.moduleId} className="mb-4">
                    <div className="font-medium px-3 py-2">
                      {module.moduleTitle}
                    </div>
                    <div className="space-y-1">
                      {module.lessons.map((lesson) => (
                        <Link
                          key={lesson._id}
                          href={`/Newcompage/${slug}/Courses/${courseId}/lesson/${lesson._id}`}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                            lesson._id === lessonId
                              ? "bg-primary text-primary-content"
                              : "hover:bg-base-200"
                          }`}
                        >
                          {lesson.isCompleted ? (
                            <CheckCircle
                              size={16}
                              className={
                                lesson._id === lessonId
                                  ? "text-primary-content"
                                  : "text-success"
                              }
                            />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-current"></div>
                          )}
                          <span className="text-sm">{lesson.title}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
