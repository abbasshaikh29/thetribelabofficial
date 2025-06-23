"use client";

import { useState, useEffect } from "react";
import type { ICommunity } from "@/models/Community";
import { IUser } from "@/models/User";
import { useSession } from "next-auth/react";
import { useSettingsModal } from "@/components/modals/SettingsModalProvider";
import {
  Users,
  User,
  DollarSign,
  Lock,
  ShieldCheck,
  Tag,
  Globe,
} from "lucide-react";
import CommunityMediaGallery from "./CommunityMediaGallery";

interface AboutProps {
  slug: string;
}

async function getCommunity(slug: string): Promise<{
  community: ICommunity | null;
  adminData: { user: IUser } | null;
  error?: string;
}> {
  try {
    // Fetch community data with cache-busting query parameter
    const timestamp = new Date().getTime();
    const communityResponse = await fetch(
      `/api/community/${slug}?t=${timestamp}`,
      {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
    if (!communityResponse.ok) {
      // If that fails, try the debug endpoint to get more information
      const debugResponse = await fetch(
        `/api/community/check?slug=${encodeURIComponent(slug)}`
      );
      const debugData = await debugResponse.json();

      if (debugData.communityFound && debugData.communityData) {
        // Community exists but there was an error fetching it
        return {
          community: null,
          adminData: null,
          error: `Community exists but couldn't be fetched properly. Database status: ${JSON.stringify(
            debugData.dbStatus
          )}`,
        };
      } else if (debugData.totalCommunities > 0) {
        // Other communities exist but not this one
        return {
          community: null,
          adminData: null,
          error: `Community with slug "${slug}" not found. ${debugData.totalCommunities} other communities exist.`,
        };
      } else {
        // No communities exist at all
        return {
          community: null,
          adminData: null,
          error:
            "No communities found in the database. Database may be empty or not properly connected.",
        };
      }
    }

    const communityData: ICommunity = await communityResponse.json();

    // Fetch admin data using the admin ID from community data
    if (communityData.admin) {
      try {
        const adminResponse = await fetch(
          `/api/user/${communityData.admin}?t=${timestamp}`,
          {
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
          }
        );
        if (adminResponse.ok) {
          const adminData = await adminResponse.json();
          return { community: communityData, adminData };
        }
      } catch (adminError) {
        // Continue with community data even if admin fetch fails
        return {
          community: communityData,
          adminData: null,
          error: `Admin data could not be fetched: ${
            adminError instanceof Error
              ? adminError.message
              : String(adminError)
          }`,
        };
      }
    }

    return { community: communityData, adminData: null };
  } catch (error) {
    return {
      community: null,
      adminData: null,
      error: `Error fetching community: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

function About({ slug }: AboutProps) {
  const { data: session } = useSession();
  const { openCommunitySettings } = useSettingsModal();
  const [communityData, setCommunityData] = useState<{
    community: ICommunity | null;
    admin: IUser | null;
  }>({ community: null, admin: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Derived data for convenient access inside this component
  const community = communityData.community as ICommunity;
  const members = community?.members ?? [];
  const isAdmin = session?.user?.id === community?.admin;

  const fetchData = async () => {
    try {
      const data = await getCommunity(slug);

      if (data.community) {
        console.log("Fetched community data:", data.community);
        setCommunityData({
          community: data.community,
          admin: data.adminData ? data.adminData.user : null,
        });
      } else if (data.error) {
        setError(data.error);
      } else {
        setError("Community not found");
      }

      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const getInviteLink = () => {
    // Create the invite link to the about page
    const baseUrl = window.location.origin;
    return `${baseUrl}/Newcompage/${slug}/about`;
  };

  const handleCopyInviteLink = async () => {
    const inviteLink = getInviteLink();
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset copied state after 2 seconds
    } catch (err) {
      // Silent error handling
    }
  };

  useEffect(() => {
    fetchData();
  }, [slug]);

  const handleFollow = async () => {
    if (!session?.user?.id || !community?._id) {
      return;
    }

    // TODO: implement follow / unfollow logic
  };

  // Guard against loading / error states to avoid null reference errors
  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  if (!community) {
    return <div className="p-4">Community not found.</div>;
  }

  return (
    <div className="m-3 sm:m-6 md:m-8 flex flex-col gap-3 bg-base-300 p-4 sm:p-6 rounded-md">
      <h1 className="text-xl sm:text-2xl font-bold mb-2">{community.name}</h1>

      {/* Community Media Gallery */}
      <CommunityMediaGallery slug={slug} />

      {/* Community Info Bar */}
      <div className="flex flex-wrap items-center gap-6 mt-4 mb-4 border-b border-base-200 pb-3">
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            {community.isPrivate === true ? (
              <>
                <ShieldCheck size={18} className="text-gray-600" />
                <span className="font-medium">Private</span>
              </>
            ) : (
              <>
                <Globe size={18} className="text-gray-600" />
                <span className="font-medium">Public</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-gray-600" />
            <span className="font-medium">{members.length}</span> members
          </div>
        </div>

        <div className="flex items-center gap-2">
          {communityData.admin?.profileImage ? (
            <img
              src={communityData.admin.profileImage}
              alt={communityData.admin?.username || "avatar"}
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-base-200 flex items-center justify-center text-xs font-semibold">
              {communityData.admin?.username?.charAt(0)?.toUpperCase() || "?"}
            </div>
          )}
          
          <span className="text-sm">By</span>
          <span className="font-medium">
            {communityData.admin?.username ||
              communityData.community?.createdBy ||
              "Unknown"}
          </span>
        </div>

        {/* Price Tag */}
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <Tag size={18} className="text-gray-600" />
            <span className="font-medium">
              {(community.price || 0) > 0
                ? `${community.currency === "USD" ? "$" : community.currency} ${community.price} ${
                    community.pricingType === "monthly"
                      ? "/month"
                      : community.pricingType === "yearly"
                        ? "/year"
                        : ""
                  }`
                : "Free"}
            </span>
          </div>
        </div>

        {community.paymentEnabled && (
          <div className="flex items-center">
            <div className="flex items-center gap-2">
              {community.subscriptionRequired ? (
                <>
                  <Lock size={18} className="text-gray-600" />
                  <span className="font-medium">Subscription</span>
                </>
              ) : (
                <>
                  <DollarSign size={18} className="text-gray-600" />
                  <span className="font-medium">One-time payment</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="text-sm sm:text-base text-gray-600 mb-3">
        {community.description}
      </div>

      {isAdmin && (
        <div className="mt-4 sm:mt-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4">
            Admin Options
          </h2>
          <button
            type="button"
            className="btn btn-sm sm:btn-md btn-primary"
            onClick={() => openCommunitySettings(slug, "AdminPanel")}
          >
            Go to Admin Panel
          </button>
        </div>
      )}
    </div>
  );
}

export default About;
