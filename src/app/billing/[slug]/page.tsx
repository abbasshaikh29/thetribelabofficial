"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import CommunityNav from "@/components/communitynav/CommunityNav";
import {
  Loader2,
  X,
  CheckCircle,
  Clock,
  AlertTriangle,
  Crown,
  CreditCard,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import SimplePaymentButton from "@/components/payments/SimplePaymentButton";
import CommunityStatusDebug from "@/components/debug/CommunityStatusDebug";
import { useNotification } from "@/components/Notification";

// Import ICommunity type to ensure compatibility

// Create a simplified version of ICommunity for our needs
interface CommunityData {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  adminTrialInfo?: {
    activated: boolean;
    startDate?: string;
    endDate?: string;
  };
  paymentStatus?: string;
  freeTrialActivated?: boolean;
  subscriptionEndDate?: string;
  subscriptionId?: string;
  subscriptionStatus?: string;
}

export default function BillingPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { showNotification } = useNotification();
  const [community, setCommunity] = useState<CommunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skipPayment, setSkipPayment] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [remainingDays, setRemainingDays] = useState<number | null>(null);
  const [trialActive, setTrialActive] = useState(false);
  const [isPaymentActive, setIsPaymentActive] = useState(false);
  const [trialEligible, setTrialEligible] = useState(true);
  const [trialEligibilityReason, setTrialEligibilityReason] = useState<
    string | null
  >(null);
  const [communitySuspended, setCommunitySuspended] = useState(false);
  const [statusRefreshing, setStatusRefreshing] = useState(false);

  const slug = params?.slug as string;

  // Helper function to refresh status
  const refreshStatus = useCallback(async () => {
    if (!slug || !session?.user?.id) return;

    try {
      setStatusRefreshing(true);
      const statusResponse = await fetch(`/api/community/${slug}/status`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "Content-Type": "application/json",
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();

        if (statusData.found) {
          setIsPaymentActive(statusData.hasActiveSubscription);
          setTrialActive(statusData.hasActiveTrial);
          setRemainingDays(statusData.daysRemaining);
          setTrialEligible(statusData.isEligibleForTrial);

          // Update community data with latest information
          if (statusData.community) {
            setCommunity((prev) => ({
              ...prev!,
              adminTrialInfo: statusData.community.adminTrialInfo,
              paymentStatus: statusData.community.paymentStatus,
              subscriptionEndDate:
                statusData.community.subscriptionEndDate?.toString(),
              subscriptionId: statusData.community.subscriptionId,
              subscriptionStatus: statusData.community.subscriptionStatus,
              freeTrialActivated: statusData.community.freeTrialActivated,
            }));
          }
        }
      }
    } catch (err) {
      console.error("Error refreshing status:", err);
    } finally {
      setStatusRefreshing(false);
    }
  }, [slug, session?.user?.id]);

  const fetchCommunity = async () => {
      if (!slug) {
        setError("Community slug is required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // First fetch basic community data
        const communityResponse = await fetch(`/api/community/${slug}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });

        if (!communityResponse.ok) {
          const errorData = await communityResponse.json();
          throw new Error(
            errorData.error || "Failed to load community information"
          );
        }

        const communityData = await communityResponse.json();

        if (!communityData || !communityData._id) {
          throw new Error("Invalid community data received");
        }

        // Robustly convert MongoDB ObjectId (or similar) to string
        let idAsString: string;
        if (
          typeof communityData._id === "object" &&
          communityData._id !== null
        ) {
          // If the driver exposes toHexString (MongoDB Node driver) use it
          if (typeof (communityData._id as any).toHexString === "function") {
            idAsString = (communityData._id as any).toHexString();
          } else {
            // Fallback to toString()
            idAsString = (communityData._id as any).toString();
          }
        } else {
          idAsString = String(communityData._id);
        }

        // Create initial community state
        const initialCommunityState = {
          _id: idAsString,
          name: communityData.name || "",
          slug: communityData.slug || "",
          description: communityData.description,
          adminTrialInfo: communityData.adminTrialInfo,
          paymentStatus: communityData.paymentStatus,
          freeTrialActivated: communityData.freeTrialActivated,
          subscriptionEndDate: communityData.subscriptionEndDate?.toString(),
          subscriptionId: communityData.subscriptionId,
          subscriptionStatus: communityData.subscriptionStatus,
        };

        // Set initial community state
        setCommunity(initialCommunityState);

        // Check URL parameters for suspension status
        const urlParams = new URLSearchParams(window.location.search);
        const suspended = urlParams.get("suspended") === "true";
        const expired = urlParams.get("expired") === "true";
        setCommunitySuspended(suspended);

        // Show notification if trial expired
        if (expired) {
          showNotification(
            "⏰ Your free trial has expired. Subscribe now to continue accessing your community.",
            "warning"
          );
        }

        // Only proceed with additional checks if user is authenticated
        if (session?.user?.id) {
          try {
            if (process.env.NODE_ENV === "development") {
              console.log(
                "🔍 DEBUG: Checking community status for billing page"
              );
              console.log("Community data:", {
                id: idAsString,
                paymentStatus: communityData.paymentStatus,
                freeTrialActivated: communityData.freeTrialActivated,
                subscriptionEndDate: communityData.subscriptionEndDate,
                subscriptionId: communityData.subscriptionId,
              });
            }

            // Check trial eligibility
            const eligibilityResponse = await fetch(
              `/api/trial/check-eligibility`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  trialType: "community",
                  communityId: idAsString,
                }),
              }
            );

            if (eligibilityResponse.ok) {
              const eligibilityData = await eligibilityResponse.json();
              setTrialEligible(eligibilityData.eligible);
              setTrialEligibilityReason(eligibilityData.reason);
            } else {
              const errorData = await eligibilityResponse.json();
              if (process.env.NODE_ENV === "development") {
                console.error("Trial eligibility check failed:", errorData);
              }
            }

            // Get comprehensive community status
            const statusResponse = await fetch(
              `/api/community/${slug}/status`,
              {
                method: "GET",
                cache: "no-store",
                headers: {
                  "Cache-Control": "no-cache, no-store, must-revalidate",
                  Pragma: "no-cache",
                  Expires: "0",
                  "Content-Type": "application/json",
                },
              }
            );

            if (statusResponse.ok) {
              const statusData = await statusResponse.json();

              if (process.env.NODE_ENV === "development") {
                console.log("🔍 DEBUG: Status endpoint response:", {
                  found: statusData.found,
                  hasActiveSubscription: statusData.hasActiveSubscription,
                  hasActiveTrial: statusData.hasActiveTrial,
                  daysRemaining: statusData.daysRemaining,
                  paymentStatus: statusData.paymentStatus,
                  community: statusData.community
                    ? {
                        paymentStatus: statusData.community.paymentStatus,
                        freeTrialActivated:
                          statusData.community.freeTrialActivated,
                        subscriptionEndDate:
                          statusData.community.subscriptionEndDate,
                        subscriptionId: statusData.community.subscriptionId,
                      }
                    : null,
                });
              }

              if (statusData.found) {
                setIsPaymentActive(statusData.hasActiveSubscription);
                setTrialActive(statusData.hasActiveTrial);
                setRemainingDays(statusData.daysRemaining);
                setTrialEligible(statusData.isEligibleForTrial);

                if (!statusData.isEligibleForTrial) {
                  if (statusData.hasActiveSubscription) {
                    setTrialEligibilityReason(
                      "Community already has active subscription"
                    );
                  } else if (statusData.hasActiveTrial) {
                    setTrialEligibilityReason(
                      "Community already has an active trial"
                    );
                  } else {
                    setTrialEligibilityReason("Trial has already been used");
                  }
                }

                // Update community data with latest information
                if (statusData.community) {
                  setCommunity((prev) => ({
                    ...prev!,
                    adminTrialInfo: statusData.community.adminTrialInfo,
                    paymentStatus: statusData.community.paymentStatus,
                    subscriptionEndDate:
                      statusData.community.subscriptionEndDate?.toString(),
                    freeTrialActivated: statusData.community.freeTrialActivated,
                    subscriptionId: statusData.community.subscriptionId,
                    subscriptionStatus: statusData.community.subscriptionStatus,
                  }));
                }
              } else {
                if (process.env.NODE_ENV === "development") {
                  console.error(
                    "Status endpoint returned no data:",
                    statusData
                  );
                }
              }
            } else {
              const errorData = await statusResponse.json();
              if (process.env.NODE_ENV === "development") {
                console.error("Status check failed:", errorData);
              }
            }
          } catch (err) {
            if (process.env.NODE_ENV === "development") {
              console.error(
                "Error checking trial eligibility and status:",
                err
              );
            }
            // Don't throw here, just log the error as this is supplementary information
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("Error fetching community:", err);
        }
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load community information"
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    if (slug) {
      fetchCommunity();
    }
  }, [slug, session]);

  // Auto-refresh status every 30 seconds when on billing page
  useEffect(() => {
    if (!isPaymentActive && !trialActive && slug && session?.user?.id) {
      const interval = setInterval(() => {
        refreshStatus();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isPaymentActive, trialActive, slug, session?.user?.id, refreshStatus]);

  const handlePaymentSuccess = async (data: any) => {
    try {
      if (!community?._id) {
        throw new Error("Community ID not found");
      }

      // Update the community with payment information using the API client method
      await apiClient.completeCommunityPayment(community._id, {
        transactionId:
          data.transaction?.id || data.subscription?.razorpaySubscriptionId,
        paymentId:
          data.payment?.id || data.subscription?.razorpaySubscriptionId,
        freeTrialActivated: false,
      });

      // Refresh status after payment success
      await refreshStatus();

      // Redirect to the community page with success parameter
      router.push(`/Newcompage/${slug}?subscription=success`);
    } catch (err) {
      setError(
        "Payment was successful but we couldn't update your community. Please contact support."
      );
      if (process.env.NODE_ENV === "development") {
        console.error(err);
      }
    }
  };

  const handleSkipPayment = async () => {
    try {
      // Validate session and community data first
      if (!session?.user?.id) {
        setError("Please sign in to continue");
        router.push("/login");
        return;
      }

      if (!community) {
        setError("Community information not available");
        return;
      }

      if (!community._id) {
        setError("Invalid community information");
        return;
      }

      setLoading(true);
      setSkipPayment(true);
      setError(null); // Clear any previous errors

      // First check if trial is already active to prevent reset
      const statusResponse = await fetch(`/api/community/${slug}/status`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.found && statusData.hasActiveTrial) {
          // Trial is already active, just update local state
          setTrialActive(true);
          setRemainingDays(statusData.daysRemaining);
          showNotification(
            `Your trial is already active! You have ${statusData.daysRemaining} days remaining.`,
            "info"
          );
          setLoading(false);
          setSkipPayment(false);
          return;
        }
      }

      if (process.env.NODE_ENV === "development") {
        console.log("Creating subscription for community:", community._id);
      }

      // Create community subscription with 14-day trial
      const response = await fetch("/api/community-subscriptions/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          communityId: community._id,
          adminId: session.user.id,
          customerNotify: true,
          notes: {
            source: "billing_page",
            communityName: community.name,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create subscription");
      }

      const data = await response.json();
      if (process.env.NODE_ENV === "development") {
        console.log("Subscription created:", data);
      }

      // Refresh status after trial activation
      await refreshStatus();

      // Redirect to the community page
      router.push(`/Newcompage/${slug}?trial=success`);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error skipping payment:", err);
      }
      setError(err instanceof Error ? err.message : "Failed to skip payment");
      setSkipPayment(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-error/10 rounded-lg p-4 max-w-md w-full flex items-start gap-3">
          <X className="w-5 h-5 text-error flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-error">Error</h3>
            <p className="text-error/80">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-warning/10 rounded-lg p-4 max-w-md w-full">
          <h3 className="font-semibold text-warning">Community Not Found</h3>
          <p className="text-warning/80">
            The requested community could not be found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <CommunityNav />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Community Billing</h1>

          {communitySuspended && (
            <div className="alert alert-error mb-8">
              <h3 className="font-bold">Community Suspended</h3>
              <p>
                Your community has been suspended due to payment or trial
                expiration.
              </p>
            </div>
          )}

          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">{community.name}</h2>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Status refresh button */}
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">
                      Subscription Status
                    </h3>
                    <button
                      onClick={refreshStatus}
                      disabled={statusRefreshing}
                      className="btn btn-sm btn-outline"
                      title="Refresh subscription status"
                    >
                      {statusRefreshing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Refresh Status"
                      )}
                    </button>
                  </div>

                  {isPaymentActive ? (
                    <div className="space-y-4">
                      <div className="alert alert-success">
                        <div className="flex items-center">
                          <CheckCircle className="w-6 h-6 mr-2" />
                          <div>
                            <h3 className="font-bold">Active Subscription</h3>
                            <p>
                              Your community has an active paid subscription.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 bg-base-300 rounded-lg p-4">
                        <h4 className="font-semibold mb-3 text-lg">
                          Subscription Details
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Status:</span>
                            <span className="badge badge-success">
                              {community.subscriptionStatus || "Active"}
                            </span>
                          </div>
                          {community.subscriptionId && (
                            <div className="flex justify-between items-center">
                              <span className="font-medium">
                                Subscription ID:
                              </span>
                              <span className="text-sm font-mono">
                                {community.subscriptionId}
                              </span>
                            </div>
                          )}
                          {community.subscriptionEndDate && (
                            <div className="flex justify-between items-center">
                              <span className="font-medium">
                                Next billing date:
                              </span>
                              <span>
                                {new Date(
                                  community.subscriptionEndDate
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Plan:</span>
                            <span className="badge badge-primary">
                              Premium ($29/month)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : trialActive ? (
                    <div className="space-y-4">
                      <div className="alert alert-info">
                        <div className="flex items-center">
                          <Clock className="w-6 h-6 mr-2" />
                          <div>
                            <h3 className="font-bold">Free Trial Active</h3>
                            <p>
                              Enjoy your 14-day free trial with full premium
                              features!
                              {remainingDays !== null &&
                                ` ${remainingDays} days remaining.`}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                        <h4 className="font-semibold mb-3 text-lg text-blue-800">
                          Trial Details
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-blue-700">
                              Status:
                            </span>
                            <span className="badge badge-info">
                              14-Day Free Trial
                            </span>
                          </div>
                          {remainingDays !== null && (
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-blue-700">
                                Days Remaining:
                              </span>
                              <span
                                className={`font-bold ${remainingDays <= 3 ? "text-error" : "text-info"}`}
                              >
                                {remainingDays} days
                              </span>
                            </div>
                          )}
                          {community.adminTrialInfo?.endDate && (
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-blue-700">
                                Trial Ends:
                              </span>
                              <span className="text-blue-800">
                                {new Date(
                                  community.adminTrialInfo.endDate
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-blue-700">
                              Plan After Trial:
                            </span>
                            <span className="badge badge-primary">
                              Premium ($29/month)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6">
                        <div className="text-center mb-4">
                          <p className="text-sm text-gray-600 mb-3">
                            {remainingDays !== null && remainingDays <= 3
                              ? "Your trial is ending soon! Upgrade now to continue enjoying premium features."
                              : "Upgrade anytime to secure your premium features beyond the trial period."}
                          </p>
                        </div>
                        <SimplePaymentButton
                          communityId={community?._id}
                          communitySlug={slug}
                          buttonText="👑 Upgrade to Premium - $29/month"
                          className="btn btn-primary btn-lg w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 border-none shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-[1.02]"
                          onSuccess={(subscription) => {
                            showNotification("🎉 Subscription activated successfully!", "success");
                            fetchCommunity();
                          }}
                          onError={(error) => {
                            showNotification(`❌ Payment failed: ${error}`, "error");
                          }}
                        />
                      </div>
                    </div>
                  ) : community.subscriptionId &&
                    !trialActive &&
                    !isPaymentActive ? (
                    // Handle case where subscription exists but trial has ended AND no active payment (pending activation after trial)
                    <div className="space-y-4">
                      <div className="alert alert-warning">
                        <div className="flex items-center">
                          <AlertTriangle className="w-6 h-6 mr-2 animate-pulse" />
                          <div>
                            <h3 className="font-bold">
                              Trial Ended - Upgrade Required
                            </h3>
                            <p>
                              Your free trial has ended. Complete your
                              subscription to continue accessing premium
                              features.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-base-300 rounded-lg p-4">
                        <h4 className="font-semibold mb-3 text-lg">
                          Complete Your Subscription
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Status:</span>
                            <span className="badge badge-warning">
                              Payment Required
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Plan:</span>
                            <span className="badge badge-primary">
                              Premium ($29/month)
                            </span>
                          </div>
                          {community.subscriptionEndDate && (
                            <div className="flex justify-between items-center">
                              <span className="font-medium">Access until:</span>
                              <span>
                                {new Date(
                                  community.subscriptionEndDate
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h5 className="font-semibold text-yellow-800 mb-2">
                          Continue Your Premium Experience
                        </h5>
                        <p className="text-yellow-700 text-sm">
                          Your subscription is ready - just complete the payment
                          to restore full access to all premium features.
                        </p>
                      </div>

                      <div className="mt-6">
                        <SimplePaymentButton
                          communityId={community?._id}
                          communitySlug={slug}
                          buttonText="💳 Complete Payment - $29/month"
                          className="btn btn-primary btn-lg w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 border-none shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-[1.02]"
                          onSuccess={(subscription) => {
                            showNotification("🎉 Payment completed successfully!", "success");
                            fetchCommunity();
                          }}
                          onError={(error) => {
                            showNotification(`❌ Payment failed: ${error}`, "error");
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {trialEligible ? (
                        <>
                          <div className="alert alert-warning">
                            <div className="flex items-center">
                              <AlertTriangle className="w-6 h-6 mr-2" />
                              <div>
                                <h3 className="font-bold">No Active Plan</h3>
                                <p>
                                  Start your 14-day free trial now to access all
                                  premium features!
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-base-300 rounded-lg p-4">
                            <h4 className="font-semibold mb-3 text-lg">
                              Available Options
                            </h4>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="card bg-base-100 border border-primary">
                                <div className="card-body p-4">
                                  <h5 className="card-title text-primary">
                                    Free Trial
                                  </h5>
                                  <p className="text-sm">
                                    14-day trial with full access
                                  </p>
                                  <button
                                    onClick={handleSkipPayment}
                                    disabled={skipPayment || loading}
                                    className="btn btn-primary btn-sm"
                                  >
                                    {skipPayment ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Starting Trial...
                                      </>
                                    ) : (
                                      "Start Free Trial"
                                    )}
                                  </button>
                                </div>
                              </div>

                              <div className="card bg-base-100 border border-secondary">
                                <div className="card-body p-4">
                                  <h5 className="card-title text-secondary">
                                    Premium
                                  </h5>
                                  <p className="text-sm">
                                    $29/month - Immediate access
                                  </p>
                                  <SimplePaymentButton
                                    communityId={community._id}
                                    onSuccess={handlePaymentSuccess}
                                    disabled={skipPayment}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="alert alert-error">
                            <div className="flex items-center">
                              <X className="w-6 h-6 mr-2" />
                              <div>
                                <h3 className="font-bold">
                                  Trial Not Available
                                </h3>
                                <p>
                                  {trialEligibilityReason ||
                                    "Trial period has expired"}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-base-300 rounded-lg p-4">
                            <h4 className="font-semibold mb-3 text-lg">
                              Upgrade Required
                            </h4>
                            <p className="mb-4">
                              To continue using premium features, please upgrade
                              to our monthly plan.
                            </p>
                            <SimplePaymentButton
                              communityId={community._id}
                              onSuccess={handlePaymentSuccess}
                              disabled={skipPayment}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Debug Component */}
      <CommunityStatusDebug slug={slug} />
    </div>
  );
}
