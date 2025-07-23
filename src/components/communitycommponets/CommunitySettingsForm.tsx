"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useNotification } from "@/components/Notification";
import S3FileUpload from "../S3FileUpload";
import { Settings2Icon, Image, Video } from "lucide-react";
import { useSession } from "next-auth/react";

export default function CommunitySettings() {
  const { slug } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bannerImage, setBannerImage] = useState<string>("");
  const [iconImage, setIconImage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadResponse, setUploadResponse] = useState<any>(null);
  const [iconUploadResponse, setIconUploadResponse] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSubAdmin, setIsSubAdmin] = useState(false);

  const { showNotification } = useNotification();

  const [communityId, setCommunityId] = useState("");

  const fetchCommunity = async () => {
    try {
      const res = await fetch(`/api/community/${slug}`, {
        cache: "no-store", // Prevent caching
      });
      const data = await res.json();
      console.log("Community data from API:", data);
      console.log("Icon image URL from API:", data.iconImageUrl);
      console.log("Icon image URL type:", typeof data.iconImageUrl);

      setName(data.name);
      setDescription(data.description ?? "");
      setBannerImage(data.bannerImageurl || "");

      // Handle icon image URL
      let iconUrl = data.iconImageUrl || "";
      console.log("Setting icon image to:", iconUrl);

      // If the icon URL is missing, try to get it from the validation API
      if (!iconUrl || iconUrl.trim() === "") {
        try {
          console.log("Icon URL is missing, trying validation API");
          const validateRes = await fetch(
            `/api/community/${slug}/validate-icon`,
            {
              method: "GET",
              cache: "no-store", // Prevent caching
            }
          );

          if (validateRes.ok) {
            const validateData = await validateRes.json();
            console.log("Validation API response:", validateData);

            if (validateData.isValid && validateData.iconImageUrl) {
              iconUrl = validateData.iconImageUrl;
              console.log("Got valid icon URL from validation API:", iconUrl);
            }
          }
        } catch (validateError) {
          console.error("Error fetching from validation API:", validateError);
        }
      }

      setIconImage(iconUrl);
      setCommunityId(data._id);
      const userId = session?.user?.id;
      setIsAdmin(data.admin === userId);
      setIsSubAdmin(data.subAdmins?.includes(userId) || false);
    } catch (error) {
      console.error("Error fetching community:", error);
      showNotification("Failed to fetch community data", "error");
    }
  };

  useEffect(() => {
    fetchCommunity();
  }, [slug, session?.user?.id]);

  // Debug icon image changes
  useEffect(() => {
    console.log("Icon image state changed:", iconImage);
  }, [iconImage]);

  const handleUpdateSettings = async () => {
    if (!isAdmin && !isSubAdmin) {
      showNotification(
        "Only admins and sub-admins can update community settings",
        "error"
      );
      return;
    }

    console.log("Updating community settings with icon image:", iconImage);

    setIsLoading(true);
    try {
      // Debug icon image
      console.log("Updating community with icon image:", iconImage);
      console.log("Icon image type:", typeof iconImage);

      // Ensure the icon image URL is a string
      const iconImageUrl = iconImage || "";
      console.log("Final icon image URL for API request:", iconImageUrl);
      console.log("Icon image URL type:", typeof iconImageUrl);

      // Test if the icon image is accessible
      if (iconImageUrl) {
        const testImg = document.createElement("img");
        testImg.onload = () =>
          console.log(
            "Icon image is accessible before API request:",
            iconImageUrl
          );
        testImg.onerror = () =>
          console.error(
            "Icon image is NOT accessible before API request:",
            iconImageUrl
          );
        testImg.src = iconImageUrl;
      }

      // Make sure we're using the correct icon URL
      const formattedIconUrl =
        iconImage && iconImage.trim() !== "" ? iconImage : "";

      const requestBody = {
        name,
        description,
        bannerImageurl: bannerImage, // Use the correct property name expected by the API
        iconImageUrl: formattedIconUrl, // Add icon image URL
      };

      console.log("Full request body:", JSON.stringify(requestBody));

      const response = await fetch(`/api/community/${slug}/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("Failed to update community settings");
      }

      const result = await response.json();
      console.log("API response:", result);

      // Log the icon image URL in the response
      console.log("Icon image URL in response:", result.iconImageUrl);

      // Always try a direct update to save the icon image URL to ensure it's saved correctly
      if (formattedIconUrl) {
        console.log(
          "Ensuring icon image URL is saved correctly with direct update"
        );

        // Try a direct update to save the icon image URL
        try {
          const directUpdateResponse = await fetch(
            `/api/community/${slug}/icon`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
              },
              body: JSON.stringify({ iconImageUrl: formattedIconUrl }),
            }
          );

          if (directUpdateResponse.ok) {
            const directUpdateResult = await directUpdateResponse.json();
            console.log("Direct update result:", directUpdateResult);

            // Update the local state with the new icon image URL
            if (directUpdateResult.iconImageUrl) {
              setIconImage(directUpdateResult.iconImageUrl);
              console.log(
                "Updated local state with new icon image URL:",
                directUpdateResult.iconImageUrl
              );

              // Force a refresh of the community data to ensure the icon is displayed
              setTimeout(() => {
                fetchCommunity();
              }, 500);
            }
          } else {
            console.error(
              "Direct update failed:",
              await directUpdateResponse.text()
            );
          }
        } catch (error) {
          console.error("Error in direct update:", error);
        }
      }

      // Test if the icon image is accessible
      if (result.iconImageUrl) {
        const testImg = document.createElement("img");
        testImg.onload = () =>
          console.log(
            "Icon image in response is accessible:",
            result.iconImageUrl
          );
        testImg.onerror = () =>
          console.error(
            "Icon image in response is NOT accessible:",
            result.iconImageUrl
          );
        testImg.src = result.iconImageUrl;
      }

      // Check if the name was changed and we have a new slug
      console.log("Full API response:", result);

      if (result.nameChanged && result.newSlug && result.newSlug !== slug) {
        console.log("Slug changed, redirecting to new URL");
        console.log("Old slug:", slug);
        console.log("New slug:", result.newSlug);

        showNotification(
          "Community settings updated successfully. Redirecting to new URL...",
          "success"
        );

        // Redirect to the new community URL with the updated slug
        setTimeout(() => {
          const newUrl = `/Newcompage/${result.newSlug}/communitysetting`;
          console.log("Redirecting to:", newUrl);
          console.log("Current URL:", window.location.href);
          console.log("Current slug:", slug);
          console.log("New slug:", result.newSlug);

          // Force a hard navigation to ensure the page is fully reloaded with the new slug
          window.location.href = newUrl;
        }, 1500); // Short delay to show the notification
      } else {
        console.log("No slug change detected");
        showNotification("Community settings updated successfully", "success");
      }
    } catch (error) {
      showNotification("Failed to update community settings", "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin && !isSubAdmin) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Community Settings</h2>
        <p className="text-error">
          Only community admins and sub-admins can access these settings.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Community Settings</h2>

      <div className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Community Name</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            title="Community Name"
            placeholder="Enter community name"
            className="input input-bordered"
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Description</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            title="Community Description"
            placeholder="Enter community description"
            className="textarea textarea-bordered"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Banner Image Upload */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Banner Image</span>
            </label>
            <S3FileUpload
              onSuccess={(response) => {
                setUploadResponse(response);
                // Use the URL from the response
                if (response.url) {
                  setBannerImage(response.url);

                  // Update the banner image directly via API
                  fetch(`/api/community/${slug}/banner`, {
                    method: "PUT",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ bannerImageurl: response.url }),
                  })
                    .then((res) => {
                      if (!res.ok) {
                        console.error("Failed to update banner image directly");
                      } else {
                        console.log("Banner image updated directly");
                      }
                    })
                    .catch((err) => {
                      console.error(
                        "Error updating banner image directly:",
                        err
                      );
                    });
                } else {
                  showNotification(
                    "Failed to get image URL from upload",
                    "error"
                  );
                }
              }}
              uploadType="community-banner"
              entityId={communityId}
            />

            {/* Show the current banner image if available */}
            {bannerImage && (
              <div className="mt-2">
                <p className="text-sm mb-1">Current banner image:</p>
                <div className="h-32 bg-primary/10 rounded overflow-hidden">
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundImage: `url(${bannerImage})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1 break-all">
                  {bannerImage}
                </p>
              </div>
            )}
          </div>

          {/* Icon Image Upload */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Community Icon</span>
              <span className="label-text-alt text-xs text-gray-500">
                (Displayed next to community name)
              </span>
            </label>
            <S3FileUpload
              onSuccess={(response) => {
                setIconUploadResponse(response);
                // Use the URL from the response
                if (response.url) {
                  console.log(
                    "Setting icon image URL from response.url:",
                    response.url
                  );
                  setIconImage(response.url);

                  // Update the icon image directly via API
                  fetch(`/api/community/${slug}/icon`, {
                    method: "PUT",
                    headers: {
                      "Content-Type": "application/json",
                      "Cache-Control": "no-cache",
                    },
                    body: JSON.stringify({ iconImageUrl: response.url }),
                  })
                    .then((res) => {
                      if (!res.ok) {
                        console.error("Failed to update icon image directly");
                      } else {
                        console.log("Icon image updated directly");
                      }
                    })
                    .catch((err) => {
                      console.error("Error updating icon image directly:", err);
                    });
                } else {
                  console.error("No URL in response:", response);
                  showNotification(
                    "Failed to get image URL from upload",
                    "error"
                  );
                }
              }}
              uploadType="community-icon"
              entityId={communityId}
            />

            {/* Show the current icon image if available */}
            {iconImage && (
              <div className="mt-2">
                <p className="text-sm mb-1">Current icon image:</p>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-16 bg-primary/10 rounded-full overflow-hidden">
                    {/* Use img tag for better debugging */}
                    {/* Add cache-busting parameter to prevent caching */}
                    <img
                      src={`${iconImage}?t=${Date.now()}`}
                      alt="Community icon"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error(
                          "Error loading icon image in settings form:",
                          iconImage
                        );
                        e.currentTarget.style.display = "none";
                      }}
                      onLoad={() =>
                        console.log(
                          "Icon image loaded successfully in settings form"
                        )
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 break-all">
                      {iconImage}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleUpdateSettings}
          disabled={isLoading}
        >
          {isLoading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
