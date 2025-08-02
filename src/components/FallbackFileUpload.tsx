"use client";

import { useState, useRef } from "react";
import { Loader2, Upload } from "lucide-react";

interface FallbackFileUploadProps {
  onSuccess: (response: { url: string; key: string; fileName: string; fileType: string }) => void;
  onProgress?: (progress: number) => void;
  fileType?: "image" | "video" | "document";
  uploadType?: string;
}

export default function FallbackFileUpload({
  onSuccess,
  onProgress,
  fileType = "image",
  uploadType = "profile",
}: FallbackFileUploadProps) {
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

      // Convert file to base64
      const base64Data = await fileToBase64(file);
      
      setProgress(50); // Halfway through conversion
      if (onProgress) onProgress(50);

      // Upload using base64 method
      const response = await fetch("/api/upload/base64", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileData: base64Data,
          fileName: file.name,
          fileType: file.type,
          uploadType,
        }),
      });

      setProgress(90);
      if (onProgress) onProgress(90);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const result = await response.json();
      
      setProgress(100);
      if (onProgress) onProgress(100);

      // Call success callback
      onSuccess({
        url: result.url,
        key: result.key,
        fileName: result.fileName,
        fileType: result.fileType,
      });

      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setUploading(false);
    } catch (err) {
      console.error("Error in fallback upload:", err);
      setUploading(false);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const validateFile = (file: File): boolean => {
    // File type validation
    if (fileType === "image") {
      const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!validTypes.includes(file.type)) {
        setError("Please upload a valid image file (JPEG, PNG, WebP, or GIF)");
        return false;
      }
      // Size validation (5MB for images)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB");
        return false;
      }
    }

    return true;
  };

  return (
    <div className="space-y-2">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
        <div className="flex items-center text-sm text-blue-700">
          <Upload className="w-4 h-4 mr-2" />
          <span className="font-medium">Fallback Upload Method</span>
        </div>
        <p className="text-xs text-blue-600 mt-1">
          Using local storage as backup for cloud storage issues
        </p>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={
          fileType === "image"
            ? "image/jpeg,image/png,image/webp,image/gif"
            : fileType === "video"
              ? "video/*"
              : "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
        className="file-input file-input-bordered w-full"
        disabled={uploading}
        aria-label="Upload file using fallback method"
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
