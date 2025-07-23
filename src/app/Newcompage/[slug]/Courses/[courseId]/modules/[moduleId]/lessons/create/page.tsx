"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useNotification } from "@/components/Notification";
import CommunityNav from "@/components/communitynav/CommunityNav";
import { Calendar, Clock, Upload, X, FileText, Plus } from "lucide-react";

interface FormData {
  title: string;
  description: string;
  content: string;
  videoUrl: string;
  attachments: {
    name: string;
    url: string;
    type: string;
    size?: number;
  }[];
  duration: number;
  releaseDate: string;
}

export default function CreateLesson() {
  const { slug, courseId, moduleId } = useParams<{
    slug: string;
    courseId: string;
    moduleId: string;
  }>();
  const router = useRouter();
  const { data: session } = useSession();
  const { showNotification } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [course, setCourse] = useState<any>(null);
  const [module, setModule] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    content: "",
    videoUrl: "",
    attachments: [],
    duration: 0,
    releaseDate: "",
  });

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        if (!courseId || !moduleId) return;

        // Fetch course details
        const courseResponse = await fetch(`/api/courses/${courseId}`);
        if (!courseResponse.ok) {
          throw new Error("Failed to fetch course details");
        }
        const courseData = await courseResponse.json();
        setCourse(courseData.course);

        // Fetch module details
        const moduleResponse = await fetch(`/api/modules/${moduleId}`);
        if (!moduleResponse.ok) {
          throw new Error("Failed to fetch module details");
        }
        const moduleData = await moduleResponse.json();
        setModule(moduleData.module);

        // Check if user is admin or creator
        if (session?.user?.id) {
          const communityResponse = await fetch(`/api/community/${slug}`);
          if (communityResponse.ok) {
            const communityData = await communityResponse.json();
            const isUserAdmin = communityData.admin === session.user.id;
            const isUserSubAdmin = communityData.subAdmins?.includes(
              session.user.id
            );
            const isCreator = courseData.course.createdBy === session.user.id;

            const hasPermission = isUserAdmin || isUserSubAdmin || isCreator;
            setIsAdmin(hasPermission);

            if (!hasPermission) {
              showNotification(
                "You don't have permission to create lessons",
                "error"
              );
              router.push(`/Newcompage/${slug}/Courses/${courseId}`);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching details:", error);
        showNotification("Failed to load course and module details", "error");
      } finally {
        setLoading(false);
      }
    };

    if (courseId && moduleId && session) {
      fetchDetails();
    }
  }, [courseId, moduleId, slug, session, router, showNotification]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;

    if (type === "number") {
      setFormData({
        ...formData,
        [name]: parseInt(value) || 0,
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingVideo(true);

      // Get a presigned URL for S3 upload
      const response = await fetch("/api/upload/r2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          courseId,
          moduleId,
          type: "course",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadUrl, fileUrl } = await response.json();

      // Upload the file to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      // Update form data with the file URL
      setFormData({
        ...formData,
        videoUrl: fileUrl,
      });

      showNotification("Video uploaded successfully", "success");
    } catch (error) {
      console.error("Error uploading video:", error);
      showNotification("Failed to upload video", "error");
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingFile(true);

      // Get a presigned URL for S3 upload
      const response = await fetch("/api/upload/r2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          courseId,
          moduleId,
          type: "course",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadUrl, fileUrl } = await response.json();

      // Upload the file to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      // Add the file to attachments
      const newAttachment = {
        name: file.name,
        url: fileUrl,
        type: file.type,
        size: file.size,
      };

      setFormData({
        ...formData,
        attachments: [...formData.attachments, newAttachment],
      });

      showNotification("File uploaded successfully", "success");

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      showNotification("Failed to upload file", "error");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    const newAttachments = [...formData.attachments];
    newAttachments.splice(index, 1);

    setFormData({
      ...formData,
      attachments: newAttachments,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      showNotification("Lesson title is required", "error");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch("/api/lessons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          courseId,
          moduleId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create lesson");
      }

      const lesson = await response.json();

      showNotification("Lesson created successfully", "success");
      router.push(`/Newcompage/${slug}/Courses/${courseId}`);
    } catch (error) {
      console.error("Error creating lesson:", error);
      showNotification("Failed to create lesson", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";

    if (bytes < 1024) return bytes + " bytes";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (loading) {
    return (
      <div>
        <CommunityNav />
        <div className="flex justify-center items-center py-20">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div>
        <CommunityNav />
        <div className="alert alert-error max-w-md mx-auto m-4">
          <span>You don't have permission to create lessons</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <CommunityNav />

      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Add Lesson</h1>
            <p className="text-gray-500">
              {course?.title} &gt; {module?.title}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() =>
              router.push(`/Newcompage/${slug}/Courses/${courseId}`)
            }
          >
            Cancel
          </button>
        </div>

        <div className="card bg-base-100 shadow-md">
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-medium">Lesson Title*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Enter lesson title"
                  className="input input-bordered w-full"
                  required
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-medium">Description</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter lesson description"
                  className="textarea textarea-bordered h-24"
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-medium">Video</span>
                </label>
                <div className="flex flex-col gap-2">
                  {formData.videoUrl ? (
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-9 bg-gray-200 rounded flex items-center justify-center">
                          <FileText size={20} className="text-gray-500" />
                        </div>
                        <div>
                          <div className="font-medium">Video uploaded</div>
                          <div className="text-xs text-gray-500">
                            {formData.videoUrl.split("/").pop()}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() =>
                          setFormData({ ...formData, videoUrl: "" })
                        }
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        id="video"
                        accept="video/*"
                        className="hidden"
                        onChange={handleVideoUpload}
                        disabled={uploadingVideo}
                      />
                      <label htmlFor="video" className="btn btn-outline w-full">
                        {uploadingVideo ? (
                          <>
                            <span className="loading loading-spinner loading-sm"></span>
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={16} />
                            <span>Upload Video</span>
                          </>
                        )}
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        Upload MP4, WebM, or other video formats
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-medium">Content</span>
                </label>
                <textarea
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  placeholder="Enter lesson content (HTML supported)"
                  className="textarea textarea-bordered h-40 font-mono"
                />
                <label className="label">
                  <span className="label-text-alt">
                    HTML formatting is supported
                  </span>
                </label>
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-medium">Attachments</span>
                </label>
                <div className="space-y-2">
                  {formData.attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText size={20} className="text-primary" />
                        <div>
                          <div className="font-medium">{attachment.name}</div>
                          <div className="text-xs text-gray-500">
                            {attachment.type.split("/")[1].toUpperCase()}{" "}
                            {formatFileSize(attachment.size)}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleRemoveAttachment(index)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}

                  <div>
                    <input
                      type="file"
                      id="attachment"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                    />
                    <label
                      htmlFor="attachment"
                      className="btn btn-outline w-full"
                    >
                      {uploadingFile ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Plus size={16} />
                          <span>Add Attachment</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">
                      Duration (minutes)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="duration"
                      value={formData.duration || ""}
                      onChange={handleChange}
                      placeholder="0"
                      min="0"
                      className="input input-bordered w-full pl-10"
                    />
                    <Clock
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      size={18}
                    />
                  </div>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">
                      Release Date (Optional)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      name="releaseDate"
                      value={formData.releaseDate}
                      onChange={handleChange}
                      className="input input-bordered w-full pl-10"
                    />
                    <Calendar
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      size={18}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() =>
                    router.push(`/Newcompage/${slug}/Courses/${courseId}`)
                  }
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !formData.title.trim()}
                >
                  {submitting ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Lesson</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
