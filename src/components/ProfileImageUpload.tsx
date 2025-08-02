"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useNotification } from "@/components/Notification";
import DirectFileUpload from "./DirectFileUpload"; // Use the new DirectFileUpload component
import FallbackFileUpload from "./FallbackFileUpload"; // Fallback upload method
import UploadServiceNotice from "./UploadServiceNotice";
import { convertS3UrlToR2, isS3Url } from "@/utils/s3-to-r2-migration";

interface ProfileImageUploadProps {
  currentImage?: string;
  onImageUpdated?: (imageUrl: string) => void;
}

export default function ProfileImageUpload({
  currentImage,
  onImageUpdated,
}: ProfileImageUploadProps) {
  const { data: session, update: updateSession } = useSession();
  const [profileImage, setProfileImage] = useState<string>(currentImage || "");
  const [isUploading, setIsUploading] = useState(false);
  const [showServiceNotice, setShowServiceNotice] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const { showNotification } = useNotification();

  useEffect(() => {
    if (currentImage) {
      // Convert S3 URLs to R2 URLs if needed
      const processedImage = isS3Url(currentImage)
        ? convertS3UrlToR2(currentImage)
        : currentImage;
      setProfileImage(processedImage);
    } else if (session?.user?.profileImage) {
      // Convert S3 URLs to R2 URLs if needed
      const processedImage = isS3Url(session.user.profileImage)
        ? convertS3UrlToR2(session.user.profileImage)
        : session.user.profileImage;
      setProfileImage(processedImage);
    }
  }, [currentImage, session?.user?.profileImage]);

  const handleImageUploadSuccess = async (response: any) => {
    if (!response.url) {
      showNotification("Failed to get image URL from upload", "error");
      return;
    }

    setIsUploading(true);
    try {
      // Update the profile image URL in the database
      const updateResponse = await fetch("/api/user/profile-image", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profileImage: response.url }),
      });

      if (!updateResponse.ok) {
        throw new Error("Failed to update profile image");
      }

      const result = await updateResponse.json();

      // Update local state
      setProfileImage(response.url);

      // Update session
      if (session && updateSession) {
        try {
          // Update the session without forcing a reload
          await updateSession({
            ...session,
            user: {
              ...session.user,
              profileImage: response.url,
            },
          });

          // No forced reload - let the natural session update mechanism work
        } catch (error) {
          // Silently handle error
        }
      }

      // Call the callback if provided
      if (onImageUpdated) {
        onImageUpdated(response.url);
      }

      showNotification("Profile image updated successfully", "success");
    } catch (error) {
      console.error("Profile image upload error:", error);

      // Provide more specific error messages
      let errorMessage = "Failed to update profile image";

      if (error instanceof Error) {
        if (error.message.includes("EPROTO") || error.message.includes("SSL") || error.message.includes("handshake") || error.message.includes("503")) {
          errorMessage = "Upload service temporarily unavailable. Please try again later or contact support.";
          setShowServiceNotice(true); // Show the detailed service notice
        } else if (error.message.includes("Network")) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes("Unauthorized")) {
          errorMessage = "Authentication error. Please refresh the page and try again.";
        } else {
          errorMessage = error.message;
        }
      }

      showNotification(errorMessage, "error");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {showServiceNotice && (
        <UploadServiceNotice
          onRetry={() => setShowServiceNotice(false)}
          showRetry={true}
        />
      )}

      {profileImage && (
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary">
            <img
              src={profileImage}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {!useFallback ? (
        <DirectFileUpload
          onSuccess={handleImageUploadSuccess}
          fileType="image"
          uploadType="profile"
        />
      ) : (
        <FallbackFileUpload
          onSuccess={handleImageUploadSuccess}
          fileType="image"
          uploadType="profile"
        />
      )}

      <div className="flex flex-col items-center space-y-2">
        <p className="text-xs text-gray-500 text-center">
          Upload a square image for best results. Maximum size: 5MB.
        </p>

        {!useFallback && (
          <button
            type="button"
            onClick={() => setUseFallback(true)}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Having trouble? Try fallback upload method
          </button>
        )}

        {useFallback && (
          <button
            type="button"
            onClick={() => setUseFallback(false)}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Switch back to cloud upload
          </button>
        )}
      </div>

      {/* Manual refresh button */}
      <div className="flex justify-center mt-2">
        <button
          type="button"
          className="btn btn-xs btn-outline"
          onClick={async () => {
            if (updateSession) {
              try {
                await updateSession();
                // Show a small indicator that the session was refreshed
                const indicator = document.createElement("div");
                indicator.textContent = "✓ Session refreshed";
                indicator.className = "text-xs text-success text-center mt-1";
                const parent = document.querySelector(".space-y-4");
                if (parent) {
                  parent.appendChild(indicator);
                  setTimeout(() => {
                    parent.removeChild(indicator);
                  }, 2000);
                }
              } catch (error) {
                // Silently handle error
              }
            }
          }}
        >
          Refresh Session
        </button>
      </div>
    </div>
  );
}
