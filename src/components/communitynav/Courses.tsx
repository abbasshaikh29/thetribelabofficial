"use client";
import React, { useState, useEffect } from "react";
import dynamic from 'next/dynamic';

const CommunityNav = dynamic(() => import('./CommunityNav'), {
  loading: () => <div className="h-16 bg-base-200"></div>, // Simple placeholder for nav height
  ssr: false // Optional: if CommunityNav relies heavily on client-side things like window
});
import CourseList from "../course/CourseList";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useNotification } from "@/components/Notification";

function Courses() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = useSession();
  const { showNotification } = useNotification();

  const [communityId, setCommunityId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCommunityDetails = async () => {
      try {
        if (!slug) return;

        const response = await fetch(`/api/community/${slug}`);
        if (!response.ok) {
          throw new Error("Failed to fetch community details");
        }

        const data = await response.json();
        setCommunityId(data._id);

        // Check if user is admin or sub-admin
        if (session?.user?.id) {
          const isUserAdmin = data.admin === session.user.id;
          const isUserSubAdmin = data.subAdmins?.includes(session.user.id);
          setIsAdmin(isUserAdmin || isUserSubAdmin);
        }
      } catch (error) {
        console.error("Error fetching community details:", error);
        showNotification("Failed to load community details", "error");
      } finally {
        setLoading(false);
      }
    };

    if (slug && session) {
      fetchCommunityDetails();
    }
  }, [slug, session, showNotification]);

  return (
    <div>
      <CommunityNav />
      <div className="mt-6">
        {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      ) : communityId ? (
        <CourseList
          communityId={communityId}
          communitySlug={slug as string}
          isAdmin={isAdmin}
        />
      ) : (
          <div className="alert alert-error max-w-md mx-auto m-4">
            <span>Community not found</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Courses;
