"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle, Clock, Calendar, RefreshCw, X } from "lucide-react";
import { useCommunityBilling } from "@/contexts/CommunityBillingContext";
import PayNowButton, { TrialConversionButton } from "@/components/payments/PayNowButton";


export default function CommunityPlanInfo() {
  const { slug } = useParams<{ slug: string }>();
  const {
    billingData: planInfo,
    loading,
    error: contextError,
    refreshing,
    refreshBillingData,
    daysRemaining,
    trialActive,
    subscriptionActive,
    percentRemaining
  } = useCommunityBilling();
  const [cancelling, setCancelling] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);



  // Format date to a readable string
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleManualRefresh = () => {
    setLocalError(null); // Clear any local errors
    refreshBillingData();
  };

  const handleCancelSubscription = async () => {
    // Check if we have subscription info
    if (!subscriptionActive) {
      setLocalError("No active subscription found to cancel");
      return;
    }

    if (!planInfo?._id) {
      setLocalError("Community information not available");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to cancel your subscription? You will continue to have access until the end of your current billing period. No refunds will be provided after payment completion."
    );

    if (!confirmed) return;

    try {
      setCancelling(true);
      setLocalError(null);

      // Try to cancel using subscriptionId if available, otherwise use community-based cancellation
      let requestBody;
      let endpoint;

      if (planInfo.subscriptionId) {
        // Use the existing subscription cancellation endpoint
        endpoint = "/api/community-subscriptions/cancel";
        requestBody = {
          subscriptionId: planInfo.subscriptionId,
          communityId: planInfo._id,
          cancelAtCycleEnd: true
        };
      } else {
        // Use community-based cancellation endpoint (we may need to create this)
        endpoint = `/api/community/${slug}/cancel-subscription`;
        requestBody = {
          communityId: planInfo._id,
          cancelAtCycleEnd: true
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message);
        // Refresh plan info to show updated status
        refreshBillingData();
      } else {
        throw new Error(data.error || "Failed to cancel subscription");
      }
    } catch (err) {
      console.error("Error cancelling subscription:", err);
      setLocalError(err instanceof Error ? err.message : "Failed to cancel subscription");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show context error or local error
  const displayError = contextError || localError;
  if (displayError) {
    return (
      <div className="p-4 bg-error/10 rounded-lg flex items-center gap-3 text-error">
        <AlertCircle className="w-6 h-6" />
        <div className="flex-1">
          <p>{displayError}</p>
          {localError && (
            <button
              onClick={() => setLocalError(null)}
              className="text-xs underline mt-1 hover:no-underline"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    );
  }



  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Plan Information</h2>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="btn btn-outline btn-sm"
          title="Refresh plan information"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>


      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Plan Status */}
        <div className="card bg-base-200 shadow-md">
          <div className="card-body">
            <h3 className="card-title flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Current Plan
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Status:</span>
                <span className={`font-semibold ${
                  subscriptionActive ? "text-success" :
                  trialActive ? "text-warning" :
                  "text-error"
                }`}>
                  {subscriptionActive ? "Premium (Active)" :
                   trialActive ? "Trial Period" :
                   planInfo?.paymentStatus === "expired" ? "Expired" : "Free Plan"}
                </span>
              </div>

              {subscriptionActive && planInfo?.subscriptionEndDate && (
                <div className="flex justify-between items-center">
                  <span className="font-medium">Renews On:</span>
                  <span>{formatDate(planInfo.subscriptionEndDate)}</span>
                </div>
              )}

              {trialActive && (
                <div className="flex justify-between items-center">
                  <span className="font-medium">Trial Ends:</span>
                  <span>{formatDate(planInfo?.adminTrialInfo?.endDate)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Trial Information */}
        {trialActive && (
          <div className="card bg-base-200 shadow-md">
            <div className="card-body">
              <h3 className="card-title flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Trial Progress
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Days Remaining:</span>
                  <span className="font-semibold text-warning">{daysRemaining} days</span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full bg-warning"
                    style={{ width: `${percentRemaining}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-xs text-gray-600">
                  {planInfo?.adminTrialInfo?.startDate && (
                    <span>Started: {formatDate(planInfo.adminTrialInfo.startDate)}</span>
                  )}
                  {planInfo?.adminTrialInfo?.endDate && (
                    <span>Ends: {formatDate(planInfo.adminTrialInfo.endDate)}</span>
                  )}
                </div>

                {/* Trial Conversion Button */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <TrialConversionButton
                    communityId={planInfo?._id}
                    communitySlug={slug}
                    daysRemaining={daysRemaining}
                    context="settings"
                    onSuccess={(subscription) => {
                      console.log('Trial converted successfully:', subscription);
                      refreshBillingData(); // Refresh the billing data
                    }}
                    onError={(error) => {
                      console.error('Trial conversion error:', error);
                      setLocalError(error);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Plan Features */}
        <div className="card bg-base-200 shadow-md">
          <div className="card-body">
            <h3 className="card-title">Plan Features</h3>
            
            <div className="space-y-2">
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-success mr-2" />
                <span className="text-sm">Community Management</span>
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-success mr-2" />
                <span className="text-sm">Member Engagement Tools</span>
              </div>
              {(subscriptionActive || trialActive) && (
                <>
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-success mr-2" />
                    <span className="text-sm">Advanced Analytics</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-success mr-2" />
                    <span className="text-sm">Priority Support</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-success mr-2" />
                    <span className="text-sm">Custom Branding</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card bg-base-200 shadow-md">
          <div className="card-body">
            <h3 className="card-title">Quick Actions</h3>
            
            <div className="space-y-3">
              {!subscriptionActive && (
                <div className="space-y-2">
                  {trialActive ? (
                    <TrialConversionButton
                      communityId={planInfo?._id}
                      communitySlug={slug}
                      daysRemaining={daysRemaining}
                      size="md"
                      showFeatures={false}
                      context="settings"
                      onSuccess={(subscription) => {
                        console.log('Subscription activated:', subscription);
                        refreshBillingData();
                      }}
                      onError={(error) => {
                        console.error('Subscription error:', error);
                        setLocalError(error);
                      }}
                    />
                  ) : (
                    <PayNowButton
                      communityId={planInfo?._id}
                      communitySlug={slug}
                      buttonText="Start 14-Day Free Trial"
                      variant="primary"
                      size="md"
                      showFeatures={true}
                      context="settings"
                      onSuccess={(subscription) => {
                        console.log('Trial started:', subscription);
                        refreshBillingData();
                      }}
                      onError={(error) => {
                        console.error('Trial start error:', error);
                        setLocalError(error);
                      }}
                    />
                  )}

                  <div className="text-center">
                    <a
                      href={`/billing/${slug}`}
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      View full billing details
                    </a>
                  </div>
                </div>
              )}
              
              {subscriptionActive && (
                <>
                  <div className="alert alert-success">
                    <CheckCircle className="w-5 h-5" />
                    <span>You're all set with Premium!</span>
                  </div>

                  {planInfo?.subscriptionStatus !== "cancelled" && (
                    <button
                      onClick={handleCancelSubscription}
                      disabled={cancelling}
                      className="btn btn-outline btn-error btn-block"
                    >
                      <X className="w-4 h-4" />
                      {cancelling ? "Cancelling..." : "Cancel Subscription"}
                    </button>
                  )}

                  {planInfo?.subscriptionStatus === "cancelled" && (
                    <div className="alert alert-warning">
                      <AlertCircle className="w-5 h-5" />
                      <span>Subscription cancelled. Access until {formatDate(planInfo?.subscriptionEndDate)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
