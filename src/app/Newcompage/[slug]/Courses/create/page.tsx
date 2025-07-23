"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useNotification } from "@/components/Notification";
import CommunityNav from "@/components/communitynav/CommunityNav";
import { ImageIcon, X, Upload, Tag, Plus } from "lucide-react";
import { generateUploadUrl } from "@/lib/r2";

interface FormData {
  title: string;
  description: string;
  thumbnail: string;
  isPublic: boolean;
  tags: string[];
}

export default function CreateCourse() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const { showNotification } = useNotification();

  const [communityId, setCommunityId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    thumbnail: "",
    isPublic: true,
    tags: [],
  });

  useEffect(() => {
    const fetchCommunityDetails = async () => {
      try {
        if (!slug) return;

        const response = await fetch(`/api/community/${slug}`);
        if (!response.ok) {
          throw new Error("Failed to fetch community details");
        }

        const data = await response.json();
        setCommunityId(data._id);

        // Check if user is admin or sub-admin
        if (session?.user?.id) {
          const isUserAdmin = data.admin === session.user.id;
          const isUserSubAdmin = data.subAdmins?.includes(session.user.id);
          setIsAdmin(isUserAdmin || isUserSubAdmin);

          if (!isUserAdmin && !isUserSubAdmin) {
            showNotification(
              "Only admins and sub-admins can create courses",
              "error"
            );
            router.push(`/Newcompage/${slug}/Courses`);
          }
        }
      } catch (error) {
        console.error("Error fetching community details:", error);
        showNotification("Failed to load community details", "error");
      } finally {
        setLoading(false);
      }
    };

    if (slug && session) {
      fetchCommunityDetails();
    }
  }, [slug, session, router, showNotification]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checkbox = e.target as HTMLInputElement;
      setFormData({
        ...formData,
        [name]: checkbox.checked,
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleThumbnailChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingThumbnail(true);

      // Create a local preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setThumbnailPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Get a presigned URL for R2 upload
      const response = await fetch("/api/upload/r2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          courseId: communityId,
          type: "thumbnail",
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
        thumbnail: fileUrl,
      });

      showNotification("Thumbnail uploaded successfully", "success");
    } catch (error) {
      console.error("Error uploading thumbnail:", error);
      showNotification("Failed to upload thumbnail", "error");
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tag),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      showNotification("Course title is required", "error");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch("/api/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          communityId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create course");
      }

      const course = await response.json();

      showNotification("Course created successfully", "success");
      router.push(`/Newcompage/${slug}/Courses/${course._id}`);
    } catch (error) {
      console.error("Error creating course:", error);
      showNotification("Failed to create course", "error");
    } finally {
      setSubmitting(false);
    }
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
          <span>Only admins and sub-admins can create courses</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <CommunityNav />

      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Create New Course</h1>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => router.push(`/Newcompage/${slug}/Courses`)}
          >
            Cancel
          </button>
        </div>

        <div className="card bg-base-100 shadow-md">
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-medium">Course Title*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Enter course title"
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
                  placeholder="Enter course description"
                  className="textarea textarea-bordered h-24"
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-medium">Thumbnail</span>
                </label>
                <div className="flex items-center gap-4">
                  <div className="relative w-32 h-24 bg-gray-100 rounded-md overflow-hidden flex items-center justify-center border border-gray-300">
                    {thumbnailPreview ? (
                      <img
                        src={thumbnailPreview}
                        alt="Course thumbnail preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div aria-label="Thumbnail placeholder">
                        <ImageIcon className="text-gray-400" size={24} />
                      </div>
                    )}
                  </div>

                  <div>
                    <input
                      type="file"
                      id="thumbnail"
                      accept="image/*"
                      className="hidden"
                      onChange={handleThumbnailChange}
                      disabled={uploadingThumbnail}
                    />
                    <label
                      htmlFor="thumbnail"
                      className="btn btn-outline btn-sm"
                    >
                      {uploadingThumbnail ? (
                        <>
                          <span className="loading loading-spinner loading-xs"></span>
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          <span>Upload</span>
                        </>
                      )}
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Recommended: 1280x720px (16:9)
                    </p>
                  </div>
                </div>
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-medium">Tags</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map((tag) => (
                    <div key={tag} className="badge badge-primary gap-1">
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add a tag"
                    className="input input-bordered flex-grow"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleAddTag}
                  >
                    <Plus size={16} />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              <div className="form-control mb-6">
                <label className="label cursor-pointer justify-start gap-2">
                  <input
                    type="checkbox"
                    name="isPublic"
                    checked={formData.isPublic}
                    onChange={handleChange}
                    className="checkbox"
                  />
                  <span className="label-text">
                    Make this course available to all community members
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => router.push(`/Newcompage/${slug}/Courses`)}
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
                    <span>Create Course</span>
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
