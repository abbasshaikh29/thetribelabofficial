"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useNotification } from "@/components/Notification";
import ProfileImageUpload from "@/components/ProfileImageUpload";
// ProfileImageDisplay might not be needed if ProfileImageUpload handles display
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Mail,
  Settings2Icon,
  UserCircle2,
} from "lucide-react";

// Helper function to sanitize image URLs - prevents XSS attacks
// This function validates image URLs and blocks dangerous protocols like javascript:
function sanitizeImgUrl(url?: string): string {
  if (!url || typeof url !== "string") return "/default-avatar.png";

  // Remove any leading/trailing whitespace
  const cleanUrl = url.trim();

  // Block dangerous protocols
  const dangerousProtocols = ["javascript:", "data:", "vbscript:", "file:"];
  const lowerCaseUrl = cleanUrl.toLowerCase();

  if (
    dangerousProtocols.some((protocol) => lowerCaseUrl.startsWith(protocol))
  ) {
    return "/default-avatar.png";
  }

  // Only allow http, https, or relative URLs
  if (
    cleanUrl.startsWith("http://") ||
    cleanUrl.startsWith("https://") ||
    cleanUrl.startsWith("/")
  ) {
    try {
      // For absolute URLs, validate them further
      if (cleanUrl.startsWith("http")) {
        const urlObj = new URL(cleanUrl);
        if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
          return cleanUrl;
        }
      } else {
        // For relative URLs, ensure they don't contain dangerous patterns
        if (
          !lowerCaseUrl.includes("javascript:") &&
          !lowerCaseUrl.includes("vbscript:")
        ) {
          return cleanUrl;
        }
      }
    } catch (e) {
      // Invalid URL format
      return "/default-avatar.png";
    }
  }

  // Fallback to a safe default
  return "/default-avatar.png";
}

interface UserProfileData {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  bio: string;
  profileImage: string;
  emailVerified?: boolean;
}

export default function UserProfileForm() {
  const { data: session, update: updateSession } = useSession();
  const { showNotification } = useNotification();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState<UserProfileData>({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    bio: "",
    profileImage: "",
    emailVerified: false,
  });

  const [resendingVerification, setResendingVerification] = useState(false);

  // Add validation state
  const [errors, setErrors] = useState({
    username: "",
    email: "",
  });

  // Add state to track if fields have been modified
  const [modified, setModified] = useState({
    username: false,
    email: false,
  });

  useEffect(() => {
    const fetchUserData = async () => {
      if (!session?.user?.id) return;

      try {
        const response = await fetch(`/api/user/${session.user.id}`);
        if (!response.ok) throw new Error("Failed to fetch user data");

        const userData = await response.json();
        setFormData({
          username: userData.user.username || "",
          email: userData.user.email || "",
          firstName: userData.user.firstName || "",
          lastName: userData.user.lastName || "",
          bio: userData.user.bio || "",
          profileImage: userData.user.profileImage || "",
          emailVerified: userData.user.emailVerified || false,
        });
      } catch (error) {
        console.error("Error fetching user data:", error);
        showNotification("Failed to load user data", "error");
      }
    };

    fetchUserData();
  }, [session, showNotification]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Track modified fields for username and email
    if (name === "username" || name === "email") {
      setModified((prev) => ({ ...prev, [name]: true }));

      // Validate as user types
      validateField(name, value);
    }
  };

  // Validate individual fields
  const validateField = (name: string, value: string) => {
    let errorMessage = "";

    if (name === "username") {
      if (!value.trim()) {
        errorMessage = "Username is required";
      } else if (value.length < 3) {
        errorMessage = "Username must be at least 3 characters";
      } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
        errorMessage =
          "Username can only contain letters, numbers, and underscores";
      }
    } else if (name === "email") {
      if (!value.trim()) {
        errorMessage = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errorMessage = "Please enter a valid email address";
      }
    }

    setErrors((prev) => ({ ...prev, [name]: errorMessage }));
    return !errorMessage; // Return true if valid, false if invalid
  };

  const handleResendVerification = async () => {
    if (!formData.email) {
      showNotification("Email address is required", "error");
      return;
    }

    setResendingVerification(true);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: formData.email }),
      });

      const data = await response.json();

      if (response.ok) {
        showNotification(
          "Verification email sent. Please check your inbox.",
          "success"
        );
      } else {
        showNotification(
          data.error || "Failed to send verification email",
          "error"
        );
      }
    } catch (error) {
      console.error("Error sending verification email:", error);
      showNotification("An error occurred. Please try again later.", "error");
    } finally {
      setResendingVerification(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user?.id) {
      showNotification("You must be logged in to update your profile", "error");
      return;
    }

    // Validate all fields before submission
    const isUsernameValid = validateField("username", formData.username);
    const isEmailValid = validateField("email", formData.email);

    // Check if username or email has been modified and is invalid
    if (
      (modified.username && !isUsernameValid) ||
      (modified.email && !isEmailValid)
    ) {
      showNotification("Please fix the errors before submitting", "error");
      return;
    }

    setIsLoading(true);

    try {
      console.log("Submitting profile data:", formData);

      // First, update username and email if they've been modified
      if (modified.username || modified.email) {
        const settingsResponse = await fetch(`/api/user/settings`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: formData.username,
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            bio: formData.bio,
            profileImageUrl: formData.profileImage,
          }),
        });

        if (!settingsResponse.ok) {
          const errorData = await settingsResponse.json();
          console.error("Settings update error:", errorData);

          // Handle specific errors
          if (settingsResponse.status === 409) {
            setErrors((prev) => ({
              ...prev,
              username: "Username already taken",
            }));
            throw new Error("Username already taken");
          } else {
            throw new Error("Failed to update username and email");
          }
        }

        // Reset modified flags after successful update
        setModified({ username: false, email: false });
      }

      // Then update other profile fields
      const response = await fetch(`/api/user/${session.user.id}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Profile update error:", errorData);
        throw new Error("Failed to update profile");
      }

      const updatedUser = await response.json();
      console.log("Profile updated successfully:", updatedUser);

      // Update the session to reflect the changes
      const updatedSession = {
        ...session,
        user: {
          ...session.user,
          profileImage: formData.profileImage,
          username: formData.username,
          email: formData.email,
        },
      };

      console.log("New session data:", updatedSession);
      await updateSession(updatedSession);

      // Force a reload to ensure the session is updated everywhere
      window.location.reload();

      showNotification("Profile updated successfully", "success");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      showNotification(error.message || "Failed to update profile", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 bg-base-100 rounded-lg shadow-md">
      <div className="flex items-center gap-3 mb-6">
        <UserCircle2 className="w-7 h-7 text-primary" />{" "}
        {/* Changed icon to UserCircle2 for user settings */}
        <h2 className="text-2xl font-semibold">User Settings</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        {/* Profile Image Section */}
        <div className="form-control">
          <label className="label">
            <span className="label-text">Profile Picture</span>
          </label>
          <div className="mt-1 flex items-center gap-4">
            <div className="flex-shrink-0">
              {formData.profileImage ? (
                <img
                  className="h-20 w-20 rounded-full object-cover border border-base-300"
                  src={(() => {
                    // Explicit image URL sanitization to help static analysis tools detect security measures
                    const imageUrl = formData?.profileImage;
                    if (!imageUrl || typeof imageUrl !== "string")
                      return "/default-avatar.png";
                    return sanitizeImgUrl(imageUrl);
                  })()}
                  alt="Current profile"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-base-200 flex items-center justify-center text-base-content/50">
                  <UserCircle2 className="w-10 h-10" />
                </div>
              )}
            </div>
            <div className="flex-grow">
              <ProfileImageUpload
                currentImage={formData.profileImage}
                onImageUpdated={(imageUrl) => {
                  setFormData((prev) => ({ ...prev, profileImage: imageUrl }));
                  // ProfileImageUpload handles DB and session updates
                }}
              />
              {/* The ProfileImageUpload component includes its own upload button and guidance text */}
            </div>
          </div>
          {formData.profileImage && (
            <p className="text-xs text-gray-500 mt-2 break-all">
              Current image URL: {formData.profileImage}
            </p>
          )}
        </div>

        {/* Username Input */}
        <div className="form-control">
          <label className="label" htmlFor="username">
            <span className="label-text">Username</span>
          </label>
          <input
            type="text"
            name="username"
            id="username"
            value={formData.username}
            onChange={handleChange}
            className={`input input-bordered w-full ${errors.username ? "input-error" : ""}`}
            placeholder="Your unique username"
          />
          {errors.username && (
            <label className="label">
              <span className="label-text-alt text-error">
                {errors.username}
              </span>
            </label>
          )}
          <label className="label">
            <span className="label-text-alt text-gray-500">
              Must be 3+ characters. Letters, numbers, and underscores only.
            </span>
          </label>
        </div>

        {/* Email Input & Verification Status */}
        <div className="form-control">
          <label className="label" htmlFor="email">
            <span className="label-text">Email</span>
          </label>
          <input
            type="email"
            name="email"
            id="email"
            value={formData.email}
            onChange={handleChange}
            className={`input input-bordered w-full ${errors.email ? "input-error" : ""}`}
            placeholder="your.email@example.com"
          />
          {errors.email && (
            <label className="label">
              <span className="label-text-alt text-error">{errors.email}</span>
            </label>
          )}
          <label className="label">
            <span className="label-text-alt text-gray-500">
              Make sure to use a valid email address you can access.
            </span>
          </label>

          <div className="mt-3 p-3 rounded-lg border border-base-300 bg-base-200/50">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {formData.emailVerified ? (
                  <>
                    <CheckCircle className="text-success w-5 h-5 flex-shrink-0" />
                    <span className="font-medium text-sm">Email verified</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="text-warning w-5 h-5 flex-shrink-0" />
                    <span className="font-medium text-sm">
                      Email not verified
                    </span>
                  </>
                )}
              </div>
              {!formData.emailVerified && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline btn-warning ml-auto"
                  onClick={handleResendVerification}
                  disabled={resendingVerification}
                >
                  {resendingVerification ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    <Mail className="w-3.5 h-3.5 mr-1" />
                  )}
                  {resendingVerification ? "Sending..." : "Resend Email"}
                </button>
              )}
            </div>
            {!formData.emailVerified && (
              <p className="text-xs mt-2 text-gray-500">
                Please verify your email to ensure account security and receive
                important notifications.
              </p>
            )}
          </div>
        </div>

        {/* First Name Input */}
        <div className="form-control">
          <label className="label" htmlFor="firstName">
            <span className="label-text">First Name</span>
          </label>
          <input
            type="text"
            name="firstName"
            id="firstName"
            value={formData.firstName}
            onChange={handleChange}
            className="input input-bordered w-full"
            placeholder="Your first name"
          />
        </div>

        {/* Last Name Input */}
        <div className="form-control">
          <label className="label" htmlFor="lastName">
            <span className="label-text">Last Name</span>
          </label>
          <input
            type="text"
            name="lastName"
            id="lastName"
            value={formData.lastName}
            onChange={handleChange}
            className="input input-bordered w-full"
            placeholder="Your last name"
          />
        </div>

        {/* Bio Textarea */}
        <div className="form-control">
          <label className="label" htmlFor="bio">
            <span className="label-text">Bio</span>
          </label>
          <textarea
            name="bio"
            id="bio"
            value={formData.bio}
            onChange={handleChange}
            className="textarea textarea-bordered w-full h-28 resize-none" // Adjusted height
            placeholder="Tell us a bit about yourself (optional)"
            rows={3} // semantic rows
          ></textarea>
          <label className="label">
            <span className="label-text-alt text-gray-500">
              A short description about you or your interests.
            </span>
          </label>
        </div>

        {/* Form Actions */}
        <div className="form-control mt-8 flex flex-col sm:flex-row gap-3 pt-4 border-t border-base-300">
          <button
            type="submit"
            className="btn btn-primary w-full sm:w-auto"
            disabled={
              isLoading ||
              (!modified.username &&
                !modified.email &&
                !formData.firstName &&
                !formData.lastName &&
                !formData.bio &&
                !formData.profileImage)
            } // Disable if no changes
          >
            {isLoading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>{" "}
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>

          <button
            type="button"
            className="btn btn-outline w-full sm:w-auto"
            onClick={async () => {
              try {
                showNotification("Refreshing session...", "info");
                await updateSession(); // This should re-fetch user data via session
                // Re-fetch user data explicitly if session update doesn't reflect immediately or for non-session fields
                // const updatedUserData = await fetchUserData(); // Assuming fetchUserData can be called and returns data
                // if (updatedUserData) setFormData(updatedUserData);
                showNotification("Session refreshed successfully", "success");
              } catch (error) {
                console.error("Error refreshing session:", error);
                showNotification("Failed to refresh session", "error");
              }
            }}
          >
            Refresh Session
          </button>
        </div>
      </form>
    </div>
  );
}
