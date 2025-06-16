"use client";

import { Link, FileText, X, Smile, Bell } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { parseTextWithLinks } from "@/lib/url-utils";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import S3FileUpload from "@/components/S3FileUpload";
// Using native HTML dialog for better compatibility

interface PostContent {
  type: "text" | "image" | "link" | "file";
  content: string;
}

interface CreatePostProps {
  communitySlug: string;
  authorId: string;
  onPostCreated?: (newPost: any) => void;
  isAdmin?: boolean;
}

interface CreatePostModalProps {
  communitySlug: string;
  authorId: string;
  onPostCreated?: (newPost: any) => void;
  isAdmin?: boolean;
}

// CreatePost component with modal functionality
export function CreatePost({
  communitySlug,
  onPostCreated,
  isAdmin = false,
}: CreatePostProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [contents, setContents] = useState<PostContent[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [notifyMembers, setNotifyMembers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setContents([]);
      setCurrentInput("");
      setShowEmojiPicker(false);
      setNotifyMembers(false);
      setSubmitError(null);
    }
  }, [isOpen]);

  // Handle modal open/close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  const handleFileUpload = (file: File, type: "image" | "file") => {
    if (type === "file") {
      // For non-image files, continue using the old method
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setContents([
            ...contents,
            {
              type,
              content: e.target.result as string,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    } else {
      // For images, we'll use S3 upload instead via the button
      // This is handled separately
    }
  };

  const handleS3ImageUploadSuccess = (response: any) => {
    if (response.url) {
      setContents([
        ...contents,
        {
          type: "image",
          content: response.url,
        },
      ]);
    }
  };

  const handleRemoveContent = (index: number) => {
    setContents(contents.filter((_, i) => i !== index));
  };

  // Handle emoji selection
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    const textarea = textareaRef.current;

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText =
        currentInput.substring(0, start) + emoji + currentInput.substring(end);
      setCurrentInput(newText);

      // Set cursor position after the inserted emoji
      setTimeout(() => {
        textarea.selectionStart = start + emoji.length;
        textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    } else {
      setCurrentInput(currentInput + emoji);
    }

    // Keep emoji picker open for multiple selections
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const finalContents: PostContent[] = [...contents];

    // Add current text input if it exists
    if (currentInput.trim()) {
      // Parse text for URLs and convert them to clickable links
      const parsedContent = parseTextWithLinks(currentInput);
      // Type assertion to ensure compatibility
      finalContents.push(...(parsedContent as PostContent[]));
    }

    try {
      console.log("Creating new post...");
      const response = await fetch("/api/community/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title,
          content: JSON.stringify(finalContents),
          communitySlug: communitySlug,
          notifyMembers: notifyMembers,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create post");
      }

      const newPost = await response.json();
      console.log("Post created successfully:", newPost);

      // Format the post data to match the expected format in the UI
      const formattedPost = {
        ...newPost,
        _id: newPost._id.toString(),
        createdAt: new Date().toISOString(),
        likes: newPost.likes || [],
        content: finalContents,
      };

      // Call the onPostCreated callback with the formatted post
      if (onPostCreated) {
        onPostCreated(formattedPost);
      }

      // If notify members is enabled, create notifications
      if (notifyMembers) {
        try {
          await fetch("/api/notifications/create", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "post",
              title: "New post in your community",
              content: title,
              sourceId: newPost._id,
              sourceType: "post",
              communityId: newPost.communityId,
            }),
          });
        } catch (notificationError) {
          console.error("Error creating notifications:", notificationError);
          // Continue even if notification creation fails
        }
      }

      // Clear the form and close modal
      setTitle("");
      setContents([]);
      setCurrentInput("");
      setIsOpen(false);
    } catch (error: any) {
      console.error("Error creating post:", error.message);
      setSubmitError(error.message || "Failed to create post");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <div
        className="rounded-xl w-full p-4 sm:p-6 cursor-pointer transition-all duration-300"
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--shadow-md)',
          transition: 'var(--theme-transition)'
        }}
        onClick={openModal}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        }}
      >
        <div className="text-sm sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center" style={{ color: 'var(--text-primary)' }}>
          <span className="bg-gradient-to-r from-amber-400 to-amber-600 text-white p-1 rounded-md mr-2 text-xs">
            ✏️
          </span>
          whats on your mind?
        </div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Click to create a new post...</div>
      </div>

      {/* Native HTML Dialog Modal */}
      <dialog
        ref={dialogRef}
        className="bg-transparent p-0 max-w-[600px] w-full max-h-[80vh] rounded-lg"
        style={{
          backdropFilter: 'blur(4px)',
        }}
        onClick={(e) => {
          // Close modal when clicking on backdrop
          if (e.target === dialogRef.current) {
            closeModal();
          }
        }}
      >
        {/* Modal backdrop overlay */}
        <div
          className="fixed inset-0 transition-opacity duration-300"
          style={{ backgroundColor: 'var(--modal-overlay)' }}
        />

        <div
          className="relative rounded-lg max-h-[80vh] overflow-y-auto transition-all duration-300"
          style={{
            backgroundColor: 'var(--modal-bg)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-xl)'
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-4 transition-colors duration-300"
            style={{ borderBottom: '1px solid var(--border-color)' }}
          >
            <h2 className="text-lg font-semibold flex items-center" style={{ color: 'var(--text-primary)' }}>
              <span className="bg-gradient-to-r from-amber-400 to-amber-600 text-white p-1 rounded-md mr-2 text-xs">
                ✏️
              </span>
              Create a Post
            </h2>
            <button
              onClick={closeModal}
              className="p-1 rounded-full transition-all duration-200"
              style={{
                color: 'var(--text-secondary)',
                transition: 'var(--theme-transition)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-2 sm:space-y-4">
          <input
            type="text"
            placeholder="Post title"
            value={title}
            className="w-full px-4 py-2 text-sm sm:text-base rounded-lg focus:outline-none transition-all duration-200"
            style={{
              backgroundColor: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              color: 'var(--text-primary)',
              transition: 'var(--theme-transition)'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--input-focus)';
              e.target.style.boxShadow = 'var(--focus-ring)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--input-border)';
              e.target.style.boxShadow = 'none';
            }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setTitle(e.target.value)
            }
          />
          <label htmlFor="imageInput" className="hidden">
            Image Input
          </label>
          <input
            id="imageInput"
            type="file"
            ref={imageInputRef}
            className="hidden"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file, "image");
            }}
          />
          <label htmlFor="fileInput" className="hidden">
            File Input
          </label>
          <input
            id="fileInput"
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file, "file");
            }}
          />

          {contents.map((content, index) => (
            <div
              key={index}
              className="flex items-center gap-1 sm:gap-2 p-2 sm:p-3 rounded-lg text-xs sm:text-sm transition-colors duration-200"
              style={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                boxShadow: 'var(--shadow-sm)',
                color: 'var(--text-primary)'
              }}
            >
              {content.type === "image" ? (
                <div className="relative w-full">
                  <Image
                    src={content.content}
                    alt=""
                    width={500}
                    height={300}
                    className="max-h-40 sm:max-h-60 object-contain mx-auto"
                  />
                </div>
              ) : content.type === "link" ? (
                <>
                  <Link className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="flex-1">{content.content}</span>
                </>
              ) : content.type === "file" ? (
                <>
                  <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="flex-1">File uploaded</span>
                </>
              ) : (
                <span className="flex-1">{content.content}</span>
              )}
              <button
                type="button"
                className="p-1 rounded-full transition-all duration-200"
                style={{
                  color: 'var(--brand-warning)',
                  transition: 'var(--theme-transition)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                  e.currentTarget.style.color = 'var(--brand-error)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--brand-warning)';
                }}
                onClick={() => handleRemoveContent(index)}
                title="Remove content"
                aria-label="Remove content"
              >
                <X className="h-3 w-3 sm:h-4 sm:w-4" />
              </button>
            </div>
          ))}

          <div className="space-y-2">
            <div className="relative">
              <textarea
                ref={textareaRef}
                placeholder="What's on your mind?"
                value={currentInput}
                className="w-full px-4 py-3 text-xs sm:text-sm rounded-lg focus:outline-none transition-all duration-200 resize-none"
                style={{
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  color: 'var(--text-primary)',
                  transition: 'var(--theme-transition)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--input-focus)';
                  e.target.style.boxShadow = 'var(--focus-ring)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--input-border)';
                  e.target.style.boxShadow = 'none';
                }}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setCurrentInput(e.target.value)
                }
                rows={3}
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
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <div className="relative">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-full text-xs sm:text-sm flex items-center gap-1.5 transition-all duration-200"
                  style={{
                    backgroundColor: 'var(--bg-accent)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    transition: 'var(--theme-transition)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.borderColor = 'var(--border-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-accent)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}
                  onClick={() => {
                    // Open a modal or dropdown with S3FileUpload
                    document
                      .getElementById("s3-upload-modal")
                      ?.classList.remove("hidden");
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span className="hidden xs:inline">Add Image</span>
                  <span className="xs:hidden">Image</span>
                </button>

                {/* S3 Upload Modal */}
                <div
                  id="s3-upload-modal"
                  className="hidden absolute z-50 top-full left-0 mt-2 p-4 rounded-lg w-64 transition-all duration-200"
                  style={{
                    backgroundColor: 'var(--dropdown-bg)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-lg)'
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Upload Image</h3>
                    <button
                      type="button"
                      className="transition-colors duration-200"
                      style={{
                        color: 'var(--text-secondary)',
                        transition: 'var(--theme-transition)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                      onClick={() =>
                        document
                          .getElementById("s3-upload-modal")
                          ?.classList.add("hidden")
                      }
                      aria-label="Close upload modal"
                      title="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <S3FileUpload
                    onSuccess={(response) => {
                      handleS3ImageUploadSuccess(response);
                      document
                        .getElementById("s3-upload-modal")
                        ?.classList.add("hidden");
                    }}
                    fileType="image"
                    uploadType="post-image"
                    entityId={communitySlug}
                  />
                </div>
              </div>
              <button
                type="button"
                className="px-3 py-1.5 rounded-full text-xs sm:text-sm flex items-center gap-1.5 transition-all duration-200"
                style={{
                  backgroundColor: 'var(--bg-accent)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  transition: 'var(--theme-transition)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-accent)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Add emoji"
                aria-label="Add emoji"
              >
                <Smile className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Add Emoji</span>
                <span className="xs:hidden">Emoji</span>
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-full text-xs sm:text-sm flex items-center gap-1.5 transition-all duration-200"
                style={{
                  backgroundColor: 'var(--bg-accent)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  transition: 'var(--theme-transition)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-accent)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
                onClick={() => {
                  if (currentInput.trim()) {
                    setContents([
                      ...contents,
                      { type: "link", content: currentInput },
                    ]);
                    setCurrentInput("");
                  }
                }}
              >
                <Link className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Add Link</span>
                <span className="xs:hidden">Link</span>
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-full text-xs sm:text-sm flex items-center gap-1.5 transition-all duration-200"
                style={{
                  backgroundColor: 'var(--bg-accent)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  transition: 'var(--theme-transition)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-accent)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Add File</span>
                <span className="xs:hidden">File</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center gap-3 p-4 transition-colors duration-300"
            style={{ borderTop: '1px solid var(--border-color)' }}
          >
            {isAdmin && (
              <div className="flex-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded transition-colors duration-200"
                    style={{
                      accentColor: 'var(--brand-primary)',
                      backgroundColor: 'var(--input-bg)',
                      borderColor: 'var(--input-border)'
                    }}
                    checked={notifyMembers}
                    onChange={(e) => setNotifyMembers(e.target.checked)}
                  />
                  <span className="flex items-center text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                    Notify community members
                  </span>
                </label>
              </div>
            )}
            {submitError && (
              <div className="text-xs mr-2" style={{ color: 'var(--brand-error)' }}>{submitError}</div>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              className={`py-2 px-4 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                isSubmitting ? "cursor-wait" : ""
              }`}
              style={{
                background: isSubmitting
                  ? 'var(--bg-accent)'
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                boxShadow: 'var(--shadow-md)',
                opacity: isSubmitting ? 0.7 : 1,
                transition: 'var(--theme-transition)'
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #d97706 0%, #b45309 100%)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }
              }}
              disabled={isSubmitting || (!title.trim() && contents.length === 0)}
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating...
                </>
              ) : (
                "Post"
              )}
            </button>
          </div>
        </div>
        </div>
      </dialog>
    </>
  );
}
