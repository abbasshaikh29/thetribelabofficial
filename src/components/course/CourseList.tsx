"use client";

import React, { useState, useEffect } from "react";
import CourseCard from "./CourseCard";
import { Search, Filter, Plus } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useNotification } from "@/components/Notification";

interface Course {
  _id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  communityId: string;
  communitySlug: string;
  enrolledUsers: string[];
  isPublished: boolean;
  tags?: string[];
}

interface Progress {
  [courseId: string]: {
    progress: number;
    isCompleted: boolean;
    lessonCount: number;
  };
}

interface CourseListProps {
  communityId: string;
  communitySlug: string;
  isAdmin: boolean;
}

const CourseList: React.FC<CourseListProps> = ({ 
  communityId, 
  communitySlug,
  isAdmin 
}) => {
  const { data: session } = useSession();
  const { showNotification } = useNotification();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Progress>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all"); // all, enrolled, completed

  // Fetch courses
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/courses?communityId=${communityId}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch courses");
        }
        
        const data = await response.json();
        
        // Add communitySlug to each course
        const coursesWithSlug = data.map((course: Course) => ({
          ...course,
          communitySlug
        }));
        
        setCourses(coursesWithSlug);
        setFilteredCourses(coursesWithSlug);
        
        // Fetch progress for each course
        if (session?.user?.id) {
          const progressData: Progress = {};
          
          for (const course of coursesWithSlug) {
            try {
              const progressResponse = await fetch(`/api/progress/course/${course._id}`);
              
              if (progressResponse.ok) {
                const progressInfo = await progressResponse.json();
                progressData[course._id] = {
                  progress: progressInfo.progress,
                  isCompleted: progressInfo.isCompleted,
                  lessonCount: progressInfo.lessons?.length || 0
                };
              }
            } catch (err) {
              console.error(`Error fetching progress for course ${course._id}:`, err);
            }
          }
          
          setProgress(progressData);
        }
      } catch (err) {
        console.error("Error fetching courses:", err);
        setError("Failed to load courses. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    if (communityId) {
      fetchCourses();
    }
  }, [communityId, communitySlug, session?.user?.id]);

  // Filter courses based on search term and filter
  useEffect(() => {
    let filtered = courses;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(course => 
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (course.description && course.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (course.tags && course.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
      );
    }
    
    // Apply status filter
    if (filter === "enrolled" && session?.user?.id) {
      filtered = filtered.filter(course => 
        course.enrolledUsers.includes(session.user.id as string)
      );
    } else if (filter === "completed" && session?.user?.id) {
      filtered = filtered.filter(course => 
        progress[course._id]?.isCompleted
      );
    }
    
    setFilteredCourses(filtered);
  }, [courses, searchTerm, filter, progress, session?.user?.id]);

  return (
    <div className="container mx-auto px-4 py-6 mt-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Courses</h1>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="Search courses..."
              className="input input-bordered w-full pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          </div>
          
          <select 
            className="select select-bordered"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Courses</option>
            <option value="enrolled">Enrolled</option>
            <option value="completed">Completed</option>
          </select>
          
          {isAdmin && (
            <Link 
              href={`/Newcompage/${communitySlug}/Courses/create`}
              className="btn btn-primary"
            >
              <Plus size={18} />
              <span>New Course</span>
            </Link>
          )}
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      ) : error ? (
        <div className="alert alert-error max-w-md mx-auto">
          <span>{error}</span>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="text-center py-10">
          <h3 className="text-lg font-medium mb-2">No courses found</h3>
          {isAdmin ? (
            <p className="text-gray-500 mb-4">Create your first course to get started!</p>
          ) : (
            <p className="text-gray-500">Check back later for new courses.</p>
          )}
          
          {isAdmin && (
            <Link 
              href={`/Newcompage/${communitySlug}/Courses/create`}
              className="btn btn-primary"
            >
              <Plus size={18} />
              <span>Create Course</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map(course => (
            <CourseCard 
              key={course._id} 
              course={course}
              progress={progress[course._id]}
              lessonCount={progress[course._id]?.lessonCount || 0}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CourseList;
