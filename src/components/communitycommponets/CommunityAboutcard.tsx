"use client";

import React, { useState, useEffect } from "react";
import { ICommunity } from "@/models/Community";
import { useSession } from "next-auth/react";
import { useSettingsModal } from "@/components/modals/SettingsModalProvider";
import { Users, Link as LinkIcon, Copy, Check } from "lucide-react";
import CommunityJoinForm from "@/components/CommunityJoinForm";
import PaymentGatewayDialog from "@/components/community/PaymentGatewayDialog";
import { useRouter } from "next/navigation";

async function getCommunity(slug: string): Promise<{
  community: ICommunity | null;
  error?: string;
}> {
  try {
    // First try to fetch with the normal endpoint
    const communityResponse = await fetch(`/api/community/${slug}`);

    if (communityResponse.ok) {
      const communityData: ICommunity = await communityResponse.json();
      return { community: communityData };
    }

    // If that fails, try the debug endpoint to get more information
    const debugResponse = await fetch(
      `/api/community/check?slug=${encodeURIComponent(slug)}`
    );
    const debugData = await debugResponse.json();

    if (debugData.communityFound && debugData.communityData) {
      // Community exists but there was an error fetching it
      return {
        community: null,
        error: `Community exists but couldn't be fetched properly. Database status: ${JSON.stringify(
          debugData.dbStatus
        )}`,
      };
    } else if (debugData.totalCommunities > 0) {
      // Other communities exist but not this one
      return {
        community: null,
        error: `Community with slug "${slug}" not found. ${debugData.totalCommunities} other communities exist.`,
      };
    } else {
      // No communities exist at all
      return {
        community: null,
        error:
          "No communities found in the database. Database may be empty or not properly connected.",
      };
    }
  } catch (error) {
    return {
      community: null,
      error: `Error fetching community: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

interface NewCommmunityPageProps {
  slug: string;
}

function CommunityAboutcard({ slug }: NewCommmunityPageProps) {
  const { data: session } = useSession();
  const { openCommunitySettings } = useSettingsModal();
  const router = useRouter();
  const [communityData, setCommunityData] = useState<{
    community: ICommunity | null;
  }>({ community: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        // Add timestamp to prevent caching
        const timestamp = new Date().getTime();
        const data = await getCommunity(slug);

        if (data.community) {
          setCommunityData({
            community: data.community,
          });
          const userId = session?.user?.id;
          setIsMember(data.community?.members?.includes(userId!) || false);

          // Check pending join request status
          const pending = data.community?.joinRequests?.some(
            (req: any) => req.userId === userId && req.status === "pending"
          );
          setHasPendingRequest(pending || false);
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
    }

    if (slug) {
      fetchData();
    }
  }, [slug]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-error">Error</h2>
          <p>{error}</p>
          <div className="card-actions justify-end mt-4">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => (window.location.href = "/")}
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!communityData.community) {
    return <div>Community not found</div>;
  }

  const truncateDescription = (description: string | undefined) => {
    if (!description) return "";
    return description.length > 100
      ? description.substring(0, 100) + "..."
      : description;
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
      console.error("Failed to copy:", err);
    }
  };

  const handleFollow = async () => {
    if (!session?.user?.id || !communityData.community?._id) {
      // ... existing code ...
    }
  };

  const handleJoinClick = () => {
    if (!communityData.community) return;

    const isPaid =
      communityData.community.price && communityData.community.price > 0;

    if (isPaid) {
      setShowPaymentDialog(true);
    } else {
      setShowJoinModal(true);
    }
  };

  const getJoinButtonText = () => {
    if (!communityData.community) return "Join Community";

    const { price, pricingType } = communityData.community;
    const isPaid = price && price > 0;

    if (!isPaid) {
      return "Request to Join";
    }

    let priceText = `$${price}`;
    if (pricingType === "monthly") {
      priceText += "/mo";
    } else if (pricingType === "yearly") {
      priceText += "/yr";
    }

    return `Join for ${priceText}`;
  };

  return (
    <>
      <div className="card bg-base-100 shadow-xl overflow-hidden flex flex-col justify-between w-full mx-auto">
        <div className="w-full h-48 overflow-hidden relative">
          {communityData.community?.bannerImageurl ? (
            <div
              className="w-full h-full bg-base-300"
              style={{
                backgroundImage: `url(${communityData.community.bannerImageurl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
              aria-label={`${
                communityData.community.name || "Community"
              } banner`}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-primary/40 to-primary/20 flex items-center justify-center">
              <Users size={64} className="text-primary opacity-70" />
            </div>
          )}
        </div>
        <div className="card-body">
          <h1 className="card-title">
            {communityData.community?.name || "NewCommmunityPage"}
          </h1>

          <div className="mt-2">
            <p>
              {truncateDescription(
                communityData.community?.description || "this is a community"
              )}
            </p>
          </div>

          {/* Display member and admin counts */}
          <div className="flex items-center gap-3 mt-2">
            <div className="badge badge-primary  py-3  text-sm rounded-md">
              <div className="mr-2">
                <Users size={16} />
              </div>

              <span>
                {communityData.community?.members?.length || 0} members
              </span>
            </div>
            <div className="badge badge-primary gap-2 py-3 px-4 text-sm rounded-md">
              <span>
                {communityData.community?.admin ? 1 : 0}
                {communityData.community?.subAdmins?.length
                  ? ` + ${communityData.community.subAdmins.length}`
                  : ""}{" "}
                admin
                {(communityData.community?.subAdmins?.length || 0) > 0
                  ? "s"
                  : ""}
              </span>
            </div>
          </div>
          {/* Actions for members */}
          {isMember && (
            <div className="card-actions mt-4 flex-col w-full gap-2">
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={() => openCommunitySettings(slug)}
              >
                Community Settings
              </button>
              <button
                type="button"
                className="btn btn-primary w-full flex items-center gap-2"
                onClick={() => setShowInviteModal(true)}
              >
                <LinkIcon size={16} />
                Invite Members
              </button>
            </div>
          )}

          {/* Actions for non-members */}
          {!isMember && (
            <div className="card-actions mt-4 flex-col w-full gap-2">
              {!hasPendingRequest ? (
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  onClick={handleJoinClick}
                >
                  {getJoinButtonText()}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-disabled w-full"
                  disabled
                >
                  Join Request Pending
                </button>
              )}

              <button
                type="button"
                className="btn btn-outline w-full"
                onClick={handleFollow}
              >
                Follow Community
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Invite Members Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-base-100 p-6 rounded-lg shadow-xl w-96">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Invite Members</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowInviteModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="mb-4">
              <p className="text-sm mb-2">
                Share this link with people you want to invite to this
                community:
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div className="input-group w-full">
                  <input
                    type="text"
                    value={getInviteLink()}
                    readOnly
                    className="input input-bordered w-full text-sm"
                    aria-label="Invite link"
                    placeholder="Invite link"
                  />
                  <button
                    type="button"
                    className="btn btn-square btn-primary"
                    onClick={handleCopyInviteLink}
                    aria-label="Copy invite link"
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
              {copied && (
                <p className="text-xs text-success mt-2">
                  Link copied to clipboard!
                </p>
              )}
            </div>
            <div className="mt-4">
              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={() => setShowInviteModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Modal */}
      {showJoinModal && communityData.community && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: "var(--modal-overlay)" }}
        >
          <div
            className="p-6 rounded-lg shadow-xl w-full max-w-lg border"
            style={{
              backgroundColor: "var(--modal-bg)",
              borderColor: "var(--border-color)",
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                Join {communityData.community.name}
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowJoinModal(false)}
              >
                ✕
              </button>
            </div>
            <CommunityJoinForm
              communityId={communityData.community._id as unknown as string}
              communitySlug={slug}
              communityName={communityData.community.name}
              questions={communityData.community.adminQuestions || []}
              onSuccess={() => {
                setShowJoinModal(false);
                // refresh member state
                setIsMember(true);
                setHasPendingRequest(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Payment Gateway Dialog */}
      {showPaymentDialog && communityData.community && (
        <PaymentGatewayDialog
          isOpen={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          communityId={communityData.community._id as unknown as string}
          communitySlug={slug}
          communityName={communityData.community.name}
          price={communityData.community.price || 0}
          currency={communityData.community.currency}
          pricingType={communityData.community.pricingType}
          onSuccess={() => {
            setShowPaymentDialog(false);
            // refresh member state
            setIsMember(true);
            setHasPendingRequest(false);
          }}
        />
      )}
    </>
  );
}

export default CommunityAboutcard;
