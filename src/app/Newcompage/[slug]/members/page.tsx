"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const CommunityNav = dynamic(
  () => import("@/components/communitynav/CommunityNav"),
  {
    loading: () => <div className="h-16 bg-base-200"></div>, // Simple placeholder for nav height
    ssr: false, // Optional: if CommunityNav relies heavily on client-side things like window
  }
);
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useNotification } from "@/components/Notification";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Member {
  _id: string;
  username: string;
  image?: string;
  profileImage?: string;
  role: "admin" | "sub-admin" | "member";
  joinedAt: string;
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalMembers: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default function MembersPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = useSession();
  const { showNotification } = useNotification();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get current page from URL or default to 1
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = 12; // Number of members per page

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSubAdmin, setIsSubAdmin] = useState(false);
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    totalPages: 1,
    totalMembers: 0,
    limit: pageSize,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Function to navigate to a specific page
  const goToPage = useCallback(
    (page: number) => {
      router.push(`/Newcompage/${slug}/members?page=${page}`);
    },
    [router, slug]
  );

  // Fetch members with pagination
  const fetchMembers = useCallback(
    async (page: number) => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/community/${slug}/members?page=${page}&limit=${pageSize}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch members");
        }

        const data = await response.json();
        setMembers(data.members);
        setIsAdmin(data.isAdmin);
        setIsSubAdmin(data.isSubAdmin);
        setPagination(data.pagination);
        setLoading(false);
      } catch (error) {
        setError("Failed to load members. Please try again later.");
        setLoading(false);
      }
    },
    [slug, pageSize]
  );

  useEffect(() => {
    if (session?.user?.id) {
      fetchMembers(currentPage);
    }
  }, [slug, session?.user?.id, currentPage, fetchMembers]);

  if (!session) {
    return (
      <>
        <CommunityNav />
        <div className="container mx-auto p-6">
          <div className="bg-base-200 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Please Sign In</h2>
            <p>You need to be signed in to view community members.</p>
          </div>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <CommunityNav />
        <div className="w-full flex justify-center items-center">
          <div className="w-full md:w-2/3 p-6">
            <div className="flex justify-center items-center h-64">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <CommunityNav />
        <div className="w-full flex justify-center items-center">
          <div className="w-full md:w-2/3 p-6">
            <div className="bg-error text-error-content p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-bold mb-4">Error</h2>
              <p>{error}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <CommunityNav />
      <div className="w-full flex justify-center items-center">
        <div className="w-full md:w-2/3 p-6">
          <h1 className="text-3xl font-bold mb-6">Community Members</h1>

          {/* Member count and pagination info */}
          <div className="flex justify-between items-center mb-6">
            <div className="text-sm md:text-base">
              Showing {members.length} of {pagination.totalMembers} members
            </div>
            <div className="text-sm md:text-base">
              Page {pagination.currentPage} of {pagination.totalPages}
            </div>
          </div>

          {/* Members grid with optimized rendering */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {members.map((member) => (
              <div
                key={member._id}
                className="card bg-base-200 shadow-xl hover:shadow-2xl transition-all duration-300"
              >
                <div className="card-body">
                  <div className="flex items-center gap-4">
                    <div className="avatar">
                      <div className="w-20 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 relative overflow-hidden">
                        {member.profileImage ? (
                          <Image
                            src={member.profileImage}
                            alt={member.username}
                            fill
                            sizes="80px"
                            className="object-cover"
                            loading="lazy"
                          />
                        ) : member.image ? (
                          <Image
                            src={member.image}
                            alt={member.username}
                            fill
                            sizes="80px"
                            className="object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="bg-primary text-primary-content w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold">
                            {member.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h2 className="card-title">{member.username}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <div
                          className={`badge ${
                            member.role === "admin"
                              ? "badge-primary"
                              : member.role === "sub-admin"
                                ? "badge-secondary"
                                : "badge-ghost"
                          }`}
                        >
                          {member.role === "admin"
                            ? "Admin"
                            : member.role === "sub-admin"
                              ? "Sub-Admin"
                              : "Member"}
                        </div>
                        <div className="text-xs opacity-70">
                          Joined:{" "}
                          {new Date(member.joinedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card-actions justify-end mt-4">
                    <Link
                      href={`/profile/${member._id}`}
                      className="btn btn-primary btn-sm"
                    >
                      View Profile
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {members.length === 0 && (
            <div className="bg-base-200 p-6 rounded-lg shadow-md text-center">
              <h2 className="text-xl font-bold mb-4">No Members Found</h2>
              <p>This community doesn't have any members yet.</p>
            </div>
          )}

          {/* Pagination controls */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <div className="join">
                <button
                  type="button"
                  className="join-item btn"
                  disabled={!pagination.hasPrevPage}
                  onClick={() => goToPage(pagination.currentPage - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={18} />
                </button>

                {/* Generate page buttons */}
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter(
                    (page) =>
                      // Show first page, last page, current page, and pages around current
                      page === 1 ||
                      page === pagination.totalPages ||
                      (page >= pagination.currentPage - 1 &&
                        page <= pagination.currentPage + 1)
                  )
                  .map((page, index, array) => {
                    // Add ellipsis if there are gaps
                    const showEllipsisBefore =
                      index > 0 && page > array[index - 1] + 1;
                    const showEllipsisAfter =
                      index < array.length - 1 && page < array[index + 1] - 1;

                    return (
                      <React.Fragment key={page}>
                        {showEllipsisBefore && (
                          <button
                            type="button"
                            className="join-item btn btn-disabled"
                            aria-label="More pages"
                          >
                            ...
                          </button>
                        )}

                        <button
                          type="button"
                          className={`join-item btn ${
                            pagination.currentPage === page ? "btn-active" : ""
                          }`}
                          onClick={() => goToPage(page)}
                          aria-label={`Page ${page}`}
                          aria-current={
                            pagination.currentPage === page ? "page" : undefined
                          }
                        >
                          {page}
                        </button>

                        {showEllipsisAfter && (
                          <button
                            type="button"
                            className="join-item btn btn-disabled"
                            aria-label="More pages"
                          >
                            ...
                          </button>
                        )}
                      </React.Fragment>
                    );
                  })}

                <button
                  type="button"
                  className="join-item btn"
                  disabled={!pagination.hasNextPage}
                  onClick={() => goToPage(pagination.currentPage + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
