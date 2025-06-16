"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import CommunityNav from "@/components/communitynav/CommunityNav";
import { Loader2, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import SimplePaymentButton from "@/components/payments/SimplePaymentButton";

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
  const [community, setCommunity] = useState<CommunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skipPayment, setSkipPayment] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [remainingDays, setRemainingDays] = useState<number | null>(null);
  const [trialActive, setTrialActive] = useState(false);
  const [isPaymentActive, setIsPaymentActive] = useState(false);
  const [trialEligible, setTrialEligible] = useState(true);
  const [trialEligibilityReason, setTrialEligibilityReason] = useState<string | null>(null);
  const [communitySuspended, setCommunitySuspended] = useState(false);

  const slug = params?.slug as string;

  useEffect(() => {
    const fetchCommunity = async () => {
      if (!slug) return;

      try {
        setLoading(true);

        // Check URL parameters for suspension status
        const urlParams = new URLSearchParams(window.location.search);
        const suspended = urlParams.get('suspended') === 'true';
        setCommunitySuspended(suspended);

        const communityData = await apiClient.getcommunity(slug);

        // Convert the ICommunity data to CommunityData format
        // Ensure _id is a string (it might be an ObjectId from MongoDB)
        const communityId = communityData._id;
        let idAsString = '';

        if (communityId) {
          if (typeof communityId === 'object' && communityId.toString) {
            idAsString = communityId.toString();
          } else if (typeof communityId === 'string') {
            idAsString = communityId;
          }
        }

        // Check trial eligibility and comprehensive status if user is authenticated
        if (session?.user?.id) {
          try {
            // Check trial eligibility
            const eligibilityResponse = await fetch(`/api/trial/check-eligibility`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                trialType: 'community',
                communityId: idAsString
              })
            });

            if (eligibilityResponse.ok) {
              const eligibilityData = await eligibilityResponse.json();
              setTrialEligible(eligibilityData.eligible);
              setTrialEligibilityReason(eligibilityData.reason);
            }

            // Get comprehensive community status using slug
            const statusResponse = await fetch(`/api/community/${slug}/status`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              }
            });

            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              console.log('Community status data:', statusData);

              // Update state based on comprehensive status
              if (statusData.found) {
                // Use the comprehensive status data to override local state
                setIsPaymentActive(statusData.hasActiveSubscription);
                setTrialActive(statusData.hasActiveTrial);
                setRemainingDays(statusData.daysRemaining);

                // Set trial eligibility based on comprehensive status
                setTrialEligible(statusData.isEligibleForTrial);

                // Set appropriate eligibility reason
                if (!statusData.isEligibleForTrial) {
                  if (statusData.hasActiveSubscription) {
                    setTrialEligibilityReason("Community already has active subscription");
                  } else if (statusData.hasActiveTrial) {
                    setTrialEligibilityReason("Community already has an active trial");
                  } else {
                    setTrialEligibilityReason("Trial has already been used");
                  }
                }

                // Update community data with the latest information
                if (statusData.community) {
                  setCommunity(prev => prev ? {
                    ...prev,
                    adminTrialInfo: statusData.community.adminTrialInfo,
                    paymentStatus: statusData.community.paymentStatus,
                    subscriptionEndDate: statusData.community.subscriptionEndDate,
                    freeTrialActivated: statusData.community.freeTrialActivated
                  } : null);
                }

                // Skip the fallback logic below since we have comprehensive status
                setLoading(false);
                return;
              }
            }
          } catch (err) {
            console.error('Error checking trial eligibility and status:', err);
          }
        }

        // Convert any Date objects to strings
        const subscriptionEndDateStr = communityData.subscriptionEndDate
          ? typeof communityData.subscriptionEndDate === 'string'
            ? communityData.subscriptionEndDate
            : communityData.subscriptionEndDate.toString()
          : undefined;

        // Fallback logic only runs if comprehensive status check failed
        console.log('Using fallback status detection logic');

        let remainingTrialDays = null;
        let isTrialActive = false;
        let isPaid = communityData.paymentStatus === 'paid';

        // Basic trial detection as fallback
        if (communityData.adminTrialInfo?.activated && communityData.adminTrialInfo?.endDate) {
          const endDate = new Date(communityData.adminTrialInfo.endDate);
          const today = new Date();
          const diffTime = endDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays > 0) {
            remainingTrialDays = diffDays;
            isTrialActive = true;
          }
        }

        // Set fallback state
        setIsPaymentActive(isPaid);
        setRemainingDays(remainingTrialDays);
        setTrialActive(isTrialActive);

        // Convert Date objects to strings for the adminTrialInfo
        const adminTrialInfoFormatted = communityData.adminTrialInfo ? {
          activated: communityData.adminTrialInfo.activated,
          startDate: communityData.adminTrialInfo.startDate ? communityData.adminTrialInfo.startDate.toString() : undefined,
          endDate: communityData.adminTrialInfo.endDate ? communityData.adminTrialInfo.endDate.toString() : undefined
        } : undefined;

        setCommunity({
          _id: idAsString,
          name: communityData.name || '',
          slug: communityData.slug || '',
          description: communityData.description,
          adminTrialInfo: adminTrialInfoFormatted,
          paymentStatus: communityData.paymentStatus,
          freeTrialActivated: communityData.freeTrialActivated,
          subscriptionEndDate: subscriptionEndDateStr
        });
      } catch (err) {
        setError("Failed to load community information");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchCommunity();
    }
  }, [slug, session]);

  const handlePaymentSuccess = async (data: any) => {
    try {
      if (!community?._id) {
        throw new Error('Community ID not found');
      }

      // Update the community with payment information using the API client method
      await apiClient.completeCommunityPayment(community._id, {
        transactionId: data.transaction?.id || data.subscription?.razorpaySubscriptionId,
        paymentId: data.payment?.id || data.subscription?.razorpaySubscriptionId,
        freeTrialActivated: false
      });

      // Redirect to the community page with success parameter
      router.push(`/Newcompage/${slug}?subscription=success`);
    } catch (err) {
      setError("Payment was successful but we couldn't update your community. Please contact support.");
      console.error(err);
    }
  };



  // Function to handle trial cancellation
  const handleCancelTrial = async () => {
    if (!confirm("Are you sure you want to cancel your trial? This will immediately suspend your community until you subscribe.")) {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch(`/api/community/${slug}/cancel-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to cancel trial');
      }
      
      await response.json();

      // Show success message
      alert('Trial cancelled successfully. Your community has been suspended until you subscribe.');
      
      // Refresh the page to show updated status
      window.location.reload();
    } catch (err) {
      console.error('Error cancelling trial:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel trial');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!community?.subscriptionId) {
      setError("No subscription found to cancel");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to cancel your subscription? You will continue to have access until the end of your current billing period. No refunds will be provided after payment completion."
    );

    if (!confirmed) return;

    try {
      setCancelling(true);
      setError(null);

      const response = await fetch("/api/community-subscriptions/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscriptionId: community.subscriptionId,
          communityId: community._id,
          cancelAtCycleEnd: true
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message);
        // Refresh community data to show updated status
        window.location.reload();
      } else {
        throw new Error(data.error || "Failed to cancel subscription");
      }
    } catch (err) {
      console.error("Error cancelling subscription:", err);
      setError(err instanceof Error ? err.message : "Failed to cancel subscription");
    } finally {
      setCancelling(false);
    }
  };

  const handleSkipPayment = async () => {
    try {
      if (!community?._id || !session?.user?.id) {
        throw new Error('Community ID or user ID not found');
      }

      setLoading(true);
      setSkipPayment(true);

      // First check if trial is already active to prevent reset
      const statusResponse = await fetch(`/api/community/${slug}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.found && statusData.hasActiveTrial) {
          // Trial is already active, just update local state
          setTrialActive(true);
          setRemainingDays(statusData.daysRemaining);
          alert('Your trial is already active! You have ' + statusData.daysRemaining + ' days remaining.');
          return;
        }
      }

      console.log('Creating subscription for community:', community._id);

      // Create community subscription with 14-day trial
      const response = await fetch('/api/community-subscriptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          communityId: community._id,
          adminId: session.user.id,
          customerNotify: true,
          notes: {
            source: 'billing_page',
            communityName: community.name
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create subscription');
      }

      const subscriptionData = await response.json();
      console.log('Subscription creation response:', subscriptionData);
      
      // Update local state with subscription data
      setCommunity(prev => prev ? {
        ...prev,
        paymentStatus: 'trial',
        subscriptionEndDate: subscriptionData.trialEndDate,
        freeTrialActivated: true,
        adminTrialInfo: {
          activated: true,
          startDate: new Date().toISOString(),
          endDate: subscriptionData.trialEndDate
        }
      } : null);
      
      // Set trial as active
      setTrialActive(true);

      // Calculate remaining days (14 days from now)
      const trialEndDate = new Date(subscriptionData.trialEndDate);
      const today = new Date();
      const diffTime = trialEndDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        setRemainingDays(diffDays);
      }
      
      // Show success message
      alert('14-day free trial started successfully! You now have unlimited access to all community features.');

      // Redirect to the community page after a short delay
      setTimeout(() => {
        router.push(`/Newcompage/${slug}`);
      }, 1500);
    } catch (err) {
      setError("Failed to create subscription. Please try again.");
      console.error('Subscription creation error:', err);
    } finally {
      setLoading(false);
      setSkipPayment(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen overflow-x-hidden" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <CommunityNav />
        <div className="w-full px-2 sm:px-4 py-16 mt-20 flex justify-center items-center">
          <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin" style={{ color: "var(--brand-primary)" }} />
        </div>
      </main>
    );
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  if (error) {
    return (
      <main className="min-h-screen overflow-x-hidden" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <CommunityNav />
        <div className="w-full px-2 sm:px-4 py-16 mt-20">
          <div className="max-w-md mx-auto bg-white p-4 sm:p-6 lg:p-8 rounded-lg shadow-lg">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600 mb-4">Error</h1>
            <p className="mb-6 text-sm sm:text-base break-words">{error}</p>
            <button
              onClick={() => router.back()}
              className="btn btn-primary w-full sm:w-auto"
            >
              Go Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <CommunityNav />
      <div className="w-full max-w-full px-2 sm:px-4 py-8 mt-20">
        <div
          className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 rounded-lg shadow-lg transition-colors duration-300"
          style={{ backgroundColor: "var(--card-bg)" }}
        >
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-center mb-6" style={{ color: "var(--text-primary)" }}>
            Complete Your Community Setup
          </h1>
          
          {community && (
            <div className="mb-6">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-2 break-words">{community.name}</h2>
              {community.description && (
                <p className="text-gray-600 text-sm sm:text-base break-words">{community.description}</p>
              )}

              {/* Show suspension notice if community was suspended */}
              {communitySuspended && (
                <div className="mt-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-red-800 font-semibold text-sm sm:text-base">Community Suspended</h3>
                      <p className="text-red-700 text-xs sm:text-sm mt-1 break-words">
                        Your community has been suspended due to trial expiration. Subscribe now to reactivate access for all members.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div
            className="border-l-4 p-3 sm:p-4 mb-6 transition-colors duration-300"
            style={{
              backgroundColor: "var(--bg-accent)",
              borderColor: "var(--brand-primary)"
            }}
          >
            <h3 className="font-bold text-sm sm:text-base" style={{ color: "var(--brand-primary)" }}>Subscription Details</h3>
            <p className="mt-2 text-sm sm:text-base break-words">
              Your community subscription costs $29/month (₹2,400 INR), but as the admin, you can start with a 14-day free trial.
              After the trial period, your payment method will be automatically charged.
            </p>
            
            {trialActive && remainingDays !== null && (
              <div className="mt-4">
                <div className="flex flex-col sm:flex-row sm:justify-between text-xs sm:text-sm mb-1 gap-1">
                  <span className="font-semibold">Trial Period</span>
                  <span className="font-semibold" style={{ color: "var(--brand-primary)" }}>{remainingDays} days remaining</span>
                </div>
                {/* Enhanced progress bar with day markers */}
                <div className="relative pt-1 pb-3">
                  <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
                    <div
                      className="h-2 sm:h-3 rounded-full transition-all duration-300"
                      style={{
                        width: `${(remainingDays / 14) * 100}%`,
                        backgroundColor: "var(--brand-primary)"
                      }}
                    ></div>
                  </div>

                  {/* Day markers */}
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>Day 1</span>
                    <span>Day 7</span>
                    <span>Day 14</span>
                  </div>
                </div>

                {/* Trial dates */}
                <div className="flex flex-col sm:flex-row sm:justify-between text-xs text-gray-600 mt-1 gap-1">
                  {community?.adminTrialInfo?.startDate && (
                    <span className="truncate">Started: {new Date(community.adminTrialInfo.startDate).toLocaleDateString()}</span>
                  )}
                  {community?.adminTrialInfo?.endDate && (
                    <span className="truncate">Ends: {new Date(community.adminTrialInfo.endDate).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {isPaymentActive ? (
            <div className="card bg-white border border-green-200 shadow-lg p-4 sm:p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg sm:text-xl font-bold text-green-700 mb-2">Active Subscription</h3>
                  <p className="text-green-600 text-sm sm:text-base break-words">
                    Your community has an active paid subscription until {community?.subscriptionEndDate ? new Date(community.subscriptionEndDate).toLocaleDateString() : 'N/A'}
                  </p>
                  {community?.subscriptionStatus !== "cancelled" && (
                    <div className="mt-4">
                      <button
                        onClick={handleCancelSubscription}
                        disabled={cancelling}
                        className="btn btn-outline btn-error btn-sm"
                      >
                        <X className="w-4 h-4" />
                        {cancelling ? "Cancelling..." : "Cancel Subscription"}
                      </button>
                      <p className="text-xs text-gray-500 mt-2">
                        No refunds after payment completion. Access continues until end of billing period.
                      </p>
                    </div>
                  )}
                  {community?.subscriptionStatus === "cancelled" && (
                    <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-orange-700 text-sm font-medium">
                        Subscription cancelled. Access until {community?.subscriptionEndDate ? new Date(community.subscriptionEndDate).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  )}
                </div>
                <div className="bg-green-100 p-2 sm:p-3 rounded-full flex-shrink-0 self-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full">
              <div
                className="card border p-4 sm:p-6 lg:p-8 transition-all duration-300 hover:shadow-lg"
                style={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: "var(--brand-primary)",
                  boxShadow: "var(--shadow-md)"
                }}
              >
                <div className="text-center mb-4 sm:mb-6">
                  <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mb-2 break-words" style={{ color: "var(--brand-primary)" }}>Community Management Plan</h3>
                  <div className="text-2xl sm:text-3xl font-bold mb-2">$29<span className="text-base sm:text-lg font-normal">/month</span></div>
                  <p className="text-xs sm:text-sm text-gray-600">Processed as ₹2,400 INR</p>
                </div>

                  <div className="mb-4 sm:mb-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4">
                      <p className="text-blue-800 font-medium text-center text-sm sm:text-base">🎉 14-Day Free Trial Included</p>
                      <p className="text-blue-600 text-xs sm:text-sm text-center mt-1">No payment required to start</p>
                    </div>
                  </div>

                  <p className="mb-4 sm:mb-6 text-center text-gray-700 text-sm sm:text-base break-words">
                    Complete community management solution with unlimited features. Start with a 14-day free trial, then continue with monthly billing.
                  </p>

                  <ul className="mb-6 sm:mb-8 space-y-2 sm:space-y-3">
                    <li className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mr-2 sm:mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm sm:text-base">Unlimited members</span>
                    </li>
                    <li className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mr-2 sm:mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm sm:text-base">Unlimited storage</span>
                    </li>
                    <li className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mr-2 sm:mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm sm:text-base">Unlimited events & channels</span>
                    </li>
                    <li className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mr-2 sm:mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm sm:text-base">Analytics & insights</span>
                    </li>
                    <li className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mr-2 sm:mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm sm:text-base">Email support</span>
                    </li>
                  </ul>
                  {trialActive ? (
                    <div className="space-y-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-green-700 font-medium">Your 14-day trial is active</p>
                        <p className="text-sm text-green-600 mt-1">{remainingDays} days remaining</p>
                      </div>
                      <button
                        onClick={() => handleCancelTrial()}
                        className="btn btn-outline btn-error w-full"
                      >
                        Cancel Trial
                      </button>
                    </div>
                  ) : !trialEligible ? (
                    <div className="space-y-4">
                      <div className="text-center p-3 sm:p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <p className="text-orange-700 font-medium text-sm sm:text-base">Trial Not Available</p>
                        <p className="text-xs sm:text-sm text-orange-600 mt-1 break-words">{trialEligibilityReason}</p>
                      </div>
                      <button
                        onClick={handleSkipPayment}
                        disabled={skipPayment || loading}
                        className="btn bg-primary text-white hover:bg-primary/90 border-none w-full text-sm sm:text-base"
                      >
                        {skipPayment ? (
                          <span className="loading loading-spinner loading-sm"></span>
                        ) : (
                          "Subscribe Now ($29/month)"
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      <button
                        onClick={handleSkipPayment}
                        disabled={skipPayment || loading}
                        className="btn bg-primary text-white hover:bg-primary/90 border-none w-full text-sm sm:text-base lg:text-lg py-2 sm:py-3"
                      >
                        {skipPayment ? (
                          <span className="loading loading-spinner loading-sm"></span>
                        ) : (
                          "Start 14-Day Free Trial"
                        )}
                      </button>

                      <div className="divider text-xs sm:text-sm">OR</div>

                      <div className="text-center">
                        <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3 break-words">Skip the trial and subscribe immediately</p>
                        <SimplePaymentButton
                          communityId={community?._id}
                          communitySlug={slug}
                          buttonText="Pay Now ($29/month)"
                          onSuccess={handlePaymentSuccess}
                          onError={(error) => setError("Payment failed: " + error)}
                          className="btn btn-outline btn-primary w-full text-sm sm:text-base"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
          )}
        </div>
      </div>
    </main>
  );
}
