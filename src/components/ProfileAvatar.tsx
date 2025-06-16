"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { addCacheBusting, preloadImage } from "@/utils/crossBrowserImageUtils";
import { convertS3UrlToR2, isR2Url, isS3Url } from "@/utils/s3-to-r2-migration";
import styles from "./ProfileAvatar.module.css";
import LevelBadge from "./gamification/LevelBadge";

// Helper function to get initials from name or email
const getInitials = (name?: string, email?: string): string => {
  if (name && name.trim()) {
    // Get first letter of first name and first letter of last name if available
    const nameParts = name.trim().split(/\s+/);
    if (nameParts.length > 1) {
      return `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(
        0
      )}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  }

  // Fallback to email
  if (email && email.trim()) {
    return email.charAt(0).toUpperCase();
  }

  // Default fallback
  return "?";
};

interface ProfileAvatarProps {
  imageUrl?: string | null;
  name?: string;
  email?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  // Gamification props
  showLevelBadge?: boolean;
  userLevel?: number;
  levelName?: string;
  userId?: string;
  communityId?: string;
}

export default function ProfileAvatar({
  imageUrl,
  name,
  email,
  size = "md",
  className = "",
  showLevelBadge = false,
  userLevel,
  levelName,
  userId,
  communityId,
}: ProfileAvatarProps) {
  // All hooks must be called at the top level, before any conditional returns
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(!!imageUrl);
  const [userProfileData, setUserProfileData] = useState<any>(null);
  const [gamificationData, setGamificationData] = useState<any>(null);

  // For Google images, we need a unique ID - create it unconditionally
  const [avatarId] = useState(`google-avatar-${Date.now()}`);

  // Get the first letter for the fallback
  const firstLetter = name?.charAt(0) || email?.charAt(0) || "?";

  // Size classes from CSS module
  const sizeClasses = {
    sm: styles.avatarSm,
    md: styles.avatarMd,
    lg: styles.avatarLg,
  };

  // If no image URL is provided, try to fetch it from the API
  useEffect(() => {
    if (!imageUrl) {
      const fetchUserProfile = async () => {
        try {
          const response = await fetch("/api/debug/user-profile");
          if (response.ok) {
            const data = await response.json();
            setUserProfileData(data);
          }
        } catch (error) {
          // Silent error handling
        }
      };

      fetchUserProfile();
    }
  }, [imageUrl]);

  // Fetch gamification data if needed
  useEffect(() => {
    if (showLevelBadge && userId && !userLevel) {
      const fetchGamificationData = async () => {
        try {
          const url = `/api/gamification/user/${userId}${communityId ? `?communityId=${communityId}` : ''}`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            setGamificationData(data);
          }
        } catch (error) {
          // Silent error handling
        }
      };

      fetchGamificationData();
    }
  }, [showLevelBadge, userId, userLevel, communityId]);

  // Use the fetched profile image if available
  const effectiveImageUrl =
    imageUrl ||
    userProfileData?.r2ProfileImage ||
    userProfileData?.profileImage;

  // Check if it's a Google profile image - do this before any conditional returns
  const isGoogleImage = effectiveImageUrl?.includes("googleusercontent.com");

  // Check if it's an S3 image - include both amazonaws.com and any custom S3 URL
  const isS3Image = isS3Url(effectiveImageUrl || "");

  // Add a timestamp to force cache refresh
  const timestamp = Date.now();

  // Convert S3 URLs to R2 URLs if needed
  const convertedUrl = isS3Image
    ? convertS3UrlToR2(effectiveImageUrl || "")
    : effectiveImageUrl;

  // Process the image source - avoid cache busting for S3 images to reduce requests
  const processedSrc = convertedUrl
    ? isS3Image
      ? convertedUrl // Don't add cache busting for S3 images
      : addCacheBusting(convertedUrl)
    : "";

  // Silently test if the image is accessible
  useEffect(() => {
    if (effectiveImageUrl) {
      const testImg = document.createElement("img");
      testImg.onload = () => {
        // Image loaded successfully, no need to log
      };
      testImg.onerror = () => {
        // If a Google image fails to load, we could be dealing with an outdated URL
        // Just let the component's error handling take over
      };
      testImg.src = processedSrc;
    }
  }, [effectiveImageUrl, processedSrc]);

  // Preload the image - this hook is now unconditional
  useEffect(() => {
    if (effectiveImageUrl) {
      preloadImage(effectiveImageUrl);
    }
  }, [effectiveImageUrl]);

  // For Google images, add a style tag to the document head
  useEffect(() => {
    // Only proceed if we have a Google image
    if (!isGoogleImage || !effectiveImageUrl) return;

    // Create a style element
    const styleEl = document.createElement("style");
    styleEl.id = avatarId;
    styleEl.innerHTML = `
      .${avatarId} {
        background-image: url(${effectiveImageUrl});
      }
    `;
    document.head.appendChild(styleEl);

    // Clean up when component unmounts
    return () => {
      const el = document.getElementById(avatarId);
      if (el) el.remove();
    };
  }, [effectiveImageUrl, avatarId, isGoogleImage]);

  // Handle image load
  const handleImageLoad = () => {
    setIsLoading(false);
  };

  // Handle image error
  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
  };

  // Get effective level data
  const effectiveLevel = userLevel || gamificationData?.currentLevel?.level;
  const effectiveLevelName = levelName || gamificationData?.currentLevel?.name;

  // Render the fallback avatar with the first letter
  const renderFallback = () => (
    <div className="relative inline-block">
      <div
        className={`${styles.avatar} ${sizeClasses[size]} ${styles.fallback} ${className}`}
      >
        <span className={styles.fallbackText}>{firstLetter.toUpperCase()}</span>
      </div>
      {showLevelBadge && effectiveLevel && (
        <LevelBadge
          level={effectiveLevel}
          levelName={effectiveLevelName}
          size={size === "lg" ? "md" : "sm"}
          position="bottom-right"
        />
      )}
    </div>
  );

  // Wrapper function to add level badge to any avatar
  const wrapWithLevelBadge = (avatarElement: React.ReactNode) => {
    if (!showLevelBadge || !effectiveLevel) {
      return avatarElement;
    }

    return (
      <div className="relative inline-block">
        {avatarElement}
        <LevelBadge
          level={effectiveLevel}
          levelName={effectiveLevelName}
          size={size === "lg" ? "md" : "sm"}
          position="bottom-right"
        />
      </div>
    );
  };

  // If there's no image or there was an error loading it, show fallback
  if ((!effectiveImageUrl && !userProfileData) || imageError) {
    return renderFallback();
  }

  // For Google images, use a simple div with background image
  if (isGoogleImage) {
    return wrapWithLevelBadge(
      <div
        className={`${styles.avatar} ${sizeClasses[size]} ${styles.googleAvatar} ${avatarId} ${className}`}
      />
    );
  }

  // For S3 images, check if it's an R2 URL
  if (isS3Image) {
    // Check if it's an R2 URL
    const isR2Image = processedSrc ? isR2Url(processedSrc) : false;

    if (isR2Image) {
      // Use a regular img tag for R2 images to avoid Next.js Image optimization issues
      return wrapWithLevelBadge(
        <div
          className={`${styles.avatar} ${sizeClasses[size]} ${className} overflow-hidden relative`}
        >
          <img
            src={processedSrc}
            alt={name || "User"}
            className="object-cover w-full h-full"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
          {isLoading && (
            <div className={styles.loading}>
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          )}
        </div>
      );
    } else {
      // Use Next.js Image component for other S3 images
      return wrapWithLevelBadge(
        <div
          className={`${styles.avatar} ${sizeClasses[size]} ${className} overflow-hidden relative`}
        >
          <Image
            src={processedSrc}
            alt={name || "User"}
            fill
            sizes={size === "sm" ? "32px" : size === "md" ? "48px" : "64px"}
            priority={size === "lg"} // Only prioritize large avatars
            className="object-cover"
            onLoad={handleImageLoad}
            onError={(e) => {
              // Fall back to initials on error
              handleImageError();
              // Add a data attribute to mark this as failed
              e.currentTarget.parentElement?.setAttribute(
                "data-image-failed",
                "true"
              );
              // Force a re-render to show initials
              e.currentTarget.parentElement?.classList.add(
                styles.initialsAvatar
              );

              // Add initials text
              const initialsSpan = document.createElement("span");
              initialsSpan.className = styles.initials;
              initialsSpan.textContent = getInitials(name, email);
              e.currentTarget.parentElement?.appendChild(initialsSpan);
            }}
          />
          {isLoading && (
            <div className={styles.loading}>
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          )}
        </div>
      );
    }
  }

  // If we're still loading user profile data, show a loading indicator
  if (!effectiveImageUrl && !imageError) {
    return wrapWithLevelBadge(
      <div
        className={`${styles.avatar} ${sizeClasses[size]} ${styles.fallback} ${className}`}
      >
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      </div>
    );
  }

  // For all other images, use Next.js Image component
  return wrapWithLevelBadge(
    <div
      className={`${styles.avatar} ${sizeClasses[size]} ${className} relative`}
    >
      {isLoading && (
        <div className={styles.loading}>
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        </div>
      )}
      <Image
        src={processedSrc}
        alt={name || "User profile"}
        fill
        sizes={size === "sm" ? "32px" : size === "md" ? "48px" : "64px"}
        className={styles.image}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
    </div>
  );
}
