
"use client";
import mongoose from "mongoose";
import React, { useState, useEffect, Suspense, lazy } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ICommunity } from "@/models/Community";
import { IPost } from "@/models/Posts";
import CommunityNav from "@/components/communitynav/CommunityNav";
import { listenForRealtimeEvents } from "@/lib/realtime";
import { useRealtime } from "@/components/RealtimeProvider";
import { useNotification } from "@/components/Notification";

// Dynamically import components for code splitting
const CommunityAboutcard = lazy(
  () => import("@/components/communitycommponets/CommunityAboutcard")
);
const CompactLeaderboard = lazy(
  () => import("@/components/gamification/CompactLeaderboard")
);
const CreatePost = lazy(() =>
  import("@/components/postcommponets/Createpost").then((mod) => ({
    default: mod.CreatePost,
  }))
);
const Searchs = lazy(() => import("@/components/communitycommponets/Search"));
const PostCard = lazy(() => import("@/components/Post"));
const About = lazy(() => import("@/components/communitynav/About"));
const EditPostModal = lazy(() =>
  import("@/components/postcommponets/EditPostModal").then((mod) => ({
    default: mod.EditPostModal,
  }))
);

interface PostWithAuthor extends Omit<IPost, "likes"> {
  _id: string;
  authorName: string;
  likes: mongoose.Types.ObjectId[];
  content: string;
  createdAt: Date;
  profileImage?: string;
}

export default function HomeIdPage() {
  // Force the correct background color for this page
  useEffect(() => {
    // Apply the background color using CSS variables
    document.body.style.backgroundColor = "var(--bg-primary)";
    document.body.style.color = "var(--text-primary)";

    // Cleanup function to remove the style when component unmounts
    return () => {
      document.body.style.removeProperty("backgroundColor");
      document.body.style.removeProperty("color");
    };
  }, []);

  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { data: session } = useSession();
  const { showNotification } = useNotification();
  const [community, setCommunity] = useState<ICommunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<PostWithAuthor[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSubAdmin, setIsSubAdmin] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<PostWithAuthor | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { isEnabled } = useRealtime();

  // Check for payment success and show notification
  useEffect(() => {
    const subscriptionStatus = searchParams.get('subscription');

    if (subscriptionStatus === 'success') {
      showNotification('🎉 Payment successful! Your subscription is now active.', 'success');

      // Clean up the URL parameter after showing notification
      const newUrl = window.location.pathname;
      router.replace(newUrl, { scroll: false });

      // Refresh community data to reflect new subscription status
      if (slug) {
        setTimeout(() => {
          window.location.reload();
        }, 1500); // Give time for notification to be seen
      }
    } else if (subscriptionStatus === 'activated') {
      showNotification('✅ Free trial activated! Enjoy unlimited access to all features.', 'success');

      // Clean up the URL parameter
      const newUrl = window.location.pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, router, slug]);

  // Function to fetch posts (sorted by date, newest first)
  const fetchPosts = async () => {
    if (!slug || !isMember) return;

    try {

      const postsResponse = await fetch(
        `/api/community/posts?communitySlug=${slug}`
      );

      if (!postsResponse.ok) {
        const errorText = await postsResponse.text();
        console.error(`Server response (${postsResponse.status}):`, errorText);
        throw new Error(
          `Failed to fetch posts: ${postsResponse.status} ${postsResponse.statusText}`
        );
      }

      const postsData = await postsResponse.json();


      // Ensure each post has a properly formatted likes array
      const processedPosts = postsData.map((post: any) => ({
        ...post,
        // Ensure likes is always an array
        likes: Array.isArray(post.likes) ? post.likes : [],
      }));

      // Log likes for debugging
      processedPosts.forEach((post: any) => {

      });

      // Posts are already sorted by the API (newest first)
      setPosts(processedPosts);
      setFilteredPosts(searchQuery ? filteredPosts : processedPosts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      setError(
        error instanceof Error ? error.message : "Failed to fetch posts"
      );
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) {
        return;
      }
      try {
        const communityResponse = await fetch(`/api/community/${slug}`);
        if (!communityResponse.ok) {
          throw new Error("Failed to fetch community");
        }
        const communityData = await communityResponse.json();
        setCommunity(communityData);

        // Debug membership check

        const membershipStatus =
          communityData.members?.includes(session?.user?.id) || false;
        setIsMember(membershipStatus);

        // Check if user is admin or sub-admin
        if (session?.user?.id) {
          const adminStatus = communityData.admin === session.user.id;
          const subAdminStatus =
            communityData.subAdmins?.includes(session.user.id) || false;
          setIsAdmin(adminStatus);
          setIsSubAdmin(subAdminStatus);
        }

        if (membershipStatus) {
          await fetchPosts();
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch community"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up interval to refresh posts periodically - reduced frequency since we have real-time updates
    const refreshInterval = setInterval(() => {
      if (isMember) {
        fetchPosts();
      }
    }, 60000); // Refresh every 60 seconds (reduced from 30 seconds)

    return () => clearInterval(refreshInterval);
  }, [slug, session?.user?.id, isMember]);

  // Set up real-time listeners for post events
  useEffect(() => {
    if (!isEnabled || !community || !isMember) {
      return;
    }



    // Listen for new posts
    const newPostCleanup = listenForRealtimeEvents(
      "post-created",
      (data: any) => {
        console.log("Received new post event:", data);

        // Only process if it's for this community
        if (data.communityId === community._id) {
          // Check if we already have this post (avoid duplicates)
          const postExists = posts.some((post) => post._id === data.post._id);

          if (!postExists) {
            console.log("Adding new post to state:", data.post);

            // Format the post data to match our expected format
            const formattedPost = {
              ...data.post,
              _id: data.post._id.toString(),
              createdAt: new Date(data.post.createdAt),
              likes: Array.isArray(data.post.likes) ? data.post.likes : [],
            };

            // Add the new post to the beginning of the posts array
            setPosts((prevPosts) => [formattedPost, ...prevPosts]);

            // Also update filtered posts if we're not searching
            if (!searchQuery) {
              setFilteredPosts((prevPosts) => [formattedPost, ...prevPosts]);
            }
          }
        }
      }
    );

    // Listen for post deletions
    const deletePostCleanup = listenForRealtimeEvents(
      "post-deleted",
      (data: any) => {
        console.log("Received post deletion event:", data);

        // Only process if it's for this community
        if (data.communityId === community._id) {
          console.log("Removing deleted post from state:", data.postId);

          // Remove the post from state
          setPosts((prevPosts) =>
            prevPosts.filter((post) => post._id !== data.postId)
          );

          // Also update filtered posts
          setFilteredPosts((prevPosts) =>
            prevPosts.filter((post) => post._id !== data.postId)
          );
        }
      }
    );

    // Listen for like updates at the community level
    const likeUpdateCleanup = listenForRealtimeEvents(
      "post-like-update",
      (data: any) => {
        console.log("Received like update at community level:", data);

        // Only process if it's for this community
        if (data.communityId === community._id) {
          // Find the post in our state
          const postIndex = posts.findIndex((post) => post._id === data.postId);

          if (postIndex !== -1) {
            console.log("Updating likes for post:", data.postId);

            // Create a new posts array with the updated post
            const updatedPosts = [...posts];

            // Update the likes array with the server data
            if (data.likes && Array.isArray(data.likes)) {
              updatedPosts[postIndex] = {
                ...updatedPosts[postIndex],
                likes: data.likes,
              };

              // Update the posts state
              setPosts(updatedPosts);

              // Also update filtered posts if we're searching
              if (searchQuery) {
                const filteredPostIndex = filteredPosts.findIndex(
                  (post) => post._id === data.postId
                );
                if (filteredPostIndex !== -1) {
                  const updatedFilteredPosts = [...filteredPosts];
                  updatedFilteredPosts[filteredPostIndex] = {
                    ...updatedFilteredPosts[filteredPostIndex],
                    likes: data.likes,
                  };
                  setFilteredPosts(updatedFilteredPosts);
                }
              }
            }
          }
        }
      }
    );

    return () => {
      newPostCleanup();
      deletePostCleanup();
      likeUpdateCleanup();
    };
  }, [isEnabled, community, isMember, posts, filteredPosts, searchQuery]);

  // Handle search functionality
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Handle post edit
  const handleEditPost = (postId: string) => {
    const post = posts.find((p) => p._id === postId);
    if (post) {
      setEditingPost(post);
      setEditingPostId(postId);
      setIsEditModalOpen(true);
    }
  };

  // Handle post update
  const handlePostUpdated = (updatedPost: any) => {
    setPosts((prevPosts) =>
      prevPosts.map((post) =>
        post._id === updatedPost._id ? updatedPost : post
      )
    );

    // Also update filtered posts if needed
    if (searchQuery) {
      setFilteredPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === updatedPost._id ? updatedPost : post
        )
      );
    }
  };

  // Handle post delete
  const handleDeletePost = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post?")) {
      return;
    }

    try {
      const response = await fetch("/api/posts", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ postId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete post");
      }

      // Remove the post from state
      setPosts((prevPosts) => prevPosts.filter((post) => post._id !== postId));

      // Also update filtered posts if needed
      if (searchQuery) {
        setFilteredPosts((prevPosts) =>
          prevPosts.filter((post) => post._id !== postId)
        );
      }
    } catch (error: any) {
      console.error("Error deleting post:", error.message);
      alert("Failed to delete post: " + error.message);
    }
  };

  // Handle pin/unpin post
  const handlePinPost = async (postId: string, isPinned: boolean) => {
    try {
      const response = await fetch("/api/community/posts/pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId,
          communityId: community!._id,
          isPinned,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update pin status");
      }

      // Update the post in state
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === postId ? { ...post, isPinned } : post
        )
      );

      // Also update filtered posts if needed
      if (searchQuery) {
        setFilteredPosts((prevPosts) =>
          prevPosts.map((post) =>
            post._id === postId ? { ...post, isPinned } : post
          )
        );
      }
    } catch (error: any) {
      console.error("Error updating pin status:", error.message);
      alert("Failed to update pin status: " + error.message);
    }
  };

  // Effect to filter posts when search query or posts change
  useEffect(() => {
    if (!searchQuery.trim()) {
      // If search query is empty, show all posts (already sorted by API)
      setFilteredPosts(posts);
      return;
    }

    // Filter posts based on search query
    const filtered = posts.filter((post) => {
      const lowerCaseQuery = searchQuery.toLowerCase();

      // Search in title
      if (post.title.toLowerCase().includes(lowerCaseQuery)) {
        return true;
      }

      // Search in content
      try {
        let content;
        if (typeof post.content === "string") {
          content = JSON.parse(post.content);
        } else {
          content = post.content;
        }

        if (Array.isArray(content)) {
          return content.some(
            (item) =>
              item.type === "text" &&
              item.content.toLowerCase().includes(lowerCaseQuery)
          );
        }

        return false;
      } catch (e) {
        console.error("Error parsing post content:", e);
        return false;
      }
    });

    // Filtered posts should maintain the same sort order (newest first)
    setFilteredPosts(filtered);
  }, [searchQuery, posts]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!community) {
    return <div>Community not found.</div>;
  }

  return (
    <>
      <div style={{ backgroundColor: "var(--bg-primary)" }}>
        <CommunityNav />
        {isMember ? (
          <div className="container mt-6 mx-auto px-4 py-8">
            <div className="flex flex-col lg:flex-row justify-between gap-4">
              {/* Main content - Posts */}
              <div className="flex flex-col mt-6 w-full lg:w-2/3 gap-3">
                <div className="mb-4">
                  <Suspense
                    fallback={<div className="skeleton h-12 w-full"></div>}
                  >
                    <Searchs onSearch={handleSearch} />
                  </Suspense>
                </div>
                <div>
                  <Suspense
                    fallback={<div className="skeleton h-32 w-full"></div>}
                  >
                    <CreatePost
                      communitySlug={slug}
                      authorId={session?.user?.id as string}
                      isAdmin={isAdmin}
                      onPostCreated={(newPost) => {
                        console.log("New post created:", newPost);

                        // Ensure the new post has all required fields and proper formatting
                        const formattedPost = {
                          ...newPost,
                          _id: newPost._id.toString(),
                          createdAt:
                            typeof newPost.createdAt === "string"
                              ? newPost.createdAt
                              : new Date().toISOString(),
                          likes: Array.isArray(newPost.likes)
                            ? newPost.likes
                            : [],
                          authorName:
                            newPost.authorName ||
                            session?.user?.name ||
                            "Unknown",
                          profileImage:
                            newPost.profileImage || session?.user?.image,
                          createdBy:
                            typeof newPost.createdBy === "object" &&
                            newPost.createdBy !== null
                              ? newPost.createdBy._id?.toString() ||
                                newPost.createdBy.toString()
                              : newPost.createdBy || session?.user?.id,
                        };

                        // Add the new post to the beginning of the posts array
                        setPosts((prevPosts) => [formattedPost, ...prevPosts]);

                        // Also update filtered posts if we're not searching
                        if (!searchQuery) {
                          setFilteredPosts((prevPosts) => [
                            formattedPost,
                            ...prevPosts,
                          ]);
                        }
                      }}
                    />
                  </Suspense>
                </div>
                <div className="grid grid-cols-1 gap-4 community-feed">
                  {filteredPosts.length === 0 && searchQuery ? (
                    <div className="text-center p-4 bg-base-200 rounded-lg">
                      <p className="text-lg">
                        No posts found matching "{searchQuery}"
                      </p>
                    </div>
                  ) : (
                    filteredPosts.map((post) => {
                      const postData = {
                        ...post,
                        _id: post._id.toString(),
                        createdAt:
                          typeof post.createdAt === "string"
                            ? post.createdAt
                            : post.createdAt.toISOString(),
                        likes: Array.isArray(post.likes) ? post.likes : [],
                        authorName: post.authorName,
                        profileImage: post.profileImage,
                        // Convert createdBy to string if it's an object
                        createdBy:
                          typeof post.createdBy === "object" &&
                          post.createdBy !== null
                            ? post.createdBy._id?.toString() ||
                              post.createdBy.toString()
                            : post.createdBy,
                      };
                      return (
                        <Suspense
                          key={post._id}
                          fallback={
                            <div className="skeleton h-48 w-full"></div>
                          }
                        >
                          <PostCard
                            key={post._id}
                            post={postData}
                            onLike={(liked) => {
                              // The Post component will handle the API call
                              // We'll just update the UI state here
                              setPosts((prev) => {
                                return prev.map((p) => {
                                  if (p._id === post._id) {
                                    // Make sure likes is always an array
                                    const currentLikes = Array.isArray(p.likes)
                                      ? [...p.likes]
                                      : [];

                                    if (liked) {
                                      // Check if user already liked the post to avoid duplicates
                                      const alreadyLiked = currentLikes.some(
                                        (id) =>
                                          id.toString() === session?.user?.id
                                      );

                                      if (!alreadyLiked && session?.user?.id) {
                                        // Add the user's ID to likes
                                        return {
                                          ...p,
                                          likes: [
                                            ...currentLikes,
                                            new mongoose.Types.ObjectId(
                                              session.user.id
                                            ),
                                          ],
                                        };
                                      } else {
                                        // User already liked the post, return unchanged
                                        return p;
                                      }
                                    } else {
                                      // Remove the user's ID from likes
                                      return {
                                        ...p,
                                        likes: currentLikes.filter(
                                          (id) =>
                                            id.toString() !== session?.user?.id
                                        ),
                                      };
                                    }
                                  }
                                  return p;
                                });
                              });
                            }}
                            onEdit={(postId) => handleEditPost(postId)}
                            onDelete={(postId) => handleDeletePost(postId)}
                            onPin={(postId, isPinned) =>
                              handlePinPost(postId, isPinned)
                            }
                            isAdmin={isAdmin || isSubAdmin}
                          />
                        </Suspense>
                      );
                    })
                  )}
                </div>
              </div>

              {/* About card - Hidden on mobile, visible on large screens */}
              <div className="hidden lg:block lg:w-1/3 mt-6 space-y-4">
                <Suspense
                  fallback={<div className="skeleton h-96 w-full"></div>}
                >
                  <CommunityAboutcard slug={slug} />
                </Suspense>

                {/* Compact Leaderboard */}
                <Suspense
                  fallback={<div className="skeleton h-64 w-full"></div>}
                >
                  <CompactLeaderboard
                    communityId={community?._id?.toString() || ""}
                    communitySlug={slug}
                    period="30day"
                    limit={5}
                  />
                </Suspense>
              </div>

              {/* Mobile-only about button that opens a modal */}
              <div className="lg:hidden w-full mt-4 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    const modal = document.getElementById(
                      "community-about-modal"
                    ) as HTMLDialogElement;
                    if (modal) modal.showModal();
                  }}
                  className="btn btn-outline w-full"
                >
                  About This Community
                </button>

                <dialog
                  id="community-about-modal"
                  className="modal modal-bottom sm:modal-middle"
                >
                  <div className="modal-box">
                    <Suspense
                      fallback={<div className="skeleton h-96 w-full"></div>}
                    >
                      <CommunityAboutcard slug={slug} />
                    </Suspense>
                    <div className="modal-action">
                      <form method="dialog">
                        <button type="submit" className="btn">
                          Close
                        </button>
                      </form>
                    </div>
                  </div>
                </dialog>
              </div>
            </div>
          </div>
        ) : (
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col gap-4">
              <Suspense fallback={<div className="skeleton h-96 w-full"></div>}>
                <About slug={slug} />
              </Suspense>
            </div>
          </div>
        )}
      </div>

      {/* Edit Post Modal */}
      {editingPost && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
              <div className="loading loading-spinner loading-lg text-primary"></div>
            </div>
          }
        >
          <EditPostModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setEditingPost(null);
              setEditingPostId(null);
            }}
            postId={editingPostId || ""}
            initialTitle={editingPost.title}
            initialContent={
              typeof editingPost.content === "string"
                ? JSON.parse(editingPost.content)
                : editingPost.content
            }
            isAdmin={isAdmin}
            onPostUpdated={handlePostUpdated}
          />
        </Suspense>
      )}
    </>
  );
}
