"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { convertS3UrlToR2, isS3Url } from "@/utils/s3-to-r2-migration";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useNotification } from "@/components/Notification";
import FollowButton from "@/components/FollowButton";
import {
  ArrowLeft,
  Calendar,
  User,
  MapPin,
  Link as LinkIcon,
  CheckCircle,
  AlertCircle,
  Mail,
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
          try {
            const followStatusResponse = await fetch(
              `/api/users/${id}/follow/status`
            );
            if (followStatusResponse.ok) {
              const { isFollowing } = await followStatusResponse.json();
              setIsFollowing(isFollowing);
            }
          } catch (error) {
            console.error("Error checking follow status:", error);
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

  const handleResendVerification = async () => {
    if (!userData?.email) {
      showNotification("No email address found", "error");
      return;
    }

    try {
      setResendingVerification(true);
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: userData.email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to resend verification");
      }

      showNotification(
        `Verification email sent to ${userData.email}`,
        "success"
      );
    } catch (error) {
      console.error("Error sending verification email:", error);
      showNotification("An error occurred. Please try again later.", "error");
    } finally {
      setResendingVerification(false);
    }
  };

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
        return parsedContent.map((block, index) => {
          if (block.type === "paragraph") {
            return (
              <p key={index} className="mb-2">
                {block.text}
              </p>
            );
          } else if (block.type === "heading") {
            return (
              <h4 key={index} className="font-bold mb-1">
                {block.text}
              </h4>
            );
          } else if (block.type === "list") {
            return (
              <ul key={index} className="list-disc pl-5 mb-2">
                {block.items.map((item: string, i: number) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            );
          } else if (block.type === "image" && block.url) {
            // Explicit inline sanitization for static analysis detection
            const rawImageUrl = block.url;
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
              <div key={index} className="my-2">
                <img
                  src={sanitizedImageUrl}
                  alt={block.caption || "Post image"}
                  className="rounded-md max-h-60 object-contain"
                />
                {block.caption && (
                  <p className="text-xs text-gray-500 mt-1">{block.caption}</p>
                )}
              </div>
            ) : (
              <div key={index} className="my-2 p-4 bg-gray-100 rounded-md">
                <p className="text-gray-500 text-sm">
                  Invalid or unsafe image URL
                </p>
              </div>
            );
          } else {
            // Fallback for unhandled block types
            return <p key={index}>{JSON.stringify(block)}</p>;
          }
        });
      }

      // If it's just a simple string
      if (typeof parsedContent === "string") {
        return <p>{parsedContent}</p>;
      }

      // Fallback
      return <p>{JSON.stringify(parsedContent)}</p>;
    } catch (error) {
      console.error("Error rendering post content:", error);
      return <p className="text-error">Error displaying content</p>;
    }
  };

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

  return (
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

      <div className="bg-base-200 rounded-lg shadow-xl overflow-hidden">
        {/* Profile Header */}
        <div className="bg-primary h-24 sm:h-32 relative"></div>

        <div className="p-4 sm:p-6 relative">
          {/* Profile Picture */}
          <div className="absolute -top-16 sm:-top-20 left-4 sm:left-6 avatar">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full ring ring-base-100 ring-offset-base-100 ring-offset-2 bg-base-100">
              {userData.profileImage ? (
                (() => {
                  const safeProfileImageUrl = getSafeImageUrl(
                    isS3Url(userData.profileImage)
                      ? convertS3UrlToR2(userData.profileImage)
                      : userData.profileImage
                  );
                  return safeProfileImageUrl ? (
                    <div
                      className="w-full h-full rounded-full bg-center bg-cover"
                      style={{
                        backgroundImage: `url(${safeProfileImageUrl})`,
                      }}
                    />
                  ) : (
                    <div className="bg-primary text-primary-content w-full h-full rounded-full flex items-center justify-center text-3xl font-bold">
                      {userData.username.charAt(0).toUpperCase()}
                    </div>
                  );
                })()
              ) : userData.image ? (
                (() => {
                  const safeImageUrl = getSafeImageUrl(userData.image);
                  return safeImageUrl ? (
                    <Image
                      src={safeImageUrl}
                      alt={userData.username}
                      width={128}
                      height={128}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="bg-primary text-primary-content w-full h-full rounded-full flex items-center justify-center text-3xl font-bold">
                      {userData.username.charAt(0).toUpperCase()}
                    </div>
                  );
                })()
              ) : (
                <div className="bg-primary text-primary-content w-full h-full rounded-full flex items-center justify-center text-3xl font-bold">
                  {userData.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end mb-12 sm:mb-16 gap-2">
            {isOwnProfile && !userData.emailVerified && (
              <button
                type="button"
                onClick={handleResendVerification}
                className="btn btn-warning btn-sm"
                disabled={resendingVerification}
              >
                {resendingVerification ? (
                  <span className="loading loading-spinner loading-xs"></span>
                ) : (
                  <Mail className="w-4 h-4 mr-1" />
                )}
                {resendingVerification ? "Sending..." : "Verify Email"}
              </button>
            )}
            {isOwnProfile ? (
              <Link href="/UserSettings" className="btn btn-primary btn-sm">
                Edit Profile
              </Link>
            ) : (
              session?.user?.id && (
                <FollowButton
                  userId={id as string}
                  isFollowing={isFollowing}
                  className="btn-sm"
                />
              )
            )}
          </div>

          {/* User Info */}
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold">
              {userData.username}
            </h1>

            <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm text-gray-500">
              {userData.location && (
                <div className="flex items-center gap-1">
                  <MapPin size={16} />
                  <span>{userData.location}</span>
                </div>
              )}

              <div className="flex items-center gap-1">
                <Calendar size={16} />
                <span>
                  Joined {new Date(userData.createdAt).toLocaleDateString()}
                </span>
              </div>

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
                    <div className="flex items-center gap-1">
                      <LinkIcon size={16} />
                      <a
                        href={sanitizedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {sanitizedUrl.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <LinkIcon size={16} />
                      <span className="text-gray-500">Invalid website URL</span>
                    </div>
                  );
                })()}

              {/* Email verification status - only show on own profile */}
              {isOwnProfile && (
                <div className="flex items-center gap-1">
                  {userData.emailVerified ? (
                    <>
                      <CheckCircle size={16} className="text-success" />
                      <span className="text-success">Email verified</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} className="text-warning" />
                      <span className="text-warning">Email not verified</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {userData.bio && (
              <p className="mt-4 text-base-content">{userData.bio}</p>
            )}
          </div>
        </div>
      </div>

      {/* Communities Section */}
      {communities.length > 0 && (
        <div className="mt-6 sm:mt-8">
          <h2 className="text-xl font-bold mb-3 sm:mb-4">Communities</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {communities.map((community) => (
              <Link
                key={community._id}
                href={`/Newcompage/${getSafeSlug(community.slug)}`}
                className="card bg-base-200 shadow-md hover:shadow-lg transition-all duration-300"
              >
                <div className="card-body p-4">
                  <h3 className="card-title text-lg">{community.name}</h3>
                  <div className="badge badge-primary">
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

      {/* Posts Section */}
      {posts.length > 0 && (
        <div className="mt-6 sm:mt-8">
          <h2 className="text-xl font-bold mb-3 sm:mb-4">Recent Posts</h2>
          <div className="space-y-3 sm:space-y-4">
            {posts.map((post) => (
              <div
                key={post._id}
                className="card bg-base-200 shadow-md hover:shadow-lg transition-all duration-300"
              >
                <div className="card-body p-4">
                  {post.title && (
                    <h3 className="card-title text-lg">{post.title}</h3>
                  )}
                  <div className="text-sm text-gray-500 flex items-center justify-between">
                    <div>
                      Posted in{" "}
                      <Link
                        href={`/Newcompage/${getSafeSlug(post.community.slug)}`}
                        className="text-primary hover:underline"
                      >
                        {post.community.name}
                      </Link>
                    </div>
                    <div>{new Date(post.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="mt-3 post-content">
                    {renderPostContent(post.content)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
