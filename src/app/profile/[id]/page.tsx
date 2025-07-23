"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { convertS3UrlToR2, isS3Url } from "@/utils/s3-to-r2-migration";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useNotification } from "@/components/Notification";
import FollowButton from "@/components/FollowButton";
import Header from "@/components/Header";
import {
  ArrowLeft,
  Calendar,
  User,
  MapPin,
  Link as LinkIcon,
  CheckCircle,
  AlertCircle,
  Mail,
  MessageSquare, // Added for Chat button
} from "lucide-react";

interface UserData {
  _id: string;
  username: string;
  email?: string;
  image?: string;
  profileImage?: string;
  bio?: string;
  location?: string;
  website?: string;
  createdAt: string;
  emailVerified?: boolean;
  followersCount?: number;
  followingCount?: number;
}

interface Community {
  _id: string;
  name: string;
  slug: string;
  role: "admin" | "sub-admin" | "member";
}

interface Post {
  _id: string;
  title: string;
  content: any;
  createdAt: string;
  community: {
    name: string;
    slug: string;
  };
  author?: {
    _id: string;
    username: string;
    profileImage?: string;
  };
}

interface ApiResponse {
  user: UserData;
  communities: Community[];
  posts: Post[];
}

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const { showNotification } = useNotification();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/user/${id}`);

        if (!response.ok) {
          throw new Error("Failed to fetch user profile");
        }

        const data: ApiResponse = await response.json();
        setUserData(data.user);
        setCommunities(data.communities || []);
        setPosts(data.posts || []);
        const isOwn = session?.user?.id === id;
        setIsOwnProfile(isOwn);

        // Check if current user is following this user
        if (!isOwn && session?.user?.id) {
          const followStatusResponse = await fetch(
            `/api/users/${id}/follow/status`
          );
          if (followStatusResponse.ok) {
            const { isFollowing } = await followStatusResponse.json();
            setIsFollowing(isFollowing);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching profile:", error);
        setError("Failed to load user profile. Please try again later.");
        setLoading(false);
      }
    };

    if (id) {
      fetchProfile();
    }
  }, [id, session?.user?.id]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-error text-error-content p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-base-200 p-6 rounded-lg shadow-md text-center">
          <h2 className="text-xl font-bold mb-4">User Not Found</h2>
          <p>
            The user profile you're looking for doesn't exist or has been
            removed.
          </p>
          <Link href="/" className="btn btn-primary mt-4">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // Function to safely validate and format website URLs
  const getSafeWebsiteUrl = (website: string): string | null => {
    try {
      // Remove any leading/trailing whitespace
      const cleanWebsite = website.trim();

      // Block dangerous protocols
      const dangerousProtocols = [
        "javascript:",
        "data:",
        "vbscript:",
        "file:",
        "ftp:",
      ];
      const lowerCaseWebsite = cleanWebsite.toLowerCase();

      if (
        dangerousProtocols.some((protocol) =>
          lowerCaseWebsite.startsWith(protocol)
        )
      ) {
        return null;
      }

      // If it starts with http/https, validate it as a URL
      if (
        cleanWebsite.startsWith("http://") ||
        cleanWebsite.startsWith("https://")
      ) {
        const url = new URL(cleanWebsite);
        // Only allow http and https protocols
        if (url.protocol === "http:" || url.protocol === "https:") {
          return url.toString();
        }
        return null;
      }

      // If it doesn't start with a protocol, add https and validate
      const urlWithProtocol = `https://${cleanWebsite}`;
      const url = new URL(urlWithProtocol);

      // Ensure it's a valid domain format (basic check)
      if (
        url.hostname &&
        url.hostname.includes(".") &&
        url.hostname.length > 3
      ) {
        return url.toString();
      }

      return null;
    } catch (error) {
      // Invalid URL format
      return null;
    }
  };

  // Function to safely validate image URLs
  const getSafeImageUrl = (imageUrl: string): string | null => {
    try {
      // Remove any leading/trailing whitespace
      const cleanUrl = imageUrl.trim();

      // Block dangerous protocols
      const dangerousProtocols = ["javascript:", "data:", "vbscript:", "file:"];
      const lowerCaseUrl = cleanUrl.toLowerCase();

      if (
        dangerousProtocols.some((protocol) => lowerCaseUrl.startsWith(protocol))
      ) {
        return null;
      }

      // Only allow http, https protocols for images
      if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
        const url = new URL(cleanUrl);
        if (url.protocol === "http:" || url.protocol === "https:") {
          return url.toString();
        }
      }

      // For relative URLs or other formats, return as-is if they don't contain dangerous patterns
      if (
        !lowerCaseUrl.includes("javascript:") &&
        !lowerCaseUrl.includes("vbscript:")
      ) {
        return cleanUrl;
      }

      return null;
    } catch (error) {
      // Invalid URL format
      return null;
    }
  };

  // Function to safely validate community slugs - prevents XSS attacks
  // This function sanitizes slugs to prevent injection of dangerous protocols
  const getSafeSlug = (slug: string): string => {
    // Input validation
    if (!slug || typeof slug !== "string") {
      return "invalid-slug";
    }

    // Remove any dangerous characters and patterns
    const cleanSlug = slug.replace(/[^a-zA-Z0-9\-_]/g, "");

    // Block dangerous protocol patterns
    const dangerousPatterns = [
      "javascript",
      "data",
      "vbscript",
      "file",
      "about",
    ];
    const lowerSlug = cleanSlug.toLowerCase();

    if (dangerousPatterns.some((pattern) => lowerSlug.startsWith(pattern))) {
      console.warn(`Blocked dangerous slug pattern: ${slug}`);
      return "invalid-slug";
    }

    // Ensure minimum length and return safe slug
    return cleanSlug.length > 0 ? cleanSlug : "invalid-slug";
  };

  // Function to render post content based on type
  const renderPostContent = (content: any) => {
    try {
      // If content is a string, try to parse it as JSON
      let parsedContent = content;
      if (typeof content === "string") {
        try {
          parsedContent = JSON.parse(content);
        } catch (e) {
          // If it's not valid JSON, just display as text
          return <p>{content}</p>;
        }
      }

      // Handle array of content blocks
      if (Array.isArray(parsedContent)) {
        return parsedContent.map((item, index) => {
          if (item.type === "text") {
            return (
              <p key={index} className="mb-2">
                {item.content}
              </p>
            );
          } else if (item.type === "image") {
            // Explicit inline sanitization for static analysis detection
            const rawImageUrl = item.content;
            const sanitizedImageUrl = (() => {
              if (!rawImageUrl || typeof rawImageUrl !== "string") return null;
              const cleanUrl = rawImageUrl.trim();
              // Block dangerous protocols explicitly
              if (
                cleanUrl.toLowerCase().startsWith("javascript:") ||
                cleanUrl.toLowerCase().startsWith("data:") ||
                cleanUrl.toLowerCase().startsWith("vbscript:") ||
                cleanUrl.toLowerCase().startsWith("file:")
              ) {
                return null;
              }
              return getSafeImageUrl(rawImageUrl);
            })();

            return sanitizedImageUrl ? (
              <div key={index} className="my-3 rounded-lg overflow-hidden">
                <img
                  src={sanitizedImageUrl}
                  alt="Post image"
                  className="w-full h-auto max-h-96 object-contain"
                />
              </div>
            ) : (
              <div key={index} className="my-3 p-4 bg-gray-100 rounded-lg">
                <p className="text-gray-500 text-sm">
                  Invalid or unsafe image URL
                </p>
              </div>
            );
          } else {
            return null;
          }
        });
      }

      // If it's an object with type property
      if (
        parsedContent &&
        typeof parsedContent === "object" &&
        "type" in parsedContent
      ) {
        if (parsedContent.type === "text") {
          return <p>{parsedContent.content}</p>;
        } else if (parsedContent.type === "image") {
          // Explicit inline sanitization for static analysis detection
          const rawImageUrl = parsedContent.content;
          const sanitizedImageUrl = (() => {
            if (!rawImageUrl || typeof rawImageUrl !== "string") return null;
            const cleanUrl = rawImageUrl.trim();
            // Block dangerous protocols explicitly
            if (
              cleanUrl.toLowerCase().startsWith("javascript:") ||
              cleanUrl.toLowerCase().startsWith("data:") ||
              cleanUrl.toLowerCase().startsWith("vbscript:") ||
              cleanUrl.toLowerCase().startsWith("file:")
            ) {
              return null;
            }
            return getSafeImageUrl(rawImageUrl);
          })();

          return sanitizedImageUrl ? (
            <div className="my-3 rounded-lg overflow-hidden">
              <img
                src={sanitizedImageUrl}
                alt="Post image"
                className="w-full h-auto max-h-96 object-contain"
              />
            </div>
          ) : (
            <div className="my-3 p-4 bg-gray-100 rounded-lg">
              <p className="text-gray-500 text-sm">
                Invalid or unsafe image URL
              </p>
            </div>
          );
        }
      }

      // Fallback for unknown content format
      return (
        <p className="text-gray-500 italic">Content cannot be displayed</p>
      );
    } catch (error) {
      console.error("Error rendering post content:", error);
      return <p className="text-gray-500 italic">Error displaying content</p>;
    }
  };

  const handleResendVerification = async () => {
    if (!userData?.email) {
      showNotification("Email address is required", "error");
      return;
    }

    setResendingVerification(true);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: userData.email }),
      });

      const data = await response.json();

      if (response.ok) {
        showNotification(
          "Verification email sent. Please check your inbox.",
          "success"
        );
      } else {
        showNotification(
          data.error || "Failed to send verification email",
          "error"
        );
      }
    } catch (error) {
      console.error("Error sending verification email:", error);
      showNotification("An error occurred. Please try again later.", "error");
    } finally {
      setResendingVerification(false);
    }
  };

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn btn-ghost btn-sm gap-2"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
        {/* Main content area with two columns */}
        <div className="flex flex-col lg:flex-row gap-6 mt-4">
          {/* Left Column (2/3 width on large screens) */}
          <div className="lg:w-2/3 space-y-6 order-2 lg:order-1">
            {/* Communities Section (Memberships) */}
            {communities.length > 0 && (
              <div className="bg-base-200 p-4 sm:p-6 rounded-lg shadow">
                <h2 className="text-xl font-bold mb-3 sm:mb-4">Memberships</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {communities.map((community) => (
                    <Link
                      key={community._id}
                      href={`/Newcompage/${getSafeSlug(community.slug)}`}
                      className="card bg-base-100 shadow-md hover:shadow-lg transition-all duration-300"
                    >
                      <div className="card-body p-4">
                        <h3 className="card-title text-md sm:text-lg">
                          {community.name}
                        </h3>
                        <div className="badge badge-sm badge-primary mt-1">
                          {community.role === "admin"
                            ? "Admin"
                            : community.role === "sub-admin"
                              ? "Sub-Admin"
                              : "Member"}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Posts Section (Contributions) */}
            {posts.length > 0 && (
              <div className="bg-base-200 p-4 sm:p-6 rounded-lg shadow">
                <h2 className="text-xl font-bold mb-3 sm:mb-4">
                  Contributions
                </h2>
                <div className="space-y-3 sm:space-y-4">
                  {posts.map((post) => (
                    <div
                      key={post._id}
                      className="card bg-base-100 shadow-md hover:shadow-lg transition-all duration-300"
                    >
                      <div className="card-body p-4">
                        {post.title && (
                          <h3 className="card-title text-md sm:text-lg">
                            {post.title}
                          </h3>
                        )}
                        <div className="text-xs sm:text-sm text-gray-500 flex items-center justify-between mt-1">
                          <div>
                            Posted in{" "}
                            <Link
                              href={`/Newcompage/${getSafeSlug(post.community.slug)}`}
                              className="text-primary hover:underline"
                            >
                              {post.community.name}
                            </Link>
                          </div>
                          <div>
                            {new Date(post.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="mt-3 post-content text-sm">
                          {renderPostContent(post.content)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {communities.length === 0 && posts.length === 0 && (
              <div className="text-center py-10 text-gray-500 bg-base-200 p-6 rounded-lg shadow">
                No memberships or contributions to display.
              </div>
            )}
          </div>
          {/* Right Column (1/3 width on large screens - User Info Card) */}
          <div className="lg:w-1/3 order-1 lg:order-2">
            <div className="bg-base-100 p-5 sm:p-6 rounded-lg shadow-xl sticky top-4">
              {/* Profile Image */}
              <div className="flex justify-center mb-4">
                {userData.profileImage ? (
                  (() => {
                    const safeProfileImageUrl = getSafeImageUrl(
                      isS3Url(userData.profileImage)
                        ? convertS3UrlToR2(userData.profileImage)
                        : userData.profileImage
                    );
                    return safeProfileImageUrl ? (
                      <Image
                        src={safeProfileImageUrl}
                        alt={userData.username}
                        width={128}
                        height={128}
                        className="rounded-full object-cover border-4 border-base-300 shadow-md"
                        priority
                      />
                    ) : (
                      <div className="w-32 h-32 rounded-full bg-base-300 border-4 border-base-200 flex items-center justify-center text-gray-500 shadow-md">
                        <User size={64} />
                      </div>
                    );
                  })()
                ) : (
                  <div className="w-32 h-32 rounded-full bg-base-300 border-4 border-base-200 flex items-center justify-center text-gray-500 shadow-md">
                    <User size={64} />
                  </div>
                )}
              </div>

              {/* User Name & Handle */}
              <h1 className="text-2xl font-bold text-center">
                {userData.username}
              </h1>
              <p className="text-center text-sm text-gray-500 mb-2">
                @{userData.username.toLowerCase().replace(/\s+/g, "-")}
              </p>

              {/* Bio */}
              {userData.bio && (
                <p className="text-center text-sm text-gray-600 mt-1 mb-4">
                  {userData.bio}
                </p>
              )}

              {/* Joined Date */}
              <div className="text-xs sm:text-sm text-gray-500 space-y-1 mb-4 text-center">
                <div className="flex items-center justify-center">
                  <Calendar size={14} className="mr-1" />
                  Joined{" "}
                  {new Date(userData.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>

              {/* Stats: Contributions, Followers, Following */}
              <div className="flex justify-around text-center my-4 py-3 border-t border-b border-base-200">
                <div>
                  <p className="font-bold text-md sm:text-lg">{posts.length}</p>
                  <p className="text-xs text-gray-500">Contributions</p>
                </div>
                <div>
                  <p className="font-bold text-md sm:text-lg">
                    {userData.followersCount || 0}
                  </p>
                  <p className="text-xs text-gray-500">Followers</p>
                </div>
                <div>
                  <p className="font-bold text-md sm:text-lg">
                    {userData.followingCount || 0}
                  </p>
                  <p className="text-xs text-gray-500">Following</p>
                </div>
              </div>

              {/* Edit Profile / Follow Button */}
              <div className="mt-4">
                {isOwnProfile ? (
                  <Link
                    href="/UserSettings"
                    className="btn btn-primary btn-block"
                  >
                    Edit Profile
                  </Link>
                ) : (
                  session?.user?.id && (
                    <FollowButton
                      userId={id as string}
                      isFollowing={isFollowing}
                      className="btn-primary btn-block"
                    />
                  )
                )}
                {/* Chat Button - Show if not own profile and user is logged in */}
                {!isOwnProfile && session?.user?.id && (
                  <button
                    className="btn btn-secondary btn-block mt-2"
                    onClick={() => {
                      // Implement chat functionality or navigation here
                      // For now, let's just log to console
                      console.log(
                        `Attempting to chat with user ${userData?._id}`
                      );
                      showNotification(
                        "Chat functionality is not yet implemented.",
                        "info"
                      );
                    }}
                  >
                    <MessageSquare size={18} className="mr-2" />
                    Chat
                  </button>
                )}
              </div>

              {/* Email Verification - only on own profile */}
              {isOwnProfile && !userData.emailVerified && (
                <div className="mt-4 text-center p-3 bg-warning/10 rounded-md border border-warning/30">
                  <div className="flex items-center justify-center text-warning mb-2">
                    <AlertCircle size={18} className="mr-1" />
                    <span className="font-semibold text-sm">
                      Email not verified
                    </span>
                  </div>
                  <button
                    onClick={handleResendVerification}
                    disabled={resendingVerification}
                    className="btn btn-xs sm:btn-sm btn-warning"
                  >
                    {resendingVerification
                      ? "Sending..."
                      : "Resend Verification Email"}
                  </button>
                </div>
              )}

              {/* Website Link */}
              {userData.website &&
                (() => {
                  // Explicit inline sanitization for static analysis detection
                  const rawWebsiteUrl = userData.website;
                  const sanitizedUrl = (() => {
                    if (!rawWebsiteUrl || typeof rawWebsiteUrl !== "string")
                      return null;
                    const cleanUrl = rawWebsiteUrl.trim();
                    // Block dangerous protocols explicitly
                    if (
                      cleanUrl.toLowerCase().startsWith("javascript:") ||
                      cleanUrl.toLowerCase().startsWith("data:") ||
                      cleanUrl.toLowerCase().startsWith("vbscript:") ||
                      cleanUrl.toLowerCase().startsWith("file:")
                    ) {
                      return null;
                    }
                    return getSafeWebsiteUrl(rawWebsiteUrl);
                  })();

                  return sanitizedUrl ? (
                    <div className="mt-4 text-center">
                      <a
                        href={sanitizedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-xs sm:text-sm flex items-center justify-center break-all"
                      >
                        <LinkIcon size={14} className="mr-1 flex-shrink-0" />
                        <span className="truncate">
                          {sanitizedUrl.replace(/^https?:\/\//, "")}
                        </span>
                      </a>
                    </div>
                  ) : (
                    <div className="mt-4 text-center">
                      <div className="text-gray-500 text-xs sm:text-sm flex items-center justify-center">
                        <LinkIcon size={14} className="mr-1 flex-shrink-0" />
                        <span>Invalid website URL</span>
                      </div>
                    </div>
                  );
                })()}
            </div>{" "}
            {/* End of bg-base-100 card */}
          </div>{" "}
          {/* End of Right Column */}
        </div>{" "}
        {/* End of flex lg:flex-row */}
      </div>
    </>
  );
}
