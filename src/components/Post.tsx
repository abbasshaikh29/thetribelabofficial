"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import {
  Heart,
  MessageCircle,
  Share2,
  Smile,
  MoreVertical,
  Edit,
  Trash,
  Pin,
  PinOff,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/date-utils";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Textarea } from "./ui/textarea";
import Link from "next/link";
import { FileText } from "lucide-react";
import { useSession } from "next-auth/react";
import mongoose from "mongoose";
import { normalizeUrl } from "@/lib/url-utils";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { useRealtime } from "./RealtimeProvider";
import { listenForRealtimeEvents, sendRealtimeEvent } from "@/lib/realtime";
import { useNotification } from "./Notification";
import { convertS3UrlToR2, isS3Url } from "@/utils/s3-to-r2-migration";

import ProfileAvatar from "./ProfileAvatar";
import UserHoverCard from "./UserHoverCard";

interface Comment {
  _id: string;
  text: string;
  author: mongoose.Types.ObjectId;
  authorName: string;
  createdAt: string;
  likes: mongoose.Types.ObjectId[];
  parentCommentId: string | null;
  profileImage?: string;
}

import { IPost } from "@/models/Posts";

interface Post extends Omit<IPost, "likes" | "createdAt" | "createdBy"> {
  likes: mongoose.Types.ObjectId[];
  createdAt: string | Date;
  profileImage?: string; // This seems to be for the post's main image, if any, not the author's avatar.
  authorProfileImage?: string; // Author's profile image
  authorBio?: string; // Author's bio
  createdBy: mongoose.Types.ObjectId | string;
  isPinned?: boolean;
  authorName?: string;
  authorId?: string;
}

interface CommunityCardProps {
  post: Post;
  onLike: (liked: boolean) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onPin?: (id: string, isPinned: boolean) => void;
  isAdmin?: boolean;
}

import MessageModal from "./messages/MessageModal";

export default function PostCard({
  post,
  onLike,
  onDelete,
  onEdit,
  onPin,
  isAdmin = false,
}: CommunityCardProps) {
  // --- Messaging modal state ---
  const [chatUserId, setChatUserId] = useState<string | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const handleChatClick = (userId: string) => {
    console.log('handleChatClick fired for user:', userId);
    setChatUserId(userId);
    setShowMessageModal(true);
  }
  const [mounted, setMounted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<string>("light");

  // Enhanced theme detection functionality
  useEffect(() => {
    const detectThemeChange = () => {
      const theme = document.documentElement.getAttribute('data-theme') || 'light';
      setCurrentTheme(theme);
    };

    detectThemeChange();
    window.addEventListener('theme-change', detectThemeChange);

    return () => {
      window.removeEventListener('theme-change', detectThemeChange);
    };
  }, []);
  const [isLiked, setIsLiked] = useState(false);
  const [localLikeCount, setLocalLikeCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReplyEmojiPicker, setShowReplyEmojiPicker] = useState(false);
  const { data: session } = useSession();

  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const replyEmojiPickerRef = useRef<HTMLDivElement>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Ensure post.likes is always an array
  const likesArray = Array.isArray(post.likes) ? post.likes : [];
  
  // Initialize local like count from props
  useEffect(() => {
    setLocalLikeCount(likesArray.length);
  }, [likesArray.length]);

  useEffect(() => {

  }, [post._id, likesArray]);

  // Define fetchComments before using it in useEffect
  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/comments?postId=${post._id}`);
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const { isEnabled } = useRealtime();
  const { showNotification } = useNotification();

  // Effect to detect theme changes
  useEffect(() => {
    const detectTheme = () => {
      const theme = document.documentElement.getAttribute("data-theme") || "light";
      setCurrentTheme(theme);
    };

    // Initial detection
    detectTheme();
    
    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "data-theme") {
          detectTheme();
        }
      });
    });
    
    observer.observe(document.documentElement, { attributes: true });
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setMounted(true);
    // Check if user has liked the post
    if (session?.user?.id) {
      const userId = new mongoose.Types.ObjectId(session.user.id);
      setIsLiked(
        likesArray.some((likeId) => {
          try {
            return likeId.toString() === userId.toString();
          } catch (error) {
            console.error("Error comparing like IDs:", error);
            return false;
          }
        })
      );
    }

    // Fetch comments when component mounts
    fetchComments();
  }, [likesArray, session?.user?.id, post._id]);

  // Realtime event listener for like updates and post deletion
  useEffect(() => {
    // Skip if realtime is not enabled
    if (!isEnabled) {
      console.log("Realtime not enabled for post:", post._id);
      return;
    }



    // Listen for like updates
    const likeCleanup = listenForRealtimeEvents(
      "post-like-update",
      (data: any) => {
        console.log("Received like update:", data);
        try {
          if (data.postId === post._id) {
            // If we have likes data from the server, update the post directly
            if (data.likes && Array.isArray(data.likes)) {
              // This is a more accurate update that uses the server's like data
              // We'll update the parent component with a special flag to use the server data
              const isCurrentUserLiked = data.likes.some(
                (likeId: any) => likeId.toString() === session?.user?.id
              );

              // Only update the like state if it's from another user
              if (data.userId !== session?.user?.id) {
                setIsLiked(isCurrentUserLiked);
                
                // Update local like count from server data
                if (data.likeCount !== undefined) {
                  setLocalLikeCount(data.likeCount);
                }
              }
            } else {
              // Fallback to the old behavior if we don't have likes data
              onLike(data.action === "like");
            }

            // Show a notification if someone else liked the post
            if (data.action === "like" && data.userId !== session?.user?.id) {
              showNotification(
                `${data.userName || "Someone"} liked this post`,
                "info"
              );
            }
          }
        } catch (updateError) {
          console.error("Error handling like update:", updateError);
        }
      }
    );

    // Listen for post deletion events
    const deleteCleanup = listenForRealtimeEvents(
      "post-deleted",
      (data: any) => {
        console.log("Received post deletion event:", data);
        try {
          // If this post was deleted, close any open dialogs and notify parent
          if (data.postId === post._id) {
            console.log("This post was deleted, updating UI");

            // Close any open dialogs
            setIsDialogOpen(false);

            // If the post was deleted by another user, show a notification
            if (data.userId !== session?.user?.id) {
              showNotification(
                `This post was deleted by ${data.userName || "the author"}`,
                "info"
              );
            }

            // Notify parent component to remove this post from the list
            if (onDelete) {
              onDelete(post._id);
            }
          }
        } catch (deleteError) {
          console.error("Error handling post deletion:", deleteError);
        }
      }
    );

    // Clean up when component unmounts
    return () => {
      likeCleanup();
      deleteCleanup();
    };
  }, [
    isEnabled,
    post._id,
    session?.user?.id,
    onLike,
    onDelete,
    showNotification,
  ]);

  // We don't need a separate useEffect for post._id changes anymore

  // Close emoji pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }

      if (
        replyEmojiPickerRef.current &&
        !replyEmojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowReplyEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle emoji selection for main comment
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    const textarea = commentTextareaRef.current;

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText =
        newComment.substring(0, start) + emoji + newComment.substring(end);
      setNewComment(newText);

      // Set cursor position after the inserted emoji
      setTimeout(() => {
        textarea.selectionStart = start + emoji.length;
        textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    } else {
      setNewComment(newComment + emoji);
    }
  };

  // Handle emoji selection for reply
  const handleReplyEmojiClick = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    const textarea = replyTextareaRef.current;

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText =
        newComment.substring(0, start) + emoji + newComment.substring(end);
      setNewComment(newText);

      // Set cursor position after the inserted emoji
      setTimeout(() => {
        textarea.selectionStart = start + emoji.length;
        textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    } else {
      setNewComment(newComment + emoji);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !session?.user?.id) return;

    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: newComment,
          postId: post._id,
          parentCommentId: replyingTo,
        }),
      });

      if (response.ok) {
        const commentData = await response.json();

        // Send notification to post creator if the commenter is not the post creator
        try {
          // Defensive extraction and type checks for postCreatorId and communityId
          const postCreatorId: string | null =
            typeof post.createdBy === "string"
              ? post.createdBy
              : post.createdBy &&
                  typeof post.createdBy === "object" &&
                  "toString" in post.createdBy
                ? post.createdBy.toString()
                : null;

          const communityId: string | null =
            typeof post.communityId === "string"
              ? post.communityId
              : post.communityId &&
                  typeof post.communityId === "object" &&
                  "toString" in post.communityId
                ? post.communityId.toString()
                : null;

          if (!postCreatorId || !communityId) {
            console.error("Post creator ID or community ID is missing", {
              post,
            });
            return;
          }

          console.log("Sending comment notification via dedicated API");
          console.log("Post data for comment notification:", {
            postId: post._id,
            communityId: communityId,
            currentUser: session.user.id,
            postCreator: postCreatorId,
          });

          // Send notification to post creator using the dedicated API
          const notificationResponse = await fetch(
            "/api/notifications/post-interaction",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                interactionType: "comment",
                postId: post._id.toString(),
                communityId: communityId,
                postCreatorId: postCreatorId,
              }),
            }
          );

          const notificationResult = await notificationResponse.json();
          console.log("Comment notification response:", notificationResult);

          if (notificationResult.success) {
            console.log(
              "Successfully sent comment notification to post creator"
            );
          } else {
            console.log(
              "Notification skipped or failed:",
              notificationResult.message || notificationResult.error
            );
          }
        } catch (notificationError) {
          console.error(
            "Error sending comment notification:",
            notificationError
          );
          // Continue even if notification creation fails
        }

        // If this is a reply to another comment, also notify the original commenter
        if (replyingTo && commentData.parentAuthorId) {
          try {
            console.log("Sending comment reply notification via dedicated API");
            console.log("Reply data:", {
              postId: post._id,
              parentCommentId: replyingTo,
              parentAuthorId: commentData.parentAuthorId,
              communityId: post.communityId,
              currentUser: session.user.id,
            });

            // Send notification to the original commenter using the dedicated API
            const notificationResponse = await fetch(
              "/api/notifications/post-interaction",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  interactionType: "comment_reply",
                  postId: post._id,
                  parentCommentId: replyingTo,
                  parentAuthorId: commentData.parentAuthorId,
                  communityId: post.communityId,
                }),
              }
            );

            const notificationResult = await notificationResponse.json();
            console.log(
              "Comment reply notification response:",
              notificationResult
            );

            if (notificationResult.success) {
              console.log(
                "Successfully sent reply notification to original commenter"
              );
            } else {
              console.log(
                "Notification skipped or failed:",
                notificationResult.message || notificationResult.error
              );
            }
          } catch (notificationError) {
            console.error(
              "Error sending reply notification:",
              notificationError
            );
            // Continue even if notification creation fails
          }
        }

        // Refresh all comments to ensure we have the latest data
        fetchComments();
        setNewComment("");
        setReplyingTo(null);
        setShowEmojiPicker(false);
        setShowReplyEmojiPicker(false);
      }
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const handleLikePost = async () => {
    if (!session?.user?.id) return;

    try {
      // Toggle the like state immediately for better UX
      const newLikedState = !isLiked;
      setIsLiked(newLikedState);
      
      // Update local like count immediately for responsive UI
      setLocalLikeCount(prevCount => newLikedState ? prevCount + 1 : Math.max(0, prevCount - 1));

      console.log(
        `Sending like request for post ${post._id}, action: ${
          newLikedState ? "like" : "unlike"
        }`
      );

      // Send the request to the server first
      const response = await fetch("/api/posts/like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId: post._id,
          action: newLikedState ? "like" : "unlike",
        }),
      });

      if (!response.ok) {
        // If the request fails, revert the like state
        setIsLiked(!newLikedState);
        console.error("Failed to update like status");
        return;
      }

      // Get the updated likes from the server response
      const data = await response.json();
      console.log(`Server response for like update:`, data);
      
      // Sync with server data
      if (data.likeCount !== undefined) {
        setLocalLikeCount(data.likeCount);
      }

      // Only update the parent component's state after successful server update
      // Pass the server's likes data to ensure consistency
      onLike(newLikedState);

      // If this is a like action (not unlike), send a notification to the post creator
      if (newLikedState) {
        try {
          // Defensive extraction and type checks for postCreatorId and communityId
          const postCreatorId: string | null =
            typeof post.createdBy === "string"
              ? post.createdBy
              : post.createdBy &&
                  typeof post.createdBy === "object" &&
                  "toString" in post.createdBy
                ? post.createdBy.toString()
                : null;

          const communityId: string | null =
            typeof post.communityId === "string"
              ? post.communityId
              : post.communityId &&
                  typeof post.communityId === "object" &&
                  "toString" in post.communityId
                ? post.communityId.toString()
                : null;

          if (!postCreatorId || !communityId) {
            console.error("Post creator ID or community ID is missing", {
              post,
            });
            return;
          }

          console.log("Sending post like notification via dedicated API");
          console.log("Post data for like notification:", {
            postId: post._id,
            communityId: communityId,
            currentUser: session.user.id,
            postCreator: postCreatorId,
          });

          // Send notification to post creator using the dedicated API
          const notificationResponse = await fetch(
            "/api/notifications/post-interaction",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                interactionType: "like",
                postId: post._id.toString(),
                communityId: communityId,
                postCreatorId: postCreatorId,
              }),
            }
          );

          const notificationResult = await notificationResponse.json();
          console.log("Post like notification response:", notificationResult);

          if (notificationResult.success) {
            console.log("Successfully sent like notification to post creator");
          } else {
            console.log(
              "Notification skipped or failed:",
              notificationResult.message || notificationResult.error
            );
          }
        } catch (notificationError) {
          console.error("Error sending like notification:", notificationError);
          // Continue even if notification creation fails
        }
      }

      // Prepare the event data for realtime updates with the server-provided likes
      const eventData = {
        postId: post._id,
        action: newLikedState ? "like" : "unlike",
        userId: session.user.id,
        userName: session.user.name || "A user",
        userImage: session.user.image,
        likes: data.likes,
        likeCount: data.likeCount,
        communityId: post.communityId,
      };

      // Send the realtime event to other tabs/windows
      sendRealtimeEvent("post-like-update", eventData);
      console.log("Sent realtime like update:", eventData);

      // Update the local like state with the server data to ensure consistency
      if (data.likes && Array.isArray(data.likes)) {
        const serverLikedState = data.likes.some(
          (likeId: any) => likeId.toString() === session.user.id
        );

        // Only update if different from current state
        if (serverLikedState !== isLiked) {
          console.log(`Updating like state from server: ${serverLikedState}`);
          setIsLiked(serverLikedState);
        }
      }
    } catch (error) {
      console.error("Error liking post:", error);
      // Revert the like state on error
      setIsLiked(!isLiked);
    }
  };

  const handleLikeComment = async (commentId: string, isLiked: boolean) => {
    if (!session?.user?.id) return;

    try {
      // First, find the comment in our local state to get the author
      const comment = comments.find((c) => c._id === commentId);
      if (!comment) {
        console.error("Comment not found in local state");
        return;
      }

      console.log("Liking comment:", comment);

      // Optimistic UI update - update the state immediately
      const userId = new mongoose.Types.ObjectId(session.user.id);
      const updatedComments = comments.map((c) => {
        if (c._id === commentId) {
          const newLikes = isLiked
            ? c.likes.filter((likeId) => likeId.toString() !== userId.toString())
            : [...c.likes, userId];
          return { ...c, likes: newLikes };
        }
        return c;
      });
      setComments(updatedComments);

      const response = await fetch("/api/comments", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          commentId,
          action: isLiked ? "unlike" : "like",
        }),
      });

      if (response.ok) {
        const updatedComment = await response.json();
        console.log("Comment like response:", updatedComment);

        // If this is a like action (not unlike), send a notification to the comment author
        if (!isLiked) {
          try {
            console.log("Sending comment like notification via dedicated API");
            console.log("Comment data:", {
              commentId: commentId,
              postId: post._id,
              communityId: post.communityId,
              currentUser: session.user.id,
            });

            // Send notification to comment author using the dedicated API
            const notificationResponse = await fetch(
              "/api/notifications/post-interaction",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  interactionType: "comment_like",
                  postId: post._id,
                  commentId: commentId,
                  communityId: post.communityId,
                }),
              }
            );

            const notificationResult = await notificationResponse.json();
            console.log(
              "Comment like notification response:",
              notificationResult
            );

            if (notificationResult.success) {
              console.log(
                "Successfully sent like notification to comment author"
              );
            } else {
              console.log(
                "Notification skipped or failed:",
                notificationResult.message || notificationResult.error
              );
            }
          } catch (notificationError) {
            console.error(
              "Error sending comment like notification:",
              notificationError
            );
            // Continue even if notification creation fails
          }
        }

        // Update the comment with the server response to ensure data consistency
        // but only update the specific comment that changed, not reload all comments
        setComments(prevComments => 
          prevComments.map(c => 
            c._id === commentId ? { ...c, likes: updatedComment.likes } : c
          )
        );
      }
    } catch (error) {
      console.error("Error liking comment:", error);
      // If there's an error, revert back to the original state by fetching comments
      fetchComments();
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: post.title,
        text: "Check out this post!",
        url: window.location.href,
      });
    } catch (err) {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (!mounted) {
    return null;
  }

  // Ensure post.content is an array
  const content = Array.isArray(post.content)
    ? post.content
    : typeof post.content === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(post.content);
            return Array.isArray(parsed) ? parsed : [];
          } catch (error) {
            console.error("Error parsing content:", error);
            return []; // Handle parsing errors gracefully
          }
        })()
      : [];

  // Ensure post.authorName exists
  const authorName = post.authorName || "Unknown Author";

  return (
    <>
      {showMessageModal && chatUserId && (
        <MessageModal
          userId={chatUserId}
          onClose={() => setShowMessageModal(false)}
          onMessageSent={() => {}}
        />
      )}
      <Card 
        className="post-card hover:shadow-lg transition-all duration-300 cursor-pointer max-w-4xl w-full mx-auto overflow-visible"
        style={{
          backgroundColor: 'var(--card-bg)',
          color: 'var(--text-primary)',
          borderColor: 'var(--border-color)'
        }}
      >
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4">
              <ProfileAvatar
                imageUrl={post.authorProfileImage} // Changed to authorProfileImage
                name={authorName}
                size="md"
                className="flex-shrink-0"
                showLevelBadge={true}
                userId={post.authorId || post.createdBy.toString()}
                communityId={post.communityId.toString()}
              />
              <div>
                {(() => {
                  if (post.createdBy) {
                    return (
                      <UserHoverCard
                        userId={post.createdBy.toString()}
                        username={authorName}
                        profileImage={post.authorProfileImage}
                        bio={post.authorBio}
                        onChatClick={handleChatClick}
                        communityId={post.communityId.toString()}
                        showGamification={true}
                      >
                        {authorName}
                      </UserHoverCard>
                    );
                  } else {
                    return <p className="font-medium">{authorName}</p>;
                  }
                })()}
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {formatRelativeTime(post.createdAt)}
                </p>
              </div>
            </div>
          </div>
          {post.isPinned && (
            <div className="flex items-center text-primary" title="Pinned post">
              <Pin className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Pinned</span>
            </div>
          )}
        </CardHeader>

        <CardContent
          onClick={() => setIsDialogOpen(true)}
          className="px-4 py-2"
        >
          <div className="flex">
            <div className="w-3/4">
              <h2 className="font-bold text-2xl mb-2">{post.title}</h2>
              <div className="space-y-2">
                {content.map(
                  (item: { type: string; content: string }, index: number) => (
                    <div key={index}>
                      {item?.type === "text" && (
                        <p className="" style={{ color: 'var(--text-secondary)' }}>
                          {item.content
                            .split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g)
                            .map((part, i) => {
                              if (part.match(/^(https?:\/\/|www\.)/)) {
                                const url = normalizeUrl(part);
                                return (
                                  <a
                                    key={i}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline" 
                                    style={{ color: 'var(--brand-primary)' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {part}
                                  </a>
                                );
                              }
                              return part;
                            })}
                        </p>
                      )}
                      {item?.type === "link" && (
                        item.content.startsWith("http") ? (
                          <a
                            href={item.content}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.content}
                          </a>
                        ) : (
                          <Link
                            href={item.content}
                            className="text-blue-500 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.content}
                          </Link>
                        )
                      )}
                      {/* {item?.type === "image" && (
                        <div className="my-3 rounded-lg overflow-hidden">
                          <img 
                            src={isS3Url(item.content) ? convertS3UrlToR2(item.content) : item.content} 
                            alt="Post image" 
                            className="w-full h-auto max-h-96 object-contain"
                          />
                        </div>
                      )} */}
                      {item?.type === "file" && (
                        <a
                          href={item.content}
                          download
                          className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FileText className="h-4 w-4" />
                          Download File
                        </a>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
            <div className="w-1/4 flex justify-center">
              {content.filter(item => item?.type === "image").length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {content
                    .filter(item => item?.type === "image")
                    .slice(0, 1)
                    .map((item, index) => (
                      <img
                        key={index}
                        src={isS3Url(item.content) ? convertS3UrlToR2(item.content) : item.content}
                        alt=""
                        className="w-20 h-20 object-cover rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
                      />
                    ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-2 px-4">
          <div className="flex items-center gap-4 w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleLikePost()}
              className={`flex items-center gap-2 ${
                isLiked ? "text-red-500" : ""
              }`}
            >
              <Heart
                className="h-4 w-4"
                fill={isLiked ? "currentColor" : "none"}
              />
              <span>{localLikeCount}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              <span>{comments.length || 0} Comments</span>
            </Button>
          </div>
        </CardFooter>
      </Card>

  

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-6xl w-[800px] max-h-[80vh] backdrop-filter backdrop-blur-lg bg-opacity-30 bg-white/10 overflow-y-auto p-4">
          <DialogTitle className="sr-only">Post Details</DialogTitle>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <ProfileAvatar
                imageUrl={post.profileImage}
                name={authorName}
                size="md"
                className="flex-shrink-0"
                showLevelBadge={true}
                userId={post.authorId || post.createdBy.toString()}
                communityId={post.communityId.toString()}
              />
              <div>
                {(() => {
                  if (post.createdBy) {
                    return (
                      <UserHoverCard
                        userId={post.createdBy.toString()}
                        username={authorName}
                        profileImage={post.authorProfileImage}
                        bio={post.authorBio}
                        onChatClick={handleChatClick}
                        communityId={post.communityId.toString()}
                        showGamification={true}
                      >
                        {authorName}
                      </UserHoverCard>
                    );
                  } else {
                    return <h3 className="font-semibold">{authorName}</h3>;
                  }
                })()}
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {formatRelativeTime(post.createdAt)}
                </p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {session?.user?.id &&
                post.createdBy.toString() === session.user.id ? (
                  <>
                    <DropdownMenuItem onClick={() => onEdit?.(post._id)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete?.(post._id)}
                      className="text-red-600"
                    >
                      <Trash className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                ) : null}
                {isAdmin && onPin && (
                  <DropdownMenuItem
                    onClick={() => {
                      setIsDialogOpen(false);
                      if (onPin) onPin(post._id, !post.isPinned);
                    }}
                  >
                    {post.isPinned ? (
                      <>
                        <PinOff className="h-4 w-4 mr-2" />
                        Unpin Post
                      </>
                    ) : (
                      <>
                        <Pin className="h-4 w-4 mr-2" />
                        Pin Post
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <h2 className="text-xl font-bold mb-4">{post.title}</h2>
          <div className="space-y-4 mb-6">
            {content.map(
              (item: { type: string; content: string }, index: number) => (
                <div key={index}>
                  {item.type === "text" && (
                    <p className="" style={{ color: 'var(--text-secondary)' }}>
                      {item.content
                        .split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g)
                        .map((part, i) => {
                          if (part.match(/^(https?:\/\/|www\.)/)) {
                            const url = normalizeUrl(part);
                            return (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline"
                              >
                                {part}
                              </a>
                            );
                          }
                          return part;
                        })}
                    </p>
                  )}
                  {item.type === "link" && (
                    <a
                      href={item.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {item.content}
                    </a>
                  )}
                  {item.type === "file" && (
                    <a
                      href={item.content}
                      download
                      className="flex items-center gap-2 text-blue-500 hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      Download File
                    </a>
                  )}
                </div>
              )
            )}
            {content.map(
              (item: { type: string; content: string }, index: number) =>
                item.type === "image" && (
                  <img
                    key={index}
                    src={
                      isS3Url(item.content)
                        ? convertS3UrlToR2(item.content)
                        : item.content
                    }
                    alt=""
                    className="w-40 h-40 object-contain rounded-md"
                  />
                )
            )}
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleLikePost()}
                className="flex items-center gap-2"
                style={isLiked ? { color: 'var(--brand-primary)' } : {}}
              >
                <Heart
                  className="h-4 w-4"
                  fill={isLiked ? "currentColor" : "none"}
                />
                <span>{likesArray.length}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowComments(!showComments)}
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                <span>{comments.length || 0} Comments</span>
              </Button>
            </div>

            {showComments && (
              <div className="mt-4 space-y-4">
                {comments.map((comment) => (
                  <div
                    key={comment._id}
                    className="border rounded-lg p-4" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
                  >
                    <div className="flex flex-col space-y-1">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <ProfileAvatar
                            imageUrl={comment.profileImage}
                            name={comment.authorName}
                            size="sm"
                            showLevelBadge={true}
                            userId={comment.author.toString()}
                            communityId={post.communityId.toString()}
                          />
                          <UserHoverCard
                            userId={comment.author.toString()}
                            username={comment.authorName}
                            profileImage={comment.profileImage}
                            onChatClick={handleChatClick}
                            communityId={post.communityId.toString()}
                            showGamification={true}
                          >
                            <p className="font-semibold text-sm">
                              {comment.authorName} •{" "}
                              <span className="font-normal text-gray-500">
                                {formatRelativeTime(new Date(comment.createdAt))}
                              </span>
                            </p>
                          </UserHoverCard>
                        </div>
                      </div>
                      <p className="text-sm">
                        {comment.text
                          .split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g)
                          .map((part, i) => {
                            if (part.match(/^(https?:\/\/|www\.)/)) {
                              const url = normalizeUrl(part);
                              return (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline"
                                >
                                  {part}
                                </a>
                              );
                            }
                            return part;
                          })}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (session?.user?.id) {
                              const userId = new mongoose.Types.ObjectId(
                                session.user.id
                              );
                              handleLikeComment(
                                comment._id,
                                comment.likes.some(
                                  (likeId) =>
                                    likeId.toString() === userId.toString()
                                )
                              );
                            }
                          }}
                          className={`flex items-center gap-2`}
                          style={
                            session?.user?.id &&
                            comment.likes.some(
                              (likeId) =>
                                likeId.toString() ===
                                new mongoose.Types.ObjectId(
                                  session.user.id
                                ).toString()
                            )
                              ? { color: "var(--brand-primary)" }
                              : {}
                          }
                        >
                          <Heart
                            className="h-4 w-4"
                            fill={
                              session?.user?.id &&
                              comment.likes.some(
                                (likeId) =>
                                  likeId.toString() ===
                                  new mongoose.Types.ObjectId(
                                    session.user.id
                                  ).toString()
                              )
                                ? "currentColor"
                                : "none"
                            }
                          />
                          <span>{comment.likes.length}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setReplyingTo(comment._id)}
                        >
                          Reply
                        </Button>
                      </div>
                      {replyingTo === comment._id && (
                        <div className="mt-2">
                          <div className="relative">
                            <Textarea
                              ref={replyTextareaRef}
                              placeholder="Write a reply..."
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              className="flex-1" style={{ backgroundColor: 'var(--input-bg)' }}
                            />
                            {showReplyEmojiPicker && (
                              <div
                                className="absolute z-10 bottom-0 right-0 mb-16"
                                ref={replyEmojiPickerRef}
                              >
                                <EmojiPicker
                                  onEmojiClick={handleReplyEmojiClick}
                                  width={280}
                                  height={350}
                                  previewConfig={{ showPreview: false }}
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setShowReplyEmojiPicker(!showReplyEmojiPicker)
                              }
                              title="Add emoji"
                              className="flex items-center gap-1"
                            >
                              <Smile className="h-4 w-4" />
                              <span>Emoji</span>
                            </Button>
                            <Button onClick={handleAddComment}>
                              Send Reply
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <div className="space-y-2">
                  <div className="relative">
                    <Textarea
                      ref={commentTextareaRef}
                      placeholder="Write a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="flex-1" style={{ backgroundColor: 'var(--input-bg)' }}
                    />
                    {showEmojiPicker && (
                      <div
                        className="absolute z-10 bottom-0 right-0 mb-16"
                        ref={emojiPickerRef}
                      >
                        <EmojiPicker
                          onEmojiClick={handleEmojiClick}
                          width={280}
                          height={350}
                          previewConfig={{ showPreview: false }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      title="Add emoji"
                      className="flex items-center gap-1"
                    >
                      <Smile className="h-4 w-4" />
                      <span>Emoji</span>
                    </Button>
                    <Button onClick={handleAddComment}>Send</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

