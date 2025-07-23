"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useNotification } from "@/components/Notification";
import { useCommunityData } from "@/contexts/CommunityDataContext";
import NoSSR from "@/components/common/NoSSR";

interface CommunityData {
  _id: string;
  name: string;
  description?: string;
  members?: string[];
  admin: string;
  subAdmins?: string[];
}

export default function UserCommunitySettings() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const { showNotification } = useNotification();

  // Use centralized community data instead of fetching individually
  const {
    communityData: community,
    loading,
    isAdmin,
    isSubAdmin,
    isMember,
    refetchCommunityData,
  } = useCommunityData();

  const [allowMessages, setAllowMessages] = useState(true);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [isUpdatingMessages, setIsUpdatingMessages] = useState(false);
  const [isLeavingCommunity, setIsLeavingCommunity] = useState(false);

  // Fetch user messaging preferences
  const fetchMessagingPreferences = async () => {
    if (!community?._id) return;

    try {
      const res = await fetch("/api/user/messaging-preferences");
      if (!res.ok) {
        throw new Error("Failed to fetch messaging preferences");
      }
      const data = await res.json();

      // Check if this community is in the blocked list
      const isBlocked = data.messagingPreferences?.blockedCommunities?.includes(
        community._id
      );
      setAllowMessages(!isBlocked);
    } catch (error) {
      console.error("Error fetching messaging preferences:", error);
    }
  };

  useEffect(() => {
    if (community && session?.user) {
      fetchMessagingPreferences();
    }
  }, [community, session]);

  // Handle messaging preference toggle
  const handleMessagingToggle = async () => {
    if (!community) return;

    try {
      setIsUpdatingMessages(true);
      const newAllowMessages = !allowMessages;

      const res = await fetch("/api/user/messaging-preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          communityId: community._id,
          allowMessages: newAllowMessages,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update messaging preferences");
      }

      setAllowMessages(newAllowMessages);
      showNotification(
        `Messages from community members ${
          newAllowMessages ? "enabled" : "disabled"
        }`,
        "success"
      );
    } catch (error) {
      console.error("Error updating messaging preferences:", error);
      showNotification("Failed to update messaging preferences", "error");
    } finally {
      setIsUpdatingMessages(false);
    }
  };

  // Handle leaving community
  const handleLeaveCommunity = async () => {
    if (!community || !session?.user) return;

    try {
      setIsLeavingCommunity(true);
      const res = await fetch(`/api/community/leave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          communityId: community._id,
          slug: slug,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to leave community");
      }

      showNotification("Successfully left the community", "success");
      router.push("/community-feed");
    } catch (error) {
      console.error("Error leaving community:", error);
      showNotification("Failed to leave community", "error");
    } finally {
      setIsLeavingCommunity(false);
      setConfirmLeave(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Community not found</p>
      </div>
    );
  }

  return (
    <NoSSR
      fallback={
        <div className="flex justify-center items-center h-64">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold mb-2">Your Community Settings</h3>
          <p className="text-sm text-gray-600">
            Manage your personal settings for this community
          </p>
        </div>

        {/* Community Info */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h4 className="card-title text-lg">Community Information</h4>
            <div className="space-y-2">
              <p>
                <span className="font-medium">Name:</span> {community.name}
              </p>
              {community.description && (
                <p>
                  <span className="font-medium">Description:</span>{" "}
                  {community.description}
                </p>
              )}
              <p>
                <span className="font-medium">Your Role:</span>{" "}
                {isAdmin ? "Admin" : isSubAdmin ? "Sub-Admin" : "Member"}
              </p>
            </div>
          </div>
        </div>

        {/* Messaging Preferences */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h4 className="card-title text-lg">Messaging Preferences</h4>
            <p className="text-sm text-gray-600 mb-4">
              Control whether community members can send you direct messages
            </p>

            <div className="form-control">
              <label className="label cursor-pointer justify-start">
                <input
                  type="checkbox"
                  className="toggle toggle-primary mr-3"
                  checked={allowMessages}
                  onChange={handleMessagingToggle}
                  disabled={isUpdatingMessages}
                />
                <span className="label-text">
                  Allow messages from community members
                  {isUpdatingMessages && (
                    <span className="loading loading-spinner loading-sm ml-2"></span>
                  )}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Leave Community */}
        {isMember && !isAdmin && (
          <div className="card bg-base-100 shadow-sm border border-error/20">
            <div className="card-body">
              <h4 className="card-title text-lg text-error">Danger Zone</h4>
              <p className="text-sm text-gray-600 mb-4">
                Once you leave this community, you'll need to request to join
                again
              </p>

              {!confirmLeave ? (
                <button
                  className="btn btn-error btn-outline"
                  onClick={() => setConfirmLeave(true)}
                >
                  Leave Community
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-error">
                    Are you sure you want to leave this community?
                  </p>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-error btn-sm"
                      onClick={handleLeaveCommunity}
                      disabled={isLeavingCommunity}
                    >
                      {isLeavingCommunity ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Leaving...
                        </>
                      ) : (
                        "Yes, Leave Community"
                      )}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setConfirmLeave(false)}
                      disabled={isLeavingCommunity}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </NoSSR>
  );
}
