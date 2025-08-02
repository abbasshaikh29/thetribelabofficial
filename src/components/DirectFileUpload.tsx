"use client";

import { useState, useRef } from "react";
import { Loader2, Upload } from "lucide-react";

interface DirectFileUploadProps {
  onSuccess: (response: {
    url: string;
    key: string;
    fileName: string;
    fileType: string;
  }) => void;
  onProgress?: (progress: number) => void;
  fileType?: "image" | "video" | "document";
  uploadType?: "profile" | "community" | "community-banner" | "community-icon";
  entityId?: string; // Community ID, course ID, etc.
}

export default function DirectFileUpload({
  onSuccess,
  onProgress,
  fileType = "image",
  uploadType = "profile",
  entityId,
}: DirectFileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!validateFile(file)) return;

    try {
      setUploading(true);
      setError(null);
      setProgress(0);

      // Create form data
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", uploadType);
      if (entityId) {
        formData.append("communityId", entityId);
      }

      // Upload directly to server
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload/r2-direct");

      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round(
            (event.loaded / event.total) * 100
          );
          setProgress(percentComplete);
          if (onProgress) {
            onProgress(percentComplete);
          }
        }
      };

      // Handle completion
      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          console.log("Upload successful:", response);
          setUploading(false);

          // Call the success callback with the file URL and metadata
          onSuccess({
            url: response.url,
            key: response.key,
            fileName: response.fileName,
            fileType: response.fileType,
          });

          // Reset the file input
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        } else {
          console.error("Upload failed with status:", xhr.status);
          let errorMessage = "Upload failed";

          try {
            const errorResponse = JSON.parse(xhr.responseText);
            errorMessage = errorResponse.error || errorMessage;
            console.error("Error details:", errorResponse);

            // Provide more user-friendly error messages
            if (errorResponse.message && errorResponse.message.includes("EPROTO")) {
              errorMessage = "Upload service temporarily unavailable. Please try again later.";
            }
          } catch (e) {
            console.error("Could not parse error response:", xhr.responseText);
          }

          setUploading(false);
          setError(errorMessage);
        }
      };

      // Handle errors
      xhr.onerror = (e) => {
        console.error("Upload network error:", e);
        setUploading(false);
        setError("Upload failed due to a network error. The upload service may be temporarily unavailable.");
      };

      // Send the form data
      xhr.send(formData);
    } catch (err) {
      console.error("Error in upload:", err);
      setUploading(false);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    }
  };

  const validateFile = (file: File): boolean => {
    // File type validation
    if (fileType === "image") {
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        setError("Please upload a valid image file (JPEG, PNG, or WebP)");
        return false;
      }
      // Size validation (5MB for images)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB");
        return false;
      }
    } else if (fileType === "video") {
      if (!file.type.startsWith("video/")) {
        setError("Please upload a valid video file");
        return false;
      }
      // Size validation (100MB for videos)
      if (file.size > 100 * 1024 * 1024) {
        setError("Video size must be less than 100MB");
        return false;
      }
    } else if (fileType === "document") {
      const validTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!validTypes.includes(file.type)) {
        setError("Please upload a valid document (PDF, DOC, DOCX)");
        return false;
      }
      // Size validation (10MB for documents)
      if (file.size > 10 * 1024 * 1024) {
        setError("Document size must be less than 10MB");
        return false;
      }
    }

    return true;
  };

  return (
    <div className="space-y-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={
          fileType === "image"
            ? "image/jpeg,image/png,image/webp"
            : fileType === "video"
              ? "video/*"
              : "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
        className="file-input file-input-bordered w-full"
        disabled={uploading}
        aria-label="Upload file"
      />

      {uploading && (
        <div>
          <div className="flex items-center gap-2 text-sm text-primary mb-1">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Uploading... {progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && <div className="text-error text-sm">{error}</div>}
    </div>
  );
}
