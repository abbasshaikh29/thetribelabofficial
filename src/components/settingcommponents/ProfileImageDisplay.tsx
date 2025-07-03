"use client";

import React from "react";
import { convertS3UrlToR2, isS3Url, isR2Url } from "@/utils/s3-to-r2-migration";

// Helper to sanitize image URLs to prevent XSS
function sanitizeImgUrl(url?: string): string {
  if (!url || typeof url !== "string") return "/default-avatar.png";
  url = url.trim();
  // Only allow http, https, or relative URLs
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("/")
  ) {
    return url;
  }
  // Fallback to a safe default
  return "/default-avatar.png";
}

interface ProfileImageDisplayProps {
  imageUrl?: string;
  username?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const ProfileImageDisplay: React.FC<ProfileImageDisplayProps> = ({
  imageUrl,
  username = "",
  size = "md",
  className = "",
}) => {
  // Convert S3 URLs to R2 URLs if needed
  let processedImageUrl =
    imageUrl && isS3Url(imageUrl) ? convertS3UrlToR2(imageUrl) : imageUrl;

  // Sanitize the URL to prevent XSS
  processedImageUrl = sanitizeImgUrl(processedImageUrl);

  // Check if it's an R2 URL
  const isR2Image = imageUrl ? isR2Url(imageUrl) : false;

  // Size classes
  const sizeClasses = {
    sm: "w-24 h-24",
    md: "w-32 h-32",
    lg: "w-40 h-40",
  };

  // Get the first letter for the fallback
  const firstLetter = username ? username.charAt(0).toUpperCase() : "?";

  console.log(
    "[ProfileImageDisplay] Rendering image with URL:",
    processedImageUrl
  );

  // Add more detailed logging
  console.log("[ProfileImageDisplay] Original URL:", imageUrl);
  console.log("[ProfileImageDisplay] Is S3 URL:", isS3Url(imageUrl || ""));
  console.log(
    "[ProfileImageDisplay] Is R2 URL:",
    isR2Url(processedImageUrl || "")
  );
  console.log("[ProfileImageDisplay] Using regular img tag:", isR2Image);

  return (
    <div
      className={`rounded-full overflow-hidden bg-primary/10 ${sizeClasses[size]} ${className}`}
    >
      {processedImageUrl ? (
        // Always use a regular img tag for profile images to avoid Next.js Image optimization issues
        <img
          src={processedImageUrl}
          alt={username || "User profile"}
          className="object-cover w-full h-full"
          crossOrigin="anonymous"
          onError={(e) => {
            console.error(
              "[ProfileImageDisplay] Image failed to load:",
              processedImageUrl
            );
            // Set a data attribute to mark this as failed
            e.currentTarget.parentElement?.setAttribute(
              "data-image-failed",
              "true"
            );
            // Hide the broken image
            e.currentTarget.style.display = "none";
            // Show a fallback element
            const fallback = document.createElement("div");
            fallback.className =
              "w-full h-full flex items-center justify-center bg-primary text-primary-content";
            fallback.innerHTML = `<span class="text-3xl font-bold">${firstLetter}</span>`;
            e.currentTarget.parentElement?.appendChild(fallback);
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-primary text-primary-content">
          <span className="text-3xl font-bold">{firstLetter}</span>
        </div>
      )}
    </div>
  );
};

export default ProfileImageDisplay;
