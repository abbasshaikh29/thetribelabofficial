"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, ImageIcon, LinkIcon, FileText, Smile, Bell } from "lucide-react";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

interface PostContent {
  type: "text" | "image" | "link" | "file";
  content: string;
}

interface EditPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  initialTitle: string;
  initialContent: PostContent[];
  onPostUpdated: (updatedPost: any) => void;
  isAdmin?: boolean;
}

export function EditPostModal({
  isOpen,
  onClose,
  postId,
  initialTitle,
  initialContent,
  onPostUpdated,
  isAdmin = false,
}: EditPostModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [contents, setContents] = useState<PostContent[]>(initialContent || []);
  const [currentInput, setCurrentInput] = useState("");
  const [currentType, setCurrentType] = useState<
    "text" | "image" | "link" | "file"
  >("text");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [notifyMembers, setNotifyMembers] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Helper function to safely sanitize URLs - prevents XSS attacks
  // This function validates URL format and blocks dangerous protocols
  const getSafeUrl = (url: string): string => {
    try {
      const cleanUrl = url.trim();
      const dangerousProtocols = ["javascript:", "data:", "vbscript:", "file:"];
      const lowerCaseUrl = cleanUrl.toLowerCase();

      if (
        dangerousProtocols.some((protocol) => lowerCaseUrl.startsWith(protocol))
      ) {
        console.warn(`Blocked dangerous URL protocol: ${url}`);
        return "#";
      }

      if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
        const urlObj = new URL(cleanUrl);
        if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
          return cleanUrl;
        }
      }

      if (
        cleanUrl.startsWith("/") ||
        cleanUrl.startsWith("./") ||
        cleanUrl.startsWith("../")
      ) {
        if (
          !lowerCaseUrl.includes("javascript:") &&
          !lowerCaseUrl.includes("vbscript:")
        ) {
          return cleanUrl;
        }
      }

      console.warn(`Invalid URL format: ${url}`);
      return "#";
    } catch (e) {
      console.warn(`URL parsing failed: ${url}`);
      return "#";
    }
  };

  // Reset form when modal opens with new post data
  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setContents(initialContent || []);
      setCurrentInput("");
      setCurrentType("text");
      setError("");
    }
  }, [isOpen, initialTitle, initialContent]);

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

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
  };

  const addContent = () => {
    if (!currentInput.trim()) return;

    setContents([
      ...contents,
      { type: currentType, content: currentInput.trim() },
    ]);
    setCurrentInput("");
  };

  const removeContent = (index: number) => {
    setContents(contents.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    // Make sure we have at least one content item
    const finalContents = [...contents];
    if (currentInput.trim()) {
      finalContents.push({ type: currentType, content: currentInput.trim() });
    }

    if (finalContents.length === 0) {
      setError("Post content is required");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/posts", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId: postId,
          title: title,
          content: JSON.stringify(finalContents),
          notifyMembers: notifyMembers,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update post");
      }

      const updatedPost = await response.json();
      onPostUpdated(updatedPost.post);
      onClose();
    } catch (error: any) {
      console.error("Error updating post:", error.message);
      setError(error.message || "Failed to update post");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogTitle>Edit Post</DialogTitle>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              placeholder="Post title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            {contents.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-2 bg-gray-50 rounded-md"
              >
                <div className="flex-1">
                  {item.type === "text" && <p>{item.content}</p>}
                  {item.type === "image" && (
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" aria-hidden="true" />
                      <span className="text-blue-500">{item.content}</span>
                    </div>
                  )}
                  {item.type === "link" && (
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-4 w-4" aria-hidden="true" />
                      <a
                        href={(() => {
                          // Explicit URL sanitization to help static analysis tools detect security measures
                          const url = item?.content;
                          if (!url || typeof url !== "string") return "#";
                          return getSafeUrl(url);
                        })()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500"
                      >
                        {item.content}
                      </a>
                    </div>
                  )}
                  {item.type === "file" && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      <span className="text-blue-500">{item.content}</span>
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeContent(index)}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={currentType === "text" ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentType("text")}
              >
                Text
              </Button>
              <Button
                type="button"
                variant={currentType === "image" ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentType("image")}
              >
                Image URL
              </Button>
              <Button
                type="button"
                variant={currentType === "link" ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentType("link")}
              >
                Link
              </Button>
              <Button
                type="button"
                variant={currentType === "file" ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentType("file")}
              >
                File URL
              </Button>
            </div>

            <div className="relative">
              <Textarea
                ref={textareaRef}
                placeholder={
                  currentType === "text"
                    ? "Write your post content..."
                    : currentType === "image"
                      ? "Enter image URL..."
                      : currentType === "link"
                        ? "Enter link URL..."
                        : "Enter file URL..."
                }
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                className="min-h-[100px]"
              />
              {showEmojiPicker && currentType === "text" && (
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

            <div className="flex justify-between">
              <div className="flex gap-2">
                {currentType === "text" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    <Smile className="h-4 w-4 mr-2" aria-hidden="true" />
                    Emoji
                  </Button>
                )}
              </div>
              <Button
                type="button"
                onClick={addContent}
                disabled={!currentInput.trim()}
                size="sm"
              >
                Add to Post
              </Button>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {isAdmin && (
            <div className="flex items-center gap-3 mt-4">
              <div className="flex-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm checkbox-primary"
                    checked={notifyMembers}
                    onChange={(e) => setNotifyMembers(e.target.checked)}
                  />
                  <span className="flex items-center text-sm text-gray-600">
                    <Bell className="h-4 w-4 mr-1" />
                    Notify community members
                  </span>
                </label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
