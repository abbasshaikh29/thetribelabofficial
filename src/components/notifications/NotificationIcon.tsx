"use client";

import { Bell } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useNotification } from "../Notification";
import NotificationDropdown from "./NotificationDropdown";
import { useRealtime } from "../RealtimeProvider";
import { listenForRealtimeEvents } from "@/lib/realtime";

export default function NotificationIcon() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { data: session } = useSession();
  const { showNotification } = useNotification();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isEnabled } = useRealtime();

  // Function to fetch unread notification count
  const fetchUnreadCount = async () => {
    if (!session?.user?.id) return;

    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        "/api/notifications?unread=true", // Use new endpoint
        {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.length); // API returns an array, count its length
      } else {
        console.warn("Failed to fetch notifications:", response.status);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn("Notification fetch request timed out");
      } else {
        console.error("Error fetching unread notifications count:", error);
      }
    }
  };

  // Set up fetching of unread counts
  useEffect(() => {
    if (!session?.user?.id) return;

    // Initial fetch
    fetchUnreadCount();

    // Set up interval to check for new notifications
    const intervalId = setInterval(() => {
      try {
        fetchUnreadCount();
      } catch (error) {
        console.error("Error in notification interval:", error);
      }
    }, 60000); // Check every 60 seconds (reduced from 30 seconds since we have real-time updates)

    return () => {
      clearInterval(intervalId);
    };
  }, [session?.user?.id]);

  // Set up real-time notification listener
  useEffect(() => {
    if (!isEnabled || !session?.user?.id) {
      return;
    }

    let cleanupFunction: (() => void) | null = null;

    try {
      // Listen for new notifications
      cleanupFunction = listenForRealtimeEvents(
        "notification-created",
        (data: any) => {
          try {
            // Only process if it's for this user
            if (data?.userId === session?.user?.id) {
              // Increment the unread count
              setUnreadCount((prevCount) => prevCount + 1);

              // Show a toast notification
              if (data?.notification?.title) {
                showNotification(
                  `New notification: ${data.notification.title}`,
                  "info"
                );
              }

              // Refresh the notification count to ensure accuracy
              // Use a small delay to prevent rapid successive calls
              setTimeout(() => {
                fetchUnreadCount();
              }, 500);
            }
          } catch (error) {
            console.error("Error processing realtime notification:", error);
          }
        }
      );
    } catch (error) {
      console.error("Error setting up realtime listener:", error);
    }

    return () => {
      if (cleanupFunction) {
        try {
          cleanupFunction();
        } catch (error) {
          console.error("Error cleaning up realtime listener:", error);
        }
      }
    };
  }, [isEnabled, session?.user?.id, showNotification]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    try {
      if (!session) {
        showNotification("Please sign in to view notifications", "info");
        return;
      }
      setIsOpen(!isOpen);
    } catch (error) {
      console.error("Error toggling notification dropdown:", error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={toggleDropdown}
        className="btn btn-ghost btn-circle relative"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-primary text-primary-content rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </div>
        )}
      </button>

      {isOpen && (
        <NotificationDropdown
          onClose={() => setIsOpen(false)}
          onMarkAllRead={fetchUnreadCount}
          onViewAll={() => {
            setIsOpen(false);
            window.location.href = "/notifications/feed";
          }}
        />
      )}
    </div>
  );
}
