"use client";

import { Loader2 } from "lucide-react";
import { formatRelativeTime } from "@/lib/date-utils";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useNotification } from "../Notification";
import ProfileAvatar from "../ProfileAvatar";

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  content: string;
  sourceId: string;
  sourceType: string;
  communityId: {
    _id: string;
    name: string;
    slug: string;
    iconImageUrl?: string;
  };
  read: boolean;
  createdAt: string;
  createdBy: {
    _id: string;
    username: string;
    profileImage?: string;
  };
}

interface NotificationListProps {
  notifications: NotificationItem[];
  loading: boolean;
  onClose: () => void;
  onMarkAllRead: () => void;
}

export default function NotificationList({
  notifications,
  loading,
  onClose,
  onMarkAllRead,
}: NotificationListProps) {
  const { data: session } = useSession();
  const { showNotification } = useNotification();

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>No notifications yet</p>
        <p className="text-sm mt-1">You'll be notified when there's activity</p>
      </div>
    );
  }

  const markAsRead = async (notificationId: string) => {
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for individual notifications

      const response = await fetch("/api/notifications/user", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationIds: [notificationId] }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        // Update the unread count
        onMarkAllRead();
      } else {
        console.warn("Failed to mark notification as read:", response.status);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn("Mark as read request timed out for notification:", notificationId);
      } else {
        console.error("Error marking notification as read:", error);
      }
    }
  };

  const getNotificationLink = (notification: NotificationItem) => {
    if (notification.sourceType === "post") {
      return `/Newcompage/${notification.communityId.slug}?postId=${notification.sourceId}`;
    }
    // For join request notifications, direct to the admin panel with the join requests tab
    if (notification.type === "follow" && notification.sourceType === "user") {
      return `/profile/${notification.sourceId}`; // Link to the follower's profile
    }
    if (notification.type === "join-request") {
      return `/Newcompage/${notification.communityId.slug}/communitysetting?t=AdminPanel`;
    }
    return `/Newcompage/${notification.communityId.slug}`;
  };

  return (
    <div className="overflow-y-auto max-h-[70vh]">
      {notifications.map((notification) => {
        const notificationLink = getNotificationLink(notification);
        
        return (
          <Link
            key={notification._id}
            href={notificationLink}
            onClick={() => {
              if (!notification.read) {
                markAsRead(notification._id);
              }
              onClose();
            }}
          >
            <div 
              className={`flex items-start p-3 hover:bg-base-200 cursor-pointer border-b border-base-200 ${
                !notification.read ? "bg-base-200/50" : ""
              }`}
            >
              <div className="avatar mr-3 mt-1">
                <div className="w-10 h-10 rounded-full">
                  {notification.createdBy?.profileImage ? (
                    <img
                      src={notification.createdBy.profileImage}
                      alt={notification.createdBy.username}
                      className="object-cover w-full h-full rounded-full"
                    />
                  ) : (
                    <div className="bg-primary text-primary-content flex items-center justify-center w-full h-full rounded-full">
                      {notification.createdBy?.username?.charAt(0).toUpperCase() || "U"}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium truncate">
                    {notification.title}
                  </h4>
                  {notification.createdAt && (
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                      {formatRelativeTime(new Date(notification.createdAt))}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {notification.content}
                </p>
                {notification.communityId && (
                  <div className="flex items-center mt-1 text-xs text-gray-500">
                    <span className="flex items-center">
                      {notification.communityId.iconImageUrl ? (
                        <img 
                          src={notification.communityId.iconImageUrl} 
                          alt={notification.communityId.name}
                          className="w-3 h-3 rounded-full mr-1"
                        />
                      ) : null}
                      {notification.communityId.name}
                    </span>
                  </div>
                )}
              </div>
              {!notification.read && (
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
